import { createReadStream } from 'fs';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { Markup } from 'telegraf';
import IS_DEV from './is-dev.js';
import { PrepareCaption } from './common.js';
import LogMessageOrError from './log.js';
import { ForgetSentPost, MarkSentPost } from './marking-posts.js';
import SendingWrapper from './sending-wrapper.js';
import { SocialPick, VideoDone } from './social-picker.js';

/**
 * @param {import('../types/telegraf').DefaultContext} ctx
 * @param {{ status: boolean, platform: string, url: URL }} checkedLink
 * @param {boolean} [deleteSource]
 * @returns {void}
 */
const MakePost = (ctx, checkedLink, deleteSource = false) => {
  const { from } = ctx;

  SocialPick(checkedLink.url)
    .then(async (socialPost) => {
      if (checkedLink.platform === 'Youtube') {
        /** Limit for Youtube videos in bytes */
        const YOUTUBE_MAX_FILESIZE = 1024 * 1024 * (IS_DEV ? 50 : 100);
        const validVideoOptions = socialPost.medias
          .filter(
            (media) =>
              /video\s\+\saudio/i.test(media.description) && media.filetype === 'mp4' && !Number.isNaN(media.filesize)
          )
          .sort((prev, next) => prev.filesize - next.filesize);

        const bestVideo = validVideoOptions.pop();
        if (!bestVideo) return;
        // Checking only best format for size limit, so 360p file wouldn't be sent for 720p video
        if (bestVideo.filesize > YOUTUBE_MAX_FILESIZE) return;

        socialPost.caption = `[Youtube ${bestVideo.description.match(/^\S+/)?.[0] || '???p'}] ${socialPost.author} – ${
          socialPost.caption
        }`.trim();
        bestVideo.filename = await fetch(bestVideo.externalUrl).then((res) => res.body);
        bestVideo.externalUrl = checkedLink.url;
        socialPost.medias = [bestVideo];
      }

      if (checkedLink.platform === 'Tiktok') {
        const validVideoOptions = socialPost.medias
          .filter((media) => /video\s\+\saudio/i.test(media.description) && media.filetype === 'mp4')
          .sort((prev, next) => prev.filesize - next.filesize)
          /** Watermarked is worse */
          .sort((prev, next) => /watermark/i.test(next.description) - /watermark/i.test(prev.description))
          /** H265 is better */
          .sort((prev, next) => /h265/i.test(prev.description) - /h265/i.test(next.description));

        const bestVideo = validVideoOptions.pop();
        if (!bestVideo) return;

        socialPost.caption = `[Tiktok ${bestVideo.description.match(/^\S+/)?.[0] || '???p'}] ${
          socialPost.caption
        }`.trim();
        bestVideo.filename = await fetch(bestVideo.externalUrl).then((res) => res.body);
        bestVideo.externalUrl = checkedLink.url;
        socialPost.medias = [bestVideo];
      }

      /** Post does not contain any media */
      if (!socialPost?.medias?.length) return;

      let caption = `<i>${PrepareCaption(socialPost.caption)}</i>`;

      if (socialPost.medias.length === 1) {
        const media = socialPost.medias[0];

        if (media.type !== 'photo' && media.type !== 'gif' && media.type !== 'video') return;

        /** @type {import("telegraf/typings/core/types/typegram").InputFile} */
        const inputFile = media.filename
          ? { source: media.filename instanceof Readable ? media.filename : createReadStream(media.filename) }
          : media.type === 'gif'
          ? encodeURI(media.externalUrl || media.original)
          : { url: encodeURI(media.externalUrl || media.original) };

        /** @type {import("../types/telegraf").DefaultExtra} */
        const extra = {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          caption,
          reply_to_message_id: deleteSource
            ? ctx.message.reply_to_message
              ? ctx.message.reply_to_message.message_id
              : null
            : ctx.message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
          reply_markup: Markup.inlineKeyboard(
            [
              socialPost.postURL
                ? {
                    text: 'Пост',
                    url: encodeURI(socialPost.postURL),
                  }
                : null,
              socialPost.authorURL
                ? {
                    text: 'Автор',
                    url: encodeURI(socialPost.authorURL),
                  }
                : null,
              encodeURI(media.original || media.externalUrl || socialPost.postURL)
                ? {
                    text: 'Исходник',
                    url: encodeURI(media.original || media.externalUrl || socialPost.postURL),
                  }
                : null,
            ].filter(Boolean)
          ).reply_markup,
        };

        if (media.type === 'video') extra.supports_streaming = true;

        SendingWrapper(() =>
          media.type === 'video'
            ? ctx.sendVideo(inputFile, extra)
            : media.type === 'gif'
            ? ctx.sendAnimation(inputFile, extra)
            : ctx.sendPhoto(inputFile, extra)
        )
          .then((sentMessage) => {
            if (media.filename) VideoDone(media.filename);

            MarkSentPost(sentMessage, from.id, true);

            if (deleteSource) {
              ForgetSentPost({ messageId: ctx.message.message_id });
              return ctx.deleteMessage(ctx.message.message_id);
            }
            return Promise.resolve(true);
          })
          .catch((e) => LogMessageOrError(`Making post ${checkedLink.url}`, e));
      } else {
        const readyMedia = socialPost.medias
          .filter(
            (media) => ['photo', 'video'].includes(media.type) || (media.type === 'gif' && media.filetype === 'mp4')
          )
          .map((media) => {
            if (media.type === 'gif' && media.filetype === 'mp4') media.type = 'video';
            return media;
          });
        if (!readyMedia.length) {
          LogMessageOrError(new Error(`Making post ${checkedLink.url}. Empty <readyMedia> for media group`));
          return;
        }

        caption += `\nФайлы: ${readyMedia
          .slice(0, 10)
          .map(
            (media, index) =>
              `<a href="${encodeURI(media.original || media.externalUrl || socialPost.postURL)}">${index + 1}</a>`
          )
          .join(', ')}`;

        if (readyMedia.length > 10)
          caption += `\nВсе иллюстраций не вместились, <a href="${encodeURI(
            socialPost.postURL
          )}">оригинальный пост</a>`;

        /** @type {import("../types/telegraf").MediaGroupItems} */
        const mediaGroupItems = readyMedia.slice(0, 10).map((media) => ({
          media: media.filename
            ? { source: media.filename instanceof Readable ? media.filename : createReadStream(media.filename) }
            : { url: encodeURI(media.externalUrl || media.original) },
          type: media.type,
          supports_streaming: true,
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          caption: `<a href="${encodeURI(
            media.original || media.externalUrl || socialPost.postURL
          )}">Исходник файла</a>`,
        }));

        /** @type {import('../types/telegraf').MediaGroupExtra} */
        const extra = {
          reply_to_message_id: deleteSource
            ? ctx.message.reply_to_message
              ? ctx.message.reply_to_message.message_id
              : null
            : ctx.message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        };

        SendingWrapper(() => ctx.sendMediaGroup(mediaGroupItems, extra))
          .then((sentMediaGroup) => {
            sentMediaGroup.forEach((sentMessage) => MarkSentPost(sentMessage, from.id, true));

            return SendingWrapper(() =>
              ctx
                .sendMessage(caption, {
                  disable_web_page_preview: true,
                  parse_mode: 'HTML',
                  disable_notification: true,
                  reply_markup: Markup.inlineKeyboard(
                    [
                      socialPost.postURL
                        ? {
                            text: 'Пост',
                            url: encodeURI(socialPost.postURL),
                          }
                        : null,
                      socialPost.authorURL
                        ? {
                            text: 'Автор',
                            url: encodeURI(socialPost.authorURL),
                          }
                        : null,
                    ].filter(Boolean)
                  ).reply_markup,
                })
                .then((sentMessage) => {
                  sentMessage.media_group_id = sentMediaGroup[0].media_group_id;

                  return Promise.resolve(sentMessage);
                })
            );
          })
          .then((sentMessage) => {
            socialPost.medias.forEach((media) => {
              if (media.filename) VideoDone(media.filename);
            });

            MarkSentPost(sentMessage, from.id, true);

            if (deleteSource) {
              ForgetSentPost({ messageId: ctx.message.message_id });
              return ctx.deleteMessage(ctx.message.message_id);
            }
            return Promise.resolve(true);
          })
          .catch((e) => LogMessageOrError(`Making post ${checkedLink.url}`, e));
      }
    })
    .catch((e) => LogMessageOrError(`Making post ${checkedLink.url}`, e));
};

export default MakePost;

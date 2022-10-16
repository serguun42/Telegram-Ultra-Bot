import { createReadStream } from 'fs';
import { Markup } from 'telegraf';
import { PrepareCaption } from './common.js';
import LogMessageOrError from './log.js';
import SendingWrapper from './sending-wrapper.js';
import { SocialPick, VideoDone } from './social-picker.js';

/**
 * @param {{ ctx: import('../types/telegraf').TelegramContext, givenURL: string, deleteSource?: boolean }} params
 * @returns {void}
 */
const MakePost = ({ ctx, givenURL, deleteSource }) => {
  SocialPick(givenURL)
    .then((socialPost) => {
      /** Post does not contain any media */
      if (!socialPost?.medias?.length) return;

      let caption = `<i>${PrepareCaption(socialPost.caption)}</i>`;

      if (socialPost.medias.length === 1) {
        const media = socialPost.medias[0];

        if (media.type !== 'photo' && media.type !== 'gif' && media.type !== 'video') return;

        /** @type {import("telegraf/typings/core/types/typegram").InputFile} */
        const inputFile = media.filename
          ? { source: createReadStream(media.filename) }
          : { url: encodeURI(media.externalUrl || media.original) };

        /** @type {import("../types/telegraf").DefaultExtra} */
        const extra = {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          caption,
          reply_to_message_id: deleteSource ? null : ctx.message.message_id,
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
            ].filter((button) => !!button)
          ).reply_markup,
        };

        if (media.type === 'video') extra.supports_streaming = true;

        SendingWrapper(() =>
          media.type === 'video'
            ? ctx.replyWithVideo(inputFile, extra)
            : media.type === 'gif'
            ? ctx.replyWithAnimation(inputFile, extra)
            : ctx.replyWithPhoto(inputFile, extra)
        )
          .then(() => {
            if (media.filename) VideoDone(media.filename);

            if (deleteSource) return SendingWrapper(() => ctx.deleteMessage(ctx.message.message_id));
            return Promise.resolve(true);
          })
          .catch(LogMessageOrError);
      } else {
        caption += `\nФайлы: ${socialPost.medias
          .slice(0, 10)
          .map(
            (media, index) =>
              `<a href="${encodeURI(media.original || media.externalUrl || socialPost.postURL)}">${index + 1}</a>`
          )
          .join(', ')}`;

        if (socialPost.medias.length > 10)
          caption += `\nВсе иллюстраций не вместились, <a href="${encodeURI(
            socialPost.postURL
          )}">оригинальный пост</a>`;

        /** @type {import("../types/telegraf").MediaGroupItems} */
        const mediaGroupItems = socialPost.medias.slice(0, 10).map((media) => ({
          media: media.filename
            ? { source: createReadStream(media.filename) }
            : { url: encodeURI(media.externalUrl || media.original) },
          type: media.type,
          supports_streaming: true,
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          caption: `<a href="${encodeURI(
            media.original || media.externalUrl || socialPost.postURL
          )}">Исходник файла</a>`,
        }));

        SendingWrapper(() =>
          ctx.replyWithMediaGroup(mediaGroupItems, {
            reply_to_message_id: deleteSource ? null : ctx.message.message_id,
            allow_sending_without_reply: true,
            disable_notification: true,
          })
        )
          .then((sentMediaGroup) =>
            SendingWrapper(() =>
              ctx.reply(caption, {
                disable_web_page_preview: true,
                parse_mode: 'HTML',
                reply_to_message_id: sentMediaGroup.message_id,
                allow_sending_without_reply: true,
                disable_notification: true,
                reply_markup: Markup.inlineKeyboard([
                  {
                    text: 'Пост',
                    url: encodeURI(socialPost.postURL),
                  },
                  {
                    text: 'Автор',
                    url: encodeURI(socialPost.authorURL),
                  },
                ]).reply_markup,
              })
            )
          )
          .then(() => {
            socialPost.medias.forEach((media) => {
              if (media.filename) VideoDone(media.filename);
            });

            if (deleteSource) return SendingWrapper(() => ctx.deleteMessage(ctx.message.message_id));
            return Promise.resolve(true);
          })
          .catch(LogMessageOrError);
      }
    })
    .catch((e) => LogMessageOrError(`Making post ${givenURL}`, e));
};

export default MakePost;

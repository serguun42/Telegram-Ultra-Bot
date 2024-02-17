/* eslint-disable no-use-before-define */
import { stat, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { PrepareCaption } from './common.js';
import { LoadTelegramConfig } from './load-configs.js';
import LogMessageOrError from './log.js';
import IS_DEV from './is-dev.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const { BLACKLIST } = LoadTelegramConfig();

const DB_DIRECTORY = resolve('database');
const SENT_POSTS_DB_PATH = join(DB_DIRECTORY, 'sent-posts.json');

/** @type {import("../types/sent-posts").SentPostsStorage} */
let SENT_POSTS_STORAGE = [];
let storageIsReady = false;
/** @returns {Promise<void>} */
const PrepareStorage = () => {
  if (storageIsReady) return Promise.resolve();

  return stat(DB_DIRECTORY)
    .then((directoryStats) => {
      if (!directoryStats.isDirectory()) return Promise.reject(new Error(`No directory for storages: ${DB_DIRECTORY}`));

      return stat(SENT_POSTS_DB_PATH).then((sentPostsStorageStats) => {
        if (sentPostsStorageStats.isFile()) {
          storageIsReady = true;
          return Promise.resolve();
        }

        return rm(SENT_POSTS_DB_PATH, { recursive: true });
      });
    })
    .catch(() => rm(DB_DIRECTORY, { recursive: true }).then(() => mkdir(DB_DIRECTORY)));
};

/**
 * @param {import('../types/telegraf').DefaultContext} ctx
 * @returns {void}
 */
export const MarkSpoiler = (ctx) => {
  const { message: requestMessage, from } = ctx;

  if (BLACKLIST.includes(from.username) || BLACKLIST.includes(from.id)) return;

  const messageToMark = 'reply_to_message' in requestMessage ? requestMessage.reply_to_message : null;
  if (!messageToMark) return;
  const messagesIdsToDelete = [requestMessage.message_id];

  const sentPost = GetSentPostByMessageId(messageToMark.message_id);
  if (!sentPost) return;

  const mediaGroupId = sentPost?.mediaGroupId;
  const mediaGroupSentPosts = mediaGroupId ? GetSentPostsByMediaGroupId(mediaGroupId) : [];

  if (mediaGroupId)
    mediaGroupSentPosts.forEach((mediaGroupSentPost) => {
      if (!messagesIdsToDelete.includes(mediaGroupSentPost.messageId))
        messagesIdsToDelete.push(mediaGroupSentPost.messageId);
    });
  else messagesIdsToDelete.push(messageToMark.message_id);

  /**
   * `sentPost.canEdit` is saved for later versions of Telegraf/API
   * when bots will have same editing privileges as users
   */

  const resendPromise = mediaGroupId
    ? ctx
        .replyWithMediaGroup(
          mediaGroupSentPosts
            .filter((item) => ['photo', 'video'].includes(item.type))
            .map((item) => ({
              type: item.type,
              media: item.source,
              parse_mode: 'HTML',
              caption: `<tg-spoiler>${PrepareCaption(item.caption)}</tg-spoiler>`,
              has_spoiler: true,
            }))
        )
        .then(() => {
          const textMessageFromMediaGroup = mediaGroupSentPosts.find((item) => item.type === 'text');
          if (textMessageFromMediaGroup?.source)
            ctx.reply(`<tg-spoiler>${PrepareCaption(textMessageFromMediaGroup.source)}</tg-spoiler>`, {
              parse_mode: 'HTML',
              reply_markup: textMessageFromMediaGroup.keyboard,
            });
        })
    : sentPost.type === 'photo'
      ? ctx.replyWithPhoto(sentPost.source, {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          caption: `<tg-spoiler>${PrepareCaption(sentPost.caption)}</tg-spoiler>`,
          has_spoiler: true,
          allow_sending_without_reply: true,
          disable_notification: true,
          reply_markup: sentPost.keyboard,
        })
      : sentPost.type === 'video'
        ? ctx.replyWithVideo(sentPost.source, {
            disable_web_page_preview: true,
            parse_mode: 'HTML',
            caption: `<tg-spoiler>${PrepareCaption(sentPost.caption)}</tg-spoiler>`,
            has_spoiler: true,
            allow_sending_without_reply: true,
            disable_notification: true,
            reply_markup: sentPost.keyboard,
          })
        : sentPost.type === 'animation'
          ? ctx.replyWithAnimation(sentPost.source, {
              disable_web_page_preview: true,
              parse_mode: 'HTML',
              caption: `<tg-spoiler>${PrepareCaption(sentPost.caption)}</tg-spoiler>`,
              has_spoiler: true,
              allow_sending_without_reply: true,
              disable_notification: true,
              reply_markup: sentPost.keyboard,
            })
          : sentPost.type === 'text'
            ? ctx.reply(`<tg-spoiler>${PrepareCaption(sentPost.source)}</tg-spoiler>`, {
                disable_web_page_preview: true,
                parse_mode: 'HTML',
                allow_sending_without_reply: true,
                disable_notification: true,
                reply_markup: sentPost.keyboard,
              })
            : Promise.reject(
                new Error(`Unknown action when marking as spoiler following <sentPost>: ${JSON.stringify(sentPost)}`)
              );

  resendPromise
    .then(() =>
      Promise.all(
        messagesIdsToDelete.map((deletingMessageId) => {
          ForgetSentPost({ messageId: deletingMessageId });
          return ctx.deleteMessage(deletingMessageId).catch(LogMessageOrError);
        })
      )
    )
    .catch(LogMessageOrError);
};

/**
 * @param {import("../types/sent-posts").SentPostsStorage} sentPostsStorage
 * @returns {Promise<void>}
 */
const SaveSentPosts = (sentPostsStorage) =>
  PrepareStorage()
    .then(() =>
      writeFile(
        SENT_POSTS_DB_PATH,
        IS_DEV ? JSON.stringify(sentPostsStorage, false, 2) : JSON.stringify(sentPostsStorage)
      )
    )
    .catch(LogMessageOrError);

/**
 * @param {import("../types/sent-posts").SentPostsStorage} [sentPostsStorageTarget]
 * @returns {Promise<import("../types/sent-posts").SentPostsStorage>}
 */
const RestoreSentPosts = (sentPostsStorageTarget) =>
  PrepareStorage()
    .then(() => readFile(SENT_POSTS_DB_PATH))
    .then((restoredBuffer) => {
      /** @type {import("../types/sent-posts").SentPostsStorage} */
      const restoredStorage = JSON.parse(restoredBuffer.toString());
      if (!Array.isArray(restoredStorage)) return Promise.reject(new Error('Restored sent posts is not an array'));

      if (sentPostsStorageTarget) restoredStorage.forEach((entry) => sentPostsStorageTarget.push(entry));

      return Promise.resolve(restoredStorage);
    })
    .catch((e) => {
      LogMessageOrError('Cannot restore from sent-posts dump file', e);
      SaveSentPosts([]);
      return Promise.resolve([]);
    });

RestoreSentPosts(SENT_POSTS_STORAGE).catch(LogMessageOrError);

/**
 * @param {import('../types/telegraf').DefaultMessage} messageToMark
 * @param {number} senderId
 * @param {boolean} [canEdit] Saved for later versions of Telegraf/API when
 * bots will have same editing privileges as users
 * @returns {void}
 */
export const MarkSentPost = (messageToMark, senderId, canEdit = false) => {
  if (!messageToMark || !senderId) return;

  /** @type {import('../types/sent-posts').SentPost} */
  const storingPost = {
    messageId: messageToMark.message_id,
    timestamp: Date.now(),
    senderId,
    canEdit,

    mediaGroupId: messageToMark.media_group_id || undefined,
    type:
      'photo' in messageToMark
        ? 'photo'
        : 'animation' in messageToMark
          ? 'animation'
          : 'video' in messageToMark
            ? 'video'
            : 'text' in messageToMark
              ? 'text'
              : '',
    source:
      'photo' in messageToMark
        ? messageToMark.photo?.pop()?.file_id
        : 'animation' in messageToMark
          ? messageToMark.animation?.file_id
          : 'video' in messageToMark
            ? messageToMark.video?.file_id
            : 'text' in messageToMark
              ? messageToMark.text
              : '',
    caption: 'caption' in messageToMark ? messageToMark.caption : undefined,
    keyboard: 'reply_markup' in messageToMark ? messageToMark.reply_markup : undefined,
  };

  /** Deleting messages, sent earlier than day ago */
  const dateNow = Date.now();
  SENT_POSTS_STORAGE = SENT_POSTS_STORAGE.filter(
    (filteringPost) => filteringPost.timestamp && dateNow - filteringPost.timestamp < DAY
  );

  SENT_POSTS_STORAGE.push(storingPost);

  SaveSentPosts(SENT_POSTS_STORAGE);
};

/**
 * @param {{ mediaGroupId?: string, messageId?: number }} forgettingOptions
 * @returns {void}
 */
export const ForgetSentPost = ({ mediaGroupId, messageId }) => {
  if (!mediaGroupId && !messageId) return;

  SENT_POSTS_STORAGE = mediaGroupId
    ? SENT_POSTS_STORAGE.filter((sentPost) => {
        if (!sentPost.mediaGroupId) return true;
        return sentPost.mediaGroupId !== mediaGroupId;
      })
    : SENT_POSTS_STORAGE.filter((sentPost) => sentPost.messageId !== messageId);

  SaveSentPosts(SENT_POSTS_STORAGE);
};

/**
 * @param {number} messageId
 * @returns {import('../types/sent-posts').SentPost | undefined}
 */
export const GetSentPostByMessageId = (messageId) =>
  SENT_POSTS_STORAGE.find((sentPost) => sentPost.messageId === messageId);

/**
 * @param {string} mediaGroupId
 * @returns {import('../types/sent-posts').SentPost[]}
 */
export const GetSentPostsByMediaGroupId = (mediaGroupId) =>
  SENT_POSTS_STORAGE.filter((sentPost) => sentPost.mediaGroupId === mediaGroupId);

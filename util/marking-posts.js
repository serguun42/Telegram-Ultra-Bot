/* eslint-disable no-use-before-define */
import { stat, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { Markup } from 'telegraf';
import { LoadTelegramConfig } from './load-configs.js';
import LogMessageOrError from './log.js';
import IS_DEV from './is-dev.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const { BOT_USERNAME, BLACKLIST } = LoadTelegramConfig();

const DB_DIRECTORY = resolve('database');
const SPOILERS_DB_PATH = join(DB_DIRECTORY, 'spoilers.json');
const SENT_POSTS_DB_PATH = join(DB_DIRECTORY, 'sent-posts.json');

/** @type {import("../types/spoilers").SpoilersStorage} */
const SPOILERS_STORAGE = [];
/** @type {import("../types/sent-posts").SentPostsStorage} */
let SENT_POSTS_STORAGE = [];

/** @returns {Promise<void>} */
const PrepareStorage = () =>
  stat(DB_DIRECTORY)
    .then((directoryStats) => {
      if (!directoryStats.isDirectory()) return Promise.reject(new Error(`No directory for storages: ${DB_DIRECTORY}`));

      return Promise.all([
        stat(SPOILERS_DB_PATH).then((spoilersStorageStats) => {
          if (spoilersStorageStats.isFile()) return Promise.resolve();
          return rm(SENT_POSTS_DB_PATH, { recursive: true });
        }),
        stat(SENT_POSTS_DB_PATH).then((sentPostsStorageStats) => {
          if (sentPostsStorageStats.isFile()) return Promise.resolve();
          return rm(SENT_POSTS_DB_PATH, { recursive: true });
        }),
      ]).catch(() => Promise.resolve());
    })
    .catch(() => rm(DB_DIRECTORY, { recursive: true }).then(() => mkdir(DB_DIRECTORY)));

/**
 * @param {import("../types/spoilers").SpoilersStorage} spoilerStorage
 * @returns {Promise<void>}
 */
const SaveSpoilers = (spoilerStorage) =>
  PrepareStorage()
    .then(() =>
      writeFile(SPOILERS_DB_PATH, IS_DEV ? JSON.stringify(spoilerStorage, false, 2) : JSON.stringify(spoilerStorage))
    )
    .catch(LogMessageOrError);

/**
 * @param {import("../types/spoilers").SpoilersStorage} [spoilerStorageTarget]
 * @returns {Promise<import("../types/spoilers").SpoilersStorage>}
 */
const RestoreSpoilers = (spoilerStorageTarget) =>
  PrepareStorage()
    .then(() => readFile(SPOILERS_DB_PATH))
    .then((restoredBuffer) => {
      /** @type {import("../types/spoilers").SpoilersStorage} */
      const restoredStorage = JSON.parse(restoredBuffer.toString());
      if (!Array.isArray(restoredStorage)) return Promise.reject(new Error('Restored spoilers is not an array'));

      if (spoilerStorageTarget) restoredStorage.forEach((entry) => spoilerStorageTarget.push(entry));

      return Promise.resolve(restoredStorage);
    })
    .catch((e) => {
      LogMessageOrError('Cannot restore from spoiler dump file', e);
      return Promise.resolve([]);
    });

RestoreSpoilers(SPOILERS_STORAGE).catch(LogMessageOrError);

/**
 * @param {import('../types/telegraf').DefaultMessage} messageForSpoiler
 * @returns {import('../types/spoilers').Spoiler | null}
 */
export const CreateSpoilerFromMessage = (messageForSpoiler) => {
  /** @type {import("../types/spoilers").SpoilerTypeEnum} */
  const spoilerType =
    'photo' in messageForSpoiler
      ? 'photo'
      : 'animation' in messageForSpoiler
      ? 'animation'
      : 'video' in messageForSpoiler
      ? 'video'
      : 'text' in messageForSpoiler
      ? 'text'
      : '';

  const spoilerSource =
    'photo' in messageForSpoiler
      ? messageForSpoiler.photo?.pop()?.file_id
      : 'animation' in messageForSpoiler
      ? messageForSpoiler.animation?.file_id
      : 'video' in messageForSpoiler
      ? messageForSpoiler.video?.file_id
      : 'text' in messageForSpoiler
      ? messageForSpoiler.text
      : '';

  if (!spoilerSource) return null;

  /** @type {import('../types/spoilers').Spoiler} */
  const spoiler = {
    id: createHash('md5').update(`${SPOILERS_STORAGE.length}_${Date.now()}`).digest('hex'),
    type: spoilerType,
    source: spoilerSource,
    caption: messageForSpoiler.caption,
  };

  return spoiler;
};

/**
 * @param {string} mediaGroupId
 * @returns {import('../types/spoilers').Spoiler | null}
 */
const CreateSpoilerFromMediaGroup = (mediaGroupId) => {
  const foundSentPosts = GetSentPostsByMediaGroupId(mediaGroupId);
  if (!foundSentPosts?.length) return null;

  return {
    id: createHash('md5').update(`${SPOILERS_STORAGE.length}_${Date.now()}`).digest('hex'),
    type: 'group',
    items: foundSentPosts.map((sentPost) => sentPost.readySpoiler),
  };
};

/**
 * @param {import('../types/spoilers').Spoiler} spoiler
 * @returns {void}
 */
const StoreSpoiler = (spoiler) => {
  SPOILERS_STORAGE.push(spoiler);
  SaveSpoilers(SPOILERS_STORAGE);
};

/**
 * @param {import('../types/telegraf').TelegramContext} ctx
 * @param {"reply" | "self"} target
 * @returns {void}
 */
export const MarkSpoiler = (ctx, target) => {
  const { message, from } = ctx;

  if (BLACKLIST.includes(from.username) || BLACKLIST.includes(from.id)) return;

  /**
   * @param {import('../types/telegraf').DefaultMessage} messageToMark
   * @param {number[]} messagesIdsToDelete
   * @returns {void}
   */
  const LocalMarkByMessage = (messageToMark, messagesIdsToDelete) => {
    const messageId = messageToMark.message_id;
    const mediaGroupId = GetSentPostByMessageId(messageId)?.mediaGroupId;

    const spoilerFromSentPosts = mediaGroupId
      ? CreateSpoilerFromMediaGroup(mediaGroupId)
      : GetSentPostByMessageId(messageId)?.readySpoiler;

    const spoiler = spoilerFromSentPosts || CreateSpoilerFromMessage(messageToMark);
    if (!spoiler) return;

    StoreSpoiler(spoiler);

    if (mediaGroupId)
      GetSentPostsByMediaGroupId(mediaGroupId).forEach((sendPost) => {
        if (!messagesIdsToDelete.includes(sendPost.messageId)) messagesIdsToDelete.push(sendPost.messageId);
      });

    if (mediaGroupId) ForgetSentPost({ mediaGroupId });
    else ForgetSentPost({ messageId });

    ctx
      .sendMessage(
        `Спойлер с ${
          spoiler.type === 'photo'
            ? 'картинкой'
            : spoiler.type === 'animation'
            ? 'гифкой'
            : spoiler.type === 'video'
            ? 'видео'
            : spoiler.type === 'text'
            ? 'текстом'
            : spoiler.type === 'group'
            ? 'галереей'
            : '💩'
        }`,
        {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
          reply_to_message_id: messageToMark.reply_to_message,
          allow_sending_without_reply: true,
          disable_notification: true,
          reply_markup: Markup.inlineKeyboard([
            {
              text: '🖼 Показать 🖼',
              callback_data: `SPOILER${spoiler.id}`,
            },
            {
              text: 'Диалог с ботом',
              url: `https://t.me/${BOT_USERNAME}`,
            },
          ]).reply_markup,
        }
      )
      .then(() =>
        Promise.all(
          messagesIdsToDelete.map((deletingMessageId) => ctx.deleteMessage(deletingMessageId).catch(LogMessageOrError))
        )
      )
      .catch(LogMessageOrError);
  };

  if (target === 'reply') {
    const replyingMessage = message.reply_to_message;
    if (!replyingMessage) return;
    LocalMarkByMessage(replyingMessage, [replyingMessage?.message_id, message?.message_id]);
  } else if (target === 'self') {
    LocalMarkByMessage(message, [message?.message_id]);
  }
};

/**
 * @param {string} seekingId
 * @returns {import('../types/spoilers').Spoiler}
 */
export const GetSpoiler = (seekingId) => SPOILERS_STORAGE.find((spoiler) => spoiler.id === seekingId);

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
      return Promise.resolve([]);
    });

RestoreSentPosts(SENT_POSTS_STORAGE).catch(LogMessageOrError);

/**
 * @param {import('../types/telegraf').DefaultMessage} messageToMark
 * @param {number} senderId
 * @returns {void}
 */
export const MarkSentPost = (messageToMark, senderId) => {
  if (!messageToMark || !senderId) return;

  /** @type {import('../types/sent-posts').SentPost} */
  const storingPost = {
    messageId: messageToMark.message_id,
    senderId,
    mediaGroupId: messageToMark.media_group_id || undefined,
    timestamp: Date.now(),
    readySpoiler: CreateSpoilerFromMessage(messageToMark),
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

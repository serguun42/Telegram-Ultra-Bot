import { stat, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import LogMessageOrError from './log.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SENDERS_DATABASE_LOCATION = join(process.cwd(), 'database');
const SENDERS_DATABASE_FILENAME = 'senders.json';
const SENDERS_DATABASE = join(SENDERS_DATABASE_LOCATION, SENDERS_DATABASE_FILENAME);

/** @type {import("../types/senders").SendersStorage} */
let SENDERS_STORAGE = [];

/** @returns {Promise<void>} */
const CheckAndPrepare = () =>
  stat(SENDERS_DATABASE)
    .then((stats) => {
      if (stats.isFile()) return Promise.resolve();

      return rm(SENDERS_DATABASE, { recursive: true });
    })
    .catch(() =>
      stat(SENDERS_DATABASE_LOCATION).then((stats) => {
        if (stats.isDirectory()) return Promise.resolve();

        return rm(SENDERS_DATABASE_LOCATION, { recursive: true }).then(() => mkdir(SENDERS_DATABASE_LOCATION));
      })
    );

/**
 * @param {import("../types/senders").SendersStorage} sendersStorage
 * @returns {Promise<void>}
 */
const SaveSenders = (sendersStorage) =>
  CheckAndPrepare()
    .then(() => writeFile(SENDERS_DATABASE, JSON.stringify(sendersStorage)))
    .catch((e) => {
      LogMessageOrError(e);
      return Promise.resolve();
    });

/**
 * @param {import("../types/senders").SendersStorage} [sendersStorageTarget]
 * @returns {Promise<import("../types/senders").SendersStorage>}
 */
const RestoreSenders = (sendersStorageTarget) =>
  CheckAndPrepare()
    .then(() => readFile(SENDERS_DATABASE))
    .then((restoredBuffer) => {
      /** @type {import("../types/senders").SendersStorage} */
      const restoredStorage = JSON.parse(restoredBuffer.toString());
      if (!Array.isArray(restoredStorage)) return Promise.reject(new Error('Restored senders is not an array'));

      if (sendersStorageTarget) restoredStorage.forEach((entry) => sendersStorageTarget.push(entry));

      return Promise.resolve(restoredStorage);
    })
    .catch((e) => {
      LogMessageOrError('Cannot restore from senders dump file', e);
      return Promise.resolve([]);
    });

RestoreSenders(SENDERS_STORAGE).catch(LogMessageOrError);

/**
 * @param {import('../types/senders').SentPost} sentPost
 * @returns {void}
 */
const StoreSender = (sentPost) => {
  if (!sentPost) return;

  const dateNow = Date.now();
  SENDERS_STORAGE = SENDERS_STORAGE.filter(
    (filteringPost) => filteringPost.timestamp && dateNow - filteringPost.timestamp < DAY
  );

  sentPost.timestamp = Date.now();
  SENDERS_STORAGE.push(sentPost);

  SaveSenders(SENDERS_STORAGE);
};

/**
 * @param {import('../types/telegraf').DefaultMessage} messageToMark
 * @param {number} senderId
 * @returns {void}
 */
export const MarkSender = (messageToMark, senderId) => {
  if (!messageToMark || !senderId) return;

  /** @type {import('../types/senders').SentPost} */
  const storingPost = {
    messageId: messageToMark.message_id,
    senderId,
  };

  if (messageToMark.media_group_id) storingPost.mediaGroupId = messageToMark.media_group_id;

  StoreSender(storingPost);
};

/**
 * @param {number} messageId
 * @returns {void}
 */
export const ForgetByMessageById = (messageId) => {
  if (!messageId) return;

  SENDERS_STORAGE = SENDERS_STORAGE.filter((sentPost) => sentPost.messageId !== messageId);

  SaveSenders(SENDERS_STORAGE);
};

/**
 * @param {number} messageId
 * @returns {void}
 */
export const ForgetByMediaGroupId = (mediaGroupId) => {
  if (!mediaGroupId) return;

  SENDERS_STORAGE = SENDERS_STORAGE.filter((sentPost) => {
    if (!sentPost.mediaGroupId) return true;

    return sentPost.mediaGroupId !== mediaGroupId;
  });

  SaveSenders(SENDERS_STORAGE);
};

/**
 * @param {number} messageId
 * @returns {import('../types/senders').SentPost | undefined}
 */
export const GetSentPostByMessageId = (messageId) =>
  SENDERS_STORAGE.find((sentPost) => sentPost.messageId === messageId);

/**
 * @param {string} mediaGroupId
 * @returns {import('../types/senders').SentPost[]}
 */
export const GetSentPostsByMediaGroupId = (mediaGroupId) =>
  SENDERS_STORAGE.filter((sentPost) => sentPost.mediaGroupId === mediaGroupId);

import { createHash } from 'crypto';
import { stat, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { Markup } from 'telegraf';
import { LoadTelegramConfig } from './load-configs.js';
import LogMessageOrError from './log.js';

const { BOT_USERNAME, BLACKLIST } = LoadTelegramConfig();

const SPOILERS_DATABASE_LOCATION = join(process.cwd(), 'database');
const SPOILERS_DATABASE_FILENAME = 'spoilers.json';
const SPOILERS_DATABASE = join(SPOILERS_DATABASE_LOCATION, SPOILERS_DATABASE_FILENAME);

/** @type {import("../types/spoilers").SpoilersStorage} */
const SPOILERS_STORAGE = [];

/** @returns {Promise<void>} */
const CheckAndPrepare = () =>
  stat(SPOILERS_DATABASE)
    .then((stats) => {
      if (stats.isFile()) return Promise.resolve();

      return rm(SPOILERS_DATABASE, { recursive: true });
    })
    .catch(() =>
      stat(SPOILERS_DATABASE_LOCATION).then((stats) => {
        if (stats.isDirectory()) return Promise.resolve();

        return rm(SPOILERS_DATABASE_LOCATION, { recursive: true }).then(() => mkdir(SPOILERS_DATABASE_LOCATION));
      })
    );

/**
 * @param {import("../types/spoilers").SpoilersStorage} spoilerStorage
 * @returns {Promise<void>}
 */
const SaveSpoilers = (spoilerStorage) =>
  CheckAndPrepare()
    .then(() => writeFile(SPOILERS_DATABASE, JSON.stringify(spoilerStorage)))
    .catch((e) => {
      LogMessageOrError(e);
      return Promise.resolve();
    });

/**
 * @param {import("../types/spoilers").SpoilersStorage} [spoilerStorageTarget]
 * @returns {Promise<import("../types/spoilers").SpoilersStorage>}
 */
const RestoreSpoilers = (spoilerStorageTarget) =>
  CheckAndPrepare()
    .then(() => readFile(SPOILERS_DATABASE))
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
 * @param {SpoilerTypeEnum} type
 * @param {string} source
 * @param {string} [caption]
 * @returns {string}
 */
const StoreSpoiler = (type, source, caption = '') => {
  const id = createHash('md5').update(`${SPOILERS_STORAGE.length}_${Date.now()}`).digest('hex');

  SPOILERS_STORAGE.push({
    id,
    type,
    source,
    caption: typeof caption === 'string' ? caption : '',
  });

  SaveSpoilers(SPOILERS_STORAGE);

  return id;
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
   * @param {import('../types/telegraf').DefaultMessage[]} messagesToDelete
   * @returns {void}
   */
  const LocalMarkByMessage = (messageToMark, messagesToDelete) => {
    /** @type {import("./types/spoilers").SpoilerTypeEnum} */
    const spoilerType = messageToMark.photo
      ? 'photo'
      : messageToMark.animation
      ? 'animation'
      : messageToMark.video
      ? 'video'
      : 'nothing-to-hide';

    const spoilerSource =
      spoilerType === 'photo'
        ? messageToMark.photo?.pop()?.file_id
        : spoilerType === 'animation'
        ? messageToMark.animation?.file_id
        : spoilerType === 'video'
        ? messageToMark.video?.file_id
        : '';

    if (!spoilerSource) return;

    const spoilerId = StoreSpoiler(spoilerType, spoilerSource, messageToMark.caption || '');

    ctx
      .sendMessage(
        `Спойлер с ${
          spoilerType === 'photo'
            ? 'картинкой'
            : spoilerType === 'animation'
            ? 'гифкой'
            : spoilerType === 'video'
            ? 'видео'
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
              callback_data: `SPOILER${spoilerId}`,
            },
            {
              text: 'Диалог с ботом',
              url: `https://t.me/${BOT_USERNAME}`,
            },
          ]).reply_markup,
        }
      )
      .then(() => Promise.all(messagesToDelete.map((messageToDelete) => ctx.deleteMessage(messageToDelete.message_id))))
      .catch(LogMessageOrError);
  };

  if (target === 'reply') {
    const replyingMessage = message.reply_to_message;
    if (!replyingMessage) return;
    LocalMarkByMessage(replyingMessage, [replyingMessage, message]);
  } else if (target === 'self') {
    LocalMarkByMessage(message, [message]);
  }
};

/**
 * @param {string} seekingId
 * @returns {import('../types/spoilers').Spoiler}
 */
export const GetSpoiler = (seekingId) => SPOILERS_STORAGE.find((spoiler) => spoiler.id === seekingId);

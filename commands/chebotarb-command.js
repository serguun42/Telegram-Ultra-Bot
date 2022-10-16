import { LoadTelegramConfig } from '../util/load-configs.js';
import LogMessageOrError from '../util/log.js';

const { SPECIAL_STICKERS_SET } = LoadTelegramConfig();

/**
 * @param {import('../types/telegraf').TelegramContext} ctx
 * @param {import('telegraf').Telegram} telegram
 */
const ChebotarbCommand = (ctx, telegram) => {
  const { message } = ctx;
  if (!message) return;

  const replyingMessage = message.reply_to_message;

  telegram
    .getStickerSet(SPECIAL_STICKERS_SET)
    .then((stickerSet) => {
      const randomSticker = stickerSet.stickers[Math.floor(Math.random() * stickerSet.stickers.length)];

      return ctx.replyWithSticker(randomSticker.file_id, {
        reply_to_message_id: replyingMessage ? replyingMessage.message_id : null,
        allow_sending_without_reply: true,
        disable_notification: true,
      });
    })
    .catch(LogMessageOrError);
};

export default ChebotarbCommand;

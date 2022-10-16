import Khaleesi from 'khaleesi-js';
import LogMessageOrError from '../util/log.js';

/**
 * @param {import('../types/telegraf').TelegramContext} ctx
 */
const KhaleesiCommand = (ctx) => {
  const { message } = ctx;
  if (!message) return;

  const replyingMessage = message.reply_to_message;
  if (!replyingMessage) return;

  const text = replyingMessage.text || replyingMessage.caption;
  if (!text) return;

  const khaleesiedText = Khaleesi(text);
  if (!khaleesiedText) return;

  ctx
    .reply(khaleesiedText, {
      reply_to_message_id: replyingMessage.message_id,
      allow_sending_without_reply: true,
      disable_notification: true,
    })
    .catch(LogMessageOrError);
};

export default KhaleesiCommand;

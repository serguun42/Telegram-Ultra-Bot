import LogMessageOrError from '../util/log.js';
import { ForgetSentPost, GetSentPostByMessageId, GetSentPostsByMediaGroupId } from '../util/marking-posts.js';

/**
 * @param {import('../types/telegraf').TelegramContext} ctx
 */
const DeleteCommand = (ctx) => {
  const { message, from } = ctx;
  if (!message) return;

  const replyingMessage = message.reply_to_message;
  if (!replyingMessage) return;

  const requestingMessageId = message.message_id;
  const deletingMessageId = replyingMessage.message_id;
  const sentPost = GetSentPostByMessageId(deletingMessageId);
  const actingAsSenderId = from.id;

  if (sentPost?.senderId === actingAsSenderId) {
    if (sentPost.mediaGroupId) {
      Promise.all(
        GetSentPostsByMediaGroupId(sentPost.mediaGroupId).map((foundPost) => ctx.deleteMessage(foundPost.messageId))
      )
        .then(() => {
          ForgetSentPost({ mediaGroupId: sentPost.mediaGroupId });
          ctx.deleteMessage(requestingMessageId);
        })
        .catch(LogMessageOrError);
    } else {
      ctx
        .deleteMessage(sentPost.messageId)
        .then(() => {
          ForgetSentPost({ messageId: sentPost.messageId });
          ctx.deleteMessage(requestingMessageId);
        })
        .catch(LogMessageOrError);
    }
  } else ctx.deleteMessage(requestingMessageId).catch(LogMessageOrError);
};

export default DeleteCommand;

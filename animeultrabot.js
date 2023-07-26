import { createReadStream } from 'fs';
import { Telegraf } from 'telegraf';
import IS_DEV from './util/is-dev.js';
import LogMessageOrError from './util/log.js';
import { GetUsername } from './util/common.js';
import { MarkSentPost } from './util/marking-posts.js';
import { LoadTelegramConfig } from './util/load-configs.js';
import CheckCommandAvailability from './util/check-command-availability.js';
import CheckMessageForLinks from './util/check-message-for-links.js';
import DeleteCommand from './commands/delete-command.js';
import KhaleesiCommand from './commands/khaleesi-command.js';
import ChebotarbCommand from './commands/chebotarb-command.js';
import LoadCommand from './commands/load-command.js';
import SpoilerCommand from './commands/spoiler-command.js';
import SendingWrapper from './util/sending-wrapper.js';

const TELEGRAM_CONFIG = LoadTelegramConfig();

const { BOT_TOKEN, BOT_USERNAME, CHATS_LIST, SPECIAL_PHRASE, LOCAL_BOT_API_SERVER } = TELEGRAM_CONFIG;

const telegraf = new Telegraf(
  BOT_TOKEN,
  IS_DEV
    ? {}
    : {
        telegram: {
          apiRoot: `http://${LOCAL_BOT_API_SERVER.hostname}:${LOCAL_BOT_API_SERVER.port}`,
        },
      }
);
const { telegram } = telegraf;

/** @type {import('./types/commands').CommandsStorage} */
const COMMANDS = {
  help: LoadCommand('help', TELEGRAM_CONFIG),
  start: LoadCommand('help', TELEGRAM_CONFIG),
  aboutpicker: LoadCommand('aboutpicker', TELEGRAM_CONFIG),
  aboutlist: LoadCommand('aboutlist', TELEGRAM_CONFIG),
  aboutspoiler: LoadCommand('aboutspoiler', TELEGRAM_CONFIG),
  aboutdelete: LoadCommand('aboutdelete', TELEGRAM_CONFIG),
  delete: (ctx) => DeleteCommand(ctx),
  spoiler: (ctx) => SpoilerCommand(ctx),
  khaleesi: (ctx) => KhaleesiCommand(ctx),
  chebotarb: (ctx) => ChebotarbCommand(ctx, telegram),
  testcommand: `I'm just a test command that returns string`,
};

/**
 * @param {import('./types/telegraf').NewMemberContext} ctx
 * @returns {void}
 */
const HandleNewChatMembers = (ctx) => {
  const { chat, message } = ctx;
  if (chat.type === 'private') return;

  const knownChat = CHATS_LIST.find((chatFromConfig) => chatFromConfig.id === chat.id);
  if (!knownChat) {
    LogMessageOrError(`New group. ID: ${chat.id}, title: ${chat.title}, type: ${chat.type}`);
    return;
  }

  if (!knownChat.enabled) return;

  const { welcome } = knownChat;
  if (!welcome) return;

  if (welcome.type === 'text') {
    ctx
      .sendMessage(
        welcome.message.replace('__USERNAME__', GetUsername(message.new_chat_member || message.new_chat_members[0])),
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_to_message_id: message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        }
      )
      .catch(LogMessageOrError);
  } else if (welcome.type === 'gif') {
    ctx
      .sendAnimation(
        welcome.message.filename ? { source: createReadStream(welcome.message.filename) } : welcome.message.file_id,
        {
          caption: welcome.message.caption
            ? welcome.message.caption.replace(
                '__USERNAME__',
                GetUsername(message.new_chat_member || message.new_chat_members[0])
              )
            : '',
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_to_message_id: message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        }
      )
      .catch(LogMessageOrError);
  }
};

/**
 * @param {import('./types/telegraf').DefaultContext} ctx
 * @returns {void}
 */
const HandleTextOrCaptionable = (ctx) => {
  const { chat, from, message } = ctx;

  const textMessage = 'text' in message;
  const mediaMessage = 'caption' in message;
  const text = (textMessage ? message.text : mediaMessage ? message.caption : '').trim();

  const knownChat = CHATS_LIST.find((chatFromConfig) => chatFromConfig.id === chat.id);
  if (chat.type !== 'private') {
    if (!knownChat) return;
    if (!knownChat.enabled) return;

    MarkSentPost(message, from.id, false);
  }

  if (!text) return;

  const commandMatch = text.match(
    new RegExp(`^/(?<commandName>\\w+)(?:@${BOT_USERNAME})${chat.type === 'private' ? '?' : ''}\\b`, 'i')
  );
  /** @type {import('./types/commands').CommandName} */
  const commandName = commandMatch?.groups?.commandName || '';
  const commandAction = COMMANDS[commandName];

  if (commandAction) {
    if (!CheckCommandAvailability(from, commandName)) return;

    if (typeof commandAction === 'string') {
      SendingWrapper(() =>
        ctx.sendMessage(commandAction, {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
        })
      ).catch(LogMessageOrError);
      return;
    }

    if (chat.type === 'private') return;

    if (typeof commandAction === 'function') {
      commandAction(ctx);
      return;
    }
  }

  if (chat.type === 'private') return;

  if (new RegExp(SPECIAL_PHRASE.regexp, 'i').test(text)) {
    if (!CheckCommandAvailability(from)) return;

    const chance = Math.random();
    if (chance > 1 / 2) return;

    if (chance < 1 / 8)
      ctx
        .sendMessage('<i>…как Орлов, порхай как бабочка!</i>', {
          parse_mode: 'HTML',
          reply_to_message_id: message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        })
        .catch(LogMessageOrError);
    else if (chance < 1 / 4)
      ctx
        .sendSticker(SPECIAL_PHRASE.sticker, {
          reply_to_message_id: message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        })
        .catch(LogMessageOrError);
    else
      ctx
        .sendAnimation(SPECIAL_PHRASE.gif, {
          reply_to_message_id: message.message_id,
          allow_sending_without_reply: true,
          disable_notification: true,
        })
        .catch(LogMessageOrError);

    return;
  }

  CheckMessageForLinks(ctx, message, !mediaMessage);
};

const botStartedTime = Date.now();
telegraf.on('message', (ctx) => {
  if (Date.now() - botStartedTime < 1000 * 15 && !IS_DEV) return;

  const { message } = ctx;

  if ('new_chat_members' in message) HandleNewChatMembers(ctx);
  if ('text' in message || 'photo' in message || 'video' in message || 'animation' in message || 'caption' in message)
    HandleTextOrCaptionable(ctx);
});

telegraf.launch();

process.on('unhandledRejection', (reason, promise) =>
  LogMessageOrError('Unhandled Rejection at: Promise', promise, 'reason:', reason)
);
process.once('SIGINT', () => telegraf.stop('SIGINT'));
process.once('SIGTERM', () => telegraf.stop('SIGTERM'));

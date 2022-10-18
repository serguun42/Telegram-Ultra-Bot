/* eslint-disable consistent-return */
import { createReadStream } from 'fs';
import { Telegraf } from 'telegraf';
import IS_DEV from './util/is-dev.js';
import LogMessageOrError from './util/log.js';
import { GetUsername } from './util/common.js';
import { GetSpoiler, MarkSpoiler } from './util/spoilers.js';
import { LoadTelegramConfig } from './util/load-configs.js';
import CheckCommandAvailability from './util/check-command-availability.js';
import CheckMessageForLinks from './util/check-message-for-links.js';
import KhaleesiCommand from './commands/khaleesi-command.js';
import ChebotarbCommand from './commands/chebotarb-command.js';
import LoadCommand from './commands/load-command.js';
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

const COMMANDS = {
  help: LoadCommand('help', TELEGRAM_CONFIG),
  start: LoadCommand('help', TELEGRAM_CONFIG),
  aboutpicker: LoadCommand('aboutpicker', TELEGRAM_CONFIG),
  aboutlist: LoadCommand('aboutlist', TELEGRAM_CONFIG),
  aboutspoiler: LoadCommand('aboutspoiler', TELEGRAM_CONFIG),
  khaleesi: (ctx) => KhaleesiCommand(ctx),
  chebotarb: (ctx) => ChebotarbCommand(ctx, telegram),
  testcommand: `Ну и што ты здесь зобылб?`,
};

const botStartedTime = Date.now();
telegraf.on('text', (ctx) => {
  if (Date.now() - botStartedTime < 1000 * 15 && !IS_DEV) return;

  const { chat, from, message } = ctx;
  const { text } = message;
  if (!text) return;

  const knownChat = CHATS_LIST.find((chatFromConfig) => chatFromConfig.id === chat.id);
  if (chat.type !== 'private') {
    if (!knownChat) {
      LogMessageOrError('New group', chat.id, chat.title, chat.type);
      return;
    }

    if (!knownChat.enabled) return;
  } else {
    LogMessageOrError(
      `Private chat – ${from.first_name} ${from.last_name || ''} (lang: ${from.language_code}) (${
        from.username ? `@${from.username}` : `id: ${from.id}`
      }) – text: ${message.text}`
    );
  }

  if (chat.type !== 'private' && new RegExp(`^/spoiler(@${BOT_USERNAME})?\\b`, 'i').test(text))
    return MarkSpoiler(ctx, 'reply');

  const commandMatch = text.match(
    new RegExp(`^/(?<commandName>[\\w]+)${chat.type === 'private' ? '' : `@${BOT_USERNAME}`}`, 'i')
  );
  const commandName = commandMatch?.groups?.commandName || '';
  const commandAction = COMMANDS[commandName] || null;

  if (commandAction) {
    if (!CheckCommandAvailability(from)) return;

    if (typeof commandAction === 'string') {
      SendingWrapper(() =>
        ctx.sendMessage(commandAction, {
          disable_web_page_preview: true,
          parse_mode: 'HTML',
        })
      ).catch(LogMessageOrError);
      return;
    }

    if (typeof commandAction === 'function') {
      commandAction(ctx);
      return;
    }
  }

  if (chat.type === 'private') return;

  if (new RegExp(SPECIAL_PHRASE.regexp, 'i').test(text.trim())) {
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

  CheckMessageForLinks(ctx, message, true);
});

/**
 * @param {"animation" | "photo" | "video"} eventType
 */
const GenericOnPhotoVideoGif = (eventType) => {
  telegraf.on(eventType, (ctx) => {
    if (Date.now() - botStartedTime < 1000 * 15 && !IS_DEV) return;

    const { chat, message } = ctx;

    CHATS_LIST.forEach((chatFromList) => {
      if (!chatFromList.enabled) return;
      if (chatFromList.id !== chat.id) return;

      if (!(message.caption && message[eventType])) return;

      if (new RegExp(`^/spoiler(@${BOT_USERNAME})?\\b`, 'i').test(message.caption)) return MarkSpoiler(ctx, 'self');

      CheckMessageForLinks(ctx, message, false);
    });
  });
};

GenericOnPhotoVideoGif('animation');
GenericOnPhotoVideoGif('photo');
GenericOnPhotoVideoGif('video');

telegraf.on('new_chat_members', (ctx) => {
  const { message } = ctx;
  if (!message) return LogMessageOrError('No message on new_chat_member!');

  const { chat } = message;

  CHATS_LIST.forEach((chatFromList) => {
    if (!chatFromList.enabled) return false;
    if (chatFromList.id !== chat.id) return false;

    const { welcome } = chatFromList;
    if (!welcome) return false;

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
  });
});

telegraf.launch();

telegraf.action(/^SPOILER(\w+)/, (ctx) => {
  const { from } = ctx;

  const foundStoredSpoiler = GetSpoiler(ctx?.match?.[1]);
  if (!foundStoredSpoiler) {
    ctx.answerCbQuery('Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!', true).catch(LogMessageOrError);
    return;
  }

  const argsToSend = [from.id, foundStoredSpoiler.source, { caption: foundStoredSpoiler?.caption || null }];

  const action =
    foundStoredSpoiler.type === 'photo'
      ? telegram.sendPhoto(...argsToSend)
      : foundStoredSpoiler.type === 'animation'
      ? telegram.sendAnimation(...argsToSend)
      : foundStoredSpoiler.type === 'video'
      ? telegram.sendVideo(...argsToSend)
      : Promise.reject(new Error(`Unknown action with spoiler: ${JSON.stringify(foundStoredSpoiler)}`));

  action
    .then(() => ctx.answerCbQuery('Отправил тебе в ЛС!'))
    .catch(
      /** @param {import("telegraf").TelegramError} e */ (e) => {
        if (e?.code === 403 || e?.response?.error_code === 403)
          ctx.answerCbQuery('Не могу отправить: начни диалог с ботом');
        else LogMessageOrError(e);
      }
    );
});

process.on('unhandledRejection', (reason, promise) =>
  LogMessageOrError('Unhandled Rejection at: Promise', promise, 'reason:', reason)
);
process.once('SIGINT', () => telegraf.stop('SIGINT'));
process.once('SIGTERM', () => telegraf.stop('SIGTERM'));

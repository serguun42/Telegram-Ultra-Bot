/* eslint-disable max-len */
/* eslint-disable no-console */
import { Telegraf } from 'telegraf';
import { LoadTelegramConfig } from '../util/load-configs.js';

const { BOT_TOKEN, CHATS_LIST } = LoadTelegramConfig();

const telegraf = new Telegraf(BOT_TOKEN);
const { telegram } = telegraf;

CHATS_LIST.forEach((chat) => {
  telegram
    .sendMessage(
      chat.id,
      `Бот обновился:
• обновлена поддержка Kemono, Twitter и Instagram.

Запуск бота через 15 мин.`
    )
    .then(console.log)
    .catch(console.warn);
});

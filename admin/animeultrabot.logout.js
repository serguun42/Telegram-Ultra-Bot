/* eslint-disable no-console */
import { Telegraf } from 'telegraf';
import { LoadTelegramConfig } from '../util/load-configs.js';

const { BOT_TOKEN } = LoadTelegramConfig();

const telegraf = new Telegraf(BOT_TOKEN);
const { telegram } = telegraf;

telegram
  .logOut()
  .then((success) => console.log(`Logout success: ${success}`))
  .catch(console.warn);

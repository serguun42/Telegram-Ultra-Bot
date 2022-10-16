/* eslint-disable no-console */
import { Telegraf } from 'telegraf';
import { LoadTelegramConfig } from '../util/load-configs.js';

const { BOT_TOKEN } = LoadTelegramConfig();

const telegraf = new Telegraf(BOT_TOKEN);
const { telegram } = telegraf;

telegram
  .close()
  .then((success) => console.log(`Close success: ${success}`))
  .catch(console.warn);

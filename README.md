# Telegram Ultra Bot

Telegram bot based on Social-Picker-API. Includes features like replacing links to social posts in the group chat to media and managing the group and its content and messages.

---

## What can it do?

- Process links to resources, replacing them with content located at these links – see the repository [Social-Picker-API](https://github.com/serguun42/Social-Picker-API) and commands [aboutpicker](./commands/aboutpicker.txt) & [aboutlist](./commands/aboutlist.txt).
- Hide spoilers command /spoiler – see [aboutspoiler](./commands/aboutspoiler.txt).
- Welcome new users with various text & media messages and rules.
- _Khaleesi_-fy the text in Cyrillic characters (changes by the new text of the message that was replied to by the command `/khaleesi`) – see repo [Khaleesi.JS](https://github.com/serguun42/Khaleesi-JS).
- Respond to a custom command with a random sticker from a pre-selected sticker pack.

### NPM commands to get started

1. Install only necessary dependencies – `npm i --omit=dev`
2. Run in production mode – `npm run production`

### Configuration

- [`telegram.json`](./config/telegram.json):
- - tokens for the _Telegram_
- - list of enabled chats
- - white-list of moderation users — disables commands timeout/cool down for them
- - ID and/or username of the admin
- - welcome messages, special phrases and stickers, etc.
- [`social-picker.json`](./config/social-picker.json)
- - service addresses and ports [Social Picker API](https://github.com/serguun42/Social-Picker-API)
- [`pm2.production.json`](./config/pm2.production.json) – config for Node.js daemon `pm2`
- [`nodemon.dev.json`](./config/nodemon.dev.json) – config development hot-reloader `nodemon`

### Folders

- `admin` – utils for mailing new updates, managing Bot API sessions (cloud and local log-out); [admin/README.md](admin/README.md)
- `commands` – text command templates for the bot, configured at startup
- `util` – other various utils

### Read more

- [Telegraf Module for Node.js](https://telegraf.js.org/)
- [Telegram Bots API](https://core.telegram.org/bots/api)
- [Social-Picker-API](https://github.com/serguun42/Social-Picker-API)
- [Khaleesi.JS](https://github.com/serguun42/Khaleesi-JS)

---

### [BSL-1.0 License](./LICENSE)

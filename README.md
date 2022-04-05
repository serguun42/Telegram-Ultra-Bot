# Anime Ultra Bot
## Что умеет?

* Обрабатывать ссылки на ресурсы, заменяя их контентом, находящимся по этим ссылкам – см. репозиторий [Social-Picker-API](https://github.com/serguun42/Social-Picker-API) и команды [aboutpicker](./commands/aboutpicker.txt) и [aboutlist](./commands/aboutlist.txt).
* Скрывать спойлеры командой /spoiler – см. [aboutspoiler](./commands/aboutspoiler.txt).
* Приветствовать новых пользователей.
* *Кхалиси*фицировать текст на русском языке (изменяет на текст сообщения, на которое ответили командой `/khaleesi`) – см. [Khaleesi.JS](https://github.com/serguun42/Khaleesi-JS).
* Отвечает случайным стикером из заранее выбранного стикерпака на команду `/cheboratb`.

### Команды
1. Установить только необходимые зависимости – `npm i --production`
2. Запустить production-бота – `npm run production`

### Конфигурация

* [`telegram.json`](./config/telegram.json):
* * токены для *Telegram*
* * список чатов
* * white-list пользователей для использования команд (нет таймаута)
* * данные админа
* * приветствия, специальные фразы и стикеры, прочее
* [`social-picker-service.json`](./config/social-picker-service.json)
* * адреса и порт сервиса [Social Picker API](https://github.com/serguun42/Social-Picker-API)
* [`pm2.production.json`](./config/pm2.production.json) – config for Node.js daemon `pm2`
* [`nodemon.dev.json`](./config/nodemon.dev.json) – config development hot-reloader `nodemon`

### Папки
* `admin` – скрипты для рассылки сообщений и выходов из Telegram; [admin/README.md](admin/README.md)
* `commands` – текстовые шаблоны команд для бота, настраиваются при запуске.
* `util` – разные утилиты

### Полезные ссылки
* [Telegraf Module for Node.js](https://telegraf.js.org/)
* [Telegram Bots API](https://core.telegram.org/bots/api)
* [Social-Picker-API](https://github.com/serguun42/Social-Picker-API)
* [Khaleesi.JS](https://github.com/serguun42/Khaleesi-JS)

const DEV = require("../util/is-dev");
const Telegraf = require("telegraf");

const {
	BOT_TOKEN,
	CHATS_LIST
} = (DEV ? require("../config/telegram.dev.json") : require("../config/telegram.json"));



const telegraf = new Telegraf.Telegraf(BOT_TOKEN);
const telegram = telegraf.telegram;



CHATS_LIST.forEach((chat) => {
	telegram.sendMessage(chat.id, `Бот обновился:
• добавлена поддержка Kemono Party, Очобы.
• Пофиксил Reddit – особенно галереи и гифки.
• Из нового:
• • бот полностью переписан
• • теперь он отвечает на сообщения, в которых есть ссылка или НЕСКОЛЬКО ссылок на платформы. Т.е. можно отправить вставить ссылки на Пиксив и Твиттер – бот обработает оба-джва
• • теперь в спойлеры можно засовывать не только картинки, но и гифки и видео
• • убрал оценки и текстовые спойлеры – с Telegram неплохо нативно поддерживает это.

Запуск бота через 15 мин.`)
		.then(console.log)
		.catch(console.warn);
});

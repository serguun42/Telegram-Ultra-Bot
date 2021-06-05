const 
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	Telegraf = require("telegraf");

const
	CONFIG = DEV ? require("../animeultrabot.config.mine.json") : require("../animeultrabot.config.json"),
	{
		TELEGRAM_BOT_TOKEN,
		CHATS_LIST
	} = CONFIG;



const telegraf = new Telegraf.Telegraf(TELEGRAM_BOT_TOKEN);
const telegram = telegraf.telegram;



CHATS_LIST.forEach((chat) => {
	telegram.sendMessage(chat.id, "Бот обновился: новый механизм отправки спойлеров от бота. Для пользователей – всё по-старому, но удобнее.")
		.then(console.log)
		.catch(console.warn);
});

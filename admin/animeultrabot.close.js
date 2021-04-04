const 
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	Telegraf = require("telegraf");

const
	CONFIG = DEV ? require("../animeultrabot.config.mine.json") : require("../animeultrabot.config.json"),
	{ 
		TELEGRAM_BOT_TOKEN
	} = CONFIG;



const telegraf = new Telegraf.Telegraf(TELEGRAM_BOT_TOKEN);
const telegram = telegraf.telegram;



telegram.close()
	.then((success) => console.log(`Close success: ${success}`))
	.catch(console.warn);

const DEV = require("../util/is-dev");
const Telegraf = require("telegraf");

const {
	BOT_TOKEN
} = (DEV ? require("../config/telegram.dev.json") : require("../config/telegram.json"));



const telegraf = new Telegraf.Telegraf(BOT_TOKEN);
const telegram = telegraf.telegram;



telegram.logOut()
	.then((success) => console.log(`Logout success: ${success}`))
	.catch(console.warn);

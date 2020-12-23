const
	URL = require("url"),
	fs = require("fs"),
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	L = function(arg) {
		if (DEV) {
			console.log(...arguments);
			if (typeof arg == "object") fs.writeFileSync("./out/errors.json", JSON.stringify(arg, false, "\t"));
		};
	},
	NodeFetch = require("node-fetch"),
	TwitterModule = require("twitter-lite"),
	Telegraf = require("telegraf"),
	Sessions = require("telegraf/session"),
	Telegram = require("telegraf/telegram"),
	Markup = require("telegraf/markup"),
	KhaleesiModule = require("./animeultrabot.khaleesi.js");

/**
 * @typedef {Object} WelcomeMessageText
 * @property {"text"} type
 * @property {String} message
 * 
 * 
 * @typedef {Object} WelcomeMessageGIF
 * @property {"gif"} type
 * @property {{file_id: string, caption?: string}} message
 */
/**
 * @typedef {Object} ConfigFile
 * @property {String} TELEGRAM_BOT_TOKEN
 * @property {String} TWITTER_CONSUMER_KEY
 * @property {String} TWITTER_CONSUMER_SECRET
 * @property {String} CUSTOM_IMG_VIEWER_SERVICE
 * @property {{id: number, username: string}} ADMIN_TELEGRAM_DATA
 * @property {Array.<{id: number, name?: string, enabled: boolean, welcome?: WelcomeMessageText | WelcomeMessageGIF}>} CHATS_LIST
 * @property {String[]} COMMANDS_WHITELIST
 * @property {String[]} MARKS_WHITELIST
 * @property {String[]} BLACKLIST
 * @property {Number} LIKES_STATS_CHANNEL_ID
 * @property {String} INSTAGRAM_COOKIE
 * @property {String} PROXY_URL
 */
/** @type {ConfigFile} */
const
	CONFIG = require("./animeultrabot.config.json"),
	{
		TELEGRAM_BOT_TOKEN,
		ADMIN_TELEGRAM_DATA,
		CHATS_LIST,
		COMMANDS_WHITELIST,
		MARKS_WHITELIST,
		BLACKLIST,
		LIKES_STATS_CHANNEL_ID,
		INSTAGRAM_COOKIE
	} = CONFIG,
	COMMANDS_USAGE = new Object(),
	COMMANDS = {
		"help": `Что я умею?
	
• Скрывать спойлеры командой /spoiler (смотри команду /aboutspoiler@animeultrabot).
• Обрабатывать ссылки на ресурсы (смотри команды /aboutpicker@animeultrabot и /pickerlist@animeultrabot).
• Приветствовать новых пользователей.`,
		"start": `Я бот для групп. Что я умею?
	
• Скрывать спойлеры командой /spoiler (смотри команду /aboutspoiler@animeultrabot).
• Обрабатывать ссылки на ресурсы (смотри команды /aboutpicker@animeultrabot и /pickerlist@animeultrabot).
• Приветствовать новых пользователей.`,
		"aboutpicker": `Если твоё сообщение состоит только из одной ссылки на пост в одном из поддерживаемых ресурсов, то вместо твоего сообщения я напишу своё, в котором будут
• <i>все фото в лучшем (оригинальном) качестве</i>
• <i>описание/название поста</i>
• <i>ссылка на него</i>
• <i>автор и ссылка на него</i>
• <i>ссылки на все файлы в лучшем, непережатом качестве</i>

Бот работает с постами из картинок и/или гифок и/или видео. Также вместо картинок из Твиттера, которые Телеграм подгрузил из прямой ссылки на изображение самостоятельно в среднем размере, я отвечу картинкой в наилучшем качестве и с прямой ссылкой на оригинальный файл.

<b>Чтобы я не обрабатывал твоё сообщения, состоящее только из одной ссылки, поставь перед ссылкой/после неё какой-либо знак или напиши что угодно.</b>

Все вопросы – <a href="https://t.me/${ADMIN_TELEGRAM_DATA.username}">${ADMIN_TELEGRAM_DATA.username}</a>`,
		"pickerlist": `
• Твит (изображения, гифки и видео)
• Иллюстрация или манга в Pixiv (изображения)
• Пост на Reddit (изображения и гифки)
• Пост на Danbooru (изображения)
• Пост на Gelbooru (изображения)
• Пост на Konachan (изображения)
• Пост на Yande.re (изображения)
• Пост на Sankaku Channel (изображения)
• Пост на Zerochan (изображения)
• Пост на Anime-Pictures.net (изображения)
• Пост на Joy, <i>прости Господи</i>, реактор (изображения)
• Прямая ссылка на изображение в Твиттере`,
		"aboutspoiler": `Ты можешь:
• написать спойлер через инлайн – <pre>@animeultrabot &lt;ТЕКСТ СПОЙЛЕРА&gt;</pre>
• написать команду <code>/spoiler</code> в реплае к тексту или картинке. Я скрою их.
• написать команду <code>/spoiler</code> в описании к картинку при её отправке. Я скрою её. После команды можешь указать описание, и оно будет видно при отправке через ЛС бота.
• написать команду <code>/spoiler</code>, а после неё текст спойлера. Я скрою его.

Я сделаю кнопку для показа текста или картинки.

Чтобы я показал тебе скрытую картинку, <a href="https://t.me/animeultrabot">начни со мной диалог</a>.`,
		"khaleesi": (ctx) => Khaleesi(ctx),
		"testcommand": `<pre>Ну и што ты здесь зобылб?</pre>`
	};




const
	telegram = new Telegram(TELEGRAM_BOT_TOKEN),
	TOB = new Telegraf(TELEGRAM_BOT_TOKEN);


/**
 * @param {String} iQuery
 * @returns {Object.<string, (string|true)>}
 */
const GlobalParseQuery = iQuery => {
	if (!iQuery) return {};

	let cList = new Object();
		iQuery = iQuery.toString().split("&");

	iQuery.forEach((item)=>{ cList[item.split("=")[0]] = (item.split("=")[1] || true); });

	return cList;
};

const GetForm = (iNumber, iForms) => {
	iNumber = iNumber.toString();

	if (iNumber.slice(-2)[0] == "1" & iNumber.length > 1) return iForms[2];
	if (iNumber.slice(-1) == "1") return iForms[0];
	else if (/2|3|4/g.test(iNumber.slice(-1))) return iForms[1];
	else if (/5|6|7|8|9|0/g.test(iNumber.slice(-1))) return iForms[2];
};

const TGE = iStr => {
	if (!iStr) return "";
	
	if (typeof iStr === "string")
		return iStr
			.replace(/\&/g, "&amp;")
			.replace(/\</g, "&lt;")
			.replace(/\>/g, "&gt;");
	else
		return TGE(iStr.toString());
};

/**
 * @typedef {Object} TelegramFromObject
 * @property {Number} id
 * @property {String} first_name
 * @property {String} username
 * @property {Boolean} is_bot
 * @property {String} language_code
 * 
 * @typedef {Object} TelegramChatObject
 * @property {Number} id
 * @property {String} title
 * @property {String} type
 * 
 * @typedef {Object} TelegramPhotoObj
 * @property {String} file_id
 * @property {String} file_unique_id
 * @property {Number} file_size
 * @property {Number} width
 * @property {Number} height
 * 
 * @typedef {Object} TelegramMessageObject
 * @property {Number} message_id
 * @property {String} text
 * @property {TelegramFromObject} from
 * @property {TelegramChatObject} chat
 * @property {Number} date
 * @property {Array.<{offset: Number, length: Number, type: String}>} [entities]
 * @property {TelegramPhotoObj[]} [photo]
 * @property {TelegramMessageObject} [reply_to_message]
 * @property {{inline_keyboard: Array.<Array.<{text: string, callback_data: string, url: string}>>}} [reply_markup]
 * @property {String} [caption]
 * 
 * @typedef {Object} TelegramUpdateObject
 * @property {Number} update_id
 * @property {TelegramMessageObject} message
 * 
 * @typedef {Object} TelegramContext
 * @property {Object} telegram 
 * @property {String} updateType 
 * @property {Object} [updateSubTypes] 
 * @property {TelegramMessageObject} [message] 
 * @property {Object} [editedMessage] 
 * @property {Object} [inlineQuery] 
 * @property {Object} [chosenInlineResult] 
 * @property {Object} [callbackQuery] 
 * @property {Object} [shippingQuery] 
 * @property {Object} [preCheckoutQuery] 
 * @property {Object} [channelPost] 
 * @property {Object} [editedChannelPost] 
 * @property {Object} [poll] 
 * @property {Object} [pollAnswer] 
 * @property {TelegramChatObject} [chat] 
 * @property {TelegramFromObject} [from] 
 * @property {Object} [match] 
 * @property {TelegramUpdateObject} [update] 
 * @property {Boolean} webhookReply
 */
/**
 * @param {TelegramFromObject} from
 * @param {String} [prefix]
 */
const GetUsername = (from, prefix = "") => {
	if (from.username === ADMIN_TELEGRAM_DATA.username) return TGE("Почтой России");


	if (from.username)
		return `${TGE(prefix)}<a href="https://t.me/${from.username}">${TGE(from.first_name)}${from.last_name ? " " + TGE(from.last_name) : ""}</a>`;
	else if (from.last_name)
		return TGE(prefix + from.first_name + " " + from.last_name);
	else
		return TGE(prefix + from.first_name);
};

/**
 * @param {String} message
 */
const TelegramSendToAdmin = (message) => {
	if (!message) return;

	telegram.sendMessage(ADMIN_TELEGRAM_DATA.id, message, {
		parse_mode: "HTML",
		disable_notification: true
	}).then(L).catch(L);
};

if (!DEV)
	TelegramSendToAdmin(`Anime Ultra Bot have been spawned at ${new Date().toISOString()} <i>(ISO 8601, UTC)</i>`);



const TwitterUser = new TwitterModule({
	consumer_key: CONFIG.TWITTER_CONSUMER_KEY, // from Twitter
	consumer_secret: CONFIG.TWITTER_CONSUMER_SECRET, // from Twitter
});

let TwitterApp = new TwitterModule({
	bearer_token: "SOME BAD TOKEN (IT DOES NOT WORK)"
});

TwitterUser.getBearerToken().then((response) => {
	TwitterApp = new TwitterModule({
		bearer_token: response.access_token
	});
});


TOB.use(Sessions());

TOB.on("text", /** @param {TelegramContext} ctx */ (ctx) => {
	const {chat, from} = ctx;


	if (chat && chat["type"] === "private") {
		const message = ctx["message"];
		if (!message) return false;

		const text = message["text"];
		if (!text) return false;



		if (BLACKLIST.includes(from["username"])) return false;



		if (from["username"] === ADMIN_TELEGRAM_DATA.username) {
			if (text.match(/^\/god (0|1)$/i)) {
				let mode = text.match(/^\/god (0|1)$/i)[1];
				godModeEnabled = (mode === "1");

				TelegramSendToAdmin(JSON.stringify({ godModeEnabled }, false, "\t"));
				return false;
			};
		};



		let commandMatch = text.match(/^\/([\w]+)(\@animeultrabot)?$/i);

		if (commandMatch && commandMatch[1]) {
			telegram.deleteMessage(chat.id, message.message_id).then(L).catch(L);

			L({commandMatch});

			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).then(L).catch(L);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		};

		return false;
	};


	if (DEV) {
		if (CHATS_LIST.reduce((accumulator, chatFromList) => {
			if (chatFromList.id === chat["id"]) ++accumulator;
			return accumulator;
		}, 0) === 0)
			L(["NEW CHAT!", chat["id"], chat["title"], chat["type"]]);
	};


	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat["id"]) return false;

		const message = ctx["message"];
		if (!message) return false;

		const text = message["text"];
		if (!text) return false;



		if (/^\/spoiler(\@animeultrabot)?\b/i.test(text))
			return ReplySpoiler(ctx);



		let commandMatch = text.match(/^\/([\w]+)(\@animeultrabot)?$/i);

		if (commandMatch && commandMatch[1]) {
			telegram.deleteMessage(chat.id, message.message_id).then(L).catch(L);
			if (!CheckForCommandAvailability(from)) {
				return false;
			};


			L({commandMatch});

			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).then(L).catch(L);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		};




		if (/жаль([\.\?\!…]*)$/i.test(text.trim())) {
			if (CheckForCommandAvailability(from)) {
				if (Math.random() < 0.33) {
					return ctx.reply("<i>…как Орлов, порхай как бабочка!</i>", {
						parse_mode: "HTML",
						reply_to_message_id: message.message_id
					}).then(L).catch(L);
				} else {
					if (Math.random() < 0.5)
						return ctx.replyWithSticker("CAACAgIAAx0CU5r_5QACCFlejL-ACp0b5UFZppv4rFVWZ9lZGwAChQYAAiMhBQABqCwuoKvunScYBA", {
							reply_to_message_id: message.message_id
						}).then(L).catch(L);
					else
						return ctx.replyWithAnimation("CgACAgIAAxkBAAIWpl-6h0sKFMfsMOOECb6M3kjr34vjAALMBwACaeiYSYFBpLc63EZvHgQ", {
							reply_to_message_id: message.message_id
						}).then(L).catch(L);
				};
			};
		};




		GlobalCheckMessageForLink(message)
			.then((res) => {
				if (res.status & (typeof res.platform == "function")) {
					res.platform(message["text"], ctx, res.url);
				} else if (DEV) {
					L("Not our format");
				};
			})
			.catch(L);
	});
});

TOB.on("photo", /** @param {TelegramContext} ctx */ (ctx) => {
	const {message, from} = ctx;

	if (message.caption && message.photo) {
		if (BLACKLIST.includes(from["username"])) return false;


		if (/^\/spoiler(\@animeultrabot)?/.test(message.caption)) {
			L("There is a photo with spoiler-command caption!");


			let captionToHide = message.caption.match(/^\/spoiler(\@animeultrabot)?\s(.+)/);

			if (captionToHide && captionToHide[2])
				captionToHide = captionToHide[2];
			else
				captionToHide = null;




			let bestPhoto = message.photo.pop()["file_id"];

			if (!bestPhoto) return L("No file_id in PhotoSize type's object");

			ctx.reply(`Спойлер отправил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.callbackButton("🖼 Показать скрытую картинку 🖼", `SHOW_IMAGE_SPOILER_${GlobalGetIDForImage(bestPhoto, captionToHide)}`),
					Markup.urlButton("Проверить диалог", "https://t.me/animeultrabot")
				])
			})
				.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
				.then(L).catch(L);
		};
	};
});

TOB.on("new_chat_members", /** @param {TelegramContext} ctx */ (ctx) => {
	const {update} = ctx;
	if (!update) return L("No update!");

	const {message} = update;
	if (!message) return L("No message in update!");

	const {chat} = message;

	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat["id"]) return false;

		const { welcome } = chatFromList;
		if (!welcome) return false;

		if (welcome.type == "text") {
			ctx.reply(welcome.message.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0])), {
				parse_mode: "HTML",
				disable_web_page_preview: true,
				reply_to_message_id: message.message_id
			}).then(L).catch(L);
		} else if (welcome.type == "gif") {
			ctx.replyWithAnimation(welcome.message.file_id, {
				caption: welcome.message.caption ? welcome.message.caption.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0])) : "",
				parse_mode: "HTML",
				disable_web_page_preview: true,
				reply_to_message_id: message.message_id
			}).then(L).catch(L);
		};
	});
});

TOB.launch();





/**
 * @param {TelegramContext} ctx
 */
const Khaleesi = (ctx) => {
	const {message} = ctx;
	if (!message) return;

	const replyingMessage = message.reply_to_message;
	if (!replyingMessage) return;


	let text = replyingMessage.text || replyingMessage.caption;
	if (!text) return;

	let khaleesiedText = KhaleesiModule(text);

	L({replyingMessage, khaleesiedText});
	if (!khaleesiedText) return;

	ctx.reply(khaleesiedText, {
		reply_to_message_id: replyingMessage.message_id
	}).then(L).catch(L);
};

/**
 * @param {TelegramFromObject} from
 * @returns {Boolean}
 */
const CheckForCommandAvailability = (from) => {
	let pass = false;
	if (from.username && COMMANDS_WHITELIST.includes(from.username))
		pass = true;
	else if (from.username && BLACKLIST.includes(from.username))
		pass = false;
	else {
		let lastTimeCalled = COMMANDS_USAGE[from.id];
			COMMANDS_USAGE[from.id] = Date.now();

		if (!lastTimeCalled || typeof lastTimeCalled == "undefined")
			pass = true;
		else if ((Date.now() - lastTimeCalled) > 15 * 60 * 1e3)
			pass = true;
	};

	return pass;
};




/** @type {{[postStamp: string]: {likedBy: string[], dislikedBy: string[]}}} */
let currentSessionPosts = {},
	currentSessionStamp = 0,
	hotUsersLikes = {};

/**
 * @returns {[{[x: string]: string|number|boolean}]}
 */
const GlobalSetLikeButtons = () => {
	let currentPostStamp = `${++currentSessionStamp}_${Date.now()}`;

	currentSessionPosts[currentPostStamp] = {
		likedBy: [],
		dislikedBy: []
	};

	return [
		Markup.callbackButton("👍", `LIKE_${currentPostStamp}`),
		Markup.callbackButton("👎", `DISLIKE_${currentPostStamp}`)
	];
};

/**
 * @param {{target: "like"|"dislike", type: "set"|"removed"}} iAction
 * @param {TelegramContext} ctx
 * @returns {void}
 */
const GlobalReportAboutMark = (iAction, ctx) => {
	const {update} = ctx;
	if (!update) return L("OnMarkReport (1)");

	const {callback_query} = update;
	if (!callback_query) return L("OnMarkReport (2)");

	/** @type {TelegramMessageObject} */
	const message = callback_query["message"];
	if (!message) return L("OnMarkReport (3)");

	/** @type {TelegramFromObject} */
	const from = callback_query["from"];
	if (!from) return L("OnMarkReport (4)");

	const {chat} = message;
	if (!chat) return L("OnMarkReport (5)");


	const
		chatID = parseInt(chat.id.toString().replace(/^(\-)?1/, "")),
		messageLink = `https://t.me/c/${chatID}/${message.message_id}`,
		textToSend = `<b>${iAction.type === "set" ? "Поставлен" : "Убран"} ${iAction.target === "like" ? "лайк" : "дизлайк"}</b>
Пользователь – ${GetUsername(from)}
Чат – <i>${chat.title}</i>
Пост – <a href="${messageLink}">${messageLink}</a>`;


	telegram.sendMessage(LIKES_STATS_CHANNEL_ID, textToSend, {
		disable_web_page_preview: true,
		parse_mode: "HTML",
	}).then(L).catch(L);
};

let godModeEnabled = false;
/**
 * @param {TelegramFromObject} from
 * @returns {Boolean}
 */
const GlobalCheckForGodMode = (from) => {
	if (!godModeEnabled) return false;

	if (!from) return false;
	if (!from["username"]) return false;

	if (MARKS_WHITELIST.includes(from["username"])) return true;

	return false;
};

TOB.action(/^LIKE_(\d+_\d+)/, /** @param {TelegramContext} ctx */ (ctx) => {
	const {match} = ctx;
	if (!match) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (0)");

	const postStamp = match[1];
	if (!postStamp) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (1)");

	const {update} = ctx;
	if (!update) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (2)");

	const {callback_query} = update;
	if (!callback_query) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (3)");

	/** @type {TelegramMessageObject} */
	const message = callback_query["message"];

	/** @type {TelegramFromObject} */
	const from = callback_query["from"];

	if (from["username"] && BLACKLIST.includes(from["username"])) return ctx.answerCbQuery("Тебе нельзя ставить плюсы");

	const {chat} = message;
	if (!chat) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (4)");


	if (message["reply_markup"]) {
		let initMarkup = message["reply_markup"],
			likeButtonCount = parseInt(initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 2].text),
			dislikeButtonCount = parseInt(initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text);

		if (isNaN(likeButtonCount)) likeButtonCount = 0;
		if (isNaN(dislikeButtonCount)) dislikeButtonCount = 0;

		let messageToShow = "Cпасибо за лайк!";

		const isGod = GlobalCheckForGodMode(from);


		if (!currentSessionPosts[postStamp] || !currentSessionPosts[postStamp].likedBy || !currentSessionPosts[postStamp].dislikedBy)
			currentSessionPosts[postStamp] = {
				likedBy: [],
				dislikedBy: []
			};

		let user = from["username"] || from["id"];

		L({user});


		if (!hotUsersLikes[user])
			hotUsersLikes[user] = 1;
		else
			++hotUsersLikes[user];

		setTimeout(() => --hotUsersLikes[user], 5 * 1e3);

		if (hotUsersLikes[user] > 3 && !isGod) return ctx.answerCbQuery("Слишком много оценок, подождите немного");


		if (currentSessionPosts[postStamp].likedBy.includes(user)) {
			if (isGod) {
				++likeButtonCount;
				GlobalReportAboutMark({ target: "like", type: "set" }, ctx);
				messageToShow = "Ты поставил ещё один лайк, god";
			} else {
				--likeButtonCount;
				GlobalReportAboutMark({ target: "like", type: "removed" }, ctx);
				if (likeButtonCount < 0) likeButtonCount = 0;
				messageToShow = "Ты убрал лайк 😢";
				currentSessionPosts[postStamp].likedBy.splice(
					currentSessionPosts[postStamp].likedBy.indexOf(user),
					1
				);
			};
		} else if (currentSessionPosts[postStamp].dislikedBy.includes(user)) {
			currentSessionPosts[postStamp].likedBy.push(user);
			currentSessionPosts[postStamp].dislikedBy.splice(
				currentSessionPosts[postStamp].dislikedBy.indexOf(user),
				1
			);

			--dislikeButtonCount;
			++likeButtonCount;
			GlobalReportAboutMark({ target: "like", type: "set" }, ctx);

			if (dislikeButtonCount < 0) dislikeButtonCount = 0;
		} else {
			currentSessionPosts[postStamp].likedBy.push(user);
			++likeButtonCount;
			GlobalReportAboutMark({ target: "like", type: "set" }, ctx);
		};


		initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 2].text = likeButtonCount + " 👍";
		initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text = dislikeButtonCount + " 👎";

		telegram.editMessageReplyMarkup(chat.id, message.message_id, null, initMarkup)
			.then((editedMarkup) => {
				L(editedMarkup);
				ctx.answerCbQuery(messageToShow);
			})
			.catch((e) => {
				L(e);
				ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (6)");
			});
	} else
		return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (7)");
});

TOB.action(/^DISLIKE_(\d+_\d+)/, /** @param {TelegramContext} ctx */ (ctx) => {
	const {match} = ctx;
	if (!match) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (0)");

	const postStamp = match[1];
	if (!postStamp) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (1)");

	const {update} = ctx;
	if (!update) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (2)");

	const {callback_query} = update;
	if (!callback_query) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (3)");

	/** @type {TelegramMessageObject} */
	const message = callback_query["message"];

	/** @type {TelegramFromObject} */
	const from = callback_query["from"];

	if (from["username"] && BLACKLIST.includes(from["username"])) return ctx.answerCbQuery("Тебе нельзя ставить минусы");

	const {chat} = message;
	if (!chat) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (4)");


	if (message["reply_markup"]) {
		let initMarkup = message["reply_markup"],
			likeButtonCount = parseInt(initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 2].text),
			dislikeButtonCount = parseInt(initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text);

		if (isNaN(likeButtonCount)) likeButtonCount = 0;
		if (isNaN(dislikeButtonCount)) dislikeButtonCount = 0;

		let messageToShow = "Cпасибо за дизлайк!";

		const isGod = GlobalCheckForGodMode(from);


		if (!currentSessionPosts[postStamp] || !currentSessionPosts[postStamp].likedBy || !currentSessionPosts[postStamp].dislikedBy)
			currentSessionPosts[postStamp] = {
				likedBy: [],
				dislikedBy: []
			};

		let user = from["username"] || from["id"];

		L({user});


		if (!hotUsersLikes[user])
			hotUsersLikes[user] = 1;
		else
			++hotUsersLikes[user];

		setTimeout(() => --hotUsersLikes[user], 5 * 1e3);

		if (hotUsersLikes[user] > 3 && !isGod) return ctx.answerCbQuery("Слишком много оценок, подождите немного");


		if (currentSessionPosts[postStamp].dislikedBy.includes(user)) {
			if (isGod) {
				++dislikeButtonCount;
				GlobalReportAboutMark({ target: "dislike", type: "set" }, ctx);
				messageToShow = "Ты поставил ещё один дизлайк, god";
			} else {
				--dislikeButtonCount;
				GlobalReportAboutMark({ target: "dislike", type: "removed" }, ctx);
				if (dislikeButtonCount < 0) dislikeButtonCount = 0;
				messageToShow = "Ты убрал дизлайк 😊";
				currentSessionPosts[postStamp].dislikedBy.splice(
					currentSessionPosts[postStamp].dislikedBy.indexOf(user),
					1
				);
			};
		} else if (currentSessionPosts[postStamp].likedBy.includes(user)) {
			currentSessionPosts[postStamp].dislikedBy.push(user);
			currentSessionPosts[postStamp].likedBy.splice(
				currentSessionPosts[postStamp].likedBy.indexOf(user),
				1
			);

			++dislikeButtonCount;
			--likeButtonCount;
			GlobalReportAboutMark({ target: "dislike", type: "set" }, ctx);

			if (likeButtonCount < 0) likeButtonCount = 0;
		} else {
			currentSessionPosts[postStamp].dislikedBy.push(user);
			++dislikeButtonCount;
			GlobalReportAboutMark({ target: "dislike", type: "set" }, ctx);
		};


		initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 2].text = likeButtonCount + " 👍";
		initMarkup.inline_keyboard[0][initMarkup.inline_keyboard[0].length - 1].text = dislikeButtonCount + " 👎";

		telegram.editMessageReplyMarkup(chat.id, message.message_id, null, initMarkup)
			.then((editedMarkup) => {
				L(editedMarkup);
				ctx.answerCbQuery(messageToShow);
			})
			.catch((e) => {
				L(e);
				ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (6)");
			});
	} else
		return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (7)");
});







let spoilerIdStamp = new Number();

/** @type {Array.<{id: number, text: string}>} */
let textSpoilersArray = new Array();

/** @type {Array.<{id: number, file_id: string, caption?: string}>} */
let imageSpoilersArray = new Array();

/**
 * @param {String} iSpoiler
 * @returns {Number}
 */
const GlobalGetIDForText = (iSpoiler) => {
	let id = ++spoilerIdStamp + "_" + Date.now();

	textSpoilersArray.push({ id, text: iSpoiler });

	return id;
};

/**
 * @param {String} iFileIDSpoiler
 * @param {String} [iCaption]
 * @returns {Number}
 */
const GlobalGetIDForImage = (iFileIDSpoiler, iCaption) => {
	let id = ++spoilerIdStamp + "_" + Date.now();

	if (typeof iCaption == "string")
		imageSpoilersArray.push({ id, file_id: iFileIDSpoiler, caption: iCaption });
	else
		imageSpoilersArray.push({ id, file_id: iFileIDSpoiler });

	return id;
};

TOB.on("inline_query", ({ inlineQuery, answerInlineQuery }) => {
	let spoilering = inlineQuery.query;
	if (!spoilering) {
		return answerInlineQuery([{
			type: "article",
			id: `spoiler_empty`,
			title: "Пожалуйста, наберите что-нибудь",
			description: "█████████ ████████ █████",
			thumb_url: CONFIG.EMPTY_QUERY_IMG,
			input_message_content: {
				message_text: "<Я дурачок и не набрал текст>"
			}
		}]).then(L).catch(L);
	};

	let remarked = spoilering.replace(/([^\s!?\.])/g, "█");

	answerInlineQuery([{
		type: "article",
		id: `spoiler_${inlineQuery.from.usernname || inlineQuery.from.id}_${Date.now()}`,
		title: "Отправить скрытый текст",
		thumb_url: CONFIG.DONE_QUERY_IMG,
		description: remarked,
		input_message_content: {
			message_text: remarked.slice(0, 20)
		},
		reply_markup: Markup.inlineKeyboard([
			Markup.callbackButton("📝 Показать скрытый спойлер 📝", `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilering)}`)
		])
	}]).then(L).catch(L);
});

TOB.action(/^SHOW_TEXT_SPOILER_(\d+_\d+)/, (ctx) => {
	L(ctx.match);
	if (ctx.match && ctx.match[1]) {
		let indexOfSpoiler = textSpoilersArray.findIndex((spoiler) => spoiler.id === ctx.match[1]);

		if (indexOfSpoiler > -1) {
			let spoilerToDisplay = textSpoilersArray[indexOfSpoiler]["text"].toString();


			if (spoilerToDisplay.length >= 200)
				spoilerToDisplay = spoilerToDisplay.slice(0, 196) + "...";


			return ctx.answerCbQuery(spoilerToDisplay, true).then(L).catch(L);
		} else
			return ctx.answerCbQuery("Спойлер настолько ужасный, что я его потерял 😬. Вот растяпа!", true);
	} else
		return ctx.answerCbQuery("Спойлер настолько ужасный, что я его потерял 😬. Вот растяпа!", true);
});

TOB.action(/^SHOW_IMAGE_SPOILER_([\w\d_]+)/, (ctx) => {
	const {from} = ctx;

	
	if (ctx.match && ctx.match[1]) {
		let indexOfSpoiler = imageSpoilersArray.findIndex((spoiler) => spoiler.id === ctx.match[1]);

		if (indexOfSpoiler > -1) {
			let photoToSend = imageSpoilersArray[indexOfSpoiler];

			if (typeof photoToSend.caption == "string")
				return telegram.sendPhoto(
						from.id,
						photoToSend.file_id.toString(),
						{ caption: photoToSend.caption }
					)
					.then(() => ctx.answerCbQuery("Отправил тебе в ЛС!"))
					.then(L).catch(L);
			else
				return telegram.sendPhoto(from.id, photoToSend.file_id.toString())
					.then(() => ctx.answerCbQuery("Отправил тебе в ЛС!"))
					.then(L).catch(L);
		} else
			return ctx.answerCbQuery("Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!", true);
	} else
		return ctx.answerCbQuery("Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!", true);
});

/**
 * @param {TelegramContext} ctx
 */
const ReplySpoiler = (ctx) => {
	const {message, from} = ctx;
	const replyingMessage = message["reply_to_message"];

	if (BLACKLIST.includes(from["username"])) return false;

	if (replyingMessage) {
		if (replyingMessage["photo"]) {
			const spoilerPhoto = replyingMessage["photo"];

			if (!(spoilerPhoto instanceof Array)) return L("Spoiler photo is not an array");

			let bestPhoto = spoilerPhoto.pop()["file_id"];

			if (!bestPhoto) return L("No file_id in PhotoSize type's object");

			ctx.reply(`Спойлер отправил ${GetUsername(replyingMessage.from, "– ")}, сообщил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.callbackButton("🖼 Показать скрытую картинку 🖼", `SHOW_IMAGE_SPOILER_${GlobalGetIDForImage(bestPhoto, replyingMessage.caption)}`),
					Markup.urlButton("Проверить диалог", "https://t.me/animeultrabot")
				])
			})
				.then(() => telegram.deleteMessage(replyingMessage.chat.id, replyingMessage.message_id))
				.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
				.then(L).catch(L);
		} else if (replyingMessage["text"]) {
			const spoilerText = replyingMessage["text"];

			let remarked = spoilerText.replace(/([^\s!?\.])/g, "█");

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(replyingMessage.from, "– ")}, сообщил${GetUsername(message.from, " – ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.callbackButton("📝 Показать скрытый спойлер 📝", `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilerText)}`)
				])
			})
				.then(() => telegram.deleteMessage(replyingMessage.chat.id, replyingMessage.message_id))
				.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
				.then(L).catch(L);
		};
	} else if (message.text) {
		const spoilerText = message.text.replace(/^\/spoiler(\@animeultrabot)?\s/, "");


		if (spoilerText.length) {
			let remarked = spoilerText.replace(/([^\s!?\.])/g, "█");

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.callbackButton("📝 Показать скрытый спойлер 📝", `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilerText)}`)
				])
			})
				.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
				.then(L).catch(L);
		} else {
			telegram.deleteMessage(message.chat.id, message.message_id).then(L).catch(L);
		};
	};
};






/**
 * @typedef {Object} TelegramTextMessage
 * @property {String} text
 * @property {Array.<{offset: Number, length: Number, type: String}>} entities
 */
/**
 * @param {TelegramTextMessage} message
 * @returns {Promise.<{platform?: function, url: URL, status: boolean}, null>}
 */
const GlobalCheckMessageForLink = (message) => new Promise((resolve, reject) => {
	if (!(message.entities && message.entities.length == 1)) return resolve({ status: false });
	if (message.entities[0].type !== "url") return resolve({ status: false });
	if (message.entities[0].offset) return resolve({ status: false });
	if (message.entities[0].length !== message["text"].length) return resolve({ status: false });


	let url = URL.parse(message["text"]);

	if (
		url.host == "twitter.com" |
		url.host == "www.twitter.com" |
		url.host == "mobile.twitter.com"
	)
		return resolve({ status: true, platform: Twitter, url });
	else if (
		url.host == "pbs.twimg.com" |
		url.origin == "https://pbs.twimg.com"
	)
		return resolve({ status: true, platform: TwitterImg, url });
	else if (
		url.host == "instagram.com" |
		url.host == "www.instagram.com"
	)
		return resolve({ status: true, platform: Instagram, url });
	else if (
		url.host == "reddit.com" |
		url.host == "www.reddit.com"
	)
		return resolve({ status: true, platform: Reddit, url });
	else if (
		url.host == "pixiv.net" |
		url.host == "www.pixiv.net"
	)
		return resolve({ status: true, platform: Pixiv, url });
	else if (
		url.host == "danbooru.donmai.us" |
		url.origin == "https://danbooru.donmai.us"
	)
		return resolve({ status: true, platform: Danbooru, url });
	else if (
		url.host == "gelbooru.com" |
		url.host == "www.gelbooru.com"
	)
		return resolve({ status: true, platform: Gelbooru, url });
	else if (
		url.host == "konachan.com" |
		url.host == "www.konachan.com"
	)
		return resolve({ status: true, platform: Konachan, url });
	else if (
		url.host == "yande.re" |
		url.host == "www.yande.re"
	)
		return resolve({ status: true, platform: Yandere, url });
	else if (
		url.host == "e-shuushuu.net" |
		url.host == "www.e-shuushuu.net"
	)
		return resolve({ status: true, platform: Eshuushuu, url });
	else if (
		url.host == "chan.sankakucomplex.com" |
		url.origin == "https://chan.sankakucomplex.com"
	)
		return resolve({ status: true, platform: Sankaku, url });
	else if (
		url.host == "zerochan.net" |
		url.host == "www.zerochan.net"
	)
		return resolve({ status: true, platform: Zerochan, url });
	else if (
		url.host == "anime-pictures.net" |
		url.host == "www.anime-pictures.net"
	)
		return resolve({ status: true, platform: AnimePictures, url });
	else if (
		url.host == "anime.reactor.cc" |
		url.origin == "http://anime.reactor.cc"
	)
		return resolve({ status: true, platform: Joyreactor, url });
	else
		return resolve({ status: false });
});

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Twitter = (text, ctx, url) => {
	let { pathname } = url,
		statusID;

	if (pathname.match(/^\/[\w\d\_]+\/status(es)?\/(\d+)/))
		statusID = pathname.match(/^\/[\w\d\_]+\/status(es)?\/(\d+)/)[2];
	else if (pathname.match(/^\/statuses\/(\d+)/))
		statusID = pathname.match(/^\/statuses\/(\d+)/)[1];
	else if (pathname.match(/^\/i\/web\/status(es)?\/(\d+)/))
		statusID = pathname.match(/^\/i\/web\/status(es)?\/(\d+)/)[2];


	TwitterApp.get("statuses/show", {
		id: statusID,
		tweet_mode: "extended"
	})
	.then((tweet) => {
		if (DEV) fs.writeFileSync("./out/twitter.json", JSON.stringify(tweet, false, "\t"));

		const MEDIA = tweet["extended_entities"]["media"];

		if (!MEDIA) return;
		if (!MEDIA.length) return;

		let sendingMessageText = tweet["full_text"];

		tweet["entities"]["urls"].forEach((link) =>
			sendingMessageText = sendingMessageText.replace(new RegExp(link.url, "gi"), link.expanded_url)
		);

		sendingMessageText = sendingMessageText
												.replace(/\b(http(s)?\:\/\/)?t.co\/[\w\d_]+\b$/gi, "")
												.replace(/(\s)+/gi, "$1")
												.trim();

		let caption = `<i>${TGE(sendingMessageText)}</i>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;



		if (MEDIA[0]["type"] === "animated_gif") {
			const variants = MEDIA[0]["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

			if (!variants || !variants.length) return false;

			let best = variants[0];

			variants.forEach((variant) => {
				if (variant.bitrate > best.bitrate)
					best = variant;
			});

			ctx.replyWithAnimation(best["url"], {
				caption: `${caption}\n<a href="${encodeURI(best["url"])}">Исходник гифки</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Твит", text),
					Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
					...GlobalSetLikeButtons(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else if (MEDIA[0]["type"] === "video") {
			const variants = MEDIA[0]["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

			if (!variants || !variants.length) return false;

			let best = variants[0];

			variants.forEach((variant) => {
				if (variant.bitrate > best.bitrate)
					best = variant;
			});

			ctx.replyWithVideo(best["url"], {
				caption: `${caption}\n<a href="${encodeURI(best["url"])}">Исходник видео</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Твит", text),
					Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
					...GlobalSetLikeButtons(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else {
			let sourcesArr = MEDIA.map((media, index) => {
				if (media["type"] === "photo")
					return { type: "photo", media: media["media_url_https"] + ":orig" };
				else if (media["type"] === "video") {
					const variants = media["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

					if (!variants || !variants.length) return false;

					let best = variants[0];

					variants.forEach((variant) => {
						if (variant.bitrate > best.bitrate)
							best = variant;
					});

					return { type: "video", media: best["url"] };
				} else
					return false;
			}).filter(i => !!i);

			if (sourcesArr.length === 1)
				caption += `\n<a href="${encodeURI(sourcesArr[0].media)}">Исходник файла</a>`;
			else
				caption += "\nФайлы: " + sourcesArr.map((s, i) => `<a href="${encodeURI(s.media)}">${i + 1}</a>`).join(", ");


			if (sourcesArr.length === 1) {
				ctx.replyWithPhoto(sourcesArr[0].media, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Твит", text),
						Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
						...GlobalSetLikeButtons(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			} else {
				ctx.replyWithMediaGroup(sourcesArr)
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);

						ctx.reply(caption, {
							disable_web_page_preview: true,
							parse_mode: "HTML",
							reply_to_message_id: sentMessage.message_id,
							reply_markup: Markup.inlineKeyboard([
								Markup.urlButton("Твит", text),
								Markup.urlButton("Автор", "https://twitter.com/" + tweet["user"]["screen_name"]),
								...GlobalSetLikeButtons(ctx)
							])
						}).then(L).catch(L);

						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			};
		};
	})
	.catch((e) => L("Error while getting info from Twitter", e));
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const TwitterImg = (text, ctx, url) => {
	const format = GlobalParseQuery(url.query)["format"] || "jpg",
		  mediaPathname = url.pathname.replace(/\:[\w\d]+$/, "").replace(/\.[\w\d]+$/, "");

	ctx.replyWithPhoto(`https://pbs.twimg.com${mediaPathname}.${format}:orig`, {
		caption: `Отправил ${GetUsername(ctx.from, "– ")}`,
		disable_web_page_preview: true,
		parse_mode: "HTML",
		reply_markup: Markup.inlineKeyboard([
			Markup.urlButton("Оригинал", `https://pbs.twimg.com${mediaPathname}.${format}:orig`),
			...GlobalSetLikeButtons(ctx)
		])
	})
		.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
			L(sentMessage);
			return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
		})
		.then(L)
		.catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Instagram = (text, ctx, url) => {
	const PATH_REGEXP = /^\/p\/([\w\_\-]+)(\/)?$/i;
	if (!PATH_REGEXP.test(url.pathname)) return;


	NodeFetch(`https://${url.hostname}${url.pathname}?__a=1`, {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"accept-language": "ru-RU,ru;q=0.9",
			"accept-encoding": "gzip, deflate, br",
			"cache-control": "max-age=0",
			"cookie": INSTAGRAM_COOKIE,
			"dnt": 1,
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "same-origin",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.107 Safari/537.36"
		}
	})
		.then((res) => {
			if (res.status == 200)
				return res.json();
			else
				return Promise.reject(`Status code = ${res.status}`);
		})
		.then((graphData) => {
			const post = graphData?.graphql?.shortcode_media;

			if (!post) return Promise.reject({
				message: "No post in... post",
				graphData
			});


			const sourcesArr = post?.edge_sidecar_to_children?.edges.map((edge) => {
				if (!edge.node) return null;

				if (edge.node.is_video && edge.node.video_url)
					return {
						type: "video",
						media: edge.node.video_url
					};

				return {
					type: "photo",
					media: edge.node?.display_resources?.sort((prev, next) => prev?.config_width - next?.config_width).pop().src
				};
			}).filter((edge, index, array) => {
				if (!edge) return false;
				if (array.length > 1 && edge.type === "video") return false;

				return true;
			}) || [];

			if (!sourcesArr.length) {
				if (post.is_video && post.video_url) {
					sourcesArr.push({
						type: "video",
						media: post.video_url
					});
				} else {
					sourcesArr.push({
						type: "photo",
						media: post.display_resources?.sort((prev, next) => prev?.config_width - next?.config_width).pop().src
					});
				};
			};


			let caption = `<i>${TGE(post?.edge_media_to_caption?.edges?.[0]?.node.text || "")}</i>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;
			const author = `https://instagram.com/${post?.owner?.username || ""}`;


			if (sourcesArr.length === 1)
				caption += `\n<a href="${encodeURI(sourcesArr[0].media)}">Исходник файла</a>`;
			else
				caption += "\nФайлы: " + sourcesArr.map(({ media }, i) => `<a href="${encodeURI(media)}">${i + 1}</a>`).join(", ");


			if (sourcesArr.length === 1) {
				ctx[sourcesArr[0].type === "video" ? "replyWithVideo" : "replyWithPhoto"](sourcesArr[0].media, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Пост", text),
						Markup.urlButton("Автор", author),
						...GlobalSetLikeButtons(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			} else {
				ctx.replyWithMediaGroup(sourcesArr)
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);

						ctx.reply(caption, {
							disable_web_page_preview: true,
							parse_mode: "HTML",
							reply_to_message_id: sentMessage.message_id,
							reply_markup: Markup.inlineKeyboard([
								Markup.urlButton("Пост", text),
								Markup.urlButton("Автор", author),
								...GlobalSetLikeButtons(ctx)
							])
						}).then(L).catch(L);

						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			};
		})
		.catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Pixiv = (text, ctx, url) => {
	const CHECK_REGEXP = /http(s)?\:\/\/(www\.)?pixiv\.net\/([\w]{2}\/)?artworks\/(\d+)/i;

	let pixivID = "";

	if (CHECK_REGEXP.test(text)) {
		pixivID = text.match(CHECK_REGEXP)[4];
	} else if (GlobalParseQuery(url.query)["illust_id"])
		pixivID = GlobalParseQuery(url.query)["illust_id"];

	if (!pixivID) return;



	NodeFetch(`https://www.pixiv.net/en/artworks/${pixivID}`).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((rawPixivHTML) => {
		let data;
		if (DEV) fs.writeFileSync("./out/pixiv-raw.html", rawPixivHTML);

		try {
			rawPixivHTML = rawPixivHTML
										.split(`id="meta-preload-data"`)[1]
										.split("</head")[0]
										.trim()
										.replace(/^content\=('|")/i, "")
										.split(/('|")>/)[0]
										.replace(/('|")>$/i, "")
										.trim();

			if (DEV) fs.writeFileSync("./out/pixiv-parsed.json", rawPixivHTML);

			data = JSON.parse(rawPixivHTML);
		} catch (e) {
			return L("Cannot parse data from Pixiv", e);
		};

		if (DEV) fs.writeFileSync("./out/pixiv.json", JSON.stringify(data, false, "\t"));



		const post = data["illust"][Object.keys(data["illust"])[0]];

		let sourcesAmount = post["pageCount"],
			sourcesOrig = new Array(),
			sourcesForTG = new Array();


		for (let i = 0; i < sourcesAmount; i++) {
			let origFilename = post["urls"]["original"],
				origBasename = origFilename.replace(/\d+\.([\w\d]+)$/i, ""),
				origFiletype = origFilename.match(/\.([\w\d]+)$/i);

			if (origFiletype && origFiletype[1])
				origFiletype = origFiletype[1];
			else
				origFiletype = "png";

			sourcesOrig.push({
				type: "photo",
				media: encodeURI(origBasename + i + "." + origFiletype)
			});



			let masterFilename = post["urls"]["regular"];

			sourcesForTG.push({
				type: "photo",
				media: encodeURI(masterFilename.replace(/\d+(_master\d+\.[\w\d]+$)/i, i + "$1"))
			});
		};



		L(sourcesForTG);



		let title = post["title"] || post["illustTitle"] || post["description"] || post["illustComment"],
			caption = `<i>${TGE(title)}</i>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;


		if (sourcesAmount > 10)
			caption += ` ⬅️ Перейди по ссылке: ${sourcesAmount} ${GetForm(sourcesAmount, ["иллюстрация", "иллюстрации", "иллюстраций"])} не влезли в сообщение`;

		if (sourcesAmount === 1)
			caption += `\n<a href="${CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(sourcesOrig[0].media)).replace(/__HEADERS__/, encodeURIComponent(JSON.stringify({Referer: "http://www.pixiv.net/"})))}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + sourcesOrig.map((s, i) => `<a href="${CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, encodeURIComponent(s.media)).replace(/__HEADERS__/, encodeURIComponent(JSON.stringify({Referer: "http://www.pixiv.net/"})))}">${i + 1}</a>`).join(", ");


		if (sourcesForTG.length === 1) {
			ctx.replyWithPhoto(sourcesForTG[0].media, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Пост", `https://www.pixiv.net/en/artworks/${pixivID}`),
					Markup.urlButton("Автор", "https://www.pixiv.net/en/users/" + post["userId"]),
					...GlobalSetLikeButtons(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else {
			ctx.replyWithMediaGroup(sourcesForTG.slice(0, 10))
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);

				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Пост", `https://www.pixiv.net/en/artworks/${pixivID}`),
						Markup.urlButton("Автор", "https://www.pixiv.net/en/users/" + post["userId"]),
						...GlobalSetLikeButtons(ctx)
					])
				}).then(L).catch(L);

				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
		};
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Reddit = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((redditPage) => {
		let data;

		try {
			redditPage = redditPage
					.split("<body")[1]
					.split(/<(script id\=\"data\")>window\.___r\s\=\s/)
					.pop().split("</script>")[0].replace(/\;/g, "");

			if (DEV) fs.writeFileSync("./out/reddit.json", redditPage);

			data = JSON.parse(redditPage);
		} catch (e) {
			return L("Cannot parse data from Reddit", e);
		};


		const models = data["posts"]["models"]
		const post = models[Object.keys(models)[0]];


		let source = {
			media: "",
			type: ""
		};


		if (post["media"]) {
			let media = post["media"];

			if (media["type"] === "image") {
				if (media["content"])
					source = { media: media["content"], type: "photo" };
			} else if (media["type"] === "gifvideo") {
				if (media["content"])
					source = { media: media["content"], type: "animation" };
			} else if (media["type"] === "video") {
				let videoFileURL = media["scrubberThumbSource"].replace(/\d+$/, media["height"]);

				if (media["isGif"] && media["scrubberThumbSource"] && media["height"])
					source = { media: videoFileURL, type: "animation" };
				else if (media["scrubberThumbSource"] && media["height"])
					source = { media: videoFileURL, type: "video" };
			};
		};


		if (!!source.media & !!source.type) {
			let caption = `<i>${TGE((post["title"] || "").trim())}</i>\n<a href="${encodeURI("https://www.reddit.com/user/" + post["author"] + "/")}">/u/${post["author"]}</a>\n\nОтправил ${GetUsername(ctx.from, "– ")}`,
				callingMethod = (source.type === "photo" ? "replyWithPhoto" : "replyWithAnimation");


			try {
				let pathname = post["permalink"];
					pathname = URL.parse(pathname).pathname;

				if (pathname) {
					let match = pathname.match(/^\/(r\/[\w\d\-_]+)\//);
					if (match) {
						if (match[1]) {
							caption = `<i>${TGE((post["title"] || "").trim())}</i>\n<a href="${encodeURI("https://www.reddit.com/" + match[1] + "/")}">${TGE(match[1])}</a>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;
						};
					};
				};
			} catch (e) {};


			ctx[callingMethod](source.media, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Пост", encodeURI(text)),
					Markup.urlButton("Исходник", source.media),
					...GlobalSetLikeButtons(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		} else
			L("No media in Reddit post");
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Danbooru = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((danbooruPage) => {
		let source = "";

		try {
			source = danbooruPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];

			if (!source) {
				source = danbooruPage
									.split("</head")[0]
									.match(/<meta\s+(name|property)="twitter\:image"\s+content="([^"]+)"/i);

				if (source) source = source[2];
			};
		} catch (e) {
			return L("Error on parsing Danbooru", e);
		};


		if (!source) return L("No Danbooru source");


		let sourceUUID = source.match(/([\d\w]{10,})/i)[0],
			extension = source.match(/\.([\d\w]+)$/i)[0];


		if (!sourceUUID || !extension) return L;

		source = "https://danbooru.donmai.us/data/" + sourceUUID + extension;


		let caption = `Отправил ${GetUsername(ctx.from, "– ")}\nDanbooru | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = danbooruPage
								.split(`<section id="tag-list">`)[1]
								.match(/<a\s+class=\"search\-tag\"\s+itemprop=\"author\"\s+href="([^"]+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://danbooru.donmai.us" + decodeURIComponent(author[1]))}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};



		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Gelbooru = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((gelbooruPage) => {
		let source = "";

		try {
			source = gelbooruPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];
		} catch (e) {
			return L("Error on parsing Gelbooru", e);
		};

		if (!source) return L("No Gelbooru source");

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}\nGelbooru | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = gelbooruPage
								.split(/<h3>\s*Statistics\s*<\/h3>/i)[1]
								.match(/<a\s+href="(index.php\?page\=account&amp\;s\=profile&amp;uname=[^"]+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://gelbooru.com/" + author[1].replace(/&amp;/g, "&"))}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Konachan = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((konachanPage) => {
		let source = "";

		try {
			source = konachanPage
								.split("<body")[1]
								.match(/<a(\s+[\w\d\-]+\="([^"]+)")*\s+href="([^"]+)"(\s+[\w\d\-]+\="([^"]+)")*\s+id="highres"(\s+[\w\d\-]+\="([^"]+)")*/i);

			if (source) source = source[3];
		} catch (e) {
			return L("Error on parsing Konachan", e);
		};

		if (!source) return L("No Konachan source");

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}\nKonachan | <a href="${encodeURI(text)}">Ссылка на пост</a>`;
			author = "";

		try {
			author = konachanPage
								.split('<div id="stats"')[1]
								.match(/<a href="\/user\/show\/(\d+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += ` | <a href="${encodeURI("https://konachan.com/user/show/" + author[1])}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Yandere = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((yanderePage) => {
		let source = "";

		try {
			source = yanderePage
								.split("<body")[1]
								.match(/<a\s+class="[^"]+"\s+id="highres"\s+href="([^"]+)"/i);

			if (source) source = source[1];
		} catch (e) {
			return L("Error on parsing Yandere", e);
		};

		if (!source) return L("No Yandere source");

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;
			author = "";

		try {
			author = yanderePage
								.split('<div id="stats"')[1]
								.match(/<a href="\/user\/show\/(\d+)">([^<]+)/i);

			if (author && !!author[1] && !!author[2]) {
				caption += `\nАвтор – <a href="${encodeURI("https://yande.re/user/show/" + author[1])}">@${TGE(author[2])}</a>`;
			};
		} catch (e) {};


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Eshuushuu = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((eshuushuuPage) => {
		let source = "";

		try {
			source = eshuushuuPage
								.split("<body")[1]
								.match(/<a\s+class="thumb_image"\s+href="([^"]+)"/i);

			if (source && source[1]) source = "https://e-shuushuu.net/" + source[1].replace(/\/\//g, "/").replace(/^\//g, "");
		} catch (e) {
			return L("Error on parsing Eshuushuu", e);
		};

		if (!source) return L("No Eshuushuu source");

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		NodeFetch(source)
			.then((image) => image.buffer())
			.then((buffer) => {
				ctx.replyWithPhoto({
					source: buffer
				}, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Исходник", encodeURI(source)),
						Markup.urlButton("Пост", encodeURI(text)),
						...GlobalSetLikeButtons(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			})
			.catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Sankaku = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((sankakuPage) => {
		let source = "";

		try {
			source = sankakuPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+id=(")?highres/i);

			if (source && source[1]) source = source[1].replace(/&amp;/g, "&");
		} catch (e) {
			return L("Error on parsing Sankaku", e);
		};

		if (!source) return L("No Sankaku source");
		if (source.slice(0, 6) !== "https:") source = "https:" + source

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Zerochan = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((zerochanPage) => {
		let source = "";

		try {
			source = zerochanPage
								.split("</head")[0]
								.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

			if (source) source = source[2];

			if (!source) {
				source = danbooruPage
									.split("</head")[0]
									.match(/<meta\s+(name|property)="twitter\:image"\s+content="([^"]+)"/i);

				if (source) source = source[2];
			};
		} catch (e) {
			return L("Error on parsing Zerochan", e);
		};

		if (!source) return L("No Zerochan source");


		let sourceBasename = source.replace(/\.[\w\d]+$/, ""),
			basenameMatch = zerochanPage.match(new RegExp(sourceBasename + ".[\\w\\d]+", "gi"));

		if (basenameMatch && basenameMatch.pop) source = basenameMatch.pop();

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				Markup.urlButton("Исходник", encodeURI(source)),
				Markup.urlButton("Пост", encodeURI(text)),
				...GlobalSetLikeButtons(ctx)
			])
		})
			.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
				L(sentMessage);
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.then(L).catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const AnimePictures = (text, ctx, url) => {
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((animePicturesPage) => {
		let source = "";

		try {
			source = animePicturesPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+title="[^"]+"\s+itemprop="contentURL"/i);

			if (source && source[1]) source = source[1];
		} catch (e) {
			return L("Error on parsing AnimePictures", e);
		};

		if (!source) return L("No AnimePictures source");

		try {
			let imglink = URL.parse(source);

			if (!imglink.host) source = "https://anime-pictures.net" + source;
		} catch (e) {
			if (!imglink.host) source = "https://anime-pictures.net" + source;
			L(e);
		};

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;



		NodeFetch(source)
			.then((image) => image.buffer())
			.then((buffer) => {
				ctx.replyWithPhoto({
					source: buffer
				}, {
					caption,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						Markup.urlButton("Исходник", encodeURI(source)),
						Markup.urlButton("Пост", encodeURI(text)),
						...GlobalSetLikeButtons(ctx)
					])
				})
					.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
						L(sentMessage);
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.then(L).catch(L);
			})
			.catch(L);
	}).catch(L);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Joyreactor = (text, ctx, url) => {
	if (!(/^\/post\/\d+/.test(url.pathname))) return;
	
	
	NodeFetch(text).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((joyreactorPage) => {
		let source = "";

		try {
			source = joyreactorPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+class="prettyPhotoLink/i);

			if (source && source[1]) source = source[1];
		} catch (e) {
			return L("Error on parsing Joyreactor", e);
		};

		if (!source) return L("No Joyreactor source");



		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		NodeFetch(source, {
			headers: {
				"Referer": text
			}
		}).then((image) => image.buffer())
		.then((buffer) => {
			ctx.replyWithPhoto({
				source: buffer
			}, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					Markup.urlButton("Исходник", encodeURI(CONFIG.CUSTOM_IMG_VIEWER_SERVICE.replace(/__LINK__/, source).replace(/__HEADERS__/, JSON.stringify({"Referer": text})))),
					Markup.urlButton("Пост", encodeURI(text)),
					...GlobalSetLikeButtons(ctx)
				])
			})
				.then(/** @param {TelegramMessageObject} sentMessage */ (sentMessage) => {
					L(sentMessage);
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				})
				.then(L).catch(L);
		})
		.catch(L);
	}).catch(L);
};

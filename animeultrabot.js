const
	URL = require("url"),
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	NodeFetch = require("node-fetch"),
	TwitterModule = require("twitter-lite"),
	Telegraf = require("telegraf"),
	KhaleesiModule = require("./animeultrabot.khaleesi.js"),
	path = require("path"),
	fs = require("fs"),
	{ createWriteStream, createReadStream } = fs,
	{ promisify } = require("util"),
	{ pipeline } = require("stream"),
	streamPipeline = promisify(pipeline),
	ffmpeg = require("ffmpeg"),
	TEMP_FOLDER = DEV ? process.env["TEMP"] : "/tmp/";

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
 * @property {String} INSTAGRAM_COOKIE
 * @property {{id: number, username: string}} ADMIN_TELEGRAM_DATA
 * @property {Array.<{id: number, name?: string, enabled: boolean, welcome?: WelcomeMessageText | WelcomeMessageGIF}>} CHATS_LIST
 * @property {String[]} COMMANDS_WHITELIST
 * @property {String[]} MARKS_WHITELIST
 * @property {String[] | Number[]} BLACKLIST
 * @property {Number} LIKES_STATS_CHANNEL_ID
 * @property {String} SPECIAL_STICKERS_SET
 * @property {String} EMPTY_QUERY_IMG
 * @property {String} DONE_QUERY_IMG
 */
/** @type {ConfigFile} */
const
	CONFIG = require("./animeultrabot.config.json"),
	{
		TELEGRAM_BOT_TOKEN,
		TWITTER_CONSUMER_KEY,
		TWITTER_CONSUMER_SECRET,
		CUSTOM_IMG_VIEWER_SERVICE,
		INSTAGRAM_COOKIE,
		ADMIN_TELEGRAM_DATA,
		CHATS_LIST,
		COMMANDS_WHITELIST,
		MARKS_WHITELIST,
		BLACKLIST,
		LIKES_STATS_CHANNEL_ID,
		SPECIAL_STICKERS_SET,
		EMPTY_QUERY_IMG,
		DONE_QUERY_IMG
	} = CONFIG,
	COMMANDS_USAGE = new Object(),
	COMMANDS = {
		"help": `Что я умею?
	
• Скрывать спойлеры командой /spoiler (смотри команду /aboutspoiler@animeultrabot).
• Обрабатывать ссылки на ресурсы (смотри команды /aboutpicker@animeultrabot и /pickerlist@animeultrabot).
• Добавлять кнопки оценок к сообщениям.
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
• Пост на Reddit (изображения, гифки и видео)
• Пост на Danbooru (изображения)
• Пост на Gelbooru (изображения)
• Пост на Konachan (изображения)
• Пост на Yande.re (изображения)
• Пост на Sankaku Channel (изображения)
• Пост на Zerochan (изображения)
• Пост на Anime-Pictures.net (изображения)
• Nitter – тоже самое, что и Twitter
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
		"chebotarb": (ctx) => Chebotarb(ctx),
		"set_likes": (ctx) => SetLikes(ctx),
		"testcommand": `<pre>Ну и што ты здесь зобылб?</pre>`
	};




const telegraf = new Telegraf.Telegraf(TELEGRAM_BOT_TOKEN);
const telegram = telegraf.telegram;


/**
 * @param {String} iQuery
 * @returns {Object.<string, (string|true)>}
 */
const GlobalParseQuery = iQuery => {
	if (!iQuery) return {};

	const returningList = new Object();

	iQuery.toString().replace(/^\?/, "").split("&").forEach((queryPair) => {
		try {
			if (queryPair.split("=")[1])
				returningList[queryPair.split("=")[0]] = decodeURIComponent(queryPair.split("=")[1]);
			else
				returningList[queryPair.split("=")[0]] = true;
		} catch (e) {
			returningList[queryPair.split("=")[0]] = (queryPair.split("=")[1] || true);
		};
	});

	return returningList;
};

const GetForm = (iNumber, iForms) => {
	iNumber = iNumber.toString();

	if (iNumber.slice(-2)[0] == "1" & iNumber.length > 1) return iForms[2];
	if (iNumber.slice(-1) == "1") return iForms[0];
	else if (/2|3|4/g.test(iNumber.slice(-1))) return iForms[1];
	else if (/5|6|7|8|9|0/g.test(iNumber.slice(-1))) return iForms[2];
};

/**
 * @param  {Error[] | String[]} args
 * @returns {void}
 */
const LogMessageOrError = (...args) => {
	const containsAnyError = (args.findIndex((message) => message instanceof Error) > -1),
		  out = (containsAnyError ? console.error : console.log);

	out(new Date());
	args.forEach((message) => out(message));
	out("~~~~~~~~~~~\n\n");


	if (DEV) fs.writeFile("./out/logmessageorerror.json", JSON.stringify([...args], false, "\t"), () => {});
};

/**
 * @param {String} iStringToEscape
 * @returns {String}
 */
const TGE = iStringToEscape => {
	if (!iStringToEscape) return "";
	
	if (typeof iStringToEscape === "string")
		return iStringToEscape
			.replace(/\&/g, "&amp;")
			.replace(/\</g, "&lt;")
			.replace(/\>/g, "&gt;");
	else
		return TGE(iStringToEscape.toString());
};

/**
 * @param {String} iStringToUnescape
 * @returns {String}
 */
const TGUE = iStringToUnescape => {
	if (!iStringToUnescape) return "";
	
	if (typeof iStringToUnescape === "string")
		return iStringToUnescape
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&amp;/g, "&");
	else
		return TGUE(iStringToUnescape.toString());
};

/**
 * @typedef {import("telegraf").Context} TelegramContext
 */
/**
 * @param {import("telegraf").} from
 * @param {String} [prefix]
 */
const GetUsername = (from, prefix = "") => {
	if (from.username === ADMIN_TELEGRAM_DATA.username) return TGE("Почтой России");

	return `${TGE(prefix)}<a href="${from.username ? `https://t.me/${from.username}` : `tg://user?id=${from.id}`}">${TGE(from.first_name)}${from.last_name ? " " + TGE(from.last_name) : ""}</a>`;
};

/**
 * @param {String} message
 */
const TelegramSendToAdmin = (message) => {
	if (!message) return;

	telegram.sendMessage(ADMIN_TELEGRAM_DATA.id, message, {
		parse_mode: "HTML",
		disable_notification: true
	}).catch(LogMessageOrError);
};

if (!DEV)
	TelegramSendToAdmin(`Anime Ultra Bot have been spawned at ${new Date().toISOString()} <i>(ISO 8601, UTC)</i>`);



const TwitterUser = new TwitterModule({
	consumer_key: TWITTER_CONSUMER_KEY, // from Twitter
	consumer_secret: TWITTER_CONSUMER_SECRET, // from Twitter
});

let TwitterApp;

TwitterUser.getBearerToken().then((response) => {
	TwitterApp = new TwitterModule({
		bearer_token: response.access_token
	});
});


telegraf.on("text", /** @param {TelegramContext} ctx */ (ctx) => {
	const {chat, from} = ctx;


	if (chat && chat["type"] === "private") {
		const message = ctx["message"];
		if (!message) return false;

		LogMessageOrError(`Private chat with user ${from.id} (@${from.username || "NO_USERNAME"}) – ${new Date().toISOString()}. Text: ${message["text"]}`);

		const text = message["text"];
		if (!text) return false;


		if (BLACKLIST.includes(from["username"]) || BLACKLIST.includes(from["id"])) return false;


		if (from["username"] === ADMIN_TELEGRAM_DATA.username) {
			if (text.match(/^\/god (0|1)$/i)) {
				let mode = text.match(/^\/god (0|1)$/i)[1];
				godModeEnabled = (mode === "1");

				TelegramSendToAdmin(JSON.stringify({ godModeEnabled }, false, "\t"));
				return false;
			};
		};



		const commandMatch = text.match(/^\/([\w]+)(\@animeultrabot)?$/i);

		if (commandMatch && commandMatch[1]) {
			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).catch(LogMessageOrError);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		};

		return false;
	};


	if (DEV) {
		if (CHATS_LIST.findIndex((chatFromList) => chatFromList.id === chat["id"]) == -1)
			LogMessageOrError(["NEW CHAT!", chat["id"], chat["title"], chat["type"]]);
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



		const commandMatch = text.match(/^\/([\w]+)\@animeultrabot$/i);

		if (commandMatch && commandMatch[1]) {
			telegram.deleteMessage(chat.id, message.message_id).catch(LogMessageOrError);

			if (!CheckForCommandAvailability(from)) return false


			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).catch(LogMessageOrError);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		};




		if (/жаль([\.\?\!…]*)$/i.test(text.trim())) {
			if (CheckForCommandAvailability(from)) {
				if (Math.random() < 0.33) {
					return ctx.reply("<i>…как Орлов, порхай как бабочка!</i>", {
						parse_mode: "HTML",
						reply_to_message_id: message.message_id
					}).catch(LogMessageOrError);
				} else {
					if (Math.random() < 0.5)
						return ctx.replyWithSticker("CAACAgIAAx0CU5r_5QACCFlejL-ACp0b5UFZppv4rFVWZ9lZGwAChQYAAiMhBQABqCwuoKvunScYBA", {
							reply_to_message_id: message.message_id
						}).catch(LogMessageOrError);
					else
						return ctx.replyWithAnimation("CgACAgIAAxkBAAIWpl-6h0sKFMfsMOOECb6M3kjr34vjAALMBwACaeiYSYFBpLc63EZvHgQ", {
							reply_to_message_id: message.message_id
						}).catch(LogMessageOrError);
				};
			};
		};




		GlobalCheckMessageForLink(message)
			.then((res) => {
				if (res.status & (typeof res.platform == "function")) {
					res.platform(message["text"], ctx, res.url);
				};
			})
			.catch(LogMessageOrError);
	});
});

telegraf.on("photo", /** @param {TelegramContext} ctx */ (ctx) => {
	const {message, from} = ctx;

	if (message.caption && message.photo) {
		if (BLACKLIST.includes(from["username"]) || BLACKLIST.includes(from["id"])) return false;


		if (/^\/spoiler(\@animeultrabot)?/.test(message.caption)) {
			let captionToHide = message.caption.match(/^\/spoiler(\@animeultrabot)?\s(.+)/);

			if (captionToHide && captionToHide[2])
				captionToHide = captionToHide[2];
			else
				captionToHide = null;


			let bestPhoto = message.photo.pop()["file_id"];

			if (!bestPhoto) return LogMessageOrError("No file_id in PhotoSize type's object");

			ctx.reply(`Спойлер отправил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "🖼 Показать скрытую картинку 🖼",
						callback_data: `SHOW_IMAGE_SPOILER_${GlobalGetIDForImage(bestPhoto, captionToHide)}`
					},
					{
						text: "Проверить диалог",
						url: "https://t.me/animeultrabot"
					}
				]).reply_markup
			})
				.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
				.catch(LogMessageOrError);
		};
	};
});

telegraf.on("new_chat_members", /** @param {TelegramContext} ctx */ (ctx) => {
	const {message} = ctx;
	if (!message) return LogMessageOrError("No message on new_chat_member!");

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
			}).catch(LogMessageOrError);
		} else if (welcome.type == "gif") {
			ctx.replyWithAnimation(welcome.message.file_id, {
				caption: welcome.message.caption ? welcome.message.caption.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0])) : "",
				parse_mode: "HTML",
				disable_web_page_preview: true,
				reply_to_message_id: message.message_id
			}).catch(LogMessageOrError);
		};
	});
});

telegraf.launch();





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

	if (!khaleesiedText) return;

	ctx.reply(khaleesiedText, {
		reply_to_message_id: replyingMessage.message_id
	}).catch(LogMessageOrError);
};

/**
 * @param {TelegramContext} ctx
 */
const Chebotarb = (ctx) => {
	const {message} = ctx;
	if (!message) return;

	const replyingMessage = message.reply_to_message;

	telegram.getStickerSet(SPECIAL_STICKERS_SET).then((stickerSet) => {
		const randomSticker = stickerSet.stickers[Math.floor(Math.random() * stickerSet.stickers.length)];

		return ctx.replyWithSticker(randomSticker["file_id"], replyingMessage ? {
			reply_to_message_id: replyingMessage.message_id,
			allow_sending_without_reply: false
		} : {});
	}).catch(LogMessageOrError);
};

/**
 * @param {TelegramContext} ctx
 */
const SetLikes = (ctx) => {
	const {message} = ctx;
	if (!message) return;

	const {chat} = ctx;
	if (!chat) return;

	const replyingMessage = message.reply_to_message;
	if (!replyingMessage) return;


	const
		chatID = parseInt(chat.id.toString().replace(/^(\-)?1/, "")),
		messageLink = `https://t.me/c/${chatID}/${replyingMessage.message_id}`;


	ctx.reply(`Оценки <a href="${messageLink}">⬆ сообщению ⬆</a>`, {
		disable_web_page_preview: true,
		parse_mode: "HTML",
		reply_to_message_id: replyingMessage.message_id,
		reply_markup: Telegraf.Markup.inlineKeyboard(GlobalSetLikeButtons(ctx)).reply_markup
	}).catch(LogMessageOrError);
};

/**
 * @param {TelegramFromObject} from
 * @returns {Boolean}
 */
const CheckForCommandAvailability = (from) => {
	let pass = false;
	if (from.username && COMMANDS_WHITELIST.includes(from.username))
		pass = true;
	else if ((from.username && BLACKLIST.includes(from.username)) || (from.id && BLACKLIST.includes(from.id)))
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
	const currentPostStamp = `${++currentSessionStamp}_${Date.now()}`;

	currentSessionPosts[currentPostStamp] = {
		likedBy: [],
		dislikedBy: []
	};

	return [
		{
			text: "👍",
			callback_data: `LIKE_${currentPostStamp}`
		},
		{
			text: "👎",
			callback_data: `DISLIKE_${currentPostStamp}`
		}
	];
};

/**
 * @param {{target: "like"|"dislike", type: "set"|"removed"}} iAction
 * @param {TelegramContext} ctx
 * @returns {void}
 */
const GlobalReportAboutMark = (iAction, ctx) => {
	const message = ctx.callbackQuery?.message,
		  from = ctx.callbackQuery?.from,
		  chat = message?.chat;

	if (!chat || !from || !message) return LogMessageOrError("OnMarkReport: No <message>, <from> or <chat>", ctx.callbackQuery);

	const
		chatID = parseInt(chat.id.toString().replace(/^(\-)?1/, "")),
		messageLink = `https://t.me/c/${chatID}/${message?.message_id}`,
		textToSend = `<b>${iAction.type === "set" ? "Поставлен" : "Убран"} ${iAction.target === "like" ? "лайк" : "дизлайк"}</b>
Пользователь – ${GetUsername(from)}
Чат – <i>${chat?.title || "unknown"}</i>
Пост – <a href="${messageLink}">${messageLink}</a>`;


	if (LIKES_STATS_CHANNEL_ID)
		telegram.sendMessage(LIKES_STATS_CHANNEL_ID, textToSend, {
			disable_web_page_preview: true,
			parse_mode: "HTML",
		}).catch(LogMessageOrError);
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

telegraf.action(/^LIKE_(\d+_\d+)/, /** @param {TelegramContext} ctx */ (ctx) => {
	const {match} = ctx;
	if (!match) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (0)").catch(LogMessageOrError);

	const postStamp = match[1];
	if (!postStamp) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (1)").catch(LogMessageOrError);

	const {callbackQuery} = ctx;
	if (!callbackQuery) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (3)").catch(LogMessageOrError);

	/** @type {TelegramMessageObject} */
	const message = callbackQuery["message"];

	/** @type {TelegramFromObject} */
	const from = callbackQuery["from"];

	if (from["username"] && BLACKLIST.includes(from["username"])) return ctx.answerCbQuery("Тебе нельзя ставить плюсы").catch(LogMessageOrError);
	if (from["id"] && BLACKLIST.includes(from["id"])) return ctx.answerCbQuery("Тебе нельзя ставить плюсы").catch(LogMessageOrError);

	const {chat} = message;
	if (!chat) return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (4)").catch(LogMessageOrError);


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


		if (!hotUsersLikes[user])
			hotUsersLikes[user] = 1;
		else
			++hotUsersLikes[user];

		setTimeout(() => --hotUsersLikes[user], 5 * 1e3);

		if (hotUsersLikes[user] > 3 && !isGod) return ctx.answerCbQuery("Слишком много оценок, подождите немного").catch(LogMessageOrError);


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
			.then(() => ctx.answerCbQuery(messageToShow))
			.catch((e) => {
				LogMessageOrError(e);
				ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (6)").catch(LogMessageOrError);
			});
	} else
		return ctx.answerCbQuery("За лайк спасибо, но не засчитаю 😜 (7)").catch(LogMessageOrError);
});

telegraf.action(/^DISLIKE_(\d+_\d+)/, /** @param {TelegramContext} ctx */ (ctx) => {
	const {match} = ctx;
	if (!match) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (0)").catch(LogMessageOrError);

	const postStamp = match[1];
	if (!postStamp) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (1)").catch(LogMessageOrError);

	const {callbackQuery} = ctx;
	if (!callbackQuery) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (3)").catch(LogMessageOrError);

	/** @type {TelegramMessageObject} */
	const message = callbackQuery["message"];

	/** @type {TelegramFromObject} */
	const from = callbackQuery["from"];

	if (from["username"] && BLACKLIST.includes(from["username"])) return ctx.answerCbQuery("Тебе нельзя ставить минусы").catch(LogMessageOrError);
	if (from["id"] && BLACKLIST.includes(from["id"])) return ctx.answerCbQuery("Тебе нельзя ставить минусы").catch(LogMessageOrError);

	const {chat} = message;
	if (!chat) return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (4)").catch(LogMessageOrError);


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


		if (!hotUsersLikes[user])
			hotUsersLikes[user] = 1;
		else
			++hotUsersLikes[user];

		setTimeout(() => --hotUsersLikes[user], 5 * 1e3);

		if (hotUsersLikes[user] > 3 && !isGod) return ctx.answerCbQuery("Слишком много оценок, подождите немного").catch(LogMessageOrError);


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
			.then(() => ctx.answerCbQuery(messageToShow))
			.catch((e) => {
				LogMessageOrError(e);
				ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (6)").catch(LogMessageOrError);
			});
	} else
		return ctx.answerCbQuery("За дизлайк спасибо, но не засчитаю 😜 (7)").catch(LogMessageOrError);
});




/**
 * @param {String} iURL
 * @returns {String}
 */
const GlobalGetDomain = iURL => {
	try {
		const url = URL.parse(iURL);
		if (url.hostname) return url.hostname;
		return iURL;
	} catch (e) {
		return iURL;
	};
};

/**
 * @param {String} video
 * @param {String} audio
 * @returns {Promise.<{ url?: string, filename?: string, onDoneCallback?: Function }, string>}
 */
const GlobalCombineVideo = (video, audio) => {
	if (!video) return Promise.reject("No video URL");
	if (!audio) return Promise.resolve({ url: video });


	const videoBaseFilename = video.replace(/[^\d\w]+/gi, "") + Date.now(),
		  videoFilename = path.resolve(TEMP_FOLDER, `${videoBaseFilename}_video`),
		  videoFiletype = video.replace(/\?.*$/, "").match(/\.(\w+)$/)?.[1] || "mp4",
		  audioFilename = path.resolve(TEMP_FOLDER, `${videoBaseFilename}_audio`),
		  outFilename = path.resolve(TEMP_FOLDER, `${video.replace(/[^\d\w]+/gi, "") + Date.now()}_out.${videoFiletype}`);


	const LocalDeleteTempFiles = () => {
		fs.unlink(videoFilename, (e) => e && LogMessageOrError(e));
		fs.unlink(audioFilename, (e) => e && LogMessageOrError(e));
		fs.unlink(outFilename, (e) => e && LogMessageOrError(e));
	};


	return NodeFetch(video).then((response) => {
		if (response.status !== 200)
			return Promise.reject(`Response status on video (${video}) is ${response.status}`);

		return streamPipeline(response.body, createWriteStream(videoFilename));
	})
	.then(() => NodeFetch(audio))
	.then((response) => {
		if (response.status !== 200)
			return Promise.reject(`Response status on audio (${audio}) is ${response.status}`);

		return streamPipeline(response.body, createWriteStream(audioFilename));
	})
	.then(() => new ffmpeg(videoFilename))
	.then((video) => new Promise((resolve, reject) => {
		video.addInput(audioFilename);
		video.addCommand("-c:v", "copy");
		video.addCommand("-c:a", "aac");
		video.addCommand("-qscale", "0");
		video.save(outFilename, (e) => {
			if (e) return reject(e);

			resolve({ filename: outFilename, onDoneCallback: () => LocalDeleteTempFiles() });
		});
	})).catch((e) => {
		LogMessageOrError(e);
		LocalDeleteTempFiles();
		return Promise.resolve({ url: video });
	});
};




let spoilerIdStamp = 0;

/** @type {Array.<{id: number, text: string}>} */
const textSpoilersArray = [];

/** @type {Array.<{id: number, file_id: string, caption?: string}>} */
const imageSpoilersArray = [];

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

telegraf.on("inline_query", (ctx) => {
	const spoilering = ctx.inlineQuery.query;

	if (!spoilering) {
		return ctx.answerInlineQuery([{
			type: "article",
			id: `spoiler_empty`,
			title: "Пожалуйста, наберите что-нибудь",
			description: "█████████ ████████ █████",
			thumb_url: EMPTY_QUERY_IMG,
			input_message_content: {
				message_text: "<Я дурачок и не набрал текст спойлера>"
			}
		}]).catch(LogMessageOrError);
	};


	const remarked = spoilering.replace(/([^\s!?\.])/g, "█");

	ctx.answerInlineQuery([{
		type: "article",
		id: `spoiler_${ctx.inlineQuery.from.usernname || ctx.inlineQuery.from.id}_${Date.now()}`,
		title: "Отправить скрытый текст",
		thumb_url: DONE_QUERY_IMG,
		description: remarked,
		input_message_content: {
			message_text: remarked.slice(0, 20)
		},
		reply_markup: Telegraf.Markup.inlineKeyboard([
			{
				text: "📝 Показать скрытый спойлер 📝",
				callback_data: `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilering)}`
			}
		]).reply_markup
	}]).catch(LogMessageOrError);
});

telegraf.action(/^SHOW_TEXT_SPOILER_(\d+_\d+)/, (ctx) => {
	if (ctx.match && ctx.match[1]) {
		let indexOfSpoiler = textSpoilersArray.findIndex((spoiler) => spoiler.id === ctx.match[1]);

		if (indexOfSpoiler > -1) {
			let spoilerToDisplay = textSpoilersArray[indexOfSpoiler]["text"].toString();


			if (spoilerToDisplay.length >= 200)
				spoilerToDisplay = spoilerToDisplay.slice(0, 196) + "...";


			return ctx.answerCbQuery(spoilerToDisplay, true).catch(LogMessageOrError);
		} else
			return ctx.answerCbQuery("Спойлер настолько ужасный, что я его потерял 😬. Вот растяпа!", true).catch(LogMessageOrError);
	} else
		return ctx.answerCbQuery("Спойлер настолько ужасный, что я его потерял 😬. Вот растяпа!", true).catch(LogMessageOrError);
});

telegraf.action(/^SHOW_IMAGE_SPOILER_([\w\d_]+)/, (ctx) => {
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
					.catch(LogMessageOrError);
			else
				return telegram.sendPhoto(from.id, photoToSend.file_id.toString())
					.then(() => ctx.answerCbQuery("Отправил тебе в ЛС!"))
					.catch(LogMessageOrError);
		} else
			return ctx.answerCbQuery("Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!", true).catch(LogMessageOrError);
	} else
		return ctx.answerCbQuery("Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!", true).catch(LogMessageOrError);
});

/**
 * @param {TelegramContext} ctx
 */
const ReplySpoiler = (ctx) => {
	const {message, from} = ctx;
	const replyingMessage = message["reply_to_message"];

	if (BLACKLIST.includes(from["username"]) | BLACKLIST.includes(from["id"])) return false;

	if (replyingMessage) {
		if (replyingMessage["photo"]) {
			const spoilerPhoto = replyingMessage["photo"];

			if (!(spoilerPhoto instanceof Array)) return LogMessageOrError("Spoiler photo is not an array");

			let bestPhoto = spoilerPhoto.pop()["file_id"];

			if (!bestPhoto) return LogMessageOrError("No file_id in PhotoSize type's object");

			ctx.reply(`Спойлер отправил ${GetUsername(replyingMessage.from, "– ")}, сообщил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "🖼 Показать скрытую картинку 🖼",
						callback_data: `SHOW_IMAGE_SPOILER_${GlobalGetIDForImage(bestPhoto, replyingMessage.caption)}`
					},
					{
						text: "Проверить диалог",
						url: "https://t.me/animeultrabot"
					}
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(replyingMessage.chat.id, replyingMessage.message_id))
			.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
			.catch(LogMessageOrError);
		} else if (replyingMessage["text"]) {
			const spoilerText = replyingMessage["text"];

			let remarked = spoilerText.replace(/([^\s!?\.])/g, "█");

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(replyingMessage.from, "– ")}, сообщил ${GetUsername(message.from, " – ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "📝 Показать скрытый спойлер 📝",
						callback_data: `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilerText)}`
					}
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(replyingMessage.chat.id, replyingMessage.message_id))
			.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
			.catch(LogMessageOrError);
		};
	} else if (message.text) {
		const spoilerText = message.text.replace(/^\/spoiler(\@animeultrabot)?\s/, "");


		if (spoilerText.length) {
			let remarked = spoilerText.replace(/([^\s!?\.])/g, "█");

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(message.from, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "📝 Показать скрытый спойлер 📝",
						callback_data: `SHOW_TEXT_SPOILER_${GlobalGetIDForText(spoilerText)}`
					}
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(message.chat.id, message.message_id))
			.catch(LogMessageOrError);
		} else {
			telegram.deleteMessage(message.chat.id, message.message_id).catch(LogMessageOrError);
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


	const url = URL.parse(message["text"]);

	if (
		url.host == "twitter.com" |
		url.host == "www.twitter.com" |
		url.host == "mobile.twitter.com"
	)
		return resolve({ status: true, platform: Twitter, url });
	else if (
		url.host == "nitter.net" |
		url.host == "www.nitter.net" |
		url.host == "mobile.nitter.net"
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

		let caption = `<i>${TGE(TGUE(sendingMessageText))}</i>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;


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
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "Твит",
						url: text
					},
					{
						text: "Автор",
						url: "https://twitter.com/" + tweet["user"]["screen_name"]
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
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
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "Твит",
						url: text
					},
					{
						text: "Автор",
						url: "https://twitter.com/" + tweet["user"]["screen_name"]
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else {
			/**
			 * @param {"url" | "buffer"} iMethod
			 * @returns {Promise}
			 */
			const LocalTryMethod = (iMethod) => {
				/** @type {{type: String, media: String}[]} */
				const sourcesArr = MEDIA.map((media) => {
					if (media["type"] === "photo") {
						return { type: "photo", media: media["media_url_https"] + ":orig" };
					} else if (media["type"] === "video") {
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


				const imageLinksForUsers = sourcesArr.map((source) => encodeURI(source.media.replace(/(\:\w+)?$/, ":orig")))

				const currentCaptionPostfix = (
					sourcesArr.length === 1 ?
						`\n<a href="${encodeURI(sourcesArr[0].media.replace(/(\:\w+)?$/, ":orig"))}">Исходник файла</a>`
					:
						"\nФайлы: " + imageLinksForUsers.map((link, linkIndex) => `<a href="${link}">${linkIndex + 1}</a>`).join(", ")
				);


				if (iMethod === "url") {
					if (sourcesArr.length === 1) {
						return ctx.replyWithPhoto(sourcesArr[0].media, {
							caption: caption + currentCaptionPostfix,
							disable_web_page_preview: true,
							parse_mode: "HTML",
							reply_markup: Telegraf.Markup.inlineKeyboard([
								{
									text: "Твит",
									url: text
								},
								{
									text: "Автор",
									url: "https://twitter.com/" + tweet["user"]["screen_name"]
								},
								...GlobalSetLikeButtons(ctx)
							]).reply_markup
						});
					} else {
						return ctx.replyWithMediaGroup(sourcesArr.map((source, sourceIndex) => ({
								media: source.media,
								type: source.type,
								caption: `<a href="${imageLinksForUsers[sourceIndex]}">Исходник файла</a>`,
								parse_mode: "HTML"
							})))
							.then((sentMessage) => {
								ctx.reply(caption + currentCaptionPostfix, {
									disable_web_page_preview: true,
									parse_mode: "HTML",
									reply_to_message_id: sentMessage.message_id,
									reply_markup: Telegraf.Markup.inlineKeyboard([
										{
											text: "Твит",
											url: text
										},
										{
											text: "Автор",
											url: "https://twitter.com/" + tweet["user"]["screen_name"]
										},
										...GlobalSetLikeButtons(ctx)
									]).reply_markup
								}).catch(LogMessageOrError);
							});
					};
				} else if (iMethod === "buffer") {
					return Promise.all(
						sourcesArr.map((source) => 
							NodeFetch(source.media).then((media) => media.buffer())
						)
					).then(/** @param {Buffer[]} mediaBuffers */ (mediaBuffers) => {
						if (sourcesArr.length === 1) {
							return ctx.replyWithPhoto({
								source: mediaBuffers[0]
							}, {
								caption: caption + currentCaptionPostfix,
								disable_web_page_preview: true,
								parse_mode: "HTML",
								reply_markup: Telegraf.Markup.inlineKeyboard([
									{
										text: "Твит",
										url: text
									},
									{
										text: "Автор",
										url: "https://twitter.com/" + tweet["user"]["screen_name"]
									},
									...GlobalSetLikeButtons(ctx)
								]).reply_markup
							});
						} else {
							return ctx.replyWithMediaGroup(sourcesArr.map((source, sourceIndex) => ({
								media: { source: mediaBuffers[sourceIndex] },
								type: source.type,
								caption: `<a href="${imageLinksForUsers[sourceIndex]}">Исходник файла</a>`,
								parse_mode: "HTML"
							})))
							.then((sentMessage) => {
								ctx.reply(caption + currentCaptionPostfix, {
									disable_web_page_preview: true,
									parse_mode: "HTML",
									reply_to_message_id: sentMessage.message_id,
									reply_markup: Telegraf.Markup.inlineKeyboard([
										{
											text: "Твит",
											url: text
										},
										{
											text: "Автор",
											url: "https://twitter.com/" + tweet["user"]["screen_name"]
										},
										...GlobalSetLikeButtons(ctx)
									]).reply_markup
								}).catch(LogMessageOrError);
							});
						};
					});
				};
			};


			LocalTryMethod("url")
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(() => {
				LocalTryMethod("buffer")
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.catch(LogMessageOrError)
			});
		};
	})
	.catch((e) => LogMessageOrError("Error while getting info from Twitter", e));
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


	/**
	 * @param {String} iPostfixToTryWith
	 * @returns {Promise}
	 */
	const LocalTryWithPostfix = (iPostfixToTryWith) => {
		return ctx.replyWithPhoto(`https://pbs.twimg.com${mediaPathname}.${format}${iPostfixToTryWith}`, {
			caption: `Отправил ${GetUsername(ctx.from, "– ")}`,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Оригинал",
					url: `https://pbs.twimg.com${mediaPathname}.${format}:orig`
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		});
	};


	LocalTryWithPostfix(":orig")
	.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
	.catch(() => {
		LocalTryWithPostfix("")
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	});
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


		/** @type {{type: String, media: String}[]} */
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


		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;
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
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "Пост",
						url: text
					},
					{
						text: "Автор",
						url: author
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else {
			ctx.replyWithMediaGroup(sourcesArr.map((source) => ({
				media: source.media,
				type: source.type,
				caption: `<a href="${encodeURI(source.media)}">Исходник файла</a>`,
				parse_mode: "HTML"
			})))
			.then((sentMessage) => {
				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					reply_markup: Telegraf.Markup.inlineKeyboard([
						{
							text: "Пост",
							url: text
						},
						{
							text: "Автор",
							url: author
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				}).catch(LogMessageOrError);

				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.catch(LogMessageOrError);
		};
	})
	.catch(LogMessageOrError);
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
		try {
			rawPixivHTML = rawPixivHTML
										.split(`id="meta-preload-data"`)[1]
										.split("</head")[0]
										.trim()
										.replace(/^content\=('|")/i, "")
										.split(/('|")>/)[0]
										.replace(/('|")>$/i, "")
										.trim();

			data = JSON.parse(rawPixivHTML);
		} catch (e) {
			return LogMessageOrError("Cannot parse data from Pixiv", e);
		};


		const post = data["illust"][Object.keys(data["illust"])[0]];

		/** @type {Number} */
		const sourcesAmount = post["pageCount"];

		/** @type {{type: String, media: String}[]} */
		const sourcesOrig = new Array();

		/** @type {{type: String, media: String}[]} */
		const sourcesForTG = new Array();


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



		let title = post["title"] || post["illustTitle"] || post["description"] || post["illustComment"],
			caption = `<i>${TGE(title)}</i>\n\nОтправил ${GetUsername(ctx.from, "– ")}`;


		if (sourcesAmount > 10)
			caption += ` ⬅️ Перейди по ссылке: ${sourcesAmount} ${GetForm(sourcesAmount, ["иллюстрация", "иллюстрации", "иллюстраций"])} не влезли в сообщение`;


		const imageLinksForUsers = sourcesOrig.map((source) =>
			CUSTOM_IMG_VIEWER_SERVICE
				.replace(/__LINK__/, encodeURIComponent(source.media))
				.replace(/__HEADERS__/, encodeURIComponent(
					JSON.stringify({ Referer: "http://www.pixiv.net/" })
				))
			);


		if (sourcesAmount === 1)
			caption += `\n<a href="${imageLinksForUsers[0]}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + imageLinksForUsers.map((link, linkIndex) => `<a href="${link}">${linkIndex + 1}</a>`).join(", ");


		if (sourcesForTG.length === 1) {
			ctx.replyWithPhoto(sourcesForTG[0].media, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "Пост",
						url: `https://www.pixiv.net/en/artworks/${pixivID}`
					},
					{
						text: "Автор",
						url: "https://www.pixiv.net/en/users/" + post["userId"]
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else {
			ctx.replyWithMediaGroup(sourcesForTG.slice(0, 10).map((source, sourceIndex) => ({
				media: source.media,
				type: source.type,
				caption: `<a href="${imageLinksForUsers[sourceIndex]}">Исходник файла</a>`,
				parse_mode: "HTML"
			})))
			.then((sentMessage) => {
				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					reply_markup: Telegraf.Markup.inlineKeyboard([
						{
							text: "Пост",
							url: `https://www.pixiv.net/en/artworks/${pixivID}`
						},
						{
							text: "Автор",
							url: "https://www.pixiv.net/en/users/" + post["userId"]
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				}).catch(LogMessageOrError);

				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.catch(LogMessageOrError);
		};
	}).catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Reddit = (text, ctx, url) => {
	if (!url.pathname) return;

	const REDDIT_POST_REGEXP = /^(\/r\/[\w\d\-\._]+\/comments\/[\w\d\-\.]+)(\/)?/i,
		  match = url.pathname.match(REDDIT_POST_REGEXP);

	if (!(match && match[1])) return;

	const postJSON = `https://www.reddit.com${match[1]}.json`,
		  postURL = `https://www.reddit.com${match[1]}${match[2] || ""}`;


	const DEFAULT_REDDIT_HEADERS = {
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
		"Accept-Encoding": "gzip, deflate, br",
		"Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
		"Cache-Control": "no-cache",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
		"Origin": "https://www.reddit.com",
		"Pragma": "no-cache",
		"referer": "https://www.reddit.com/"
	};


	NodeFetch(postJSON, { headers: DEFAULT_REDDIT_HEADERS }).then((res) => {
		if (res.status == 200)
			return res.json();
		else
			return Promise.reject(`Status code = ${res.status}`);
	}).then((redditPostData) => {
		const post = redditPostData[0]?.data?.children?.[0]?.data,
			  title = post?.title,
			  caption = `${title ? `<i>${TGE(title)}</i>\n\n` : ""}Отправил ${GetUsername(ctx.from, "– ")}`,
			  author = post?.author,
			  isVideo = post?.is_video,
			  isGallery = post?.is_gallery;

		if (!post) return LogMessageOrError("No post in .json-data");


		if (isVideo) {
			const video = post?.secure_media?.reddit_video?.fallback_url,
				  isGif = post?.secure_media?.reddit_video?.is_gif;

			if (!video) return LogMessageOrError("Reddit no video");


			new Promise((resolve) => {
				if (isGif) return resolve({ url: video });

				if (!post?.secure_media?.reddit_video?.hls_url) return resolve({ url: video });

				const hslPlaylist = post.secure_media.reddit_video.hls_url;

				return NodeFetch(hslPlaylist, {
					headers: {
						...DEFAULT_REDDIT_HEADERS,
						host: GlobalGetDomain(hslPlaylist)
					}
				}).then((response) => {
					if (response.status == 200)
						return response.text();
					else
						return Promise.reject(`Response status from Reddit ${response.status}`);
				}).then((hslFile) => {
					const hslPlaylistLines = hslFile.split("\t"),
						audioPlaylistLocation = hslPlaylistLines.filter((line) => /TYPE=AUDIO/i.test(line)).pop()?.match(/URI="([^"]+)"/)?.[1] || "";

					return NodeFetch(hslPlaylist.replace(/\/[^\/]+$/, `/${audioPlaylistLocation}`), {
						headers: {
							...DEFAULT_REDDIT_HEADERS,
							host: GlobalGetDomain(hslPlaylist)
						}
					});
				}).then((response) => {
					if (response.status == 200)
						return response.text();
					else
						return Promise.reject(`Response status from Reddit ${response.status}`);
				}).then((audioPlaylistFile) => {
					const audioFilename = audioPlaylistFile.split("\n").filter((line) => line && !/^#/.test(line)).pop() || "",
						audio = audioFilename.trim() ? hslPlaylist.replace(/\/[^\/]+$/, `/${audioFilename}`) : "";

					if (!audio) return resolve({ url: video });

					GlobalCombineVideo(video, audio)
						.then(({ url, filename, onDoneCallback }) => {
							if (filename)
								resolve({ filename, onDoneCallback, audioSource: audio });
							else
								resolve({ url: video })
						})
						.catch(() => resolve({ url: video }));
				}).catch(() => resolve({ url: video }));
			}).then(
				/** @param {{url?: String, filename?: String, onDoneCallback?: Function, audioSource?: string}} */
				({ url, filename, onDoneCallback, audioSource }) => {
					ctx.replyWithVideo(filename ? {
						source: createReadStream(filename)
					} : url, {
						caption: `${caption}\n<a href="${encodeURI(video)}">Исходник видео</a>${audioSource ? `, <a href="${encodeURI(audioSource)}">исходник аудио</a>` : ""}`,
						disable_web_page_preview: true,
						parse_mode: "HTML",
						reply_markup: Telegraf.Markup.inlineKeyboard([
							{
								text: "Пост",
								url: postURL
							},
							{
								text: "Автор",
								url: `https://www.reddit.com/u/${author || "me"}`
							},
							...GlobalSetLikeButtons(ctx)
						]).reply_markup
					})
					.then(() => {
						if (onDoneCallback) onDoneCallback();
						return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
					})
					.catch(LogMessageOrError);
				}
			).catch(LogMessageOrError);
		} else {
			if (isGallery) {
				/** @type {{filetype: string, url: string}[]} */
				const galleryMedias = post?.gallery_data?.items
					?.map((item) => {
						const isGalleryMediaGif = !!post?.media_metadata?.[item.media_id]?.s?.gif;

						if (isGalleryMediaGif)
							return {
								filetype: "gif",
								url: post?.media_metadata?.[item.media_id]?.s?.gif
							};

						try {
							const url = URL.parse(post?.media_metadata?.[item.media_id]?.s?.u),
								  filetype = url.pathname.match(/\.([\w]+)$/i)?.[1] || "jpeg";

							return {
								filetype: (filetype === "jpg" ? "jpeg" : filetype),
								url: `https://${url.hostname.replace(/^preview\./i, "i.")}${url.pathname}`
							};
						} catch (e) {
							return false;
						};
					})
					.filter((galleryMedia) => !!galleryMedia);

				if (!galleryMedias || !galleryMedias.length) return LogMessageOrError("Reddit no gallery");


				const imagesToSend = galleryMedias
										.filter((galleryMedia) => galleryMedia.filetype !== "gif")
										.map((galleryMedia) => ({
											type: "photo",
											media: galleryMedia.url
										})).slice(0, 10),
					  gifsToSend = galleryMedias
										.filter((galleryMedia) => galleryMedia.filetype === "gif")
										.map((galleryMedia) => ({
											type: "animation",
											media: galleryMedia.url
										}));


				new Promise((resolve, reject) => {
					let stillLoading = true,
						counterOfSentMedia = 0,
						lastSentMessageId = -1;

					const LocalDoneSendingMedias = () => {
						if (counterOfSentMedia === imagesToSend.length + gifsToSend.length)
							resolve(lastSentMessageId);
					};
					
					if (imagesToSend.length >= 2) {
						if (!stillLoading) return;

						ctx.replyWithMediaGroup(imagesToSend.map((source) => ({
							media: source.media,
							type: source.type,
							caption: `<a href="${encodeURI(source.media)}">Исходник файла</a>`,
							parse_mode: "HTML"
						})))
						.then((sentMessage) => {
							if (!stillLoading) return;

							counterOfSentMedia += imagesToSend.length;
							lastSentMessageId = sentMessage.message_id;
							LocalDoneSendingMedias();
						}).catch((e) => {
							stillLoading = false;
							reject(e);
						});
					} else if (imagesToSend.length === 1) {
						if (!stillLoading) return;

						ctx.replyWithPhoto(imagesToSend[0].media)
						.then((sentMessage) => {
							if (!stillLoading) return;

							++counterOfSentMedia;
							lastSentMessageId = sentMessage.message_id;
							LocalDoneSendingMedias();
						}).catch((e) => {
							stillLoading = false;
							reject(e);
						});
					};


					if (gifsToSend.length) {
						gifsToSend.forEach((gifToSend) => {
							if (!stillLoading) return;

							ctx.replyWithAnimation(gifToSend.media)
							.then((sentMessage) => {
								if (!stillLoading) return;

								++counterOfSentMedia;
								lastSentMessageId = sentMessage.message_id;
								LocalDoneSendingMedias();
							}).catch((e) => {
								stillLoading = false;
								reject(e);
							});
						});
					};
				}).then(/** @param {Number} messageIdToReply */ (messageIdToReply) => {
					ctx.reply(`${caption}\nФайлы: ${galleryMedias.map((galleryMedia, index) => `<a href="${encodeURI(galleryMedia.url)}">${index + 1}</a>`).join(", ")}`, {
						disable_web_page_preview: true,
						parse_mode: "HTML",
						reply_to_message_id: messageIdToReply,
						reply_markup: Telegraf.Markup.inlineKeyboard([
							{
								text: "Пост",
								url: postURL
							},
							{
								text: "Автор",
								url: `https://www.reddit.com/u/${author || "me"}`
							},
							...GlobalSetLikeButtons(ctx)
						]).reply_markup
					}).catch(LogMessageOrError);

					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				}).catch(LogMessageOrError);
			} else {
				const imageURL = post?.url;
				if (!imageURL) return LogMessageOrError("Reddit no image");

				ctx.replyWithPhoto(imageURL, {
					caption: `${caption}\n<a href="${encodeURI(imageURL)}">Исходник файла</a>`,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Telegraf.Markup.inlineKeyboard([
						{
							text: "Пост",
							url: postURL
						},
						{
							text: "Автор",
							url: `https://www.reddit.com/u/${author || "me"}`
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.catch(LogMessageOrError);
			};
		};
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Danbooru", e);
		};


		if (!source) return LogMessageOrError("No Danbooru source");


		let sourceUUID = source.match(/([\d\w]{10,})/i)[0],
			extension = source.match(/\.([\d\w]+)$/i)[0];


		if (!sourceUUID || !extension) return LogMessageOrError;

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
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Gelbooru", e);
		};

		if (!source) return LogMessageOrError("No Gelbooru source");

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
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Konachan", e);
		};

		if (!source) return LogMessageOrError("No Konachan source");

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
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Yandere", e);
		};

		if (!source) return LogMessageOrError("No Yandere source");

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
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				{
					text: "Пост",
					url: encodeURI(text)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Eshuushuu", e);
		};

		if (!source) return LogMessageOrError("No Eshuushuu source");

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
					reply_markup: Telegraf.Markup.inlineKeyboard([
						{
							text: "Исходник",
							url: encodeURI(source)
						},
						{
							text: "Пост",
							url: encodeURI(text)
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.catch(LogMessageOrError);
			})
			.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Sankaku", e);
		};

		if (!source) return LogMessageOrError("No Sankaku source");
		if (source.slice(0, 6) !== "https:") source = "https:" + source

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				{
					text: "Пост",
					url: encodeURI(text)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Zerochan", e);
		};

		if (!source) return LogMessageOrError("No Zerochan source");


		let sourceBasename = source.replace(/\.[\w\d]+$/, ""),
			basenameMatch = zerochanPage.match(new RegExp(sourceBasename + ".[\\w\\d]+", "gi"));

		if (basenameMatch && basenameMatch.pop) source = basenameMatch.pop();

		let caption = `Отправил ${GetUsername(ctx.from, "– ")}`;


		ctx.replyWithPhoto(source, {
			caption,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Telegraf.Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				{
					text: "Пост",
					url: encodeURI(text)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
		.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing AnimePictures", e);
		};

		if (!source) return LogMessageOrError("No AnimePictures source");

		try {
			let imglink = URL.parse(source);

			if (!imglink.host) source = "https://anime-pictures.net" + source;
		} catch (e) {
			if (!imglink.host) source = "https://anime-pictures.net" + source;
			LogMessageOrError(e);
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
					reply_markup: Telegraf.Markup.inlineKeyboard([
						{
							text: "Исходник",
							url: encodeURI(source)
						},
						{
							text: "Пост",
							url: encodeURI(text)
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				})
				.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
				.catch(LogMessageOrError);
			})
			.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
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
			return LogMessageOrError("Error on parsing Joyreactor", e);
		};

		if (!source) return LogMessageOrError("No Joyreactor source");


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
				reply_markup: Telegraf.Markup.inlineKeyboard([
					{
						text: "Исходник",
						url: encodeURI(
							CUSTOM_IMG_VIEWER_SERVICE
								.replace(/__LINK__/, source)
								.replace(/__HEADERS__/, JSON.stringify({ "Referer": text }))
						)
					},
					{
						text: "Пост",
						url: encodeURI(text)
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		})
		.catch(LogMessageOrError);
	}).catch(LogMessageOrError);
};


process.on("unhandledRejection", (reason, p) => {
	if (DEV) {
		LogMessageOrError("Unhandled Rejection at: Promise", p, "reason:", reason);
	};
});

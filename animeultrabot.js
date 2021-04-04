const
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	NodeFetch = require("node-fetch"),
	Telegraf = require("telegraf").Telegraf,
	Markup = require("telegraf").Markup,
	KhaleesiModule = require("./utils/animeultrabot.khaleesi"),
	LogMessageOrError = require("./utils/log"),
	SocialParsers = require("./utils/social-parsers"),
	{ GetForm, GetUsername, ParseQuery, TGE, TGUE, LoadCommandDescription, SafeParseURL } = require("./utils/common-utils"),
	fs = require("fs"),
	{ createReadStream } = fs;



const
	CONFIG = DEV ? require("./animeultrabot.config.mine.json") : require("./animeultrabot.config.json"),
	{
		TELEGRAM_BOT_TOKEN,
		ADMIN_TELEGRAM_DATA,
		CHATS_LIST,
		COMMANDS_WHITELIST,
		MARKS_WHITELIST,
		BLACKLIST,
		LIKES_STATS_CHANNEL_ID,
		SPECIAL_PHRASE_STICKER,
		SPECIAL_PHRASE_GIF,
		SPECIAL_STICKERS_SET,
		EMPTY_QUERY_IMG,
		DONE_QUERY_IMG
	} = CONFIG,
	COMMANDS_USAGE = new Object(),
	COMMANDS = {
		"help": LoadCommandDescription("help", CONFIG),
		"start": LoadCommandDescription("help", CONFIG),
		"aboutpicker": LoadCommandDescription("aboutpicker", CONFIG),
		"pickerlist": LoadCommandDescription("pickerlist", CONFIG),
		"aboutspoiler": LoadCommandDescription("aboutspoiler", CONFIG),
		"khaleesi": (ctx) => Khaleesi(ctx),
		"chebotarb": (ctx) => Chebotarb(ctx),
		"set_likes": (ctx) => SetLikes(ctx),
		"testcommand": `<pre>Ну и што ты здесь зобылб?</pre>`
	};




const telegraf = new Telegraf(TELEGRAM_BOT_TOKEN, DEV ? {} : {
	telegram: {
		apiRoot: "http://localhost:"
	}
});
const telegram = telegraf.telegram;


/**
 * @typedef {import("telegraf").Context} TelegramContext
 */
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






telegraf.on("text", /** @param {TelegramContext} ctx */ (ctx) => {
	const {chat, from} = ctx;


	if (chat && chat["type"] === "private") {
		const message = ctx["message"];
		if (!message) return false;

		LogMessageOrError(`Private chat with user ${from.id} (@${from.username || "NO_USERNAME"}) – ${new Date().toISOString()}. Text: ${message["text"]}`);

		/** @type {String} */
		const text = message["text"];
		if (!text) return false;


		if (BLACKLIST.includes(from["username"]) || BLACKLIST.includes(from["id"])) return false;


		if (from["username"] === ADMIN_TELEGRAM_DATA.username) {
			if (text.match(/^\/god (0|1)$/i)) {
				const modeFromAdmin = text.match(/^\/god (0|1)$/i)[1];
				godModeEnabled = (modeFromAdmin === "1");

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
						reply_to_message_id: message.message_id,
						allow_sending_without_reply: true
					}).catch(LogMessageOrError);
				} else {
					if (Math.random() < 0.5)
						return ctx.replyWithSticker(SPECIAL_PHRASE_STICKER.file_id || {
							source: createReadStream(SPECIAL_PHRASE_STICKER.filename)
						}, {
							reply_to_message_id: message.message_id,
							allow_sending_without_reply: true
						}).catch(LogMessageOrError);
					else
						return ctx.replyWithAnimation(SPECIAL_PHRASE_GIF.file_id || {
							source: createReadStream(SPECIAL_PHRASE_GIF.filename)
						}, {
							reply_to_message_id: message.message_id,
							allow_sending_without_reply: true
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

			ctx.reply(`Спойлер отправил ${GetUsername(message.from, ADMIN_TELEGRAM_DATA.username, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
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
			ctx.reply(welcome.message.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0], ADMIN_TELEGRAM_DATA.username)), {
				parse_mode: "HTML",
				disable_web_page_preview: true,
				reply_to_message_id: message.message_id,
				allow_sending_without_reply: true
			}).catch(LogMessageOrError);
		} else if (welcome.type == "gif") {
			ctx.replyWithAnimation(welcome.message.filename ? {
				source: createReadStream(welcome.message.filename)
			} : welcome.message.file_id, {
				caption: welcome.message.caption ? welcome.message.caption.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0], ADMIN_TELEGRAM_DATA.username)) : "",
				parse_mode: "HTML",
				disable_web_page_preview: true,
				reply_to_message_id: message.message_id,
				allow_sending_without_reply: true
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
		reply_to_message_id: replyingMessage.message_id,
		allow_sending_without_reply: true
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
		allow_sending_without_reply: true,
		reply_markup: Markup.inlineKeyboard(GlobalSetLikeButtons(ctx)).reply_markup
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
Пользователь – ${GetUsername(from, ADMIN_TELEGRAM_DATA.username)}
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
		reply_markup: Markup.inlineKeyboard([
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

			ctx.reply(`Спойлер отправил ${GetUsername(replyingMessage.from, ADMIN_TELEGRAM_DATA.username, "– ")}, сообщил ${GetUsername(message.from, ADMIN_TELEGRAM_DATA.username, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
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

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(replyingMessage.from, ADMIN_TELEGRAM_DATA.username, "– ")}, сообщил ${GetUsername(message.from, ADMIN_TELEGRAM_DATA.username, " – ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
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

			ctx.reply(`${remarked.slice(0, 20)}\n\nСпойлер отправил ${GetUsername(message.from, ADMIN_TELEGRAM_DATA.username, "– ")}`, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
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
 * @typedef {import("telegraf/typings/core/types/typegram").Message} TelegramTextMessage
 */
/**
 * @param {TelegramTextMessage} message
 * @returns {Promise<{platform?: function, url: URL, status: boolean}>}
 */
const GlobalCheckMessageForLink = (message) => new Promise((resolve) => {
	if (!(message.entities && message.entities.length == 1)) return resolve({ status: false });
	if (message.entities[0].type !== "url") return resolve({ status: false });
	if (message.entities[0].offset) return resolve({ status: false });
	if (message.entities[0].length !== message["text"].length) return resolve({ status: false });


	const url = SafeParseURL(message["text"]);

	if (
		url.hostname == "twitter.com" |
		url.hostname == "www.twitter.com" |
		url.hostname == "mobile.twitter.com"
	)
		return resolve({ status: true, platform: Twitter, url });
	else if (
		url.hostname == "nitter.net" |
		url.hostname == "www.nitter.net" |
		url.hostname == "mobile.nitter.net"
	)
		return resolve({ status: true, platform: Twitter, url });
	else if (
		url.hostname == "pbs.twimg.com" |
		url.origin == "https://pbs.twimg.com"
	)
		return resolve({ status: true, platform: TwitterImg, url });
	else if (
		url.hostname == "instagram.com" |
		url.hostname == "www.instagram.com"
	)
		return resolve({ status: true, platform: Instagram, url });
	else if (
		url.hostname == "reddit.com" |
		url.hostname == "www.reddit.com"
	)
		return resolve({ status: true, platform: Reddit, url });
	else if (
		url.hostname == "pixiv.net" |
		url.hostname == "www.pixiv.net"
	)
		return resolve({ status: true, platform: Pixiv, url });
	else if (
		url.hostname == "danbooru.donmai.us" |
		url.origin == "https://danbooru.donmai.us"
	)
		return resolve({ status: true, platform: Danbooru, url });
	else if (
		url.hostname == "gelbooru.com" |
		url.hostname == "www.gelbooru.com"
	)
		return resolve({ status: true, platform: Gelbooru, url });
	else if (
		url.hostname == "konachan.com" |
		url.hostname == "konachan.net" |
		url.hostname == "www.konachan.com" |
		url.hostname == "www.konachan.net"
	)
		return resolve({ status: true, platform: Konachan, url });
	else if (
		url.hostname == "yande.re" |
		url.hostname == "www.yande.re"
	)
		return resolve({ status: true, platform: Yandere, url });
	else if (
		url.hostname == "e-shuushuu.net" |
		url.hostname == "www.e-shuushuu.net"
	)
		return resolve({ status: true, platform: Eshuushuu, url });
	else if (
		url.hostname == "chan.sankakucomplex.com" |
		url.origin == "https://chan.sankakucomplex.com"
	)
		return resolve({ status: true, platform: Sankaku, url });
	else if (
		url.hostname == "zerochan.net" |
		url.hostname == "www.zerochan.net"
	)
		return resolve({ status: true, platform: Zerochan, url });
	else if (
		url.hostname == "anime-pictures.net" |
		url.hostname == "www.anime-pictures.net"
	)
		return resolve({ status: true, platform: AnimePictures, url });
	else if (
		url.hostname == "anime.reactor.cc" |
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
	SocialParsers.Twitter(url)
	.then((post) => {
		if (!post.medias || !post.medias.length) return;

		const caption = `<i>${TGE(TGUE(post.caption))}</i>\n\nОтправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`;

		if (post.medias.length === 1 && post.medias[0].type === "gif") {
			ctx.replyWithAnimation(post.medias[0].externalUrl, {
				caption: `${caption}\n<a href="${post.medias[0].externalUrl}">Исходник гифки</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Твит",
						url: text
					},
					{
						text: "Автор",
						url: post.authorURL
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else if (post.medias.length === 1 && post.medias[0].type === "video") {
			ctx.replyWithVideo(post.medias[0].externalUrl, {
				caption: `${caption}\n<a href="${post.medias[0].externalUrl}">Исходник видео</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Твит",
						url: text
					},
					{
						text: "Автор",
						url: post.authorURL
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
				const currentCaptionPostfix =
					post.medias.length === 1 ?
						`\n<a href="${encodeURI(post.medias[0].externalUrl.replace(/(\:\w+)?$/, ":orig"))}">Исходник файла</a>`
					:
						"\nФайлы: " + post.medias.map((media, index) => `<a href="${media.externalUrl}">${index + 1}</a>`).join(", ");


				if (iMethod === "url") {
					if (post.medias.length === 1) {
						return ctx.replyWithPhoto(post.medias[0].externalUrl, {
							caption: caption + currentCaptionPostfix,
							disable_web_page_preview: true,
							parse_mode: "HTML",
							reply_markup: Markup.inlineKeyboard([
								{
									text: "Твит",
									url: text
								},
								{
									text: "Автор",
									url: post.authorURL
								},
								...GlobalSetLikeButtons(ctx)
							]).reply_markup
						});
					} else {
						return ctx.replyWithMediaGroup(post.medias.map((media) => ({
								media: media.externalUrl,
								type: media.type,
								caption: `<a href="${media.externalUrl}">Исходник файла</a>`,
								disable_web_page_preview: true,
								parse_mode: "HTML"
							})))
							.then((sentMessage) => {
								ctx.reply(caption + currentCaptionPostfix, {
									disable_web_page_preview: true,
									parse_mode: "HTML",
									reply_to_message_id: sentMessage.message_id,
									allow_sending_without_reply: true,
									reply_markup: Markup.inlineKeyboard([
										{
											text: "Твит",
											url: text
										},
										{
											text: "Автор",
											url: post.authorURL
										},
										...GlobalSetLikeButtons(ctx)
									]).reply_markup
								}).catch(LogMessageOrError);
							});
					};
				} else if (iMethod === "buffer") {
					return Promise.all(
						post.medias.map((media) => 
							NodeFetch(media.externalUrl).then((media) => media.buffer())
						)
					).then(/** @param {Buffer[]} mediaBuffers */ (mediaBuffers) => {
						if (post.medias.length === 1) {
							return ctx.replyWithPhoto({
								source: mediaBuffers[0]
							}, {
								caption: caption + currentCaptionPostfix,
								disable_web_page_preview: true,
								parse_mode: "HTML",
								reply_markup: Markup.inlineKeyboard([
									{
										text: "Твит",
										url: text
									},
									{
										text: "Автор",
										url: post.authorURL
									},
									...GlobalSetLikeButtons(ctx)
								]).reply_markup
							});
						} else {
							return ctx.replyWithMediaGroup(post.medias.map((media, index) => ({
								media: { source: mediaBuffers[index] },
								type: media.type,
								caption: `<a href="${media.externalUrl}">Исходник файла</a>`,
								disable_web_page_preview: true,
								parse_mode: "HTML"
							})))
							.then((sentMessage) => {
								ctx.reply(caption + currentCaptionPostfix, {
									disable_web_page_preview: true,
									parse_mode: "HTML",
									reply_to_message_id: sentMessage.message_id,
									allow_sending_without_reply: true,
									reply_markup: Markup.inlineKeyboard([
										{
											text: "Твит",
											url: text
										},
										{
											text: "Автор",
											url: post.authorURL
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
		}
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
	const format = ParseQuery(url.query)["format"] || "jpg",
		  mediaPathname = url.pathname.replace(/\:[\w\d]+$/, "").replace(/\.[\w\d]+$/, "");


	/**
	 * @param {String} iPostfixToTryWith
	 * @returns {Promise}
	 */
	const LocalTryWithPostfix = (iPostfixToTryWith) => {
		return ctx.replyWithPhoto(`https://pbs.twimg.com${mediaPathname}.${format}${iPostfixToTryWith}`, {
			caption: `Отправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`,
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
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
	SocialParsers.Instagram(url)
	.then((post) => {
		if (!post.medias || !post.medias.length) return;

		let caption = `${post.caption.length > 50 ? post.caption.slice(0, 50) + "…" : post.caption}\n\nОтправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`;

		if (post.medias.length === 1)
			caption += `\n<a href="${encodeURI(post.medias[0].externalUrl)}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + post.medias.map((media, index) => `<a href="${encodeURI(media.externalUrl)}">${index + 1}</a>`).join(", ");


		if (post.medias.length === 1) {
			ctx[post.medias[0].type === "video" ? "replyWithVideo" : "replyWithPhoto"](post.medias[0].externalUrl, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Пост",
						url: post.postURL
					},
					{
						text: "Автор",
						url: post.authorURL
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else {
			ctx.replyWithMediaGroup(post.medias.map((media) => ({
				media: media.externalUrl,
				type: media.type,
				caption: `<a href="${encodeURI(media.externalUrl)}">Исходник файла</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML"
			})))
			.then((sentMessage) => {
				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					allow_sending_without_reply: true,
					reply_markup: Markup.inlineKeyboard([
						{
							text: "Пост",
							url: post.postURL
						},
						{
							text: "Автор",
							url: post.authorURL
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
const Pixiv = (text, ctx, url) => {
	SocialParsers.Pixiv(url)
	.then((post) => {
		if (!post.medias || !post.medias.length) return;

		let caption = `<i>${TGE(post.caption)}</i>\n\nОтправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`;



		if (post.medias.length === 1)
			caption += `\n<a href="${post.medias[0].original}">Исходник файла</a>`;
		else
			caption += "\nФайлы: " + post.medias.map((media, index) => `<a href="${media.original}">${index + 1}</a>`).join(", ");


		if (post.medias.length > 10)
			caption += `\nПерейди по ссылке: ${post.medias.length} ${GetForm(post.medias.length, ["иллюстрация", "иллюстрации", "иллюстраций"])} не влезли в сообщение`;


		if (post.medias.length === 1) {
			ctx.replyWithPhoto(post.medias[0].externalUrl, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Пост",
						url: post.postURL
					},
					{
						text: "Автор",
						url: post.authorURL
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		} else {
			ctx.replyWithMediaGroup(post.medias.slice(0, 10).map((media, sourceIndex) => ({
				media: media.externalUrl,
				type: media.type,
				caption: `<a href="${media.original}">Исходник файла</a>`,
				disable_web_page_preview: true,
				parse_mode: "HTML"
			})))
			.then((sentMessage) => {
				ctx.reply(caption, {
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_to_message_id: sentMessage.message_id,
					allow_sending_without_reply: true,
					reply_markup: Markup.inlineKeyboard([
						{
							text: "Пост",
							url: post.postURL
						},
						{
							text: "Автор",
							url: post.authorURL
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
const Reddit = (text, ctx, url) => {
	SocialParsers.Reddit(url)
	.then((post) => {
		if (!post.medias || !post.medias.length) return;

		const caption = `${post.caption ? `<i>${TGE(post.caption)}</i>\n\n` : ""}Отправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`;

		if (post.medias.length === 1 && post.medias[0].type === "video") {
			const { externalUrl, filename, fileCallback, type, otherSources } = post.medias[0];

			ctx.replyWithVideo(filename ? {
				source: createReadStream(filename)
			} : externalUrl, {
				caption: `${caption}\n<a href="${encodeURI(externalUrl)}">Исходник видео</a>${otherSources?.audio ? `, <a href="${encodeURI(otherSources?.audio)}">исходник аудио</a>` : ""}`,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Пост",
						url: post.postURL
					},
					{
						text: "Автор",
						url: post.authorURL
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => {
				if (fileCallback) fileCallback();
				return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
			})
			.catch(LogMessageOrError);
		} else if (post.medias.length === 1) {
			const { externalUrl, type } = post.medias[0];


			/**
			 * @param {"url" | "buffer"} iMethod
			 */
			const LocalTryToSendByMethod = (iMethod = "url") => {
				const options = {
					caption: `${caption}\n<a href="${encodeURI(externalUrl)}">Исходник файла</a>`,
					disable_web_page_preview: true,
					parse_mode: "HTML",
					reply_markup: Markup.inlineKeyboard([
						{
							text: "Пост",
							url: post.postURL
						},
						{
							text: "Автор",
							url: post.authorURL
						},
						...GlobalSetLikeButtons(ctx)
					]).reply_markup
				};


				if (iMethod === "url")
					return ctx[type === "gif" ? "replyWithAnimation" : "replyWithPhoto"](externalUrl, options)
						.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id));

				return NodeFetch(externalUrl)
					.then((res) => res.buffer())
					.then((buffer) => ctx[type === "gif" ? "replyWithAnimation" : "replyWithPhoto"]({ source: buffer }, options))
					.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id));
			};


			LocalTryToSendByMethod("url")
			.catch(() => {
				LocalTryToSendByMethod("buffer")
				.catch(LogMessageOrError);
			});
		} else {
			const imagesToSend = post.medias.filter(({type}) => type === "photo").slice(0, 10),
				  gifsToSend = post.medias.filter(({type}) => type === "gif");


			/**
			 * @param {"url" | "buffer"} iMethod
			 */
			const LocalTryToSendByMethod = (iMethod = "url") =>
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

						(
							iMethod === "url" ? 
								ctx.replyWithMediaGroup(imagesToSend.map((media) => ({
									media: media.externalUrl,
									type: media.type,
									caption: `<a href="${encodeURI(media.externalUrl)}">Исходник файла</a>`,
									disable_web_page_preview: true,
									parse_mode: "HTML"
								})))
							:
								Promise.all(
									imagesToSend.map((media) => NodeFetch(media.externalUrl).then((res) => res.buffer()))
								).then((buffers) => {
									ctx.replyWithMediaGroup(imagesToSend.map((media, index) => ({
										media: { source: buffers[index] },
										type: media.type,
										caption: `<a href="${encodeURI(media.externalUrl)}">Исходник файла</a>`,
										disable_web_page_preview: true,
										parse_mode: "HTML"
									})))
								})
						)
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

						(
							iMethod === "url" ?
								ctx.replyWithPhoto(imagesToSend[0].externalUrl)
							:
								NodeFetch(imagesToSend[0].externalUrl)
								.then((res) => res.buffer())
								.then((buffer) => ctx.replyWithPhoto({ source: buffer }))
						)
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

							(
								iMethod === "url" ?
									ctx.replyWithAnimation(gifToSend.externalUrl)
								:
									NodeFetch(gifToSend.externalUrl)
									.then((res) => res.buffer())
									.then((buffer) => ctx.replyWithAnimation({ source: buffer }))
							)
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
				})
				.then(/** @param {Number} messageIdToReply */ (messageIdToReply) => {
					ctx.reply(`${caption}\nФайлы: ${post.medias.map((media, index) => `<a href="${encodeURI(media.externalUrl)}">${index + 1}</a>`).join(", ")}`, {
						disable_web_page_preview: true,
						parse_mode: "HTML",
						reply_to_message_id: messageIdToReply,
						allow_sending_without_reply: true,
						reply_markup: Markup.inlineKeyboard([
							{
								text: "Пост",
								url: post.postURL
							},
							{
								text: "Автор",
								url: post.authorURL
							},
							...GlobalSetLikeButtons(ctx)
						]).reply_markup
					}).catch(LogMessageOrError);

					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				});


			LocalTryToSendByMethod("url")
			.catch(() => {
				LocalTryToSendByMethod("buffer")
				.catch(LogMessageOrError);
			});
		}
	})
	.catch(LogMessageOrError);
};

/**
 * @param {TelegramContext} ctx
 * @param {String} source
 * @param {String} postURL
 * @returns {void}
 */
const GenericBooruSend = (ctx, source, postURL) => {
	if (!source) return;

	NodeFetch(source, {
		headers: {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"accept-language": "en-US,en;q=0.9,ru;q=0.8",
			"cache-control": "no-cache",
			"pragma": "no-cache",
			"sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
			"sec-ch-ua-mobile": "?0",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "none",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
		}
	})
	.then((res) => {
		if (res.status === 200)
			return res.buffer();
		else
			return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
	})
	.then((buffer) =>
		ctx.replyWithPhoto({ source: buffer }, {
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_markup: Markup.inlineKeyboard([
				{
					text: "Исходник",
					url: encodeURI(source)
				},
				{
					text: "Пост",
					url: encodeURI(postURL)
				},
				...GlobalSetLikeButtons(ctx)
			]).reply_markup
		})
	)
	.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
	.catch(LogMessageOrError);
}

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Danbooru = (text, ctx, url) => {
	SocialParsers.Danbooru(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Gelbooru = (text, ctx, url) => {
	SocialParsers.Gelbooru(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Konachan = (text, ctx, url) => {
	SocialParsers.Konachan(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Yandere = (text, ctx, url) => {
	SocialParsers.Yandere(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Eshuushuu = (text, ctx, url) => {
	SocialParsers.Eshuushuu(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Sankaku = (text, ctx, url) => {
	SocialParsers.Sankaku(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Zerochan = (text, ctx, url) => {
	SocialParsers.Zerochan(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const AnimePictures = (text, ctx, url) => {
	SocialParsers.AnimePictures(url)
	.then((post) => GenericBooruSend(ctx, post.medias[0].externalUrl, text))
	.catch(LogMessageOrError);
};

/**
 * @param {String} text
 * @param {TelegramContext} ctx
 * @param {URL} url
 * @returns {void}
 */
const Joyreactor = (text, ctx, url) => {
	SocialParsers.Joyreactor(url)
	.then((post) => {
		if (!post.medias || !post.medias.length) return;

		const caption = `Отправил ${GetUsername(ctx.from, ADMIN_TELEGRAM_DATA.username, "– ")}`;


		NodeFetch(post.medias[0].externalUrl, {
			headers: {
				"Referer": text
			}
		})
		.then((image) => image.buffer())
		.then((buffer) => {
			ctx.replyWithPhoto({
				source: buffer
			}, {
				caption,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Исходник",
						url: encodeURI(post.medias[0].original)
					},
					{
						text: "Пост",
						url: encodeURI(url.href)
					},
					...GlobalSetLikeButtons(ctx)
				]).reply_markup
			})
			.then(() => telegram.deleteMessage(ctx.chat.id, ctx.message.message_id))
			.catch(LogMessageOrError);
		})
		.catch(LogMessageOrError);
	})
	.catch(LogMessageOrError);
};


process.on("unhandledRejection", (reason, p) => {
	if (DEV) {
		LogMessageOrError("Unhandled Rejection at: Promise", p, "reason:", reason);
	};
});

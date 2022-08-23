const { createReadStream } = require("fs")
const crypto = require("crypto");
const { Telegraf, Markup } = require("telegraf");
const DEV = require("./util/is-dev");
const KhaleesiModule = require("khaleesi-js");
const LogMessageOrError = require("./util/log");
const { GetUsername, LoadCommandDescription, SafeParseURL, PrepareCaption } = require("./util/common");
const { SocialPick, VideoDone } = require("./util/social-picker-api");
const { SaveSpoilers, RestoreSpoilers } = require("./util/store-spoilers");

/** @type {import("./types/config").Config} */
const TELEGRAM_CONFIG = (DEV ? require("./config/telegram.dev.json") : require("./config/telegram.json"));
const {
	BOT_TOKEN,
	BOT_USERNAME,
	CHATS_LIST,
	WHITELIST,
	BLACKLIST,
	SPECIAL_PHRASE,
	SPECIAL_STICKERS_SET,
	LOCAL_BOT_API_SERVER
} = TELEGRAM_CONFIG;

const COMMANDS = {
	"help": LoadCommandDescription("help", TELEGRAM_CONFIG),
	"start": LoadCommandDescription("help", TELEGRAM_CONFIG),
	"aboutpicker": LoadCommandDescription("aboutpicker", TELEGRAM_CONFIG),
	"aboutlist": LoadCommandDescription("aboutlist", TELEGRAM_CONFIG),
	"aboutspoiler": LoadCommandDescription("aboutspoiler", TELEGRAM_CONFIG),
	"khaleesi": (ctx) => Khaleesi(ctx),
	"chebotarb": (ctx) => Chebotarb(ctx),
	"testcommand": `Ну и што ты здесь зобылб?`
};

const telegraf = new Telegraf(BOT_TOKEN, DEV ? {} : {
	telegram: {
		apiRoot: `http://${LOCAL_BOT_API_SERVER.hostname}:${LOCAL_BOT_API_SERVER.port}`
	}
});
const telegram = telegraf.telegram;

/**
 * @typedef {import("telegraf/src/core/types/typegram").Update.New & import("telegraf/src/core/types/typegram").Update.NonChannel & import("telegraf/src/core/types/typegram").Message.NewChatMembersMessage & import("telegraf/src/core/types/typegram").Message.PhotoMessage &  import("telegraf/src/core/types/typegram").Message.VideoMessage &  import("telegraf/src/core/types/typegram").Message.AnimationMessage & import("telegraf/src/core/types/typegram").Message.TextMessage} DefaultMessage
 * @typedef {import("telegraf").NarrowedContext<import("telegraf").Context, { message: DefaultMessage, reply_to_message?: DefaultMessage }>} TelegramContext
 * @typedef {import("telegraf/src/core/types/typegram").User} TelegramFromObject
 */



const botStartedTime = Date.now();

telegraf.on("text", (ctx) => {
	if ((Date.now() - botStartedTime) < 1000 * 15) return;


	const { chat, from, message } = ctx;


	if (chat && chat.type === "private") {
		LogMessageOrError(`Private chat – ${from.first_name} ${from.last_name || ""} (lang: ${from.language_code}) (${from.username ? "@" + from.username : "ID: " + from.id}) – Text: ${message.text}`);

		const { text } = message;
		if (!text) return false;

		if (BLACKLIST.includes(from.username) || BLACKLIST.includes(from.id)) return false;

		const commandMatch = text.match(new RegExp(`^\\/([\\w]+)(\\@${BOT_USERNAME})?$`, "i"));

		if (commandMatch && commandMatch[1]) {
			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).catch(LogMessageOrError);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		}

		return false;
	}


	if (DEV) {
		if (!CHATS_LIST.some((chatFromList) => chatFromList.id === chat.id))
			LogMessageOrError("NEW CHAT!", chat.id, chat.title, chat.type, JSON.stringify(message));
	}


	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat.id) return false;

		const { text } = message;
		if (!text) return false;


		if (new RegExp(`^\\/spoiler(\\@${BOT_USERNAME})?\\b`, "i").test(text))
			return MarkAsSpoiler(ctx, "reply");


		const commandMatch = text.match(new RegExp(`^\\/([\\w]+)\\@${BOT_USERNAME}$`, "i"));

		if (commandMatch && commandMatch[1]) {
			telegram.deleteMessage(chat.id, message.message_id).catch(LogMessageOrError);

			if (!CheckCommandAvailability(from)) return false


			if (typeof COMMANDS[commandMatch[1]] == "string")
				return ctx.reply(COMMANDS[commandMatch[1]], {
					disable_web_page_preview: true,
					parse_mode: "HTML"
				}).catch(LogMessageOrError);
			else if (typeof COMMANDS[commandMatch[1]] == "function")
				return COMMANDS[commandMatch[1]](ctx);
		}


		if (new RegExp(SPECIAL_PHRASE.regexp, "i").test(text.trim())) {
			if (CheckCommandAvailability(from)) {
				if (Math.random() < 0.125) {
					return ctx.reply("<i>…как Орлов, порхай как бабочка!</i>", {
						parse_mode: "HTML",
						reply_to_message_id: message.message_id,
						allow_sending_without_reply: true,
						disable_notification: true
					}).catch(LogMessageOrError);
				} else if (Math.random() < 0.125) {
					if (Math.random() < 0.5)
						return ctx.replyWithSticker(SPECIAL_PHRASE.sticker, {
							reply_to_message_id: message.message_id,
							allow_sending_without_reply: true,
							disable_notification: true
						}).catch(LogMessageOrError);
					else
						return ctx.replyWithAnimation(SPECIAL_PHRASE.gif, {
							reply_to_message_id: message.message_id,
							allow_sending_without_reply: true,
							disable_notification: true
						}).catch(LogMessageOrError);
				}
			}
		}


		CheckMessageForLinks(ctx, message, true);
	});
});

/**
 * @param {"animation" | "photo" | "video"} eventType
 */
const GenericOnPhotoVideoGif = (eventType) => {
	telegraf.on(eventType, (ctx) => {
		if ((Date.now() - botStartedTime) < 1000 * 15) return;

		const { chat, message } = ctx;

		CHATS_LIST.forEach((chatFromList) => {
			if (!chatFromList.enabled) return false;
			if (chatFromList.id !== chat.id) return false;

			if (!(message.caption && message[eventType])) return false;

			if (new RegExp(`^\\/spoiler(\\@${BOT_USERNAME})?\\b`, "i").test(message.caption))
				return MarkAsSpoiler(ctx, "self");

			CheckMessageForLinks(ctx, message, false);
		});
	});
};

GenericOnPhotoVideoGif("animation");
GenericOnPhotoVideoGif("photo");
GenericOnPhotoVideoGif("video");

telegraf.on("new_chat_members", (ctx) => {
	const { message } = ctx;
	if (!message) return LogMessageOrError("No message on new_chat_member!");

	const { chat } = message;

	CHATS_LIST.forEach((chatFromList) => {
		if (!chatFromList.enabled) return false;
		if (chatFromList.id !== chat.id) return false;

		const { welcome } = chatFromList;
		if (!welcome) return false;

		if (welcome.type == "text") {
			ctx.reply(
				welcome.message.replace(
					"__USERNAME__",
					GetUsername(message.new_chat_member || message.new_chat_members[0], "")
				),
				{
					parse_mode: "HTML",
					disable_web_page_preview: true,
					reply_to_message_id: message.message_id,
					allow_sending_without_reply: true,
					disable_notification: true
				}
			).catch(LogMessageOrError);
		} else if (welcome.type == "gif") {
			ctx.replyWithAnimation(
				welcome.message.filename ?
					{ source: createReadStream(welcome.message.filename) }
						:
					welcome.message.file_id,
				{
					caption: welcome.message.caption ? welcome.message.caption.replace("__USERNAME__", GetUsername(message.new_chat_member || message.new_chat_members[0], "")) : "",
					parse_mode: "HTML",
					disable_web_page_preview: true,
					reply_to_message_id: message.message_id,
					allow_sending_without_reply: true,
					disable_notification: true
				}
			).catch(LogMessageOrError);
		}
	});
});

telegraf.launch();



/**
 * @param {TelegramContext} ctx
 */
const Khaleesi = (ctx) => {
	const { message } = ctx;
	if (!message) return;

	const replyingMessage = message.reply_to_message;
	if (!replyingMessage) return;

	const text = replyingMessage.text || replyingMessage.caption;
	if (!text) return;

	const khaleesiedText = KhaleesiModule(text);
	if (!khaleesiedText) return;

	ctx.reply(khaleesiedText, {
		reply_to_message_id: replyingMessage.message_id,
		allow_sending_without_reply: true,
		disable_notification: true
	}).catch(LogMessageOrError);
};

/**
 * @param {TelegramContext} ctx
 */
const Chebotarb = (ctx) => {
	const { message } = ctx;
	if (!message) return;

	const replyingMessage = message.reply_to_message;

	telegram.getStickerSet(SPECIAL_STICKERS_SET).then((stickerSet) => {
		const randomSticker = stickerSet.stickers[Math.floor(Math.random() * stickerSet.stickers.length)];

		return ctx.replyWithSticker(randomSticker.file_id, {
			reply_to_message_id: (replyingMessage ? replyingMessage.message_id : null),
			allow_sending_without_reply: true,
			disable_notification: true
		});
	}).catch(LogMessageOrError);
};

/** @type {{ [userId: number]: number }} */
const COMMANDS_USAGE = {};

/**
 * @param {TelegramFromObject} from
 * @returns {boolean}
 */
const CheckCommandAvailability = (from) => {
	if (from.username && WHITELIST.includes(from.username))
		return true;

	if (BLACKLIST.includes(from.username) || BLACKLIST.includes(from.id))
		return false;


	const lastTimeCalled = COMMANDS_USAGE[from.id];

	if (!lastTimeCalled || (Date.now() - lastTimeCalled) > 1000 * 60 * 15) {
		COMMANDS_USAGE[from.id] = Date.now();
		return true;
	}

	return false;
};



/** @type {import("./types/spoilers").SpoilersStorage} */
const SPOILERS = [];
RestoreSpoilers(SPOILERS).catch(LogMessageOrError);

/**
 * @param {SpoilerTypeEnum} type
 * @param {string} source
 * @param {string} [caption]
 * @returns {string}
 */
const StoreSpoiler = (type, source, caption = "") => {
	const id = crypto.createHash("md5").update(`${SPOILERS.length}_${Date.now()}`).digest("hex");

	SPOILERS.push({
		id,
		type,
		source,
		caption: (typeof caption == "string" ? caption : "")
	});

	SaveSpoilers(SPOILERS);

	return id;
};

telegraf.action(/^SPOILER(\w+)/, (ctx) => {
	const { from } = ctx;

	const LocalFail = () => ctx.answerCbQuery("Картинка настолько ужасная, что я её потерял 😬. Вот растяпа!", true).catch(LogMessageOrError);

	if (!ctx.match?.[1])
		return LocalFail();

	const foundStoredSpoiler = SPOILERS.find((spoiler) => spoiler.id === ctx.match[1]);
	if (!foundStoredSpoiler)
		return LocalFail();

	const argsToSend = [from.id, foundStoredSpoiler.source, { caption: foundStoredSpoiler?.caption || null }];

	const action = (
		foundStoredSpoiler.type === "photo" ? telegram.sendPhoto(...argsToSend) :
		foundStoredSpoiler.type === "animation" ? telegram.sendAnimation(...argsToSend) :
		foundStoredSpoiler.type === "video" ? telegram.sendVideo(...argsToSend) :
		Promise.reject(`Unknown action with spoiler: ${JSON.stringify(foundStoredSpoiler)}`)
	);

	action
	.then(() => ctx.answerCbQuery("Отправил тебе в ЛС!"))
	.catch(/** @param {import("telegraf").TelegramError} e */ (e) => {
		if (e?.code === 403 || e?.response?.error_code === 403)
			ctx.answerCbQuery("Не могу отправить: начни диалог с ботом");
		else
			LogMessageOrError(e);
	});
});

/**
 * @param {TelegramContext} ctx
 * @param {"reply" | "self"} target
 */
const MarkAsSpoiler = (ctx, target) => {
	const { message, from } = ctx;

	if (BLACKLIST.includes(from.username) || BLACKLIST.includes(from.id)) return;


	/**
	 * @param {DefaultMessage} messageToMark
	 * @param {DefaultMessage[]} messagesToDelete
	 * @returns {void}
	 */
	const LocalMarkByMessage = (messageToMark, messagesToDelete) => {
		/** @type {import("./types/spoilers").SpoilerTypeEnum} */
		const spoilerType = (
			messageToMark["photo"] ? "photo" :
			messageToMark["animation"] ? "animation" :
			messageToMark["video"] ? "video" :
			"nothing-to-hide"
		);

		const spoilerSource = (
			spoilerType === "photo" ? messageToMark["photo"]?.pop()?.file_id :
			spoilerType === "animation" ? messageToMark["animation"]?.file_id :
			spoilerType === "video" ? messageToMark["video"]?.file_id :
			""
		);

		if (!spoilerSource)
			return LogMessageOrError(new Error(`No <spoilerSource> to hide in <messageToMark>, <spoilerType> = ${spoilerType}, <messageToMark> = ${JSON.stringify(messageToMark, false, "\t")}`));

		const spoilerId = StoreSpoiler(spoilerType, spoilerSource, messageToMark.caption || "");

		ctx.reply(`Спойлер с ${
			spoilerType === "photo" ? "картинкой" :
			spoilerType === "animation" ? "гифкой" :
			spoilerType === "video" ? "видео" :
			"💩"
		}`, {
			disable_web_page_preview: true,
			parse_mode: "HTML",
			reply_to_message_id: messageToMark.reply_to_message,
			allow_sending_without_reply: true,
			disable_notification: true,
			reply_markup: Markup.inlineKeyboard([
				{
					text: "🖼 Показать 🖼",
					callback_data: `SPOILER${spoilerId}`
				},
				{
					text: "Диалог с ботом",
					url: `https://t.me/${BOT_USERNAME}`
				}
			]).reply_markup
		})
		.then(() => Promise.all(messagesToDelete.map((messageToDelete) =>
			telegram.deleteMessage(messageToDelete.chat.id, messageToDelete.message_id)
		)))
		.catch(LogMessageOrError);
	};


	if (target === "reply") {
		const replyingMessage = message.reply_to_message;
		if (!replyingMessage) return;
		LocalMarkByMessage(replyingMessage, [replyingMessage, message]);
	} else if (target === "self") {
		LocalMarkByMessage(message, [message]);
	}
};




/**
 * Checks whether giver URL can be parser with Social-Picker-API
 *
 * @param {string} givenURL
 * @returns {boolean}
 */
const CheckForLink = (givenURL) => {
	const url = SafeParseURL(givenURL);

	if (
		url.hostname === "twitter.com" ||
		url.hostname === "www.twitter.com" ||
		url.hostname === "mobile.twitter.com" ||
		url.hostname === "nitter.net" ||
		url.hostname === "www.nitter.net" ||
		url.hostname === "mobile.nitter.net"
	)
		return true;
	else if (
		url.hostname === "pbs.twimg.com"
	)
		return true;
	else if (
		url.hostname === "instagram.com" ||
		url.hostname === "www.instagram.com"
	)
		return true;
	else if (
		url.hostname === "reddit.com" ||
		url.hostname === "www.reddit.com" ||
		url.hostname === "old.reddit.com"
	)
		return true;
	else if (
		url.hostname === "pixiv.net" ||
		url.hostname === "www.pixiv.net"
	)
		return true;
	else if (
		/tumblr\.(com|co\.\w+|org)$/i.test(url.hostname || "")
	)
		return true;
	else if (
		url.hostname === "danbooru.donmai.us" ||
		url.origin === "https://danbooru.donmai.us"
	)
		return true;
	else if (
		url.hostname === "gelbooru.com" ||
		url.hostname === "www.gelbooru.com"
	)
		return true;
	else if (
		url.hostname === "konachan.com" ||
		url.hostname === "konachan.net" ||
		url.hostname === "www.konachan.com" ||
		url.hostname === "www.konachan.net"
	)
		return true;
	else if (
		url.hostname === "yande.re" ||
		url.hostname === "www.yande.re"
	)
		return true;
	else if (
		url.hostname === "e-shuushuu.net" ||
		url.hostname === "www.e-shuushuu.net"
	)
		return true;
	else if (
		url.hostname === "chan.sankakucomplex.com" ||
		url.origin === "https://chan.sankakucomplex.com"
	)
		return true;
	else if (
		url.hostname === "zerochan.net" ||
		url.hostname === "www.zerochan.net"
	)
		return true;
	else if (
		url.hostname === "anime-pictures.net" ||
		url.hostname === "www.anime-pictures.net"
	)
		return true;
	else if (
		url.hostname === "kemono.party" ||
		url.hostname === "www.kemono.party" ||
		url.hostname === "beta.kemono.party"
	)
		return true;
	else if (
		url.hostname === "dtf.ru"
	)
		return true;
	else
		return false;
};

/**
 * Checks whole message for links and make post with them
 *
 * @param {TelegramContext} ctx
 * @param {import("telegraf/typings/core/types/typegram").Message} message
 * @param {boolean} [ableToDeleteSource]
 * @returns {void}
 */
const CheckMessageForLinks = (ctx, message, ableToDeleteSource = false) => {
	/** @type {string} */
	const messageText = message.text || message.caption || "";
	/** @type {import("telegraf/typings/core/types/typegram").MessageEntity[]} */
	const messageEntities = message.entities || message.caption_entities || [];

	if (!messageEntities?.length) return;

	const containsOnlyOneLink = (
		messageEntities?.length === 1 &&
		messageEntities[0].type === "url" &&
		messageEntities[0].offset === 0 &&
		messageEntities[0].length === messageText.length
	);

	if (containsOnlyOneLink) {
		const singleLink = messageText;

		if (CheckForLink(singleLink))
			return MakePost({
				ctx,
				givenURL: singleLink,
				deleteSource: ableToDeleteSource
			});
		else
			return;
	}

	/** @type {{ offset: number, length: number, type: "url" }[]} */
	const urlEntities = messageEntities.filter((entity) => entity.type === "url");

	/** @type {string[]} */
	const textURLs = urlEntities.map((entity) =>
		messageText.slice(entity.offset, entity.offset + entity.length)
	);

	const validURLs = textURLs
		.filter((textURL) => CheckForLink(textURL))
		.filter((link, index, array) => index === array.indexOf(link));

	validURLs.forEach((validURL) => MakePost({
		ctx,
		givenURL: validURL,
		deleteSource: false
	}));
};

/**
 * @param {{ ctx: TelegramContext, givenURL: string, deleteSource?: boolean }} param0
 * @returns {void}
 */
const MakePost = ({ ctx, givenURL, deleteSource }) => {
	SocialPick(givenURL)
	.then((socialPost) => {
		/** Post does not contain any media */
		if (!socialPost?.medias?.length) return;


		let caption = `<i>${PrepareCaption(socialPost.caption)}</i>`;

		if (socialPost.medias.length === 1) {
			const media = socialPost.medias[0];

			if (media.type !== "photo" && media.type !== "gif" && media.type !== "video") return;

			/** @type {import("telegraf/typings/core/types/typegram").InputFile} */
			const inputFile = (media.filename ? {
				source: createReadStream(media.filename)
			} : { url: encodeURI(media.externalUrl || media.original) });

			/** @type {import("telegraf/typings/telegram-types").ExtraPhoto | import("telegraf/typings/telegram-types").ExtraAnimation | import("telegraf/typings/telegram-types").ExtraVideo} */
			const extra = {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				caption,
				reply_to_message_id: (deleteSource ? null : ctx.message.message_id),
				allow_sending_without_reply: true,
				disable_notification: true,
				reply_markup: Markup.inlineKeyboard([
					socialPost.postURL ? {
						text: "Пост",
						url: encodeURI(socialPost.postURL)
					} : null,
					socialPost.authorURL ? {
						text: "Автор",
						url: encodeURI(socialPost.authorURL)
					} : null,
					encodeURI(media.original || media.externalUrl || socialPost.postURL) ? {
						text: "Исходник",
						url: encodeURI(media.original || media.externalUrl || socialPost.postURL)
					} : null,
				].filter(button => !!button)).reply_markup
			};

			if (media.type === "video")
				extra.supports_streaming = true;


			const method = (media.type === "video" ? "replyWithVideo" :
							media.type === "gif" ? "replyWithAnimation" :
							"replyWithPhoto");

			ctx[method](inputFile, extra)
			.then(() => {
				if (media.filename) VideoDone(media.filename);

				if (deleteSource)
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				else
					return Promise.resolve(true);
			})
			.catch(LogMessageOrError);
		} else {
			caption += "\nФайлы: " + socialPost.medias.slice(0, 10).map((media, index) => `<a href="${encodeURI(media.original || media.externalUrl || socialPost.postURL)}">${index + 1}</a>`).join(", ");

			if (socialPost.medias.length > 10)
				caption += `\nВсе иллюстраций не вместились, <a href="${encodeURI(socialPost.postURL)}">оригинальный пост</a>`;


			/** @type {Array<import("typegram").InputMediaPhoto | import("typegram").InputMediaVideo> | import("typegram").InputMediaAudio[] | import("typegram").InputMediaDocument[]} */
			const mediaGroupFiles = socialPost.medias.slice(0, 10).map((media) => ({
				media: (media.filename ? {
					source: createReadStream(media.filename)
				} : { url: encodeURI(media.externalUrl || media.original) }),
				type: (media.type === "gif" ? "video" : "photo"),
				supports_streaming: true,
				disable_web_page_preview: true,
				parse_mode: "HTML",
				caption: `<a href="${encodeURI(media.original || media.externalUrl || socialPost.postURL)}">Исходник файла</a>`
			}));

			ctx.replyWithMediaGroup(mediaGroupFiles, {
				reply_to_message_id: (deleteSource ? null : ctx.message.message_id),
				allow_sending_without_reply: true,
				disable_notification: true
			})
			.then((sentMediaGroup) => ctx.reply(caption, {
				disable_web_page_preview: true,
				parse_mode: "HTML",
				reply_to_message_id: sentMediaGroup.message_id,
				allow_sending_without_reply: true,
				disable_notification: true,
				reply_markup: Markup.inlineKeyboard([
					{
						text: "Пост",
						url: encodeURI(socialPost.postURL)
					},
					{
						text: "Автор",
						url: encodeURI(socialPost.authorURL)
					}
				]).reply_markup
			}))
			.then(() => {
				socialPost.medias.forEach((media) => {
					if (media.filename) VideoDone(media.filename);
				});

				if (deleteSource)
					return telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
				else
					return Promise.resolve(true);
			})
			.catch(LogMessageOrError);
		}
	})
	.catch((e) => LogMessageOrError(`Making post ${givenURL}`, e));
};

process.on("unhandledRejection", (reason, promise) => {
	if (!DEV) return;

	LogMessageOrError("Unhandled Rejection at: Promise", promise, "reason:", reason);
});



process.once("SIGINT", () => telegraf.stop("SIGINT"));
process.once("SIGTERM", () => telegraf.stop("SIGTERM"));

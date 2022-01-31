const DEV = require("./is-dev");
const { ADMIN } = (DEV ? require("../config/telegram.dev.json") : require("../config/telegram.json"))
const fsReadFileSync = require("fs").readFileSync;


/**
 * @param {string} iHref
 * @returns {URL}
 */
const SafeParseURL = iHref => {
	try {
		const url = new URL(iHref);
		return url;
	} catch (e) {}

	try {
		const url = new URL(iHref, "https://example.com");
		return url;
	} catch (e) {}

	return new URL("https://example.com");
}

/**
 * Telegram Escape
 * @param {string} iStringToEscape
 * @returns {string}
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
 * Telegram Unescape
 * @param {string} iStringToUnescape
 * @returns {string}
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
 * Prepare caption for Telegram message
 * @param {string} iRawCaption
 * @returns {string}
 */
const PrepareCaption = iRawCaption => {
	if (!iRawCaption) return "";

	const escapedCaption = TGE(TGUE(iRawCaption));

	if (escapedCaption.length <= 150)
		return escapedCaption;

	return escapedCaption.slice(0, 150) + "…";
};

/**
 * @param {import("telegraf/typings/core/types/typegram").User} from
 * @param {string} [prefix="– "]
 * @returns {string}
 */
const GetUsername = (from, prefix = "– ") => {
	if (from.username === ADMIN.username) return TGE("Почтой России");

	return `${TGE(prefix)}<a href="${from.username ? `https://t.me/${from.username}` : `tg://user?id=${from.id}`}">${TGE(from.first_name)}${from.last_name ? " " + TGE(from.last_name) : ""}</a>`;
};

/**
 * @param {string} iCommandName
 * @param {{[configPropName: string]: string | {[subPropName: string]: string}}} iConfig
 * @returns {string}
 */
const LoadCommandDescription = (iCommandName, iConfig) => {
	let commandBuiltWithConfig = fsReadFileSync(`./commands/${iCommandName}.txt`).toString();

	Object.keys(iConfig).forEach((configPropName) => {
		if (typeof iConfig[configPropName] !== "object") {
			commandBuiltWithConfig = commandBuiltWithConfig.replace(
				new RegExp(`\\\${${configPropName}}`, "g"),
				iConfig[configPropName]
			);
		} else {
			Object.keys(iConfig[configPropName]).forEach((subPropName) => {
				if (typeof iConfig[configPropName][subPropName] === "object") return;

				commandBuiltWithConfig = commandBuiltWithConfig.replace(
					new RegExp(`\\\${${configPropName}\\.${subPropName}}`, "g"),
					iConfig[configPropName][subPropName]
				);
			});
		}
	});

	return commandBuiltWithConfig;
}

module.exports = {
	GetUsername,
	LoadCommandDescription,
	SafeParseURL,
	TGE,
	TGUE,
	PrepareCaption
}

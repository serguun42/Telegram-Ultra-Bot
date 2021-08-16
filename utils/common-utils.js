const
	fs = require("fs"),
	{ readFileSync } = fs;


/**
 * @param {String} iQuery
 * @returns {{[queryName: string]: string | true}}
 */
const ParseQuery = iQuery => {
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

/**
 * @param {String} iURL
 * @returns {String}
 */
const GetDomain = iURL => SafeParseURL(iURL).hostname;

/**
 * @param {String} iURLString
 * @returns {URL}
 */
const SafeParseURL = iURLString => {
	try {
		const url = new URL(iURLString);
		return url;
	} catch (e) {}

	try {
		const url = new URL(iURLString, "https://fake-hostname-for-url.com");
		return url;
	} catch (e) {}

	return iURLString;
}

/**
 * @param {Number} iNumber
 * @param {[string, string, string]} iForms
 */
const GetForm = (iNumber, iForms) => {
	iNumber = iNumber.toString();

	if (iNumber.slice(-2)[0] == "1" & iNumber.length > 1) return iForms[2];
	if (iNumber.slice(-1) == "1") return iForms[0];
	else if (/2|3|4/g.test(iNumber.slice(-1))) return iForms[1];
	else if (/5|6|7|8|9|0/g.test(iNumber.slice(-1))) return iForms[2];
};

/**
 * Telegram Escape
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
 * Telegram Unescape
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
 * @param {import("telegraf/typings/core/types/typegram").User} from
 * @param {String} specialUser
 * @param {String} [prefix]
 */
const GetUsername = (from, specialUser, prefix = "") => {
	if (from.username === specialUser) return TGE("Почтой России");

	return `${TGE(prefix)}<a href="${from.username ? `https://t.me/${from.username}` : `tg://user?id=${from.id}`}">${TGE(from.first_name)}${from.last_name ? " " + TGE(from.last_name) : ""}</a>`;
};

/**
 * @param {String} iCommandName
 * @param {{[configPropName: string]: string | {[subPropName: string]: string}}} iConfig
 * @returns {String}
 */
const LoadCommandDescription = (iCommandName, iConfig) => {
	const escapedBase = readFileSync(`./commands/${iCommandName}.txt`).toString();

	let builtWithConfig = escapedBase;
	Object.keys(iConfig).forEach((configPropName) => {
		if (typeof iConfig[configPropName] !== "object") {
			builtWithConfig = builtWithConfig.replace(new RegExp(`\\\${${configPropName}}`, "g"), iConfig[configPropName]);
		} else {
			Object.keys(iConfig[configPropName]).forEach((subPropName) => {
				if (typeof iConfig[configPropName][subPropName] === "object") return;

				builtWithConfig = builtWithConfig.replace(new RegExp(`\\\${${configPropName}\\.${subPropName}}`, "g"), iConfig[configPropName][subPropName]);
			});
		};
	})


	return builtWithConfig;
}

module.exports = {
	ParseQuery,
	SafeParseURL,
	GetDomain,
	GetForm,
	TGE,
	TGUE,
	GetUsername,
	LoadCommandDescription
}

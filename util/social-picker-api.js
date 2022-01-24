const NodeFetch = require("node-fetch").default;
const LogMessageOrError = require("./log");
const DEV = require("./is-dev");

const SOCIAL_PICKER_API_CONFIG = (DEV ?
	require("../config/social-picker-service.dev.json")
		:
	require("../config/social-picker-service.json")
);

const SOCIAL_PICKER_API_BASE = `http${
	SOCIAL_PICKER_API_CONFIG.secure ? "s" : ""
}://${SOCIAL_PICKER_API_CONFIG.hostname}:${SOCIAL_PICKER_API_CONFIG.port}/`;


/**
 * @param {string} givenURL
 * @returns {Promise<import("../types").SocialPost>}
 */
const SocialPick = (givenURL) => {
	return NodeFetch(new URL(`/?url=${encodeURIComponent(givenURL)}`, SOCIAL_PICKER_API_BASE).href)
	.then((res) => {
		if (res.status === 200)
			return res.json();
		else
			return Promise.reject(new Error(`Status code: ${res.status} ${res.statusText}`));
	});
}

/**
 * @param {string} filename
 * @returns {void}
 */
const VideoDone = (filename) => {
	NodeFetch(new URL(`/?video-done=${encodeURIComponent(filename)}`, SOCIAL_PICKER_API_BASE).href)
	.then((res) => {
		if (res.status !== 200)
			return Promise.reject(new Error(`Status code: ${res.status} ${res.statusText}`));
	})
	.catch((e) => LogMessageOrError(`Social-Picker-API / Video done`, e));
}


module.exports = {
	SocialPick,
	VideoDone
}

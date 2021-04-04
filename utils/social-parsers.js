const
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	NodeFetch = require("node-fetch"),
	TwitterModule = require("twitter-lite"),
	GlobalCombineVideo = require("./combine-video"),
	{ SafeParseURL, GetDomain, ParseQuery } = require("./common-utils");


const
	CONFIG = DEV ? require("../animeultrabot.config.mine.json") : require("../animeultrabot.config.json"),
	{
		TWITTER_CONSUMER_KEY,
		TWITTER_CONSUMER_SECRET,
		INSTAGRAM_COOKIE,
		CUSTOM_IMG_VIEWER_SERVICE
	} = CONFIG;



const TwitterUser = new TwitterModule({
	consumer_key: TWITTER_CONSUMER_KEY, // from Twitter
	consumer_secret: TWITTER_CONSUMER_SECRET, // from Twitter
});

let TwitterApp = null;

TwitterUser.getBearerToken().then((response) => {
	TwitterApp = new TwitterModule({
		bearer_token: response.access_token
	});
});



/**
 * @typedef {Object} Media
 * @property {"gif" | "video" | "photo"} type
 * @property {String} externalUrl
 * @property {String} [original]
 * @property {String} [filename]
 * @property {{[otherSourceOriginKey: string]: string}} [otherSources]
 * @property {() => void} [fileCallback]
 * 
 * 
 * @typedef {Object} DefaultSocialPost
 * @property {String} caption
 * @property {String} author
 * @property {String} authorURL
 * @property {String} postURL
 * @property {Media[]} medias
 */


/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Twitter = (url) => {
	if (!(url instanceof URL)) url = new URL(url);
	
	
	let { pathname } = url,
		statusID = 0;

	if (pathname.match(/^\/[\w\d\_]+\/status(es)?\/(\d+)/))
		statusID = pathname.match(/^\/[\w\d\_]+\/status(es)?\/(\d+)/)[2];
	else if (pathname.match(/^\/statuses\/(\d+)/))
		statusID = pathname.match(/^\/statuses\/(\d+)/)[1];
	else if (pathname.match(/^\/i\/web\/status(es)?\/(\d+)/))
		statusID = pathname.match(/^\/i\/web\/status(es)?\/(\d+)/)[2];


	if (!statusID) return resolve({});


	return new Promise((resolve, reject) => {
		TwitterApp.get("statuses/show", {
			id: statusID,
			tweet_mode: "extended"
		})
		.then((tweet) => {
			const MEDIA = tweet["extended_entities"]?.["media"];

			if (!MEDIA) return resolve({});
			if (!MEDIA.length) return resolve({});

			let sendingMessageText = tweet["full_text"];

			tweet["entities"]["urls"].forEach((link) =>
				sendingMessageText = sendingMessageText.replace(new RegExp(link.url, "gi"), link.expanded_url)
			);

			sendingMessageText = sendingMessageText
													.replace(/\b(http(s)?\:\/\/)?t.co\/[\w\d_]+\b$/gi, "")
													.replace(/(\s)+/gi, "$1")
													.trim();


			/** @type {DefaultSocialPost} */
			const socialPost = {
				caption: sendingMessageText,
				postURL: url.href,
				author: tweet["user"]["screen_name"],
				authorURL: `https://twitter.com/${tweet["user"]["screen_name"]}`
			}


			if (MEDIA[0]["type"] === "animated_gif") {
				const variants = MEDIA[0]["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

				if (!variants || !variants.length) return false;

				let best = variants[0];

				variants.forEach((variant) => {
					if (variant.bitrate > best.bitrate)
						best = variant;
				});


				socialPost.medias = [
					{
						type: "gif",
						externalUrl: best["url"]
					}
				];
			} else if (MEDIA[0]["type"] === "video") {
				const variants = MEDIA[0]["video_info"]["variants"].filter(i => (!!i && i.hasOwnProperty("bitrate")));

				if (!variants || !variants.length) return false;

				let best = variants[0];

				variants.forEach((variant) => {
					if (variant.bitrate > best.bitrate)
						best = variant;
				});

				socialPost.medias = [
					{
						type: "video",
						externalUrl: best["url"]
					}
				];
			} else {
				/** @type {Media[]} */
				const sourcesArr = MEDIA.map(/** @return {Media} */ (media) => {
					if (media["type"] === "photo")
						return { type: "photo", externalUrl: media["media_url_https"] + ":orig" };

					return false;
				}).filter(media => !!media);


				socialPost.medias = sourcesArr;
			};


			resolve(socialPost);
		})
		.catch(reject);
	});
};

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Instagram = (url) => {
	const PATH_REGEXP = /^\/p\/([\w\_\-]+)(\/)?$/i;
	if (!PATH_REGEXP.test(url.pathname)) return;


	return NodeFetch(`https://${url.hostname}${url.pathname}?__a=1`, {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"accept-language": "en-US,en;q=0.9,ru;q=0.8",
			"sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
			"sec-ch-ua-mobile": "?0",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "none",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
			"cookie": INSTAGRAM_COOKIE
		},
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": null,
		"method": "GET",
		"mode": "cors"
	})
	.then((res) => {
		if (res.status == 200)
			return res.json();
		else
			return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
	})
	.then((graphData) => {
		const post = graphData?.graphql?.shortcode_media;

		if (!post) return Promise.reject(new Error(`No post in... post: https://${url.hostname}${url.pathname}`));


		/** @type {Media[]} */
		const sourcesArr = post?.edge_sidecar_to_children?.edges.map(/** @returns {Media} */ (edge) => {
			if (!edge.node) return null;

			if (edge.node.is_video && edge.node.video_url)
				return {
					type: "video",
					externalUrl: edge.node.video_url
				};

			return {
				type: "photo",
				externalUrl: edge.node?.display_resources?.sort((prev, next) => prev?.config_width - next?.config_width).pop().src
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
					externalUrl: post.video_url
				});
			} else {
				sourcesArr.push({
					type: "photo",
					externalUrl: post.display_resources?.sort((prev, next) => prev?.config_width - next?.config_width).pop().src
				});
			};
		};


		const caption = post?.edge_media_to_caption?.edges?.[0]?.node?.text || "",
			  author = post?.owner?.username || "",
			  authorURL = `https://instagram.com/${author}`;


		return Promise.resolve({
			caption,
			postURL: `https://${url.hostname}${url.pathname}`,
			author,
			authorURL,
			medias: sourcesArr
		});
	});
};

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Pixiv = (url) => {
	const CHECK_REGEXP = /http(s)?\:\/\/(www\.)?pixiv\.net\/([\w]{2}\/)?artworks\/(\d+)/i;

	let pixivID = "";

	if (CHECK_REGEXP.test(url.href)) {
		pixivID = url.href.match(CHECK_REGEXP)[4];
	} else if (ParseQuery(url.query)["illust_id"])
		pixivID = ParseQuery(url.query)["illust_id"];

	if (!pixivID) return;


	const postURL = `https://www.pixiv.net/en/artworks/${pixivID}`;

	return NodeFetch(postURL).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
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
			return Promise.reject("Cannot parse data from Pixiv", e);
		};


		const post = data?.["illust"]?.[Object.keys(data["illust"])[0]];

		/** @type {Number} */
		const sourcesAmount = post?.["pageCount"];

		/** @type {Media[]} */
		const medias = new Array();

		if (!post) return Promise.resolve({});


		for (let i = 0; i < sourcesAmount; i++) {
			let origFilename = post["urls"]["original"],
				origBasename = origFilename.replace(/\d+\.([\w\d]+)$/i, ""),
				origFiletype = origFilename.match(/\.([\w\d]+)$/i);

			if (origFiletype && origFiletype[1])
				origFiletype = origFiletype[1];
			else
				origFiletype = "png";


			const masterFilename = post["urls"]["regular"];

			medias.push({
				type: "photo",
				externalUrl: encodeURI(masterFilename.replace(/\d+(_master\d+\.[\w\d]+$)/i, i + "$1")),
				original:  CUSTOM_IMG_VIEWER_SERVICE
					.replace(/__LINK__/, encodeURI(origBasename + i + "." + origFiletype))
					.replace(/__HEADERS__/, encodeURIComponent(
						JSON.stringify({ Referer: "http://www.pixiv.net/" })
					))
			});
		};



		return Promise.resolve({
			caption: post["title"] || post["illustTitle"] || post["description"] || post["illustComment"],
			author: post["userId"],
			authorURL: "https://www.pixiv.net/en/users/" + post["userId"],
			postURL,
			medias
		});
	});
}

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Reddit = (url) => {
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


	return new Promise((redditResolve, redditReject) => {
		NodeFetch(postJSON, { headers: DEFAULT_REDDIT_HEADERS }).then((res) => {
			if (res.status == 200)
				return res.json();
			else
				return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
		}).then((redditPostData) => {
			const post = redditPostData[0]?.data?.children?.[0]?.data,
				  caption = post?.title,
				  author = post?.author,
				  authorURL = `https://www.reddit.com/u/${author || "me"}`,
				  isVideo = post?.is_video,
				  isGallery = post?.is_gallery;

			if (!post) return Promise.reject(new Error("No post in .json-data"));


			if (isVideo) {
				const video = post?.secure_media?.reddit_video?.fallback_url,
					  isGif = post?.secure_media?.reddit_video?.is_gif;

				if (!video) return Promise.reject(new Error("Reddit no video"));


				return new Promise((resolve) => {
					if (isGif) return resolve({ url: video });

					if (!post?.secure_media?.reddit_video?.hls_url) return resolve({ url: video });

					const hslPlaylist = post.secure_media.reddit_video.hls_url;

					return NodeFetch(hslPlaylist, {
						headers: {
							...DEFAULT_REDDIT_HEADERS,
							host: GetDomain(hslPlaylist)
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
								host: GetDomain(hslPlaylist)
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
							.then(({ filename, onDoneCallback }) => {
								if (filename)
									resolve({ filename, onDoneCallback, audioSource: audio });
								else
									resolve({ url: video })
							})
							.catch(() => resolve({ url: video }));
					}).catch(() => resolve({ url: video }));
				}).then(
					/** @param {{url?: String, filename?: String, onDoneCallback?: () => void, audioSource?: string}} */
					({ url, filename, onDoneCallback, audioSource }) => {
						/** @type {Media[]} */
						const videoSources = [];

						if (url) 
							videoSources.push({
								externalUrl: url,
								type: isGif ? "gif" : "video"
							})
						else if (filename)
							videoSources.push({
								externalUrl: video,
								type: isGif & !audioSource ? "gif" : "video",
								otherSources: {
									audio: audioSource
								},
								filename: filename,
								fileCallback: onDoneCallback
							})

						
						return redditResolve({
							author,
							authorURL,
							postURL,
							caption,
							medias: videoSources
						});
					}
				);
			} else {
				if (isGallery) {
					/** @type {Media[]} */
					const galleryMedias = (post?.gallery_data?.items || [])
						.map(/** @return {Media} */ (item) => {
							const isGalleryMediaGif = !!post?.media_metadata?.[item.media_id]?.s?.gif;

							if (isGalleryMediaGif)
								return {
									type: "gif",
									externalUrl: post?.media_metadata?.[item.media_id]?.s?.gif
								};

							try {
								const previewUrl = SafeParseURL(post?.media_metadata?.[item.media_id]?.s?.u);

								return {
									type: "photo",
									externalUrl: `https://${previewUrl.hostname.replace(/^preview\./i, "i.")}${previewUrl.pathname}`
								};
							} catch (e) {
								return false;
							};
						})
						.filter((galleryMedia) => !!galleryMedia);

					redditResolve({
						author,
						authorURL,
						postURL,
						caption,
						medias: galleryMedias
					})
				} else {
					const imageURL = post?.url;

					redditResolve({
						author,
						authorURL,
						postURL,
						caption,
						medias: imageURL ? [{
							type: "photo",
							externalUrl: imageURL
						}] : []
					})
				};
			};
		}).catch(redditReject);
	})
}

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Danbooru = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
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
		return Promise.reject("Error on parsing Danbooru", e);
	};


	if (!source) return Promise.reject(new Error("No Danbooru source"));


	let sourceUUID = source.match(/([\d\w]{10,})/i)[0],
		extension = source.match(/\.([\d\w]+)$/i)[0];


	if (!sourceUUID || !extension) return Promise.reject(new Error("No UUID source"));

	source = "https://danbooru.donmai.us/data/" + sourceUUID + extension;

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Gelbooru = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((gelbooruPage) => {
	let source = "";

	try {
		source = gelbooruPage
							.split("</head")[0]
							.match(/<meta\s+(name|property)="og\:image"\s+content="([^"]+)"/i);

		if (source) source = source[2];
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing Gelbooru", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Gelbooru source", url.href]));
	
	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Konachan = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((konachanPage) => {
	let source = "";

	try {
		source = konachanPage
							.split("<body")[1]
							.match(/<a(\s+[\w\d\-]+\="([^"]+)")*\s+href="([^"]+)"(\s+[\w\d\-]+\="([^"]+)")*\s+id="highres"(\s+[\w\d\-]+\="([^"]+)")*/i);

		if (source) source = source[3];
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing Konachan", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Konachan source", url.href]));

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Yandere = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((yanderePage) => {
	let source = "";

	try {
		source = yanderePage
							.split("<body")[1]
							.match(/<a\s+class="[^"]+"\s+id="highres"\s+href="([^"]+)"/i);

		if (source) source = source[1];
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing Yandere", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Yandere source", url.href]));

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Eshuushuu = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((eshuushuuPage) => {
	let source = "";

	try {
		source = eshuushuuPage
							.split("<body")[1]
							.match(/<a\s+class="thumb_image"\s+href="([^"]+)"/i);

		if (source && source[1]) source = "https://e-shuushuu.net/" + source[1].replace(/\/\//g, "/").replace(/^\//g, "");
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing Eshuushuu", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Eshuushuu source", url.href]));

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Sankaku = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((sankakuPage) => {
	let source = "";

	try {
		source = sankakuPage
							.split("<body")[1]
							.match(/<a\s+href="([^"]+)"\s+id=(")?highres/i);

		if (source && source[1]) source = source[1].replace(/&amp;/g, "&");
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing Sankaku", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Sankaku source", url.href]));
	if (source.slice(0, 6) !== "https:") source = "https:" + source

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Zerochan = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
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
		return Promise.reject(new Error(["Error on parsing Zerochan", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No Zerochan source", url.href]));


	let sourceBasename = source.replace(/\.[\w\d]+$/, ""),
		basenameMatch = zerochanPage.match(new RegExp(sourceBasename + ".[\\w\\d]+", "gi"));

	if (basenameMatch && basenameMatch.pop) source = basenameMatch.pop();
	
	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const AnimePictures = (url) => NodeFetch(url.href)
.then((res) => {
	if (res.status == 200)
		return res.text();
	else
		return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
}).then((animePicturesPage) => {
	let source = "";

	try {
		source = animePicturesPage
							.split("<body")[1]
							.match(/<a\s+href="([^"]+)"\s+title="[^"]+"\s+itemprop="contentURL"/i);

		if (source && source[1]) source = source[1];
	} catch (e) {
		return Promise.reject(new Error(["Error on parsing AnimePictures", url.href, e]));
	};

	if (!source) return Promise.reject(new Error(["No AnimePictures source", url.href]));

	let imglink = SafeParseURL(source);
	if (imglink.hostname === "fake-hostname-for-url.com") source = "https://anime-pictures.net" + source;

	return Promise.resolve({
		author: "",
		authorURL: "",
		postURL: url.href,
		caption: "",
		medias: [{
			type: "photo",
			externalUrl: source
		}]
	})
});

/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
const Joyreactor = (url) => {
	if (!(/^\/post\/\d+/.test(url.pathname))) return;


	return NodeFetch(url.href).then((res) => {
		if (res.status == 200)
			return res.text();
		else
			return Promise.reject(new Error(`Status code = ${res.status} ${res.statusText}`));
	}).then((joyreactorPage) => {
		let source = "";

		try {
			source = joyreactorPage
								.split("<body")[1]
								.match(/<a\s+href="([^"]+)"\s+class="prettyPhotoLink/i);

			if (source && source[1]) source = source[1];
		} catch (e) {
			return Promise.reject("Error on parsing Joyreactor", e);
		};

		if (!source) return Promise.reject(new Error("No Joyreactor source"));

		return Promise.resolve({
			caption: "",
			author: "",
			authorURL: "",
			postURL: url.href,
			medias: [{
				externalUrl: source,
				original: CUSTOM_IMG_VIEWER_SERVICE
								.replace(/__LINK__/, source)
								.replace(/__HEADERS__/, JSON.stringify({ "Referer": url.href })),
				type: "photo"
			}]
		});
	});
};




const SocialParsers = {
	Twitter,
	Instagram,
	Pixiv,
	Reddit,
	Danbooru,
	Gelbooru,
	Konachan,
	Yandere,
	Eshuushuu,
	Sankaku,
	Zerochan,
	AnimePictures,
	Joyreactor
};

module.exports = exports = SocialParsers;

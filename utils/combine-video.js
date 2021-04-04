const 
	DEV = require("os").platform() === "win32" || process.argv[2] === "DEV",
	NodeFetch = require("node-fetch"),
	LogMessageOrError = require("./log"),
	path = require("path"),
	fs = require("fs"),
	{ createWriteStream } = fs,
	{ promisify } = require("util"),
	{ pipeline } = require("stream"),
	streamPipeline = promisify(pipeline),
	ffmpeg = require("ffmpeg"),
	TEMP_FOLDER = DEV ? process.env["TEMP"] : "/tmp/";


/**
 * @param {String} video
 * @param {String} audio
 * @returns {Promise<{ url?: string, filename?: string, onDoneCallback?: () => void }>}
 */
const GlobalCombineVideo = (video, audio) => {
	if (!video) return Promise.reject("No video URL");
	if (!audio) return Promise.resolve({ url: video });


	const videoBaseFilename = video.replace(/[^\d\w]+/gi, "") + Date.now(),
		  videoFilename = path.resolve(TEMP_FOLDER, `${videoBaseFilename}_video`),
		  videoFiletype = video.replace(/\?.*$/, "").match(/\.(\w+)$/)?.[1] || "mp4",
		  audioFilename = path.resolve(TEMP_FOLDER, `${videoBaseFilename}_audio`),
		  outFilename = path.resolve(TEMP_FOLDER, `${video.replace(/[^\d\w]+/gi, "") + Date.now()}_out.${videoFiletype}`);


	const LocalDeleteTempFiles = (iNotifyOnError = true) => {
		fs.unlink(videoFilename, (e) => e && iNotifyOnError && LogMessageOrError(e));
		fs.unlink(audioFilename, (e) => e && iNotifyOnError && LogMessageOrError(e));
		fs.unlink(outFilename, (e) => e && iNotifyOnError && LogMessageOrError(e));
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
		LocalDeleteTempFiles(false);
		return Promise.resolve({ url: video });
	});
};

module.exports = GlobalCombineVideo;

const { stat, rm, mkdir, writeFile, readFile } = require("fs").promises;
const { join } = require("path");
const LogMessageOrError = require("./log");

const SPOILERS_DATABASE_LOCATION = join(process.cwd(), "database");
const SPOILERS_DATABASE_FILENAME = "spoilers.json";
const SPOILERS_DATABASE = join(SPOILERS_DATABASE_LOCATION, SPOILERS_DATABASE_FILENAME);

/** @returns {Promise<void>} */
const CheckAndPrepare = () => stat(SPOILERS_DATABASE)
	.then((stats) => {
		if (stats.isFile()) return Promise.resolve();
		
		return rm(SPOILERS_DATABASE, { recursive: true });
	}).catch(() =>
		stat(SPOILERS_DATABASE_LOCATION)
		.then((stats) => {
			if (stats.isDirectory()) return Promise.resolve();

			return rm(SPOILERS_DATABASE_LOCATION, { recursive: true })
			.then(() => mkdir(SPOILERS_DATABASE_LOCATION));
		})
	);

/**
 * @param {import("../types/spoilers").SpoilersStorage} spoilerStorage
 * @returns {Promise<void>}
 */
const SaveSpoilers = (spoilerStorage) => CheckAndPrepare()
	.then(() => writeFile(SPOILERS_DATABASE, JSON.stringify(spoilerStorage)))
	.catch((e) => {
		LogMessageOrError(e);
		return Promise.resolve();
	});

/**
 * @param {import("../types/spoilers").SpoilersStorage} [spoilerStorageTarget]
 * @returns {Promise<import("../types/spoilers").SpoilersStorage>}
 */
const RestoreSpoilers = (spoilerStorageTarget) => CheckAndPrepare()
	.then(() => readFile(SPOILERS_DATABASE))
	.then((restoredBuffer) => {
		/** @type {import("../types/spoilers").SpoilersStorage} */
		const restoredStorage = JSON.parse(restoredBuffer.toString());
		if (!Array.isArray(restoredStorage))
			return Promise.reject(new Error("Restored spoilers is not an array"));

		if (spoilerStorageTarget)
			restoredStorage.forEach((entry) => spoilerStorageTarget.push(entry));

		return Promise.resolve(restoredStorage);
	})
	.catch((e) => {
		LogMessageOrError("Cannot restore from spoiler dump file", e);
		return Promise.resolve([]);
	});

module.exports = {
	SaveSpoilers,
	RestoreSpoilers
};

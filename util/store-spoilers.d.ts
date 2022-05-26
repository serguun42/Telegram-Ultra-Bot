/**
 * @param {import("../types/spoilers").SpoilersStorage} spoilerStorage
 * @returns {Promise<void>}
 */
export function SaveSpoilers(spoilerStorage: import("../types/spoilers").SpoilersStorage): Promise<void>;
/**
 * @param {import("../types/spoilers").SpoilersStorage} [spoilerStorageTarget]
 * @returns {Promise<import("../types/spoilers").SpoilersStorage>}
 */
export function RestoreSpoilers(
	spoilerStorageTarget?: import("../types/spoilers").SpoilersStorage
): Promise<import("../types/spoilers").SpoilersStorage>;

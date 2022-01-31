/**
 * @param {import("telegraf/typings/core/types/typegram").User} from
 * @param {string} [prefix="– "]
 * @returns {string}
 */
export function GetUsername(from: import("telegraf/typings/core/types/typegram").User, prefix?: string): string;
/**
 * @param {string} iCommandName
 * @param {{[configPropName: string]: string | {[subPropName: string]: string}}} iConfig
 * @returns {string}
 */
export function LoadCommandDescription(iCommandName: string, iConfig: {
    [configPropName: string]: string | {
        [subPropName: string]: string;
    };
}): string;
/**
 * @param {string} iHref
 * @returns {URL}
 */
export function SafeParseURL(iHref: string): URL;
/**
 * Telegram Escape
 * @param {string} iStringToEscape
 * @returns {string}
 */
export function TGE(iStringToEscape: string): string;
/**
 * Telegram Unescape
 * @param {string} iStringToUnescape
 * @returns {string}
 */
export function TGUE(iStringToUnescape: string): string;
/**
 * Prepare caption for Telegram message
 * @param {string} iRawCaption
 * @returns {string}
 */
export function PrepareCaption(iRawCaption: string): string;

/**
 * @param {String} iQuery
 * @returns {{[queryName: string]: string | true}}
 */
export function ParseQuery(iQuery: string): {
    [queryName: string]: string | true;
};
/**
 * @param {String} iURLString
 * @returns {URL}
 */
export function SafeParseURL(iURLString: string): URL;
/**
 * @param {String} iURL
 * @returns {String}
 */
export function GetDomain(iURL: string): string;
/**
 * @param {Number} iNumber
 * @param {[string, string, string]} iForms
 */
export function GetForm(iNumber: number, iForms: [string, string, string]): string;
/**
 * Telegram Escape
 * @param {String} iStringToEscape
 * @returns {String}
 */
export function TGE(iStringToEscape: string): string;
/**
 * Telegram Unescape
 * @param {String} iStringToUnescape
 * @returns {String}
 */
export function TGUE(iStringToUnescape: string): string;
/**
 * @param {import("telegraf/typings/core/types/typegram").User} from
 * @param {String} specialUser
 * @param {String} [prefix]
 */
export function GetUsername(from: import("telegraf/typings/core/types/typegram").User, specialUser: string, prefix?: string): string;
/**
 * @param {String} iCommandName
 * @param {{[configPropName: string]: string | {[subPropName: string]: string}}} iConfig
 * @returns {String}
 */
export function LoadCommandDescription(iCommandName: string, iConfig: {
    [configPropName: string]: string | {
        [subPropName: string]: string;
    };
}): string;

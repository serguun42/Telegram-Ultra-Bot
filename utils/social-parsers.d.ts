export type Media = {
    type: "gif" | "video" | "photo";
    externalUrl: string;
    original?: string;
    filename?: string;
    otherSources?: {
        [otherSourceOriginKey: string]: string;
    };
    fileCallback?: () => void;
};
export type DefaultSocialPost = {
    caption: string;
    author: string;
    authorURL: string;
    postURL: string;
    medias: Media[];
};
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
export function Twitter(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Instagram(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Pixiv(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Reddit(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Tumblr(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Danbooru(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Gelbooru(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Konachan(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Yandere(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Eshuushuu(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Sankaku(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Zerochan(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function AnimePictures(url: URL): Promise<DefaultSocialPost>;
/**
 * @param {URL} url
 * @returns {Promise<DefaultSocialPost>}
 */
export function Joyreactor(url: URL): Promise<DefaultSocialPost>;

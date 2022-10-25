import { SafeParseURL } from './common.js';
import MakePost from './make-post.js';

/**
 * Checks whether giver URL can be parser with Social-Picker-API
 *
 * @param {string} givenURL
 * @returns {boolean}
 */
const CheckForLink = (givenURL) => {
  const url = SafeParseURL(givenURL);

  if (
    url.hostname === 'twitter.com' ||
    url.hostname === 'www.twitter.com' ||
    url.hostname === 'mobile.twitter.com' ||
    url.hostname === 'nitter.net' ||
    url.hostname === 'www.nitter.net' ||
    url.hostname === 'mobile.nitter.net'
  )
    return true;
  if (url.hostname === 'pbs.twimg.com' || url.hostname === 'video.twimg.com') return true;
  if (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com') return true;
  if (
    url.hostname === 'reddit.com' ||
    url.hostname === 'www.reddit.com' ||
    url.hostname === 'old.reddit.com' ||
    url.hostname === 'redd.it'
  )
    return true;
  if (url.hostname === 'pixiv.net' || url.hostname === 'www.pixiv.net') return true;
  if (url.hostname === 'i.pximg.net') return true;
  if (/tumblr\.(com|co\.\w+|org)$/i.test(url.hostname || '')) return true;
  if (url.hostname === 'danbooru.donmai.us') return true;
  if (url.hostname === 'gelbooru.com' || url.hostname === 'www.gelbooru.com') return true;
  if (
    url.hostname === 'konachan.com' ||
    url.hostname === 'konachan.net' ||
    url.hostname === 'www.konachan.com' ||
    url.hostname === 'www.konachan.net'
  )
    return true;
  if (url.hostname === 'yande.re' || url.hostname === 'www.yande.re') return true;
  if (url.hostname === 'e-shuushuu.net' || url.hostname === 'www.e-shuushuu.net') return true;
  if (url.hostname === 'chan.sankakucomplex.com') return true;
  if (url.hostname === 'zerochan.net' || url.hostname === 'www.zerochan.net') return true;
  if (url.hostname === 'anime-pictures.net' || url.hostname === 'www.anime-pictures.net') return true;
  if (url.hostname === 'kemono.party' || url.hostname === 'www.kemono.party' || url.hostname === 'beta.kemono.party')
    return true;
  if (url.hostname === 'dtf.ru') return true;
  return false;
};

/**
 * Checks whole message for links and make post with them
 *
 * @param {import('../types/telegraf').TelegramContext} ctx
 * @param {import("telegraf/typings/core/types/typegram").Message} message
 * @param {boolean} [ableToDeleteSource]
 * @returns {void}
 */
const CheckMessageForLinks = (ctx, message, ableToDeleteSource = false) => {
  /** @type {string} */
  const messageText = message.text || message.caption || '';
  /** @type {import("telegraf/typings/core/types/typegram").MessageEntity[]} */
  const messageEntities = message.entities || message.caption_entities || [];

  if (!messageEntities?.length) return;

  const containsOnlyOneLink =
    messageEntities?.length === 1 &&
    messageEntities[0].type === 'url' &&
    messageEntities[0].offset === 0 &&
    messageEntities[0].length === messageText.length;

  if (containsOnlyOneLink) {
    const singleLink = messageText;

    if (CheckForLink(singleLink))
      MakePost({
        ctx,
        givenURL: singleLink,
        deleteSource: ableToDeleteSource,
      });

    return;
  }

  /** @type {{ offset: number, length: number, type: "url" }[]} */
  const urlEntities = messageEntities.filter((entity) => entity.type === 'url');

  /** @type {string[]} */
  const textURLs = urlEntities.map((entity) => messageText.slice(entity.offset, entity.offset + entity.length));

  const validURLs = textURLs
    .filter((textURL) => CheckForLink(textURL))
    .filter((link, index, array) => index === array.indexOf(link));

  validURLs.forEach((validURL) =>
    MakePost({
      ctx,
      givenURL: validURL,
      deleteSource: false,
    })
  );
};

export default CheckMessageForLinks;

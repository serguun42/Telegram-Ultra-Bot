import { SafeParseURL } from './common.js';
import MakePost from './make-post.js';

/**
 * @typedef {object} CheckedLink
 * @property {boolean} status
 * @property {string} platform
 * @property {URL} url
 * @property {boolean} [preHidden]
 */
/**
 * @param {string} givenURL
 * @returns {CheckedLink}
 */
const CheckForLink = (givenURL) => {
  const url = SafeParseURL(givenURL);

  if (
    url.hostname === 'twitter.com' ||
    url.hostname === 'www.twitter.com' ||
    url.hostname === 'mobile.twitter.com' ||
    url.hostname === 'x.com' ||
    url.hostname === 'www.x.com' ||
    url.hostname === 'mobile.x.com' ||
    url.hostname === 'nitter.net' ||
    url.hostname === 'www.nitter.net' ||
    url.hostname === 'mobile.nitter.net' ||
    url.hostname === 'vxtwitter.com' ||
    url.hostname === 'fxtwitter.com'
  )
    return { status: true, platform: 'Twitter', url };
  if (url.hostname === 'pbs.twimg.com' || url.hostname === 'video.twimg.com')
    return { status: true, platform: 'TwitterDirect', url };
  if (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com')
    return { status: true, platform: 'Instagram', url };
  if (
    url.hostname === 'reddit.com' ||
    url.hostname === 'www.reddit.com' ||
    url.hostname === 'old.reddit.com' ||
    url.hostname === 'redd.it'
  )
    return { status: true, platform: 'Reddit', url };
  if (url.hostname === 'pixiv.net' || url.hostname === 'www.pixiv.net') return { status: true, platform: 'Pixiv', url };
  if (url.hostname === 'i.pximg.net') return { status: true, platform: 'PixivDirect', url };
  if (/tumblr\.(com|co\.\w+|org)$/i.test(url.hostname || '')) return { status: true, platform: 'Tumblr', url };
  if (url.hostname === 'danbooru.donmai.us') return { status: true, platform: 'Danbooru', url };
  if (url.hostname === 'gelbooru.com' || url.hostname === 'www.gelbooru.com')
    return { status: true, platform: 'Gelbooru', url };
  if (
    url.hostname === 'konachan.com' ||
    url.hostname === 'konachan.net' ||
    url.hostname === 'www.konachan.com' ||
    url.hostname === 'www.konachan.net'
  )
    return { status: true, platform: 'Konachan', url };
  if (url.hostname === 'yande.re' || url.hostname === 'www.yande.re') return { status: true, platform: 'Yandere', url };
  if (url.hostname === 'e-shuushuu.net' || url.hostname === 'www.e-shuushuu.net')
    return { status: true, platform: 'Eshuushuu', url };
  if (url.hostname === 'chan.sankakucomplex.com') return { status: true, platform: 'Sankaku', url };
  if (url.hostname === 'zerochan.net' || url.hostname === 'www.zerochan.net')
    return { status: true, platform: 'Zerochan', url };
  if (url.hostname === 'anime-pictures.net' || url.hostname === 'www.anime-pictures.net')
    return { status: true, platform: 'AnimePictures', url };
  if (url.hostname === 'kemono.party' || url.hostname === 'www.kemono.party' || url.hostname === 'beta.kemono.party')
    return { status: true, platform: 'KemonoParty', url };
  if (
    url.hostname === 'youtube.com' ||
    url.hostname === 'www.youtube.com' ||
    url.hostname === 'youtu.be' ||
    url.hostname === 'm.youtube.com'
  )
    return { status: true, platform: 'Youtube', url };
  if (url.hostname === 'dtf.ru' || url.hostname === 'vc.ru') return { status: true, platform: 'Osnova', url };
  if (/^(m\.|img\d+\.)?(joy|safe|anime\.|porn|fap)?reactor\.(cc|com)$/.test(url.hostname))
    return { status: true, platform: 'Joyreactor', url };
  if (url.hostname === 'coub.com') return { status: true, platform: 'Coub', url };
  if (/(\w+\.)?tiktok\.com$/.test(url.hostname)) return { status: true, platform: 'Tiktok', url };

  return { status: false, platform: '', url };
};

/**
 * Checks whole message for links and make post with them
 *
 * @param {import('../types/telegraf').DefaultContext} ctx
 * @param {import("telegraf/typings/core/types/typegram").Message} message
 * @param {boolean} [ableToDeleteSource]
 * @returns {void}
 */
const CheckMessageForLinks = (ctx, message, ableToDeleteSource = false) => {
  const textMessage = 'text' in message;
  const mediaMessage = 'caption' in message;
  const messageText = (textMessage ? message.text : mediaMessage ? message.caption : '').trim();
  const messageEntities = textMessage ? message.entities : mediaMessage ? message.caption_entities : [];

  if (!messageEntities?.length) return;

  const urlEntities = messageEntities.filter((entity) => entity.type === 'url');
  const checkedLinks = urlEntities
    .map((urlEntity) => {
      const urlText = messageText.slice(urlEntity.offset, urlEntity.offset + urlEntity.length);

      const checkedLink = CheckForLink(urlText);

      const spoilerExistAtSameOffsets =
        messageEntities.findIndex(
          (comparing) =>
            comparing.type === 'spoiler' &&
            comparing.offset === urlEntity.offset &&
            comparing.length === urlEntity.length
        ) > -1;
      if (spoilerExistAtSameOffsets) checkedLink.preHidden = true;

      return checkedLink;
    })
    .filter((checkedLink) => checkedLink?.status && checkedLink.url?.href)
    .filter((link, index, array) => index === array.findIndex((comparing) => comparing.url?.href === link.url?.href));

  const containsOneAndOnlyLink =
    messageEntities.length === 1 &&
    messageEntities[0].type === 'url' &&
    messageEntities[0].offset === 0 &&
    messageEntities[0].length === messageText.length;

  const containsOneAndOnlyLinkAsSpoiler =
    messageEntities.length === 2 &&
    messageEntities[0].type === 'url' &&
    messageEntities[0].offset === 0 &&
    messageEntities[0].length === messageText.length &&
    messageEntities[1].type === 'spoiler' &&
    messageEntities[1].offset === 0 &&
    messageEntities[1].length === messageText.length;

  checkedLinks.forEach((checkedLink) =>
    MakePost(ctx, checkedLink, ableToDeleteSource && (containsOneAndOnlyLink || containsOneAndOnlyLinkAsSpoiler))
  );
};

export default CheckMessageForLinks;

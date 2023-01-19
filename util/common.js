/**
 * @param {string} link
 * @returns {URL}
 */
export const SafeParseURL = (link) => {
  try {
    const url = new URL(link);
    return url;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  try {
    const url = new URL(link, 'https://example.com');
    return url;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  return new URL('https://example.com');
};

/**
 * Telegram Escape
 * @param {string} stringToEscape
 * @returns {string}
 */
export const TGE = (stringToEscape) => {
  if (!stringToEscape) return '';

  if (typeof stringToEscape === 'string')
    return stringToEscape.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return TGE(stringToEscape.toString());
};

/**
 * Telegram Unescape
 * @param {string} stringToUnescape
 * @returns {string}
 */
export const TGUE = (stringToUnescape) => {
  if (!stringToUnescape) return '';

  if (typeof stringToUnescape === 'string')
    return stringToUnescape
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

  return TGUE(stringToUnescape.toString());
};

/**
 * Prepare caption for Telegram message
 * @param {string} rawCaption
 * @returns {string}
 */
export const PrepareCaption = (rawCaption) => {
  if (!rawCaption) return '';

  const escapedCaption = TGE(TGUE(rawCaption));

  if (escapedCaption.length <= 150) return escapedCaption;

  return `${escapedCaption.slice(0, 150)}…`;
};

/**
 * @param {import('../types/telegraf').DefaultFrom} from
 * @returns {string}
 */
export const GetUsername = (from) => {
  return `<a href="${from.username ? `https://t.me/${from.username}` : `tg://user?id=${from.id}`}">${TGE(
    from.first_name
  )}${from.last_name ? ` ${TGE(from.last_name)}` : ''}</a>`;
};

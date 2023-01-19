import { MarkSpoiler } from '../util/marking-posts.js';

/**
 * @param {import('../types/telegraf').DefaultContext} ctx
 * @returns {void}
 */
const SpoilerCommand = (ctx) => MarkSpoiler(ctx);

export default SpoilerCommand;

import { TelegramError } from 'telegraf';
import LogMessageOrError from './log.js';

const SECOND = 1000;
const QUEUE_STEP = SECOND * 2;
let queueSize = 0;

/**
 * @typedef {() => Promise<any>} Action
 */
/**
 * @param {Action} action
 * @param {number} [timeout]
 * @returns {Promise<any>}
 */
const AddToQueue = (action, timeout) =>
  new Promise((resolve, reject) => {
    if (queueSize < 0) queueSize = 0;
    const currentActionTimeout = (timeout || 0) + QUEUE_STEP * queueSize++;

    setTimeout(
      () =>
        action()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            --queueSize;
          }),
      currentActionTimeout
    );
  });

/**
 * Queues requests to Telegram, handles some errors
 * @param {Action} action
 * @param {number} [presetTimeout]
 * @param {number} [recursionLevel]
 * @returns {Promise<any>}
 */
const SendingWrapper = (action, presetTimeout = 0, recursionLevel = 0) => {
  if (!action || !(action instanceof Function)) return Promise.resolve();

  return AddToQueue(action, presetTimeout).catch(
    /** @param {Error} e */ (e) => {
      if (recursionLevel > 3) return Promise.reject(e);

      if (e instanceof TelegramError) {
        if (e.code === 429) {
          const newTimeout = (e.response?.parameters?.retry_after || 30) * SECOND;

          LogMessageOrError(`Telegram error: response 429, waiting for ${newTimeout / SECOND} seconds`);

          return SendingWrapper(action, newTimeout, recursionLevel + 1);
        }

        return Promise.reject(e);
      }

      return Promise.reject(e);
    }
  );
};

export default SendingWrapper;

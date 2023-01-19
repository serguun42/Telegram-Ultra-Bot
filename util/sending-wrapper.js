import LogMessageOrError from './log.js';

const SECOND = 1000;
const QUEUE_STEP = SECOND * 2;
let queueSize = 0;

/**
 * @template T
 * @typedef {() => Promise<T>} Action<T>
 */
/**
 * @template T
 * @param {Action<T>} action
 * @param {number} [timeout]
 * @returns {Promise<T>}
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
 * @template T
 * @param {Action<T>} action
 * @param {number} [presetTimeout]
 * @param {number} [recursionLevel]
 * @returns {Promise<T>}
 */
const SendingWrapper = (action, presetTimeout = 0, recursionLevel = 0) => {
  if (!action || !(action instanceof Function)) return Promise.resolve();

  return AddToQueue(action, presetTimeout).catch(
    /** @param {Error | import('telegraf').TelegramError} e */ (e) => {
      if (recursionLevel > 3) return Promise.reject(e);
      if (!e)
        return Promise.reject(
          new Error(
            `SendingWrapper: null error for action ${action}, \
presetTimeout ${presetTimeout}, recursionLevel ${recursionLevel}`
          )
        );

      if ('code' in e && e.code === 429) {
        const newTimeout = (e.response?.parameters?.retry_after || 30) * SECOND;

        LogMessageOrError(`Telegram error: response 429, waiting for ${newTimeout / SECOND} seconds`);

        return SendingWrapper(action, newTimeout, recursionLevel + 1);
      }

      return Promise.reject(e);
    }
  );
};

export default SendingWrapper;

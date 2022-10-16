import { TelegramError } from 'telegraf';
import LogMessageOrError from './log.js';

/**
 * Queues requests to Telegram, handles some errors
 * @template T
 * @param {() => Promise<T>} action
 * @param {number} [level]
 * @returns {Promise<T>}
 */
const SendingWrapper = (action, level = 0) => {
  if (!action || !(action instanceof Function)) return Promise.resolve();

  return action().catch(
    /** @param {Error} e */ (e) => {
      if (level > 2) return Promise.reject(e);

      if (e instanceof TelegramError) {
        if (e.code === 429) {
          LogMessageOrError(
            new Error(`Telegram: response 429, waiting for ${e.response?.parameters?.retry_after || 30} seconds`)
          );

          return new Promise((resolve, reject) => {
            setTimeout(
              () =>
                SendingWrapper(action, level + 1)
                  .then(resolve)
                  .catch(reject),
              (e.response?.parameters?.retry_after || 30) * 1000
            );
          });
        }

        return Promise.reject(e);
      }

      return Promise.reject(e);
    }
  );
};

export default SendingWrapper;

import fetch from 'node-fetch';
import LogMessageOrError from './log.js';
import { LoadSocialPickerConfig } from './load-configs.js';

const SOCIAL_PICKER_CONFIG = LoadSocialPickerConfig();
const SOCIAL_PICKER_API_BASE = `http${SOCIAL_PICKER_CONFIG.secure ? 's' : ''}://${SOCIAL_PICKER_CONFIG.hostname}:${
  SOCIAL_PICKER_CONFIG.port
}/`;

/**
 * @param {string} givenURL
 * @returns {Promise<import("../types/social-post").SocialPost>}
 */
export const SocialPick = (givenURL) => {
  return fetch(new URL(`/?url=${encodeURIComponent(givenURL)}`, SOCIAL_PICKER_API_BASE).href).then((res) => {
    if (res.ok) return res.json();

    return Promise.reject(new Error(`SocialPick / Status code: ${res.status} ${res.statusText}`));
  });
};

/**
 * @param {string} filename
 * @returns {void}
 */
export const VideoDone = (filename) => {
  fetch(new URL(`/?video-done=${encodeURIComponent(filename)}`, SOCIAL_PICKER_API_BASE).href)
    .then((res) => {
      if (res.ok) return Promise.resolve();

      return Promise.reject(new Error(`VideoDone / Status code: ${res.status} ${res.statusText}`));
    })
    .catch((e) => LogMessageOrError(`Social-Picker-API / Video done`, e));
};

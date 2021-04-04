export = GlobalCombineVideo;
/**
 * @param {String} video
 * @param {String} audio
 * @returns {Promise<{ url?: string, filename?: string, onDoneCallback?: () => void }>}
 */
declare function GlobalCombineVideo(video: string, audio: string): Promise<{
    url?: string;
    filename?: string;
    onDoneCallback?: () => void;
}>;

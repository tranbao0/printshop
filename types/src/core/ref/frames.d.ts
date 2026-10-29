export type VideoFrame = {
    /**
     * The frame number in the video, from 0.
     */
    n: number;
    /**
     * The time of the frame in milliseconds.
     */
    ms: number;
};
export type FrameChoice = {
    /**
     * These frame numbers. They win over the other options.
     */
    frames?: number[];
    /**
     * The first frame number of the range. Default 0.
     */
    from?: number;
    /**
     * The last frame number of the range. Default: the last frame of the video.
     */
    to?: number;
    /**
     * Take every nth frame of the range. Default: a step that gives at most `max` frames.
     */
    every?: number;
    /**
     * The most frames in the sheet. Default 24.
     */
    max?: number;
};
/**
 * @typedef {object} VideoFrame
 * @property {number} n The frame number in the video, from 0.
 * @property {number} ms The time of the frame in milliseconds.
 */
/**
 * @typedef {object} FrameChoice
 * @property {number[]} [frames] These frame numbers. They win over the other options.
 * @property {number} [from] The first frame number of the range. Default 0.
 * @property {number} [to] The last frame number of the range. Default: the last frame of the video.
 * @property {number} [every] Take every nth frame of the range. Default: a step that gives at most `max` frames.
 * @property {number} [max] The most frames in the sheet. Default 24.
 */
/**
 * Lists the frames of the first video stream with their times.
 * @param {string} ffmpeg
 * @param {string} video
 * @returns {Promise<VideoFrame[]>}
 */
export declare function listFrames(ffmpeg: string, video: string): Promise<VideoFrame[]>;
/**
 * Picks frame numbers from a list of frames.
 * @param {VideoFrame[]} frames All frames of the video.
 * @param {FrameChoice} choice
 * @returns {VideoFrame[]}
 */
export declare function chooseFrames(frames: VideoFrame[], { frames: wanted, from, to, every, max }?: FrameChoice): VideoFrame[];
/**
 * Makes the frame sheet of a video.
 * @param {string} ffmpeg The path of the ffmpeg program (see `findFfmpeg`).
 * @param {string} video
 * @param {FrameChoice & { cols?: number, width?: number }} [options] `width`: the width of a thumbnail, default 320. `cols`: thumbnails in a row, default 6.
 * @returns {Promise<{ sheet: Buffer, frames: VideoFrame[], cols: number, rows: number, cell: { width: number, height: number } }>}
 */
export declare function frameSheet(ffmpeg: string, video: string, options?: FrameChoice & {
    cols?: number;
    width?: number;
}): Promise<{
    sheet: Buffer;
    frames: VideoFrame[];
    cols: number;
    rows: number;
    cell: {
        width: number;
        height: number;
    };
}>;

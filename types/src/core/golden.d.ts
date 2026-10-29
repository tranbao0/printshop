export type Tolerance = {
    /**
     * At most this share of all pixels may differ.
     */
    share: number;
    /**
     * Side of the square window of the local limit, in pixels.
     */
    window: number;
    /**
     * At most this many pixels may differ inside one window.
     */
    inWindow: number;
};
/**
 * @typedef {object} Tolerance
 * @property {number} share At most this share of all pixels may differ.
 * @property {number} window Side of the square window of the local limit, in pixels.
 * @property {number} inWindow At most this many pixels may differ inside one window.
 */
/** @type {Tolerance} */
export declare const defaultTolerance: Tolerance;
export type GrayLike = {
    gray: Uint8Array;
    alpha?: Uint8Array | null;
    width: number;
    height: number;
};
/** @typedef {{ gray: Uint8Array, alpha?: Uint8Array | null, width: number, height: number }} GrayLike */
/**
 * Compares two gray images pixel by pixel. The images must have the same size.
 * @param {GrayLike} a
 * @param {GrayLike} b
 * @param {number} [window] Side of the window for `worst`.
 * @returns {{ differing: number, worst: number, at: [number, number] | null }}
 *   `worst`: the most differing pixels in one window, found at `at` (the top left corner of the window).
 */
export declare function compareGray(a: GrayLike, b: GrayLike, window?: number): {
    differing: number;
    worst: number;
    at: [number, number] | null;
};
/**
 * Whether a comparison is inside the tolerance.
 * @param {{ differing: number, worst: number }} result
 * @param {number} total The number of pixels of the image.
 * @param {Tolerance} [tolerance]
 */
export declare function withinTolerance(result: {
    differing: number;
    worst: number;
}, total: number, tolerance?: Tolerance): boolean;
/**
 * Tells whether the environment asks to write new golden images: `UPDATE_GOLDENS` is `1` or `true`.
 * Any other value, such as `0` or an empty text, leaves the golden images as they are.
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export declare function updateGoldensRequested(env?: Record<string, string | undefined>): boolean;
/**
 * Asserts that a PNG equals its golden image within the tolerance.
 * With `update` (default: `UPDATE_GOLDENS` is `1` or `true`, see `updateGoldensRequested`) it writes the PNG as the new golden image instead.
 * Look at the new image before you keep it.
 * @param {Buffer} png The fresh image.
 * @param {string} goldenFile Path of the golden PNG.
 * @param {{ update?: boolean, tolerance?: Tolerance, name?: string }} [options]
 */
export declare function assertMatchesGolden(png: Buffer, goldenFile: string, { update, tolerance, name }?: {
    update?: boolean;
    tolerance?: Tolerance;
    name?: string;
}): Promise<void>;

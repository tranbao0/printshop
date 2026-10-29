export type Fit = {
    sx: number;
    sy: number;
    ox: number;
    oy: number;
};
export type Point = [number, number];
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type Mark = {
    /**
     * The number of screenshot pixels of the mark.
     */
    pixels: number;
    screenBox: Box;
    imageBox: Box;
    /**
     * The polyline along the mark in image coordinates, one decimal. It follows the longest line through the skeleton of the mark, so a branch is left out.
     */
    path: Point[];
    /**
     * The centre of every pixel of the mark in image coordinates (with the option `points`).
     */
    points?: Point[];
};
export type TraceOptions = {
    /**
     * `red`, `green` or `blue`: that channel is above both others by more than `threshold`. Or a colour like `#e61b1b`: every channel is within `threshold` of it. Default `red`.
     */
    colour?: string;
    /**
     * Default 60.
     */
    threshold?: number;
    /**
     * Marks with fewer pixels are noise and are left out. Default 30.
     */
    minPixels?: number;
    /**
     * Mark pixels that are at most this many pixels apart belong to one mark. Default 3.
     */
    reach?: number;
    /**
     * The tolerance of the polyline, in screenshot pixels. Default 2.
     */
    simplify?: number;
    /**
     * Also list every pixel of a mark in image coordinates.
     */
    points?: boolean;
};
/**
 * The map from screenshot to image. See `Registration` in register.js.
 * @typedef {{ sx: number, sy: number, ox: number, oy: number }} Fit
 */
/** @typedef {[number, number]} Point */
/**
 * A box in pixel-edge coordinates.
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
/**
 * @typedef {object} Mark
 * @property {number} pixels The number of screenshot pixels of the mark.
 * @property {Box} screenBox
 * @property {Box} imageBox
 * @property {Point[]} path The polyline along the mark in image coordinates, one decimal. It follows the longest line through the skeleton of the mark, so a branch is left out.
 * @property {Point[]} [points] The centre of every pixel of the mark in image coordinates (with the option `points`).
 */
/**
 * @typedef {object} TraceOptions
 * @property {string} [colour] `red`, `green` or `blue`: that channel is above both others by more than `threshold`. Or a colour like `#e61b1b`: every channel is within `threshold` of it. Default `red`.
 * @property {number} [threshold] Default 60.
 * @property {number} [minPixels] Marks with fewer pixels are noise and are left out. Default 30.
 * @property {number} [reach] Mark pixels that are at most this many pixels apart belong to one mark. Default 3.
 * @property {number} [simplify] The tolerance of the polyline, in screenshot pixels. Default 2.
 * @property {boolean} [points] Also list every pixel of a mark in image coordinates.
 */
/**
 * Tells whether a text names a colour that `trace` knows: red, green, blue or a hex colour like #e61b1b.
 * @param {string} colour
 */
export declare const isColour: (colour: string) => boolean;
/**
 * Groups the pixels of a mask into marks: pixels at most `reach` apart (in both directions) belong together.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} reach
 * @returns {number[][]} The pixel indexes of each group.
 */
export declare function groupPixels(mask: Uint8Array, width: number, height: number, reach: number): number[][];
/**
 * Thins a mask to a line one pixel wide (Zhang and Suen). The mask changes in place.
 * @param {Uint8Array} m
 * @param {number} width
 * @param {number} height
 */
export declare function thin(m: Uint8Array, width: number, height: number): void;
/**
 * The longest path through a one pixel wide skeleton: from one end of its largest piece to the farthest other end.
 * @param {Uint8Array} m
 * @param {number} width
 * @param {number} height
 * @returns {Point[]} Pixel positions (x, y), in order along the line.
 */
export declare function longestPath(m: Uint8Array, width: number, height: number): Point[];
/**
 * Simplifies a polyline (Ramer, Douglas and Peucker).
 * @param {Point[]} points
 * @param {number} tolerance
 * @returns {Point[]}
 */
export declare function simplifyPath(points: Point[], tolerance: number): Point[];
/**
 * Finds the marks of one colour in a screenshot and maps them into image coordinates.
 * @param {string | Buffer} screenshot
 * @param {Fit} fit
 * @param {TraceOptions} [options]
 * @returns {Promise<{ screenshot: { width: number, height: number }, marks: Mark[] }>} The marks, the largest first.
 */
export declare function trace(screenshot: string | Buffer, fit: Fit, { colour, threshold, minPixels, reach, simplify, points }?: TraceOptions): Promise<{
    screenshot: {
        width: number;
        height: number;
    };
    marks: Mark[];
}>;
/**
 * Draws the paths of the marks over the image, to check a trace by eye.
 * @param {string | Buffer} image
 * @param {Mark[]} marks
 * @returns {Promise<Buffer>} A PNG.
 */
export declare function drawTrace(image: string | Buffer, marks: Mark[]): Promise<Buffer>;

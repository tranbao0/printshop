export type Registration = {
    /**
     * Screenshot pixels per image pixel, across.
     */
    sx: number;
    /**
     * Screenshot pixels per image pixel, down.
     */
    sy: number;
    /**
     * The screenshot x of the left edge of the image.
     */
    ox: number;
    /**
     * The screenshot y of the top edge of the image.
     */
    oy: number;
    /**
     * The correlation of the gray values over the compared pixels, up to 1. Below about 0.5 the match is poor.
     */
    score: number;
};
export type RegisterOptions = {
    /**
     * A screenshot pixel whose colour channels differ by more than this is a mark, and is left out. Default 40.
     * The image must be gray, or this must be 255 (no pixel is left out). Pixels that are not opaque are left out too.
     */
    markChroma?: number;
    /**
     * The left out pixels grow by this many pixels, so the edges of a mark stay out. Default 3.
     */
    markPad?: number;
    /**
     * Pixels of the screenshot to leave out at the top, right, bottom and left. Default 6 on every side.
     * Use it for a label or a frame around the picture.
     */
    margin?: [number, number, number, number];
    /**
     * The range of the scale to try. Default: from half to twice the scale that fits the image into the screenshot.
     */
    scale?: [number, number];
    /**
     * Fit `sx` and `sy` apart. Default: one scale.
     */
    freeAspect?: boolean;
};
export type ScreenInput = {
    width: number;
    height: number;
    gray: Float32Array;
    /**
     * 1 for a pixel to compare.
     */
    valid: Uint8Array;
};
/**
 * Prepares a screenshot: gray values and the mask of the pixels to compare.
 * @param {string | Buffer} source
 * @param {RegisterOptions} [options]
 * @returns {Promise<ScreenInput>}
 */
export declare function loadScreenshot(source: string | Buffer, { markChroma, markPad, margin }?: RegisterOptions): Promise<ScreenInput>;
export type Samples = {
    /**
     * Pixel centre, in the units of the level.
     */
    x: Float32Array;
    y: Float32Array;
    /**
     * Gray value.
     */
    v: Float32Array;
    /**
     * The distance between two samples, in pixels of the level.
     */
    step: number;
};
export type Params = {
    sx: number;
    sy: number;
    ox: number;
    oy: number;
};
/**
 * Finds the registration of a screenshot to an image.
 * @param {ScreenInput} screen
 * @param {import('./raster.js').GrayRaster} image
 * @param {RegisterOptions} [options]
 * @returns {Registration}
 */
export declare function registerRasters(screen: ScreenInput, image: import('./raster.js').GrayRaster, { scale, freeAspect }?: RegisterOptions): Registration;
/**
 * Finds the registration of a screenshot file to an image file.
 * @param {string | Buffer} screenshot
 * @param {string | Buffer} image
 * @param {RegisterOptions} [options]
 * @returns {Promise<Registration & { screenshot: { width: number, height: number }, image: { width: number, height: number } }>}
 */
export declare function register(screenshot: string | Buffer, image: string | Buffer, options?: RegisterOptions): Promise<Registration & {
    screenshot: {
        width: number;
        height: number;
    };
    image: {
        width: number;
        height: number;
    };
}>;

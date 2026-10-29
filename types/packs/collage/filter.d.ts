export type AnyStep = import('../../src/core/filters.js').FilterStep<any>;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type RgbaImage = import('../../src/core/filters.js').RgbaImage;
export type ContrastOptions = import('../../src/core/filters.js').ContrastOptions;
export type BleedOptions = import('../../src/core/filters.js').BleedOptions;
export type LevelsOptions = import('../../src/core/filters.js').LevelsOptions;
export type CollageFilterOptions = ContrastOptions & BleedOptions & LevelsOptions & {
    edgeNoise: number;
    screen: {
        cell: number;
        angle: number;
        low: number;
        high: number;
    };
};
/** @typedef {import('../../src/core/filters.js').FilterStep<any>} AnyStep */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('../../src/core/filters.js').RgbaImage} RgbaImage */
/** @typedef {import('../../src/core/filters.js').ContrastOptions} ContrastOptions */
/** @typedef {import('../../src/core/filters.js').BleedOptions} BleedOptions */
/** @typedef {import('../../src/core/filters.js').LevelsOptions} LevelsOptions */
/**
 * @typedef {ContrastOptions & BleedOptions & LevelsOptions & {
 *   edgeNoise: number,
 *   screen: { cell: number, angle: number, low: number, high: number },
 * }} CollageFilterOptions
 *
 * `screen.cell`: the distance between dot centres, in pixels. `screen.angle`: the angle of the screen in degrees.
 * `screen.low` and `screen.high`: the gray levels (after contrast) that print fully black and fully white. Between them the tone becomes dots.
 * `edgeNoise`: random jitter of the threshold, makes edges and dots uneven.
 */
/** @type {CollageFilterOptions} */
export declare const collageDefaults: CollageFilterOptions;
/**
 * The steps of the collage look, in order.
 * @type {import('../../src/core/filters.js').FilterStep<CollageFilterOptions>[]}
 */
export declare const collageSteps: import('../../src/core/filters.js').FilterStep<CollageFilterOptions>[];
/**
 * Turns an RGBA render of a collage into black and white. Fits the `Filter` type of core/pipeline.js.
 * @param {RgbaImage} image
 * @param {Partial<CollageFilterOptions>} [options]
 * @returns {GrayImage}
 */
export declare function collageFilter(image: RgbaImage, options?: Partial<CollageFilterOptions>): GrayImage;

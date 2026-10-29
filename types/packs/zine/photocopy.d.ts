export type ContrastOptions = import('../../src/core/filters.js').ContrastOptions;
export type ZonesOptions = import('../../src/core/filters.js').ZonesOptions;
export type BleedOptions = import('../../src/core/filters.js').BleedOptions;
export type LevelsOptions = import('../../src/core/filters.js').LevelsOptions;
export type AnyStep = import('../../src/core/filters.js').FilterStep<any>;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type RgbaImage = import('../../src/core/filters.js').RgbaImage;
export type Rng = import('../../src/core/seed.js').Rng;
export type Work = import('../../src/core/filters.js').Work;
export type PhotocopyOptions = ContrastOptions & ZonesOptions & BleedOptions & LevelsOptions & {
    edgeNoise: number;
    halftone: {
        cell: number;
        angle: number;
        low: number;
        high: number;
    };
    toner: {
        weak: number;
        weakFrom: number;
        streaks: number;
        streakStrength: number;
    };
    specks: {
        black: number;
        white: number;
        hairs: number;
    };
};
/** @typedef {import('../../src/core/filters.js').ContrastOptions} ContrastOptions */
/** @typedef {import('../../src/core/filters.js').ZonesOptions} ZonesOptions */
/** @typedef {import('../../src/core/filters.js').BleedOptions} BleedOptions */
/** @typedef {import('../../src/core/filters.js').LevelsOptions} LevelsOptions */
/** @typedef {import('../../src/core/filters.js').FilterStep<any>} AnyStep */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('../../src/core/filters.js').RgbaImage} RgbaImage */
/** @typedef {import('../../src/core/seed.js').Rng} Rng */
/** @typedef {import('../../src/core/filters.js').Work} Work */
/**
 * Every knob of the cheap-copier look. All values are in pixels of the 1600px wide source.
 * @typedef {ContrastOptions & ZonesOptions & BleedOptions & LevelsOptions & {
 *   edgeNoise: number,
 *   halftone: { cell: number, angle: number, low: number, high: number },
 *   toner: { weak: number, weakFrom: number, streaks: number, streakStrength: number },
 *   specks: { black: number, white: number, hairs: number },
 * }} PhotocopyOptions
 *
 * `contrast`: slope around mid gray. `bleed`: wobble of edges before the threshold. `edgeNoise`: random jitter of the threshold, makes edges and dots uneven.
 * `toner.weak`: how much low-frequency weak toner lifts mid and light grays. `toner.weakFrom`: input gray where the lift starts; it reaches full strength 0.1 above this.
 * `toner.streaks`: the count of faint vertical drum streaks per 1600 pixels of width.
 * `specks`: specks and hairs per pixel of area. `levels`: the allowed output levels; two levels mean plain black and white.
 * `zones`: calm zones in source pixels, see zones.js.
 */
/** @type {PhotocopyOptions} */
export declare const photocopyDefaults: PhotocopyOptions;
export declare const HAIR_REACH: number;
/**
 * How far a speck reaches from its centre, in pixels, for a size spread.
 * @param {number} sizeSpread
 * @returns {number}
 */
export declare const speckReach: (sizeSpread: number) => number;
/**
 * The steps of the cheap-copier look, in order.
 * @type {import('../../src/core/filters.js').FilterStep<PhotocopyOptions>[]}
 */
export declare const photocopySteps: import('../../src/core/filters.js').FilterStep<PhotocopyOptions>[];
/**
 * Turns an RGBA render into a photocopy.
 * `alpha` of the result is null when the input is fully opaque.
 * @param {RgbaImage} image
 * @param {Partial<PhotocopyOptions>} [options]
 * @returns {GrayImage}
 */
export declare function photocopy(image: RgbaImage, options?: Partial<PhotocopyOptions>): GrayImage;

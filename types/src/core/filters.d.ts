export type Rng = import('./seed.js').Rng;
export type Streams = import('./seed.js').Streams;
export type Zone = import('./render.js').Zone;
export type ZoneMasks = import('./zones.js').ZoneMasks;
export type CalmSettings = import('./zones.js').CalmSettings;
export type ZonePad = import('./zones.js').ZonePad;
export type Work = {
    width: number;
    height: number;
    /**
     * The RGBA input.
     */
    data: Uint8Array;
    /**
     * Gray values, 0..1.
     */
    gray: Float32Array | Float64Array;
    /**
     * Alpha values, 0..1. Null when the input is fully opaque.
     */
    alpha: Float32Array | null;
    masks: ZoneMasks | null;
    /**
     * The share of the ink bleed that stays at each pixel. Null without calm zones.
     */
    bleedKeep: Float32Array | null;
    /**
     * Black or white per pixel, once thresholded.
     */
    out: Uint8Array | null;
    /**
     * 0 or 255 per pixel. Null when the input is fully opaque.
     */
    outAlpha: Uint8Array | null;
};
export type FilterStep<O extends {
    seed: number;
}> = {
    name: string;
    /**
     * The options this step reads, with their default values.
     */
    defaults: Partial<O>;
    run: (work: Work, options: O, streams: Streams) => void;
};
export type GrayImage = {
    gray: Uint8Array;
    alpha: Uint8Array | null;
    width: number;
    height: number;
};
export type RgbaImage = {
    data: Uint8Array;
    width: number;
    height: number;
};
/** @typedef {import('./seed.js').Rng} Rng */
/** @typedef {import('./seed.js').Streams} Streams */
/** @typedef {import('./render.js').Zone} Zone */
/** @typedef {import('./zones.js').ZoneMasks} ZoneMasks */
/** @typedef {import('./zones.js').CalmSettings} CalmSettings */
/** @typedef {import('./zones.js').ZonePad} ZonePad */
/**
 * The state that the steps of a chain pass along.
 * @typedef {object} Work
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} data The RGBA input.
 * @property {Float32Array | Float64Array} gray Gray values, 0..1.
 * @property {Float32Array | null} alpha Alpha values, 0..1. Null when the input is fully opaque.
 * @property {ZoneMasks | null} masks
 * @property {Float32Array | null} bleedKeep The share of the ink bleed that stays at each pixel. Null without calm zones.
 * @property {Uint8Array | null} out Black or white per pixel, once thresholded.
 * @property {Uint8Array | null} outAlpha 0 or 255 per pixel. Null when the input is fully opaque.
 */
/**
 * @template {{ seed: number }} O
 * @typedef {object} FilterStep
 * @property {string} name
 * @property {Partial<O>} defaults The options this step reads, with their default values.
 * @property {(work: Work, options: O, streams: Streams) => void} run
 */
/**
 * The result of a chain: gray values (0 or 255 for a black and white filter), and alpha (0 or 255) or null.
 * @typedef {{ gray: Uint8Array, alpha: Uint8Array | null, width: number, height: number }} GrayImage
 */
/** @typedef {{ data: Uint8Array, width: number, height: number }} RgbaImage */
export declare const clamp01: (/** @type {number} */ v: number) => number;
/**
 * Runs the steps in order over an RGBA image. The options are the defaults of the steps, overridden by `options` (a shallow merge).
 * @template {{ seed: number }} O
 * @param {FilterStep<O>[]} steps
 * @param {RgbaImage} image
 * @param {Partial<O>} [options]
 * @param {Streams} [streams] The random streams. Default: the streams of the seed in the options.
 * @returns {GrayImage}
 */
export declare function runFilter<O extends {
    seed: number;
}>(steps: FilterStep<O>[], image: RgbaImage, options?: Partial<O>, streams?: Streams): GrayImage;
export type ContrastOptions = {
    seed: number;
    contrast: number;
};
export type ZonesOptions = {
    seed: number;
    zones: Zone[];
    calm: CalmSettings;
    zonePad: ZonePad;
};
export type BleedOptions = {
    seed: number;
    bleed: {
        amount: number;
        cell: number;
    };
};
export type ThresholdOptions = {
    seed: number;
    threshold: number;
    edgeNoise: number;
};
export type LevelsOptions = {
    seed: number;
    levels: number[];
};
/** @typedef {{ seed: number, contrast: number }} ContrastOptions Slope around mid gray. */
/** @typedef {{ seed: number, zones: Zone[], calm: CalmSettings, zonePad: ZonePad }} ZonesOptions Calm zones in source pixels. See zones.js. */
/** @typedef {{ seed: number, bleed: { amount: number, cell: number } }} BleedOptions Wobble of edges before the threshold. */
/** @typedef {{ seed: number, threshold: number, edgeNoise: number }} ThresholdOptions The cut level (0..1) and the random jitter of it. */
/** @typedef {{ seed: number, levels: number[] }} LevelsOptions The allowed output levels. Two levels mean plain black and white. */
/**
 * Copies a step with other defaults.
 * @template {{ seed: number }} O
 * @param {FilterStep<O>} step
 * @param {Partial<O>} defaults
 * @returns {FilterStep<O>}
 */
export declare const withDefaults: <O extends {
    seed: number;
}>(step: FilterStep<O>, defaults: Partial<O>) => FilterStep<O>;
/**
 * Moves every pixel a little along smooth noise, so straight edges turn uneven.
 * `keep`, if given, holds the share of the wobble that stays at each pixel.
 * The two noise fields have the keys of the streams `<name>.x` and `<name>.y`.
 * @param {Float32Array | Float64Array} src
 * @param {number} width
 * @param {number} height
 * @param {number} amount
 * @param {number} cell
 * @param {Streams} streams
 * @param {string} name
 * @param {Float32Array | null} [keep]
 * @returns {Float32Array}
 */
export declare function displace(src: Float32Array | Float64Array, width: number, height: number, amount: number, cell: number, streams: Streams, name: string, keep?: Float32Array | null): Float32Array;
/** @type {FilterStep<{ seed: number }>} */
export declare const grayStep: FilterStep<{
    seed: number;
}>;
/** @type {FilterStep<ContrastOptions>} */
export declare const contrastStep: FilterStep<ContrastOptions>;
/** @type {FilterStep<ZonesOptions>} */
export declare const zonesStep: FilterStep<ZonesOptions>;
/** @type {FilterStep<BleedOptions>} */
export declare const bleedStep: FilterStep<BleedOptions>;
/** @type {FilterStep<ThresholdOptions>} */
export declare const thresholdStep: FilterStep<ThresholdOptions>;
/** @type {FilterStep<LevelsOptions>} */
export declare const levelsStep: FilterStep<LevelsOptions>;

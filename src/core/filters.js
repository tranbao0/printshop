// A chain of small, seeded filter steps over an RGBA buffer, and the general steps that most looks need:
// gray, contrast, calm zones, ink bleed, a plain threshold and output levels.
// A step reads and writes a shared `Work` record. Every random draw comes from a named stream (see seed.js),
// so a change in one step never re-rolls the random features of another.
// The steps of one look (for example the cheap-copier look in photocopy.js) build on this module.
import { createStreams } from './seed.js';
import { fractalField } from './noise.js';
import { buildZoneMasks, calmAt, calmDefaults, zonePadDefaults } from './zones.js';

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

export const clamp01 = (/** @type {number} */ v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Runs the steps in order over an RGBA image. The options are the defaults of the steps, overridden by `options` (a shallow merge).
 * @template {{ seed: number }} O
 * @param {FilterStep<O>[]} steps
 * @param {RgbaImage} image
 * @param {Partial<O>} [options]
 * @param {Streams} [streams] The random streams. Default: the streams of the seed in the options.
 * @returns {GrayImage}
 */
export function runFilter(steps, image, options = {}, streams) {
  const o = /** @type {O} */ ({ seed: 1, ...Object.assign({}, ...steps.map((s) => s.defaults)), ...options });
  streams ??= createStreams(o.seed);
  const { data, width, height } = image;
  /** @type {Work} */
  const work = { width, height, data, gray: new Float32Array(0), alpha: null, masks: null, bleedKeep: null, out: null, outAlpha: null };
  for (const step of steps) step.run(work, o, streams);
  if (!work.out) throw new Error('the filter chain made no black and white output: it needs a threshold step');
  return { gray: work.out, alpha: work.outAlpha, width, height };
}

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
export const withDefaults = (step, defaults) => ({ ...step, defaults: { ...step.defaults, ...defaults } });

/**
 * Bilinear sample with the edges held.
 * @param {Float32Array | Float64Array} src
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 */
function sample(src, width, height, x, y) {
  x = x < 0 ? 0 : x > width - 1.001 ? width - 1.001 : x;
  y = y < 0 ? 0 : y > height - 1.001 ? height - 1.001 : y;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * width + x0;
  const top = src[i] * (1 - fx) + src[i + 1] * fx;
  const bottom = src[i + width] * (1 - fx) + src[i + width + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

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
export function displace(src, width, height, amount, cell, streams, name, keep = null) {
  /** @type {[number, number][]} */
  const layers = [[cell, 0.65], [cell / 3, 0.35]];
  const dx = fractalField(width, height, layers, streams.key(`${name}.x`));
  const dy = fractalField(width, height, layers, streams.key(`${name}.y`));
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = keep ? amount * keep[i] : amount;
      out[i] = sample(src, width, height, x + (dx[i] - 0.5) * 2 * a, y + (dy[i] - 0.5) * 2 * a);
    }
  }
  return out;
}

/** @type {FilterStep<{ seed: number }>} */
export const grayStep = {
  name: 'gray',
  defaults: {},
  // Reads the RGBA input into gray (0..1) and alpha (0..1). Alpha is kept only when some pixel is not opaque.
  run(work) {
    const n = work.width * work.height;
    const gray = new Float32Array(n);
    const alpha = new Float32Array(n);
    let translucent = false;
    for (let i = 0; i < n; i++) {
      gray[i] = (0.299 * work.data[i * 4] + 0.587 * work.data[i * 4 + 1] + 0.114 * work.data[i * 4 + 2]) / 255;
      alpha[i] = work.data[i * 4 + 3] / 255;
      if (alpha[i] < 1) translucent = true;
    }
    work.gray = gray;
    work.alpha = translucent ? alpha : null;
  },
};

/** @type {FilterStep<ContrastOptions>} */
export const contrastStep = {
  name: 'contrast',
  defaults: { contrast: 1 },
  run(work, o) {
    const out = new Float32Array(work.gray.length);
    for (let i = 0; i < out.length; i++) out[i] = clamp01(0.5 + (work.gray[i] - 0.5) * o.contrast);
    work.gray = out;
  },
};

/** @type {FilterStep<ZonesOptions>} */
export const zonesStep = {
  name: 'zones',
  defaults: { zones: [], calm: calmDefaults, zonePad: zonePadDefaults },
  // Builds the zone masks and the share of the ink bleed that stays at each pixel.
  run(work, o) {
    const { width, height } = work;
    work.masks = buildZoneMasks(o.zones, o.zonePad, width, height);
    if (!work.masks) return;
    const keep = new Float32Array(width * height);
    for (let i = 0; i < keep.length; i++) keep[i] = calmAt(work.masks, o.calm, i)?.bleed ?? 1;
    work.bleedKeep = keep;
  },
};

/** @type {FilterStep<BleedOptions>} */
export const bleedStep = {
  name: 'bleed',
  defaults: { bleed: { amount: 1.5, cell: 11 } },
  // Ink bleed: the gray values and the alpha move along their own noise (streams `wobble` and `wobble.alpha`).
  run(work, o, streams) {
    const { width, height } = work;
    work.gray = displace(work.gray, width, height, o.bleed.amount, o.bleed.cell, streams, 'wobble', work.bleedKeep);
    if (work.alpha) work.alpha = displace(work.alpha, width, height, o.bleed.amount, o.bleed.cell, streams, 'wobble.alpha', work.bleedKeep);
  },
};

/** @type {FilterStep<ThresholdOptions>} */
export const thresholdStep = {
  name: 'threshold',
  defaults: { threshold: 0.5, edgeNoise: 0 },
  // Cuts the gray values at `threshold`, with a jittered level (stream `edges`) when `edgeNoise` is not zero.
  // The alpha channel is cut at 0.5 with the same jitter.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const edge = o.edgeNoise ? fractalField(width, height, [[5, 0.5], [2, 0.5]], streams.key('edges')) : null;
    const out = new Uint8Array(n);
    const outAlpha = work.alpha ? new Uint8Array(n) : null;
    for (let i = 0; i < n; i++) {
      const jitter = edge ? (edge[i] - 0.5) * o.edgeNoise : 0;
      out[i] = work.gray[i] < o.threshold + jitter ? 0 : 255;
      if (work.alpha && outAlpha) outAlpha[i] = work.alpha[i] > 0.5 + jitter ? 255 : 0;
    }
    work.out = out;
    work.outAlpha = outAlpha;
  },
};

/** @type {FilterStep<LevelsOptions>} */
export const levelsStep = {
  name: 'levels',
  defaults: { levels: [0, 255] },
  // Snaps the black and white output to the allowed levels. Two levels leave it as it is.
  run(work, o) {
    const out = /** @type {Uint8Array} */ (work.out);
    const levels = o.levels;
    if (levels.length <= 2) return;
    for (let i = 0; i < out.length; i++) out[i] = levels.reduce((best, l) => (Math.abs(l - out[i]) < Math.abs(best - out[i]) ? l : best));
  },
};

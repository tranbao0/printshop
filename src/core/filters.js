// A chain of small, seeded filter steps over an RGBA buffer, and the steps of the cheap-copier look.
// A step reads and writes a shared `Work` record. Every random draw comes from a named stream (see seed.js),
// so a change in one step never re-rolls the random features of another.
import { createStreams } from './seed.js';
import { noiseField, fractalField } from './noise.js';
import { buildZoneMasks, calmAt, calmDefaults, touches, zonePadDefaults } from './zones.js';

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

const clamp01 = (/** @type {number} */ v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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

/**
 * Every knob of the cheap-copier look. All values are in pixels of the 1600px wide source.
 * @typedef {object} PhotocopyOptions
 * @property {number} seed
 * @property {number} contrast Slope around mid gray.
 * @property {{ amount: number, cell: number }} bleed Wobble of edges before the threshold.
 * @property {number} edgeNoise Random jitter of the threshold, makes edges and dots uneven.
 * @property {{ cell: number, angle: number, low: number, high: number }} halftone
 * @property {{ weak: number, weakFrom: number, streaks: number, streakStrength: number }} toner
 *   `weak`: how much low-frequency weak toner lifts mid and light grays. `weakFrom`: input gray where the lift starts; it reaches full strength 0.1 above this.
 *   `streaks`: the count of faint vertical drum streaks.
 * @property {{ black: number, white: number, hairs: number }} specks Specks per pixel of area.
 * @property {number[]} levels The allowed output levels. Two levels mean plain black and white.
 * @property {Zone[]} zones Calm zones in source pixels. See zones.js.
 * @property {CalmSettings} calm
 * @property {ZonePad} zonePad
 */

/** @type {PhotocopyOptions} */
export const photocopyDefaults = {
  seed: 1,
  contrast: 1.45,
  bleed: { amount: 1.5, cell: 11 },
  edgeNoise: 0.2,
  halftone: { cell: 6.5, angle: 45, low: 0.12, high: 0.88 },
  toner: { weak: 0.3, weakFrom: 0.1, streaks: 20, streakStrength: 0.85 },
  specks: { black: 1 / 5200, white: 1 / 14000, hairs: 1 / 380000 },
  levels: [0, 255],
  zones: [],
  calm: calmDefaults,
  zonePad: zonePadDefaults,
};

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
 * The two noise fields come from the streams `<name>.x` and `<name>.y`.
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
  const dx = fractalField(width, height, layers, streams.stream(`${name}.x`));
  const dy = fractalField(width, height, layers, streams.stream(`${name}.y`));
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

/**
 * Per-column strength of faint vertical streaks: dark ones add toner, light ones drop it.
 * Each streak takes four draws, whatever they decide.
 * @param {number} width
 * @param {number} count
 * @param {number} strength
 * @param {Rng} rand
 */
function streakColumns(width, count, strength, rand) {
  const dark = new Float32Array(width);
  const light = new Float32Array(width);
  for (let k = 0; k < count; k++) {
    const x = Math.floor(rand() * width);
    const w = 1 + Math.floor(rand() * 3);
    const amount = strength * (0.35 + rand() * 0.65);
    const target = rand() < 0.6 ? dark : light;
    for (let i = 0; i < w && x + i < width; i++) target[x + i] = Math.max(target[x + i], amount);
  }
  return { dark, light };
}

/**
 * Stamps a round-ish speck that flips the pixel under its centre (white on black, black on white).
 * `bumps` are random numbers in 0..1 that shape the outline.
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number[]} bumps
 */
function stampSpeck(out, width, height, cx, cy, radius, bumps) {
  const centre = out[Math.round(cy) * width + Math.round(cx)];
  const value = centre > 127 ? 0 : 255;
  const r = Math.ceil(radius + 1);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const px = Math.round(cx) + x;
      const py = Math.round(cy) + y;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const angle = Math.atan2(y, x);
      const wobble = 1 + 0.35 * Math.sin(angle * 2 + bumps[0] * 6) + 0.2 * Math.sin(angle * 3 + bumps[1] * 6);
      if (Math.hypot(x, y) <= radius * wobble) out[py * width + px] = value;
    }
  }
}

/**
 * A thin wandering line that flips the pixels it crosses. It takes all its draws from `rand`.
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {Rng} rand
 * @param {Uint8Array | null} [keepOut] Pixels the hair must not touch.
 */
function addHair(out, width, height, rand, keepOut = null) {
  let x = rand() * width;
  let y = rand() * height;
  let angle = rand() * Math.PI * 2;
  const length = 14 + rand() * 50;
  const value = out[Math.round(y) * width + Math.round(x)] > 127 ? 0 : 255;
  for (let s = 0; s < length; s++) {
    angle += (rand() - 0.5) * 0.35;
    x += Math.cos(angle);
    y += Math.sin(angle);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px >= 0 && py >= 0 && px < width && py < height && !(keepOut && keepOut[py * width + px])) out[py * width + px] = value;
  }
}

/**
 * Stamps toner specks of one colour. A speck takes six draws from the stream (place, size, outline), whether it lands or not,
 * so a speck that does not land (outside the ink, in a calm zone, on the wrong colour) leaves every later speck where it was.
 * @param {Work} work
 * @param {Rng} rand
 * @param {number} density Specks per pixel of area.
 * @param {number} sizeSpread Pixels added to the radius at most: the radius is 0.7 plus a random share cubed of this.
 * @param {'black' | 'white'} colour
 */
function scatterSpecks(work, rand, density, sizeSpread, colour) {
  const { width, height, masks } = work;
  const out = /** @type {Uint8Array} */ (work.out);
  const n = width * height;
  for (let k = 0, count = n * density; k < count; k++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const radius = 0.7 + Math.pow(rand(), 3) * sizeSpread;
    const bumps = [rand(), rand(), rand()];
    const centre = Math.round(cy) * width + Math.round(cx);
    if (work.outAlpha && !work.outAlpha[centre]) continue;
    if (masks && touches(masks.speck, width, height, cx, cy, radius)) continue;
    const lands = colour === 'black' ? out[centre] > 127 : out[centre] <= 127;
    if (lands) stampSpeck(out, width, height, cx, cy, radius, bumps);
  }
}

/** @type {FilterStep<PhotocopyOptions>} */
const grayStep = {
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

/** @type {FilterStep<PhotocopyOptions>} */
const contrastStep = {
  name: 'contrast',
  defaults: { contrast: photocopyDefaults.contrast },
  run(work, o) {
    const out = new Float32Array(work.gray.length);
    for (let i = 0; i < out.length; i++) out[i] = clamp01(0.5 + (work.gray[i] - 0.5) * o.contrast);
    work.gray = out;
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const zonesStep = {
  name: 'zones',
  defaults: { zones: photocopyDefaults.zones, calm: photocopyDefaults.calm, zonePad: photocopyDefaults.zonePad },
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

/** @type {FilterStep<PhotocopyOptions>} */
const bleedStep = {
  name: 'bleed',
  defaults: { bleed: photocopyDefaults.bleed },
  // Ink bleed: the gray values and the alpha move along their own noise (streams `wobble` and `wobble.alpha`).
  run(work, o, streams) {
    const { width, height } = work;
    work.gray = displace(work.gray, width, height, o.bleed.amount, o.bleed.cell, streams, 'wobble', work.bleedKeep);
    if (work.alpha) work.alpha = displace(work.alpha, width, height, o.bleed.amount, o.bleed.cell, streams, 'wobble.alpha', work.bleedKeep);
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const tonerStep = {
  name: 'toner',
  defaults: { toner: photocopyDefaults.toner },
  // Uneven toner: weak patches lift the blacks, drum streaks run top to bottom, and fine grain.
  // Streams: `patches`, `streak-fade`, `streaks`, `grain`.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const patches = fractalField(width, height, [[420, 0.6], [140, 0.4]], streams.stream('patches'));
    const streakFade = noiseField(width, height, 380, streams.stream('streak-fade'));
    const streaks = streakColumns(width, o.toner.streaks, o.toner.streakStrength, streams.stream('streaks'));
    const grain = noiseField(width, height, 2, streams.stream('grain'));
    const out = new Float64Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        let g = work.gray[i];
        const reaches = clamp01((g - o.toner.weakFrom) / 0.1); // solid black stays black
        const weak = clamp01((patches[i] - 0.5) * 3) * o.toner.weak * reaches;
        g += (1 - g) * weak * 0.55;
        const fade = streakFade[i];
        g -= g * streaks.dark[x] * fade * 0.6;
        g += (1 - g) * streaks.light[x] * (1 - fade) * 0.8;
        g += (grain[i] - 0.5) * 0.14;
        out[i] = g;
      }
    }
    work.gray = out;
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const thresholdStep = {
  name: 'threshold',
  defaults: { halftone: photocopyDefaults.halftone, edgeNoise: photocopyDefaults.edgeNoise, calm: photocopyDefaults.calm },
  // Clustered-dot halftone screen, turned by `angle` degrees, with a jittered threshold (stream `edges`).
  // Calm zones weaken the screen. The alpha channel is cut at 0.5 with the same jitter.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const edge = fractalField(width, height, [[5, 0.5], [2, 0.5]], streams.stream('edges'));
    const theta = (o.halftone.angle * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const tau = (Math.PI * 2) / o.halftone.cell;
    const { low, high } = o.halftone;
    const out = new Uint8Array(n);
    const outAlpha = work.alpha ? new Uint8Array(n) : null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const u = (x * cos + y * sin) * tau;
        const v = (-x * sin + y * cos) * tau;
        const calm = calmAt(work.masks, o.calm, i);
        const screen = 0.5 + (calm ? calm.screen : 1) * 0.25 * (Math.cos(u) + Math.cos(v));
        const threshold = low + (high - low) * screen + (edge[i] - 0.5) * o.edgeNoise;
        out[i] = work.gray[i] < threshold ? 0 : 255;
        if (work.alpha && outAlpha) outAlpha[i] = work.alpha[i] > 0.5 + (edge[i] - 0.5) * o.edgeNoise ? 255 : 0;
      }
    }
    work.out = out;
    work.outAlpha = outAlpha;
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const specksStep = {
  name: 'specks',
  defaults: { specks: photocopyDefaults.specks },
  // Toner speckle: black specks on white and white specks on black (streams `specks.black` and `specks.white`).
  run(work, o, streams) {
    scatterSpecks(work, streams.stream('specks.black'), o.specks.black, 3, 'black');
    scatterSpecks(work, streams.stream('specks.white'), o.specks.white, 2.5, 'white');
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const hairsStep = {
  name: 'hairs',
  defaults: { specks: photocopyDefaults.specks },
  // A few long hairs. Hair k draws from its own stream `hairs` with index k, so its length never shifts another hair.
  run(work, o, streams) {
    const { width, height } = work;
    const out = /** @type {Uint8Array} */ (work.out);
    for (let k = 0, count = width * height * o.specks.hairs; k < count; k++) {
      addHair(out, width, height, streams.stream('hairs', k), work.masks?.speck ?? null);
    }
  },
};

/** @type {FilterStep<PhotocopyOptions>} */
const levelsStep = {
  name: 'levels',
  defaults: { levels: photocopyDefaults.levels },
  // Snaps the black and white output to the allowed levels. Two levels leave it as it is.
  run(work, o) {
    const out = /** @type {Uint8Array} */ (work.out);
    const levels = o.levels;
    if (levels.length <= 2) return;
    for (let i = 0; i < out.length; i++) out[i] = levels.reduce((best, l) => (Math.abs(l - out[i]) < Math.abs(best - out[i]) ? l : best));
  },
};

/**
 * The steps of the cheap-copier look, in order.
 * @type {FilterStep<PhotocopyOptions>[]}
 */
export const photocopySteps = [grayStep, contrastStep, zonesStep, bleedStep, tonerStep, thresholdStep, specksStep, hairsStep, levelsStep];

/**
 * Turns an RGBA render into a photocopy.
 * `alpha` of the result is null when the input is fully opaque.
 * @param {RgbaImage} image
 * @param {Partial<PhotocopyOptions>} [options]
 * @returns {GrayImage}
 */
export function photocopy(image, options = {}) {
  return runFilter(photocopySteps, image, options);
}

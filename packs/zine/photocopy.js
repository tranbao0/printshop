// The cheap-copier look: a halftone screen, weak toner patches, drum streaks, grain, specks and hairs,
// built from the general steps of filters.js and steps of its own.
// Every random draw comes from a named stream (see seed.js). Features with a place in the image (specks, hairs, drum streaks)
// come from one stream per tile (see scatter.js), so a taller or wider page keeps the features of the part it shares with a smaller page.
import { clamp01, bleedStep, contrastStep, grayStep, levelsStep, runFilter, withDefaults, zonesStep } from '../../src/core/filters.js';
import { noiseField, fractalField } from '../../src/core/noise.js';
import { TILE, countFor, tiles } from '../../src/core/scatter.js';
import { calmAt, calmDefaults, touches, zonePadDefaults } from '../../src/core/zones.js';

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

/** Width in pixels of the bands that the drum streaks are drawn in, and the width that the `streaks` count belongs to. */
const STREAK_BAND = 400;
const STREAK_COUNT_WIDTH = 1600;

/** The most that a hair can travel from its start, in pixels. */
const HAIR_MIN_LENGTH = 14;
const HAIR_LENGTH_SPREAD = 50;
export const HAIR_REACH = Math.ceil(HAIR_MIN_LENGTH + HAIR_LENGTH_SPREAD) + 1;

/**
 * How far a speck reaches from its centre, in pixels, for a size spread.
 * @param {number} sizeSpread
 * @returns {number}
 */
export const speckReach = (sizeSpread) => Math.ceil(0.7 + sizeSpread + 1);

/**
 * Per-column strength of faint vertical streaks: dark ones add toner, light ones drop it.
 * The width is cut in bands of 400 px, and every band has its own stream (`streaks`, index = band),
 * so a wider page keeps the streaks of the columns it shares with a narrower one.
 * Each streak takes four draws, whatever they decide.
 * @param {import('../../src/core/seed.js').Streams} streams
 * @param {number} width
 * @param {number} count Streaks per 1600 px of width.
 * @param {number} strength
 */
function streakColumns(streams, width, count, strength) {
  const dark = new Float32Array(width);
  const light = new Float32Array(width);
  for (let band = 0; band * STREAK_BAND < width; band++) {
    const rand = streams.stream('streaks', band);
    const n = countFor(rand, (count * STREAK_BAND) / STREAK_COUNT_WIDTH);
    for (let k = 0; k < n; k++) {
      const x = band * STREAK_BAND + Math.floor(rand() * STREAK_BAND);
      const w = 1 + Math.floor(rand() * 3);
      const amount = strength * (0.35 + rand() * 0.65);
      const target = rand() < 0.6 ? dark : light;
      for (let i = 0; i < w && x + i < width; i++) target[x + i] = Math.max(target[x + i], amount);
    }
  }
  return { dark, light };
}

/**
 * Stamps a round-ish speck of one value. `bumps` are random numbers in 0..1 that shape the outline.
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number[]} bumps
 * @param {number} value
 */
function stampSpeck(out, width, height, cx, cy, radius, bumps, value) {
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
 * A thin wandering line that flips every pixel it crosses (white to black, black to white).
 * It takes all its draws from `rand`, and it does not look at the image, so the same hair makes the same line in every image size.
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {Rng} rand
 * @param {number} x0 Left edge of the tile that the hair starts in.
 * @param {number} y0 Top edge of the tile.
 * @param {Uint8Array | null} [keepOut] Pixels the hair must not touch.
 */
function addHair(out, width, height, rand, x0, y0, keepOut = null) {
  let x = x0 + rand() * TILE;
  let y = y0 + rand() * TILE;
  let angle = rand() * Math.PI * 2;
  const length = HAIR_MIN_LENGTH + rand() * HAIR_LENGTH_SPREAD;
  const flipped = new Set();
  for (let s = 0; s < length; s++) {
    angle += (rand() - 0.5) * 0.35;
    x += Math.cos(angle);
    y += Math.sin(angle);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height || (keepOut && keepOut[py * width + px])) continue;
    const at = py * width + px;
    if (flipped.has(at)) continue;
    flipped.add(at);
    out[at] = out[at] > 127 ? 0 : 255;
  }
}

/**
 * Stamps toner specks of one colour. A speck takes six draws from the stream of its tile (place, size, outline), whether it lands or not,
 * so a speck that does not land (outside the ink, in a calm zone, on the wrong colour) leaves every later speck where it was.
 * A speck centred outside the image still reaches into it, and takes its colour test from the nearest pixel.
 * @param {Work} work
 * @param {import('../../src/core/seed.js').Streams} streams
 * @param {string} name The name of the stream.
 * @param {number} density Specks per pixel of area.
 * @param {number} sizeSpread Pixels added to the radius at most: the radius is 0.7 plus a random share cubed of this.
 * @param {'black' | 'white'} colour
 */
function scatterSpecks(work, streams, name, density, sizeSpread, colour) {
  const { width, height, masks } = work;
  const out = /** @type {Uint8Array} */ (work.out);
  const reach = speckReach(sizeSpread);
  const value = colour === 'black' ? 0 : 255;
  for (const tile of tiles(streams, name, width, height, density, reach)) {
    const { rand } = tile;
    for (let k = 0; k < tile.count; k++) {
      const cx = tile.x0 + rand() * TILE;
      const cy = tile.y0 + rand() * TILE;
      const radius = 0.7 + Math.pow(rand(), 3) * sizeSpread;
      const bumps = [rand(), rand(), rand()];
      if (cx < -reach || cy < -reach || cx >= width + reach || cy >= height + reach) continue;
      const centre = Math.min(height - 1, Math.max(0, Math.round(cy))) * width + Math.min(width - 1, Math.max(0, Math.round(cx)));
      if (work.outAlpha && !work.outAlpha[centre]) continue;
      if (masks && touches(masks.speck, width, height, cx, cy, radius)) continue;
      const lands = colour === 'black' ? out[centre] > 127 : out[centre] <= 127;
      if (lands) stampSpeck(out, width, height, cx, cy, radius, bumps, value);
    }
  }
}

/** @type {import('../../src/core/filters.js').FilterStep<Pick<PhotocopyOptions, 'seed' | 'toner'>>} */
const tonerStep = {
  name: 'toner',
  defaults: { toner: photocopyDefaults.toner },
  // Uneven toner: weak patches lift the blacks, drum streaks run top to bottom, and fine grain.
  // Streams: `patches`, `streak-fade`, `streaks`, `grain`.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const patches = fractalField(width, height, [[420, 0.6], [140, 0.4]], streams.key('patches'));
    const streakFade = noiseField(width, height, 380, streams.key('streak-fade'));
    const streaks = streakColumns(streams, width, o.toner.streaks, o.toner.streakStrength);
    const grain = noiseField(width, height, 2, streams.key('grain'));
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

/** @type {import('../../src/core/filters.js').FilterStep<Pick<PhotocopyOptions, 'seed' | 'halftone' | 'edgeNoise' | 'calm'>>} */
const halftoneStep = {
  name: 'halftone',
  defaults: { halftone: photocopyDefaults.halftone, edgeNoise: photocopyDefaults.edgeNoise, calm: photocopyDefaults.calm },
  // Clustered-dot halftone screen, turned by `angle` degrees, with a jittered threshold (stream `edges`).
  // Calm zones weaken the screen. The alpha channel is cut at 0.5 with the same jitter.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const edge = fractalField(width, height, [[5, 0.5], [2, 0.5]], streams.key('edges'));
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

/** @type {import('../../src/core/filters.js').FilterStep<Pick<PhotocopyOptions, 'seed' | 'specks'>>} */
const specksStep = {
  name: 'specks',
  defaults: { specks: photocopyDefaults.specks },
  // Toner speckle: black specks on white and white specks on black (streams `specks.black` and `specks.white`, one per tile).
  run(work, o, streams) {
    scatterSpecks(work, streams, 'specks.black', o.specks.black, 3, 'black');
    scatterSpecks(work, streams, 'specks.white', o.specks.white, 2.5, 'white');
  },
};

/** @type {import('../../src/core/filters.js').FilterStep<Pick<PhotocopyOptions, 'seed' | 'specks'>>} */
const hairsStep = {
  name: 'hairs',
  defaults: { specks: photocopyDefaults.specks },
  // A few long hairs. The hairs of one tile draw from the stream `hairs` with the index of the tile, one after the other,
  // and a tile takes the same draws in every image size.
  run(work, o, streams) {
    const { width, height } = work;
    const out = /** @type {Uint8Array} */ (work.out);
    for (const tile of tiles(streams, 'hairs', width, height, o.specks.hairs, HAIR_REACH)) {
      for (let k = 0; k < tile.count; k++) addHair(out, width, height, tile.rand, tile.x0, tile.y0, work.masks?.speck ?? null);
    }
  },
};

/**
 * The steps of the cheap-copier look, in order.
 * @type {import('../../src/core/filters.js').FilterStep<PhotocopyOptions>[]}
 */
export const photocopySteps = [
  grayStep,
  withDefaults(contrastStep, { contrast: photocopyDefaults.contrast }),
  withDefaults(zonesStep, { zones: photocopyDefaults.zones, calm: photocopyDefaults.calm, zonePad: photocopyDefaults.zonePad }),
  withDefaults(bleedStep, { bleed: photocopyDefaults.bleed }),
  tonerStep,
  halftoneStep,
  specksStep,
  hairsStep,
  withDefaults(levelsStep, { levels: photocopyDefaults.levels }),
];

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

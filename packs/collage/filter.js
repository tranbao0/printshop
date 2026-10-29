// The print look of the collage: a clustered-dot halftone screen over the gray tones of the paper, so light and mid grays print as dots
// and black and white print solid. It is built only from the general steps of core/filters.js and one step of its own.
// Every random draw comes from a named stream (`wobble`, `edges`), see core/seed.js.
import { bleedStep, contrastStep, grayStep, levelsStep, runFilter, withDefaults } from '../../src/core/filters.js';
import { fractalField } from '../../src/core/noise.js';

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
export const collageDefaults = {
  seed: 1,
  contrast: 1.45,
  bleed: { amount: 1.5, cell: 11 },
  edgeNoise: 0.2,
  screen: { cell: 6.5, angle: 45, low: 0.12, high: 0.88 },
  levels: [0, 255],
};

/** @type {import('../../src/core/filters.js').FilterStep<Pick<CollageFilterOptions, 'seed' | 'screen' | 'edgeNoise'>>} */
const screenStep = {
  name: 'screen',
  defaults: { screen: collageDefaults.screen, edgeNoise: collageDefaults.edgeNoise },
  // Clustered-dot halftone screen with a jittered threshold (stream `edges`). The alpha channel is cut at 0.5 with the same jitter.
  run(work, o, streams) {
    const { width, height } = work;
    const n = width * height;
    const edge = fractalField(width, height, [[5, 0.5], [2, 0.5]], streams.key('edges'));
    const theta = (o.screen.angle * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const tau = (Math.PI * 2) / o.screen.cell;
    const { low, high } = o.screen;
    const out = new Uint8Array(n);
    const outAlpha = work.alpha ? new Uint8Array(n) : null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const u = (x * cos + y * sin) * tau;
        const v = (-x * sin + y * cos) * tau;
        const threshold = low + (high - low) * (0.5 + 0.25 * (Math.cos(u) + Math.cos(v))) + (edge[i] - 0.5) * o.edgeNoise;
        out[i] = work.gray[i] < threshold ? 0 : 255;
        if (work.alpha && outAlpha) outAlpha[i] = work.alpha[i] > 0.5 + (edge[i] - 0.5) * o.edgeNoise ? 255 : 0;
      }
    }
    work.out = out;
    work.outAlpha = outAlpha;
  },
};

/**
 * The steps of the collage look, in order.
 * @type {import('../../src/core/filters.js').FilterStep<CollageFilterOptions>[]}
 */
export const collageSteps = [
  grayStep,
  withDefaults(contrastStep, { contrast: collageDefaults.contrast }),
  withDefaults(bleedStep, { bleed: collageDefaults.bleed }),
  screenStep,
  withDefaults(levelsStep, { levels: collageDefaults.levels }),
];

/**
 * Turns an RGBA render of a collage into black and white. Fits the `Filter` type of core/pipeline.js.
 * @param {RgbaImage} image
 * @param {Partial<CollageFilterOptions>} [options]
 * @returns {GrayImage}
 */
export function collageFilter(image, options = {}) {
  return runFilter(collageSteps, image, options);
}

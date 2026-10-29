// The look of the pack: an ordered list of filter steps.
// The steps of the core (gray, contrast, threshold, levels) do the common work. `grainStep` is a step of this pack, as an example of a step.
// Every random draw comes from a named stream of the image seed (see seed.js in the core), so a change in one step never re-rolls another.
import { clamp01, contrastStep, grayStep, levelsStep, runFilter, thresholdStep, withDefaults } from '@tranbao0/printshop/core/filters';
import { fractalField } from '@tranbao0/printshop/core/noise';

/** @typedef {import('@tranbao0/printshop/core/filters').FilterStep<any>} AnyStep */
/** @typedef {import('@tranbao0/printshop/core/filters').GrayImage} GrayImage */
/** @typedef {import('@tranbao0/printshop/core/filters').RgbaImage} RgbaImage */

/**
 * Every knob of the look.
 * `contrast`: slope around mid gray. `grain.amount`: how far the noise moves the gray values (0..1). `grain.cell`: the size of a grain, in pixels.
 * `threshold`: the gray level (0..1) that turns black. `edgeNoise`: random jitter of that level.
 * @typedef {{ seed: number, contrast: number, grain: { amount: number, cell: number }, threshold: number, edgeNoise: number, levels: number[] }} LookOptions
 */

/** @type {LookOptions} */
export const lookDefaults = {
  seed: 1,
  contrast: 1.3,
  grain: { amount: 0.18, cell: 3 },
  threshold: 0.5,
  edgeNoise: 0.1,
  levels: [0, 255],
};

/** @type {import('@tranbao0/printshop/core/filters').FilterStep<Pick<LookOptions, 'seed' | 'grain'>>} */
export const grainStep = {
  name: 'grain',
  defaults: { grain: lookDefaults.grain },
  // Moves every gray value along a noise field. The field is tied to the place of the pixel and to the stream `grain`.
  run(work, o, streams) {
    const field = fractalField(work.width, work.height, [[o.grain.cell, 1]], streams.key('grain'));
    for (let i = 0; i < work.gray.length; i++) work.gray[i] = clamp01(work.gray[i] + (field[i] - 0.5) * 2 * o.grain.amount);
  },
};

/** @type {AnyStep[]} */
export const lookSteps = [
  grayStep,
  withDefaults(contrastStep, { contrast: lookDefaults.contrast }),
  grainStep,
  withDefaults(thresholdStep, { threshold: lookDefaults.threshold, edgeNoise: lookDefaults.edgeNoise }),
  withDefaults(levelsStep, { levels: lookDefaults.levels }),
];

/**
 * Turns an RGBA render into black and white.
 * @param {RgbaImage} image
 * @param {Partial<LookOptions>} [options]
 * @returns {GrayImage}
 */
export function look(image, options = {}) {
  return runFilter(lookSteps, image, options);
}

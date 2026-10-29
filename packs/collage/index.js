// The paper collage style pack: scissor-cut and torn paper, drop shadows, holders for flat motifs, tape, mats,
// a halftone print look and the checks that keep a collage honest. See scene.js for the model.
import { checkColourCount, checkDimensions, checkSize } from '../../src/core/checks.js';
import { decodeGrayPng } from '../../src/core/encode.js';
import { collageDefaults, collageFilter, collageSteps } from './filter.js';
import { renderCollage } from './render.js';
import { runCollageChecks } from './checks.js';

export { createScene, makeBuilt, lumaOf, SHADOW, MOTIF_FIT } from './scene.js';
export { EDGE, edgeOutline, scissor, tapePoly, wave } from './edges.js';
export { FLAKES, burstPoly, crescentPoly, noteParts, snowflakeParts, sparklePoly } from './motifs.js';
export { collageDefaults, collageFilter, collageSteps } from './filter.js';
export { PAGE, printCollage, renderCollage } from './render.js';
export * from './checks.js';

/** @typedef {import('../../src/core/types.js').StylePack} StylePack */
/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('../../src/core/render.js').Renderer} Renderer */
/** @typedef {import('./scene.js').Built} Built */

/** The size budget of a collage image, in bytes. */
export const SIZE_BUDGET = 200 * 1024;

/**
 * The checks over a finished image file (the pack contract's `checks`): size, dimensions and colour count.
 * @param {{ png: Buffer, width: number, height: number }} output
 * @param {{ width?: number, height?: number }} [expected] The size that the image must have. Default: no size check.
 * @returns {Promise<CheckResult[]>}
 */
export async function checkOutput({ png, width, height }, expected = {}) {
  const { colours } = await decodeGrayPng(png);
  /** @type {CheckResult[]} */
  const results = [checkSize('collage', png.length, SIZE_BUDGET), checkColourCount('collage', colours, 4)];
  if (expected.width !== undefined && expected.height !== undefined) results.push(checkDimensions('collage', { width, height }, { width: expected.width, height: expected.height }));
  return results;
}

/**
 * Builds a collage: renders it, prints it through the collage look and runs every check.
 * The paper alone (no marks) and the magenta probe are rendered too, for the checks that need them.
 * @param {Renderer} renderer
 * @param {{ build: () => Built }} scene A scene from `createScene`.
 * @param {{ darkest?: string[], allow?: { mark: string, by: string }[], filter?: Partial<import('./filter.js').CollageFilterOptions> }} [options]
 * @returns {Promise<{ built: Built, image: GrayImage, paper: GrayImage, checks: CheckResult[] }>}
 */
export async function buildCollage(renderer, scene, { darkest, allow, filter = {} } = {}) {
  const built = scene.build();
  const opts = { seed: built.seed, ...filter };
  const [final, paperRender, probe] = await Promise.all([
    renderCollage(renderer, built),
    renderCollage(renderer, built, { paper: true }),
    renderCollage(renderer, built, { probe: true }),
  ]);
  const image = collageFilter(final, opts);
  const paper = collageFilter(paperRender, opts);
  const checks = runCollageChecks(built, { paper, probe, darkest, allow, filter });
  return { built, image, paper, checks };
}

/** @type {StylePack} */
export const collagePack = {
  name: 'collage',
  version: '0.1.0',
  filters: collageSteps,
  presets: {
    card: { width: 800, seed: 302, filter: { contrast: collageDefaults.contrast } },
  },
  assets: [],
  checks: (output) => checkOutput(output),
  examples: [
    {
      name: 'collage',
      // The layout is built in code (examples/collage/scene.js) and shown by this host page.
      input: 'page.html',
      preset: 'card',
      seed: 302,
      golden: '../../examples/collage/collage.png',
    },
  ],
};

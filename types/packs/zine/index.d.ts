import { buildPage, buildRansomTitle } from './build.js';
import { budgets } from './checks.js';
export { budgetFor, budgets, checkAnimatedSvg, findSvgProblems } from './checks.js';
export { buildPage, buildRansomTitle };
export { photocopy, photocopyDefaults, photocopySteps } from './photocopy.js';
export { assertHopsClearOf, fanSteps, fitHop, ransomCss, ransomSvg, ransomTimeline } from './ransom-svg.js';
export { svgFramesAt } from './frames.js';
export type StylePack = import('../../src/core/types.js').StylePack;
export type PackAsset = import('../../src/core/types.js').PackAsset;
export type PackExample = import('../../src/core/types.js').PackExample;
export type Renderer = import('../../src/core/render.js').Renderer;
/** @type {StylePack & { budgets: typeof budgets }} */
export declare const zine: StylePack & {
    budgets: typeof budgets;
};
export default zine;
/**
 * Builds one example of the pack from its entry in `zine.examples`, the way a golden test or a build command does.
 * The paths of the entry are relative to this folder. The seed and the preset come from the entry.
 * @param {Renderer} renderer
 * @param {PackExample} example
 * @returns {Promise<{ png: Buffer, width: number, height: number, checks: import('../../src/core/checks.js').CheckResult[], svg?: string, letters?: import('../../src/core/svg-anim.js').Tile[] }>}
 *   `png` is the image of the golden. For a ransom title it is the still, and `svg` is the animated file.
 */
export declare function buildExample(renderer: Renderer, example: PackExample): Promise<{
    png: Buffer;
    width: number;
    height: number;
    checks: import('../../src/core/checks.js').CheckResult[];
    svg?: string;
    letters?: import('../../src/core/svg-anim.js').Tile[];
}>;

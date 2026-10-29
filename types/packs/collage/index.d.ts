export { createScene, makeBuilt, lumaOf, SHADOW, MOTIF_FIT } from './scene.js';
export { EDGE, edgeOutline, scissor, tapePoly, wave } from './edges.js';
export { FLAKES, burstPoly, crescentPoly, noteParts, snowflakeParts, sparklePoly } from './motifs.js';
export { collageDefaults, collageFilter, collageSteps } from './filter.js';
export { PAGE, printCollage, renderCollage } from './render.js';
export * from './checks.js';
export type StylePack = import('../../src/core/types.js').StylePack;
export type CheckResult = import('../../src/core/checks.js').CheckResult;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type Renderer = import('../../src/core/render.js').Renderer;
export type Built = import('./scene.js').Built;
/** @typedef {import('../../src/core/types.js').StylePack} StylePack */
/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('../../src/core/render.js').Renderer} Renderer */
/** @typedef {import('./scene.js').Built} Built */
/** The size budget of a collage image, in bytes. */
export declare const SIZE_BUDGET: number;
/**
 * The checks over a finished image file (the pack contract's `checks`): size, dimensions and colour count.
 * @param {{ png: Buffer, width: number, height: number }} output
 * @param {{ width?: number, height?: number }} [expected] The size that the image must have. Default: no size check.
 * @returns {Promise<CheckResult[]>}
 */
export declare function checkOutput({ png, width, height }: {
    png: Buffer;
    width: number;
    height: number;
}, expected?: {
    width?: number;
    height?: number;
}): Promise<CheckResult[]>;
/**
 * Builds a collage: renders it, prints it through the collage look and runs every check.
 * The paper alone (no marks) and the magenta probe are rendered too, for the checks that need them.
 * @param {Renderer} renderer
 * @param {{ build: () => Built }} scene A scene from `createScene`.
 * @param {{ darkest?: string[], allow?: { mark: string, by: string }[], filter?: Partial<import('./filter.js').CollageFilterOptions> }} [options]
 * @returns {Promise<{ built: Built, image: GrayImage, paper: GrayImage, checks: CheckResult[] }>}
 */
export declare function buildCollage(renderer: Renderer, scene: {
    build: () => Built;
}, { darkest, allow, filter }?: {
    darkest?: string[];
    allow?: {
        mark: string;
        by: string;
    }[];
    filter?: Partial<import('./filter.js').CollageFilterOptions>;
}): Promise<{
    built: Built;
    image: GrayImage;
    paper: GrayImage;
    checks: CheckResult[];
}>;
/** @type {StylePack} */
export declare const collagePack: StylePack;

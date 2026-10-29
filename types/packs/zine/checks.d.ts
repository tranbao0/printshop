export type CheckResult = import('../../src/core/checks.js').CheckResult;
/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */
/**
 * The size budgets of the pack, in bytes. A build fails when a file is over its budget.
 * `ransomSvg`: an animated title with its base image and its letters, all inside the file.
 * `page`: one still page as a palette PNG, 1600 px wide.
 * `card`: one page narrower than 1600 px (for example a 800 px wide card or tag) as a palette PNG.
 */
export declare const budgets: Readonly<{
    ransomSvg: 150000;
    page: 450000;
    card: 200000;
}>;
/**
 * The size budget for a still page of a given width: the `page` budget from 1600 px, the `card` budget below that.
 * @param {number} width
 */
export declare const budgetFor: (width: number) => 200000 | 450000;
/**
 * Finds what an SVG file may not hold: script, event handler attributes, animation of a reference, and any reference to something outside the file.
 * The only references allowed are raster data URIs and fragments (`#id`).
 * @param {string} svg
 * @returns {string[]} One line for each problem found.
 */
export declare function findSvgProblems(svg: string): string[];
/**
 * An animated SVG must hold no script and no external reference, and must stay within its size budget.
 * @param {string} name
 * @param {string} svg
 * @param {number} [maxBytes] Default: the `ransomSvg` budget of the pack.
 * @returns {CheckResult[]}
 */
export declare function checkAnimatedSvg(name: string, svg: string, maxBytes?: number): CheckResult[];

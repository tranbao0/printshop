export type Renderer = import('../../src/core/render.js').Renderer;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type Built = import('./scene.js').Built;
export type CollageFilterOptions = import('./filter.js').CollageFilterOptions;
/** @typedef {import('../../src/core/render.js').Renderer} Renderer */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('./scene.js').Built} Built */
/** @typedef {import('./filter.js').CollageFilterOptions} CollageFilterOptions */
/** The host page that shows the SVG of a collage. */
export declare const PAGE: string;
/**
 * Renders the collage as pixels, before the print filter.
 * `paper: true` leaves the marks out, so the paper alone can be measured. `probe: true` puts magenta behind the page and leaves the safety base sheet out, so a pixel that only the base covers shows too.
 * @param {Renderer} renderer
 * @param {Built} built
 * @param {{ paper?: boolean, probe?: boolean }} [options]
 * @returns {Promise<{ png: Buffer, width: number, height: number, data: Buffer }>}
 */
export declare function renderCollage(renderer: Renderer, built: Built, { paper, probe }?: {
    paper?: boolean;
    probe?: boolean;
}): Promise<{
    png: Buffer;
    width: number;
    height: number;
    data: Buffer;
}>;
/**
 * Renders the collage and prints it: a black and white image.
 * @param {Renderer} renderer
 * @param {Built} built
 * @param {{ paper?: boolean, filter?: Partial<CollageFilterOptions> }} [options]
 * @returns {Promise<GrayImage>}
 */
export declare function printCollage(renderer: Renderer, built: Built, { paper, filter }?: {
    paper?: boolean;
    filter?: Partial<CollageFilterOptions>;
}): Promise<GrayImage>;

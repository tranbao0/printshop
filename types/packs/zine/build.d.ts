export type Renderer = import('../../src/core/render.js').Renderer;
export type CheckResult = import('../../src/core/checks.js').CheckResult;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type RansomMotion = import('./ransom-svg.js').RansomMotion;
export type PageOptions = {
    /**
     * The seed of the photocopy.
     */
    seed: number;
    /**
     * Page width in pixels. Default 1600.
     */
    width?: number;
    /**
     * Options of the photocopy look that override its defaults.
     */
    filterOptions?: Record<string, any>;
    /**
     * Size budget of the PNG. Default: the `page` budget of the pack for 1600 px, the `card` budget below that.
     */
    maxBytes?: number;
};
/** @typedef {import('../../src/core/render.js').Renderer} Renderer */
/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('./ransom-svg.js').RansomMotion} RansomMotion */
/**
 * @typedef {object} PageOptions
 * @property {number} seed The seed of the photocopy.
 * @property {number} [width] Page width in pixels. Default 1600.
 * @property {Record<string, any>} [filterOptions] Options of the photocopy look that override its defaults.
 * @property {number} [maxBytes] Size budget of the PNG. Default: the `page` budget of the pack for 1600 px, the `card` budget below that.
 */
/**
 * Builds one still page: render, photocopy, palette PNG.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {PageOptions} options
 * @returns {Promise<{ png: Buffer, width: number, height: number, checks: CheckResult[] }>}
 */
export declare function buildPage(renderer: Renderer, htmlPath: string, { seed, width, filterOptions, maxBytes }: PageOptions): Promise<{
    png: Buffer;
    width: number;
    height: number;
    checks: CheckResult[];
}>;
export type RansomOptions = {
    /**
     * The seed of the whole title. The base and the tiles take their own seeds from it.
     */
    seed: number;
    /**
     * The accessible name of the SVG.
     */
    label: string;
    /**
     * Page width in pixels. Default 1600.
     */
    width?: number;
    /**
     * The motion of the title. See `RansomMotion`.
     */
    motion?: RansomMotion;
    /**
     * Names (`data-box`) of base layer boxes that no hopping letter may touch.
     */
    avoid?: string[];
    /**
     * Size budget of the SVG. Default: the `ransomSvg` budget of the pack.
     */
    maxBytes?: number;
    /**
     * Options of the photocopy look that override its defaults.
     */
    filterOptions?: Record<string, any>;
};
/**
 * @typedef {object} RansomOptions
 * @property {number} seed The seed of the whole title. The base and the tiles take their own seeds from it.
 * @property {string} label The accessible name of the SVG.
 * @property {number} [width] Page width in pixels. Default 1600.
 * @property {RansomMotion} [motion] The motion of the title. See `RansomMotion`.
 * @property {string[]} [avoid] Names (`data-box`) of base layer boxes that no hopping letter may touch.
 * @property {number} [maxBytes] Size budget of the SVG. Default: the `ransomSvg` budget of the pack.
 * @property {Record<string, any>} [filterOptions] Options of the photocopy look that override its defaults.
 */
/**
 * Builds an animated ransom title from a page with a `base` layer and a `title` layer (see `zine.ransom` in parts.js).
 * The tiles are the elements `data-box="tile-<i>"` of the title layer, so the number of letters comes from the page.
 * Each tile is photocopied as its own page-size layer, as cut and, if the page gives it an `inverse`, flipped.
 * Both clippings use the same seed, so the paper edges wobble the same way and the two line up pixel for pixel.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {RansomOptions} options
 * @returns {Promise<{ svg: string, still: Buffer, base: Buffer, letters: import('../../src/core/svg-anim.js').Tile[], checks: CheckResult[] }>}
 */
export declare function buildRansomTitle(renderer: Renderer, htmlPath: string, { seed, label, width, motion, avoid, maxBytes, filterOptions }: RansomOptions): Promise<{
    svg: string;
    still: Buffer;
    base: Buffer;
    letters: import('../../src/core/svg-anim.js').Tile[];
    checks: CheckResult[];
}>;

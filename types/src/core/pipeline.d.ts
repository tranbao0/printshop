export type Renderer = import('./render.js').Renderer;
export type Zone = import('./render.js').Zone;
export type GrayImage = import('./filters.js').GrayImage;
export type Filter = (image: {
    data: Uint8Array;
    width: number;
    height: number;
}, options: {
    seed: number;
    zones: Zone[];
    [option: string]: any;
}) => GrayImage;
export type CopyOptions = {
    /**
     * Passed to the page as ?layer=... Default `all`.
     */
    layer?: string;
    /**
     * Leave the page background out of the shot.
     */
    transparent?: boolean;
    /**
     * Page width in pixels. Default 1600.
     */
    width?: number;
    /**
     * Available to the page as window.PAGE_DATA.
     */
    data?: unknown;
    /**
     * The seed of the filter.
     */
    seed: number;
    /**
     * The filter to run, for example `photocopy` from the zine pack, or a chain made with `runFilter`.
     */
    filter: Filter;
    /**
     * More options for the filter, for example the overrides of a style preset.
     * The `seed` and the `zones` of the page win over the same names here.
     */
    filterOptions?: Record<string, any>;
};
/** @typedef {import('./render.js').Renderer} Renderer */
/** @typedef {import('./render.js').Zone} Zone */
/** @typedef {import('./filters.js').GrayImage} GrayImage */
/**
 * A filter: it turns an RGBA render into a black and white image.
 * It gets the seed, the calm zones of the page and the `filterOptions` of the call.
 * @typedef {(image: { data: Uint8Array, width: number, height: number }, options: { seed: number, zones: Zone[], [option: string]: any }) => GrayImage} Filter
 */
/**
 * @typedef {object} CopyOptions
 * @property {string} [layer] Passed to the page as ?layer=... Default `all`.
 * @property {boolean} [transparent] Leave the page background out of the shot.
 * @property {number} [width] Page width in pixels. Default 1600.
 * @property {unknown} [data] Available to the page as window.PAGE_DATA.
 * @property {number} seed The seed of the filter.
 * @property {Filter} filter The filter to run, for example `photocopy` from the zine pack, or a chain made with `runFilter`.
 * @property {Record<string, any>} [filterOptions] More options for the filter, for example the overrides of a style preset.
 *   The `seed` and the `zones` of the page win over the same names here.
 */
/**
 * Renders a page layer and runs it through a filter. The calm zones of the page go to the filter.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {CopyOptions} options
 * @returns {Promise<GrayImage>}
 */
export declare function renderCopy(renderer: Renderer, htmlPath: string, { layer, transparent, seed, width, data, filter, filterOptions }: CopyOptions): Promise<GrayImage>;
/**
 * The same, encoded as a palette PNG buffer.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {CopyOptions} options
 * @returns {Promise<Buffer>}
 */
export declare function copyLayer(renderer: Renderer, htmlPath: string, options: CopyOptions): Promise<Buffer>;

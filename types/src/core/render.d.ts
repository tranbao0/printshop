export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type Zone = Box & {
    mode: 'clean' | 'soft' | 'speck';
};
export type RenderOptions = {
    /**
     * Passed to the page as ?layer=..., so a page can hide parts of itself. Default `all`.
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
     * Available to the page as window.PAGE_DATA before its scripts run.
     */
    data?: unknown;
};
export type Rendered = {
    /**
     * The #page element as a PNG.
     */
    png: Buffer;
    /**
     * Boxes of the elements marked data-clean, data-soft or data-nospeck.
     */
    zones: Zone[];
    /**
     * The box of each element with a data-box attribute, by the name in the attribute, for build checks.
     */
    boxes: Record<string, Box>;
};
export type Renderer = {
    /**
     *   Renders the #page element of an HTML file. The page sets body[data-ready] when it is ready.
     */
    render: (htmlPath: string, options?: RenderOptions) => Promise<Rendered>;
    close: () => Promise<void>;
};
/**
 * A box in page pixels, relative to the top left corner of the #page element.
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
/**
 * The calm zone of a page element marked data-clean, data-soft or data-nospeck. See zones.js.
 * @typedef {Box & { mode: 'clean' | 'soft' | 'speck' }} Zone
 */
/**
 * @typedef {object} RenderOptions
 * @property {string} [layer] Passed to the page as ?layer=..., so a page can hide parts of itself. Default `all`.
 * @property {boolean} [transparent] Leave the page background out of the shot.
 * @property {number} [width] Page width in pixels. Default 1600.
 * @property {unknown} [data] Available to the page as window.PAGE_DATA before its scripts run.
 */
/**
 * @typedef {object} Rendered
 * @property {Buffer} png The #page element as a PNG.
 * @property {Zone[]} zones Boxes of the elements marked data-clean, data-soft or data-nospeck.
 * @property {Record<string, Box>} boxes The box of each element with a data-box attribute, by the name in the attribute, for build checks.
 */
/**
 * @typedef {object} Renderer
 * @property {(htmlPath: string, options?: RenderOptions) => Promise<Rendered>} render
 *   Renders the #page element of an HTML file. The page sets body[data-ready] when it is ready.
 * @property {() => Promise<void>} close
 */
/**
 * Opens one shared Chromium for all pages.
 * @returns {Promise<Renderer>}
 */
export declare function openRenderer(): Promise<Renderer>;

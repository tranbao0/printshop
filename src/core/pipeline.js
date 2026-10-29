// Page to pixels to filtered image to encoded file: the steps that most builds run in this order.
import { decodeRgba, encodePalettePng } from './encode.js';
import { photocopy } from './filters.js';

/** @typedef {import('./render.js').Renderer} Renderer */
/** @typedef {import('./filters.js').GrayImage} GrayImage */
/** @typedef {import('./filters.js').PhotocopyOptions} PhotocopyOptions */

/**
 * @typedef {object} CopyOptions
 * @property {string} [layer] Passed to the page as ?layer=... Default `all`.
 * @property {boolean} [transparent] Leave the page background out of the shot.
 * @property {number} [width] Page width in pixels. Default 1600.
 * @property {unknown} [data] Available to the page as window.PAGE_DATA.
 * @property {number} seed The seed of the filter.
 * @property {(image: { data: Uint8Array, width: number, height: number }, options: Partial<PhotocopyOptions>) => GrayImage} [filter]
 *   The filter to run. Default: the photocopy filter.
 */

/**
 * Renders a page layer and runs it through a filter. The calm zones of the page go to the filter.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {CopyOptions} options
 * @returns {Promise<GrayImage>}
 */
export async function renderCopy(renderer, htmlPath, { layer, transparent, seed, width, data, filter = photocopy }) {
  const { png, zones } = await renderer.render(htmlPath, { layer, transparent, width, data });
  return filter(await decodeRgba(png), { seed, zones });
}

/**
 * The same, encoded as a palette PNG buffer.
 * @param {Renderer} renderer
 * @param {string} htmlPath
 * @param {CopyOptions} options
 * @returns {Promise<Buffer>}
 */
export async function copyLayer(renderer, htmlPath, options) {
  return encodePalettePng(await renderCopy(renderer, htmlPath, options));
}

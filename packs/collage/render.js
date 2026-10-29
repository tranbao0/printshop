// Draws a built collage: renders it in Chromium and runs the print filter.
import { fileURLToPath } from 'node:url';
import { decodeRgba } from '../../src/core/encode.js';
import { collageFilter } from './filter.js';

/** @typedef {import('../../src/core/render.js').Renderer} Renderer */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('./scene.js').Built} Built */
/** @typedef {import('./filter.js').CollageFilterOptions} CollageFilterOptions */

/** The host page that shows the SVG of a collage. */
export const PAGE = fileURLToPath(new URL('./page.html', import.meta.url));

/**
 * Renders the collage as pixels, before the print filter.
 * `paper: true` leaves the marks out, so the paper alone can be measured. `probe: true` puts magenta behind the page, so a pixel that no paper covers shows.
 * @param {Renderer} renderer
 * @param {Built} built
 * @param {{ paper?: boolean, probe?: boolean }} [options]
 * @returns {Promise<{ png: Buffer, width: number, height: number, data: Buffer }>}
 */
export async function renderCollage(renderer, built, { paper = false, probe = false } = {}) {
  const { png } = await renderer.render(PAGE, {
    width: built.width,
    data: { svg: built.svg({ marks: !paper }), width: built.width, height: built.height, background: probe ? '#ff00ff' : '#ffffff' },
  });
  const { data, width, height } = await decodeRgba(png);
  if (width !== built.width || height !== built.height) throw new Error(`the page is ${width}x${height}, the collage is ${built.width}x${built.height}`);
  return { png, width, height, data };
}

/**
 * Renders the collage and prints it: a black and white image.
 * @param {Renderer} renderer
 * @param {Built} built
 * @param {{ paper?: boolean, filter?: Partial<CollageFilterOptions> }} [options]
 * @returns {Promise<GrayImage>}
 */
export async function printCollage(renderer, built, { paper = false, filter = {} } = {}) {
  const { data, width, height } = await renderCollage(renderer, built, { paper });
  return collageFilter({ data, width, height }, { seed: built.seed, ...filter });
}

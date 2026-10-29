// Builds zine pages and animated ransom titles: renders a layout, runs it through the photocopy look and encodes the result.
import { assertChecks, checkSize } from '../../src/core/checks.js';
import { compositeGray, cropLayer, encodePalettePng, inkBox } from '../../src/core/encode.js';
import { renderCopy } from '../../src/core/pipeline.js';
import { streamState } from '../../src/core/seed.js';
import { budgetFor, checkAnimatedSvg } from './checks.js';
import { photocopy } from './photocopy.js';
import { assertHopsClearOf, ransomSvg } from './ransom-svg.js';

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
export async function buildPage(renderer, htmlPath, { seed, width = 1600, filterOptions, maxBytes }) {
  const copy = await renderCopy(renderer, htmlPath, { layer: 'all', transparent: false, seed, width, filter: photocopy, filterOptions });
  const png = await encodePalettePng(copy);
  const limit = maxBytes ?? budgetFor(width);
  const checks = [checkSize('page', png.length, limit)];
  return { png, width: copy.width, height: copy.height, checks: assertChecks(checks) };
}

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
export async function buildRansomTitle(renderer, htmlPath, { seed, label, width = 1600, motion, avoid = [], maxBytes, filterOptions }) {
  const baseSeed = streamState(seed, 'ransom.base');
  const tileSeed = streamState(seed, 'ransom.tiles');
  const copy = (/** @type {string} */ layer, /** @type {boolean} */ transparent, /** @type {number} */ s) =>
    renderCopy(renderer, htmlPath, { layer, transparent, seed: s, width, filter: photocopy, filterOptions });

  const baseGray = await copy('base', false, baseSeed);
  const base = await encodePalettePng(baseGray);

  const { boxes } = await renderer.render(htmlPath, { layer: 'title', width });
  const count = Object.keys(boxes).filter((name) => /^tile-\d+$/.test(name)).length;
  if (!count) throw new Error(`${htmlPath}: the title layer has no tile; each letter needs data-box="tile-<i>" (use zine.ransom)`);

  /** @type {import('../../src/core/svg-anim.js').Tile[]} */
  const letters = [];
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const normal = await copy(`title&letter=${i}`, true, tileSeed);
    const twin = await copy(`title&letter=${i}&inverted=1`, true, tileSeed);
    if (!normal.alpha || !twin.alpha) throw new Error(`${htmlPath} letter ${i}: the title layer must be transparent`);
    if (!normal.alpha.every((a, k) => a === twin.alpha?.[k])) throw new Error(`${htmlPath} letter ${i}: the two clippings do not line up`);
    const box = inkBox({ alpha: normal.alpha, width: normal.width, height: normal.height });
    if (box.width <= 0 || box.height <= 0) throw new Error(`${htmlPath} letter ${i}: the tile has no ink`);
    const crop = (/** @type {GrayImage} */ layer) => cropLayer({ gray: layer.gray, alpha: /** @type {Uint8Array} */ (layer.alpha), width: layer.width }, box);
    const flipped = !twin.gray.every((g, k) => g === normal.gray[k]);
    letters.push({
      ...box,
      normal: await encodePalettePng(crop(normal)),
      ...(flipped && { inverted: await encodePalettePng(crop(twin)) }),
    });
    tiles.push(normal);
  }

  if (avoid.length) {
    const { boxes: baseBoxes } = await renderer.render(htmlPath, { layer: 'base', width });
    assertHopsClearOf(Object.fromEntries(avoid.map((name) => [name, baseBoxes[name]])), letters, motion);
  }

  const svg = ransomSvg({ base, letters, width: baseGray.width, height: baseGray.height, label, motion });
  const checks = assertChecks(checkAnimatedSvg('ransom title', svg, maxBytes));
  const still = await encodePalettePng(tiles.reduce((image, tile) => compositeGray(image, tile), /** @type {GrayImage} */ (baseGray)));
  return { svg, still, base, letters, checks };
}

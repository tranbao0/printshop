// Renders HTML pages to pixels with headless Chromium (Playwright).
// The system libraries that Chromium needs must be installed.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

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
export async function openRenderer() {
  const browser = await chromium.launch();
  return {
    async render(htmlPath, { layer = 'all', transparent = false, width = 1600, data } = {}) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      try {
        if (data !== undefined) {
          await page.addInitScript((d) => {
            /** @type {any} */ (window).PAGE_DATA = d;
          }, data);
        }
        const url = `${pathToFileURL(htmlPath).href}?layer=${layer}`;
        await page.goto(url);
        await page.waitForSelector('body[data-ready]', { timeout: 30000 });
        const box = await page.locator('#page').boundingBox();
        if (!box) throw new Error(`${htmlPath}: the page has no #page element with a box`);
        const height = Math.ceil(box.height);
        await page.setViewportSize({ width, height });
        const zones = await page.evaluate(() => {
          const origin = /** @type {HTMLElement} */ (document.getElementById('page')).getBoundingClientRect();
          return [...document.querySelectorAll('[data-clean], [data-soft], [data-nospeck]')].map((el) => {
            const b = el.getBoundingClientRect();
            return { x: b.left - origin.left, y: b.top - origin.top, w: b.width, h: b.height, mode: el.hasAttribute('data-clean') ? 'clean' : el.hasAttribute('data-soft') ? 'soft' : 'speck' };
          });
        });
        const boxes = await page.evaluate(() => {
          const origin = /** @type {HTMLElement} */ (document.getElementById('page')).getBoundingClientRect();
          return Object.fromEntries([...document.querySelectorAll('[data-box]')].map((el) => {
            const b = el.getBoundingClientRect();
            return [/** @type {HTMLElement} */ (el).dataset.box, { x: b.left - origin.left, y: b.top - origin.top, w: b.width, h: b.height }];
          }));
        });
        const png = await page.screenshot({
          clip: { x: 0, y: 0, width, height },
          omitBackground: transparent,
          animations: 'disabled',
        });
        return { png, zones: /** @type {Zone[]} */ (zones), boxes };
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}

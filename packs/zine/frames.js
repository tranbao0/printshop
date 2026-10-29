// Shows an animated SVG at chosen times: loads the file in headless Chromium, pauses every animation at the time and takes a screenshot.
// This checks the motion of a title without waiting for the real time to pass.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

/**
 * Takes a PNG of the SVG at each time.
 * @param {string} svg The SVG document.
 * @param {number[]} times Seconds from the start of the cycle.
 * @param {{ width: number, height: number }} size The size of the SVG.
 * @param {{ reducedMotion?: boolean }} [options] `reducedMotion` loads the page as a reader who asks for less motion.
 * @returns {Promise<Buffer[]>}
 */
export async function svgFramesAt(svg, times, { width, height }, { reducedMotion = false } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'zine-frames-'));
  const browser = await chromium.launch();
  try {
    const file = path.join(dir, 'title.svg');
    await writeFile(file, svg);
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await page.goto(pathToFileURL(file).href);
    /** @type {Buffer[]} */
    const frames = [];
    for (const t of times) {
      await page.evaluate((ms) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = ms;
        }
      }, t * 1000);
      frames.push(await page.screenshot({ clip: { x: 0, y: 0, width, height }, animations: 'allow' }));
    }
    return frames;
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}

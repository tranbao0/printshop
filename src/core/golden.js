// Golden image comparison for the tests of a pack.
// A fresh build is compared with the stored image. Anti-aliasing can differ a little between Chromium builds,
// so the tolerance is global (a share of all pixels) and local (a count of pixels in a small window).
// A mark or a motif is a small part of a page: a global share alone would let a lost glyph pass.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { decodeGrayPng } from './encode.js';

/**
 * @typedef {object} Tolerance
 * @property {number} share At most this share of all pixels may differ.
 * @property {number} window Side of the square window of the local limit, in pixels.
 * @property {number} inWindow At most this many pixels may differ inside one window.
 */

/** @type {Tolerance} */
export const defaultTolerance = { share: 0.0002, window: 16, inWindow: 10 };

/** @typedef {{ gray: Uint8Array, alpha?: Uint8Array | null, width: number, height: number }} GrayLike */

/**
 * Compares two gray images pixel by pixel. The images must have the same size.
 * @param {GrayLike} a
 * @param {GrayLike} b
 * @param {number} [window] Side of the window for `worst`.
 * @returns {{ differing: number, worst: number, at: [number, number] | null }}
 *   `worst`: the most differing pixels in one window, found at `at` (the top left corner of the window).
 */
export function compareGray(a, b, window = defaultTolerance.window) {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`the images differ in size: ${a.width}x${a.height} and ${b.width}x${b.height}`);
  const { width, height } = a;
  const stride = width + 1;
  const sum = new Int32Array(stride * (height + 1));
  let differing = 0;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const d = a.gray[i] !== b.gray[i] || (a.alpha?.[i] ?? 255) !== (b.alpha?.[i] ?? 255) ? 1 : 0;
      differing += d;
      row += d;
      sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + row;
    }
  }
  let worst = 0;
  /** @type {[number, number] | null} */
  let at = null;
  for (let y = 0; y + window <= height; y++) {
    for (let x = 0; x + window <= width; x++) {
      const n = sum[(y + window) * stride + x + window] - sum[y * stride + x + window] - sum[(y + window) * stride + x] + sum[y * stride + x];
      if (n > worst) {
        worst = n;
        at = [x, y];
      }
    }
  }
  return { differing, worst, at };
}

/**
 * Whether a comparison is inside the tolerance.
 * @param {{ differing: number, worst: number }} result
 * @param {number} total The number of pixels of the image.
 * @param {Tolerance} [tolerance]
 */
export function withinTolerance(result, total, tolerance = defaultTolerance) {
  return result.differing / total <= tolerance.share && result.worst <= tolerance.inWindow;
}

/**
 * Tells whether the environment asks to write new golden images: `UPDATE_GOLDENS` is `1` or `true`.
 * Any other value, such as `0` or an empty text, leaves the golden images as they are.
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function updateGoldensRequested(env = process.env) {
  return ['1', 'true'].includes((env.UPDATE_GOLDENS ?? '').trim().toLowerCase());
}

/**
 * Asserts that a PNG equals its golden image within the tolerance.
 * With `update` (default: `UPDATE_GOLDENS` is `1` or `true`, see `updateGoldensRequested`) it writes the PNG as the new golden image instead.
 * Look at the new image before you keep it.
 * @param {Buffer} png The fresh image.
 * @param {string} goldenFile Path of the golden PNG.
 * @param {{ update?: boolean, tolerance?: Tolerance, name?: string }} [options]
 */
export async function assertMatchesGolden(png, goldenFile, { update = updateGoldensRequested(), tolerance = defaultTolerance, name = goldenFile } = {}) {
  if (update) await writeFile(goldenFile, png);
  const fresh = await decodeGrayPng(png);
  const golden = await decodeGrayPng(await readFile(goldenFile));
  assert.deepEqual([fresh.width, fresh.height], [golden.width, golden.height], `${name}: the size differs from the golden image`);
  const result = compareGray(fresh, golden, tolerance.window);
  assert.ok(
    withinTolerance(result, fresh.gray.length, tolerance),
    `${name}: ${result.differing} of ${fresh.gray.length} pixels differ from the golden image; at most ${tolerance.inWindow} may differ in a ${tolerance.window} px window, and ${result.worst} differ in the window at ${result.at}`,
  );
}

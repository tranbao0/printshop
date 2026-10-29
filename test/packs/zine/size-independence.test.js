import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAIR_REACH, photocopy, speckReach } from '../../../packs/zine/photocopy.js';

// Seeded randomness rule: a change in one part of an image must not re-roll random features elsewhere.
// A taller or wider page keeps the features of the part it shares with the smaller one.
// Only the pixels that a feature of the new part can reach differ: a speck centred in the new part stamps up to `speckReach` pixels into the shared part,
// and a speck that overlaps another one can change what the next speck does there.

const white = (/** @type {number} */ width, /** @type {number} */ height) => ({ data: new Uint8Array(width * height * 4).fill(255), width, height });

/**
 * Pixels that differ in the shared top-left part, leaving out `margin` pixels at the bottom and right edges of the shared part.
 * @param {{ gray: Uint8Array, width: number, height: number }} small
 * @param {{ gray: Uint8Array, width: number, height: number }} large
 * @param {number} margin
 */
const differing = (small, large, margin = 0) => {
  let n = 0;
  for (let y = 0; y < small.height - margin; y++) {
    for (let x = 0; x < small.width - margin; x++) if (small.gray[y * small.width + x] !== large.gray[y * large.width + x]) n++;
  }
  return n;
};

const speckMargin = 3 * speckReach(3);
const dark = (/** @type {{ gray: Uint8Array }} */ img) => img.gray.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);

test('a taller page leaves the top of the image as it was', () => {
  const base = { seed: 9, specks: { black: 1 / 700, white: 0, hairs: 1 / 9000 } };
  const a = photocopy(white(400, 240), base);
  const b = photocopy(white(400, 260), base);
  assert.ok(dark(a) > 400, 'the test sheet must get specks and hairs');
  assert.equal(differing(a, b, speckMargin), 0);
});

test('a wider page leaves the left of the image as it was', () => {
  const base = { seed: 9, specks: { black: 1 / 700, white: 0, hairs: 1 / 9000 } };
  const a = photocopy(white(400, 240), base);
  const b = photocopy(white(420, 240), base);
  assert.equal(differing(a, b, speckMargin), 0);
});

test('the hairs of a taller or wider page are the same hairs, also where they reach in from the new part', () => {
  const base = { seed: 12, specks: { black: 0, white: 0, hairs: 1 / 2500 } };
  const a = photocopy(white(300, 200), base);
  assert.ok(dark(a) > 100, 'the test sheet must get hairs');
  assert.equal(differing(a, photocopy(white(300, 330), base)), 0);
  assert.equal(differing(a, photocopy(white(430, 200), base)), 0);
  assert.ok(HAIR_REACH > 60, 'the pages above are larger than the reach of a hair');
});

test('without specks and hairs, a taller or wider page keeps the noise of the shared part', () => {
  // The seed fixes the toner patches, the grain, the streaks and the threshold jitter.
  const base = { seed: 9, specks: { black: 0, white: 0, hairs: 0 } };
  const a = photocopy(white(400, 240), base);
  assert.equal(differing(a, photocopy(white(400, 260), base)), 0);
  assert.equal(differing(a, photocopy(white(430, 240), base)), 0);
  assert.ok(dark(a) > 0, 'the test sheet must get marks from the grain and the streaks');
});

test('a taller page keeps the bleed and the dots of a gray sheet away from the new rows', () => {
  const gray = (/** @type {number} */ h) => ({ data: new Uint8Array(300 * h * 4).fill(150).map((v, i) => (i % 4 === 3 ? 255 : v)), width: 300, height: h });
  const base = { seed: 4, specks: { black: 0, white: 0, hairs: 0 } };
  const a = photocopy(gray(200), base);
  assert.equal(differing(a, photocopy(gray(230), base), 6), 0);
});

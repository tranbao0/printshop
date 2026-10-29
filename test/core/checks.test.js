import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertChecks, blackShare, checkColourCount, checkCoverage, checkDimensions, checkSize, checkSlivers, checkTonalGap, countProbePixels, findSlivers,
} from '../../src/core/checks.js';

/** A grid mask with the given rectangles [x, y, w, h] set to 1. */
const mask = (/** @type {number} */ w, /** @type {number} */ h, /** @type {number[][]} */ rects) => {
  const m = new Uint8Array(w * h);
  for (const [x, y, rw, rh] of rects) for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) m[j * w + i] = 1;
  return m;
};

test('size budget: passes within the limit and fails over it', () => {
  assert.equal(checkSize('cover', 1000, 1000).ok, true);
  const over = checkSize('cover', 1001, 1000);
  assert.equal(over.ok, false);
  assert.match(over.message, /1001 bytes is over the 1000 byte limit/);
});

test('dimensions: pass on the exact size and fail on any other', () => {
  assert.equal(checkDimensions('avatar', { width: 1000, height: 1000 }, { width: 1000, height: 1000 }).ok, true);
  const bad = checkDimensions('avatar', { width: 1000, height: 999 }, { width: 1000, height: 1000 });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /1000x999, expected 1000x1000/);
});

test('colour count: takes a number or a set', () => {
  assert.equal(checkColourCount('tag', new Set([1, 2, 3, 4]), 4).ok, true);
  assert.equal(checkColourCount('tag', 4, 4).ok, true);
  const bad = checkColourCount('tag', new Set([1, 2, 3, 4, 5]), 4);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /5 colours is over the limit of 4/);
});

test('coverage: a page with no probe colour passes and a page with magenta fails', () => {
  const clean = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]);
  assert.equal(countProbePixels(clean), 0);
  assert.equal(checkCoverage('collage', 0).ok, true);
  const bare = new Uint8Array([255, 255, 255, 255, 255, 0, 255, 255, 250, 10, 240, 255]);
  assert.equal(countProbePixels(bare), 2);
  const result = checkCoverage('collage', countProbePixels(bare));
  assert.equal(result.ok, false);
  assert.match(result.message, /2 pixels have no paper/);
});

test('coverage: reads three-channel pixels and a custom probe colour', () => {
  const rgb = new Uint8Array([0, 255, 0, 255, 255, 255]);
  assert.equal(countProbePixels(rgb, 3, (r, g, b) => g > 200 && r < 50 && b < 50), 1);
});

test('black share: counts dark pixels under the mask, inside an optional circle', () => {
  const gray = new Uint8Array(10 * 10).fill(255);
  for (let x = 0; x < 5; x++) gray[x] = 0; // the top row, left half
  const row = mask(10, 10, [[0, 0, 10, 1]]);
  assert.deepEqual(blackShare(gray, 10, row), { share: 0.5, n: 10 });
  const circle = blackShare(gray, 10, mask(10, 10, [[0, 0, 10, 10]]), { circle: { cx: 5, cy: 5, r: 2 } });
  assert.equal(circle.share, 0);
  assert.ok(circle.n > 8 && circle.n < 20);
  assert.deepEqual(blackShare(gray, 10, new Uint8Array(100)), { share: 0, n: 0 });
});

test('tonal gap: passes when the shares are far enough apart and fails when they are not or cannot be measured', () => {
  assert.equal(checkTonalGap('nose', { share: 0.8, n: 500 }, { share: 0.3, n: 500 }, 0.25).ok, true);
  const alike = checkTonalGap('nose', { share: 0.5, n: 500 }, { share: 0.4, n: 500 }, 0.25);
  assert.equal(alike.ok, false);
  assert.match(alike.message, /0\.10 apart, needs at least 0\.25/);
  const few = checkTonalGap('nose', { share: 0.9, n: 99 }, { share: 0, n: 500 }, 0.25);
  assert.equal(few.ok, false);
  assert.match(few.message, /too few pixels/);
});

test('slivers: a solid block has none', () => {
  const found = findSlivers(mask(60, 60, [[5, 5, 40, 40]]), 60, 60);
  assert.deepEqual(found.slivers, []);
  assert.equal(checkSlivers('scrap', found).ok, true);
});

test('slivers: a long thin band is found with its length and place', () => {
  // Cells are 2 px, so a band of 2 cells is 4 px wide and 40 cells are about 80 px long.
  const found = findSlivers(mask(60, 60, [[5, 5, 40, 2], [5, 20, 30, 30]]), 60, 60);
  assert.equal(found.slivers.length, 1);
  const [sliver] = found.slivers;
  assert.ok(sliver.length >= 70 && sliver.length <= 80, `length ${sliver.length}`);
  assert.deepEqual(sliver.from, [10, 10]);
  const result = checkSlivers('scrap', found);
  assert.equal(result.ok, false);
  assert.match(result.message, /thinner than 8 px/);
});

test('slivers: a short thin tip is not a sliver, and the limits can be set', () => {
  const shortTip = mask(60, 60, [[5, 5, 10, 2], [5, 20, 30, 30]]);
  assert.deepEqual(findSlivers(shortTip, 60, 60).slivers, []);
  assert.equal(findSlivers(shortTip, 60, 60, { minLength: 10 }).slivers.length, 1);
  const band = mask(60, 60, [[5, 5, 40, 3]]);
  assert.equal(findSlivers(band, 60, 60, { minWidth: 5 }).slivers.length, 0);
  assert.equal(findSlivers(band, 60, 60, { minWidth: 8 }).slivers.length, 1);
  assert.equal(findSlivers(band, 60, 60, { step: 1, minWidth: 8 }).slivers.length, 0);
  assert.equal(findSlivers(band, 60, 60, { step: 1, minWidth: 8, minLength: 30 }).slivers.length, 1);
});

test('assertChecks: returns the results when all pass and lists every failure otherwise', () => {
  const ok = [checkSize('a', 1, 2)];
  assert.equal(assertChecks(ok), ok);
  assert.throws(() => assertChecks([checkSize('a', 3, 2), checkSize('b', 1, 2), checkColourCount('c', 9, 4)]), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /^2 checks failed:/);
    assert.match(error.message, /a size: 3 bytes is over/);
    assert.match(error.message, /c colours: 9 colours/);
    assert.doesNotMatch(error.message, /b size/);
    return true;
  });
  assert.throws(() => assertChecks([checkSize('a', 3, 2)]), /^Error: 1 check failed:/);
});

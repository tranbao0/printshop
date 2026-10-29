import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertMatchesGolden, compareGray, defaultTolerance, withinTolerance } from '../../src/core/golden.js';
import { encodePalettePng } from '../../src/core/encode.js';

/** A white image of 40 by 40 with the pixels at the given places black. */
const image = (/** @type {[number, number][]} */ black) => {
  const gray = new Uint8Array(40 * 40).fill(255);
  for (const [x, y] of black) gray[y * 40 + x] = 0;
  return { gray, alpha: null, width: 40, height: 40 };
};

test('compareGray counts the differing pixels and the most in one window', () => {
  const same = compareGray(image([[3, 3]]), image([[3, 3]]));
  assert.deepEqual(same, { differing: 0, worst: 0, at: null });
  const some = compareGray(image([[3, 3], [4, 3], [30, 30]]), image([]), 8);
  assert.equal(some.differing, 3);
  assert.equal(some.worst, 2);
  assert.throws(() => compareGray(image([]), { ...image([]), width: 39 }), /differ in size/);
});

test('the tolerance is a share of all pixels and a count in a window, so one lost mark cannot hide in a big page', () => {
  const total = 1600 * 1000;
  assert.equal(withinTolerance({ differing: 100, worst: 5 }, total), true);
  assert.equal(withinTolerance({ differing: 100, worst: defaultTolerance.inWindow + 1 }, total), false);
  assert.equal(withinTolerance({ differing: 0.01 * total, worst: 1 }, total), false);
  assert.equal(withinTolerance({ differing: 1, worst: 1 }, total, { share: 0, window: 16, inWindow: 0 }), false);
});

test('assertMatchesGolden passes an equal image, fails a changed one and writes the golden image when asked', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'printshop-golden-'));
  try {
    const golden = path.join(dir, 'golden.png');
    const png = await encodePalettePng(image([[3, 3]]));
    await writeFile(golden, png);
    await assertMatchesGolden(png, golden, { update: false });
    const lots = await encodePalettePng(image(Array.from({ length: 20 }, (_, i) => /** @type {[number, number]} */ ([i, 5]))));
    await assert.rejects(assertMatchesGolden(lots, golden, { update: false, name: 'lots' }), /lots: 21 of 1600 pixels differ/);
    await assert.rejects(assertMatchesGolden(await encodePalettePng({ ...image([]), width: 20, height: 80 }), golden, { update: false }), /size differs/);
    await assertMatchesGolden(lots, golden, { update: true });
    assert.deepEqual(await readFile(golden), lots);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

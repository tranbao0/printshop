import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { copyLayer, renderCopy } from '../../src/core/pipeline.js';
import { decodeGrayPng, encodePalettePng } from '../../src/core/encode.js';
import { decodeRgba } from '../../src/core/encode.js';
import { bleedStep, contrastStep, grayStep, runFilter, thresholdStep, zonesStep } from '../../src/core/filters.js';

// A small filter made of core steps, so these tests do not depend on a style pack.
/** @type {import('../../src/core/filters.js').FilterStep<any>[]} */
const steps = [grayStep, contrastStep, zonesStep, bleedStep, thresholdStep];
/** @type {import('../../src/core/pipeline.js').Filter} */
const photocopy = (image, options) => runFilter(steps, image, options);

const page = fileURLToPath(new URL('./fixtures/page.html', import.meta.url));

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

test('renderCopy renders the page and runs the filter with the zones of the page', async () => {
  const { png, zones } = await renderer.render(page, { width: 400 });
  const expected = photocopy(await decodeRgba(png), { seed: 8, zones });
  const copy = await renderCopy(renderer, page, { seed: 8, width: 400, filter: photocopy });
  assert.deepEqual(copy.gray, expected.gray);
  assert.equal(copy.alpha, null);
});

test('renderCopy keeps the alpha of a transparent layer', async () => {
  const copy = await renderCopy(renderer, page, { seed: 8, width: 400, layer: 'cutout', transparent: true, filter: photocopy });
  assert.ok(copy.alpha);
  assert.equal(copy.alpha[10 * 400 + 10], 0);
  assert.equal(copy.alpha[200 * 400 + 300], 255);
});

test('renderCopy runs the filter it is given', async () => {
  /** @type {unknown[]} */
  const seen = [];
  const copy = await renderCopy(renderer, page, {
    seed: 3,
    width: 400,
    filter: (image, options) => {
      seen.push(options.seed, options.zones?.length);
      return { gray: new Uint8Array(image.width * image.height).fill(255), alpha: null, width: image.width, height: image.height };
    },
  });
  assert.deepEqual(seen, [3, 3]);
  assert.ok(copy.gray.every((v) => v === 255));
});

test('filterOptions reach the filter, and the seed and the zones of the page win', async () => {
  /** @type {Record<string, unknown>[]} */
  const seen = [];
  /** @type {import('../../src/core/pipeline.js').Filter} */
  const filter = (image, options) => {
    seen.push(options);
    return { gray: new Uint8Array(image.width * image.height), alpha: null, width: image.width, height: image.height };
  };
  await renderCopy(renderer, page, { seed: 3, width: 400, filter, filterOptions: { levels: [0, 128, 255], seed: 99, zones: [] } });
  assert.deepEqual(seen[0].levels, [0, 128, 255]);
  assert.equal(seen[0].seed, 3);
  assert.equal(/** @type {unknown[]} */ (seen[0].zones).length, 3);
});

test('a filter option given to copyLayer changes the output', async () => {
  const base = { seed: 8, width: 400, filter: photocopy };
  const plain = await copyLayer(renderer, page, base);
  const snapped = await copyLayer(renderer, page, { ...base, filterOptions: { contrast: 3 } });
  assert.ok(!plain.equals(snapped));
  const same = await copyLayer(renderer, page, { ...base, filterOptions: {} });
  assert.ok(plain.equals(same));
});

test('copyLayer gives a palette PNG of the same copy', async () => {
  const options = { seed: 8, width: 400, filter: photocopy };
  const png = await copyLayer(renderer, page, options);
  assert.ok(png.equals(await encodePalettePng(await renderCopy(renderer, page, options))));
  const decoded = await decodeGrayPng(png);
  assert.deepEqual([decoded.width, decoded.height], [400, 300]);
  assert.ok(decoded.colours.size <= 4);
});

test('the same page and seed give the same file twice', async () => {
  const a = await copyLayer(renderer, page, { seed: 17, width: 400, filter: photocopy });
  const b = await copyLayer(renderer, page, { seed: 17, width: 400, filter: photocopy });
  assert.ok(a.equals(b));
});

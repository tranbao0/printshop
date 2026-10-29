import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { copyLayer, renderCopy } from '../../src/core/pipeline.js';
import { decodeGrayPng, encodePalettePng } from '../../src/core/encode.js';
import { photocopy } from '../../src/core/filters.js';
import { decodeRgba } from '../../src/core/encode.js';

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
  const copy = await renderCopy(renderer, page, { seed: 8, width: 400 });
  assert.deepEqual(copy.gray, expected.gray);
  assert.equal(copy.alpha, null);
});

test('renderCopy keeps the alpha of a transparent layer', async () => {
  const copy = await renderCopy(renderer, page, { seed: 8, width: 400, layer: 'cutout', transparent: true });
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

test('copyLayer gives a palette PNG of the same copy', async () => {
  const options = { seed: 8, width: 400 };
  const png = await copyLayer(renderer, page, options);
  assert.ok(png.equals(await encodePalettePng(await renderCopy(renderer, page, options))));
  const decoded = await decodeGrayPng(png);
  assert.deepEqual([decoded.width, decoded.height], [400, 300]);
  assert.ok(decoded.colours.size <= 4);
});

test('the same page and seed give the same file twice', async () => {
  const a = await copyLayer(renderer, page, { seed: 17, width: 400 });
  const b = await copyLayer(renderer, page, { seed: 17, width: 400 });
  assert.ok(a.equals(b));
});

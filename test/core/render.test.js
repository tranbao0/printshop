import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { decodeRgba } from '../../src/core/encode.js';

const fixture = (/** @type {string} */ name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const page = fixture('page.html');

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

// The stored images are the reference renders of the test page.
// The pixels are compared, not the PNG bytes, because the bytes depend on the deflate library of the browser build.
const samePixels = async (/** @type {Buffer} */ png, /** @type {string} */ goldenName) => {
  const a = await decodeRgba(png);
  const b = await decodeRgba(await readFile(fixture(goldenName)));
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.ok(Buffer.from(a.data).equals(Buffer.from(b.data)), `${goldenName}: the pixels differ`);
};

test('renders the #page element at the page size', async () => {
  const { png } = await renderer.render(page, { width: 400 });
  await samePixels(png, 'render-all.png');
  const { width, height } = await decodeRgba(png);
  assert.deepEqual([width, height], [400, 300]);
});

test('reports the calm zones and the named boxes in page pixels', async () => {
  const { zones, boxes } = await renderer.render(page, { width: 400 });
  const meta = JSON.parse(await readFile(fixture('render-meta.json'), 'utf8'));
  assert.deepEqual(zones, meta.all.zones);
  assert.deepEqual(boxes, meta.all.boxes);
  assert.deepEqual(zones.map((z) => z.mode), ['clean', 'soft', 'speck']);
  assert.deepEqual(boxes.header, { x: 20, y: 20, w: 120, h: 60 });
});

test('passes the layer to the page and keeps the background out of the shot when transparent', async () => {
  const { png } = await renderer.render(page, { layer: 'cutout', transparent: true, width: 400 });
  await samePixels(png, 'render-cutout.png');
  const { data } = await decodeRgba(png);
  const alphaAt = (/** @type {number} */ x, /** @type {number} */ y) => data[(y * 400 + x) * 4 + 3];
  assert.equal(alphaAt(10, 10), 0);
  assert.equal(alphaAt(300, 200), 255);
});

test('makes window.PAGE_DATA available to the page before its scripts run', async () => {
  const { png } = await renderer.render(page, { width: 400, data: { swatch: '#0a0' } });
  await samePixels(png, 'render-data.png');
});

test('sizes the shot to the width asked for', async () => {
  const { png } = await renderer.render(page, { width: 800 });
  const { width, height } = await decodeRgba(png);
  assert.deepEqual([width, height], [800, 300]);
});

test('a page that does not exist fails', async () => {
  await assert.rejects(renderer.render(fixture('missing-page.html'), { width: 400 }));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compositeGray, cropLayer, decodeGrayPng, decodeRgba, encodePalettePng, inkBox } from '../../src/core/encode.js';

const fixture = (/** @type {string} */ name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// The pattern that made the stored files: stripes and a dotted band, with a transparent frame in the alpha case.
const W = 64;
const H = 48;
const gray = new Uint8Array(W * H);
const alpha = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    gray[i] = (x >> 3) % 2 ? 0 : 255;
    if (y > 30) gray[i] = (x + y) % 5 === 0 ? 255 : 0;
    alpha[i] = x < 8 || y < 6 ? 0 : 255;
  }
}

test('an opaque layer encodes to the stored palette PNG, byte for byte', async () => {
  const png = await encodePalettePng({ gray, width: W, height: H });
  assert.ok(png.equals(await readFile(fixture('encode-opaque.png'))));
});

test('a layer with alpha encodes to the stored palette PNG, byte for byte', async () => {
  const png = await encodePalettePng({ gray, alpha, width: W, height: H });
  assert.ok(png.equals(await readFile(fixture('encode-alpha.png'))));
});

test('the encoded file is an indexed PNG with pure gray entries only', async () => {
  const png = await encodePalettePng({ gray, alpha, width: W, height: H });
  assert.equal(png[25], 3, 'colour type 3 is a palette PNG');
  const decoded = await decodeGrayPng(png);
  for (const c of decoded.colours) {
    const r = c & 255;
    const g = (c >> 8) & 255;
    const b = (c >> 16) & 255;
    assert.ok(r === g && g === b, `entry ${c.toString(16)} is not gray`);
  }
  assert.ok(decoded.colours.size <= 4);
});

test('decoding gives back the gray values and the alpha channel', async () => {
  const decoded = await decodeGrayPng(await encodePalettePng({ gray, alpha, width: W, height: H }));
  assert.deepEqual(decoded.alpha, alpha);
  const inked = gray.map((v, i) => (alpha[i] ? v : 0));
  assert.deepEqual(decoded.gray, inked);
  assert.deepEqual([decoded.width, decoded.height], [W, H]);
});

test('the palette size can be set', async () => {
  const three = new Uint8Array(W * H).map((_, i) => [0, 128, 255][i % 3]);
  const small = await decodeGrayPng(await encodePalettePng({ gray: three, width: W, height: H, colours: 3 }));
  assert.equal(small.colours.size, 3);
  const tight = await decodeGrayPng(await encodePalettePng({ gray: three, width: W, height: H, colours: 2 }));
  assert.equal(tight.colours.size, 2);
});

test('decodeRgba gives raw RGBA with an alpha byte', async () => {
  const img = await decodeRgba(await encodePalettePng({ gray, alpha, width: W, height: H }));
  assert.equal(img.data.length, W * H * 4);
  assert.equal(img.data[3], 0);
  assert.equal(img.data[(10 * W + 20) * 4 + 3], 255);
});

test('compositeGray puts the opaque pixels of a layer over the base', () => {
  const base = { gray: new Uint8Array([255, 255, 255, 255]), width: 2, height: 2 };
  const layer = { gray: new Uint8Array([0, 0, 0, 0]), alpha: new Uint8Array([255, 0, 128, 127]) };
  assert.deepEqual(compositeGray(base, layer).gray, new Uint8Array([0, 255, 0, 255]));
  assert.deepEqual(compositeGray(base, { gray: layer.gray, alpha: null }).gray, new Uint8Array([0, 0, 0, 0]));
});

test('inkBox is the box of the opaque pixels and cropLayer cuts that box out', () => {
  const alphaIn = new Uint8Array(10 * 8);
  const grayIn = new Uint8Array(10 * 8);
  for (const [x, y] of [[3, 2], [6, 2], [4, 5]]) {
    alphaIn[y * 10 + x] = 255;
    grayIn[y * 10 + x] = 200 + x;
  }
  const box = inkBox({ alpha: alphaIn, width: 10, height: 8 });
  assert.deepEqual(box, { x: 3, y: 2, width: 4, height: 4 });
  const cut = cropLayer({ gray: grayIn, alpha: alphaIn, width: 10 }, box);
  assert.deepEqual([cut.width, cut.height], [4, 4]);
  assert.equal(cut.gray[0], 203);
  assert.equal(cut.gray[3], 206);
  assert.equal(cut.alpha[3 * 4 + 1], 255);
  assert.equal(cut.alpha.reduce((n, v) => n + (v ? 1 : 0), 0), 3);
});

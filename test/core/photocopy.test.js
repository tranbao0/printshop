import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { photocopy, photocopyDefaults, photocopySteps } from '../../src/core/photocopy.js';
import { runFilter } from '../../src/core/filters.js';
import { decodeGrayPng, decodeRgba } from '../../src/core/encode.js';

const fixture = (/** @type {string} */ name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// A plain white sheet. The cheap toner specks are the only thing that can mark it.
const white = (/** @type {number} */ width, /** @type {number} */ height) => ({ data: new Uint8Array(width * height * 4).fill(255), width, height });
const flatGray = (/** @type {number} */ width, /** @type {number} */ height, /** @type {number} */ value) => ({
  data: new Uint8Array(width * height * 4).fill(value).map((v, i) => (i % 4 === 3 ? 255 : v)),
  width,
  height,
});

const heavy = { specks: { black: 1 / 150, white: 0, hairs: 1 / 4000 }, toner: { weak: 0, weakFrom: 0.1, streaks: 0, streakStrength: 0 } };
const noSpecks = { black: 0, white: 0, hairs: 0 };

/** @param {Uint8Array} a @param {Uint8Array} b */
const differing = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

test('a speck zone stays free of specks and hairs', () => {
  const zone = { x: 80, y: 60, w: 120, h: 80, mode: /** @type {const} */ ('speck') };
  // The grain of the toner can leave a lone dark pixel on a white sheet, so the zone is compared with the same sheet without specks and hairs.
  const plain = photocopy(white(400, 240), { ...heavy, specks: noSpecks, seed: 7, zones: [zone] });
  const { gray, width } = photocopy(white(400, 240), { ...heavy, seed: 7, zones: [zone] });
  let inside = 0;
  let outside = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] === plain.gray[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) inside++;
    else outside++;
  }
  assert.equal(inside, 0);
  assert.ok(outside > 0, 'the test sheet must get specks outside the zone');
});

test('without zones the filter gives the same result as with an empty list', () => {
  const a = photocopy(white(200, 120), { ...heavy, seed: 3 });
  const b = photocopy(white(200, 120), { ...heavy, seed: 3, zones: [] });
  assert.deepEqual(a.gray, b.gray);
});

test('a clean zone drops the dot screen', () => {
  const none = { specks: noSpecks, edgeNoise: 0, toner: { weak: 0, weakFrom: 0.1, streaks: 0, streakStrength: 0 } };
  const screened = photocopy(flatGray(120, 120, 160), { ...none, seed: 5 });
  const clean = photocopy(flatGray(120, 120, 160), { ...none, seed: 5, zones: [{ x: 0, y: 0, w: 120, h: 120, mode: 'clean' }] });
  const dots = (/** @type {{ gray: Uint8Array }} */ img) => img.gray.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
  assert.ok(dots(screened) > 0 && dots(screened) < 120 * 120, 'a mid gray makes dots under the screen');
  assert.equal(dots(clean), 0, 'a clean zone makes a flat threshold, so a pale gray turns white');
});

test('the same seed gives the same photocopy and another seed gives another', () => {
  const sheet = flatGray(160, 120, 140);
  const a = photocopy(sheet, { seed: 21 });
  assert.deepEqual(a.gray, photocopy(sheet, { seed: 21 }).gray);
  assert.ok(differing(a.gray, photocopy(sheet, { seed: 22 }).gray) > 100);
});

test('the result is black and white, and has an alpha channel only for translucent input', () => {
  const opaque = photocopy(flatGray(80, 60, 128), { seed: 2 });
  assert.equal(opaque.alpha, null);
  assert.ok(opaque.gray.every((v) => v === 0 || v === 255));
  const input = flatGray(80, 60, 128);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 40; x++) input.data[(y * 80 + x) * 4 + 3] = 0;
  const cut = photocopy(input, { seed: 2 });
  assert.ok(cut.alpha);
  assert.ok(cut.alpha.every((v) => v === 0 || v === 255));
  assert.equal(cut.alpha[30 * 80 + 5], 0);
  assert.equal(cut.alpha[30 * 80 + 70], 255);
});

test('three or more levels snap the black and white output to the nearest level', () => {
  const out = photocopy(flatGray(60, 40, 128), { seed: 2, levels: [30, 100, 200] });
  assert.ok(out.gray.every((v) => v === 30 || v === 200));
  assert.ok(out.gray.includes(30) && out.gray.includes(200));
});

test('a chain needs a threshold step', () => {
  const steps = photocopySteps.filter((s) => ['gray', 'contrast'].includes(s.name));
  assert.throws(() => runFilter(steps, white(10, 10)), /threshold/);
});

test('the options are the defaults of the steps, overridden by the call', () => {
  const merged = Object.assign({}, ...photocopySteps.map((s) => s.defaults));
  assert.deepEqual({ seed: 1, ...merged }, photocopyDefaults);
  const a = photocopy(flatGray(60, 40, 128));
  const b = photocopy(flatGray(60, 40, 128), photocopyDefaults);
  assert.deepEqual(a.gray, b.gray);
});

// Seeded randomness rule: a change in one part of an image must not re-roll the random features of another part.

test('a speck that does not land does not re-roll the specks after it', () => {
  const sheet = white(400, 240);
  const options = { ...heavy, seed: 13 };
  const zone = { x: 60, y: 40, w: 100, h: 60, mode: /** @type {const} */ ('speck') };
  const free = photocopy(sheet, options);
  const kept = photocopy(sheet, { ...options, zones: [zone] });
  // Specks that fall in or beside the zone are skipped. Every speck farther away than the padding and the reach of a speck stays as it was.
  const margin = 30;
  let compared = 0;
  for (let i = 0; i < free.gray.length; i++) {
    const x = i % 400;
    const y = Math.floor(i / 400);
    const near = x >= zone.x - margin && x < zone.x + zone.w + margin && y >= zone.y - margin && y < zone.y + zone.h + margin;
    if (near) continue;
    compared++;
    if (free.gray[i] !== kept.gray[i]) assert.fail(`pixel ${x},${y} changed although it lies ${margin} px from the zone`);
  }
  assert.ok(compared > 400 * 240 / 2);
  assert.ok(differing(free.gray, kept.gray) > 0, 'the zone must have removed some specks');
});

test('a change in the bleed, the screen or the toner leaves the specks and hairs where they were', () => {
  const sheet = white(300, 200);
  const base = { seed: 31, edgeNoise: 0, specks: { black: 1 / 700, white: 0, hairs: 1 / 9000 }, toner: { weak: 0, weakFrom: 0.1, streaks: 0, streakStrength: 0 } };
  const a = photocopy(sheet, base);
  assert.ok(a.gray.some((v) => v === 0), 'the test sheet must get specks');
  const b = photocopy(sheet, { ...base, bleed: { amount: 3, cell: 7 }, halftone: { cell: 9, angle: 30, low: 0.12, high: 0.88 }, contrast: 2 });
  assert.deepEqual(b.gray, a.gray);
});

test('the hairs of a tile draw from the stream of the tile, so more hairs leave the first ones as they were', () => {
  const sheet = white(400, 300);
  const base = { seed: 4, specks: { black: 0, white: 0, hairs: 3.2 / 120000 } };
  const few = photocopy(sheet, base);
  const more = photocopy(sheet, { ...base, specks: { black: 0, white: 0, hairs: 5.2 / 120000 } });
  let lost = 0;
  let fewCount = 0;
  let moreCount = 0;
  for (let i = 0; i < few.gray.length; i++) {
    if (few.gray[i] === 0) fewCount++;
    if (more.gray[i] === 0) moreCount++;
    if (few.gray[i] === 0 && more.gray[i] !== 0) lost++;
  }
  assert.ok(fewCount > 40, 'the first hairs must draw');
  assert.ok(moreCount > fewCount, 'the other hairs must draw');
  // A later hair that crosses an earlier one flips the pixels where they cross back, but the earlier hairs stay.
  assert.ok(lost <= 6, `${lost} pixels of the first hairs are gone`);
});

// The stored photocopies were made by this module, to catch changes and platform differences.
// They are not a comparison with the profile generator: its filter draws every random feature from one shared sequence,
// and the seeded randomness rule (one named stream per purpose) gives other numbers. The render and encode references are the profile ones.
test('the photocopy of the test page equals the stored result', async () => {
  const page = await decodeRgba(await readFile(fixture('render-all.png')));
  const { zones } = JSON.parse(await readFile(fixture('render-meta.json'), 'utf8')).all;
  const golden = await decodeGrayPng(await readFile(fixture('photocopy-all.png')));
  const out = photocopy(page, { seed: 5, zones });
  assert.equal(out.width, golden.width);
  assert.equal(differing(out.gray, golden.gray), 0);
});

test('the photocopy of the transparent test layer equals the stored result', async () => {
  const page = await decodeRgba(await readFile(fixture('render-cutout.png')));
  const { zones } = JSON.parse(await readFile(fixture('render-meta.json'), 'utf8')).cutout;
  const golden = await decodeGrayPng(await readFile(fixture('photocopy-cutout.png')));
  const out = photocopy(page, { seed: 6, zones });
  assert.ok(out.alpha);
  assert.equal(differing(out.alpha, golden.alpha), 0);
  // The encoder blanks the gray value of transparent pixels, so only the pixels with ink are compared.
  const inked = out.gray.map((v, i) => (out.alpha?.[i] ? v : 0));
  assert.equal(differing(inked, golden.gray), 0);
});

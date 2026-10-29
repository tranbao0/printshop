import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noiseField, fractalField, latticeValue, layerKey } from '../../src/core/noise.js';
import { createStreams } from '../../src/core/seed.js';

const key = (/** @type {string} */ name) => createStreams(1).key(name);

test('a noise field has the size of the image and values in 0..1', () => {
  const f = noiseField(37, 23, 5, key('a'));
  assert.equal(f.length, 37 * 23);
  assert.ok(f.every((v) => v >= 0 && v <= 1));
});

test('a noise field is the same for the same key and differs for another', () => {
  assert.deepEqual(noiseField(30, 30, 6, key('a')), noiseField(30, 30, 6, key('a')));
  assert.notDeepEqual(noiseField(30, 30, 6, key('a')), noiseField(30, 30, 6, key('b')));
});

test('a noise field is smooth: neighbouring pixels differ by less than one cell step', () => {
  const f = noiseField(60, 60, 10, key('a'));
  let worst = 0;
  for (let y = 0; y < 60; y++) for (let x = 1; x < 60; x++) worst = Math.max(worst, Math.abs(f[y * 60 + x] - f[y * 60 + x - 1]));
  assert.ok(worst < 0.2, `largest step ${worst}`);
});

test('the grid values are well spread: mean near one half, no link between neighbours', () => {
  const k = key('spread');
  let sum = 0;
  let cross = 0;
  const n = 200;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const v = latticeValue(k, gx, gy);
      sum += v;
      cross += (v - 0.5) * (latticeValue(k, gx + 1, gy) - 0.5) + (v - 0.5) * (latticeValue(k, gx, gy + 1) - 0.5);
    }
  }
  assert.ok(Math.abs(sum / (n * n) - 0.5) < 0.01, `mean ${sum / (n * n)}`);
  assert.ok(Math.abs(cross / (2 * n * n)) < 0.005, `neighbour correlation ${cross / (2 * n * n)}`);
});

test('a fractal field is the weighted sum of its layers, and every layer has its own values', () => {
  const layers = /** @type {[number, number][]} */ ([[12, 0.5], [12, 0.5]]);
  const k = key('f');
  const first = noiseField(40, 40, 12, layerKey(k, 0));
  const second = noiseField(40, 40, 12, layerKey(k, 1));
  assert.notDeepEqual(first, second);
  const sum = fractalField(40, 40, layers, k);
  for (let i = 0; i < sum.length; i++) assert.ok(Math.abs(sum[i] - (first[i] * 0.5 + second[i] * 0.5)) < 1e-6);
});

test('a taller or wider image keeps the noise of the part it shares with a smaller one', () => {
  const layers = /** @type {[number, number][]} */ ([[20, 0.6], [7, 0.4]]);
  const small = fractalField(100, 70, layers, key('f'));
  const tall = fractalField(100, 95, layers, key('f'));
  const wide = fractalField(130, 70, layers, key('f'));
  for (let y = 0; y < 70; y++) {
    for (let x = 0; x < 100; x++) {
      assert.equal(tall[y * 100 + x], small[y * 100 + x]);
      assert.equal(wide[y * 130 + x], small[y * 100 + x]);
    }
  }
});

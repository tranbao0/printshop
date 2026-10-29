import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noiseField, fractalField } from '../../src/core/noise.js';
import { createStreams } from '../../src/core/seed.js';

const stream = (/** @type {string} */ name) => createStreams(1).stream(name);

test('a noise field has the size of the image and values in 0..1', () => {
  const f = noiseField(37, 23, 5, stream('a'));
  assert.equal(f.length, 37 * 23);
  assert.ok(f.every((v) => v >= 0 && v <= 1));
});

test('a noise field is the same for the same stream and differs for another', () => {
  assert.deepEqual(noiseField(30, 30, 6, stream('a')), noiseField(30, 30, 6, stream('a')));
  assert.notDeepEqual(noiseField(30, 30, 6, stream('a')), noiseField(30, 30, 6, stream('b')));
});

test('a noise field is smooth: neighbouring pixels differ by less than one cell step', () => {
  const f = noiseField(60, 60, 10, stream('a'));
  let worst = 0;
  for (let y = 0; y < 60; y++) for (let x = 1; x < 60; x++) worst = Math.max(worst, Math.abs(f[y * 60 + x] - f[y * 60 + x - 1]));
  assert.ok(worst < 0.2, `largest step ${worst}`);
});

test('a fractal field is the weighted sum of its layers', () => {
  const layers = /** @type {[number, number][]} */ ([[12, 0.5], [4, 0.5]]);
  const rand = stream('f');
  const first = noiseField(40, 40, 12, rand);
  const second = noiseField(40, 40, 4, rand);
  const sum = fractalField(40, 40, layers, stream('f'));
  for (let i = 0; i < sum.length; i++) assert.ok(Math.abs(sum[i] - (first[i] * 0.5 + second[i] * 0.5)) < 1e-6);
});

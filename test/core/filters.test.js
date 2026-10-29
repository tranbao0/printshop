import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bleedStep, contrastStep, displace, grayStep, levelsStep, runFilter, thresholdStep, withDefaults, zonesStep } from '../../src/core/filters.js';
import { createStreams } from '../../src/core/seed.js';

/** A chain of steps with their own option types. */
const chain = (/** @type {import('../../src/core/filters.js').FilterStep<any>[]} */ ...steps) => steps;

const flatGray = (/** @type {number} */ width, /** @type {number} */ height, /** @type {number} */ value) => ({
  data: new Uint8Array(width * height * 4).fill(value).map((v, i) => (i % 4 === 3 ? 255 : v)),
  width,
  height,
});

/** @param {Uint8Array} a @param {Uint8Array} b */
const differing = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

test('a chain needs a step that makes black and white output', () => {
  assert.throws(() => runFilter(chain(grayStep, contrastStep), flatGray(10, 10, 100)), /threshold/);
});

test('a plain chain cuts the gray values at the threshold', () => {
  const steps = chain(grayStep, thresholdStep);
  assert.ok(runFilter(steps, flatGray(20, 20, 100)).gray.every((v) => v === 0));
  assert.ok(runFilter(steps, flatGray(20, 20, 200)).gray.every((v) => v === 255));
  assert.ok(runFilter(steps, flatGray(20, 20, 100), { threshold: 0.3 }).gray.every((v) => v === 255));
});

test('the contrast step spreads the gray values around mid gray', () => {
  const steps = chain(grayStep, withDefaults(contrastStep, { contrast: 3 }), thresholdStep);
  assert.ok(runFilter(steps, flatGray(20, 20, 140)).gray.every((v) => v === 255));
  assert.ok(runFilter(steps, flatGray(20, 20, 115)).gray.every((v) => v === 0));
  // The call overrides the default of the step.
  assert.ok(runFilter(steps, flatGray(20, 20, 140), { contrast: 1 }).gray.every((v) => v === 255));
});

test('the threshold jitter comes from the stream edges and changes with the seed', () => {
  const steps = chain(grayStep, thresholdStep);
  const sheet = flatGray(120, 120, 128);
  const a = runFilter(steps, sheet, { edgeNoise: 0.4, seed: 1 });
  assert.ok(a.gray.includes(0) && a.gray.includes(255), 'a mid gray must break up under a jittered threshold');
  assert.deepEqual(a.gray, runFilter(steps, sheet, { edgeNoise: 0.4, seed: 1 }).gray);
  assert.ok(differing(a.gray, runFilter(steps, sheet, { edgeNoise: 0.4, seed: 2 }).gray) > 100);
});

test('the threshold step cuts a translucent input into an alpha mask', () => {
  const input = flatGray(20, 10, 0);
  for (let i = 0; i < 100; i++) input.data[i * 4 + 3] = i % 20 < 10 ? 0 : 255;
  const out = runFilter(chain(grayStep, thresholdStep), input);
  assert.ok(out.alpha);
  assert.equal(out.alpha[0], 0);
  assert.equal(out.alpha[15], 255);
});

test('the levels step snaps the output to the nearest allowed level', () => {
  const steps = chain(grayStep, thresholdStep, levelsStep);
  const mixed = flatGray(40, 40, 0);
  for (let i = 0; i < 800; i++) mixed.data.fill(255, i * 4, i * 4 + 3);
  const out = runFilter(steps, mixed, { levels: [30, 100, 200] });
  assert.ok(out.gray.every((v) => v === 30 || v === 200));
  assert.ok(out.gray.includes(30) && out.gray.includes(200));
  assert.ok(runFilter(steps, mixed).gray.every((v) => v === 0 || v === 255));
});

test('the options are the defaults of the steps, overridden by the call', () => {
  const merged = Object.assign({}, ...[grayStep, contrastStep, zonesStep, bleedStep, thresholdStep, levelsStep].map((s) => s.defaults));
  assert.deepEqual(Object.keys(merged).sort(), ['bleed', 'calm', 'contrast', 'edgeNoise', 'levels', 'threshold', 'zonePad', 'zones']);
  assert.equal(withDefaults(contrastStep, { contrast: 2 }).defaults.contrast, 2);
  assert.equal(contrastStep.defaults.contrast, 1, 'withDefaults does not change the step it copies');
});

test('displace moves pixels along noise and holds a keep mask of zero still', () => {
  const src = new Float32Array(50 * 50);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) src[y * 50 + x] = x < 25 ? 0 : 1;
  const streams = createStreams(1);
  const moved = displace(src, 50, 50, 3, 8, streams, 'wobble');
  assert.ok(differing(new Uint8Array(src.map((v) => v * 255)), new Uint8Array(moved.map((v) => v * 255))) > 0);
  const held = displace(src, 50, 50, 3, 8, streams, 'wobble', new Float32Array(50 * 50));
  assert.deepEqual(held, src);
});

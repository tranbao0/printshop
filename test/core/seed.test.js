import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, createStreams, hashName, streamState } from '../../src/core/seed.js';

/** @param {() => number} rand @param {number} n */
const draw = (rand, n) => Array.from({ length: n }, () => rand());

test('createRng gives numbers in [0, 1) and the same sequence for the same seed', () => {
  const a = draw(createRng(42), 1000);
  assert.ok(a.every((v) => v >= 0 && v < 1));
  assert.deepEqual(a, draw(createRng(42), 1000));
  assert.notDeepEqual(a.slice(0, 5), draw(createRng(43), 5));
});

test('createRng matches the known mulberry32 sequence', () => {
  // Values of mulberry32 for seed 1, as 32-bit integers. They pin the generator, so an image of a given seed never changes by accident.
  const rand = createRng(1);
  assert.deepEqual([rand(), rand(), rand()].map((v) => Math.round(v * 4294967296)), [2693262067, 11749833, 2265367787]);
});

test('the same seed and name give the same sequence on every call', () => {
  const streams = createStreams(7);
  assert.deepEqual(draw(streams.stream('specks'), 50), draw(streams.stream('specks'), 50));
  assert.deepEqual(draw(streams.stream('specks'), 50), draw(createStreams(7).stream('specks'), 50));
});

test('a different seed, name or index gives a different sequence', () => {
  const base = draw(createStreams(7).stream('specks'), 20);
  assert.notDeepEqual(base, draw(createStreams(8).stream('specks'), 20));
  assert.notDeepEqual(base, draw(createStreams(7).stream('edges'), 20));
  assert.notDeepEqual(base, draw(createStreams(7).stream('specks', 1), 20));
  assert.notDeepEqual(draw(createStreams(7).stream('hairs', 1), 20), draw(createStreams(7).stream('hairs', 2), 20));
});

test('the key of a stream is its start state, and changes with seed, name and index', () => {
  const streams = createStreams(7);
  assert.equal(streams.key('specks', 3), streamState(7, 'specks', 3));
  assert.equal(streams.key('specks'), streams.key('specks', 0));
  assert.notEqual(streams.key('specks'), streams.key('edges'));
  assert.notEqual(streams.key('specks'), createStreams(8).key('specks'));
  assert.notEqual(streams.key('specks', 1), streams.key('specks', 2));
});

test('index 0 is the stream without an index', () => {
  const streams = createStreams(3);
  assert.deepEqual(draw(streams.stream('hairs'), 10), draw(streams.stream('hairs', 0), 10));
});

test('drawing from one stream leaves another stream where it was', () => {
  const streams = createStreams(11);
  const wobble = streams.stream('wobble');
  const before = draw(streams.stream('edges'), 10);
  draw(wobble, 100000);
  assert.deepEqual(draw(streams.stream('edges'), 10), before);
});

test('an item with its own index draws the same numbers however many draws other items take', () => {
  const streams = createStreams(5);
  const third = draw(streams.stream('hairs', 2), 8);
  for (const k of [0, 1, 3, 4]) draw(streams.stream('hairs', k), 1000);
  assert.deepEqual(draw(streams.stream('hairs', 2), 8), third);
});

test('the streams are well spread: close seeds and indexes start far apart', () => {
  const starts = new Set();
  for (let seed = 0; seed < 50; seed++) for (let index = 0; index < 50; index++) starts.add(streamState(seed, 'specks', index));
  assert.equal(starts.size, 2500);
  assert.equal(new Set(['a', 'b', 'ab', 'ba', ''].map(hashName)).size, 5);
});

test('the mean of a stream is near one half', () => {
  const values = draw(createStreams(1).stream('grain'), 20000);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.01, `mean ${mean}`);
});

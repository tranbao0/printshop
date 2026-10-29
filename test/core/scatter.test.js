import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, countFor, tiles } from '../../src/core/scatter.js';
import { createRng, createStreams } from '../../src/core/seed.js';

test('countFor gives the whole part, and one more with the probability of the fraction', () => {
  const rand = createRng(5);
  let total = 0;
  const runs = 20000;
  for (let i = 0; i < runs; i++) {
    const n = countFor(rand, 2.25);
    assert.ok(n === 2 || n === 3);
    total += n;
  }
  assert.ok(Math.abs(total / runs - 2.25) < 0.02, `mean ${total / runs}`);
  assert.equal(countFor(() => 0.99, 3), 3);
  assert.equal(countFor(() => 0.5, 0), 0);
});

/** @param {number} width @param {number} height @param {number} reach */
const visited = (width, height, reach) => [...tiles(createStreams(3), 't', width, height, 0.001, reach)].map((t) => `${t.x0},${t.y0}:${t.count}`);

test('a tile has the same count in every image size, and the tiles come in reading order', () => {
  const small = visited(200, 130, 10);
  const large = visited(330, 260, 10);
  for (const tile of small) assert.ok(large.includes(tile), `${tile} is missing from the larger image`);
  const order = [...tiles(createStreams(3), 't', 200, 130, 0.001, 10)].map((t) => [t.y0, t.x0]);
  assert.deepEqual(order, [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
});

test('the tiles reach every item that can touch the image, and the first tile lies above and left of the image', () => {
  const list = [...tiles(createStreams(3), 't', 200, 130, 0.001, 70)];
  assert.ok(list.some((t) => t.x0 < 0 && t.y0 < 0));
  assert.ok(list.some((t) => t.x0 + TILE > 200 + 70 - TILE && t.y0 + TILE > 130 + 70 - TILE));
  assert.ok(Math.min(...list.map((t) => t.x0)) <= -70);
  assert.ok(Math.max(...list.map((t) => t.x0)) >= 200 + 70 - TILE);
});

test('each tile has its own stream', () => {
  const list = [...tiles(createStreams(3), 't', 300, 300, 0, 0)];
  assert.equal(new Set(list.map((t) => t.rand())).size, list.length);
});

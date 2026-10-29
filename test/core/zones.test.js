import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildZoneMasks, calmAt, calmDefaults, touches, zoneMask, zonePadDefaults } from '../../src/core/zones.js';

/** @type {import('../../src/core/render.js').Zone[]} */
const zones = [
  { x: 10, y: 10, w: 20, h: 10, mode: 'clean' },
  { x: 50, y: 10, w: 20, h: 10, mode: 'soft' },
  { x: 10, y: 40, w: 10, h: 10, mode: 'speck' },
];

test('without zones there are no masks', () => {
  assert.equal(buildZoneMasks([], zonePadDefaults, 100, 60), null);
  assert.equal(calmAt(null, calmDefaults, 0), null);
});

test('a zone mask covers the zone and its padding, and nothing else', () => {
  const mask = zoneMask([zones[0]], ['clean'], zonePadDefaults, 100, 60);
  const at = (/** @type {number} */ x, /** @type {number} */ y) => mask[y * 100 + x];
  assert.equal(at(10, 10), 1);
  assert.equal(at(6, 6), 1); // 4 px of padding
  assert.equal(at(5, 10), 0);
  assert.equal(at(30 + 3, 19), 1);
  assert.equal(at(30 + 4, 19), 0);
});

test('a zone mask ignores the modes it was not asked for', () => {
  const mask = zoneMask(zones, ['speck'], zonePadDefaults, 100, 60);
  assert.equal(mask[15 * 100 + 15], 0);
  assert.equal(mask[45 * 100 + 15], 1);
});

test('a zone near the edge is cut to the image', () => {
  const mask = zoneMask([{ x: -5, y: -5, w: 20, h: 20, mode: 'clean' }], ['clean'], zonePadDefaults, 30, 30);
  assert.equal(mask[0], 1);
  assert.equal(mask.length, 900);
});

test('the speck mask holds every mode and the calm mask holds clean and soft', () => {
  const masks = /** @type {NonNullable<ReturnType<typeof buildZoneMasks>>} */ (buildZoneMasks(zones, zonePadDefaults, 100, 60));
  assert.equal(masks.speck[15 * 100 + 15], 1);
  assert.equal(masks.speck[15 * 100 + 55], 1);
  assert.equal(masks.speck[45 * 100 + 15], 1);
  assert.equal(calmAt(masks, calmDefaults, 15 * 100 + 15), calmDefaults.clean);
  assert.equal(calmAt(masks, calmDefaults, 15 * 100 + 55), calmDefaults.soft);
  assert.equal(calmAt(masks, calmDefaults, 45 * 100 + 15), null);
  assert.equal(calmAt(masks, calmDefaults, 55 * 100 + 90), null);
});

test('touches finds a marked pixel within reach of a speck and ignores a far one', () => {
  const mask = new Uint8Array(100 * 100);
  mask[50 * 100 + 60] = 1;
  assert.equal(touches(mask, 100, 100, 56, 50, 1), true);
  assert.equal(touches(mask, 100, 100, 20, 50, 1), false);
  // A larger speck reaches further.
  assert.equal(touches(mask, 100, 100, 50, 50, 1), false);
  assert.equal(touches(mask, 100, 100, 50, 50, 5), true);
});

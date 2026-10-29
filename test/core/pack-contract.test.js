import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photocopySteps } from '../../src/core/photocopy.js';
import { checkSize } from '../../src/core/checks.js';

/** @typedef {import('../../src/core/types.js').StylePack} StylePack */

// A pack of the shape that the contract asks for. The `@type {StylePack}` annotation is checked by `tsc`: a change to the contract that breaks a pack, such as a missing or an extra part, stops the type check.
// The test below runs the parts that the contract describes.
/** @type {StylePack} */
const pack = {
  name: 'example',
  version: '0.0.0',
  filters: photocopySteps,
  presets: { card: { width: 800, seed: 1, filter: { contrast: 1.2 } } },
  assets: [{ name: 'Example Sans', kind: 'font', file: 'fonts/example.woff2', license: 'OFL-1.1', licenseFile: 'fonts/OFL.txt' }],
  checks: ({ png }) => [checkSize('example', png.length, 1000)],
  examples: [{ name: 'card', input: 'examples/card.html', preset: 'card', seed: 1, golden: 'examples/card.png' }],
};

test('a pack has the parts of the contract', async () => {
  assert.ok(pack.filters.every((step) => typeof step.name === 'string' && typeof step.run === 'function' && typeof step.defaults === 'object'));
  const results = await pack.checks({ png: Buffer.alloc(10), width: 1, height: 1 });
  assert.equal(results[0].ok, true);
  assert.ok(pack.examples.every((e) => e.preset in pack.presets));
});

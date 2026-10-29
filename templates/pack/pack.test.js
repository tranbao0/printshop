// The golden test of the pack: every example builds with its preset and equals its golden image.
// If a change is meant to alter the picture, look at the new image and update the golden image:
//   UPDATE_GOLDENS=1 node --test pack.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '@tranbao0/printshop/core/render';
import { assertMatchesGolden } from '@tranbao0/printshop/core/golden';
import { buildPackExample, examplePath, importPack } from '@tranbao0/printshop/core/pack-runner';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@tranbao0/printshop/core/render').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

test('the pack has the parts of the contract, and its files exist', async () => {
  const loaded = await importPack(path.join(here, 'index.js'));
  const { pack } = loaded;
  assert.ok(pack.name && pack.version);
  assert.ok(pack.filters.length > 0 && pack.filters.every((step) => typeof step.name === 'string' && typeof step.run === 'function' && typeof step.defaults === 'object'));
  assert.ok(pack.examples.length > 0);
  for (const example of pack.examples) {
    assert.ok(example.preset in pack.presets, `${example.name}: the preset ${example.preset} exists`);
    await access(examplePath(loaded, example.input));
    await access(examplePath(loaded, example.golden));
  }
  for (const asset of pack.assets) {
    await access(path.join(here, asset.file));
    assert.ok((await readFile(path.join(here, asset.licenseFile), 'utf8')).length > 0, `${asset.name}: the license text is there`);
  }
});

test('every example builds, passes the checks and equals its golden image', async () => {
  const loaded = await importPack(path.join(here, 'index.js'));
  for (const example of loaded.pack.examples) {
    const built = await buildPackExample(renderer, loaded, example);
    const failed = built.checks.filter((c) => !c.ok);
    assert.deepEqual(failed, [], `${example.name}: failed checks:\n${failed.map((c) => `${c.name}: ${c.message}`).join('\n')}`);
    await assertMatchesGolden(built.png, examplePath(loaded, example.golden), { name: example.name });
  }
});

test('the same seed gives the same image, and another seed gives another image', async () => {
  const loaded = await importPack(path.join(here, 'index.js'));
  const example = loaded.pack.examples[0];
  const [a, b, c] = await Promise.all([1, 1, 2].map((seed) => buildPackExample(renderer, loaded, { ...example, seed })));
  assert.ok(a.png.equals(b.png));
  assert.ok(!a.png.equals(c.png));
});

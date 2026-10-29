import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { buildPackExample, examplePath, findExample, importPack, isPack, listPackFiles, loadPack, PACKAGE_ROOT } from '../../src/core/pack-runner.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

test('the package root is the repository root, and the packs of the package are listed', async () => {
  assert.equal(path.resolve(PACKAGE_ROOT), path.resolve(root));
  const names = (await listPackFiles('/nonexistent')).map((p) => p.name);
  assert.deepEqual(names, ['collage', 'zine']);
});

test('isPack tells a pack from other values', async () => {
  assert.equal(isPack(null), false);
  assert.equal(isPack({ name: 'x' }), false);
  assert.equal(isPack({ name: 'x', filters: [], presets: {}, examples: [], checks: () => [] }), true);
  const zine = await loadPack('zine', root);
  assert.equal(zine.pack.name, 'zine');
  assert.equal(typeof zine.module.buildExample, 'function');
  // The collage pack has no default export; it is found by its shape.
  const collage = await loadPack('collage', root);
  assert.equal(collage.pack.name, 'collage');
  assert.equal((await loadPack('packs/collage', root)).pack.name, 'collage');
  assert.equal((await loadPack('./packs/collage/index.js', root)).pack.name, 'collage');
  await assert.rejects(loadPack('missing', root), /no pack named "missing" \(known packs: collage, zine\)/);
  await assert.rejects(loadPack('./packs/missing', root), /no pack at/);
  await assert.rejects(importPack(path.join(root, 'src/core/seed.js')), /exports no style pack/);
});

test('an example is found by its layout file or by its build module', async () => {
  const collage = await loadPack('collage', root);
  const byInput = await findExample(collage, path.join(root, 'examples/collage/scene.js'));
  const byBuild = await findExample(collage, path.join(root, 'examples/collage/build.js'));
  assert.equal(byInput?.name, 'collage');
  assert.equal(byBuild?.name, 'collage');
  assert.equal(await findExample(collage, path.join(root, 'examples/zine-page/page.html')), undefined);
  assert.equal(examplePath(collage, '../../examples/collage/scene.js'), path.join(root, 'examples/collage/scene.js'));
  // An absolute file URL names a file outside the folder of the pack.
  assert.equal(examplePath(collage, 'file:///tmp/a%20b.html'), '/tmp/a b.html');
});

test('an example of a pack without a build entry or a buildExample is printed through the filters of the pack', async () => {
  const loaded = await importPack(path.join(root, 'templates/pack/index.js'));
  const built = await buildPackExample(renderer, loaded, loaded.pack.examples[0]);
  assert.deepEqual([built.width, built.height], [800, 500]);
  assert.ok(built.checks.length > 0 && built.checks.every((c) => c.ok));
  await assert.rejects(buildPackExample(renderer, loaded, { ...loaded.pack.examples[0], kind: 'poster' }), /no build for the kind "poster"/);
  await assert.rejects(buildPackExample(renderer, loaded, { ...loaded.pack.examples[0], preset: 'poster' }), /no preset "poster"/);
});

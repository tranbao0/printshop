import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { decodeGrayPng, encodePalettePng } from '../../src/core/encode.js';
import { collagePack, checkOutput, SIZE_BUDGET } from '../../packs/collage/index.js';
import { buildExample } from '../../examples/collage/build.js';
import { HEIGHT, WIDTH } from '../../examples/collage/scene.js';

// Golden image of the example collage: examples/collage/collage.png. After a change that is meant to alter the picture, look at the new image and update it:
//   UPDATE_GOLDENS=1 node --test test/packs/collage.test.js
// The pixels are compared with a small tolerance, because anti-aliasing differs a little between Chromium builds.
const TOLERANCE = 0.004;

const packFile = (/** @type {string} */ rel) => fileURLToPath(new URL(`../../packs/collage/${rel}`, import.meta.url));

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

test('the example collage builds, passes every collage check and matches its golden image', async () => {
  const example = collagePack.examples[0];
  const golden = packFile(example.golden);
  const { image, checks, built } = await buildExample(renderer, example.seed);
  const failed = checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], `failed checks:\n${failed.map((c) => `${c.name}: ${c.message}`).join('\n')}`);
  assert.deepEqual([built.width, built.height], [WIDTH, HEIGHT]);
  const names = checks.map((c) => c.name);
  for (const exact of ['marks inside', 'marks margin', 'hidden marks', 'motif holders', 'flat motifs', 'motif margin', 'hidden pieces', 'base sheet', 'collage coverage', 'gray neighbours']) {
    assert.ok(names.includes(exact), `the check "${exact}" ran`);
  }
  for (const prefix of ['black-left slivers', 'shadow flake-top', 'tone stripes', 'gray #']) assert.ok(names.some((n) => n.startsWith(prefix)), `a check "${prefix}..." ran`);
  const png = await encodePalettePng(image);
  if (process.env.UPDATE_GOLDENS) await writeFile(golden, png);
  const a = await decodeGrayPng(png);
  const b = await decodeGrayPng(await readFile(golden));
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  let differing = 0;
  for (let i = 0; i < a.gray.length; i++) if (a.gray[i] !== b.gray[i]) differing++;
  assert.ok(differing / a.gray.length <= TOLERANCE, `${differing} of ${a.gray.length} pixels differ from the golden image`);
});

test('the example builds the same picture twice, and another seed gives another picture', async () => {
  const a = await buildExample(renderer, 302);
  const b = await buildExample(renderer, 302);
  const c = await buildExample(renderer, 303);
  assert.deepEqual(a.image.gray, b.image.gray);
  assert.notDeepEqual(a.image.gray, c.image.gray);
});

test('the output checks pass the golden image and fail an image of the wrong size or with too many colours', async () => {
  const golden = await readFile(packFile(collagePack.examples[0].golden));
  assert.ok(golden.length < SIZE_BUDGET);
  const good = await checkOutput({ png: golden, width: WIDTH, height: HEIGHT }, { width: WIDTH, height: HEIGHT });
  assert.ok(good.every((r) => r.ok), JSON.stringify(good));
  const wrong = await checkOutput({ png: golden, width: WIDTH, height: HEIGHT - 1 }, { width: WIDTH, height: HEIGHT });
  assert.equal(wrong.find((r) => r.name === 'collage dimensions')?.ok, false);
  const { default: sharp } = await import('sharp');
  const noisy = await sharp(Buffer.from(Uint8Array.from({ length: 16 * 16 * 3 }, (_, i) => (i * 37) % 256)), { raw: { width: 16, height: 16, channels: 3 } }).png().toBuffer();
  assert.equal((await checkOutput({ png: noisy, width: 16, height: 16 })).find((r) => r.name === 'collage colours')?.ok, false);
});

test('the pack has the parts of the contract, and its files exist', async () => {
  assert.equal(collagePack.name, 'collage');
  assert.ok(collagePack.filters.every((s) => typeof s.name === 'string' && typeof s.run === 'function' && typeof s.defaults === 'object'));
  assert.deepEqual(collagePack.assets, [], 'the pack ships no fonts or textures, so there are no licenses to carry');
  for (const e of collagePack.examples) {
    assert.ok(e.preset in collagePack.presets);
    assert.equal(collagePack.presets[e.preset].width, WIDTH);
    await access(packFile(e.input));
    await access(packFile(e.golden));
  }
});

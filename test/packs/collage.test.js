import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { updateGoldensRequested } from '../../src/core/golden.js';
import { decodeGrayPng, encodePalettePng } from '../../src/core/encode.js';
import { collagePack, buildCollage, checkOutput, SIZE_BUDGET } from '../../packs/collage/index.js';
import { DARKEST_TILES, exampleScene, HEIGHT, WIDTH } from '../../examples/collage/scene.js';

// Golden image of the example collage: examples/collage/collage.png. After a change that is meant to alter the picture, look at the new image and update it:
//   UPDATE_GOLDENS=1 node --test test/packs/collage.test.js
// The example is built through the pack contract (`collagePack.examples`, its preset and its build entry), the same way a generic runner builds it.
// The pixels are compared with a small tolerance, because anti-aliasing can differ a little between Chromium builds. The tolerance is local as well as global:
// a mark or a motif is a small part of the page, so a share of the whole page alone would let a lost glyph pass.
// The build with the headless shell and with the full Chromium of the same Playwright version gives 0 differing pixels.
/** At most this share of all pixels may differ. */
const MAX_SHARE = 0.0002;
/** No square window of `WINDOW` px per side may hold more than `MAX_IN_WINDOW` differing pixels. */
const WINDOW = 16;
const MAX_IN_WINDOW = 10;

const packFile = (/** @type {string} */ rel) => fileURLToPath(new URL(`../../packs/collage/${rel}`, import.meta.url));

/**
 * Compares two gray images pixel by pixel.
 * @param {{ gray: Uint8Array, width: number, height: number }} a
 * @param {{ gray: Uint8Array, width: number, height: number }} b
 * @returns {{ differing: number, worst: number, at: [number, number] | null }} `worst`: the most differing pixels in one window, found at `at` (its top left corner).
 */
function compare(a, b) {
  const { width, height } = a;
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  const stride = width + 1;
  const sum = new Int32Array(stride * (height + 1));
  let differing = 0;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const d = a.gray[y * width + x] !== b.gray[y * width + x] ? 1 : 0;
      differing += d;
      row += d;
      sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + row;
    }
  }
  let worst = 0;
  /** @type {[number, number] | null} */
  let at = null;
  for (let y = 0; y + WINDOW <= height; y++) {
    for (let x = 0; x + WINDOW <= width; x++) {
      const n = sum[(y + WINDOW) * stride + x + WINDOW] - sum[y * stride + x + WINDOW] - sum[(y + WINDOW) * stride + x] + sum[y * stride + x];
      if (n > worst) {
        worst = n;
        at = [x, y];
      }
    }
  }
  return { differing, worst, at };
}

/** @param {{ differing: number, worst: number }} r @param {number} total */
const within = (r, total) => r.differing / total <= MAX_SHARE && r.worst <= MAX_IN_WINDOW;

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

/**
 * Builds an example through the contract: the module named by `build`, the seed of the example and the filter of its preset.
 * @param {import('../../src/core/types.js').PackExample} example
 */
async function buildThroughContract(example) {
  assert.ok(example.build, 'the example names a build entry');
  const mod = await import(pathToFileURL(packFile(example.build)).href);
  return /** @type {import('../../src/core/types.js').PackBuildFn} */ (mod.default)(renderer, { seed: example.seed, filter: collagePack.presets[example.preset].filter });
}

test('the example collage builds through the pack contract, passes every collage check and matches its golden image', async () => {
  const example = collagePack.examples[0];
  const golden = packFile(example.golden);
  const { image, checks, built } = /** @type {Awaited<ReturnType<typeof buildCollage>>} */ (await buildThroughContract(example));
  const failed = checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], `failed checks:\n${failed.map((c) => `${c.name}: ${c.message}`).join('\n')}`);
  assert.deepEqual([built.width, built.height], [WIDTH, HEIGHT]);
  const names = checks.map((c) => c.name);
  for (const exact of ['marks inside', 'marks margin', 'hidden marks', 'motif holders', 'flat motifs', 'motif margin', 'hidden pieces', 'base sheet', 'collage coverage', 'gray neighbours']) {
    assert.ok(names.includes(exact), `the check "${exact}" ran`);
  }
  for (const prefix of ['black-left slivers', 'shadow flake-top', 'tone stripes', 'gray #']) assert.ok(names.some((n) => n.startsWith(prefix)), `a check "${prefix}..." ran`);
  const png = await encodePalettePng(image);
  const outputChecks = await collagePack.checks({ png, width: image.width, height: image.height });
  assert.deepEqual(outputChecks.filter((c) => !c.ok), []);
  if (updateGoldensRequested()) await writeFile(golden, png);
  const a = await decodeGrayPng(png);
  const b = await decodeGrayPng(await readFile(golden));
  const r = compare(a, b);
  assert.ok(within(r, a.gray.length), `${r.differing} of ${a.gray.length} pixels differ from the golden image; at most ${MAX_IN_WINDOW} in a ${WINDOW} px window, and ${r.worst} in the window at ${r.at}`);
});

test('the golden comparison fails when one mark or one motif is lost', async () => {
  const example = collagePack.examples[0];
  const b = await decodeGrayPng(await readFile(packFile(example.golden)));
  /** @param {(built: import('../../packs/collage/index.js').Built) => void} change */
  const buildWith = async (change) => {
    const scene = exampleScene(example.seed);
    const { image } = await buildCollage(renderer, { build: () => { const built = scene.build(); change(built); return built; } }, { darkest: DARKEST_TILES });
    return compare(image, b);
  };
  // Marks are not part of the paper render, so no tone or shadow check sees a change to them. Only the golden does.
  const lostSquare = await buildWith((built) => built.get('squares').marks.pop());
  assert.equal(within(lostSquare, b.gray.length), false, `a lost square: ${lostSquare.differing} pixels, ${lostSquare.worst} in a window`);
  const lostMotif = await buildWith((built) => { built.items = built.items.filter((it) => it.name !== 'burst-top'); });
  assert.equal(within(lostMotif, b.gray.length), false);
  const unchanged = await buildWith(() => {});
  assert.deepEqual([unchanged.differing, unchanged.worst], [0, 0]);
});

test('a filter option of the preset changes the picture', async () => {
  const example = collagePack.examples[0];
  const mod = await import(pathToFileURL(packFile(/** @type {string} */ (example.build))).href);
  const { image } = await mod.default(renderer, { seed: example.seed, filter: { contrast: 2.2 } });
  const a = await decodeGrayPng(await readFile(packFile(example.golden)));
  assert.ok(compare(image, a).differing > 1000, 'a different contrast prints a different picture');
});

test('the example builds the same picture twice, and another seed gives another picture', async () => {
  const [a, b, c] = await Promise.all([302, 302, 303].map((seed) => buildThroughContract({ ...collagePack.examples[0], seed })));
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
    if (e.build) await access(packFile(e.build));
    await access(packFile(e.golden));
  }
});

test('the example build script does not write over the golden image', async () => {
  const script = fileURLToPath(new URL('../../examples/collage/build.js', import.meta.url));
  const golden = packFile(collagePack.examples[0].golden);
  const before = await readFile(golden);
  await assert.rejects(promisify(execFile)(process.execPath, [script, golden]), /refusing to write over the golden image/);
  assert.deepEqual(await readFile(golden), before);
});

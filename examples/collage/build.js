// Builds the example collage: renders it, prints it through the collage look, runs the checks and writes the image.
// Run it from the repository root: `node examples/collage/build.js [out.png]`. The image goes to `examples/collage/out/collage.png` (an ignored folder) unless a path is given.
// The golden image `collage.png` next to this file changes only through `UPDATE_GOLDENS=1 node --test test/packs/collage.test.js`, after a look at the new image.
// Chromium must be installed (`npx playwright install chromium`).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../../src/core/main-module.js';
import { openRenderer } from '../../src/core/render.js';
import { encodePalettePng } from '../../src/core/encode.js';
import { assertChecks } from '../../src/core/checks.js';
import { buildCollage } from '../../packs/collage/index.js';
import { DARKEST_TILES, exampleScene } from './scene.js';

/** The golden image of the example. */
export const GOLDEN = fileURLToPath(new URL('./collage.png', import.meta.url));

/**
 * Renders the example and returns the image, the built scene and the check results.
 * @param {import('../../src/core/render.js').Renderer} renderer
 * @param {{ seed?: number, filter?: Partial<import('../../packs/collage/filter.js').CollageFilterOptions> }} [options] `filter`: the filter options of a preset.
 */
export async function buildExample(renderer, { seed, filter } = {}) {
  return buildCollage(renderer, exampleScene(seed), { darkest: DARKEST_TILES, filter });
}

/**
 * The `build` entry of the example in the pack contract.
 * @type {import('../../src/core/types.js').PackBuildFn}
 */
export default async function build(renderer, { seed, filter }) {
  return buildExample(renderer, { seed, filter: /** @type {Partial<import('../../packs/collage/filter.js').CollageFilterOptions> | undefined} */ (filter) });
}

if (isMainModule(import.meta.url)) {
  const out = resolve(process.argv[2] ?? fileURLToPath(new URL('./out/collage.png', import.meta.url)));
  if (out === GOLDEN) throw new Error('refusing to write over the golden image; use UPDATE_GOLDENS=1 node --test test/packs/collage.test.js');
  const renderer = await openRenderer();
  try {
    const { image, checks } = await buildExample(renderer);
    for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.message}`);
    if (!process.env.WARN_ONLY) assertChecks(checks);
    const png = await encodePalettePng(image);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, png);
    console.log(`wrote ${out} (${png.length} bytes, ${image.width}x${image.height})`);
  } finally {
    await renderer.close();
  }
}

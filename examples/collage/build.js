// Builds the example collage: renders it, prints it through the collage look, runs the checks and writes `collage.png`.
// Run it from the repository root: `node examples/collage/build.js [out.png]`.
// Chromium must be installed (`npx playwright install chromium`).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { encodePalettePng } from '../../src/core/encode.js';
import { assertChecks } from '../../src/core/checks.js';
import { buildCollage } from '../../packs/collage/index.js';
import { DARKEST_TILES, exampleScene } from './scene.js';

/**
 * Renders the example and returns the image, the built scene and the check results.
 * @param {import('../../src/core/render.js').Renderer} renderer
 * @param {number} [seed]
 */
export async function buildExample(renderer, seed) {
  return buildCollage(renderer, exampleScene(seed), { darkest: DARKEST_TILES });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? fileURLToPath(new URL('./collage.png', import.meta.url));
  const renderer = await openRenderer();
  try {
    const { image, checks } = await buildExample(renderer);
    for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.message}`);
    if (!process.env.WARN_ONLY) assertChecks(checks);
    const png = await encodePalettePng(image);
    await writeFile(out, png);
    console.log(`wrote ${out} (${png.length} bytes, ${image.width}x${image.height})`);
  } finally {
    await renderer.close();
  }
}

// Builds the example zine page: node examples/zine-page/build.js [output.png]
// The stored page.png is the golden image of the test, so a run without an argument updates the golden.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { buildPage } from '../../packs/zine/build.js';
import { exampleSeeds } from '../../packs/zine/examples.js';

const here = (/** @type {string} */ name) => fileURLToPath(new URL(name, import.meta.url));
const out = process.argv[2] ?? here('page.png');
const renderer = await openRenderer();
try {
  const { png, checks } = await buildPage(renderer, here('page.html'), { seed: exampleSeeds.zinePage });
  await writeFile(out, png);
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.message}`);
  console.log(`wrote ${out}`);
} finally {
  await renderer.close();
}

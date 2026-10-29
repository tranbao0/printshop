// Builds the example animated ransom title: node examples/ransom-title/build.js [output-folder]
// The stored title.svg and title-still.png are the goldens of the test, so a run without an argument updates the goldens.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRenderer } from '../../src/core/render.js';
import { buildRansomTitle } from '../../packs/zine/build.js';
import { exampleSeeds } from '../../packs/zine/examples.js';
import { titleOptions } from './options.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.argv[2] ?? here;
const renderer = await openRenderer();
try {
  const { svg, still, checks } = await buildRansomTitle(renderer, path.join(here, 'title.html'), {
    seed: exampleSeeds.ransomTitle,
    ...titleOptions,
  });
  await writeFile(path.join(out, 'title.svg'), svg);
  await writeFile(path.join(out, 'title-still.png'), still);
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.message}`);
  console.log(`wrote ${path.join(out, 'title.svg')} and ${path.join(out, 'title-still.png')}`);
} finally {
  await renderer.close();
}

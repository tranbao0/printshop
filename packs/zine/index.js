// The zine pack: the photocopied zine look, with its page parts, fonts and the animated ransom-letter title.
// Page layouts load `zine.css` and `parts.js` from this folder (see examples/zine-page and examples/ransom-title).
import { fileURLToPath } from 'node:url';
import { checkColourCount, checkSize } from '../../src/core/checks.js';
import { decodeGrayPng } from '../../src/core/encode.js';
import { titleOptions } from '../../examples/ransom-title/options.js';
import { buildPage, buildRansomTitle } from './build.js';
import { budgetFor, budgets } from './checks.js';
import { exampleSeeds } from './examples.js';
import { photocopySteps } from './photocopy.js';

export { budgetFor, budgets, checkAnimatedSvg, findSvgProblems } from './checks.js';
export { buildPage, buildRansomTitle };
export { photocopy, photocopyDefaults, photocopySteps } from './photocopy.js';
export { assertHopsClearOf, fanSteps, fitHop, ransomCss, ransomSvg, ransomTimeline } from './ransom-svg.js';
export { svgFramesAt } from './frames.js';

/** @typedef {import('../../src/core/types.js').StylePack} StylePack */
/** @typedef {import('../../src/core/types.js').PackAsset} PackAsset */
/** @typedef {import('../../src/core/types.js').PackExample} PackExample */
/** @typedef {import('../../src/core/render.js').Renderer} Renderer */

/** @type {(name: string, file: string, license: string, licenseFile: string) => PackAsset} */
const font = (name, file, license, licenseFile) => ({ name, kind: 'font', file, license, licenseFile });

/** @type {PackAsset[]} */
const assets = [
  font('Alfa Slab One', 'fonts/alfaslabone/AlfaSlabOne-Regular.ttf', 'OFL-1.1', 'fonts/alfaslabone/OFL.txt'),
  font('Anton', 'fonts/anton/Anton-Regular.ttf', 'OFL-1.1', 'fonts/anton/OFL.txt'),
  font('Archivo Black', 'fonts/archivoblack/ArchivoBlack-Regular.ttf', 'OFL-1.1', 'fonts/archivoblack/OFL.txt'),
  font('Permanent Marker', 'fonts/permanentmarker/PermanentMarker-Regular.ttf', 'Apache-2.0', 'fonts/permanentmarker/LICENSE.txt'),
  font('Rubik Mono One', 'fonts/rubikmonoone/RubikMonoOne-Regular.ttf', 'OFL-1.1', 'fonts/rubikmonoone/OFL.txt'),
  font('Special Elite', 'fonts/specialelite/SpecialElite-Regular.ttf', 'Apache-2.0', 'fonts/specialelite/LICENSE.txt'),
];

/** @type {StylePack & { budgets: typeof budgets }} */
export const zine = {
  name: 'zine',
  version: '0.1.0',
  filters: photocopySteps,
  presets: {
    // The page layouts of the pack are drawn for 1600 px, so this is the only preset until a layout is drawn for another width.
    page: { width: 1600 },
  },
  assets,
  // The palette PNG of a page: a small file with the four gray levels of the photocopy.
  async checks({ png, width }) {
    const { colours } = await decodeGrayPng(png);
    return [checkSize('zine png', png.length, budgetFor(width)), checkColourCount('zine png', colours, 4)];
  },
  examples: [
    { name: 'zine-page', input: '../../examples/zine-page/page.html', preset: 'page', seed: exampleSeeds.zinePage, golden: '../../examples/zine-page/page.png' },
    {
      name: 'ransom-title',
      kind: 'ransom-title',
      input: '../../examples/ransom-title/title.html',
      preset: 'page',
      seed: exampleSeeds.ransomTitle,
      golden: '../../examples/ransom-title/title-still.png',
      options: titleOptions,
    },
  ],
  budgets,
};

export default zine;

/**
 * Builds one example of the pack from its entry in `zine.examples`, the way a golden test or a build command does.
 * The paths of the entry are relative to this folder. The seed and the preset come from the entry.
 * @param {Renderer} renderer
 * @param {PackExample} example
 * @returns {Promise<{ png: Buffer, width: number, height: number, checks: import('../../src/core/checks.js').CheckResult[], svg?: string, letters?: import('../../src/core/svg-anim.js').Tile[] }>}
 *   `png` is the image of the golden. For a ransom title it is the still, and `svg` is the animated file.
 */
export async function buildExample(renderer, example) {
  const preset = zine.presets[example.preset];
  if (!preset) throw new Error(`${example.name}: unknown preset "${example.preset}"`);
  const input = fileURLToPath(new URL(example.input, import.meta.url));
  const common = { seed: example.seed, width: preset.width, filterOptions: preset.filter };
  const kind = example.kind ?? 'page';
  if (kind === 'page') return buildPage(renderer, input, common);
  if (kind === 'ransom-title') {
    const { svg, still, letters, checks } = await buildRansomTitle(renderer, input, { label: '', ...example.options, ...common });
    const { width, height } = await decodeGrayPng(still);
    return { png: still, width, height, checks, svg, letters };
  }
  throw new Error(`${example.name}: the zine pack has no build for the kind "${kind}"`);
}

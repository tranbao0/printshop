// The zine pack: the photocopied zine look, with its page parts, fonts and the animated ransom-letter title.
// Page layouts load `zine.css` and `parts.js` from this folder (see examples/zine-page and examples/ransom-title).
import { checkColourCount, checkSize } from '../../src/core/checks.js';
import { decodeGrayPng } from '../../src/core/encode.js';
import { budgets } from './checks.js';
import { exampleSeeds } from './examples.js';
import { photocopySteps } from './photocopy.js';

export { budgets, checkAnimatedSvg, findSvgProblems } from './checks.js';
export { buildPage, buildRansomTitle } from './build.js';
export { photocopy, photocopyDefaults, photocopySteps } from './photocopy.js';
export { assertHopsClearOf, fanSteps, fitHop, ransomCss, ransomSvg, ransomTimeline } from './ransom-svg.js';
export { svgFramesAt } from './frames.js';

/** @typedef {import('../../src/core/types.js').StylePack} StylePack */
/** @typedef {import('../../src/core/types.js').PackAsset} PackAsset */

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
    page: { width: 1600 },
    card: { width: 800 },
    tag: { width: 800 },
  },
  assets,
  // The palette PNG of a page, card or tag: a small file with the four gray levels of the photocopy.
  async checks({ png, width }) {
    const { colours } = await decodeGrayPng(png);
    return [checkSize('zine png', png.length, width >= 1600 ? budgets.page : budgets.card), checkColourCount('zine png', colours, 4)];
  },
  examples: [
    { name: 'zine-page', input: '../../examples/zine-page/page.html', preset: 'page', seed: exampleSeeds.zinePage, golden: '../../examples/zine-page/page.png' },
    { name: 'ransom-title', input: '../../examples/ransom-title/title.html', preset: 'page', seed: exampleSeeds.ransomTitle, golden: '../../examples/ransom-title/title-still.png' },
  ],
  budgets,
};

export default zine;

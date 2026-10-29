// The style pack "__PACK_NAME__". The shape of a pack is the `StylePack` type of the core (see src/core/types.js in printshop).
import { checkColourCount, checkSize } from '@tranbao0/printshop/core/checks';
import { decodeGrayPng } from '@tranbao0/printshop/core/encode';
import { lookDefaults, lookSteps } from './filter.js';

export { look, lookDefaults, lookSteps } from './filter.js';

/** The size budget of an image of this pack, in bytes. */
export const SIZE_BUDGET = 60 * 1024;

/** @type {import('@tranbao0/printshop/core/types').StylePack} */
export const pack = {
  name: '__PACK_NAME__',
  version: '0.1.0',
  // The steps of the look, in order, each with its defaults.
  filters: lookSteps,
  // Named settings for common outputs. `width` is the page width in pixels. `filter` overrides the defaults of the steps.
  presets: {
    page: { width: 800, seed: 1, filter: { contrast: lookDefaults.contrast } },
  },
  // Fonts and textures that the pack ships, each with the SPDX name of its license and the path of the license text.
  assets: [],
  // Checks that run over every image that the pack builds.
  checks: async ({ png }) => {
    const { colours } = await decodeGrayPng(png);
    return [checkSize('png size', png.length, SIZE_BUDGET), checkColourCount('png colours', colours, 2)];
  },
  // Inputs that the golden test builds. Paths are relative to this folder.
  examples: [
    { name: 'page', input: 'example/page.html', preset: 'page', seed: 1, golden: 'example/page.png' },
  ],
};

export default pack;

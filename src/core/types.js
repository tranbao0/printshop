// The style pack contract. A style pack is a plain object of this shape.
// The two first packs (the photocopy zine and the paper collage) and the template that `printshop new-style` copies follow it.

/** @typedef {import('./filters.js').FilterStep<any>} FilterStep */
/** @typedef {import('./checks.js').CheckResult} CheckResult */

/**
 * A font or texture a pack ships, with its license.
 * @typedef {object} PackAsset
 * @property {string} name
 * @property {'font' | 'texture'} kind
 * @property {string} file Path of the asset, relative to the pack folder.
 * @property {string} license SPDX identifier of the license of the asset.
 * @property {string} licenseFile Path of the license text, relative to the pack folder.
 */

/**
 * Named settings for a common output.
 * @typedef {object} PackPreset
 * @property {number} width Page width in pixels.
 * @property {Record<string, unknown>} [filter] Filter options that override the defaults of the steps.
 * @property {number} [seed]
 */

/**
 * An input that the golden tests render.
 * @typedef {object} PackExample
 * @property {string} name
 * @property {string} [kind] What the pack builds from the layout. The pack names its kinds. Default `page`: one still page.
 * @property {string} input Path of the layout (an HTML file), relative to the pack folder.
 * @property {string} preset The name of a preset of the pack.
 * @property {number} seed A fixed seed, so the output is the same on every run.
 * @property {string} golden Path of the stored golden image, relative to the pack folder. It is the image that the build of this kind gives.
 * @property {Record<string, any>} [options] More options for the build of this kind, such as the label of an animated title.
 */

/**
 * @typedef {object} StylePack
 * @property {string} name
 * @property {string} version
 * @property {FilterStep[]} filters An ordered list of filter steps, each with its defaults.
 * @property {Record<string, PackPreset>} presets Named settings for common outputs (page, card, tag, avatar).
 * @property {PackAsset[]} assets Fonts and textures, with their licenses.
 * @property {(output: { png: Buffer, width: number, height: number }) => Promise<CheckResult[]> | CheckResult[]} checks
 *   Checks that run after a build.
 * @property {PackExample[]} examples
 */

export {};

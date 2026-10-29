export type FilterStep = import('./filters.js').FilterStep<any>;
export type CheckResult = import('./checks.js').CheckResult;
export type PackAsset = {
    name: string;
    kind: 'font' | 'texture';
    /**
     * Path of the asset, relative to the pack folder.
     */
    file: string;
    /**
     * SPDX identifier of the license of the asset.
     */
    license: string;
    /**
     * Path of the license text, relative to the pack folder.
     */
    licenseFile: string;
};
export type PackPreset = {
    /**
     * Page width in pixels.
     */
    width: number;
    /**
     * Filter options that override the defaults of the steps.
     */
    filter?: Record<string, unknown>;
    seed?: number;
};
export type PackBuild = {
    image: import('./filters.js').GrayImage;
    checks: CheckResult[];
};
export type PackBuildFn = (renderer: import('./render.js').Renderer, options: {
    seed: number;
    filter?: Record<string, unknown>;
}) => Promise<PackBuild>;
export type PackExample = {
    name: string;
    /**
     * What the pack builds from the layout. The pack names its kinds. Default `page`: one still page.
     */
    kind?: string;
    /**
     * Path of the layout, relative to the pack folder: an HTML file, or the module that makes the layout in code.
     */
    input: string;
    /**
     * Path of a module (relative to the pack folder) whose default export is a `PackBuildFn`.
     * A pack whose layout is made in code needs it, so a runner can build the example. A runner without it renders `input` as an HTML page.
     */
    build?: string;
    /**
     * The name of a preset of the pack.
     */
    preset: string;
    /**
     * A fixed seed, so the output is the same on every run. It takes the place of the seed of the preset.
     */
    seed: number;
    /**
     * Path of the stored golden image, relative to the pack folder. It is the image that the build of this kind gives.
     */
    golden: string;
    /**
     * More options for the build of this kind, such as the label of an animated title.
     */
    options?: Record<string, any>;
};
export type StylePack = {
    name: string;
    version: string;
    /**
     * An ordered list of filter steps, each with its defaults.
     */
    filters: FilterStep[];
    /**
     * Named settings for common outputs (page, card, tag, avatar).
     */
    presets: Record<string, PackPreset>;
    /**
     * Fonts and textures, with their licenses.
     */
    assets: PackAsset[];
    /**
     *   Checks that run after a build.
     */
    checks: (output: {
        png: Buffer;
        width: number;
        height: number;
    }) => Promise<CheckResult[]> | CheckResult[];
    examples: PackExample[];
};
export type PackExampleBuilder = (renderer: import('./render.js').Renderer, example: PackExample) => Promise<{
    png: Buffer;
    width: number;
    height: number;
    checks: CheckResult[];
    svg?: string;
}>;
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
 * What a build entry returns: the printed image and the checks over the built layout.
 * These checks come in addition to the `checks` of the pack, which run over the image file.
 * @typedef {object} PackBuild
 * @property {import('./filters.js').GrayImage} image
 * @property {CheckResult[]} checks
 */
/**
 * The default export of the module that an example names as its `build`. It builds the example for a seed and the filter options of a preset.
 * @typedef {(renderer: import('./render.js').Renderer, options: { seed: number, filter?: Record<string, unknown> }) => Promise<PackBuild>} PackBuildFn
 */
/**
 * An input that the golden tests render.
 * @typedef {object} PackExample
 * @property {string} name
 * @property {string} [kind] What the pack builds from the layout. The pack names its kinds. Default `page`: one still page.
 * @property {string} input Path of the layout, relative to the pack folder: an HTML file, or the module that makes the layout in code.
 * @property {string} [build] Path of a module (relative to the pack folder) whose default export is a `PackBuildFn`.
 *   A pack whose layout is made in code needs it, so a runner can build the example. A runner without it renders `input` as an HTML page.
 * @property {string} preset The name of a preset of the pack.
 * @property {number} seed A fixed seed, so the output is the same on every run. It takes the place of the seed of the preset.
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
/**
 * The optional named export `buildExample` of a pack module. A pack whose examples come in kinds that only the pack knows
 * (the zine pack builds a still `page` and an animated `ransom-title`) builds the example of such a kind in this function.
 * `png` is the still image. A function that makes an animated file returns it as `svg`.
 * A runner uses it for an example without a `build` entry. The runner builds a `page` of a pack without it from the `filters` of the pack.
 * @typedef {(renderer: import('./render.js').Renderer, example: PackExample) => Promise<{
 *   png: Buffer, width: number, height: number, checks: CheckResult[], svg?: string }>} PackExampleBuilder
 */
export {};

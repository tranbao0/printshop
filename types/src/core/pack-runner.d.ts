export type StylePack = import('./types.js').StylePack;
export type PackExample = import('./types.js').PackExample;
export type Renderer = import('./render.js').Renderer;
export type CheckResult = import('./checks.js').CheckResult;
export type LoadedPack = {
    pack: StylePack;
    /**
     * The whole module of the pack.
     */
    module: Record<string, any>;
    /**
     * The folder of the pack (absolute). The paths in the examples are relative to it.
     */
    dir: string;
};
export type BuiltExample = {
    /**
     * The image. For an animated example it is the still.
     */
    png: Buffer;
    width: number;
    height: number;
    /**
     * The checks of the build and the checks of the pack.
     */
    checks: CheckResult[];
    /**
     * The animated file, if the example makes one.
     */
    svg?: string;
};
/** @typedef {import('./types.js').StylePack} StylePack */
/** @typedef {import('./types.js').PackExample} PackExample */
/** @typedef {import('./render.js').Renderer} Renderer */
/** @typedef {import('./checks.js').CheckResult} CheckResult */
/**
 * @typedef {object} LoadedPack
 * @property {StylePack} pack
 * @property {Record<string, any>} module The whole module of the pack.
 * @property {string} dir The folder of the pack (absolute). The paths in the examples are relative to it.
 */
/**
 * @typedef {object} BuiltExample
 * @property {Buffer} png The image. For an animated example it is the still.
 * @property {number} width
 * @property {number} height
 * @property {CheckResult[]} checks The checks of the build and the checks of the pack.
 * @property {string} [svg] The animated file, if the example makes one.
 */
/** The folder of the printshop package. */
export declare const PACKAGE_ROOT: string;
/**
 * @param {unknown} value
 * @returns {value is StylePack}
 */
export declare function isPack(value: unknown): value is StylePack;
/**
 * Lists the `index.js` files of the packs that are in the working folder or in the package.
 * @param {string} cwd
 * @returns {Promise<{ name: string, file: string }[]>} A pack of the working folder hides a pack of the package with the same name.
 */
export declare function listPackFiles(cwd: string): Promise<{
    name: string;
    file: string;
}[]>;
/**
 * Loads a pack from a name, or from the path of its folder or its `index.js`.
 * A name is looked up in `packs/` of the working folder, then in `packs/` of the package.
 * @param {string} spec
 * @param {string} cwd
 * @returns {Promise<LoadedPack>}
 */
export declare function loadPack(spec: string, cwd: string): Promise<LoadedPack>;
/**
 * @param {string} file The `index.js` of the pack.
 * @returns {Promise<LoadedPack>}
 */
export declare function importPack(file: string): Promise<LoadedPack>;
/**
 * The absolute path of a path in an example. The path is relative to the folder of the pack, or a `file:` URL.
 * @param {LoadedPack} loaded
 * @param {string} rel
 */
export declare const examplePath: (loaded: LoadedPack, rel: string) => string;
/**
 * Finds the example of a pack that has a given layout file as its `input` or its `build`.
 * @param {LoadedPack} loaded
 * @param {string} file Absolute path of the layout.
 * @returns {Promise<PackExample | undefined>}
 */
export declare function findExample(loaded: LoadedPack, file: string): Promise<PackExample | undefined>;
/**
 * Builds one example of a pack and runs the checks of the pack over the image.
 * @param {Renderer} renderer
 * @param {LoadedPack} loaded
 * @param {PackExample} example
 * @returns {Promise<BuiltExample>}
 */
export declare function buildPackExample(renderer: Renderer, loaded: LoadedPack, example: PackExample): Promise<BuiltExample>;

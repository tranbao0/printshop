// Finds style packs and builds their examples. The command-line tool and the test of a new pack use it.
//
// A pack is a folder with an `index.js`. The module has the pack as its default export, or as a named export of the shape of a `StylePack`.
// An example is built in this order:
// 1. the example names a `build` module: its default export (a `PackBuildFn`) makes the image from a layout made in code;
// 2. the pack module exports `buildExample` (see `PackExampleBuilder`): it builds the kinds of the pack;
// 3. otherwise the layout is an HTML file, run through the `filters` of the pack (kind `page`).
import { access, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePalettePng } from './encode.js';
import { runFilter } from './filters.js';
import { renderCopy } from './pipeline.js';

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
export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const exists = (/** @type {string} */ file) => access(file).then(() => true, () => false);

/**
 * @param {unknown} value
 * @returns {value is StylePack}
 */
export function isPack(value) {
  const v = /** @type {Record<string, unknown> | null} */ (value);
  return typeof v === 'object' && v !== null && typeof v.name === 'string' && Array.isArray(v.filters) && typeof v.presets === 'object' && v.presets !== null && Array.isArray(v.examples) && typeof v.checks === 'function';
}

/**
 * The folders in which packs live, for a working folder: `packs/` there, then `packs/` of the package.
 * @param {string} cwd
 */
const packFolders = (cwd) => [...new Set([path.join(cwd, 'packs'), path.join(PACKAGE_ROOT, 'packs')])];

/**
 * Lists the `index.js` files of the packs that are in the working folder or in the package.
 * @param {string} cwd
 * @returns {Promise<{ name: string, file: string }[]>} A pack of the working folder hides a pack of the package with the same name.
 */
export async function listPackFiles(cwd) {
  /** @type {{ name: string, file: string }[]} */
  const found = [];
  for (const folder of packFolders(cwd)) {
    const names = await readdir(folder).catch(() => /** @type {string[]} */ ([]));
    for (const name of names.sort()) {
      const file = path.join(folder, name, 'index.js');
      if (!found.some((f) => f.name === name) && (await exists(file))) found.push({ name, file });
    }
  }
  return found;
}

/**
 * Loads a pack from a name, or from the path of its folder or its `index.js`.
 * A name is looked up in `packs/` of the working folder, then in `packs/` of the package.
 * @param {string} spec
 * @param {string} cwd
 * @returns {Promise<LoadedPack>}
 */
export async function loadPack(spec, cwd) {
  /** @type {string | undefined} */
  let file;
  if (/[\\/]/.test(spec) || spec.startsWith('.')) {
    const abs = path.resolve(cwd, spec);
    file = abs.endsWith('.js') ? abs : path.join(abs, 'index.js');
    if (!(await exists(file))) throw new Error(`no pack at ${spec}: ${file} does not exist`);
  } else {
    file = (await listPackFiles(cwd)).find((f) => f.name === spec)?.file;
    if (!file) {
      const known = (await listPackFiles(cwd)).map((f) => f.name);
      throw new Error(`no pack named "${spec}" (known packs: ${known.join(', ') || 'none'})`);
    }
  }
  return importPack(file);
}

/**
 * @param {string} file The `index.js` of the pack.
 * @returns {Promise<LoadedPack>}
 */
export async function importPack(file) {
  const module = /** @type {Record<string, any>} */ (await import(pathToFileURL(file).href));
  const pack = [module.default, ...Object.values(module)].find(isPack);
  if (!pack) throw new Error(`${file} exports no style pack: export an object with name, filters, presets, checks and examples (see src/core/types.js)`);
  return { pack, module, dir: path.dirname(file) };
}

/**
 * The absolute path of a path in an example. The path is relative to the folder of the pack, or a `file:` URL.
 * @param {LoadedPack} loaded
 * @param {string} rel
 */
export const examplePath = (loaded, rel) => fileURLToPath(new URL(rel, pathToFileURL(loaded.dir + path.sep)));

/**
 * @param {string} file
 * @returns {Promise<string>}
 */
const real = (file) => realpath(file).catch(() => path.resolve(file));

/**
 * Finds the example of a pack that has a given layout file as its `input` or its `build`.
 * @param {LoadedPack} loaded
 * @param {string} file Absolute path of the layout.
 * @returns {Promise<PackExample | undefined>}
 */
export async function findExample(loaded, file) {
  const target = await real(file);
  for (const example of loaded.pack.examples) {
    for (const rel of [example.input, example.build]) {
      if (rel && (await real(examplePath(loaded, rel))) === target) return example;
    }
  }
  return undefined;
}

/**
 * The preset that an example names.
 * @param {LoadedPack} loaded
 * @param {PackExample} example
 */
function presetOf(loaded, example) {
  const preset = loaded.pack.presets[example.preset];
  if (!preset) throw new Error(`${example.name}: the pack "${loaded.pack.name}" has no preset "${example.preset}" (it has: ${Object.keys(loaded.pack.presets).join(', ') || 'none'})`);
  return preset;
}

/**
 * Builds one example of a pack and runs the checks of the pack over the image.
 * @param {Renderer} renderer
 * @param {LoadedPack} loaded
 * @param {PackExample} example
 * @returns {Promise<BuiltExample>}
 */
export async function buildPackExample(renderer, loaded, example) {
  const { pack } = loaded;
  /** @type {BuiltExample} */
  let built;
  if (example.build) {
    const preset = pack.presets[example.preset];
    const file = examplePath(loaded, example.build);
    const module = await import(pathToFileURL(file).href);
    if (typeof module.default !== 'function') throw new Error(`${file}: a build entry must export a function as its default (a PackBuildFn: (renderer, { seed, filter }) => { image, checks })`);
    /** @type {import('./types.js').PackBuild} */
    const out = await module.default(renderer, { seed: example.seed, filter: preset?.filter });
    built = { png: await encodePalettePng(out.image), width: out.image.width, height: out.image.height, checks: out.checks };
  } else if (typeof loaded.module.buildExample === 'function') {
    built = await /** @type {import('./types.js').PackExampleBuilder} */ (loaded.module.buildExample)(renderer, example);
  } else {
    const kind = example.kind ?? 'page';
    if (kind !== 'page') throw new Error(`${example.name}: the pack "${pack.name}" has no build for the kind "${kind}" (a pack with kinds exports buildExample)`);
    const preset = presetOf(loaded, example);
    const copy = await renderCopy(renderer, examplePath(loaded, example.input), {
      seed: example.seed,
      width: preset.width,
      filter: (image, options) => runFilter(pack.filters, image, options),
      filterOptions: preset.filter,
    });
    built = { png: await encodePalettePng(copy), width: copy.width, height: copy.height, checks: [] };
  }
  const checks = await pack.checks({ png: built.png, width: built.width, height: built.height });
  return { ...built, checks: [...built.checks, ...checks] };
}

// `printshop build <input>`: builds an image from a layout.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openRenderer } from '../core/render.js';
import { buildPackExample, examplePath, findExample, importPack, listPackFiles, loadPack } from '../core/pack-runner.js';
import { UsageError, parse, shown, wholeNumber } from './io.js';

export const summary = 'Build an image from a layout (an HTML file, or a module that makes the layout in code).';

export const help = `Usage: printshop build <input> [options]

Builds an image from a layout and runs the checks of the pack.
<input> is one of:
  - an HTML file: it is printed through the filters of a pack;
  - the layout file or the build module of an example of a pack (for example examples/collage/scene.js):
    the build uses the kind, the preset, the seed and the options of that example;
  - a module whose default export is a build function, (renderer, { seed, filter }) => { image, checks }.
The pack is the one that has the file as an example. Otherwise it is the pack of --pack, or the zine pack.
A failed check prints as "FAIL" and the command exits with 1.

Options:
  -p, --pack <name|path>   The pack. A name is looked up in ./packs, then in the packs of printshop.
      --preset <name>      A preset of the pack. Default: the preset of the example, else "page", else the first preset.
      --seed <number>      The seed of the random streams. Default: the seed of the example or the preset.
      --kind <kind>        What to build from the layout. The zine pack builds "page" (default) and "ransom-title".
      --option <key=value> An option for the kind, for example label="A title". A value is read as JSON if it is JSON. Repeat for more.
  -o, --out <path>         The name of the output, default out/<name>.png. An animated result writes <path without extension>.svg
                           and the still image as <path without extension>-still.png.
  -v, --verbose            Print every check, not only the failed ones.
  -h, --help               Show this help.

The command does not write over the golden image of a pack example.`;

/**
 * Reads the `--option key=value` list.
 * @param {string[]} items
 * @returns {Record<string, unknown>}
 */
function readOptions(items) {
  /** @type {Record<string, unknown>} */
  const options = {};
  for (const item of items) {
    const at = item.indexOf('=');
    if (at < 1) throw new UsageError(`--option needs key=value, not "${item}"`);
    const text = item.slice(at + 1);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
    options[item.slice(0, at)] = value;
  }
  return options;
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>} The exit code.
 */
export async function run(args, io) {
  const { values, positionals } = parse(args, {
    pack: { type: 'string', short: 'p' },
    preset: { type: 'string' },
    seed: { type: 'string' },
    kind: { type: 'string' },
    option: { type: 'string', multiple: true },
    out: { type: 'string', short: 'o' },
    verbose: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.out(help);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError('build needs one input file');
  const file = path.resolve(io.cwd, positionals[0]);
  if (!(await stat(file).then((s) => s.isFile(), () => false))) throw new Error(`no such file: ${positionals[0]}`);
  const seed = wholeNumber('--seed', values.seed);
  const options = readOptions(values.option ?? []);

  // The pack and the example.
  /** @type {import('../core/pack-runner.js').LoadedPack[]} */
  let candidates = [];
  if (values.pack) candidates = [await loadPack(values.pack, io.cwd)];
  else {
    for (const { name, file: packFile } of await listPackFiles(io.cwd)) {
      try {
        candidates.push(await importPack(packFile));
      } catch (error) {
        io.err(`printshop: skipped the pack "${name}": ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  /** @type {import('../core/pack-runner.js').LoadedPack | undefined} */
  let loaded;
  /** @type {import('../core/types.js').PackExample | undefined} */
  let example;
  for (const candidate of candidates) {
    example = await findExample(candidate, file);
    if (example) {
      loaded = candidate;
      break;
    }
  }
  const isModule = /\.[cm]?js$/.test(file);
  if (!loaded) {
    if (values.pack) loaded = candidates[0];
    else if (!isModule) loaded = await loadPack('zine', io.cwd);
    else loaded = noPack();
  }
  /** @type {import('../core/types.js').PackExample} */
  let chosen;
  if (example) chosen = example;
  else {
    const presets = Object.keys(loaded.pack.presets);
    const presetName = values.preset ?? (presets.includes('page') ? 'page' : presets[0]);
    if (!presetName && !isModule) throw new Error(`the pack "${loaded.pack.name}" has no preset`);
    chosen = {
      name: path.basename(file).replace(/\.[^.]+$/, ''),
      input: pathToFileURL(file).href,
      ...(isModule && { build: pathToFileURL(file).href }),
      preset: presetName ?? '',
      seed: seed ?? loaded.pack.presets[presetName ?? '']?.seed ?? 1,
      golden: '',
    };
  }
  chosen = {
    ...chosen,
    ...(values.preset && { preset: values.preset }),
    ...(seed !== undefined && { seed }),
    ...(values.kind && { kind: values.kind }),
    options: { ...chosen.options, ...options },
  };
  if (isModule && !chosen.build) throw new Error(`${positionals[0]} is not the layout or the build module of an example of the pack "${loaded.pack.name}". Name the build module, whose default export is a build function.`);

  const base = values.out
    ? path.resolve(io.cwd, values.out).replace(/\.[^./\\]*$/, '')
    : path.join(io.cwd, 'out', chosen.name);
  // Refuse before the build, if an output would replace a golden image or the animated file that goes with it.
  const goldens = new Set(candidates.flatMap((c) => c.pack.examples.filter((e) => e.golden).flatMap((e) => [examplePath(c, e.golden), examplePath(c, e.golden).replace(/(-still)?\.png$/, '.svg')])));
  for (const target of [`${base}.png`, `${base}.svg`, `${base}-still.png`]) {
    if (goldens.has(target)) throw new Error(`refusing to write over the golden image ${shown(io.cwd, target)}. To update a golden image, run the test of its pack with UPDATE_GOLDENS=1 and look at the new image.`);
  }
  const renderer = await openRenderer();
  let built;
  try {
    built = await buildPackExample(renderer, loaded, chosen);
  } finally {
    await renderer.close();
  }

  /** @type {{ file: string, content: string | Buffer }[]} */
  const outputs = built.svg ? [{ file: `${base}.svg`, content: built.svg }, { file: `${base}-still.png`, content: built.png }] : [{ file: `${base}.png`, content: built.png }];
  const failed = built.checks.filter((c) => !c.ok);
  for (const c of values.verbose ? built.checks : failed) io.out(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.message}`);
  io.out(`checks: ${built.checks.length - failed.length} of ${built.checks.length} ok`);
  await mkdir(path.dirname(base), { recursive: true });
  for (const { file: target, content } of outputs) {
    await writeFile(target, content);
    io.out(`wrote ${shown(io.cwd, target)} (${Buffer.byteLength(content)} bytes${target.endsWith('.png') ? `, ${built.width}x${built.height}` : ''})`);
  }
  if (failed.length) io.err(`printshop: ${failed.length} check${failed.length === 1 ? '' : 's'} failed`);
  return failed.length ? 1 : 0;
}

/**
 * A stand-in for the pack of a build module that no pack names: no filters, no presets, no checks of its own.
 * @returns {import('../core/pack-runner.js').LoadedPack}
 */
function noPack() {
  return { pack: { name: '(no pack)', version: '0.0.0', filters: [], presets: {}, assets: [], checks: () => [], examples: [] }, module: {}, dir: process.cwd() };
}

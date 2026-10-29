// `printshop new-style <name>`: makes a new style pack from the template.
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PACKAGE_ROOT } from '../core/pack-runner.js';
import { UsageError, parse, shown } from './io.js';

export const summary = 'Make a new style pack from the template, with an example, a preset, a golden test and a README.';

export const help = `Usage: printshop new-style <name> [options]

Copies the template pack into packs/<name>, in the current folder.
The new pack builds its example and passes its own test as it is:

  printshop new-style riso-test
  printshop build packs/riso-test/example/page.html
  node --test packs/riso-test/pack.test.js

The name uses lowercase letters, digits and single dashes, and starts with a letter.
A pack imports the core by the name of the package, @tranbao0/printshop, so the project needs the package as a dependency.

Options:
      --dir <folder>   The folder of the project. The pack goes into <folder>/packs/<name>. Default: the current folder.
  -h, --help           Show this help.`;

/** The word in the template that the name of the new pack replaces. */
const TOKEN = '__PACK_NAME__';

const BINARY = /\.(png|jpe?g|gif|webp|ttf|otf|woff2?)$/i;

const exists = (/** @type {string} */ file) => access(file).then(() => true, () => false);

/**
 * Tells whether the `.js` files in a folder are ES modules: the nearest `package.json` above it says `"type": "module"`.
 * Node before 22.7 reads a `.js` file as CommonJS unless a package.json says otherwise.
 * @param {string} folder
 */
async function isModuleScope(folder) {
  for (let dir = folder; ; dir = path.dirname(dir)) {
    const text = await readFile(path.join(dir, 'package.json'), 'utf8').catch(() => null);
    if (text !== null) {
      try {
        return JSON.parse(text).type === 'module';
      } catch {
        return false;
      }
    }
    if (path.dirname(dir) === dir) return false;
  }
}

/**
 * Lists the files of a folder, with paths relative to it.
 * @param {string} root
 * @param {string} [sub]
 * @returns {Promise<string[]>}
 */
async function listFiles(root, sub = '') {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(path.join(root, sub), { withFileTypes: true })) {
    const rel = path.join(sub, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, rel)));
    else files.push(rel);
  }
  return files.sort();
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
export async function run(args, io) {
  const { values, positionals } = parse(args, {
    dir: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.out(help);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError('new-style needs one name');
  const name = positionals[0];
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) throw new UsageError(`"${name}" is not a good pack name: use lowercase letters, digits and single dashes, and start with a letter (for example riso-test)`);
  if (await exists(path.join(PACKAGE_ROOT, 'packs', name))) throw new Error(`a pack named "${name}" already ships with printshop; choose another name`);

  const project = path.resolve(io.cwd, values.dir ?? '.');
  const target = path.join(project, 'packs', name);
  if (await exists(target)) throw new Error(`${shown(io.cwd, target)} already exists; choose another name or remove the folder`);

  const template = path.join(PACKAGE_ROOT, 'templates', 'pack');
  for (const rel of await listFiles(template)) {
    const from = path.join(template, rel);
    const to = path.join(target, rel);
    await mkdir(path.dirname(to), { recursive: true });
    if (BINARY.test(rel)) await writeFile(to, await readFile(from));
    else await writeFile(to, (await readFile(from, 'utf8')).replaceAll(TOKEN, name));
  }
  const where = shown(io.cwd, target);
  io.out(`created ${where}`);
  // The pack is made of ES modules. A project that is not an ES module project needs a package.json in packs/ that says so.
  const packsFolder = path.join(project, 'packs');
  if (!(await isModuleScope(packsFolder)) && !(await exists(path.join(packsFolder, 'package.json')))) {
    await writeFile(path.join(packsFolder, 'package.json'), '{\n  "type": "module"\n}\n');
    io.out(`created ${shown(io.cwd, path.join(packsFolder, 'package.json'))} (the packs are ES modules)`);
  }
  io.out('');
  io.out('Next:');
  io.out(`  printshop build ${path.join(where, 'example', 'page.html')}`);
  io.out(`  node --test ${path.join(where, 'pack.test.js')}`);
  io.out(`  see ${path.join(where, 'README.md')}`);
  return 0;
}

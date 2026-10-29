// The clean-install check: the packed package works the way a consumer gets it.
// `npm pack` makes the tarball of this working tree. The tarball goes into an empty project with `npm install --ignore-scripts`.
// In that project: `printshop new-style` makes a pack, the example of the pack builds, the test of the pack passes,
// an example that ships with the package builds, and `tsc` with `strict` and `checkJs` over the project reports no error.
//
// The tarball needs no network. Its dependencies (sharp, playwright) and the dev tools of the project (typescript, @types/node) come from the
// npm cache when it has them (`npm ci` fills it), and from the registry when it does not. If the registry is out of reach, the test skips
// with a message. In CI (the CI variable is set) it never skips.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** Error codes of npm that mean "the registry is out of reach". */
const NETWORK_ERROR = /\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENOTCACHED)\b/;

/**
 * Runs a program and returns its output. A failure throws an error that has the output in its message.
 * @param {string} file
 * @param {string[]} args
 * @param {string} cwd
 */
async function sh(file, args, cwd) {
  const env = { ...process.env };
  // A test run inside `node --test` must not make a nested `node --test` report as a child of it.
  delete env.NODE_TEST_CONTEXT;
  try {
    return await run(file, args, { cwd, env, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    const e = /** @type {{ message: string, stdout?: string, stderr?: string }} */ (error);
    throw new Error(`${file} ${args.join(' ')}\n${e.message}\n${e.stdout ?? ''}\n${e.stderr ?? ''}`);
  }
}

/** @type {string} */
let work;
before(async () => {
  work = await mkdtemp(path.join(os.tmpdir(), 'printshop-install-'));
});
after(async () => {
  await rm(work, { recursive: true, force: true });
});

test('the tarball installs with --ignore-scripts into an empty project, and the project builds, tests and type-checks', async (t) => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

  // 1. Pack the working tree.
  const packDir = path.join(work, 'pack');
  const packed = await sh(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', await makeDir(packDir)], root);
  const [info] = JSON.parse(packed.stdout);
  const files = /** @type {string[]} */ (info.files.map((/** @type {{ path: string }} */ f) => f.path));
  for (const wanted of ['bin/printshop.js', 'src/core/types.js', 'types/src/core/types.d.ts', 'types/packs/zine/index.d.ts', 'templates/pack/index.js', 'examples/zine-page/page.html']) {
    assert.ok(files.includes(wanted), `the tarball has ${wanted}`);
  }
  assert.ok(!files.some((f) => f.startsWith('test/') || f.startsWith('node_modules/')), 'the tarball has no tests and no node_modules');
  const tarball = path.join(packDir, info.filename);

  // 2. Install it in an empty project, with the dev tools that the type check needs.
  const project = await makeDir(path.join(work, 'project'));
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'consumer', version: '0.0.0', private: true, type: 'module' }, null, 2));
  const dev = ['typescript', '@types/node'].map((name) => `${name}@${pkg.devDependencies[name]}`);
  try {
    await sh(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', tarball, ...dev], project);
  } catch (error) {
    if (!process.env.CI && NETWORK_ERROR.test(String(error))) return t.skip('the npm registry is out of reach and the npm cache does not have the packages: run this test with a network');
    throw error;
  }
  const installed = path.join(project, 'node_modules', '@tranbao0', 'printshop');
  assert.equal(JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8')).version, pkg.version);
  const printshop = (/** @type {string[]} */ ...args) => sh(path.join(project, 'node_modules', '.bin', 'printshop'), args, project);

  // 3. A new pack builds its example and passes its own test.
  await printshop('new-style', 'riso-test');
  const built = await printshop('build', 'packs/riso-test/example/page.html');
  assert.match(built.stdout, /out\/page\.png/);
  await access(path.join(project, 'out', 'page.png'));
  await sh(process.execPath, ['--test', 'packs/riso-test/pack.test.js'], project);

  // 4. An example that ships with the package builds from the installed package.
  await printshop('build', 'node_modules/@tranbao0/printshop/examples/zine-page/page.html', '--out', 'out/shipped-zine');
  await access(path.join(project, 'out', 'shipped-zine.png'));

  // 5. The type check, with strict and checkJs, over the project: the pack that new-style made, and a file that uses the package.
  await writeFile(path.join(project, 'use.js'), [
    "import zine from '@tranbao0/printshop/packs/zine';",
    "import { collagePack } from '@tranbao0/printshop/packs/collage';",
    "import { openRenderer } from '@tranbao0/printshop/core/render';",
    '',
    '/** @param {string} html */',
    'export async function shot(html) {',
    '  const renderer = await openRenderer();',
    '  try {',
    '    return [zine.name, collagePack.name, html.length];',
    '  } finally {',
    '    await renderer.close();',
    '  }',
    '}',
    '',
  ].join('\n'));
  await writeFile(path.join(project, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', lib: ['es2023', 'dom'], types: ['node'], allowJs: true, checkJs: true, strict: true, noEmit: true },
    include: ['packs', 'use.js'],
  }, null, 2));
  await sh(process.execPath, [path.join(project, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'], project);
});

/**
 * Makes a folder and returns its path.
 * @param {string} folder
 */
async function makeDir(folder) {
  await mkdir(folder, { recursive: true });
  return folder;
}

// The docs check: every shell command in a code block of README.md and docs/*.md that starts with "printshop" or "npx printshop" runs and exits 0.
//
// How it works:
// - One temp project for each Markdown file. The project has `node_modules/@tranbao0/printshop` (a link to this repository), so a pack that
//   `printshop new-style` makes finds the core, and the examples are at `node_modules/@tranbao0/printshop/examples`, as in a real project.
// - The commands of a file run in the order of the file, in the temp project, so `new-style` comes before `build packs/...`.
// - `printshop` and `npx printshop` are small scripts on PATH that start bin/printshop.js. The `npx` script never touches the network.
// - The files that the docs call `reference.mp4`, `reference.png` and `screenshot.png` stand in for the reader's own reference files.
//   They are made here: a short test video (needs ffmpeg), a gray image, and a screenshot of that image with a red mark.
//
// A block can have a marker on the line before its opening fence:
//   <!-- docs-check: ffmpeg -->    run the block only when ffmpeg is there. In CI (the CI variable is set) a missing ffmpeg is a failure.
//   <!-- docs-check: network -->   skip the block unless DOCS_CHECK_NETWORK=1, for commands that need the network.
// A block with a command that exits with a code other than 0 fails the test. A block with an unknown marker fails the test too.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fractalField } from '../src/core/noise.js';
import { findFfmpeg } from '../src/core/ref/ffmpeg.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

/** The markers that a code block can have. */
const MARKERS = ['ffmpeg', 'network'];

/** The languages of a code block that holds shell commands. */
const SHELL_LANGUAGES = ['sh', 'bash', 'shell', 'console'];

/**
 * @typedef {object} DocCommand
 * @property {string} command The command, with its continuation lines joined.
 * @property {number} line The line of the command in the file, from 1.
 * @property {string | null} marker The marker of the code block.
 */

/**
 * Finds the commands in the shell code blocks of a Markdown text: lines that start with `printshop ` or `npx printshop `, or that are just `printshop`.
 * A leading `$ ` is dropped. A line that ends with a backslash goes on in the next line.
 * @param {string} markdown
 * @returns {DocCommand[]}
 */
export function extractCommands(markdown) {
  const lines = markdown.split('\n');
  /** @type {DocCommand[]} */
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)```([\w-]*)\s*$/.exec(lines[i]);
    if (!open) continue;
    const indent = open[1].length;
    const language = open[2];
    const markerLine = i > 0 ? /^\s*<!--\s*docs-check:\s*([\w-]+)\s*-->\s*$/.exec(lines[i - 1]) : null;
    const marker = markerLine ? markerLine[1] : null;
    if (marker && !MARKERS.includes(marker)) throw new Error(`line ${i}: unknown docs-check marker "${marker}" (known: ${MARKERS.join(', ')})`);
    let end = i + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
    if (end >= lines.length) throw new Error(`line ${i + 1}: the code block has no closing fence`);
    if (SHELL_LANGUAGES.includes(language)) {
      for (let n = i + 1; n < end; n++) {
        let text = lines[n].slice(Math.min(indent, lines[n].length - lines[n].trimStart().length)).replace(/^\$ /, '');
        const start = n;
        while (text.endsWith('\\') && n + 1 < end) {
          n++;
          text = `${text.slice(0, -1)} ${lines[n].trim()}`;
        }
        if (/^(npx )?printshop(\s|$)/.test(text)) found.push({ command: text.trim(), line: start + 1, marker });
      }
    }
    i = end;
  }
  return found;
}

test('extractCommands: finds printshop commands in shell blocks, joins continuation lines and reads markers', () => {
  const found = extractCommands(
    [
      '# Title',
      '```sh',
      'printshop build a.html',
      '# a comment',
      'node other.js',
      '$ npx printshop ref frames \\',
      '    clip.mp4 --max 4',
      '```',
      '```js',
      'printshop in js is not a command',
      '```',
      '<!-- docs-check: ffmpeg -->',
      '```sh',
      'printshop --version',
      '```',
      '1. A step.',
      '',
      '   ```bash',
      '   printshop new-style x',
      '   ```',
    ].join('\n'),
  );
  assert.deepEqual(found, [
    { command: 'printshop build a.html', line: 3, marker: null },
    { command: 'npx printshop ref frames  clip.mp4 --max 4', line: 6, marker: null },
    { command: 'printshop --version', line: 14, marker: 'ffmpeg' },
    { command: 'printshop new-style x', line: 19, marker: null },
  ]);
  assert.throws(() => extractCommands('<!-- docs-check: later -->\n```sh\nprintshop a\n```'), /unknown docs-check marker/);
  assert.throws(() => extractCommands('```sh\nprintshop a\n'), /no closing fence/);
});

/** @type {string} */
let work;
/** @type {string} */
let shims;
/** @type {string | null} */
let ffmpeg = null;
before(async () => {
  work = await mkdtemp(path.join(os.tmpdir(), 'printshop-docs-'));
  shims = path.join(work, 'shims');
  await mkdir(shims);
  const printshop = path.join(shims, 'printshop');
  await writeFile(printshop, `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, 'bin/printshop.js')}" "$@"\n`);
  // `npx printshop ...` runs the same program. It never goes to the network.
  const npx = path.join(shims, 'npx');
  await writeFile(npx, `#!/bin/sh\nif [ "$1" = printshop ]; then shift; exec "${printshop}" "$@"; fi\necho "the docs check runs only 'npx printshop' commands, not: npx $*" >&2\nexit 127\n`);
  await chmod(printshop, 0o755);
  await chmod(npx, 0o755);
  ffmpeg = await findFfmpeg().catch(() => null);
});
after(async () => {
  await rm(work, { recursive: true, force: true });
});

/**
 * Makes a temp project like the project of a reader: a `package.json`, the package in `node_modules`, and the stand-ins for the reference files.
 * @param {string} name
 * @returns {Promise<string>} The folder of the project.
 */
async function makeProject(name) {
  const dir = await mkdtemp(path.join(work, `${name}-`));
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'docs-check-project', private: true, type: 'module' }));
  await mkdir(path.join(dir, 'node_modules', '@tranbao0'), { recursive: true });
  await symlink(root, path.join(dir, 'node_modules', '@tranbao0', 'printshop'), 'dir');
  // A gray image of smooth noise, and a screenshot of it: scaled, moved, on a white page, with a red mark over it.
  const size = 400;
  const field = fractalField(size, size, [[40, 0.6], [12, 0.4]], 12345);
  const raw = Buffer.alloc(size * size);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.round(255 * Math.min(1, Math.max(0, (field[i] - 0.5) * 2.2 + 0.5)));
  const image = await sharp(raw, { raw: { width: size, height: size, channels: 1 } }).png().toBuffer();
  const small = await sharp(image).resize(320, 320).png().toBuffer();
  const mark = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="420"><path d="M60 80 L300 200 L420 120" stroke="#e61b1b" stroke-width="6" fill="none"/></svg>');
  await writeFile(path.join(dir, 'reference.png'), image);
  await writeFile(path.join(dir, 'screenshot.png'), await sharp({ create: { width: 480, height: 420, channels: 3, background: '#ffffff' } }).composite([{ input: small, left: 77, top: 31 }, { input: mark }]).png().toBuffer());
  if (ffmpeg) await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10', '-c:v', 'mpeg4', '-q:v', '3', path.join(dir, 'reference.mp4')]);
  return dir;
}

/** The Markdown files of the docs: the README and every file in docs/. */
const files = ['README.md', ...(await readdir(path.join(root, 'docs'))).filter((f) => f.endsWith('.md')).sort().map((f) => `docs/${f}`)];

// In CI a missing ffmpeg is a failure, so that the blocks that need it cannot be skipped there without notice.
test('ffmpeg is present when CI runs the docs check', { skip: process.env.CI ? false : 'not in CI' }, () => {
  assert.ok(ffmpeg, 'ffmpeg not found: the docs check needs it in CI');
});

for (const file of files) {
  test(`docs: every printshop command in ${file} runs and exits 0`, async (t) => {
    const commands = extractCommands(await readFile(path.join(root, file), 'utf8'));
    // A file with no command to check would pass with nothing run. The README and the two guides must have commands.
    if (file === 'README.md' || file === 'docs/adding-a-style.md' || file === 'docs/process.md') assert.ok(commands.length > 0, `${file} has no printshop command to check`);
    const project = await makeProject(path.basename(file, '.md'));
    /** @type {Record<string, string | undefined>} */
    const env = { ...process.env, PATH: `${shims}${path.delimiter}${process.env.PATH}`, ...(ffmpeg && { FFMPEG: ffmpeg }) };
    // A test run inside `node --test` must not make a nested `node --test` report as a child of it.
    delete env.NODE_TEST_CONTEXT;
    for (const { command, line, marker } of commands) {
      await t.test(`${file}:${line} ${command}`, async (sub) => {
        if (marker === 'network' && process.env.DOCS_CHECK_NETWORK !== '1') return sub.skip('needs the network: set DOCS_CHECK_NETWORK=1 to run it');
        if (marker === 'ffmpeg' && !ffmpeg) {
          assert.ok(!process.env.CI, 'ffmpeg not found, and CI needs it for this command');
          return sub.skip('ffmpeg not found: set FFMPEG to the ffmpeg program, or put ffmpeg on PATH, to run this command');
        }
        try {
          const { stderr } = await run('sh', ['-c', command], { cwd: project, env, maxBuffer: 64 * 1024 * 1024 });
          // A pack that fails to load is skipped with a message and the build can still go on with another pack.
          assert.doesNotMatch(stderr, /skipped the pack/, `${command}: a pack failed to load`);
        } catch (error) {
          const e = /** @type {{ code?: number, stdout?: string, stderr?: string }} */ (error);
          assert.fail(`${file}:${line}: "${command}" exited with ${e.code}\n${e.stderr ?? ''}${e.stdout ?? ''}`);
        }
      });
    }
  });
}

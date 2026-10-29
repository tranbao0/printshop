// The docs check: every shell command in a code block of README.md and docs/*.md runs and exits 0.
//
// How it works:
// - One temp project for each Markdown file. The project has `node_modules/@tranbao0/printshop` (a link to this repository), so a pack that
//   `printshop new-style` makes finds the core, and the examples are at `node_modules/@tranbao0/printshop/examples`, as in a real project.
// - The code blocks of a file run in the order of the file, in the temp project, so `new-style` comes before `build packs/...`.
//   Every command line of a `sh`, `bash`, `shell` or `console` block runs with `sh -c`: `printshop`, `node`, `cp` and the rest.
// - `printshop` and `npx printshop` are small scripts on PATH that start bin/printshop.js. The `npx` script never touches the network.
// - The files that the docs call `reference.mp4`, `reference.png` and `screenshot.png` stand in for the reader's own reference files.
//   They are made here: a short test video (needs ffmpeg), a gray image, and a screenshot of that image with a red mark.
// - A code block in another language (js, html, css) is a change to a file of the reader. The block applies it to the temp project when it has
//   the marker `apply <id>`. The text of the change comes from the Markdown, and EDITS below says where it goes. This is how the walk-through of
//   docs/adding-a-style.md changes the pack that `new-style` made, as the reader does.
// - DOCS_CHECK_KEEP=1 keeps the temp projects and prints their folder.
//
// A block can have a marker on the line before its opening fence:
//   <!-- docs-check: ffmpeg -->        run the block only when ffmpeg is there. In CI (the CI variable is set) a missing ffmpeg is a failure.
//   <!-- docs-check: network -->       skip the block unless DOCS_CHECK_NETWORK=1. It runs in an empty folder, with the real `npx` and PATH.
//   <!-- docs-check: skip REASON -->   do not run the block. The reason is required. A reason that starts with "CI runs" means that every
//                                      command of the block must be a `run:` step of the CI workflow, so the skip cannot drift from CI.
//   <!-- docs-check: apply ID -->      apply the block as the change ID of EDITS.
//   <!-- docs-check: illustrative -->  the block is only a picture of code. Nothing applies it.
// A js, html or css block needs `apply` or `illustrative`. A command that exits with a code other than 0 fails the test.
// A block with an unknown marker fails the test too.
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

/** The markers of a shell block, and the markers of a block of code. */
const SHELL_MARKERS = ['ffmpeg', 'network', 'skip'];
const CODE_MARKERS = ['apply', 'illustrative'];

/** The languages of a code block that holds shell commands. */
const SHELL_LANGUAGES = ['sh', 'bash', 'shell', 'console'];

/** The languages of a code block that is a change to a file, and so needs `apply` or `illustrative`. */
const CODE_LANGUAGES = ['js', 'javascript', 'html', 'css', 'json'];

/**
 * @typedef {object} Marker
 * @property {string} kind
 * @property {string} arg The rest of the marker: the reason of `skip`, the id of `apply`, or an empty string.
 */

/**
 * @typedef {object} DocCommand
 * @property {string} command The command, with its continuation lines joined.
 * @property {number} line The line of the command in the file, from 1.
 */

/**
 * @typedef {object} DocBlock
 * @property {string} language
 * @property {number} line The line of the opening fence, from 1.
 * @property {Marker | null} marker
 * @property {string} text The lines between the fences, de-indented by the indent of the opening fence.
 * @property {DocCommand[]} commands The commands of a shell block. A code block has none.
 */

/**
 * Finds the code blocks of a Markdown text, with their markers and, for a shell block, their commands.
 * A command is a line of the block that is not blank and not a comment. A leading `$ ` is dropped.
 * A line that ends with a backslash goes on in the next line. In a `console` block only the lines with a `$ ` prompt are commands.
 * @param {string} markdown
 * @returns {DocBlock[]}
 */
export function extractBlocks(markdown) {
  const lines = markdown.split('\n');
  /** @type {DocBlock[]} */
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)```([\w-]*)\s*$/.exec(lines[i]);
    if (!open) continue;
    const indent = open[1].length;
    const language = open[2];
    const markerLine = i > 0 ? /^\s*<!--\s*docs-check:\s*(.*?)\s*-->\s*$/.exec(lines[i - 1]) : null;
    /** @type {Marker | null} */
    let marker = null;
    if (markerLine) {
      const [kind, ...rest] = markerLine[1].split(/\s+/);
      marker = { kind, arg: rest.join(' ') };
      const isShell = SHELL_LANGUAGES.includes(language);
      const known = isShell ? SHELL_MARKERS : CODE_MARKERS;
      if (!known.includes(kind)) throw new Error(`line ${i}: unknown docs-check marker "${kind}" for a ${language || 'plain'} block (known: ${known.join(', ')})`);
      if (kind === 'skip' && !marker.arg) throw new Error(`line ${i}: the marker "skip" needs a reason`);
      if (kind === 'apply' && !marker.arg) throw new Error(`line ${i}: the marker "apply" needs an id`);
      if (!['skip', 'apply'].includes(kind) && marker.arg) throw new Error(`line ${i}: the marker "${kind}" takes no argument`);
    }
    let end = i + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
    if (end >= lines.length) throw new Error(`line ${i + 1}: the code block has no closing fence`);
    const body = lines.slice(i + 1, end).map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length)));
    if (CODE_LANGUAGES.includes(language) && !marker) throw new Error(`line ${i + 1}: a ${language} block needs the marker "apply <id>" or "illustrative" on the line before it`);
    /** @type {DocCommand[]} */
    const commands = [];
    if (SHELL_LANGUAGES.includes(language)) {
      for (let n = 0; n < body.length; n++) {
        let text = body[n];
        if (language === 'console' && !text.startsWith('$ ')) continue;
        text = text.replace(/^\$ /, '');
        const start = n;
        while (text.endsWith('\\') && n + 1 < body.length) {
          n++;
          text = `${text.slice(0, -1)} ${body[n].trim()}`;
        }
        if (text.trim() === '' || text.trim().startsWith('#')) continue;
        commands.push({ command: text.trim(), line: i + 2 + start });
      }
    }
    blocks.push({ language, line: i + 1, marker, text: body.join('\n'), commands });
    i = end;
  }
  return blocks;
}

test('extractBlocks: finds the commands of shell blocks, joins continuation lines and reads markers', () => {
  const blocks = extractBlocks(
    [
      '# Title',
      '```sh',
      'printshop build a.html',
      '# a comment',
      '',
      'node other.js',
      '$ npx printshop ref frames \\',
      '    clip.mp4 --max 4',
      '```',
      '<!-- docs-check: illustrative -->',
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
      '<!-- docs-check: skip CI runs it -->',
      '```sh',
      'npm ci',
      '```',
      '<!-- docs-check: apply my-id -->',
      '```html',
      '<b>x</b>',
      '```',
      '```console',
      '$ printshop a',
      'output',
      '```',
    ].join('\n'),
  );
  assert.deepEqual(
    blocks.map((b) => ({ language: b.language, marker: b.marker, commands: b.commands })),
    [
      { language: 'sh', marker: null, commands: [{ command: 'printshop build a.html', line: 3 }, { command: 'node other.js', line: 6 }, { command: 'npx printshop ref frames  clip.mp4 --max 4', line: 7 }] },
      { language: 'js', marker: { kind: 'illustrative', arg: '' }, commands: [] },
      { language: 'sh', marker: { kind: 'ffmpeg', arg: '' }, commands: [{ command: 'printshop --version', line: 16 }] },
      { language: 'bash', marker: null, commands: [{ command: 'printshop new-style x', line: 21 }] },
      { language: 'sh', marker: { kind: 'skip', arg: 'CI runs it' }, commands: [{ command: 'npm ci', line: 25 }] },
      { language: 'html', marker: { kind: 'apply', arg: 'my-id' }, commands: [] },
      { language: 'console', marker: null, commands: [{ command: 'printshop a', line: 32 }] },
    ],
  );
  assert.equal(blocks[5].text, '<b>x</b>');
  assert.throws(() => extractBlocks('<!-- docs-check: later -->\n```sh\nprintshop a\n```'), /unknown docs-check marker/);
  assert.throws(() => extractBlocks('<!-- docs-check: apply x -->\n```sh\nprintshop a\n```'), /unknown docs-check marker/);
  assert.throws(() => extractBlocks('<!-- docs-check: skip -->\n```sh\nprintshop a\n```'), /needs a reason/);
  assert.throws(() => extractBlocks('<!-- docs-check: apply -->\n```js\nx\n```'), /needs an id/);
  assert.throws(() => extractBlocks('```js\nx\n```'), /needs the marker/);
  assert.throws(() => extractBlocks('```sh\nprintshop a\n'), /no closing fence/);
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
  // DOCS_CHECK_KEEP=1 keeps the temp projects, so that you can look at the images that the docs build.
  if (process.env.DOCS_CHECK_KEEP === '1') console.log(`docs check: kept ${work}`);
  else await rm(work, { recursive: true, force: true });
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

/**
 * Gives the Markdown snippet the indent of the place where it goes: every line but the first gets `spaces` more spaces.
 * @param {string} snippet
 * @param {number} spaces
 */
function indent(snippet, spaces) {
  return snippet.split('\n').map((l, n) => (n === 0 || l === '' ? l : ' '.repeat(spaces) + l)).join('\n');
}

/**
 * Changes a file of the temp project. The change must find its place: a snippet that does not fit the file fails the test.
 * @param {string} project
 * @param {string} file The path in the project.
 * @param {(source: string) => string} change
 */
async function editFile(project, file, change) {
  const source = await readFile(path.join(project, file), 'utf8');
  const result = change(source);
  assert.notEqual(result, source, `${file}: the change did not alter the file`);
  await writeFile(path.join(project, file), result);
}

/**
 * Puts a snippet before or after the one place of the source where `anchor` stands.
 * @param {string} source
 * @param {string} anchor
 * @param {string} snippet
 * @param {'before' | 'after'} where
 */
function insertAt(source, anchor, snippet, where) {
  const first = source.indexOf(anchor);
  assert.ok(first >= 0, `the anchor ${JSON.stringify(anchor)} is not in the file`);
  assert.equal(source.indexOf(anchor, first + 1), -1, `the anchor ${JSON.stringify(anchor)} is in the file more than once`);
  const at = where === 'before' ? first : first + anchor.length;
  return `${source.slice(0, at)}${snippet}${source.slice(at)}`;
}

/**
 * Replaces the one part of the source that matches `pattern`.
 * @param {string} source
 * @param {RegExp} pattern
 * @param {string} snippet
 */
function replaceAt(source, pattern, snippet) {
  assert.ok(pattern.test(source), `the pattern ${pattern} does not match the file`);
  return source.replace(pattern, () => snippet);
}

/**
 * The changes that code blocks apply, by file and id. Each takes the project folder and the text of the block.
 * The snippets of the docs say where they go in words. The anchors here are the same places.
 * @type {Record<string, Record<string, (project: string, snippet: string) => Promise<void>>>}
 */
const EDITS = {
  'docs/adding-a-style.md': {
    // Section 4: the step goes after `grainStep`, and the list of steps gets it.
    'scan-step': (project, snippet) => editFile(project, 'packs/riso-test/filter.js', (src) => insertAt(src, '/** @type {AnyStep[]} */', `${snippet}\n\n`, 'before')),
    'look-steps': (project, snippet) => editFile(project, 'packs/riso-test/filter.js', (src) => replaceAt(src, /export const lookSteps = \[[\s\S]*?\n\];/, snippet)),
    // Section 6: the presets.
    presets: (project, snippet) => editFile(project, 'packs/riso-test/index.js', (src) => replaceAt(src, /presets: \{[\s\S]*?\n {2}\},/, indent(snippet, 2))),
    // Section 7: the font in the pack and in the layout.
    assets: (project, snippet) => editFile(project, 'packs/riso-test/index.js', (src) => replaceAt(src, /assets: \[\],/, indent(snippet, 2))),
    'font-css': (project, snippet) => editFile(project, 'packs/riso-test/example/page.html', (src) => insertAt(src, '</style>', `  ${indent(snippet, 2)}\n`, 'before')),
    'font-div': (project, snippet) => editFile(project, 'packs/riso-test/example/page.html', (src) => insertAt(src, '  <div class="shape ramp"></div>\n', `  ${snippet}\n`, 'after')),
    // Section 8: the check, its test, and the call of the check.
    'check-ink': (project, snippet) => editFile(project, 'packs/riso-test/index.js', (src) => insertAt(src, '/** @type {import(\'@tranbao0/printshop/core/types\').StylePack} */', `${snippet}\n\n`, 'before')),
    'check-ink-test': (project, snippet) => writeFile(path.join(project, 'packs/riso-test/ink.test.js'), `${snippet}\n`),
    'check-call': (project, snippet) => editFile(project, 'packs/riso-test/index.js', (src) => replaceAt(src, /checks: async \(\{ png \}\) => \{[\s\S]*?\n {2}\},/, indent(snippet, 2))),
    // Section 9: the second example.
    examples: (project, snippet) => editFile(project, 'packs/riso-test/index.js', (src) => replaceAt(src, /examples: \[[\s\S]*?\n {2}\],/, indent(snippet, 2))),
  },
};

/**
 * Runs a command with `sh -c` and fails the test with its output when it exits with a code other than 0.
 * @param {string} where The file and line, for the message.
 * @param {string} command
 * @param {string} cwd
 * @param {Record<string, string | undefined>} env
 */
async function runCommand(where, command, cwd, env) {
  try {
    const { stderr } = await run('sh', ['-c', command], { cwd, env, maxBuffer: 64 * 1024 * 1024 });
    // A pack that fails to load is skipped with a message and the build can still go on with another pack.
    assert.doesNotMatch(stderr, /skipped the pack/, `${command}: a pack failed to load`);
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    const e = /** @type {{ code?: number, stdout?: string, stderr?: string }} */ (error);
    assert.fail(`${where}: "${command}" exited with ${e.code}\n${e.stderr ?? ''}${e.stdout ?? ''}`);
  }
}

/** The Markdown files of the docs: the README and every file in docs/. */
const files = ['README.md', ...(await readdir(path.join(root, 'docs'))).filter((f) => f.endsWith('.md')).sort().map((f) => `docs/${f}`)];

// In CI a missing ffmpeg is a failure, so that the blocks that need it cannot be skipped there without notice.
test('ffmpeg is present when CI runs the docs check', { skip: process.env.CI ? false : 'not in CI' }, () => {
  assert.ok(ffmpeg, 'ffmpeg not found: the docs check needs it in CI');
});

test('the commands of a "skip CI runs" block are steps of the CI workflow', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const steps = new Set([...workflow.matchAll(/^\s*- run: (.+?)\s*$/gm)].map((m) => m[1]));
  let checked = 0;
  for (const file of files) {
    for (const block of extractBlocks(await readFile(path.join(root, file), 'utf8'))) {
      if (block.marker?.kind !== 'skip' || !block.marker.arg.startsWith('CI runs')) continue;
      for (const { command, line } of block.commands) {
        assert.ok(steps.has(command), `${file}:${line}: "${command}" is skipped because CI runs it, but ci.yml has no such step`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'no command is marked "skip CI runs"');
});

for (const file of files) {
  test(`docs: every command in ${file} runs and exits 0`, async (t) => {
    const blocks = extractBlocks(await readFile(path.join(root, file), 'utf8'));
    const commandCount = blocks.reduce((n, b) => n + b.commands.length, 0);
    // A file with no command to check would pass with nothing run. The README and the two guides must have commands.
    if (file === 'README.md' || file === 'docs/adding-a-style.md' || file === 'docs/process.md') assert.ok(commandCount > 0, `${file} has no command to check`);
    const edits = EDITS[file] ?? {};
    const project = await makeProject(path.basename(file, '.md'));
    /** @type {Record<string, string | undefined>} */
    const env = { ...process.env, PATH: `${shims}${path.delimiter}${process.env.PATH}`, ...(ffmpeg && { FFMPEG: ffmpeg }) };
    // A test run inside `node --test` must not make a nested `node --test` report as a child of it.
    // The docs run `node --test packs/<name>/pack.test.js` in the temp project.
    delete env.NODE_TEST_CONTEXT;
    /** The environment of a network block: the real PATH, and the real `npx`. */
    const networkEnv = { ...env, PATH: process.env.PATH };
    const applied = new Set();
    for (const block of blocks) {
      const { marker } = block;
      if (marker?.kind === 'apply') {
        const apply = edits[marker.arg];
        await t.test(`${file}:${block.line} apply ${marker.arg}`, async () => {
          assert.ok(apply, `${file}:${block.line}: no change "${marker.arg}" in EDITS of test/docs.test.js`);
          applied.add(marker.arg);
          await apply(project, block.text);
        });
        continue;
      }
      for (const { command, line } of block.commands) {
        await t.test(`${file}:${line} ${command}`, async (sub) => {
          if (marker?.kind === 'skip') return sub.skip(marker.arg);
          if (marker?.kind === 'network') {
            if (process.env.DOCS_CHECK_NETWORK !== '1') return sub.skip('needs the network: set DOCS_CHECK_NETWORK=1 to run it');
            const empty = await mkdtemp(path.join(work, 'network-'));
            await writeFile(path.join(empty, 'package.json'), JSON.stringify({ name: 'docs-check-network', private: true }));
            return runCommand(`${file}:${line}`, command, empty, networkEnv);
          }
          if (marker?.kind === 'ffmpeg' && !ffmpeg) {
            assert.ok(!process.env.CI, 'ffmpeg not found, and CI needs it for this command');
            return sub.skip('ffmpeg not found: set FFMPEG to the ffmpeg program, or put ffmpeg on PATH, to run this command');
          }
          await runCommand(`${file}:${line}`, command, project, env);
        });
      }
    }
    assert.deepEqual(Object.keys(edits).filter((id) => !applied.has(id)), [], `${file}: changes in EDITS that no code block applies`);
  });
}

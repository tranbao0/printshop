// Regenerates the declaration files in types/ from the JSDoc of the source: `npm run types`.
// With --check it makes the files in a temp folder instead and fails if they differ from the committed files in types/.
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

/** The file of types/ that is written by hand. Everything else in types/ is written by tsc. */
const HAND_WRITTEN = 'README.md';

/**
 * Lists the files of a folder, with paths relative to it.
 * @param {string} folder
 * @param {string} [sub]
 * @returns {Promise<string[]>}
 */
async function listFiles(folder, sub = '') {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(path.join(folder, sub), { withFileTypes: true }).catch(() => [])) {
    const rel = path.join(sub, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(folder, rel)));
    else files.push(rel);
  }
  return files.sort();
}

/**
 * Compares two texts and ignores the difference between CRLF and LF line endings.
 * @param {string} a
 * @param {string} b
 */
function sameText(a, b) {
  return a.replaceAll('\r\n', '\n') === b.replaceAll('\r\n', '\n');
}

/**
 * Writes the declaration files into `outDir`.
 * @param {string} outDir
 */
async function generate(outDir) {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  await run(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.types.json'), '--outDir', outDir], { cwd: root });
}

const check = process.argv.includes('--check');
if (!check) {
  for (const entry of await readdir(path.join(root, 'types')).catch(() => [])) {
    if (entry !== HAND_WRITTEN) await rm(path.join(root, 'types', entry), { recursive: true, force: true });
  }
  await generate(path.join(root, 'types'));
} else {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'printshop-types-'));
  try {
    await generate(temp);
    /** @type {string[]} */
    const problems = [];
    const fresh = (await listFiles(temp)).filter((f) => f !== HAND_WRITTEN);
    const kept = (await listFiles(path.join(root, 'types'))).filter((f) => f !== HAND_WRITTEN);
    for (const f of kept) if (!fresh.includes(f)) problems.push(`types/${f} is not made any more`);
    for (const f of fresh) {
      if (!kept.includes(f)) problems.push(`types/${f} is missing`);
      else if (!sameText(await readFile(path.join(temp, f), 'utf8'), await readFile(path.join(root, 'types', f), 'utf8'))) problems.push(`types/${f} is out of date`);
    }
    if (problems.length > 0) {
      console.error(`${problems.join('\n')}\nRun "npm run types" and commit the result.`);
      process.exitCode = 1;
    } else {
      console.log(`types/ is up to date (${fresh.length} files)`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

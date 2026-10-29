// The command-line tool: finds the command and turns errors into messages and exit codes.
import { readFile } from 'node:fs/promises';
import { FfmpegError } from '../core/ref/ffmpeg.js';
import * as build from './build.js';
import { UsageError } from './io.js';
import * as newStyle from './new-style.js';
import * as ref from './ref.js';

/** @type {Record<string, { run: (args: string[], io: import('./io.js').Io) => Promise<number>, summary: string, help: string }>} */
const commands = { build, 'new-style': newStyle, ref };

const usage = `Usage: printshop <command> [options]

Commands:
${Object.entries(commands).map(([name, c]) => `  ${name.padEnd(10)} ${c.summary}`).join('\n')}

Run "printshop <command> --help" for the options of a command.
Headless Chromium must be installed (npx playwright install chromium).`;

/**
 * Runs the tool.
 * @param {string[]} argv The arguments after the name of the program.
 * @param {Partial<import('./io.js').Io>} [overrides]
 * @returns {Promise<number>} The exit code: 0 for success, 1 for a failure or a failed check, 2 for a mistake in the call.
 */
export async function main(argv, overrides = {}) {
  /** @type {import('./io.js').Io} */
  const io = {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    cwd: process.cwd(),
    env: process.env,
    ...overrides,
  };
  const [name, ...rest] = argv;
  try {
    if (!name || name === '--help' || name === '-h' || name === 'help') {
      io.out(usage);
      return name ? 0 : 2;
    }
    if (name === '--version' || name === '-v') {
      const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
      io.out(pkg.version);
      return 0;
    }
    const command = commands[name];
    if (!command) throw new UsageError(`unknown command "${name}"`);
    if (rest[0] === 'help') rest[0] = '--help';
    return await command.run(rest, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`printshop: ${error.message}`);
      io.err(`Run "printshop ${name && commands[name] ? `${name} ` : ''}--help" for the usage.`);
      return 2;
    }
    if (error instanceof FfmpegError) {
      io.err(`printshop: ${error.message}`);
      return 1;
    }
    io.err(`printshop: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && io.env.PRINTSHOP_DEBUG) io.err(error.stack ?? '');
    return 1;
  }
}

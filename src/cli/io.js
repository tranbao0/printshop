// What every command of the command-line tool shares: the input and output streams, the errors and the argument parser.
import path from 'node:path';
import { parseArgs } from 'node:util';

/**
 * @typedef {object} Io
 * @property {(text: string) => void} out Writes a line to standard output.
 * @property {(text: string) => void} err Writes a line to standard error.
 * @property {string} cwd
 * @property {Record<string, string | undefined>} env
 */

/** A mistake in how the tool is called. The tool shows the message and the help, and exits with 2. */
export class UsageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * Parses the arguments of a command. An unknown option or a missing value is a `UsageError`.
 * @template {import('node:util').ParseArgsConfig['options']} O
 * @param {string[]} args
 * @param {O} options
 * @returns {{ values: import('node:util').ParseArgsConfig extends any ? Record<string, any> : never, positionals: string[] }}
 */
export function parse(args, options) {
  try {
    const { values, positionals } = parseArgs({ args, options, allowPositionals: true, strict: true });
    return { values, positionals };
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Reads a whole number option.
 * @param {string} name The option, for the message.
 * @param {string | undefined} text
 * @param {{ min?: number }} [limits]
 * @returns {number | undefined}
 */
export function wholeNumber(name, text, { min = 0 } = {}) {
  if (text === undefined) return undefined;
  const n = Number(text);
  if (!Number.isInteger(n) || n < min) throw new UsageError(`${name} must be a whole number, ${min} or more, not "${text}"`);
  return n;
}

/**
 * Reads a number option.
 * @param {string} name
 * @param {string | undefined} text
 * @returns {number | undefined}
 */
export function number(name, text) {
  if (text === undefined) return undefined;
  const n = Number(text);
  if (text.trim() === '' || !Number.isFinite(n)) throw new UsageError(`${name} must be a number, not "${text}"`);
  return n;
}

/**
 * A path for a message: relative to the working folder, or absolute if the file is outside it.
 * @param {string} cwd
 * @param {string} file
 */
export function shown(cwd, file) {
  const rel = path.relative(cwd, file);
  return rel.startsWith('..') || path.isAbsolute(rel) ? file : rel || '.';
}

/**
 * JSON with two-space indentation, in which a short list of numbers, such as a point, stays on one line.
 * @param {unknown} value
 */
export function formatJson(value) {
  return JSON.stringify(value, null, 2).replace(/\[\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+)\s+\]/g, '[$1, $2]');
}

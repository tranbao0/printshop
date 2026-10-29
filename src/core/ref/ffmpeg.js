// Finds and runs ffmpeg. The reference tools call the ffmpeg of the system; nothing else needs it.
import { spawn } from 'node:child_process';
import { stat, access, constants } from 'node:fs/promises';
import path from 'node:path';

/** The error for a missing or broken ffmpeg. The command-line tool shows its message as it is. */
export class FfmpegError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'FfmpegError';
  }
}

/** @param {string} file */
async function isExecutableFile(file) {
  try {
    if (!(await stat(file)).isFile()) return false;
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds ffmpeg: the file that the `FFMPEG` environment variable names, or `ffmpeg` on `PATH`.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<string>} The path of the program.
 * @throws {FfmpegError} With a message that tells what to do, if there is no ffmpeg.
 */
export async function findFfmpeg(env = process.env) {
  if (env.FFMPEG) {
    if (await isExecutableFile(env.FFMPEG)) return env.FFMPEG;
    throw new FfmpegError(`ffmpeg not found: the FFMPEG environment variable is "${env.FFMPEG}", but that is not an executable file. Set FFMPEG to the full path of the ffmpeg program, or unset it to search PATH.`);
  }
  const names = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg.cmd', 'ffmpeg'] : ['ffmpeg'];
  for (const dir of (env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (await isExecutableFile(file)) return file;
    }
  }
  throw new FfmpegError('ffmpeg not found: "printshop ref frames" needs it. Install ffmpeg and put it on PATH, or set the FFMPEG environment variable to the full path of the ffmpeg program.');
}

/**
 * Runs ffmpeg and collects its output.
 * @param {string} ffmpeg
 * @param {string[]} args
 * @returns {Promise<{ code: number | null, stdout: Buffer, stderr: string }>}
 */
export function runFfmpeg(ffmpeg, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (error) => reject(new FfmpegError(`ffmpeg could not start (${ffmpeg}): ${error.message}`)));
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') }));
  });
}

/**
 * The last lines of the output of ffmpeg, for an error message.
 * @param {string} stderr
 */
export const tail = (stderr) => stderr.trim().split('\n').slice(-4).join('\n');

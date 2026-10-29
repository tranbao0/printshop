// A frame sheet from a video: thumbnails of chosen frames in a grid, each with its frame number and time.
// The frame numbers are the numbers of the frames in the video (the first frame is 0), so a number in the sheet names the same frame in the video.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { drawText, GLYPH_HEIGHT } from './bitmap-font.js';
import { FfmpegError, runFfmpeg, tail } from './ffmpeg.js';

/**
 * @typedef {object} VideoFrame
 * @property {number} n The frame number in the video, from 0.
 * @property {number} ms The time of the frame in milliseconds.
 */

/**
 * @typedef {object} FrameChoice
 * @property {number[]} [frames] These frame numbers. They win over the other options.
 * @property {number} [from] The first frame number of the range. Default 0.
 * @property {number} [to] The last frame number of the range. Default: the last frame of the video.
 * @property {number} [every] Take every nth frame of the range. Default: a step that gives at most `max` frames.
 * @property {number} [max] The most frames in the sheet. Default 24.
 */

/**
 * Lists the frames of the first video stream with their times.
 * @param {string} ffmpeg
 * @param {string} video
 * @returns {Promise<VideoFrame[]>}
 */
export async function listFrames(ffmpeg, video) {
  const { code, stderr } = await runFfmpeg(ffmpeg, ['-i', video, '-map', '0:v:0', '-an', '-vf', 'showinfo', '-f', 'null', '-']);
  /** @type {VideoFrame[]} */
  const frames = [];
  for (const m of stderr.matchAll(/Parsed_showinfo_\d+ @ \w+\]\s+n:\s*(\d+)\s+pts:\s*(-?\d+|N\/A)\s+pts_time:\s*(-?[\d.]+|N\/A)/g)) {
    frames.push({ n: Number(m[1]), ms: Math.round(Number(m[3]) * 1000) || 0 });
  }
  if (code !== 0 || !frames.length) throw new FfmpegError(`ffmpeg could not read video frames from ${video}:\n${tail(stderr)}`);
  return frames;
}

/**
 * Picks frame numbers from a list of frames.
 * @param {VideoFrame[]} frames All frames of the video.
 * @param {FrameChoice} choice
 * @returns {VideoFrame[]}
 */
export function chooseFrames(frames, { frames: wanted, from = 0, to, every, max = 24 } = {}) {
  const last = frames.length - 1;
  if (wanted?.length) {
    const bad = wanted.filter((n) => !Number.isInteger(n) || n < 0 || n > last);
    if (bad.length) throw new Error(`the video has frames 0 to ${last}; there is no frame ${bad.join(', ')}`);
    return [...new Set(wanted)].sort((a, b) => a - b).map((n) => frames[n]);
  }
  to ??= last;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > last || from > to) throw new Error(`the range ${from} to ${to} does not fit the video, which has frames 0 to ${last}`);
  if (max < 1) throw new Error('the most frames must be at least 1');
  const step = every ?? Math.ceil((to - from + 1) / max);
  if (!Number.isInteger(step) || step < 1) throw new Error('every must be a whole number, 1 or more');
  const picked = [];
  for (let n = from; n <= to; n += step) picked.push(frames[n]);
  return picked;
}

/**
 * Runs ffmpeg for the chosen frames and returns them as PNG files in a folder.
 * @param {string} ffmpeg
 * @param {string} video
 * @param {VideoFrame[]} chosen
 * @param {number} width The width of a thumbnail.
 * @param {string} folder
 */
async function extract(ffmpeg, video, chosen, width, folder) {
  const select = chosen.map((f) => `eq(n,${f.n})`).join('+');
  const filter = `select='${select}',scale=${width}:-2`;
  const args = (/** @type {string[]} */ sync) => ['-y', '-i', video, '-map', '0:v:0', '-an', '-vf', filter, ...sync, path.join(folder, 'f%05d.png')];
  let run = await runFfmpeg(ffmpeg, args(['-fps_mode', 'passthrough']));
  // ffmpeg before 5.1 has no -fps_mode.
  if (run.code !== 0 && /Unrecognized option 'fps_mode'/.test(run.stderr)) run = await runFfmpeg(ffmpeg, args(['-vsync', 'passthrough']));
  if (run.code !== 0) throw new FfmpegError(`ffmpeg could not extract frames from ${video}:\n${tail(run.stderr)}`);
}

/**
 * Makes the frame sheet of a video.
 * @param {string} ffmpeg The path of the ffmpeg program (see `findFfmpeg`).
 * @param {string} video
 * @param {FrameChoice & { cols?: number, width?: number }} [options] `width`: the width of a thumbnail, default 320. `cols`: thumbnails in a row, default 6.
 * @returns {Promise<{ sheet: Buffer, frames: VideoFrame[], cols: number, rows: number, cell: { width: number, height: number } }>}
 */
export async function frameSheet(ffmpeg, video, options = {}) {
  const { width = 320, cols: wantedCols = 6 } = options;
  if (!Number.isInteger(width) || width < 40) throw new Error('the width of a thumbnail must be a whole number, 40 or more');
  if (!Number.isInteger(wantedCols) || wantedCols < 1) throw new Error('the number of columns must be a whole number, 1 or more');
  const chosen = chooseFrames(await listFrames(ffmpeg, video), options);
  const folder = await mkdtemp(path.join(os.tmpdir(), 'printshop-frames-'));
  try {
    await extract(ffmpeg, video, chosen, width, folder);
    const thumbs = [];
    for (let i = 0; i < chosen.length; i++) {
      thumbs.push(await readFile(path.join(folder, `f${String(i + 1).padStart(5, '0')}.png`)).catch(() => {
        throw new FfmpegError(`ffmpeg made ${i} of the ${chosen.length} frames that were asked for`);
      }));
    }
    const first = await sharp(thumbs[0]).metadata();
    const cell = { width: first.width ?? width, height: first.height ?? 0 };
    const scale = cell.width >= 200 ? 2 : 1;
    const labelHeight = (GLYPH_HEIGHT + 3) * scale + 1;
    const cols = Math.min(wantedCols, chosen.length);
    const rows = Math.ceil(chosen.length / cols);
    /** @type {import('sharp').OverlayOptions[]} */
    const layers = [];
    for (let i = 0; i < chosen.length; i++) {
      const left = (i % cols) * cell.width;
      const top = Math.floor(i / cols) * (cell.height + labelHeight);
      const label = new Uint8Array(cell.width * labelHeight * 3).fill(255);
      drawText(label, cell.width, `#${chosen[i].n} ${chosen[i].ms}ms`, 2 * scale, scale + 1, scale, [0, 0, 0]);
      layers.push({ input: Buffer.from(label), raw: { width: cell.width, height: labelHeight, channels: 3 }, left, top });
      layers.push({ input: thumbs[i], left, top: top + labelHeight });
    }
    const sheet = await sharp({ create: { width: cols * cell.width, height: rows * (cell.height + labelHeight), channels: 3, background: '#888888' } })
      .composite(layers)
      .png()
      .toBuffer();
    return { sheet, frames: chosen, cols, rows, cell };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}


// `printshop ref frames|register|trace`: the reference tools.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findFfmpeg } from '../core/ref/ffmpeg.js';
import { frameSheet } from '../core/ref/frames.js';
import { register } from '../core/ref/register.js';
import { drawTrace, isColour, trace } from '../core/ref/trace.js';
import { UsageError, formatJson, number, parse, shown, wholeNumber } from './io.js';

export const summary = 'Reference tools: a frame sheet from a video, registration of a screenshot, tracing of marks.';

export const help = `Usage: printshop ref <tool> [options]

Tools:
  frames <video>                  A sheet of frames from a video, with the frame numbers. Needs ffmpeg.
  register <screenshot> <image>   The scale and the offset that match a screenshot to an image.
  trace <screenshot> --fit <file> The coloured marks of a registered screenshot, in the coordinates of the image.

Run "printshop ref <tool> --help" for the options of a tool.`;

const framesHelp = `Usage: printshop ref frames <video> [options]

Makes a sheet of thumbnails of frames of a video. Each thumbnail has its frame number and its time.
The frame numbers are the numbers in the video: the first frame is 0.
It needs ffmpeg, from PATH or from the FFMPEG environment variable.

Options:
      --frames <list>   These frames, for example 0,12,40. They win over the options below.
      --from <n>        The first frame of the range. Default 0.
      --to <n>          The last frame of the range. Default: the last frame of the video.
      --every <n>       Every nth frame of the range. Default: a step that gives at most --max frames.
      --max <n>         The most frames in the sheet. Default 24.
      --cols <n>        Thumbnails in a row. Default 6.
      --width <px>      The width of a thumbnail. Default 320.
  -o, --out <file>      The sheet, a PNG. Default out/<video name>-frames.png.
  -h, --help            Show this help.`;

const registerHelp = `Usage: printshop ref register <screenshot> <image> [options]

Finds the scale and the offset that match a screenshot to the image that it shows.
The screenshot shows the image, scaled and moved, perhaps with marks drawn over it in a colour and some margin around it.
The result is JSON: a point (x, y) of the screenshot is the point ((x - ox) / sx, (y - oy) / sy) of the image.
The coordinates are in pixel edges: the corner of the first pixel is (0, 0).
"score" is the correlation of the gray values, up to 1.
The image must be gray, or --mark-chroma must be 255.

Options:
      --margin <px>          Pixels of the screenshot to leave out: one number for all sides, or top,right,bottom,left. Default 6.
      --mark-chroma <n>      A screenshot pixel whose colour channels differ by more than this is a mark, and is left out. Default 40.
      --mark-pad <px>        The left out pixels grow by this much. Default 3.
      --scale <min,max>      The range of the scale to try. Default: from half to twice the scale that fits the image into the screenshot.
      --free-aspect          Fit the scale across and down apart.
      --min-score <n>        Fail if the score is lower. Default 0.5.
  -o, --out <file>           Write the JSON to a file. Default: print it.
  -h, --help                 Show this help.`;

const traceHelp = `Usage: printshop ref trace <screenshot> --fit <fit.json> [options]

Finds the marks of one colour in a registered screenshot and maps them into the coordinates of the image.
--fit is the JSON that "printshop ref register" makes (sx, sy, ox and oy).
The result is JSON: for each mark the pixel count, its box in the screenshot and in the image, and "path", a polyline along it in image coordinates.

Options:
      --fit <file>           The registration. Required.
      --colour <colour>      red, green, blue, or a hex colour like #e61b1b. Default red. (--color also works.)
      --threshold <n>        red, green or blue: the channel must be above both others by more than this. Hex: every channel within this. Default 60.
      --min-pixels <n>       Leave out marks with fewer pixels. Default 30.
      --reach <px>           Pixels at most this far apart belong to one mark. Default 3.
      --simplify <px>        The tolerance of the polyline, in screenshot pixels. Default 2.
      --points               Also list every pixel of a mark in image coordinates.
      --image <file>         The image, for --overlay.
      --overlay <file>       Draw the paths over the image and write a PNG.
  -o, --out <file>           Write the JSON to a file. Default: print it.
  -h, --help                 Show this help.`;

/** @param {string} file */
const isFile = (file) => stat(file).then((s) => s.isFile(), () => false);

/**
 * @param {string} cwd
 * @param {string} name What the file is, for the message.
 * @param {string} file
 */
async function requireFile(cwd, name, file) {
  const abs = path.resolve(cwd, file);
  if (!(await isFile(abs))) throw new Error(`no such ${name}: ${file}`);
  return abs;
}

/**
 * @param {string} file
 * @param {string | Buffer} content
 */
async function writeOut(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

/**
 * @param {string} name
 * @param {string | undefined} text
 * @returns {number[] | undefined}
 */
function numberList(name, text) {
  if (text === undefined) return undefined;
  return text.split(',').map((part) => {
    const n = number(name, part);
    return /** @type {number} */ (n);
  });
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
async function runFrames(args, io) {
  const { values, positionals } = parse(args, {
    frames: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    every: { type: 'string' },
    max: { type: 'string' },
    cols: { type: 'string' },
    width: { type: 'string' },
    out: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.out(framesHelp);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError('ref frames needs one video file');
  // Check the options before the search for ffmpeg and the video.
  const wanted = values.frames?.split(',').map((/** @type {string} */ t) => /** @type {number} */ (wholeNumber('--frames', t.trim())));
  const options = {
    frames: wanted,
    from: wholeNumber('--from', values.from),
    to: wholeNumber('--to', values.to),
    every: wholeNumber('--every', values.every, { min: 1 }),
    max: wholeNumber('--max', values.max, { min: 1 }),
    cols: wholeNumber('--cols', values.cols, { min: 1 }),
    width: wholeNumber('--width', values.width, { min: 40 }),
  };
  const ffmpeg = await findFfmpeg(io.env);
  const video = await requireFile(io.cwd, 'video file', positionals[0]);
  const { sheet, frames, cols, rows, cell } = await frameSheet(ffmpeg, video, options);
  const out = path.resolve(io.cwd, values.out ?? path.join('out', `${path.basename(video).replace(/\.[^.]+$/, '')}-frames.png`));
  await writeOut(out, sheet);
  io.out(`frames: ${frames.map((f) => `#${f.n}`).join(' ')}`);
  io.out(`wrote ${shown(io.cwd, out)} (${frames.length} frames, ${cols} x ${rows} thumbnails of ${cell.width}x${cell.height})`);
  return 0;
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
async function runRegister(args, io) {
  const { values, positionals } = parse(args, {
    margin: { type: 'string' },
    'mark-chroma': { type: 'string' },
    'mark-pad': { type: 'string' },
    scale: { type: 'string' },
    'free-aspect': { type: 'boolean' },
    'min-score': { type: 'string' },
    out: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.out(registerHelp);
    return 0;
  }
  if (positionals.length !== 2) throw new UsageError('ref register needs a screenshot and an image');
  const screenshot = await requireFile(io.cwd, 'screenshot', positionals[0]);
  const image = await requireFile(io.cwd, 'image', positionals[1]);
  const margins = numberList('--margin', values.margin);
  if (margins && ![1, 4].includes(margins.length)) throw new UsageError('--margin takes one number, or four: top,right,bottom,left');
  const scale = numberList('--scale', values.scale);
  if (scale && scale.length !== 2) throw new UsageError('--scale takes two numbers: min,max');
  if (scale && !(scale[0] > 0 && scale[1] >= scale[0])) throw new UsageError('--scale takes two numbers, both above 0, the smaller first: min,max');
  const result = await register(screenshot, image, {
    ...(margins && { margin: margins.length === 1 ? [margins[0], margins[0], margins[0], margins[0]] : /** @type {[number, number, number, number]} */ (margins) }),
    markChroma: number('--mark-chroma', values['mark-chroma']),
    markPad: wholeNumber('--mark-pad', values['mark-pad']),
    ...(scale && { scale: /** @type {[number, number]} */ (scale) }),
    freeAspect: values['free-aspect'],
  });
  const round = (/** @type {number} */ v) => Math.round(v * 1e6) / 1e6;
  const json = JSON.stringify({ sx: round(result.sx), sy: round(result.sy), ox: round(result.ox), oy: round(result.oy), score: round(result.score), screenshot: result.screenshot, image: result.image }, null, 2);
  const minScore = number('--min-score', values['min-score']) ?? 0.5;
  if (result.score < minScore) throw new Error(`no good match: the score is ${result.score.toFixed(3)}, below ${minScore}. Check that the screenshot shows this image, and use --margin, --scale and --mark-chroma to help the search.\n${json}`);
  if (values.out) {
    const out = path.resolve(io.cwd, values.out);
    await writeOut(out, `${json}\n`);
    io.out(`wrote ${shown(io.cwd, out)} (scale ${round(result.sx)}, offset ${round(result.ox)}, ${round(result.oy)}, score ${result.score.toFixed(3)})`);
  } else io.out(json);
  return 0;
}

/**
 * Reads the registration that "printshop ref register" makes.
 * @param {string} name The file, for the messages.
 * @param {string} text
 * @returns {{ sx: number, sy: number, ox: number, oy: number }}
 */
function readFit(name, text) {
  const fromRegister = `it must be the JSON that "printshop ref register" makes`;
  /** @type {Record<string, unknown> | null} */
  let fit;
  try {
    fit = JSON.parse(text);
  } catch (error) {
    throw new Error(`${name} is not valid JSON (${error instanceof Error ? error.message : error}); ${fromRegister}`);
  }
  if (typeof fit !== 'object' || fit === null) throw new Error(`${name} is not a JSON object; ${fromRegister}`);
  for (const key of ['sx', 'sy', 'ox', 'oy']) {
    const v = fit[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name} has no number "${key}"; ${fromRegister}`);
    if ((key === 'sx' || key === 'sy') && v <= 0) throw new Error(`${name}: "${key}" must be above 0, not ${v}; ${fromRegister}`);
  }
  return /** @type {{ sx: number, sy: number, ox: number, oy: number }} */ (fit);
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
async function runTrace(args, io) {
  const { values, positionals } = parse(args, {
    fit: { type: 'string' },
    colour: { type: 'string' },
    color: { type: 'string' },
    threshold: { type: 'string' },
    'min-pixels': { type: 'string' },
    reach: { type: 'string' },
    simplify: { type: 'string' },
    points: { type: 'boolean' },
    image: { type: 'string' },
    overlay: { type: 'string' },
    out: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h' },
  });
  if (values.help) {
    io.out(traceHelp);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError('ref trace needs one screenshot');
  if (!values.fit) throw new UsageError('ref trace needs --fit, the JSON of "printshop ref register"');
  if (Boolean(values.overlay) !== Boolean(values.image)) throw new UsageError('--overlay and --image go together');
  const screenshot = await requireFile(io.cwd, 'screenshot', positionals[0]);
  const colour = values.colour ?? values.color;
  if (colour !== undefined && !isColour(colour)) throw new UsageError(`--colour must be red, green, blue or a hex colour like #e61b1b, not "${colour}"`);
  const fit = readFit(values.fit, await readFile(await requireFile(io.cwd, 'fit file', values.fit), 'utf8'));
  const result = await trace(screenshot, fit, {
    colour,
    threshold: number('--threshold', values.threshold),
    minPixels: wholeNumber('--min-pixels', values['min-pixels']),
    reach: wholeNumber('--reach', values.reach, { min: 1 }),
    simplify: number('--simplify', values.simplify),
    points: values.points,
  });
  const json = formatJson(result);
  if (values.out) {
    const out = path.resolve(io.cwd, values.out);
    await writeOut(out, `${json}\n`);
    io.out(`wrote ${shown(io.cwd, out)} (${result.marks.length} marks)`);
  } else io.out(json);
  if (values.overlay && values.image) {
    const overlay = path.resolve(io.cwd, values.overlay);
    await writeOut(overlay, await drawTrace(await requireFile(io.cwd, 'image', values.image), result.marks));
    io.out(`wrote ${shown(io.cwd, overlay)}`);
  }
  if (!result.marks.length) io.err('printshop: no marks of this colour were found');
  return 0;
}

/**
 * @param {string[]} args
 * @param {import('./io.js').Io} io
 * @returns {Promise<number>}
 */
export async function run(args, io) {
  const [tool, ...rest] = args;
  if (!tool || tool === '--help' || tool === '-h') {
    io.out(help);
    return tool ? 0 : 2;
  }
  if (tool === 'frames') return runFrames(rest, io);
  if (tool === 'register') return runRegister(rest, io);
  if (tool === 'trace') return runTrace(rest, io);
  throw new UsageError(`unknown reference tool "${tool}" (frames, register or trace)`);
}

// Registration: finds the scale and the offset that match a screenshot to an image.
//
// The screenshot shows the image, scaled and moved, with marks drawn over it in a colour (red lines, for example) and some margin around it.
// The result is a map between the two: a point (x, y) of the screenshot is the point ((x - ox) / sx, (y - oy) / sy) of the image.
// Both use pixel-edge coordinates: the top left corner of the first pixel is (0, 0), and the centre of pixel (i, j) is (i + 0.5, j + 0.5).
//
// The search runs on shrunk copies of both pictures (a pyramid). At the coarsest level it tries every scale and offset in a range and keeps the best few.
// Each of those then goes down the pyramid, and a pattern search improves the four numbers at every level. The score is the correlation of the gray values.
import { grow, loadGray, loadRgba, shrink } from './raster.js';

/**
 * @typedef {object} Registration
 * @property {number} sx Screenshot pixels per image pixel, across.
 * @property {number} sy Screenshot pixels per image pixel, down.
 * @property {number} ox The screenshot x of the left edge of the image.
 * @property {number} oy The screenshot y of the top edge of the image.
 * @property {number} score The correlation of the gray values over the compared pixels, up to 1. Below about 0.5 the match is poor.
 */

/**
 * @typedef {object} RegisterOptions
 * @property {number} [markChroma] A screenshot pixel whose colour channels differ by more than this is a mark, and is left out. Default 40.
 *   The image must be gray, or this must be 255 (no pixel is left out). Pixels that are not opaque are left out too.
 * @property {number} [markPad] The left out pixels grow by this many pixels, so the edges of a mark stay out. Default 3.
 * @property {[number, number, number, number]} [margin] Pixels of the screenshot to leave out at the top, right, bottom and left. Default 6 on every side.
 *   Use it for a label or a frame around the picture.
 * @property {[number, number]} [scale] The range of the scale to try. Default: from half to twice the scale that fits the image into the screenshot.
 * @property {boolean} [freeAspect] Fit `sx` and `sy` apart. Default: one scale.
 */

/**
 * The gray picture of a screenshot with the mask of the pixels to compare.
 * @typedef {object} ScreenInput
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} gray
 * @property {Uint8Array} valid 1 for a pixel to compare.
 */

const COARSE_MIN = 48;
const MAX_SAMPLES = 40000;
const COARSE_SAMPLES = 1500;
const KEEP = 4;

/**
 * Prepares a screenshot: gray values and the mask of the pixels to compare.
 * @param {string | Buffer} source
 * @param {RegisterOptions} [options]
 * @returns {Promise<ScreenInput>}
 */
export async function loadScreenshot(source, { markChroma = 40, markPad = 3, margin = [6, 6, 6, 6] } = {}) {
  const { width, height, data } = await loadRgba(source);
  const gray = new Float32Array(width * height);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = (r + g + b) / 3;
    if (data[i * 4 + 3] < 250 || Math.max(r, g, b) - Math.min(r, g, b) > markChroma) out[i] = 1;
  }
  const valid = grow(out, width, height, markPad);
  for (let i = 0; i < valid.length; i++) valid[i] = valid[i] ? 0 : 1;
  const [top, right, bottom, left] = margin;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (y < top || y >= height - bottom || x < left || x >= width - right) valid[y * width + x] = 0;
  }
  return { width, height, gray, valid };
}

/**
 * @typedef {object} Samples
 * @property {Float32Array} x Pixel centre, in the units of the level.
 * @property {Float32Array} y
 * @property {Float32Array} v Gray value.
 * @property {number} step The distance between two samples, in pixels of the level.
 */

/**
 * Takes the valid pixels of a level on a regular grid, at most `limit` of them.
 * @param {{ width: number, height: number, gray: Float32Array, valid: Uint8Array | null }} level
 * @param {number} limit
 * @returns {Samples}
 */
function sampleLevel(level, limit) {
  let count = 0;
  if (level.valid) for (let i = 0; i < level.valid.length; i++) count += level.valid[i];
  else count = level.width * level.height;
  const step = Math.max(1, Math.ceil(Math.sqrt(count / limit)));
  /** @type {number[]} */
  const xs = [];
  /** @type {number[]} */
  const ys = [];
  /** @type {number[]} */
  const vs = [];
  for (let y = 0; y < level.height; y += step) {
    for (let x = 0; x < level.width; x += step) {
      const i = y * level.width + x;
      if (level.valid && !level.valid[i]) continue;
      xs.push(x + 0.5);
      ys.push(y + 0.5);
      vs.push(level.gray[i]);
    }
  }
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), v: Float32Array.from(vs), step };
}

/**
 * @typedef {object} Params
 * @property {number} sx
 * @property {number} sy
 * @property {number} ox
 * @property {number} oy
 */

/**
 * One minus the correlation of the samples with the image placed by `p`. 2 when too little of the samples fall on the image.
 * @param {Samples} samples
 * @param {{ width: number, height: number, gray: Float32Array }} image
 * @param {Params} p
 */
function loss(samples, image, p) {
  const { x: xs, y: ys, v: vs } = samples;
  const w = image.width;
  const g = image.gray;
  const maxX = image.width - 1.001;
  const maxY = image.height - 1.001;
  let n = 0;
  let sv = 0;
  let sq = 0;
  let svv = 0;
  let sqq = 0;
  let svq = 0;
  for (let k = 0; k < xs.length; k++) {
    const ax = (xs[k] - p.ox) / p.sx - 0.5;
    const ay = (ys[k] - p.oy) / p.sy - 0.5;
    if (ax < 0 || ay < 0 || ax > maxX || ay > maxY) continue;
    const x0 = ax | 0;
    const y0 = ay | 0;
    const fx = ax - x0;
    const fy = ay - y0;
    const i = y0 * w + x0;
    const v = g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + w] * (1 - fx) * fy + g[i + w + 1] * fx * fy;
    const q = vs[k];
    n++;
    sv += v;
    sq += q;
    svv += v * v;
    sqq += q * q;
    svq += v * q;
  }
  const onImage = (image.width * p.sx * image.height * p.sy) / (samples.step * samples.step);
  if (n < 50 || n < 0.5 * Math.min(xs.length, onImage)) return 2;
  const cov = svq / n - (sv / n) * (sq / n);
  const vv = svv / n - (sv / n) ** 2;
  const qq = sqq / n - (sq / n) ** 2;
  if (vv < 1e-6 || qq < 1e-6) return 1;
  return 1 - cov / Math.sqrt(vv * qq);
}

/**
 * Improves the parameters by a pattern search: try a step in each direction, keep what helps, halve the steps when nothing helps.
 * @param {Samples} samples
 * @param {{ width: number, height: number, gray: Float32Array }} image
 * @param {Params} start
 * @param {{ freeAspect: boolean, minStep: number }} settings `minStep`: stop when the offset step is below this many pixels of the level.
 * @returns {{ p: Params, loss: number }}
 */
function refine(samples, image, start, { freeAspect, minStep }) {
  let p = { ...start };
  let best = loss(samples, image, p);
  let stepO = 1.5;
  // A scale step that moves the far edge of the image by one step of the offset.
  const scaleStep = () => stepO / (Math.max(image.width * p.sx, image.height * p.sy));
  for (let iteration = 0; iteration < 600 && stepO >= minStep; iteration++) {
    const ds = scaleStep();
    /** @type {Params[]} */
    const moves = [
      { ...p, ox: p.ox + stepO },
      { ...p, ox: p.ox - stepO },
      { ...p, oy: p.oy + stepO },
      { ...p, oy: p.oy - stepO },
      { ...p, sx: p.sx * (1 + ds), sy: p.sy * (1 + ds) },
      { ...p, sx: p.sx * (1 - ds), sy: p.sy * (1 - ds) },
    ];
    if (freeAspect) {
      moves.push({ ...p, sx: p.sx * (1 + ds) }, { ...p, sx: p.sx * (1 - ds) }, { ...p, sy: p.sy * (1 + ds) }, { ...p, sy: p.sy * (1 - ds) });
    }
    let improved = false;
    for (const move of moves) {
      const l = loss(samples, image, move);
      if (l < best - 1e-9) {
        best = l;
        p = move;
        improved = true;
      }
    }
    if (!improved) stepO /= 2;
  }
  return { p, loss: best };
}

/**
 * Finds the registration of a screenshot to an image.
 * @param {ScreenInput} screen
 * @param {import('./raster.js').GrayRaster} image
 * @param {RegisterOptions} [options]
 * @returns {Registration}
 */
export function registerRasters(screen, image, { scale, freeAspect = false } = {}) {
  const fit = Math.min(screen.width / image.width, screen.height / image.height);
  const [sMin, sMax] = scale ?? [fit * 0.5, fit * 2];
  if (!(sMin > 0) || !(sMax >= sMin)) throw new Error('the scale range must be two numbers, the smaller first, both above 0');

  let factor = 1;
  while (Math.min(screen.width, screen.height) / (factor * 2) >= COARSE_MIN && Math.min(image.width, image.height) / (factor * 2) >= COARSE_MIN / 2) factor *= 2;
  const factors = [];
  for (let f = factor; f >= 1; f /= 2) factors.push(f);

  const shrunk = new Map(
    factors.map((f) => {
      const s = shrink({ width: screen.width, height: screen.height, gray: screen.gray }, screen.valid, f);
      const i = shrink(image, null, f);
      return [f, { samples: sampleLevel(s, f === 1 ? MAX_SAMPLES : f === factor ? COARSE_SAMPLES : MAX_SAMPLES / 2), image: i }];
    }),
  );

  // Every scale and offset in the range, at the coarsest level.
  const coarse = /** @type {NonNullable<ReturnType<typeof shrunk.get>>} */ (shrunk.get(factor));
  const sw = screen.width / factor;
  const sh = screen.height / factor;
  /** @type {{ p: Params, loss: number }[]} */
  let kept = [];
  for (let s = sMin; s <= sMax * 1.0001; s *= 1 + 1 / (Math.max(coarse.image.width, coarse.image.height) * s)) {
    const fw = coarse.image.width * s;
    const fh = coarse.image.height * s;
    for (let oy = -0.5 * fh; oy <= sh - 0.5 * fh; oy += 1) {
      for (let ox = -0.5 * fw; ox <= sw - 0.5 * fw; ox += 1) {
        const p = { sx: s, sy: s, ox, oy };
        const l = loss(coarse.samples, coarse.image, p);
        if (l >= 1.5) continue;
        const near = kept.findIndex((k) => Math.abs(k.p.ox - ox) <= 3 && Math.abs(k.p.oy - oy) <= 3 && Math.abs(Math.log(k.p.sx / s)) <= 0.03);
        if (near >= 0) {
          if (l >= kept[near].loss) continue;
          kept[near] = { p, loss: l };
        } else if (kept.length < KEEP || l < kept[kept.length - 1].loss) {
          kept.push({ p, loss: l });
        } else {
          continue;
        }
        kept.sort((a, b) => a.loss - b.loss);
        kept = kept.slice(0, KEEP);
      }
    }
  }
  if (!kept.length) throw new Error('no placement of the image on the screenshot overlaps enough; check the scale range and the margins');

  // Each candidate goes down the pyramid.
  /** @type {{ p: Params, loss: number } | null} */
  let winner = null;
  for (const candidate of kept) {
    let p = { ...candidate.p, ox: candidate.p.ox * factor, oy: candidate.p.oy * factor };
    let l = candidate.loss;
    for (const f of factors) {
      const level = /** @type {NonNullable<ReturnType<typeof shrunk.get>>} */ (shrunk.get(f));
      const r = refine(level.samples, level.image, { ...p, ox: p.ox / f, oy: p.oy / f }, { freeAspect, minStep: f === 1 ? 0.005 : 0.1 });
      p = { ...r.p, ox: r.p.ox * f, oy: r.p.oy * f };
      l = r.loss;
    }
    if (!winner || l < winner.loss) winner = { p, loss: l };
  }
  const best = /** @type {{ p: Params, loss: number }} */ (winner);
  return { ...best.p, score: 1 - best.loss };
}

/**
 * Finds the registration of a screenshot file to an image file.
 * @param {string | Buffer} screenshot
 * @param {string | Buffer} image
 * @param {RegisterOptions} [options]
 * @returns {Promise<Registration & { screenshot: { width: number, height: number }, image: { width: number, height: number } }>}
 */
export async function register(screenshot, image, options = {}) {
  const screen = await loadScreenshot(screenshot, options);
  const raster = await loadGray(image);
  const found = registerRasters(screen, raster, options);
  return { ...found, screenshot: { width: screen.width, height: screen.height }, image: { width: raster.width, height: raster.height } };
}

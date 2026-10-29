// Tracing: finds the marks of one colour in a registered screenshot (red lines drawn over a picture, for example)
// and maps them into the coordinates of the image that the screenshot shows.
// The map comes from `register` (see register.js): a screenshot point (x, y) is the image point ((x - ox) / sx, (y - oy) / sy).
// Every mark gets its pixel count, its boxes, and a `path`: the longest path along its skeleton, simplified to a short polyline.
import sharp from 'sharp';
import { grow, loadRgba } from './raster.js';

/**
 * The map from screenshot to image. See `Registration` in register.js.
 * @typedef {{ sx: number, sy: number, ox: number, oy: number }} Fit
 */

/** @typedef {[number, number]} Point */

/**
 * A box in pixel-edge coordinates.
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */

/**
 * @typedef {object} Mark
 * @property {number} pixels The number of screenshot pixels of the mark.
 * @property {Box} screenBox
 * @property {Box} imageBox
 * @property {Point[]} path The polyline along the mark in image coordinates, one decimal. It follows the longest line through the skeleton of the mark, so a branch is left out.
 * @property {Point[]} [points] The centre of every pixel of the mark in image coordinates (with the option `points`).
 */

/**
 * @typedef {object} TraceOptions
 * @property {string} [colour] `red`, `green` or `blue`: that channel is above both others by more than `threshold`. Or a colour like `#e61b1b`: every channel is within `threshold` of it. Default `red`.
 * @property {number} [threshold] Default 60.
 * @property {number} [minPixels] Marks with fewer pixels are noise and are left out. Default 30.
 * @property {number} [reach] Mark pixels that are at most this many pixels apart belong to one mark. Default 3.
 * @property {number} [simplify] The tolerance of the polyline, in screenshot pixels. Default 2.
 * @property {boolean} [points] Also list every pixel of a mark in image coordinates.
 */

/**
 * Tells whether a text names a colour that `trace` knows: red, green, blue or a hex colour like #e61b1b.
 * @param {string} colour
 */
export const isColour = (colour) => ['red', 'green', 'blue'].includes(colour) || /^#[0-9a-f]{6}$/i.test(colour);

/**
 * Tells whether an RGBA pixel has the colour.
 * @param {string} colour
 * @param {number} threshold
 * @returns {(r: number, g: number, b: number) => boolean}
 */
function colourTest(colour, threshold) {
  switch (colour) {
    case 'red':
      return (r, g, b) => r - Math.max(g, b) > threshold;
    case 'green':
      return (r, g, b) => g - Math.max(r, b) > threshold;
    case 'blue':
      return (r, g, b) => b - Math.max(r, g) > threshold;
  }
  const m = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!m) throw new Error(`the colour must be red, green, blue or a hex colour like #e61b1b, not "${colour}"`);
  const [tr, tg, tb] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return (r, g, b) => Math.abs(r - tr) <= threshold && Math.abs(g - tg) <= threshold && Math.abs(b - tb) <= threshold;
}

/**
 * Groups the pixels of a mask into marks: pixels at most `reach` apart (in both directions) belong together.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} reach
 * @returns {number[][]} The pixel indexes of each group.
 */
export function groupPixels(mask, width, height, reach) {
  const seen = new Uint8Array(mask.length);
  /** @type {number[][]} */
  const groups = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const group = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop());
      group.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (let yy = Math.max(0, y - reach); yy <= Math.min(height - 1, y + reach); yy++) {
        for (let xx = Math.max(0, x - reach); xx <= Math.min(width - 1, x + reach); xx++) {
          const j = yy * width + xx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Thins a mask to a line one pixel wide (Zhang and Suen). The mask changes in place.
 * @param {Uint8Array} m
 * @param {number} width
 * @param {number} height
 */
export function thin(m, width, height) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      /** @type {number[]} */
      const remove = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (!m[i]) continue;
          const p = [m[i - width], m[i - width + 1], m[i + 1], m[i + width + 1], m[i + width], m[i + width - 1], m[i - 1], m[i - width - 1]];
          const neighbours = p.reduce((a, b) => a + b, 0);
          if (neighbours < 2 || neighbours > 6) continue;
          let transitions = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) transitions++;
          if (transitions !== 1) continue;
          if (pass === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue;
          remove.push(i);
        }
      }
      for (const i of remove) m[i] = 0;
      if (remove.length) changed = true;
    }
  }
}

/**
 * The longest path through a one pixel wide skeleton: from one end of its largest piece to the farthest other end.
 * @param {Uint8Array} m
 * @param {number} width
 * @param {number} height
 * @returns {Point[]} Pixel positions (x, y), in order along the line.
 */
export function longestPath(m, width, height) {
  /** @param {number} i */
  const around = (i) => {
    const x = i % width;
    const y = (i - x) / width;
    /** @type {number[]} */
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height && m[(y + dy) * width + x + dx]) out.push((y + dy) * width + x + dx);
      }
    }
    return out;
  };
  /** @param {number} from */
  const walk = (from) => {
    const prev = new Map([[from, -1]]);
    const order = [from];
    for (let h = 0; h < order.length; h++) {
      for (const n of around(order[h])) {
        if (!prev.has(n)) {
          prev.set(n, order[h]);
          order.push(n);
        }
      }
    }
    return { prev, last: order[order.length - 1], size: order.length };
  };
  // The largest piece of the skeleton.
  const seen = new Uint8Array(m.length);
  let first = -1;
  let size = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || seen[i]) continue;
    const w = walk(i);
    for (const k of w.prev.keys()) seen[k] = 1;
    if (w.size > size) {
      size = w.size;
      first = i;
    }
  }
  if (first < 0) return [];
  const a = walk(first).last;
  const b = walk(a);
  /** @type {Point[]} */
  const path = [];
  for (let i = b.last; i !== -1; i = /** @type {number} */ (b.prev.get(i))) path.push([i % width, (i - (i % width)) / width]);
  return path;
}

/**
 * Simplifies a polyline (Ramer, Douglas and Peucker).
 * @param {Point[]} points
 * @param {number} tolerance
 * @returns {Point[]}
 */
export function simplifyPath(points, tolerance) {
  if (points.length < 3) return points;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * (points[i][0] - a[0]) - dx * (points[i][1] - a[1])) / length;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= tolerance) return [a, b];
  return [...simplifyPath(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplifyPath(points.slice(at), tolerance)];
}

const tenth = (/** @type {number} */ v) => Math.round(v * 10) / 10;

/**
 * Finds the marks of one colour in a screenshot and maps them into image coordinates.
 * @param {string | Buffer} screenshot
 * @param {Fit} fit
 * @param {TraceOptions} [options]
 * @returns {Promise<{ screenshot: { width: number, height: number }, marks: Mark[] }>} The marks, the largest first.
 */
export async function trace(screenshot, fit, { colour = 'red', threshold = 60, minPixels = 30, reach = 3, simplify = 2, points = false } = {}) {
  const { width, height, data } = await loadRgba(screenshot);
  const test = colourTest(colour, threshold);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) if (data[i * 4 + 3] > 128 && test(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) mask[i] = 1;

  const toImage = (/** @type {number} */ x, /** @type {number} */ y) => /** @type {Point} */ ([(x - fit.ox) / fit.sx, (y - fit.oy) / fit.sy]);
  /** @type {Mark[]} */
  const marks = [];
  for (const group of groupPixels(mask, width, height, reach)) {
    if (group.length < minPixels) continue;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    for (const i of group) {
      const x = i % width;
      const y = (i - x) / width;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    // The skeleton, in a window around the mark, with the small gaps between its pixels closed.
    const pad = Math.ceil((reach - 1) / 2);
    const margin = pad + 2;
    const w = x1 - x0 + 1 + 2 * margin;
    const h = y1 - y0 + 1 + 2 * margin;
    const local = new Uint8Array(w * h);
    for (const i of group) {
      const x = i % width;
      local[(Math.floor(i / width) - y0 + margin) * w + x - x0 + margin] = 1;
    }
    const skeleton = grow(local, w, h, pad);
    thin(skeleton, w, h);
    const line = simplifyPath(longestPath(skeleton, w, h), simplify);

    const [ix0, iy0] = toImage(x0, y0);
    const [ix1, iy1] = toImage(x1 + 1, y1 + 1);
    /** @type {Mark} */
    const mark = {
      pixels: group.length,
      screenBox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
      imageBox: { x: tenth(ix0), y: tenth(iy0), w: tenth(ix1 - ix0), h: tenth(iy1 - iy0) },
      path: line.map(([x, y]) => {
        const [px, py] = toImage(x + x0 - margin + 0.5, y + y0 - margin + 0.5);
        return /** @type {Point} */ ([tenth(px), tenth(py)]);
      }),
    };
    if (points) {
      mark.points = group.map((i) => {
        const x = i % width;
        const [px, py] = toImage(x + 0.5, (i - x) / width + 0.5);
        return /** @type {Point} */ ([tenth(px), tenth(py)]);
      });
    }
    marks.push(mark);
  }
  marks.sort((a, b) => b.pixels - a.pixels);
  return { screenshot: { width, height }, marks };
}

/**
 * Draws the paths of the marks over the image, to check a trace by eye.
 * @param {string | Buffer} image
 * @param {Mark[]} marks
 * @returns {Promise<Buffer>} A PNG.
 */
export async function drawTrace(image, marks) {
  const { data, info } = await sharp(image).flatten({ background: '#ffffff' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const rgb = new Uint8Array(data);
  const stamp = (/** @type {number} */ x, /** @type {number} */ y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const X = Math.round(x) + dx;
        const Y = Math.round(y) + dy;
        if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
        const i = (Y * width + X) * channels;
        rgb[i] = 230;
        rgb[i + 1] = 27;
        rgb[i + 2] = 27;
      }
    }
  };
  for (const { path } of marks) {
    for (let k = 0; k < path.length; k++) {
      if (k === 0) stamp(path[0][0], path[0][1]);
      else {
        const [ax, ay] = path[k - 1];
        const [bx, by] = path[k];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
        for (let s = 1; s <= steps; s++) stamp(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
      }
    }
  }
  return sharp(rgb, { raw: { width, height, channels } }).png().toBuffer();
}

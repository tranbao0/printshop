// Masks of polygons on the pixel grid of the page, for the checks that measure a printed image.
// A mask is a Uint8Array of `width * height` (1 inside). Growing and shrinking use a chamfer distance, so they need no browser.

/** @typedef {import('./geometry.js').Poly} Poly */

/**
 * Fills polygons into a mask (union). A pixel is inside when its centre is.
 * @param {Poly[]} polys
 * @param {number} width
 * @param {number} height
 * @param {{ dx?: number, dy?: number }} [shift] Moves every polygon first.
 * @returns {Uint8Array}
 */
export function fillPolys(polys, width, height, { dx = 0, dy = 0 } = {}) {
  const mask = new Uint8Array(width * height);
  for (const poly of polys) {
    if (poly.length < 3) continue;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of poly) {
      y0 = Math.min(y0, p[1] + dy);
      y1 = Math.max(y1, p[1] + dy);
    }
    for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(height - 1, Math.floor(y1 - 0.5)); y++) {
      const cy = y + 0.5;
      /** @type {number[]} */
      const xs = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const ay = poly[j][1] + dy;
        const by = poly[i][1] + dy;
        if (ay > cy === by > cy) continue;
        const ax = poly[j][0] + dx;
        const bx = poly[i][0] + dx;
        xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil(xs[k] - 0.5));
        const to = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = from; x <= to; x++) mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * Chamfer distance from every pixel to the nearest pixel where `source` is set (0 on the set pixels).
 * @param {Uint8Array} source
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
function distanceTo(source, width, height) {
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = source[i] ? 0 : 1e9;
  const at = (/** @type {number} */ x, /** @type {number} */ y) => (x < 0 || y < 0 || x >= width || y >= height ? 1e9 : dist[y * width + x]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (dist[i]) dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }
  }
  return dist;
}

/**
 * The pixels of a mask that lie more than `d` pixels from outside it. The edge of the grid counts as inside.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} d
 * @returns {Uint8Array}
 */
export function erode(mask, width, height, d) {
  const outside = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) outside[i] = mask[i] ? 0 : 1;
  const dist = distanceTo(outside, width, height);
  return mask.map((v, i) => (v && dist[i] > d ? 1 : 0));
}

/**
 * The pixels within `d` pixels of the mask.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} d
 * @returns {Uint8Array}
 */
export function dilate(mask, width, height, d) {
  const dist = distanceTo(mask, width, height);
  return mask.map((_, i) => (dist[i] <= d ? 1 : 0));
}

/** @param {Uint8Array} a @param {Uint8Array} b @returns {Uint8Array} */
export const and = (a, b) => a.map((v, i) => (v && b[i] ? 1 : 0));
/** @param {Uint8Array} a @param {Uint8Array} b @returns {Uint8Array} */
export const minus = (a, b) => a.map((v, i) => (v && !b[i] ? 1 : 0));
/** @param {Uint8Array} a @returns {number} */
export const count = (a) => a.reduce((s, v) => s + v, 0);

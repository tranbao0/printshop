// Smooth noise fields. The value at a grid point is a hash of the key of the field and the place of the point,
// so a field does not depend on the size of the image: the same pixel gets the same value in a small image and in a larger one.
import { mix } from './seed.js';

/** @param {number} f */
const smooth = (f) => f * f * (3 - 2 * f);

/**
 * The value of the grid point (gx, gy) of a field, in 0..1.
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @param {number} gx
 * @param {number} gy
 * @returns {number}
 */
export function latticeValue(key, gx, gy) {
  return mix(mix(key ^ Math.imul(gx, 0x27d4eb2d)) + Math.imul(gy, 0x165667b1)) / 4294967296;
}

/**
 * Value noise on a grid of `cell` pixels, smoothly interpolated. Values are in 0..1.
 * @param {number} width
 * @param {number} height
 * @param {number} cell
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @returns {Float32Array}
 */
export function noiseField(width, height, cell, key) {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) grid[gy * gw + gx] = latticeValue(key, gx, gy);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = y / cell;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    for (let x = 0; x < width; x++) {
      const fx = x / cell;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const i = iy * gw + ix;
      const top = grid[i] * (1 - tx) + grid[i + 1] * tx;
      const bottom = grid[i + gw] * (1 - tx) + grid[i + gw + 1] * tx;
      out[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/**
 * The key of layer `index` of a fractal field.
 * @param {number} key
 * @param {number} index
 * @returns {number}
 */
export function layerKey(key, index) {
  return mix(key + Math.imul(index + 1, 0x9e3779b1));
}

/**
 * Sum of several noise fields. `layers` is a list of [cell, weight]. Weights should add up to 1.
 * Layer `i` has the key `layerKey(key, i)`.
 * @param {number} width
 * @param {number} height
 * @param {[number, number][]} layers
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @returns {Float32Array}
 */
export function fractalField(width, height, layers, key) {
  const out = new Float32Array(width * height);
  layers.forEach(([cell, weight], index) => {
    const field = noiseField(width, height, cell, layerKey(key, index));
    for (let i = 0; i < out.length; i++) out[i] += field[i] * weight;
  });
  return out;
}

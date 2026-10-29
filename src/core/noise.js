// Smooth noise fields. The caller passes the random stream, so each field draws from its own named stream.

/** @typedef {import('./seed.js').Rng} Rng */

/** @param {number} f */
const smooth = (f) => f * f * (3 - 2 * f);

/**
 * Value noise on a grid of `cell` pixels, smoothly interpolated. Values are in 0..1.
 * @param {number} width
 * @param {number} height
 * @param {number} cell
 * @param {Rng} rand
 * @returns {Float32Array}
 */
export function noiseField(width, height, cell, rand) {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
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
 * Sum of several noise fields. `layers` is a list of [cell, weight]. Weights should add up to 1.
 * @param {number} width
 * @param {number} height
 * @param {[number, number][]} layers
 * @param {Rng} rand
 * @returns {Float32Array}
 */
export function fractalField(width, height, layers, rand) {
  const out = new Float32Array(width * height);
  for (const [cell, weight] of layers) {
    const field = noiseField(width, height, cell, rand);
    for (let i = 0; i < out.length; i++) out[i] += field[i] * weight;
  }
  return out;
}

// Random features with a place in the image (specks, hairs, drum streaks) on a fixed grid of tiles.
// Each tile has its own stream, indexed by the place of the tile, and the grid starts at the top-left corner of the image.
// A tile draws the same features whatever the size of the image, so a taller or wider image keeps the features of the part it shares
// with a smaller one. A feature that lies outside the image but reaches into it still comes from its tile: tiles are visited up to `reach` pixels
// beyond every edge.

/** Side of a tile in pixels. */
export const TILE = 64;

// Added to a tile coordinate before it goes into the stream index, so the tiles beyond the top and left edges have an index too.
const OFFSET = 1024;

/**
 * How many items a tile gets: the whole part of `expected`, and one more with the probability of the fraction.
 * Takes one draw from `rand`, so the draws that follow do not depend on the result.
 * @param {() => number} rand
 * @param {number} expected
 * @returns {number}
 */
export function countFor(rand, expected) {
  const whole = Math.floor(expected);
  return whole + (rand() < expected - whole ? 1 : 0);
}

/**
 * @typedef {object} Tile
 * @property {() => number} rand The stream of the tile. The count has been drawn from it already.
 * @property {number} x0 Left edge of the tile in pixels (may be negative).
 * @property {number} y0 Top edge of the tile.
 * @property {number} count The number of items of the tile.
 */

/**
 * The tiles whose items can reach the image, in reading order (rows from the top, left to right in a row).
 * The order of two tiles is the same for every image size.
 * @param {import('./seed.js').Streams} streams
 * @param {string} name The name of the stream. Tile (tx, ty) uses the stream `name` with an index that holds tx and ty.
 * @param {number} width
 * @param {number} height
 * @param {number} density Items per pixel of area.
 * @param {number} reach How far an item reaches from the tile it belongs to, in pixels.
 * @returns {Generator<Tile>}
 */
export function* tiles(streams, name, width, height, density, reach) {
  // A little more than needed on every side, never less, and the same lower bound for every image size.
  const first = -Math.ceil(reach / TILE) - 1;
  const last = (/** @type {number} */ extent) => Math.ceil((extent + reach) / TILE);
  for (let ty = first; ty <= last(height); ty++) {
    for (let tx = first; tx <= last(width); tx++) {
      const rand = streams.stream(name, (ty + OFFSET) * 65536 + (tx + OFFSET));
      yield { rand, x0: tx * TILE, y0: ty * TILE, count: countFor(rand, TILE * TILE * density) };
    }
  }
}

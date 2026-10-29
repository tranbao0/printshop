/** Side of a tile in pixels. */
export declare const TILE = 64;
/**
 * How many items a tile gets: the whole part of `expected`, and one more with the probability of the fraction.
 * Takes one draw from `rand`, so the draws that follow do not depend on the result.
 * @param {() => number} rand
 * @param {number} expected
 * @returns {number}
 */
export declare function countFor(rand: () => number, expected: number): number;
export type Tile = {
    /**
     * The stream of the tile. The count has been drawn from it already.
     */
    rand: () => number;
    /**
     * Left edge of the tile in pixels (may be negative).
     */
    x0: number;
    /**
     * Top edge of the tile.
     */
    y0: number;
    /**
     * The number of items of the tile.
     */
    count: number;
};
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
export declare function tiles(streams: import('./seed.js').Streams, name: string, width: number, height: number, density: number, reach: number): Generator<Tile>;

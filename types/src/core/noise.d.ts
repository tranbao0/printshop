/**
 * The value of the grid point (gx, gy) of a field, in 0..1.
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @param {number} gx
 * @param {number} gy
 * @returns {number}
 */
export declare function latticeValue(key: number, gx: number, gy: number): number;
/**
 * Value noise on a grid of `cell` pixels, smoothly interpolated. Values are in 0..1.
 * @param {number} width
 * @param {number} height
 * @param {number} cell
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @returns {Float32Array}
 */
export declare function noiseField(width: number, height: number, cell: number, key: number): Float32Array;
/**
 * The key of layer `index` of a fractal field.
 * @param {number} key
 * @param {number} index
 * @returns {number}
 */
export declare function layerKey(key: number, index: number): number;
/**
 * Sum of several noise fields. `layers` is a list of [cell, weight]. Weights should add up to 1.
 * Layer `i` has the key `layerKey(key, i)`.
 * @param {number} width
 * @param {number} height
 * @param {[number, number][]} layers
 * @param {number} key The 32-bit key of the field (see `Streams.key`).
 * @returns {Float32Array}
 */
export declare function fractalField(width: number, height: number, layers: [number, number][], key: number): Float32Array;

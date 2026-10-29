export type Rng = () => number;
export type Streams = {
    /**
     * The image seed.
     */
    seed: number;
    /**
     *   A fresh stream, starting at its first draw. Two calls with the same name and index give the same sequence,
     *   so a part of the code asks for its stream once and keeps it.
     *   `index` gives one stream per item (the 3rd hair, the tile at 4,7), so an item draws the same numbers however many draws other items take.
     */
    stream: (name: string, index?: number) => Rng;
    /**
     *   The 32-bit key of the same stream. Position hashed noise (see noise.js) starts from a key, not from a sequence of draws.
     */
    key: (name: string, index?: number) => number;
};
/**
 * A random number source. Every call returns a number in [0, 1).
 * @typedef {() => number} Rng
 */
/**
 * A set of named streams for one image seed.
 * @typedef {object} Streams
 * @property {number} seed The image seed.
 * @property {(name: string, index?: number) => Rng} stream
 *   A fresh stream, starting at its first draw. Two calls with the same name and index give the same sequence,
 *   so a part of the code asks for its stream once and keeps it.
 *   `index` gives one stream per item (the 3rd hair, the tile at 4,7), so an item draws the same numbers however many draws other items take.
 * @property {(name: string, index?: number) => number} key
 *   The 32-bit key of the same stream. Position hashed noise (see noise.js) starts from a key, not from a sequence of draws.
 */
/**
 * Mulberry32: a small generator with a 32-bit state.
 * @param {number} seed
 * @returns {Rng}
 */
export declare function createRng(seed: number): Rng;
/**
 * FNV-1a over the UTF-16 code units of a string.
 * @param {string} text
 * @returns {number}
 */
export declare function hashName(text: string): number;
/**
 * The 32-bit finalizer of MurmurHash3. It spreads small differences over all bits.
 * @param {number} h
 * @returns {number}
 */
export declare function mix(h: number): number;
/**
 * The 32-bit state a stream starts from: FNV-1a of the name, then the seed and the index folded in through the MurmurHash3 finalizer.
 * @param {number} seed
 * @param {string} name
 * @param {number} [index]
 * @returns {number}
 */
export declare function streamState(seed: number, name: string, index?: number): number;
/**
 * @param {number} seed The image seed.
 * @returns {Streams}
 */
export declare function createStreams(seed: number): Streams;

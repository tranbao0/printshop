// Seeded random streams.
// Every random draw in an image comes from a named stream (for example `specks`, `edges`, `wobble`).
// A stream depends only on the image seed, its name and an optional index, so a change in one part of an image
// (a different speck count, a skipped item) never re-rolls the random features of another part.

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
 *   `index` gives one stream per item (the 3rd hair, the 40th speck), so an item draws the same numbers however many draws other items take.
 */

/**
 * Mulberry32: a small generator with a 32-bit state.
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a over the UTF-16 code units of a string.
 * @param {string} text
 * @returns {number}
 */
export function hashName(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The 32-bit finalizer of MurmurHash3. It spreads small differences over all bits.
 * @param {number} h
 * @returns {number}
 */
function mix(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The 32-bit state a stream starts from: FNV-1a of the name, then the seed and the index folded in through the MurmurHash3 finalizer.
 * @param {number} seed
 * @param {string} name
 * @param {number} [index]
 * @returns {number}
 */
export function streamState(seed, name, index = 0) {
  return mix(mix(hashName(name) ^ mix(seed >>> 0)) + Math.imul(index >>> 0, 0x9e3779b1));
}

/**
 * @param {number} seed The image seed.
 * @returns {Streams}
 */
export function createStreams(seed) {
  return {
    seed,
    stream: (name, index = 0) => createRng(streamState(seed, name, index)),
  };
}

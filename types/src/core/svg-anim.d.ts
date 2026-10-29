/** The length of one stop-motion step, in seconds: 5 frames at 60 fps. */
export declare const STEP: number;
/**
 * A fraction of a period as a CSS percentage.
 * @param {number} v
 */
export declare const pct: (v: number) => string;
/**
 * Seconds as a CSS time.
 * @param {number} v
 */
export declare const sec: (v: number) => string;
/**
 * Keyframes that hold `on` during each pulse ([start, end] in seconds from the start of the period) and `off` the rest of the period.
 * @param {string} name
 * @param {[number, number][]} pulses
 * @param {number} period
 * @param {string} on CSS declarations.
 * @param {string} off CSS declarations.
 * @returns {string}
 */
export declare function pulseKeyframes(name: string, pulses: [number, number][], period: number, on: string, off: string): string;
/**
 * Keyframes for a wave in which item `i` is "on" for one step and "off" for the rest of the period.
 * @param {string} name
 * @param {number} i
 * @param {number} period
 * @param {string} on CSS declarations.
 * @param {string} off CSS declarations.
 * @param {number} [step] Length of one step in seconds. Default `STEP`.
 * @returns {string}
 */
export declare function waveKeyframes(name: string, i: number, period: number, on: string, off: string, step?: number): string;
/** Switches every animation off for readers who ask for less motion. */
export declare const REDUCED_MOTION_CSS = "\n  @media (prefers-reduced-motion: reduce) {\n    * { animation: none !important; }\n  }";
export type Tile = {
    normal: Buffer;
    inverted?: Buffer;
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * A tile: a cropped PNG placed on the base, with an optional inverted twin of the same size and place.
 * @typedef {object} Tile
 * @property {Buffer} normal
 * @property {Buffer} [inverted]
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */
/**
 * One group per tile: an outer group for entrance moves, an inner one (class `hop`) for the hop, then the tile and its inverted twin (class `twin`) if it has one.
 * The two PNGs of a tile have the same size and place, so a flip never shifts the tile.
 * The groups are named l0, l1, ... from the first tile on, so the keyframes of a style can address them.
 * @param {Tile[]} letters
 * @returns {string}
 */
export declare function letterTiles(letters: Tile[]): string;
/**
 * The SVG wrapper: a black sheet, the base image, then the tiles.
 * @param {object} parts
 * @param {number} parts.width
 * @param {number} parts.height
 * @param {string} parts.label The accessible name of the image.
 * @param {string} parts.css The style rules, with the keyframes.
 * @param {Buffer} parts.base The base image as a PNG.
 * @param {string} parts.tiles The markup from `letterTiles`.
 * @returns {string}
 */
export declare function svgDocument({ width, height, label, css, base, tiles }: {
    width: number;
    height: number;
    label: string;
    css: string;
    base: Buffer;
    tiles: string;
}): string;

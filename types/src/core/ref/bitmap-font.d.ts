export declare const GLYPH_WIDTH = 5;
export declare const GLYPH_HEIGHT = 7;
/**
 * The width in pixels of a text.
 * @param {string} text
 * @param {number} scale
 */
export declare const textWidth: (text: string, scale: number) => number;
/**
 * Draws a text into an RGB buffer. A character without a glyph is drawn as a space.
 * @param {Uint8Array} rgb
 * @param {number} width The width of the buffer in pixels.
 * @param {string} text
 * @param {number} x The left edge of the text.
 * @param {number} y The top edge of the text.
 * @param {number} scale The size of one font pixel.
 * @param {[number, number, number]} colour
 */
export declare function drawText(rgb: Uint8Array, width: number, text: string, x: number, y: number, scale: number, colour: [number, number, number]): void;

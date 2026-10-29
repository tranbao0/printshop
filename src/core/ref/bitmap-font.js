// A small bitmap font (5 by 7 pixels) for the labels of a frame sheet. It draws the same pixels on every machine, because it needs no system font.

/** @type {Record<string, string[]>} */
const GLYPHS = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;

/**
 * The width in pixels of a text.
 * @param {string} text
 * @param {number} scale
 */
export const textWidth = (text, scale) => (text.length ? text.length * (GLYPH_WIDTH + 1) * scale - scale : 0);

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
export function drawText(rgb, width, text, x, y, scale, colour) {
  const height = rgb.length / 3 / width;
  for (let c = 0; c < text.length; c++) {
    const glyph = GLYPHS[text[c]] ?? GLYPHS[' '];
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (glyph[row][col] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x + (c * (GLYPH_WIDTH + 1) + col) * scale + dx;
            const py = y + row * scale + dy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const i = (py * width + px) * 3;
            rgb[i] = colour[0];
            rgb[i + 1] = colour[1];
            rgb[i + 2] = colour[2];
          }
        }
      }
    }
  }
}

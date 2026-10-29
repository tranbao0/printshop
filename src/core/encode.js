// Palette quantising and indexed PNG encoding, and the matching decoders and layer helpers.
import { crc32 } from 'node:zlib';
import sharp from 'sharp';

/**
 * Gray values with an optional alpha channel.
 * @typedef {object} GrayLayer
 * @property {Uint8Array} gray
 * @property {Uint8Array | null} [alpha]
 * @property {number} width
 * @property {number} height
 */

/**
 * Writes gray values (and an optional alpha channel) as a palette PNG.
 * Gray values must already sit on the allowed levels, so no dithering happens.
 * @param {GrayLayer & { colours?: number }} layer `colours` is the palette size, 4 by default.
 * @returns {Promise<Buffer>}
 */
export async function encodePalettePng({ gray, alpha, width, height, colours = 4 }) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < gray.length; i++) {
    const a = alpha ? alpha[i] : 255;
    const g = a === 0 ? 0 : gray[i]; // fully transparent pixels carry no color information
    rgba[i * 4] = g;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = g;
    rgba[i * 4 + 3] = a;
  }
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ palette: true, colours, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer();
  return blankTransparentEntries(png);
}

/**
 * The quantizer picks an arbitrary tint for the fully transparent palette entry.
 * Rewrites every such PLTE entry to black, so every color in the file is a pure gray.
 * @param {Buffer} png
 * @returns {Buffer}
 */
function blankTransparentEntries(png) {
  const out = Buffer.from(png);
  let plte = -1;
  let trns = -1;
  for (let p = 8; p < out.length; p += 12 + out.readUInt32BE(p)) {
    const type = out.toString('ascii', p + 4, p + 8);
    if (type === 'PLTE') plte = p;
    if (type === 'tRNS') trns = p;
  }
  if (plte < 0 || trns < 0) return out;
  const entries = out.readUInt32BE(plte) / 3;
  const alphas = out.readUInt32BE(trns);
  for (let i = 0; i < Math.min(entries, alphas); i++) {
    if (out[trns + 8 + i] === 0) out.fill(0, plte + 8 + i * 3, plte + 11 + i * 3);
  }
  out.writeUInt32BE(crc32(out.subarray(plte + 4, plte + 8 + entries * 3)), plte + 8 + entries * 3);
  return out;
}

/**
 * Reads a PNG back into gray, alpha, and the set of distinct RGBA values.
 * @param {Buffer} buffer
 * @returns {Promise<{ gray: Uint8Array, alpha: Uint8Array, width: number, height: number, colours: Set<number> }>}
 */
export async function decodeGrayPng(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const gray = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  const colours = new Set();
  for (let i = 0; i < n; i++) {
    gray[i] = data[i * 4];
    alpha[i] = data[i * 4 + 3];
    colours.add(data.readUInt32LE(i * 4));
  }
  return { gray, alpha, width: info.width, height: info.height, colours };
}

/**
 * Decodes a PNG buffer into raw RGBA for the filters.
 * @param {Buffer} png
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
export async function decodeRgba(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Composites a gray layer over an opaque gray base. A layer without alpha is opaque.
 * @param {{ gray: Uint8Array, width: number, height: number }} base
 * @param {{ gray: Uint8Array, alpha: Uint8Array | null }} layer
 * @returns {{ gray: Uint8Array, alpha: null, width: number, height: number }}
 */
export function compositeGray(base, layer) {
  const gray = new Uint8Array(base.gray.length);
  const alpha = layer.alpha;
  for (let i = 0; i < gray.length; i++) gray[i] = !alpha || alpha[i] > 127 ? layer.gray[i] : base.gray[i];
  return { gray, alpha: null, width: base.width, height: base.height };
}

/**
 * Bounding box of the opaque pixels of a layer.
 * @param {{ alpha: Uint8Array, width: number, height: number }} layer
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function inkBox({ alpha, width, height }) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Crops a gray layer with alpha to a box.
 * @param {{ gray: Uint8Array, alpha: Uint8Array, width: number }} layer
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {{ gray: Uint8Array, alpha: Uint8Array, width: number, height: number }}
 */
export function cropLayer({ gray, alpha, width }, box) {
  const out = { gray: new Uint8Array(box.width * box.height), alpha: new Uint8Array(box.width * box.height), width: box.width, height: box.height };
  for (let y = 0; y < box.height; y++) {
    const from = (box.y + y) * width + box.x;
    out.gray.set(gray.subarray(from, from + box.width), y * box.width);
    out.alpha.set(alpha.subarray(from, from + box.width), y * box.width);
  }
  return out;
}

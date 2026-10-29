// Small raster helpers for the reference tools: load an image as gray values, mark the pixels of a screenshot that carry a colour, shrink by averaging.
import sharp from 'sharp';

/**
 * @typedef {object} GrayRaster
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} gray Gray values, 0..255.
 */

/**
 * Loads an image as gray values. Transparent parts count as white.
 * @param {string | Buffer} source A file path or an encoded image.
 * @returns {Promise<GrayRaster>}
 */
export async function loadGray(source) {
  const { data, info } = await sharp(source).flatten({ background: '#ffffff' }).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  const gray = new Float32Array(info.width * info.height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * info.channels];
  return { width: info.width, height: info.height, gray };
}

/**
 * Loads an image as RGBA bytes.
 * @param {string | Buffer} source A file path or an encoded image.
 * @returns {Promise<{ width: number, height: number, data: Uint8Array }>}
 */
export async function loadRgba(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/**
 * Makes `true` also true for the pixels within `pad` pixels (a square window) of a `true` pixel.
 * @param {Uint8Array} mask 1 for a pixel to grow from.
 * @param {number} width
 * @param {number} height
 * @param {number} pad
 * @returns {Uint8Array}
 */
export function grow(mask, width, height, pad) {
  if (pad <= 0) return Uint8Array.from(mask);
  const across = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const prefix = new Int32Array(width + 1);
    for (let x = 0; x < width; x++) prefix[x + 1] = prefix[x] + mask[y * width + x];
    for (let x = 0; x < width; x++) across[y * width + x] = prefix[Math.min(width, x + pad + 1)] - prefix[Math.max(0, x - pad)] > 0 ? 1 : 0;
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    const prefix = new Int32Array(height + 1);
    for (let y = 0; y < height; y++) prefix[y + 1] = prefix[y] + across[y * width + x];
    for (let y = 0; y < height; y++) out[y * width + x] = prefix[Math.min(height, y + pad + 1)] - prefix[Math.max(0, y - pad)] > 0 ? 1 : 0;
  }
  return out;
}

/**
 * Shrinks a gray raster by a whole factor, by averaging each block. A block is valid when all of its pixels are valid.
 * @param {GrayRaster} raster
 * @param {Uint8Array | null} valid
 * @param {number} factor
 * @returns {{ width: number, height: number, gray: Float32Array, valid: Uint8Array | null }}
 */
export function shrink(raster, valid, factor) {
  if (factor === 1) return { ...raster, valid };
  const width = Math.max(1, Math.floor(raster.width / factor));
  const height = Math.max(1, Math.floor(raster.height / factor));
  const gray = new Float32Array(width * height);
  const outValid = valid ? new Uint8Array(width * height) : null;
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let ok = 1;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * raster.width + x * factor;
        for (let dx = 0; dx < factor; dx++) {
          sum += raster.gray[row + dx];
          if (valid && !valid[row + dx]) ok = 0;
        }
      }
      gray[y * width + x] = sum / area;
      if (outValid) outValid[y * width + x] = ok;
    }
  }
  return { width, height, gray, valid: outValid };
}

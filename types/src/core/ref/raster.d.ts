export type GrayRaster = {
    width: number;
    height: number;
    /**
     * Gray values, 0..255.
     */
    gray: Float32Array;
};
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
export declare function loadGray(source: string | Buffer): Promise<GrayRaster>;
/**
 * Loads an image as RGBA bytes.
 * @param {string | Buffer} source A file path or an encoded image.
 * @returns {Promise<{ width: number, height: number, data: Uint8Array }>}
 */
export declare function loadRgba(source: string | Buffer): Promise<{
    width: number;
    height: number;
    data: Uint8Array;
}>;
/**
 * Makes `true` also true for the pixels within `pad` pixels (a square window) of a `true` pixel.
 * @param {Uint8Array} mask 1 for a pixel to grow from.
 * @param {number} width
 * @param {number} height
 * @param {number} pad
 * @returns {Uint8Array}
 */
export declare function grow(mask: Uint8Array, width: number, height: number, pad: number): Uint8Array;
/**
 * Shrinks a gray raster by a whole factor, by averaging each block. A block is valid when all of its pixels are valid.
 * @param {GrayRaster} raster
 * @param {Uint8Array | null} valid
 * @param {number} factor
 * @returns {{ width: number, height: number, gray: Float32Array, valid: Uint8Array | null }}
 */
export declare function shrink(raster: GrayRaster, valid: Uint8Array | null, factor: number): {
    width: number;
    height: number;
    gray: Float32Array;
    valid: Uint8Array | null;
};

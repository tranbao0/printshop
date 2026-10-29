export type GrayLayer = {
    gray: Uint8Array;
    alpha?: Uint8Array | null;
    width: number;
    height: number;
};
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
export declare function encodePalettePng({ gray, alpha, width, height, colours }: GrayLayer & {
    colours?: number;
}): Promise<Buffer>;
/**
 * Reads a PNG back into gray, alpha, and the set of distinct RGBA values.
 * @param {Buffer} buffer
 * @returns {Promise<{ gray: Uint8Array, alpha: Uint8Array, width: number, height: number, colours: Set<number> }>}
 */
export declare function decodeGrayPng(buffer: Buffer): Promise<{
    gray: Uint8Array;
    alpha: Uint8Array;
    width: number;
    height: number;
    colours: Set<number>;
}>;
/**
 * Decodes a PNG buffer into raw RGBA for the filters.
 * @param {Buffer} png
 * @returns {Promise<{ data: Buffer, width: number, height: number }>}
 */
export declare function decodeRgba(png: Buffer): Promise<{
    data: Buffer;
    width: number;
    height: number;
}>;
/**
 * Composites a gray layer over an opaque gray base. A layer without alpha is opaque.
 * @param {{ gray: Uint8Array, width: number, height: number }} base
 * @param {{ gray: Uint8Array, alpha: Uint8Array | null }} layer
 * @returns {{ gray: Uint8Array, alpha: null, width: number, height: number }}
 */
export declare function compositeGray(base: {
    gray: Uint8Array;
    width: number;
    height: number;
}, layer: {
    gray: Uint8Array;
    alpha: Uint8Array | null;
}): {
    gray: Uint8Array;
    alpha: null;
    width: number;
    height: number;
};
/**
 * Bounding box of the opaque pixels of a layer.
 * @param {{ alpha: Uint8Array, width: number, height: number }} layer
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export declare function inkBox({ alpha, width, height }: {
    alpha: Uint8Array;
    width: number;
    height: number;
}): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Crops a gray layer with alpha to a box.
 * @param {{ gray: Uint8Array, alpha: Uint8Array, width: number }} layer
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {{ gray: Uint8Array, alpha: Uint8Array, width: number, height: number }}
 */
export declare function cropLayer({ gray, alpha, width }: {
    gray: Uint8Array;
    alpha: Uint8Array;
    width: number;
}, box: {
    x: number;
    y: number;
    width: number;
    height: number;
}): {
    gray: Uint8Array;
    alpha: Uint8Array;
    width: number;
    height: number;
};

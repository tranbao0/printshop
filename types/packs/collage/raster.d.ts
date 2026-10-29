export type Poly = import('./geometry.js').Poly;
/** @typedef {import('./geometry.js').Poly} Poly */
/**
 * Fills polygons into a mask (union). A pixel is inside when its centre is.
 * @param {Poly[]} polys
 * @param {number} width
 * @param {number} height
 * @param {{ dx?: number, dy?: number }} [shift] Moves every polygon first.
 * @returns {Uint8Array}
 */
export declare function fillPolys(polys: Poly[], width: number, height: number, { dx, dy }?: {
    dx?: number;
    dy?: number;
}): Uint8Array;
/**
 * The pixels of a mask that lie more than `d` pixels from outside it. The edge of the grid counts as inside.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} d
 * @returns {Uint8Array}
 */
export declare function erode(mask: Uint8Array, width: number, height: number, d: number): Uint8Array;
/**
 * The pixels within `d` pixels of the mask.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} d
 * @returns {Uint8Array}
 */
export declare function dilate(mask: Uint8Array, width: number, height: number, d: number): Uint8Array;
/** @param {Uint8Array} a @param {Uint8Array} b @returns {Uint8Array} */
export declare const and: (a: Uint8Array, b: Uint8Array) => Uint8Array;
/** @param {Uint8Array} a @param {Uint8Array} b @returns {Uint8Array} */
export declare const minus: (a: Uint8Array, b: Uint8Array) => Uint8Array;
/** @param {Uint8Array} a @returns {number} */
export declare const count: (a: Uint8Array) => number;

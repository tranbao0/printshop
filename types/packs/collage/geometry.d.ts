export type Pt = [number, number];
export type Poly = Pt[];
/** @typedef {[number, number]} Pt */
/** @typedef {Pt[]} Poly */
/**
 * Turns a polygon by `deg` degrees about (cx, cy).
 * @param {Poly} poly
 * @param {number} deg
 * @param {number} cx
 * @param {number} cy
 * @returns {Poly}
 */
export declare function rotatePts(poly: Poly, deg: number, cx: number, cy: number): Poly;
/**
 * The mean of the points.
 * @param {Poly} poly
 * @returns {Pt}
 */
export declare function centroid(poly: Poly): Pt;
/**
 * @param {Poly} poly
 * @param {number} dx
 * @param {number} dy
 * @returns {Poly}
 */
export declare const translate: (poly: Poly, dx: number, dy: number) => Poly;
/**
 * Shapes are authored around the origin: this moves a shape to (cx, cy) and turns it there.
 * @param {Poly} list
 * @param {number} cx
 * @param {number} cy
 * @param {number} rot Degrees.
 * @returns {Poly}
 */
export declare const put: (list: Poly, cx: number, cy: number, rot: number) => Poly;
/**
 * Moves every point a little in a random direction (at most `amount` on each axis).
 * @param {Poly} list
 * @param {() => number} rand
 * @param {number} amount
 * @returns {Poly}
 */
export declare const jig: (list: Poly, rand: () => number, amount: number) => Poly;
/**
 * Twice the signed area. The sign tells the winding direction.
 * @param {Poly} poly
 * @returns {number}
 */
export declare function signedArea2(poly: Poly): number;
/**
 * Even-odd point in polygon test.
 * @param {Poly} poly
 * @param {Pt} pt
 * @returns {boolean}
 */
export declare function inside(poly: Poly, [px, py]: Pt): boolean;
/**
 * Distance from a point to the segment a-b.
 * @param {Pt} pt
 * @param {Pt} a
 * @param {Pt} b
 * @returns {number}
 */
export declare function segDist([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number;
/**
 * The shortest distance from any point of `a` to the edges of `b`.
 * @param {Poly} a
 * @param {Poly} b
 * @returns {number}
 */
export declare function oneWay(a: Poly, b: Poly): number;
/**
 * The shortest distance between the outlines of two polygons (zero is not reported for a polygon inside another).
 * @param {Poly} a
 * @param {Poly} b
 * @returns {number}
 */
export declare const polyDist: (a: Poly, b: Poly) => number;
/**
 * Points along the edges of a polygon, at most `step` apart.
 * @param {Poly} poly
 * @param {number} [step]
 * @returns {Poly}
 */
export declare function densify(poly: Poly, step?: number): Poly;
/**
 * @param {Poly} poly
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
export declare function bounds(poly: Poly): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
/**
 * Smallest distance from the outline of `inner` (a point every 3 px) to the edge of `outer`.
 * A point that lies outside `outer` counts as negative. Several inner polygons are measured together.
 * @param {Poly[]} inner
 * @param {Poly} outer
 * @returns {number}
 */
export declare function marginInside(inner: Poly[], outer: Poly): number;
/**
 * Keeps the part of a polygon on one side of a line: the points p with (p - a) . n >= 0.
 * @param {Poly} poly
 * @param {Pt} a A point on the line.
 * @param {Pt} n The normal that points to the side that stays.
 * @returns {Poly}
 */
export declare function clipHalfPlane(poly: Poly, a: Pt, n: Pt): Poly;
/**
 * Grows a polygon outward by `d` pixels (inward for a negative `d`). Each corner moves along the bisector of its two edges.
 * It suits the convex or gently bent shapes of cut paper.
 * @param {Poly} poly
 * @param {number} d
 * @returns {Poly}
 */
export declare function offsetPoly(poly: Poly, d: number): Poly;
/**
 * A closed ellipse as a polygon.
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {number} rot Degrees.
 * @param {number} [n] Number of points.
 * @returns {Poly}
 */
export declare const ellipsePoly: (cx: number, cy: number, rx: number, ry: number, rot: number, n?: number) => Poly;

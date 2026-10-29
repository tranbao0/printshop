export type Pt = import('./geometry.js').Pt;
export type Poly = import('./geometry.js').Poly;
export type Rng = () => number;
/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Poly} Poly */
/** @typedef {() => number} Rng */
/**
 * Four-point sparkle with straight scissor cuts between the tips.
 * `a` and `b` are the tip lengths along its two axes, `w` is the share of the tip length at the waist (a small `w` makes thin tips).
 * @param {number} cx
 * @param {number} cy
 * @param {number} a
 * @param {number} b
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @param {number} [w]
 * @returns {Poly}
 */
export declare function sparklePoly(cx: number, cy: number, a: number, b: number, rot: number, rand: Rng, w?: number): Poly;
/**
 * Many-pointed star with `n` tips of radius `R`. `k` is the inner radius as a share of `R`. Tips differ in length and angle.
 * A star with five points is not allowed: it reads as a clip-art star, so the call throws.
 * @param {number} cx
 * @param {number} cy
 * @param {number} R
 * @param {number} n Number of tips, 3 or more and not 5.
 * @param {number} k
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly}
 */
export declare function burstPoly(cx: number, cy: number, R: number, n: number, k: number, rot: number, rand: Rng): Poly;
export type FlakeSpec = {
    w: number;
    bw: number;
    pairs: [number, number, number][];
    hub: 'dot' | 'hex';
    hubR: number;
};
/**
 * The shape of a snowflake: the width of an arm `w` and of a branch `bw` (shares of the radius), the side branches `pairs`
 * as [position along the arm, branch length, angle off the arm axis in degrees], and the centre `hub`.
 * @typedef {object} FlakeSpec
 * @property {number} w
 * @property {number} bw
 * @property {[number, number, number][]} pairs
 * @property {'dot' | 'hex'} hub
 * @property {number} hubR
 */
/**
 * Four snowflakes. The branches point outward in a V, away from the centre. The gaps between the branches of neighbouring arms,
 * and between the two pairs of one arm, stay open at a printed size of about 100 px.
 * @type {Record<string, FlakeSpec>}
 */
export declare const FLAKES: Record<string, FlakeSpec>;
/**
 * A flat snowflake: six straight arms from the centre, each with a pair of short side branches that point outward (V shapes),
 * and a small hexagon or dot at the centre. The result is a list of overlapping polygons (bars and a hub) that print as one shape.
 * @param {number} cx
 * @param {number} cy
 * @param {number} R Radius of the flake.
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @param {string} kind A key of `FLAKES`.
 * @returns {Poly[]}
 */
export declare function snowflakeParts(cx: number, cy: number, R: number, rot: number, rand: Rng, kind: string): Poly[];
/**
 * Crescent moon, open to the right before it is turned.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r Radius of the outer arc.
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly}
 */
export declare function crescentPoly(cx: number, cy: number, r: number, rot: number, rand: Rng): Poly;
/**
 * Eighth note: a tilted head, a stem and a curled flag, as three polygons.
 * @param {number} cx
 * @param {number} cy
 * @param {number} s Size: the stem is 1.2 times this tall.
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly[]}
 */
export declare function noteParts(cx: number, cy: number, s: number, rot: number, rand: Rng): Poly[];

export type Pt = import('./geometry.js').Pt;
export type Poly = import('./geometry.js').Poly;
export type Rng = () => number;
export type EdgeProfile = {
    parts: [number, number][];
    base: number;
    step: [number, number];
};
export type EdgeKind = 'cut' | 'torn' | 'clean';
/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Poly} Poly */
/** @typedef {() => number} Rng */
/**
 * The look of one kind of edge: `parts` are the layers of the wobble as [cell length, amplitude],
 * `base` is how far the edge sits inside the authored line, and `step` is the range of the distance between outline points.
 * @typedef {object} EdgeProfile
 * @property {[number, number][]} parts
 * @property {number} base
 * @property {[number, number]} step
 */
/** @typedef {'cut' | 'torn' | 'clean'} EdgeKind */
/**
 * `cut`: straight scissor work with a slow wobble. `torn`: a rough, short-stepped edge. `clean`: no wobble, for an edge that runs off the page.
 * @type {Record<EdgeKind, EdgeProfile>}
 */
export declare const EDGE: Record<EdgeKind, EdgeProfile>;
/**
 * Smooth noise along a line: a sum of layers of interpolated random values. Returns the offset at distance `t` along the line.
 * @param {Rng} rand
 * @param {number} length
 * @param {[number, number][]} parts [cell length, amplitude] for each layer.
 * @returns {(t: number) => number}
 */
export declare function wave(rand: Rng, length: number, parts: [number, number][]): (t: number) => number;
/**
 * The outline of a sheet of paper: every edge of the authored polygon is walked in steps and nudged inward by the edge profile.
 * `kinds` is one kind for all edges, or a list that repeats: edge i has kind `kinds[i % kinds.length]`.
 * @param {Poly} poly
 * @param {EdgeKind | EdgeKind[]} kinds
 * @param {Rng} rand
 * @returns {Poly}
 */
export declare function edgeOutline(poly: Poly, kinds: EdgeKind | EdgeKind[], rand: Rng): Poly;
/**
 * Scissor cut of a small shape: every edge is split into short runs and each cut vertex is nudged sideways a little,
 * so the edges stay straight but not ruled.
 * @param {Poly} poly
 * @param {Rng} rand
 * @param {number} [amp] The most that a vertex moves sideways, in pixels.
 * @param {number} [seg] The length of a run, in pixels.
 * @returns {Poly}
 */
export declare function scissor(poly: Poly, rand: Rng, amp?: number, seg?: number): Poly;
/**
 * A strip of see-through tape with rough zigzag ends, centred at (cx, cy) and turned by `rot` degrees.
 * @param {number} cx
 * @param {number} cy
 * @param {number} w
 * @param {number} h
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly}
 */
export declare function tapePoly(cx: number, cy: number, w: number, h: number, rot: number, rand: Rng): Poly;

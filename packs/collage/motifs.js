// Motifs: small shapes cut from paper that lie flat on a holding piece (see scene.js).
// Each builder returns the polygons of one motif, as scissor-cut outlines. Every builder takes the random source it draws from,
// so tips and waists come out a little uneven, and the same stream gives the same motif.
import { ellipsePoly, jig, put } from './geometry.js';
import { scissor } from './edges.js';

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
export function sparklePoly(cx, cy, a, b, rot, rand, w = 0.34) {
  const t = () => 0.9 + 0.2 * rand();
  const v = () => w * (0.85 + 0.3 * rand());
  return scissor(
    put([[a * t(), 0], [v() * a, v() * b], [0, b * t()], [-v() * a, v() * b], [-a * t(), 0], [-v() * a, -v() * b], [0, -b * t()], [v() * a, -v() * b]], cx, cy, rot),
    rand,
    0.8,
    13,
  );
}

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
export function burstPoly(cx, cy, R, n, k, rot, rand) {
  if (n === 5) throw new Error('a burst must not have five points');
  if (!Number.isInteger(n) || n < 3) throw new Error(`a burst needs 3 or more points (got ${n})`);
  return scissor(
    put(
      Array.from({ length: 2 * n }, (_, i) => {
        const r = i % 2 ? R * k * (0.85 + 0.3 * rand()) : R * (0.84 + 0.3 * rand());
        const a = (i * Math.PI) / n + (rand() - 0.5) * 0.16;
        return /** @type {Pt} */ ([r * Math.cos(a), r * Math.sin(a)]);
      }),
      cx,
      cy,
      rot,
    ),
    rand,
    0.7,
    14,
  );
}

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
export const FLAKES = {
  fir: { w: 0.2, bw: 0.17, pairs: [[0.5, 0.34, 55]], hub: 'dot', hubR: 0.26 },
  comb: { w: 0.2, bw: 0.17, pairs: [[0.58, 0.36, 50]], hub: 'hex', hubR: 0.26 },
  tipped: { w: 0.2, bw: 0.17, pairs: [[0.6, 0.3, 40]], hub: 'dot', hubR: 0.28 },
  plain: { w: 0.21, bw: 0.18, pairs: [[0.52, 0.34, 52]], hub: 'dot', hubR: 0.27 },
};

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
export function snowflakeParts(cx, cy, R, rot, rand, kind) {
  const spec = FLAKES[kind];
  if (!spec) throw new Error(`unknown snowflake kind "${kind}" (use ${Object.keys(FLAKES).join(', ')})`);
  const rad = (/** @type {number} */ d) => (d * Math.PI) / 180;
  // A bar in arm coordinates: from (x0, y0) along direction ang, len long and w wide, with a pointed end.
  const bar = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ ang, /** @type {number} */ len, /** @type {number} */ w) => {
    const c = Math.cos(rad(ang));
    const s = Math.sin(rad(ang));
    const nx = (-s * w) / 2;
    const ny = (c * w) / 2;
    const at = (/** @type {number} */ d, /** @type {number} */ k) => /** @type {Pt} */ ([x0 + c * d + nx * k, y0 + s * d + ny * k]);
    return [at(0, -1), at(len - 0.6 * w, -1), at(len, 0), at(len - 0.6 * w, 1), at(0, 1)];
  };
  const world = (/** @type {Poly} */ poly, /** @type {number} */ k) =>
    poly.map(([x, y]) => {
      const a = rad(rot + 60 * k);
      const c = Math.cos(a);
      const s = Math.sin(a);
      return /** @type {Pt} */ ([cx + R * (x * c - y * s), cy + R * (x * s + y * c)]);
    });
  /** @type {Poly[]} */
  const parts = [];
  for (let k = 0; k < 6; k++) {
    parts.push(world(bar(0, 0, 0, 1, spec.w), k));
    for (const [at, len, ang] of spec.pairs) for (const sg of [-1, 1]) parts.push(world(bar(at, 0, sg * ang, len, spec.bw), k));
  }
  const sides = spec.hub === 'hex' ? 6 : 12;
  parts.push(
    Array.from({ length: sides }, (_, i) => {
      const a = rad(rot + (spec.hub === 'hex' ? 30 : 0) + (i * 360) / sides);
      return /** @type {Pt} */ ([cx + R * spec.hubR * Math.cos(a), cy + R * spec.hubR * Math.sin(a)]);
    }),
  );
  return parts.map((poly) => scissor(poly, rand, 0.35, 16));
}

/**
 * Crescent moon, open to the right before it is turned.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r Radius of the outer arc.
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly}
 */
export function crescentPoly(cx, cy, r, rot, rand) {
  /** @type {Poly} */
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = ((60 + (k / 12) * 240) * Math.PI) / 180;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const ci = 0.45 * r;
  const ri = r * 0.867;
  for (let k = 0; k <= 12; k++) {
    const a = ((273.3 - (k / 12) * 186.6) * Math.PI) / 180;
    pts.push([ci + ri * Math.cos(a), ri * Math.sin(a)]);
  }
  return scissor(put(pts, cx, cy, rot), rand, 0.6, 14);
}

/**
 * Eighth note: a tilted head, a stem and a curled flag, as three polygons.
 * @param {number} cx
 * @param {number} cy
 * @param {number} s Size: the stem is 1.2 times this tall.
 * @param {number} rot Degrees.
 * @param {Rng} rand
 * @returns {Poly[]}
 */
export function noteParts(cx, cy, s, rot, rand) {
  const head = ellipsePoly(cx, cy, 0.36 * s, 0.26 * s, -22 + rot, 16);
  const stem = put([[0.27 * s, 0], [0.38 * s, 0], [0.38 * s, -1.2 * s], [0.27 * s, -1.2 * s]], cx, cy, rot);
  const flag = put(
    [[0.38 * s, -1.2 * s], [0.64 * s, -1.02 * s], [0.76 * s, -0.64 * s], [0.62 * s, -0.4 * s], [0.6 * s, -0.66 * s], [0.46 * s, -0.86 * s], [0.38 * s, -0.84 * s]],
    cx,
    cy,
    rot,
  );
  return [head, stem, flag].map((q) => jig(q, rand, 0.4));
}

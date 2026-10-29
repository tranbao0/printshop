// Paper edges: scissor cuts, torn edges and tape. Every edge is walked in short steps and nudged by smooth noise.
// Every function takes the random source it draws from, so the caller decides the stream (see scene.js).
import { rotatePts, signedArea2 } from './geometry.js';

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
export const EDGE = {
  cut: { parts: [[260, 1.6], [50, 0.5]], base: 2.1, step: [60, 90] },
  torn: { parts: [[90, 5], [26, 3.5], [7, 2.2]], base: 10.7, step: [5, 11] },
  clean: { parts: [], base: 0, step: [200, 400] },
};

const smooth = (/** @type {number} */ v) => v * v * (3 - 2 * v);

/**
 * Smooth noise along a line: a sum of layers of interpolated random values. Returns the offset at distance `t` along the line.
 * @param {Rng} rand
 * @param {number} length
 * @param {[number, number][]} parts [cell length, amplitude] for each layer.
 * @returns {(t: number) => number}
 */
export function wave(rand, length, parts) {
  const tables = parts.map(([cell, amp]) => ({ cell, amp, values: Array.from({ length: Math.ceil(length / cell) + 3 }, rand) }));
  return (t) =>
    tables.reduce((sum, { cell, amp, values }) => {
      const x = t / cell;
      const i = Math.floor(x);
      const u = smooth(x - i);
      return sum + amp * 2 * (values[i] * (1 - u) + values[i + 1] * u - 0.5);
    }, 0);
}

/**
 * The outline of a sheet of paper: every edge of the authored polygon is walked in steps and nudged inward by the edge profile.
 * `kinds` is one kind for all edges, or a list that repeats: edge i has kind `kinds[i % kinds.length]`.
 * @param {Poly} poly
 * @param {EdgeKind | EdgeKind[]} kinds
 * @param {Rng} rand
 * @returns {Poly}
 */
export function edgeOutline(poly, kinds, rand) {
  const sgn = signedArea2(poly) > 0 ? 1 : -1;
  /** @type {Poly} */
  const outer = [];
  poly.forEach(([x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    const kind = Array.isArray(kinds) ? kinds[i % kinds.length] : kinds;
    const spec = EDGE[kind];
    const len = Math.hypot(x2 - x, y2 - y);
    if (!len) return;
    const dx = (x2 - x) / len;
    const dy = (y2 - y) / len;
    const nx = -dy * sgn;
    const ny = dx * sgn;
    const edge = wave(rand, len, spec.parts);
    let t = 0;
    while (t < len) {
      const off = Math.max(0, spec.base + edge(t));
      outer.push([x + dx * t + nx * off, y + dy * t + ny * off]);
      t += spec.step[0] + rand() * (spec.step[1] - spec.step[0]);
    }
  });
  return outer;
}

/**
 * Scissor cut of a small shape: every edge is split into short runs and each cut vertex is nudged sideways a little,
 * so the edges stay straight but not ruled.
 * @param {Poly} poly
 * @param {Rng} rand
 * @param {number} [amp] The most that a vertex moves sideways, in pixels.
 * @param {number} [seg] The length of a run, in pixels.
 * @returns {Poly}
 */
export function scissor(poly, rand, amp = 0.9, seg = 11) {
  /** @type {Poly} */
  const out = [];
  poly.forEach(([x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x2 - x, y2 - y) || 1;
    const nx = -(y2 - y) / len;
    const ny = (x2 - x) / len;
    const n = Math.max(1, Math.round(len / seg));
    for (let k = 0; k < n; k++) {
      const o = (rand() - 0.5) * 2 * amp * (k === 0 ? 0.8 : 1);
      out.push([x + ((x2 - x) * k) / n + nx * o, y + ((y2 - y) * k) / n + ny * o]);
    }
  });
  return out;
}

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
export function tapePoly(cx, cy, w, h, rot, rand) {
  const topWave = wave(rand, w, [[150, 1.6]]);
  const bottomWave = wave(rand, w, [[150, 1.6]]);
  /** @param {number} x0 @param {number} dir */
  const end = (x0, dir) => {
    /** @type {Poly} */
    const list = [];
    for (let y = 0; y <= h; y += 6 + rand() * 6) list.push([x0 + dir * (3 + rand() * 12), Math.min(y, h)]);
    return list;
  };
  const left = end(0, 1).reverse();
  const right = end(w, -1);
  /** @type {Poly} */
  const top = [];
  /** @type {Poly} */
  const bottom = [];
  for (let x = 0; x <= w; x += 40) top.push([x, 1.5 + topWave(x)]);
  for (let x = w; x >= 0; x -= 40) bottom.push([x, h - 1.5 + bottomWave(x)]);
  return rotatePts([...top, ...right, ...bottom, ...left].map(([x, y]) => /** @type {Pt} */ ([cx - w / 2 + x, cy - h / 2 + y])), rot, cx, cy);
}

// Plain geometry for paper pieces: polygons are lists of [x, y] points in page pixels.

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
export function rotatePts(poly, deg, cx, cy) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return poly.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

/**
 * The mean of the points.
 * @param {Poly} poly
 * @returns {Pt}
 */
export function centroid(poly) {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

/**
 * @param {Poly} poly
 * @param {number} dx
 * @param {number} dy
 * @returns {Poly}
 */
export const translate = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy]);

/**
 * Shapes are authored around the origin: this moves a shape to (cx, cy) and turns it there.
 * @param {Poly} list
 * @param {number} cx
 * @param {number} cy
 * @param {number} rot Degrees.
 * @returns {Poly}
 */
export const put = (list, cx, cy, rot) => rotatePts(list.map(([x, y]) => [cx + x, cy + y]), rot, cx, cy);

/**
 * Moves every point a little in a random direction (at most `amount` on each axis).
 * @param {Poly} list
 * @param {() => number} rand
 * @param {number} amount
 * @returns {Poly}
 */
export const jig = (list, rand, amount) => list.map(([x, y]) => [x + (rand() - 0.5) * 2 * amount, y + (rand() - 0.5) * 2 * amount]);

/**
 * Twice the signed area. The sign tells the winding direction.
 * @param {Poly} poly
 * @returns {number}
 */
export function signedArea2(poly) {
  let area = 0;
  poly.forEach(([x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    area += x * y2 - x2 * y;
  });
  return area;
}

/**
 * Even-odd point in polygon test.
 * @param {Poly} poly
 * @param {Pt} pt
 * @returns {boolean}
 */
export function inside(poly, [px, py]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Distance from a point to the segment a-b.
 * @param {Pt} pt
 * @param {Pt} a
 * @param {Pt} b
 * @returns {number}
 */
export function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/**
 * The shortest distance from any point of `a` to the edges of `b`.
 * @param {Poly} a
 * @param {Poly} b
 * @returns {number}
 */
export function oneWay(a, b) {
  let m = Infinity;
  for (const p of a) for (let i = 0; i < b.length; i++) m = Math.min(m, segDist(p, b[i], b[(i + 1) % b.length]));
  return m;
}

/**
 * The shortest distance between the outlines of two polygons (zero is not reported for a polygon inside another).
 * @param {Poly} a
 * @param {Poly} b
 * @returns {number}
 */
export const polyDist = (a, b) => Math.min(oneWay(a, b), oneWay(b, a));

/**
 * Points along the edges of a polygon, at most `step` apart.
 * @param {Poly} poly
 * @param {number} [step]
 * @returns {Poly}
 */
export function densify(poly, step = 3) {
  /** @type {Poly} */
  const out = [];
  poly.forEach(([x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x, y2 - y) / step));
    for (let s = 0; s < n; s++) out.push([x + ((x2 - x) * s) / n, y + ((y2 - y) * s) / n]);
  });
  return out;
}

/**
 * @param {Poly} poly
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
export function bounds(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Smallest distance from the outline of `inner` (a point every 3 px) to the edge of `outer`.
 * A point that lies outside `outer` counts as negative. Several inner polygons are measured together.
 * @param {Poly[]} inner
 * @param {Poly} outer
 * @returns {number}
 */
export function marginInside(inner, outer) {
  let m = Infinity;
  for (const poly of inner) {
    for (const pt of densify(poly, 3)) {
      let d = Infinity;
      for (let j = 0; j < outer.length; j++) d = Math.min(d, segDist(pt, outer[j], outer[(j + 1) % outer.length]));
      m = Math.min(m, inside(outer, pt) ? d : -d);
    }
  }
  return m;
}

/**
 * Keeps the part of a polygon on one side of a line: the points p with (p - a) . n >= 0.
 * @param {Poly} poly
 * @param {Pt} a A point on the line.
 * @param {Pt} n The normal that points to the side that stays.
 * @returns {Poly}
 */
export function clipHalfPlane(poly, a, n) {
  const side = (/** @type {Pt} */ [x, y]) => (x - a[0]) * n[0] + (y - a[1]) * n[1];
  /** @type {Poly} */
  const kept = [];
  poly.forEach((pt, i) => {
    const q = poly[(i + 1) % poly.length];
    const sp = side(pt);
    const sq = side(q);
    if (sp >= 0) kept.push(pt);
    if (sp >= 0 !== sq >= 0) kept.push([pt[0] + (q[0] - pt[0]) * (sp / (sp - sq)), pt[1] + (q[1] - pt[1]) * (sp / (sp - sq))]);
  });
  return kept;
}

/**
 * Grows a polygon outward by `d` pixels (inward for a negative `d`). Each corner moves along the bisector of its two edges.
 * It suits the convex or gently bent shapes of cut paper.
 * @param {Poly} poly
 * @param {number} d
 * @returns {Poly}
 */
export function offsetPoly(poly, d) {
  const sgn = signedArea2(poly) > 0 ? 1 : -1;
  const n = poly.length;
  const normal = (/** @type {Pt} */ a, /** @type {Pt} */ b) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [((b[1] - a[1]) / l) * sgn, (-(b[0] - a[0]) / l) * sgn];
  };
  return poly.map((q, i) => {
    const [ax, ay] = normal(poly[(i + n - 1) % n], q);
    const [bx, by] = normal(q, poly[(i + 1) % n]);
    let mx = ax + bx;
    let my = ay + by;
    const l = Math.hypot(mx, my) || 1;
    mx /= l;
    my /= l;
    const k = d / Math.max(0.5, mx * ax + my * ay);
    return /** @type {Pt} */ ([q[0] + mx * k, q[1] + my * k]);
  });
}

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
export const ellipsePoly = (cx, cy, rx, ry, rot, n = 18) =>
  put(Array.from({ length: n }, (_, i) => /** @type {Pt} */ ([rx * Math.cos((i / n) * Math.PI * 2), ry * Math.sin((i / n) * Math.PI * 2)])), cx, cy, rot);

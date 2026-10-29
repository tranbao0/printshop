// A paper collage as a paste stack: pieces of paper in the order they are pasted, bottom first.
// Each piece has an outline, a paper colour, a drop shadow (or none, for a piece that lies flat) and perhaps marks printed on it.
// The scene builds the geometry in plain code and writes it as one SVG string, so the checks (checks.js) need no browser.
//
// Pieces:
//   base   a safety sheet under everything. No pixel of the page may show it (the checks look for that).
//   sheet  a large sheet of paper with torn or cut edges.
//   mat    paper a little larger than a tile, pasted just under it.
//   tile   a scissor-cut piece that carries marks.
//   motif  a shape cut from paper (snowflake, sparkle, burst, crescent, note) that lies flat: it casts no shadow.
//   holder the piece that holds a motif and casts the shadow. Only the holder has a shadow; the motif lies flat on it.
//   tape   a see-through strip.
//
// Every random draw comes from a named stream of the scene seed (`edges.<piece>`, `motif.<piece>`, `holder.<piece>`, `tape.<piece>`),
// so adding or removing a piece never changes the outline of another one.
import { createStreams } from '../../src/core/seed.js';
import { bounds, centroid, clipHalfPlane, inside, marginInside, offsetPoly, put, rotatePts, translate } from './geometry.js';
import { edgeOutline, scissor, tapePoly } from './edges.js';
import { burstPoly, crescentPoly, noteParts, snowflakeParts, sparklePoly } from './motifs.js';

/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Poly} Poly */
/** @typedef {import('./edges.js').EdgeKind} EdgeKind */
/** @typedef {'ruled' | 'grid' | 'dots' | 'stripes'} PatternKind */

/**
 * @typedef {object} Offset
 * @property {number} x
 * @property {number} y
 */

/** @typedef {{ fill: string, x: number, y: number }} ShadowStyle */

/**
 * One piece of paper: an outline, a colour and perhaps a pattern.
 * @typedef {object} Part
 * @property {Poly} outline
 * @property {string} fill
 * @property {PatternKind} [pattern]
 * @property {number} [patternTurn] Degrees that the pattern is turned by.
 * @property {boolean} castsShadow
 */

/**
 * Ink printed on a piece. It turns with the piece.
 * @typedef {object} Mark
 * @property {Poly} poly
 * @property {string} [fill] Default black.
 */

/** @typedef {'base' | 'sheet' | 'mat' | 'tile' | 'motif' | 'holder' | 'tape'} Role */

/**
 * @typedef {object} Item
 * @property {string} name
 * @property {Role} role
 * @property {Part[]} parts A tile or sheet has one part, a motif has one part for each piece of its shape.
 * @property {Offset | null} shadow Where the drop shadow falls, or null for a piece that lies flat.
 * @property {Mark[]} marks In page coordinates, already turned.
 * @property {string} [of] On a holder: the name of the motif it holds.
 * @property {string} [holds] On a motif: the name of its holder.
 */

/**
 * The scene before it is built.
 * @typedef {object} SceneOptions
 * @property {number} width Page width in pixels.
 * @property {number} height Page height in pixels.
 * @property {number} seed
 * @property {Partial<ShadowStyle>} [shadow] The default drop shadow.
 * @property {{ cx: number, cy: number, r: number }} [region] A round window. Checks look only inside it (a picture that is shown round).
 */

export const SHADOW = /** @type {ShadowStyle} */ ({ fill: '#555555', x: 7, y: 8 });

/** A motif lies at least this far inside the cut edge of its holder, so the holder grows until it does. */
export const MOTIF_FIT = 10;

const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The brightness of a paper colour, 0 (black) to 255 (white).
 * @param {string} fill A colour like #8f8f8f.
 * @returns {number}
 */
export function lumaOf(fill) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * @typedef {{ type: 'sparkle', cx: number, cy: number, a: number, b: number, rot: number, w?: number }
 *   | { type: 'burst', cx: number, cy: number, R: number, n: number, k: number, rot: number }
 *   | { type: 'snowflake', cx: number, cy: number, R: number, rot: number, kind: string }
 *   | { type: 'crescent', cx: number, cy: number, r: number, rot: number }
 *   | { type: 'note', cx: number, cy: number, s: number, rot: number }
 *   | { type: 'polygons', parts: Poly[] }} MotifShape
 */

/**
 * The holding piece of a motif. `w` and `h` are minimums: the piece grows until the whole outline of the motif lies at least `fit` px inside its cut edge.
 * @typedef {object} HolderSpec
 * @property {string} fill
 * @property {number} w
 * @property {number} h
 * @property {number} [rot]
 * @property {number} [dx] Moves the holder against the centre of the motif.
 * @property {number} [dy]
 * @property {PatternKind} [pattern]
 * @property {number} [fit] Default `MOTIF_FIT`.
 * @property {boolean} [grow] Default true. With false the holder keeps the size asked for, whatever the motif needs.
 * @property {Offset} [shadow]
 */

/**
 * @typedef {object} Spec
 * @property {Role | 'motif+holder'} role
 * @property {string} name
 * @property {(ctx: BuildContext) => void} build
 */

/**
 * @typedef {object} BuildContext
 * @property {Item[]} items The items built so far (bottom first). The builder pushes its own items.
 * @property {ReturnType<typeof createStreams>} streams
 * @property {ShadowStyle} shadow
 */

/**
 * @param {string} name
 */
function checkName(name) {
  if (!NAME.test(name)) throw new Error(`piece name "${name}": use letters, digits, - and _`);
}

/**
 * @param {string} fill
 */
function checkFill(fill) {
  if (!HEX.test(fill)) throw new Error(`paper colour "${fill}": use a #rrggbb colour`);
}

/**
 * Creates an empty scene. Add pieces bottom first, then call `build()`.
 * @param {SceneOptions} options
 */
export function createScene({ width, height, seed, shadow: shadowOptions, region }) {
  const shadowStyle = { ...SHADOW, ...shadowOptions };
  /** @type {Spec[]} */
  const specs = [];
  const names = new Set();
  /** The authored polygon, turn and origin of each tile, for the mats that go under them. @type {Map<string, { poly: Poly, rot: number, origin: Pt }>} */
  const tileGeometry = new Map();
  /** @param {string} name @param {string[]} [extra] */
  const claim = (name, extra = []) => {
    for (const n of [name, ...extra]) {
      checkName(n);
      if (names.has(n)) throw new Error(`two pieces are called "${n}"`);
      names.add(n);
    }
  };
  /** @param {Offset | false | undefined} s @returns {Offset | null} */
  const shadowFor = (s) => (s === false ? null : s ?? { x: shadowStyle.x, y: shadowStyle.y });

  const api = {
    width,
    height,
    seed,

    /**
     * A safety sheet under everything. No pixel of the page may show it.
     * @param {string} fill
     */
    base(fill) {
      claim('base');
      checkFill(fill);
      specs.push({
        role: 'base',
        name: 'base',
        build: ({ items }) => {
          const m = 60;
          items.push({ name: 'base', role: 'base', parts: [{ outline: [[-m, -m], [width + m, -m], [width + m, height + m], [-m, height + m]], fill, castsShadow: false }], shadow: null, marks: [] });
        },
      });
      return api;
    },

    /**
     * A sheet of paper with torn or cut edges. `poly` is authored in page coordinates.
     * @param {string} name
     * @param {Poly} poly
     * @param {{ fill: string, kinds?: EdgeKind | EdgeKind[], rot?: number, pattern?: PatternKind, patternTurn?: number, shadow?: Offset | false }} o
     */
    sheet(name, poly, { fill, kinds = 'torn', rot = 0, pattern, patternTurn = 0, shadow }) {
      claim(name);
      checkFill(fill);
      specs.push({
        role: 'sheet',
        name,
        build: ({ items, streams }) => {
          const [cx, cy] = centroid(poly);
          const turned = rot ? rotatePts(poly, rot, cx, cy) : poly;
          const outline = edgeOutline(turned, kinds, streams.stream(`edges.${name}`));
          items.push({ name, role: 'sheet', parts: [{ outline, fill, pattern, patternTurn: rot + patternTurn, castsShadow: true }], shadow: shadowFor(shadow), marks: [] });
        },
      });
      return api;
    },

    /**
     * A scissor-cut tile that carries marks. The tile and its marks turn together by `rot` about `origin`.
     * @param {string} name
     * @param {Poly} poly
     * @param {{ fill: string, rot?: number, origin?: Pt, kinds?: EdgeKind | EdgeKind[], trim?: { a: Pt, n: Pt }[], marks?: Mark[], pattern?: PatternKind, shadow?: Offset | false, flat?: boolean }} o
     *   `trim`: straight cuts in page coordinates after the turn, each `{ a, n }`: a point on the cut line and the normal of the side that stays.
     *   `flat`: the tile lies flat and casts no shadow.
     */
    tile(name, poly, { fill, rot = 0, origin, kinds = 'cut', trim = [], marks = [], pattern, shadow, flat = false }) {
      claim(name);
      checkFill(fill);
      tileGeometry.set(name, { poly, rot, origin: origin ?? centroid(poly) });
      specs.push({
        role: 'tile',
        name,
        build: ({ items, streams }) => {
          const [cx, cy] = origin ?? centroid(poly);
          let turned = rotatePts(poly, rot, cx, cy);
          for (const { a, n } of trim) turned = clipHalfPlane(turned, a, n);
          const outline = edgeOutline(turned, kinds, streams.stream(`edges.${name}`));
          items.push({
            name,
            role: 'tile',
            parts: [{ outline, fill, pattern, patternTurn: rot, castsShadow: !flat }],
            shadow: flat ? null : shadowFor(shadow),
            marks: marks.map((m) => ({ fill: m.fill, poly: rotatePts(m.poly, rot, cx, cy) })),
          });
        },
      });
      return api;
    },

    /**
     * Paper a little larger than a tile, pasted just under it, turned and shifted against it, so the tile keeps an edge on paper of its own tone.
     * `pad` is the width of the border. `turn` turns the mat about the centre of the tile, `dx` and `dy` move it, `clip` cuts off one corner
     * (the index of the tile corner), and each line in `keep` is a pair of points in tile coordinates: the mat keeps only the side of the line that holds the tile's centre.
     * @param {string} target The name of the tile the mat goes under. The tile must be added before the scene is built.
     * @param {number} pad
     * @param {string} fill
     * @param {{ name?: string, turn?: number, dx?: number, dy?: number, clip?: number, keep?: [Pt, Pt][], pattern?: PatternKind, shadow?: Offset | false }} [o]
     */
    mat(target, pad, fill, { name = `mat-${target}`, turn = 0, dx = 0, dy = 0, clip, keep = [], pattern, shadow } = {}) {
      claim(name);
      checkFill(fill);
      specs.push({
        role: 'mat',
        name,
        build: ({ items, streams }) => {
          const at = items.findIndex((it) => it.name === target);
          if (at < 0) throw new Error(`mat "${name}": the tile "${target}" is not in the scene`);
          const tile = tileGeometry.get(target);
          if (!tile) throw new Error(`mat "${name}": "${target}" is not a tile`);
          const [cx, cy] = tile.origin;
          const turned = rotatePts(tile.poly, tile.rot, cx, cy);
          let poly = translate(rotatePts(offsetPoly(turned, pad), turn, cx, cy), dx, dy);
          if (clip !== undefined) {
            const n = poly.length;
            const i = clip % n;
            const k = 0.3;
            const a = poly[(i + n - 1) % n];
            const q = poly[i];
            const c = poly[(i + 1) % n];
            poly = [...poly.slice(0, i), [q[0] + (a[0] - q[0]) * k, q[1] + (a[1] - q[1]) * k], [q[0] + (c[0] - q[0]) * k, q[1] + (c[1] - q[1]) * k], ...poly.slice(i + 1)];
          }
          const centre = centroid(turned);
          for (const [pa, pb] of keep) {
            const [a, b] = rotatePts([pa, pb], tile.rot, cx, cy);
            // The normal of the line, turned to point at the centre of the tile.
            const n = /** @type {Pt} */ ([-(b[1] - a[1]), b[0] - a[0]]);
            const sign = Math.sign((centre[0] - a[0]) * n[0] + (centre[1] - a[1]) * n[1]) || 1;
            poly = clipHalfPlane(poly, a, [n[0] * sign, n[1] * sign]);
            if (!poly.length) throw new Error(`mat "${name}": a keep line removes the whole mat`);
          }
          const outline = edgeOutline(poly, 'cut', streams.stream(`edges.${name}`));
          // The mat goes just under the tile.
          items.splice(at, 0, { name, role: 'mat', parts: [{ outline, fill, pattern, castsShadow: true }], shadow: shadowFor(shadow), marks: [] });
        },
      });
      return api;
    },

    /**
     * A motif cut from paper. It lies flat on its holder (`back`), which casts the drop shadow; the motif casts none.
     * The holder is added just under the motif and is called `<name>-holder`.
     * @param {string} name
     * @param {MotifShape} shape
     * @param {{ fill: string, back: HolderSpec }} o
     */
    motif(name, shape, { fill, back }) {
      claim(name, [`${name}-holder`]);
      checkFill(fill);
      checkFill(back.fill);
      specs.push({
        role: 'motif+holder',
        name,
        build: ({ items, streams }) => {
          const rand = streams.stream(`motif.${name}`);
          const polys = motifPolys(shape, rand);
          const xs = polys.flat().map((p) => p[0]);
          const ys = polys.flat().map((p) => p[1]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          const fit = back.fit ?? MOTIF_FIT;
          const cut = (/** @type {number} */ grow) => {
            // A fresh stream on every try, so the holder stays the same shape while it grows.
            const r = streams.stream(`holder.${name}`);
            const w = back.w / 2 + grow;
            const h = back.h / 2 + grow;
            const corners = /** @type {Poly} */ ([[-w, -h], [w, -h * 0.9], [w * 0.95, h], [-w * 0.9, h * 0.95]].map(([x, y]) => [x + (r() - 0.5) * 8, y + (r() - 0.5) * 8]));
            return scissor(put(corners, cx + (back.dx ?? 0), cy + (back.dy ?? 0), back.rot ?? 0), r, 1, 30);
          };
          let grow = 0;
          let outline = cut(0);
          while (back.grow !== false && marginInside(polys, outline) < fit && grow < 80) outline = cut((grow += 2));
          items.push({
            name: `${name}-holder`,
            role: 'holder',
            parts: [{ outline, fill: back.fill, pattern: back.pattern, patternTurn: back.rot ?? 0, castsShadow: true }],
            shadow: shadowFor(back.shadow),
            marks: [],
            of: name,
          });
          items.push({
            name,
            role: 'motif',
            parts: polys.map((outline) => ({ outline, fill, castsShadow: false })),
            shadow: null,
            marks: [],
            holds: `${name}-holder`,
          });
        },
      });
      return api;
    },

    /**
     * A strip of see-through tape. It is pasted at this place in the stack: pieces added later cover it.
     * @param {string} name
     * @param {number} cx
     * @param {number} cy
     * @param {number} w
     * @param {number} h
     * @param {number} rot
     */
    tape(name, cx, cy, w, h, rot) {
      claim(name);
      specs.push({
        role: 'tape',
        name,
        build: ({ items, streams }) => {
          items.push({ name, role: 'tape', parts: [{ outline: tapePoly(cx, cy, w, h, rot, streams.stream(`tape.${name}`)), fill: '#5a5a5a', castsShadow: false }], shadow: null, marks: [] });
        },
      });
      return api;
    },

    /**
     * Builds the geometry of every piece.
     * @returns {Built}
     */
    build() {
      const streams = createStreams(seed);
      /** @type {Item[]} */
      const items = [];
      for (const spec of specs) spec.build({ items, streams, shadow: shadowStyle });
      return makeBuilt({ width, height, seed, items, region, shadow: shadowStyle });
    },
  };
  return api;
}

/**
 * The polygons of a motif shape.
 * @param {MotifShape} shape
 * @param {() => number} rand
 * @returns {Poly[]}
 */
function motifPolys(shape, rand) {
  switch (shape.type) {
    case 'sparkle':
      return [sparklePoly(shape.cx, shape.cy, shape.a, shape.b, shape.rot, rand, shape.w)];
    case 'burst':
      return [burstPoly(shape.cx, shape.cy, shape.R, shape.n, shape.k, shape.rot, rand)];
    case 'snowflake':
      return snowflakeParts(shape.cx, shape.cy, shape.R, shape.rot, rand, shape.kind);
    case 'crescent':
      return [crescentPoly(shape.cx, shape.cy, shape.r, shape.rot, rand)];
    case 'note':
      return noteParts(shape.cx, shape.cy, shape.s, shape.rot, rand);
    case 'polygons':
      return shape.parts;
    default:
      throw new Error(`unknown motif shape ${JSON.stringify(/** @type {{ type?: string }} */ (shape).type)}`);
  }
}

/**
 * A built scene: final outlines in paste order, with the questions that the checks ask of the stack.
 * @typedef {object} Built
 * @property {number} width
 * @property {number} height
 * @property {number} seed
 * @property {Item[]} items Bottom first.
 * @property {ShadowStyle} shadow
 * @property {{ cx: number, cy: number, r: number } | null} region
 * @property {(name: string) => Item} get
 * @property {(pt: Pt, below?: number) => { item: Item, part: Part, index: number } | null} topAt
 *   The topmost paper at a point, looking only at items below index `below` (default: all). Tape is not paper.
 * @property {(pt: Pt, above: number, options?: { shadows?: boolean, tape?: boolean }) => boolean} coveredAbove
 *   True when an item pasted after index `above` covers the point, or its shadow does (`shadows: false` ignores shadows, `tape: false` ignores tape).
 * @property {(pt: Pt) => boolean} inRegion
 * @property {(options?: { marks?: boolean }) => string} svg
 */

/**
 * @param {{ width: number, height: number, seed: number, items: Item[], region?: { cx: number, cy: number, r: number }, shadow: ShadowStyle }} o
 * @returns {Built}
 */
export function makeBuilt({ width, height, seed, items, region, shadow }) {
  const reg = region ?? null;
  /** @type {WeakMap<Part, { x0: number, y0: number, x1: number, y1: number }>} */
  const boxes = new WeakMap();
  const boxOf = (/** @type {Part} */ part) => {
    let b = boxes.get(part);
    if (!b) boxes.set(part, (b = bounds(part.outline)));
    return b;
  };
  /** @param {Part} part @param {Pt} pt @param {Offset} [by] The outline is moved by this first. */
  const hit = (part, [x, y], by) => {
    const b = boxOf(part);
    const dx = by?.x ?? 0;
    const dy = by?.y ?? 0;
    if (x < b.x0 + dx || x > b.x1 + dx || y < b.y0 + dy || y > b.y1 + dy) return false;
    return inside(part.outline, [x - dx, y - dy]);
  };
  const built = /** @type {Built} */ ({
    width,
    height,
    seed,
    items,
    shadow,
    region: reg,
    get(name) {
      const item = items.find((it) => it.name === name);
      if (!item) throw new Error(`no piece called "${name}"`);
      return item;
    },
    topAt(pt, below = items.length) {
      for (let i = Math.min(below, items.length) - 1; i >= 0; i--) {
        const item = items[i];
        if (item.role === 'tape') continue;
        for (let j = item.parts.length - 1; j >= 0; j--) if (hit(item.parts[j], pt)) return { item, part: item.parts[j], index: i };
      }
      return null;
    },
    coveredAbove(pt, above, { shadows = true, tape = true } = {}) {
      for (let i = above + 1; i < items.length; i++) {
        const item = items[i];
        if (item.role === 'tape' && !tape) continue;
        for (const part of item.parts) {
          if (hit(part, pt)) return true;
          if (shadows && part.castsShadow && item.shadow && hit(part, pt, item.shadow)) return true;
        }
      }
      return false;
    },
    inRegion: (pt) => !reg || Math.hypot(pt[0] - reg.cx, pt[1] - reg.cy) <= reg.r - 2,
    svg: (options) => svgOf(built, options),
  });
  return built;
}

const f = (/** @type {number} */ n) => n.toFixed(1);
const pts = (/** @type {Poly} */ list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

/**
 * Patterned paper, quiet enough for the marks above it: fine ruled lines, a fine grid, a coarse dot and stripes.
 * The pattern turns with its sheet; its marks are a step darker than the paper.
 * @param {string} id
 * @param {PatternKind} kind
 * @param {string} base The paper colour.
 * @param {number} turn Degrees.
 * @param {Pt} centre
 * @param {Poly} outline
 * @returns {string}
 */
function patternFill(id, kind, base, turn, [cx, cy], outline) {
  const luma = lumaOf(base);
  const g = luma < 40 ? 0x50 : Math.round(luma * 0.62);
  const c = `#${g.toString(16).padStart(2, '0').repeat(3)}`;
  /** @type {Record<PatternKind, [number, number, string]>} */
  const cells = {
    ruled: [60, 10, `<rect width="60" height="2" fill="${c}"/>`],
    grid: [12, 12, `<rect width="12" height="1.8" fill="${c}"/><rect width="1.8" height="12" fill="${c}"/>`],
    dots: [11, 11, `<circle cx="5.5" cy="5.5" r="2.6" fill="${c}"/>`],
    stripes: [7, 40, `<rect width="2.6" height="40" fill="${c}"/>`],
  };
  const cell = cells[kind];
  if (!cell) throw new Error(`unknown pattern "${kind}" (use ruled, grid, dots or stripes)`);
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${cell[0]}" height="${cell[1]}" patternTransform="rotate(${f(turn)} ${f(cx)} ${f(cy)})">${cell[2]}</pattern><polygon points="${pts(outline)}" fill="url(#${id})"/>`;
}

/**
 * The scene as one SVG string.
 * @param {Built} built
 * @param {{ marks?: boolean }} [options] `marks: false` leaves the marks out, so the paper can be measured alone.
 * @returns {string}
 */
function svgOf(built, { marks = true } = {}) {
  const { items, width, height } = built;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  items.forEach((item, index) => {
    if (item.role === 'tape') {
      out += tapeSvg(built, item, index);
      return;
    }
    if (item.shadow) {
      for (const part of item.parts) {
        if (part.castsShadow) out += `<polygon points="${pts(part.outline)}" fill="${built.shadow.fill}" transform="translate(${item.shadow.x} ${item.shadow.y})"/>`;
      }
    }
    item.parts.forEach((part, j) => {
      out += `<polygon points="${pts(part.outline)}" fill="${part.fill}"/>`;
      if (part.pattern) out += patternFill(`pat-${item.name}-${j}`, part.pattern, part.fill, part.patternTurn ?? 0, centroid(part.outline), part.outline);
    });
    if (marks) for (const m of item.marks) out += `<polygon points="${pts(m.poly)}" fill="${m.fill ?? '#000000'}"/>`;
  });
  return `${out}</svg>`;
}

/**
 * Tape: a light, see-through strip with a thin outline's worth of body. Over gray paper the fill is thinner, so the halftone dots show through.
 * Two masks tell the papers apart: one is white where the topmost paper under the tape is gray, the other where it is not.
 * @param {Built} built
 * @param {Item} tape
 * @param {number} index
 */
function tapeSvg(built, tape, index) {
  let gray = '';
  let other = '';
  for (let i = 0; i < index; i++) {
    const item = built.items[i];
    if (item.role === 'tape') continue;
    for (const part of item.parts) {
      const l = lumaOf(part.fill);
      const isGray = l > 24 && l < 235;
      gray += `<polygon points="${pts(part.outline)}" fill="${isGray ? '#fff' : '#000'}"/>`;
      other += `<polygon points="${pts(part.outline)}" fill="${isGray ? '#000' : '#fff'}"/>`;
    }
  }
  const box = `maskUnits="userSpaceOnUse" x="0" y="0" width="${built.width}" height="${built.height}"`;
  const poly = pts(tape.parts[0].outline);
  return `<mask id="gray-${tape.name}" ${box}>${gray}</mask><mask id="other-${tape.name}" ${box}>${other}</mask>`
    + `<g mask="url(#other-${tape.name})"><polygon points="${poly}" fill="rgba(90,90,90,0.55)"/></g>`
    + `<g mask="url(#gray-${tape.name})"><polygon points="${poly}" fill="rgba(235,235,235,0.6)"/></g>`;
}

// Checks for a paper collage. Each check returns `CheckResult`s (see core/checks.js) and never prints or exits.
//
// Checks over the geometry of the paste stack (no browser needed):
//   checkMarks       marks lie inside their piece, clear of its cut edge, and no later piece, shadow or tape hides them (hidden marks)
//   checkMotifs      every motif lies flat on a holder, casts no shadow, and keeps clear paper around it on the holder
//   checkShown       every piece shows enough of itself (it is not buried under later paper, shadows or tape)
//   checkSheetSlivers  no sheet shows as a band thinner than a few pixels
//   checkBase        the safety sheet under the collage shows nowhere
// Checks over the printed image (they take the print of the paper alone, a black and white `GrayImage`):
//   checkShadows     the shadow of a holder shows, and a motif casts none
//   checkTones       the darkest tiles print darker than all the others (tone order)
//   checkRamp        neighbouring grays of the palette print as different tones
//   checkNeighbours  grays that touch on the page print as different tones
//   checkProbe       no pixel of the page is left without paper (coverage)
// A check never runs the print filter itself, so a pack can use any look. `runCollageChecks` runs them all.
import { blackShare, checkCoverage, checkSlivers, checkToneOrder, countProbePixels, findSlivers } from '../../src/core/checks.js';
import { densify, inside, oneWay, translate, marginInside } from './geometry.js';
import { collageFilter } from './filter.js';
import { and, count, dilate, erode, fillPolys, minus } from './raster.js';
import { lumaOf } from './scene.js';

/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */
/** @typedef {import('../../src/core/filters.js').GrayImage} GrayImage */
/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Poly} Poly */
/** @typedef {import('./scene.js').Built} Built */
/** @typedef {import('./scene.js').Item} Item */

/** @param {string} name @param {boolean} ok @param {string} message @returns {CheckResult} */
const result = (name, ok, message) => ({ name, ok, message });

/** @param {Pt} pt */
const at = (pt) => `${pt[0].toFixed(0)},${pt[1].toFixed(0)}`;

/** @param {string[]} list @param {number} [max] */
const some = (list, max = 4) => (list.length > max ? `${list.slice(0, max).join('; ')}; and ${list.length - max} more` : list.join('; '));

/**
 * Marks: each mark lies inside the cut edge of its own piece, at least `margin` px from it, and no later piece, shadow or tape covers it.
 * `allow` names the covers that are on purpose: `{ mark: 'mouth', by: 'tongue' }` lets the tile `tongue` lie over the marks of `mouth`.
 * @param {Built} built
 * @param {{ margin?: number, allow?: { mark: string, by: string }[] }} [options] `margin` default 3.
 * @returns {CheckResult[]}
 */
export function checkMarks(built, { margin = 3, allow = [] } = {}) {
  /** @type {string[]} */
  const outside = [];
  /** @type {string[]} */
  const close = [];
  /** @type {string[]} */
  const hidden = [];
  let marked = 0;
  built.items.forEach((item, index) => {
    if (!item.marks.length) return;
    marked++;
    const outline = item.parts[0].outline;
    const ink = item.marks.flatMap((m) => densify(m.poly, 3));
    const out = ink.filter((pt) => !inside(outline, pt));
    if (out.length) outside.push(`${item.name}: ${out.length} of ${ink.length} mark points lie outside the piece, e.g. at ${at(out[0])}`);
    else {
      const m = oneWay(ink, outline);
      if (m < margin) close.push(`${item.name}: a mark lies ${m.toFixed(1)} px from the cut edge`);
    }
    for (const later of built.items.slice(index + 1)) {
      if (allow.some((a) => a.mark === item.name && a.by === later.name)) continue;
      const covers = ink.filter((pt) => later.parts.some((part) => inside(part.outline, pt) || (part.castsShadow && later.shadow && inside(translate(part.outline, later.shadow.x, later.shadow.y), pt))));
      if (covers.length) hidden.push(`${item.name}: ${covers.length} of ${ink.length} mark points are hidden by ${later.name}, e.g. at ${at(covers[0])}`);
    }
  });
  return [
    result('marks inside', !outside.length, outside.length ? some(outside) : `the marks of ${marked} pieces lie inside their pieces`),
    result('marks margin', !close.length, close.length ? `${some(close)} (needs ${margin} px)` : `every mark is at least ${margin} px from the cut edge of its piece`),
    result('hidden marks', !hidden.length, hidden.length ? some(hidden) : 'no later piece, shadow or tape hides a mark'),
  ];
}

/**
 * Motifs: each lies flat (no part casts a shadow), sits on a holder that casts the shadow, and keeps `fit` px of the holder around its whole outline.
 * @param {Built} built
 * @param {{ fit?: number }} [options] `fit` default 8.
 * @returns {CheckResult[]}
 */
export function checkMotifs(built, { fit = 8 } = {}) {
  const motifs = built.items.filter((it) => it.role === 'motif');
  /** @type {string[]} */
  const unheld = [];
  /** @type {string[]} */
  const casting = [];
  /** @type {string[]} */
  const tight = [];
  const margins = [];
  for (const motif of motifs) {
    const holder = built.items.find((it) => it.role === 'holder' && it.of === motif.name);
    if (!holder || !holder.shadow || holder.parts.length !== 1 || !holder.parts[0].castsShadow) {
      unheld.push(`${motif.name} has no holder that casts a shadow`);
      continue;
    }
    if (motif.shadow || motif.parts.some((p) => p.castsShadow)) casting.push(`${motif.name} casts a shadow of its own`);
    const m = marginInside(motif.parts.map((p) => p.outline), holder.parts[0].outline);
    margins.push(`${motif.name} ${m.toFixed(1)}`);
    if (m < fit) tight.push(`${motif.name} ${m < 0 ? 'reaches outside' : `comes within ${m.toFixed(1)} px of the edge of`} its holder`);
  }
  return [
    result('motif holders', !unheld.length, unheld.length ? some(unheld) : `${motifs.length} motifs, each on a holder that casts the shadow`),
    result('flat motifs', !casting.length, casting.length ? some(casting) : 'no motif casts a shadow'),
    result('motif margin', !tight.length, tight.length ? `${some(tight)} (needs ${fit} px of paper on every side)` : `motif to the cut edge of its holder, px: ${margins.join(', ')}`),
  ];
}

/**
 * Hidden pieces: a tile, holder or motif must show at least `min` of its area (a motif at least `minMotif`).
 * Paper pasted later, the shadows of later pieces, tape and the area outside the round window of the scene count as hiding.
 * A holder counts the paper under its own motif as shown.
 * @param {Built} built
 * @param {{ min?: number, minMotif?: number, step?: number }} [options] `min` default 0.5, `minMotif` default 0.85, `step` (grid, px) default 3.
 * @returns {CheckResult[]}
 */
export function checkShown(built, { min = 0.5, minMotif = 0.85, step = 3 } = {}) {
  /** @type {string[]} */
  const bad = [];
  /** @type {string[]} */
  const shares = [];
  built.items.forEach((item, index) => {
    if (!['tile', 'holder', 'motif'].includes(item.role)) return;
    // The holder's own motif lies on it, so the holder is covered from the motif on.
    const above = item.role === 'holder' ? index + 1 : index;
    const outlines = item.parts.map((p) => p.outline);
    const box = outlines.flat();
    const x0 = Math.min(...box.map((p) => p[0]));
    const x1 = Math.max(...box.map((p) => p[0]));
    const y0 = Math.min(...box.map((p) => p[1]));
    const y1 = Math.max(...box.map((p) => p[1]));
    let all = 0;
    let shown = 0;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        if (!outlines.some((o) => inside(o, [x, y]))) continue;
        all++;
        if (built.inRegion([x, y]) && !built.coveredAbove([x, y], above)) shown++;
      }
    }
    const share = all ? shown / all : 0;
    shares.push(`${item.name} ${(100 * share).toFixed(0)}%`);
    const need = item.role === 'motif' ? minMotif : min;
    if (share < need) bad.push(`${item.name} shows only ${(100 * share).toFixed(0)}% of itself (needs ${(100 * need).toFixed(0)}%)`);
  });
  return [result('hidden pieces', !bad.length, bad.length ? some(bad) : `share of each piece that shows: ${shares.join(', ')}`)];
}

/**
 * Slivers: no sheet or mat may show as a band thinner than `minWidth` over a run of `minLength` or more.
 * A point shows when no paper is pasted over it and no shadow falls on it. A shadow prints as dark as black or deep gray paper,
 * so on such a sheet a shadow does not hide the sheet; the sheet's own shadow then belongs to the band.
 * @param {Built} built
 * @param {{ minWidth?: number, minLength?: number, step?: number, darkest?: number }} [options]
 *   `darkest`: the highest brightness (0 to 255) of a paper that prints as dark as the shadow. Default 94 (#5e).
 * @returns {CheckResult[]}
 */
export function checkSheetSlivers(built, { minWidth = 8, minLength = 50, step = 2, darkest = 0x5e } = {}) {
  /** @type {CheckResult[]} */
  const out = [];
  built.items.forEach((item, index) => {
    if (item.role !== 'sheet' && item.role !== 'mat') return;
    const part = item.parts[0];
    const dark = lumaOf(part.fill) <= darkest;
    const own = dark && item.shadow ? translate(part.outline, item.shadow.x, item.shadow.y) : null;
    const xs = part.outline.map((p) => p[0]);
    const ys = part.outline.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs));
    const y0 = Math.floor(Math.min(...ys));
    const w = Math.ceil((Math.max(...xs) + (item.shadow?.x ?? 0) - x0) / step) + 1;
    const h = Math.ceil((Math.max(...ys) + (item.shadow?.y ?? 0) - y0) / step) + 1;
    const visible = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        /** @type {Pt} */
        const pt = [x0 + i * step, y0 + j * step];
        if (pt[0] < 0 || pt[1] < 0 || pt[0] >= built.width || pt[1] >= built.height || !built.inRegion(pt)) continue;
        if (inside(part.outline, pt)) {
          if (built.topAt(pt)?.item === item && !built.coveredAbove(pt, index, { shadows: !dark })) visible[j * w + i] = 1;
        } else if (own && inside(own, pt)) {
          // The sheet's own shadow, where it falls on paper below the sheet.
          const top = built.topAt(pt);
          if (top && top.index < index && !built.coveredAbove(pt, index)) visible[j * w + i] = 1;
        }
      }
    }
    const found = findSlivers(visible, w, h, { step, minWidth, minLength });
    for (const s of found.slivers) {
      s.from = [s.from[0] + x0, s.from[1] + y0];
      s.to = [s.to[0] + x0, s.to[1] + y0];
    }
    out.push(checkSlivers(item.name, found, minWidth));
  });
  return out;
}

/**
 * The safety sheet: no point of the page may show only the base.
 * @param {Built} built
 * @param {{ step?: number }} [options] `step`: the sample grid in px. Default 4.
 * @returns {CheckResult}
 */
export function checkBase(built, { step = 4 } = {}) {
  /** @type {Pt | null} */
  let first = null;
  let bare = 0;
  for (let y = step / 2; y < built.height; y += step) {
    for (let x = step / 2; x < built.width; x += step) {
      if (!built.inRegion([x, y])) continue;
      if (built.topAt([x, y])?.item.role === 'base') {
        bare++;
        first ??= [x, y];
      }
    }
  }
  return result('base sheet', !bare, bare ? `${bare} sample points show only the base sheet, the first at ${at(/** @type {Pt} */ (first))}` : 'the base sheet shows nowhere');
}

/**
 * Coverage from a probe render: the page is rendered on magenta and no magenta pixel may remain.
 * @param {Built} built
 * @param {{ data: Uint8Array, width: number, height: number }} probe RGBA pixels of the probe render.
 * @returns {CheckResult}
 */
export function checkProbe(built, { data, width, height }) {
  let pixels = data;
  if (built.region) {
    // Outside the round window there is no paper by design.
    pixels = Uint8Array.from(data);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!built.inRegion([x + 0.5, y + 0.5])) pixels.fill(255, (y * width + x) * 4, (y * width + x) * 4 + 3);
  }
  return checkCoverage('collage', countProbePixels(pixels, 4));
}

/**
 * A region of the image for a measurement: the mask, with what must not count taken out and a round window applied by `blackShare`.
 * @param {Built} built
 * @param {GrayImage} paper
 * @param {Uint8Array} mask
 */
function shareOf(built, paper, mask) {
  const r = built.region;
  return blackShare(paper.gray, paper.width, mask, r ? { circle: { cx: r.cx, cy: r.cy, r: r.r - 5 } } : {});
}

/**
 * Shadow checks on the printed paper (no marks). For each motif and its holder:
 *  - no shadow: the strip where the motif's shadow would fall must print like the holder's plain paper (`same` at most apart);
 *  - value: the motif's own paper must differ from the holder's by `valueGap` in black share;
 *  - the holder's shadow must differ from the paper under it by `shadowGap`, so it shows against the paper below the holder,
 *    and from the holder's own paper by `shadowGap`, so it also shows against the piece it belongs to (a black holder hides its own shadow).
 * Everything pasted over the motif or the holder is left out. A region with fewer than `minPixels` pixels fails the check, it is not skipped.
 * @param {Built} built
 * @param {GrayImage} paper The print of the paper alone: render the collage with `paper: true`, then run the print filter.
 * @param {{ same?: number, valueGap?: number, shadowGap?: number, minPixels?: number }} [options]
 * @returns {CheckResult[]}
 */
export function checkShadows(built, paper, { same = 0.15, valueGap = 0.25, shadowGap = 0.35, minPixels = 100 } = {}) {
  const { width, height } = paper;
  /** @type {CheckResult[]} */
  const out = [];
  const items = built.items;
  /** @param {Uint8Array} m @param {number} d */
  const grown = (m, d) => dilate(m, width, height, d);
  /** @param {Uint8Array} m @param {number} d */
  const shrunk = (m, d) => erode(m, width, height, d);
  /** @param {Poly[]} polys @param {number} [dx] @param {number} [dy] */
  const fill = (polys, dx = 0, dy = 0) => fillPolys(polys, width, height, { dx, dy });
  /** @param {number} from @param {number[]} [skip] Mask of what lies over the item at index `from`. */
  const above = (from, skip = []) => {
    /** @type {Poly[]} */
    const shapes = [];
    /** @type {Poly[]} */
    const shadows = [];
    items.forEach((it, i) => {
      if (i <= from || skip.includes(i)) return;
      for (const p of it.parts) {
        shapes.push(p.outline);
        if (p.castsShadow && it.shadow) shadows.push(translate(p.outline, it.shadow.x, it.shadow.y));
      }
    });
    return fill([...shapes, ...shadows]);
  };
  items.forEach((holder, hi) => {
    if (holder.role !== 'holder') return;
    const mi = items.findIndex((it) => it.name === holder.of);
    const motif = items[mi];
    if (!motif || !holder.shadow) {
      out.push(result(`shadow ${holder.of}`, false, 'the holder casts no shadow, or its motif is missing'));
      return;
    }
    const s = holder.shadow;
    const back = holder.parts[0].outline;
    const shapes = motif.parts.map((p) => p.outline);
    const coveredMotif = above(mi);
    const coveredBack = above(hi, [mi]);
    const backMask = fill([back]);
    const movedBackMask = fill([back], s.x, s.y);
    const motifMask = fill(shapes);
    const movedMotifMask = fill(shapes, s.x, s.y);
    const motifOut6 = grown(motifMask, 6);
    const strip = minus(minus(and(shrunk(backMask, 3), shrunk(movedMotifMask, 2)), grown(motifMask, 1.5)), coveredMotif);
    const plain = minus(minus(minus(shrunk(backMask, 5), motifOut6), grown(movedMotifMask, 2)), coveredMotif);
    const own = minus(shrunk(motifMask, 1.5), coveredMotif);
    const shade = minus(minus(shrunk(movedBackMask, 2), grown(backMask, 1.5)), coveredBack);
    const under = minus(minus(minus(grown(movedBackMask, 14), grown(movedBackMask, 4)), grown(backMask, 4)), coveredBack);
    const m = {
      strip: shareOf(built, paper, strip),
      plain: shareOf(built, paper, plain),
      motif: shareOf(built, paper, own),
      shade: shareOf(built, paper, shade),
      under: shareOf(built, paper, under),
    };
    const name = `shadow ${motif.name}`;
    const few = Object.entries(m).filter(([, v]) => v.n < minPixels).map(([k, v]) => `${k} ${v.n}`);
    if (few.length) {
      out.push(result(name, false, `too few pixels to measure (${few.join(', ')}; at least ${minPixels} needed)`));
      return;
    }
    const apartNone = Math.abs(m.strip.share - m.plain.share);
    const apartValue = Math.abs(m.motif.share - m.plain.share);
    const apartShade = Math.abs(m.shade.share - m.under.share);
    const apartOwn = Math.abs(m.shade.share - m.plain.share);
    /** @type {string[]} */
    const problems = [];
    if (apartNone >= same) problems.push(`the motif seems to cast a shadow: black ${m.strip.share.toFixed(2)} beside it against ${m.plain.share.toFixed(2)} on the plain holder (${apartNone.toFixed(2)} apart, at most ${same})`);
    if (apartValue < valueGap) problems.push(`the motif prints like its holder: black ${m.motif.share.toFixed(2)} against ${m.plain.share.toFixed(2)} (${apartValue.toFixed(2)} apart, needs ${valueGap})`);
    if (apartShade < shadowGap) problems.push(`the holder's shadow does not show against the paper under it: black ${m.shade.share.toFixed(2)} against ${m.under.share.toFixed(2)} (${apartShade.toFixed(2)} apart, needs ${shadowGap})`);
    if (apartOwn < shadowGap) problems.push(`the holder's shadow does not show against its own paper: black ${m.shade.share.toFixed(2)} against ${m.plain.share.toFixed(2)} (${apartOwn.toFixed(2)} apart, needs ${shadowGap})`);
    out.push(result(name, !problems.length, problems.length
      ? problems.join('; ')
      : `no shadow beside the motif (${apartNone.toFixed(2)} apart), motif value ${apartValue.toFixed(2)} from the holder, holder shadow ${apartShade.toFixed(2)} from the paper under it and ${apartOwn.toFixed(2)} from its own paper`));
  });
  return out;
}

/**
 * The black share of the paper of a tile, measured in a band just inside its outline (6 to 15 px in, or all but the outer 2 px for a small tile).
 * Pasted later paper and its shadows are left out.
 * @param {Built} built
 * @param {GrayImage} paper
 * @param {number} index Index of the tile in the stack.
 * @returns {{ share: number, n: number }}
 */
export function paperShare(built, paper, index) {
  const { width, height } = paper;
  const outline = built.items[index].parts[0].outline;
  const body = fillPolys([outline], width, height);
  let band = minus(erode(body, width, height, 6), erode(body, width, height, 15));
  if (count(band) < 80) band = erode(body, width, height, 2);
  /** @type {Poly[]} */
  const later = [];
  built.items.forEach((it, i) => {
    if (i <= index) return;
    for (const p of it.parts) {
      later.push(p.outline);
      if (p.castsShadow && it.shadow) later.push(translate(p.outline, it.shadow.x, it.shadow.y));
    }
  });
  return shareOf(built, paper, minus(band, fillPolys(later, width, height)));
}

/**
 * Tone order: the tiles named in `darkest` are the darkest tiles; every other tile (except those in `skip`) must print at least `gap` lighter in black share
 * than the lightest of them. A tile whose paper band is too small to measure fails: it must not drop out unseen.
 * @param {Built} built
 * @param {GrayImage} paper The print of the paper alone.
 * @param {{ darkest: string[], gap?: number, skip?: string[], minPixels?: number }} options `gap` default 0.1, `minPixels` default 150.
 * @returns {CheckResult[]}
 */
export function checkTones(built, paper, { darkest, gap = 0.1, skip = [], minPixels = 150 }) {
  const shares = new Map();
  built.items.forEach((it, i) => {
    if (it.role === 'tile') shares.set(it.name, paperShare(built, paper, i));
  });
  for (const n of darkest) if (!shares.has(n)) throw new Error(`tone check: "${n}" is not a tile of the scene`);
  const measured = darkest.map((n) => ({ n, ...shares.get(n) }));
  if (measured.some((d) => d.n < minPixels)) return [result('tone order', false, `the darkest tiles could not be measured (${measured.map((d) => `${d.n}: ${d.share}`).join(', ')})`)];
  const ref = measured.reduce((a, b) => (b.share < a.share ? b : a));
  /** @type {CheckResult[]} */
  const out = [];
  for (const [name, v] of shares) {
    if (darkest.includes(name) || skip.includes(name)) continue;
    if (v.n < minPixels) out.push(result(`tone ${name}`, false, `could not be measured (its paper band has ${v.n} px, at least ${minPixels} needed)`));
    else out.push(checkToneOrder(`tone ${name}`, ref, v, gap, 1));
  }
  return out;
}

/** The grays that the tone measurements go through, as #rrggbb fills, pale to deep. */
export const RAMP_FILLS = ['#ffffff', '#e8e8e8', '#d8d8d8', '#c8c8c8', '#b9b9b9', '#a8a8a8', '#989898', '#8f8f8f', '#858585', '#767676', '#5e5e5e', '#000000'];

/**
 * Prints flat strips of paper through the print filter and measures the black share of each.
 * @param {string[]} fills #rrggbb fills.
 * @param {Partial<import('./filter.js').CollageFilterOptions>} [filter]
 * @returns {Map<string, { share: number, n: number }>}
 */
export function measureFills(fills, filter = {}) {
  const strip = 60;
  const margin = 8;
  const w = strip * fills.length;
  const h = 200;
  const data = new Uint8Array(w * h * 4);
  fills.forEach((fill, k) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
    for (let y = 0; y < h; y++) for (let x = k * strip; x < (k + 1) * strip; x++) data.set([r, g, b, 255], (y * w + x) * 4);
  });
  const printed = collageFilter({ data, width: w, height: h }, filter);
  return new Map(fills.map((fill, k) => {
    const mask = new Uint8Array(w * h);
    for (let y = margin; y < h - margin; y++) for (let x = k * strip + margin; x < (k + 1) * strip - margin; x++) mask[y * w + x] = 1;
    return [fill, blackShare(printed.gray, w, mask)];
  }));
}

/**
 * The gray ramp: the palette, pale to deep (white first), is printed through the filter, and neighbouring grays must differ by `gap` in black share.
 * White comes first, so the palest gray must print dots of its own.
 * @param {string[]} palette The gray fills of the collage.
 * @param {{ gap?: number, filter?: Partial<import('./filter.js').CollageFilterOptions> }} [options] `gap` default 0.06.
 * @returns {CheckResult[]}
 */
export function checkRamp(palette, { gap = 0.06, filter } = {}) {
  const list = ['#ffffff', ...[...new Set(palette)].filter((f) => f !== '#ffffff').sort((a, b) => lumaOf(b) - lumaOf(a))];
  const shares = measureFills(list, filter);
  /** @type {CheckResult[]} */
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const r = checkToneOrder(`gray ${list[i - 1]} and ${list[i]}`, /** @type {{ share: number, n: number }} */ (shares.get(list[i])), /** @type {{ share: number, n: number }} */ (shares.get(list[i - 1])), gap);
    out.push(r);
  }
  return out;
}

/**
 * Gray neighbours: where two different gray papers touch (visible, not under a shadow), they must print as different tones, `gap` apart in black share.
 * Black and white papers are told apart by their own contrast. The paper colours are measured through the print filter.
 * @param {Built} built
 * @param {{ gap?: number, filter?: Partial<import('./filter.js').CollageFilterOptions>, minLength?: number }} [options] `gap` default 0.06, `minLength` default 24 (px of shared edge).
 * @returns {CheckResult}
 */
export function checkNeighbours(built, { gap = 0.06, filter, minLength = 24 } = {}) {
  const fills = [...new Set(built.items.filter((it) => it.role !== 'tape').flatMap((it) => it.parts.map((p) => p.fill)))];
  const isGray = (/** @type {string} */ fill) => lumaOf(fill) > 24 && lumaOf(fill) < 235;
  const shares = measureFills(fills, filter);
  /** @type {Record<string, number>} */
  const alike = {};
  for (let y = 2; y < built.height; y += 4) {
    for (let x = 2; x < built.width; x += 4) {
      for (const [dx, dy] of [[6, 0], [0, 6]]) {
        /** @type {Pt} */
        const p = [x, y];
        /** @type {Pt} */
        const q = [x + dx, y + dy];
        if (!built.inRegion(p) || !built.inRegion(q)) continue;
        const a = built.topAt(p);
        const b = built.topAt(q);
        if (!a || !b || a.part === b.part || !isGray(a.part.fill) || !isGray(b.part.fill)) continue;
        if (a.item.role === 'base' || b.item.role === 'base') continue;
        if (built.coveredAbove(p, a.index, { tape: false }) || built.coveredAbove(q, b.index, { tape: false })) continue;
        const apart = Math.abs(/** @type {{ share: number }} */ (shares.get(a.part.fill)).share - /** @type {{ share: number }} */ (shares.get(b.part.fill)).share);
        if (apart >= gap) continue;
        const key = [a.item.name, b.item.name].sort().join(' / ') + ` (${a.part.fill} and ${b.part.fill})`;
        alike[key] = (alike[key] ?? 0) + 4;
      }
    }
  }
  const list = Object.entries(alike).filter(([, len]) => len >= minLength);
  return result('gray neighbours', !list.length, list.length ? `neighbouring gray papers print as the same tone: ${list.map(([k, len]) => `${k} ${len} px`).join(', ')}` : 'no gray papers that touch print alike');
}

/**
 * Runs every check over a collage.
 * @param {Built} built
 * @param {{
 *   paper: GrayImage,
 *   probe: { data: Uint8Array, width: number, height: number },
 *   darkest?: string[],
 *   allow?: { mark: string, by: string }[],
 *   filter?: Partial<import('./filter.js').CollageFilterOptions>,
 * }} input `paper`: the print of the paper alone. `probe`: the pixels of the probe render. `darkest`: tiles for the tone order check (leave out to skip it).
 * @returns {CheckResult[]}
 */
export function runCollageChecks(built, { paper, probe, darkest, allow, filter }) {
  const grays = [...new Set(built.items.filter((it) => it.role !== 'tape').flatMap((it) => it.parts.map((p) => p.fill)))].filter((f) => lumaOf(f) > 24 && lumaOf(f) < 235);
  return [
    ...checkMarks(built, { allow }),
    ...checkMotifs(built),
    ...checkShown(built),
    ...checkSheetSlivers(built),
    checkBase(built),
    checkProbe(built, probe),
    ...checkShadows(built, paper),
    ...(darkest ? checkTones(built, paper, { darkest }) : []),
    ...checkRamp(grays, { filter }),
    checkNeighbours(built, { filter }),
  ];
}

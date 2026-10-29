import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, createStreams } from '../../src/core/seed.js';
import { EDGE, edgeOutline, scissor, tapePoly, wave } from '../../packs/collage/edges.js';
import { bounds, clipHalfPlane, inside, marginInside, offsetPoly, polyDist } from '../../packs/collage/geometry.js';
import { burstPoly, crescentPoly, FLAKES, noteParts, snowflakeParts, sparklePoly } from '../../packs/collage/motifs.js';
import { createScene } from '../../packs/collage/scene.js';
import { dilate, erode, fillPolys } from '../../packs/collage/raster.js';

/** @typedef {import('../../packs/collage/geometry.js').Poly} Poly */

/** @type {Poly} */
const square = [[100, 100], [300, 100], [300, 300], [100, 300]];

/** Mean distance of the outline points to the straight line they were cut from, along the top edge. */
const roughness = (/** @type {Poly} */ outline) => {
  const top = outline.filter(([x, y]) => y < 150 && x > 120 && x < 280);
  const ys = top.map(([, y]) => y);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  return Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
};

test('an outline is the same for the same random stream and another for another stream', () => {
  const a = edgeOutline(square, 'cut', createStreams(7).stream('edges.a'));
  const b = edgeOutline(square, 'cut', createStreams(7).stream('edges.a'));
  const c = edgeOutline(square, 'cut', createStreams(7).stream('edges.b'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('a torn edge is rougher than a scissor cut, and a clean edge runs along the authored line', () => {
  const torn = edgeOutline(square, 'torn', createRng(5));
  const cut = edgeOutline(square, 'cut', createRng(5));
  const clean = edgeOutline(square, 'clean', createRng(5));
  assert.ok(roughness(torn) > 2 * roughness(cut), `torn ${roughness(torn)} against cut ${roughness(cut)}`);
  assert.ok(clean.every(([x, y]) => (x === 100 || x === 300 || y === 100 || y === 300)), 'a clean edge stays on the line');
  assert.ok(EDGE.torn.base > EDGE.cut.base && EDGE.cut.base > EDGE.clean.base);
});

test('a list of edge kinds repeats along the edges', () => {
  const outline = edgeOutline(square, ['clean', 'torn'], createRng(3));
  // The top edge (kind clean) keeps y = 100, the right edge (torn) moves inward.
  assert.ok(outline.filter(([, y]) => y === 100).length > 0);
  assert.ok(outline.some(([x]) => x < 299 && x > 280), 'the torn right edge is cut inward');
});

test('smooth noise stays inside its amplitude and is the same for the same stream', () => {
  const w = wave(createRng(9), 500, [[100, 2], [20, 1]]);
  const values = Array.from({ length: 500 }, (_, t) => w(t));
  assert.ok(values.every((v) => Math.abs(v) <= 3));
  const again = wave(createRng(9), 500, [[100, 2], [20, 1]]);
  assert.deepEqual(values, Array.from({ length: 500 }, (_, t) => again(t)));
});

test('scissor cuts keep an edge straight within a pixel or so', () => {
  const cut = scissor(square, createRng(2), 0.9, 11);
  assert.ok(cut.length > 4 * 10);
  assert.ok(cut.every(([x, y]) => Math.min(Math.abs(x - 100), Math.abs(x - 300), Math.abs(y - 100), Math.abs(y - 300)) <= 1));
});

test('tape is a strip of the size asked for with rough ends', () => {
  const tape = tapePoly(200, 200, 120, 30, 0, createRng(4));
  const b = bounds(tape);
  assert.ok(b.x1 - b.x0 > 105 && b.x1 - b.x0 < 135);
  assert.ok(b.y1 - b.y0 > 25 && b.y1 - b.y0 < 35);
  assert.deepEqual(tapePoly(200, 200, 120, 30, 0, createRng(4)), tape);
});

test('a burst never has five points', () => {
  assert.throws(() => burstPoly(100, 100, 30, 5, 0.5, 0, createRng(1)), /five points/);
  for (const n of [3, 4, 6, 8, 12]) assert.doesNotThrow(() => burstPoly(100, 100, 30, n, 0.5, 0, createRng(1)));
  assert.throws(() => burstPoly(100, 100, 30, 2, 0.5, 0, createRng(1)), /3 or more/);
});

test('a scene refuses a five-pointed burst', () => {
  const scene = createScene({ width: 300, height: 300, seed: 1 }).motif('five', { type: 'burst', cx: 150, cy: 150, R: 30, n: 5, k: 0.5, rot: 0 }, { fill: '#000000', back: { fill: '#ffffff', w: 90, h: 90 } });
  assert.throws(() => scene.build(), /five points/);
});

test('a sparkle has four tips and fits the size asked for', () => {
  const poly = sparklePoly(100, 100, 40, 25, 0, createRng(6), 0.3);
  const b = bounds(poly);
  assert.ok(b.x1 - b.x0 > 70 && b.x1 - b.x0 < 95, 'the long axis is about 2a');
  assert.ok(b.y1 - b.y0 > 42 && b.y1 - b.y0 < 58, 'the short axis is about 2b');
});

test('the side branches of a snowflake point outward, in V shapes', () => {
  const [cx, cy, R] = [200, 200, 60];
  for (const kind of Object.keys(FLAKES)) {
    const parts = snowflakeParts(cx, cy, R, 10, createRng(8), kind);
    const spec = FLAKES[kind];
    // Six arms, each an arm bar and its branches, then the hub.
    assert.equal(parts.length, 6 * (1 + 2 * spec.pairs.length) + 1, kind);
    const radial = (/** @type {import('../../packs/collage/geometry.js').Pt} */ p) => Math.hypot(p[0] - cx, p[1] - cy);
    const per = 1 + 2 * spec.pairs.length;
    for (let k = 0; k < 6; k++) {
      const armAngle = ((10 + 60 * k) * Math.PI) / 180;
      for (let j = 0; j < per; j++) {
        const part = parts[k * per + j];
        const tip = part.reduce((a, b) => (radial(b) > radial(a) ? b : a));
        const base = part.reduce((a, b) => (radial(b) < radial(a) ? b : a));
        assert.ok(radial(tip) > radial(base) + 0.15 * R, `${kind}: a bar must reach outward from its base`);
        // A branch runs away from the hub: its direction has a positive part along the arm it grows from.
        const dir = [tip[0] - base[0], tip[1] - base[1]];
        const along = (dir[0] * Math.cos(armAngle) + dir[1] * Math.sin(armAngle)) / Math.hypot(dir[0], dir[1]);
        assert.ok(along > 0.3, `${kind}: bar ${j} of arm ${k} points away from the hub (${along.toFixed(2)})`);
      }
    }
    // The longest arm reaches about R from the centre.
    const reach = Math.max(...parts.flat().map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
    assert.ok(reach > 0.9 * R && reach < 1.1 * R, `${kind}: reach ${reach}`);
  }
  assert.throws(() => snowflakeParts(0, 0, 10, 0, createRng(1), 'nope'), /unknown snowflake kind/);
});

test('a crescent has a hollow: the point on its axis inside the bite is not paper', () => {
  const poly = crescentPoly(200, 200, 50, 0, createRng(2));
  assert.ok(inside(poly, [200 - 40, 200]), 'the back of the moon is paper');
  assert.equal(inside(poly, [200 + 10, 200]), false, 'the bite is empty');
});

test('a note has a head, a stem and a flag', () => {
  const parts = noteParts(200, 200, 50, 0, createRng(2));
  assert.equal(parts.length, 3);
  const [head, stem, flag] = parts;
  assert.ok(bounds(stem).y0 < bounds(head).y0 - 40, 'the stem rises above the head');
  assert.ok(bounds(flag).x1 > bounds(stem).x1, 'the flag curls out to the right of the stem');
});

test('geometry: margins, half planes, offsets and distances', () => {
  assert.ok(Math.abs(marginInside([[[150, 150], [250, 150], [250, 250], [150, 250]]], square) - 50) < 1);
  assert.ok(marginInside([[[90, 150], [150, 150], [150, 250]]], square) < 0, 'a point outside counts as negative');
  const half = clipHalfPlane(square, [200, 0], [1, 0]);
  assert.equal(bounds(half).x0, 200);
  const grown = offsetPoly(square, 10);
  assert.deepEqual(bounds(grown), { x0: 90, y0: 90, x1: 310, y1: 310 });
  assert.equal(polyDist(square, [[400, 100], [500, 100], [500, 200]]), 100);
});

test('raster: fill, erode and dilate', () => {
  const w = 100;
  const mask = fillPolys([[[20, 20], [80, 20], [80, 80], [20, 80]]], w, w);
  assert.equal(mask.reduce((s, v) => s + v, 0), 60 * 60);
  const inner = erode(mask, w, w, 10);
  assert.equal(inner[50 * w + 50], 1);
  assert.equal(inner[25 * w + 25], 0);
  assert.equal(inner.reduce((s, v) => s + v, 0), 40 * 40);
  const outer = dilate(mask, w, w, 5);
  assert.equal(outer[50 * w + 17], 1);
  assert.equal(outer[50 * w + 10], 0);
});

test('a piece keeps its outline when another piece is added before it (named streams)', () => {
  const make = (/** @type {boolean} */ extra) => {
    const scene = createScene({ width: 400, height: 400, seed: 11 });
    scene.sheet('first', [[0, 0], [300, 0], [300, 300], [0, 300]], { fill: '#ffffff' });
    if (extra) scene.sheet('extra', [[50, 50], [200, 60], [150, 200]], { fill: '#b2b2b2' });
    scene.tile('second', [[100, 100], [250, 100], [250, 250], [100, 250]], { fill: '#ffffff', rot: 3 });
    scene.motif('star', { type: 'burst', cx: 330, cy: 330, R: 20, n: 7, k: 0.5, rot: 0 }, { fill: '#000000', back: { fill: '#ffffff', w: 60, h: 60 } });
    return scene.build();
  };
  const a = make(false);
  const b = make(true);
  for (const name of ['first', 'second', 'star', 'star-holder']) assert.deepEqual(a.get(name).parts.map((p) => p.outline), b.get(name).parts.map((p) => p.outline), name);
});

test('a scene refuses bad names, colours and duplicates', () => {
  const scene = createScene({ width: 100, height: 100, seed: 1 });
  assert.throws(() => scene.sheet('bad name', square, { fill: '#ffffff' }), /use letters/);
  assert.throws(() => scene.sheet('ok', square, { fill: 'red' }), /#rrggbb/);
  scene.sheet('twice', square, { fill: '#ffffff' });
  assert.throws(() => scene.sheet('twice', square, { fill: '#ffffff' }), /two pieces are called "twice"/);
  assert.throws(() => scene.mat('missing', 10, '#ffffff').build(), /not in the scene/);
});

test('a mat lies just under its tile, larger than it, and keeps only the side asked for', () => {
  const scene = createScene({ width: 400, height: 400, seed: 3 });
  scene.base('#858585');
  scene.tile('card', [[100, 100], [300, 100], [300, 250], [100, 250]], { fill: '#ffffff', rot: 4 });
  scene.mat('card', 20, '#b2b2b2', { turn: 3, dx: 5, dy: 4 });
  scene.mat('card', 20, '#a2a2a2', { name: 'strip', keep: [[[0, 200], [400, 200]]] });
  const built = scene.build();
  const names = built.items.map((i) => i.name);
  assert.deepEqual(names, ['base', 'mat-card', 'strip', 'card']);
  const tile = bounds(built.get('card').parts[0].outline);
  const mat = bounds(built.get('mat-card').parts[0].outline);
  assert.ok(mat.x0 < tile.x0 - 10 && mat.y0 < tile.y0 - 10 && mat.x1 > tile.x1 + 10 && mat.y1 > tile.y1 + 10, 'the mat reaches out on every side');
  // The strip keeps the side of the line that holds the tile's centre (above y 200).
  assert.ok(bounds(built.get('strip').parts[0].outline).y1 < 215);
  assert.ok(bounds(built.get('mat-card').parts[0].outline).y1 > 260, 'the whole mat reaches further down');
});

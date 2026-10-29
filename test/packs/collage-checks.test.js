import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openRenderer } from '../../src/core/render.js';
import {
  checkBase, checkMarks, checkMotifs, checkNeighbours, checkProbe, checkRamp, checkSheetSlivers, checkShadows, checkShown, checkTones, measureFills,
  printCollage, renderCollage, createScene,
} from '../../packs/collage/index.js';

// One purpose-made bad input for each collage check, and a good input that passes it.
// A good input matters: a check that always fails would look right on a bad one.

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

const WHITE = '#ffffff';
const BLACK = '#000000';
const PALE = '#b2b2b2';
const SLATE = '#858585';

/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {import('../../packs/collage/geometry.js').Poly} */
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** A 300 x 300 page covered by one white sheet. */
const page = (/** @type {number} */ seed = 1) => createScene({ width: 300, height: 300, seed }).base(SLATE).sheet('paper', rect(-20, -20, 340, 340), { fill: WHITE, kinds: 'clean', shadow: false });

/** @param {import('../../src/core/checks.js').CheckResult[]} results @param {string} name */
const named = (results, name) => {
  const r = results.find((x) => x.name === name);
  assert.ok(r, `no result called "${name}" in ${results.map((x) => x.name).join(', ')}`);
  return r;
};

// ---------- marks ----------

test('marks inside: a mark that sticks out of its tile fails, and one inside passes', () => {
  const tile = (/** @type {number} */ w) => page().tile('card', rect(100, 100, 100, 80), { fill: WHITE, marks: [{ poly: rect(120, 120, w, 20) }] }).build();
  const bad = named(checkMarks(tile(110)), 'marks inside');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /card: \d+ of \d+ mark points lie outside the piece/);
  assert.equal(named(checkMarks(tile(40)), 'marks inside').ok, true);
});

test('marks margin: a mark too close to the cut edge fails', () => {
  const built = page().tile('card', rect(100, 100, 100, 80), { fill: WHITE, marks: [{ poly: rect(110, 120, 30, 20) }] }).build();
  const bad = named(checkMarks(built, { margin: 20 }), 'marks margin');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /card: a mark lies [\d.]+ px from the cut edge \(needs 20 px\)/);
  assert.equal(named(checkMarks(built, { margin: 3 }), 'marks margin').ok, true);
});

test('hidden marks: a tile pasted over a mark hides it, unless the cover is allowed', () => {
  const scene = (/** @type {number} */ coverX) =>
    page()
      .tile('under', rect(60, 100, 120, 80), { fill: WHITE, marks: [{ poly: rect(100, 120, 40, 20) }] })
      .tile('over', rect(coverX, 90, 100, 100), { fill: PALE })
      .build();
  const bad = named(checkMarks(scene(110)), 'hidden marks');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /under: \d+ of \d+ mark points are hidden by over/);
  assert.equal(named(checkMarks(scene(110), { allow: [{ mark: 'under', by: 'over' }] }), 'hidden marks').ok, true);
  assert.equal(named(checkMarks(scene(200)), 'hidden marks').ok, true);
});

test('hidden marks: the shadow of a later tile hides a mark too, and so does tape', () => {
  const shadowed = page()
    .tile('under', rect(60, 100, 120, 80), { fill: WHITE, marks: [{ poly: rect(100, 120, 40, 20) }] })
    // Its edge is clear of the mark, its drop shadow (down and to the right by 40 px) is not.
    .tile('over', rect(40, 30, 100, 70), { fill: PALE, shadow: { x: 20, y: 60 } })
    .build();
  assert.match(named(checkMarks(shadowed), 'hidden marks').message, /under: .* hidden by over/);
  const taped = page()
    .tile('under', rect(60, 100, 120, 80), { fill: WHITE, marks: [{ poly: rect(100, 120, 40, 20) }] })
    .tape('strip', 120, 130, 90, 30, 0)
    .build();
  assert.match(named(checkMarks(taped), 'hidden marks').message, /hidden by strip/);
});

// ---------- motifs ----------

const motifScene = (/** @type {number} */ w = 100) =>
  page().motif('star', { type: 'burst', cx: 150, cy: 150, R: 30, n: 8, k: 0.55, rot: 0 }, { fill: BLACK, back: { fill: WHITE, w, h: w, grow: false } });

test('motifs: a motif on a holder that fits passes all three checks', () => {
  const results = checkMotifs(motifScene(100).build());
  assert.deepEqual(results.map((r) => r.ok), [true, true, true]);
});

test('motif holders: a motif without its holder fails', () => {
  const built = motifScene().build();
  built.items = built.items.filter((it) => it.role !== 'holder');
  const bad = named(checkMotifs(built), 'motif holders');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /star has no holder that casts a shadow/);
});

test('flat motifs: a motif that casts its own shadow fails', () => {
  const built = motifScene().build();
  const motif = built.get('star');
  motif.shadow = { x: 7, y: 8 };
  motif.parts[0].castsShadow = true;
  const bad = named(checkMotifs(built), 'flat motifs');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /star casts a shadow of its own/);
});

test('motif margin: a holder that is too small fails', () => {
  const bad = named(checkMotifs(motifScene(70).build()), 'motif margin');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /star (comes within [\d.]+ px of the edge of|reaches outside) its holder/);
});

test('a holder grows until the motif has room, so a small holder asked for still passes', () => {
  const built = page().motif('star', { type: 'burst', cx: 150, cy: 150, R: 30, n: 8, k: 0.55, rot: 0 }, { fill: BLACK, back: { fill: WHITE, w: 20, h: 20 } }).build();
  assert.ok(named(checkMotifs(built), 'motif margin').ok);
});

// ---------- hidden pieces ----------

test('hidden pieces: a tile buried under a later tile fails', () => {
  const scene = (/** @type {number} */ x) => page().tile('buried', rect(100, 100, 80, 60), { fill: PALE }).tile('cover', rect(x, 80, 120, 100), { fill: WHITE }).build();
  const bad = checkShown(scene(90))[0];
  assert.equal(bad.ok, false);
  assert.match(bad.message, /buried shows only \d+% of itself \(needs 50%\)/);
  assert.equal(checkShown(scene(200))[0].ok, true);
});

test('hidden pieces: a motif half under tape fails', () => {
  const scene = (/** @type {number} */ y) =>
    page()
      .motif('star', { type: 'burst', cx: 150, cy: 150, R: 30, n: 8, k: 0.55, rot: 0 }, { fill: BLACK, back: { fill: WHITE, w: 90, h: 90 } })
      .tape('strip', 150, y, 140, 30, 0)
      .build();
  const bad = checkShown(scene(150))[0];
  assert.equal(bad.ok, false);
  assert.match(bad.message, /star shows only \d+% of itself \(needs 85%\)/);
  assert.equal(checkShown(scene(280))[0].ok, true);
});

// ---------- slivers and the base ----------

test('slivers: a sheet that shows as a 4 px band fails, a 50 px band passes', () => {
  const scene = (/** @type {number} */ right) =>
    createScene({ width: 300, height: 300, seed: 2 })
      .base(SLATE)
      .sheet('low', rect(0, 0, 300, 300), { fill: PALE, kinds: 'clean', shadow: false })
      .sheet('high', rect(-10, -10, right + 10, 320), { fill: WHITE, kinds: 'clean', shadow: false })
      .build();
  const results = checkSheetSlivers(scene(296));
  const bad = named(results, 'low slivers');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /shows a band thinner than 8 px: \d+ px long, from \d+,\d+ to \d+,\d+/);
  assert.equal(named(checkSheetSlivers(scene(250)), 'low slivers').ok, true);
});

test('base sheet: a page with a hole in its paper shows the base and fails', () => {
  const half = createScene({ width: 300, height: 300, seed: 1 }).base(SLATE).sheet('paper', rect(-20, -20, 200, 340), { fill: WHITE, kinds: 'clean', shadow: false }).build();
  const bad = checkBase(half);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /\d+ sample points show only the base sheet, the first at \d+,\d+/);
  assert.equal(checkBase(page().build()).ok, true);
});

test('base sheet: outside a round window does not count', () => {
  const scene = createScene({ width: 300, height: 300, seed: 1, region: { cx: 150, cy: 150, r: 100 } }).base(SLATE).sheet('paper', rect(40, 40, 220, 220), { fill: WHITE, kinds: 'clean', shadow: false });
  assert.equal(checkBase(scene.build()).ok, true);
});

// ---------- coverage (probe render) ----------

test('coverage: magenta left on the page fails, a covered page passes', async () => {
  const half = createScene({ width: 300, height: 300, seed: 1 }).base(SLATE).sheet('paper', rect(-20, -20, 200, 340), { fill: WHITE, kinds: 'clean', shadow: false }).build();
  // The base sheet covers the page in the render, so remove it to leave a bare patch: the probe must show it.
  half.items = half.items.filter((it) => it.role !== 'base');
  const bad = checkProbe(half, await renderCollage(renderer, half, { probe: true }));
  assert.equal(bad.ok, false);
  assert.match(bad.message, /\d+ pixels have no paper/);
  const good = page().build();
  assert.equal(checkProbe(good, await renderCollage(renderer, good, { probe: true })).ok, true);
});

// ---------- shadows (printed paper) ----------

/** @param {ReturnType<typeof createScene>} scene */
const paperOf = async (scene) => {
  const built = scene.build();
  return { built, paper: await printCollage(renderer, built, { paper: true }) };
};
const flake = { type: /** @type {const} */ ('snowflake'), cx: 150, cy: 150, R: 38, rot: 0, kind: 'fir' };

test('shadows: a white holder with a black motif passes every test', async () => {
  const { built, paper } = await paperOf(page().motif('flake', flake, { fill: BLACK, back: { fill: WHITE, w: 120, h: 120 } }));
  const r = named(checkShadows(built, paper), 'shadow flake');
  assert.equal(r.ok, true, r.message);
});

test('shadows: a motif that casts a shadow of its own fails', async () => {
  const built = page().motif('flake', flake, { fill: BLACK, back: { fill: WHITE, w: 120, h: 120 } }).build();
  const motif = built.get('flake');
  motif.shadow = { x: 7, y: 8 };
  for (const p of motif.parts) p.castsShadow = true;
  const paper = await printCollage(renderer, built, { paper: true });
  const r = named(checkShadows(built, paper), 'shadow flake');
  assert.equal(r.ok, false);
  assert.match(r.message, /the motif seems to cast a shadow/);
});

test('shadows: a motif of the same value as its holder fails', async () => {
  const { built, paper } = await paperOf(page().motif('flake', flake, { fill: SLATE, back: { fill: SLATE, w: 120, h: 120 } }));
  const r = named(checkShadows(built, paper), 'shadow flake');
  assert.equal(r.ok, false);
  assert.match(r.message, /the motif prints like its holder/);
});

test('shadows: a black holder hides its own shadow, and the check says so', async () => {
  const { built, paper } = await paperOf(page().motif('flake', flake, { fill: WHITE, back: { fill: BLACK, w: 120, h: 120 } }));
  const r = named(checkShadows(built, paper), 'shadow flake');
  assert.equal(r.ok, false);
  assert.match(r.message, /the holder's shadow does not show against its own paper/);
});

test('shadows: a holder on black paper hides its shadow against the paper under it', async () => {
  const scene = createScene({ width: 300, height: 300, seed: 1 }).base(SLATE).sheet('night', rect(-20, -20, 340, 340), { fill: BLACK, kinds: 'clean', shadow: false });
  const { built, paper } = await paperOf(scene.motif('flake', flake, { fill: BLACK, back: { fill: WHITE, w: 120, h: 120 } }));
  const r = named(checkShadows(built, paper), 'shadow flake');
  assert.equal(r.ok, false);
  assert.match(r.message, /does not show against the paper under it/);
});

test('shadows: a motif too small to measure fails, it is not skipped', async () => {
  const { built, paper } = await paperOf(page().motif('dot', { type: 'polygons', parts: [rect(148, 148, 4, 4)] }, { fill: BLACK, back: { fill: WHITE, w: 20, h: 20, fit: 2 } }));
  const r = named(checkShadows(built, paper), 'shadow dot');
  assert.equal(r.ok, false);
  assert.match(r.message, /too few pixels to measure/);
});

// ---------- tone order ----------

const toneScene = (/** @type {string} */ otherFill, /** @type {number} */ size = 70) =>
  page().tile('slate', rect(30, 100, 90, 90), { fill: SLATE }).tile('other', rect(170, 100, size, size), { fill: otherFill });

test('tone order: a tile that prints lighter than the darkest tile passes', async () => {
  const { built, paper } = await paperOf(toneScene(WHITE));
  const r = named(checkTones(built, paper, { darkest: ['slate'] }), 'tone other');
  assert.equal(r.ok, true, r.message);
});

test('tone order: a tile that prints as dark as the darkest tile fails', async () => {
  const { built, paper } = await paperOf(toneScene(SLATE));
  const r = named(checkTones(built, paper, { darkest: ['slate'] }), 'tone other');
  assert.equal(r.ok, false);
  assert.match(r.message, /needs at least 0\.1/);
});

test('tone order: a tile darker than the darkest tile fails with the order reversed', async () => {
  const { built, paper } = await paperOf(toneScene('#5e5e5e'));
  const r = named(checkTones(built, paper, { darkest: ['slate'] }), 'tone other');
  assert.equal(r.ok, false);
  assert.match(r.message, /the order is reversed/);
});

test('tone order: a tile too small to measure fails and a missing darkest tile throws', async () => {
  const { built, paper } = await paperOf(toneScene(WHITE, 10));
  const r = named(checkTones(built, paper, { darkest: ['slate'] }), 'tone other');
  assert.equal(r.ok, false);
  assert.match(r.message, /could not be measured/);
  assert.throws(() => checkTones(built, paper, { darkest: ['nope'] }), /"nope" is not a tile/);
});

// ---------- the gray ramp and gray neighbours ----------

test('measured fills print as more black the darker they are', () => {
  const shares = measureFills([WHITE, PALE, SLATE, BLACK]);
  const list = [...shares.values()].map((v) => v.share);
  assert.deepEqual([...list].sort((a, b) => a - b), list);
  assert.equal(list[0], 0);
  assert.equal(list[3], 1);
});

test('gray ramp: neighbouring grays that print alike fail, and a spread palette passes', () => {
  const bad = checkRamp(['#b2b2b2', '#b6b6b6']);
  assert.equal(bad.every((r) => r.ok), false);
  assert.match(bad.find((r) => !r.ok)?.message ?? '', /needs at least 0\.06/);
  assert.ok(checkRamp(['#b2b2b2', '#a2a2a2', '#929292', SLATE]).every((r) => r.ok));
});

test('gray ramp: the palest gray must print dots of its own, so it does not turn white', () => {
  const [first] = checkRamp(['#c8c8c8']);
  assert.equal(first.ok, false);
  assert.match(first.name, /#ffffff and #c8c8c8/);
});

test('gray neighbours: two grays that touch and print alike fail, and two that differ pass', () => {
  const scene = (/** @type {string} */ right) =>
    createScene({ width: 300, height: 300, seed: 1 })
      .base(SLATE)
      .sheet('left', rect(-20, -20, 170, 340), { fill: '#b2b2b2', kinds: 'clean', shadow: false })
      .sheet('right', rect(150, -20, 170, 340), { fill: right, kinds: 'clean', shadow: false })
      .build();
  const bad = checkNeighbours(scene('#b6b6b6'));
  assert.equal(bad.ok, false);
  assert.match(bad.message, /left \/ right \(#b2b2b2 and #b6b6b6\) \d+ px/);
  assert.equal(checkNeighbours(scene('#929292')).ok, true);
});

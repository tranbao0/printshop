import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { openRenderer } from '../../src/core/render.js';
import { createStreams } from '../../src/core/seed.js';
import { noiseField } from '../../src/core/noise.js';
import { decodeGrayPng } from '../../src/core/encode.js';
import zine, {
  budgets,
  buildPage,
  buildRansomTitle,
  checkAnimatedSvg,
  assertHopsClearOf,
  fitHop,
  ransomCss,
  ransomTimeline,
  svgFramesAt,
} from '../../packs/zine/index.js';
import { exampleSeeds } from '../../packs/zine/examples.js';
import { ransomMotion } from '../../examples/ransom-title/motion.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packDir = path.join(root, 'packs/zine');
const exists = (/** @type {string} */ file) => access(file).then(() => true, () => false);

/** @type {import('../../src/core/render.js').Renderer} */
let renderer;
before(async () => {
  renderer = await openRenderer();
});
after(async () => {
  await renderer.close();
});

// Golden images. A fresh render is compared with the stored one, and a small share of pixels may differ,
// because anti-aliased text edges can land on the other side of the halftone threshold on another machine.
const MAX_DIFFERING_SHARE = 0.003;

/**
 * @param {Buffer} actual
 * @param {Buffer} golden
 * @param {string} name
 */
async function assertSameImage(actual, golden, name) {
  const a = await decodeGrayPng(actual);
  const g = await decodeGrayPng(golden);
  assert.deepEqual([a.width, a.height], [g.width, g.height], `${name}: the size changed`);
  let differing = 0;
  for (let i = 0; i < a.gray.length; i++) if (a.gray[i] !== g.gray[i] || a.alpha[i] !== g.alpha[i]) differing++;
  const share = differing / a.gray.length;
  assert.ok(share <= MAX_DIFFERING_SHARE, `${name}: ${(share * 100).toFixed(3)}% of the pixels differ from the golden, at most ${MAX_DIFFERING_SHARE * 100}% may`);
}

const examplePage = path.join(root, 'examples/zine-page/page.html');
const exampleTitle = path.join(root, 'examples/ransom-title/title.html');
/** @type {ReturnType<typeof buildRansomTitle> | undefined} */
let titleBuild;
/** The example title, built once for the tests that need it. */
const exampleTitleBuild = () => (titleBuild ??= buildRansomTitle(renderer, exampleTitle, titleOptions));
const titleOptions = { seed: exampleSeeds.ransomTitle, label: 'Paste up, a title cut from magazine letters on a burnt photocopied sheet', motion: ransomMotion, avoid: ['header'] };

// The pack contract and its assets.

test('the pack has the parts of the contract and its examples exist', async () => {
  assert.equal(zine.name, 'zine');
  assert.ok(zine.filters.length > 0);
  for (const e of zine.examples) {
    assert.ok(e.preset in zine.presets, `${e.name}: unknown preset`);
    assert.ok(await exists(path.resolve(packDir, e.input)), `${e.name}: input is missing`);
    assert.ok(await exists(path.resolve(packDir, e.golden)), `${e.name}: golden is missing`);
  }
});

test('every font has its own license file, and every font file in the pack is listed', async () => {
  for (const a of zine.assets) {
    assert.ok(await exists(path.join(packDir, a.file)), `${a.name}: the font file is missing`);
    assert.ok(await exists(path.join(packDir, a.licenseFile)), `${a.name}: the license file is missing`);
    assert.equal(path.dirname(a.file), path.dirname(a.licenseFile), `${a.name}: the license file must sit beside the font`);
    const text = await readFile(path.join(packDir, a.licenseFile), 'utf8');
    const expected = { 'OFL-1.1': /SIL OPEN FONT LICENSE Version 1\.1/, 'Apache-2.0': /Apache License\s+Version 2\.0/ }[a.license];
    assert.ok(expected, `${a.name}: unknown license ${a.license}`);
    assert.match(text, expected, `${a.name}: the license file is not ${a.license}`);
  }
  const listed = new Set(zine.assets.map((a) => path.join(packDir, a.file)));
  const onDisk = [];
  for (const dir of await readdir(path.join(packDir, 'fonts'))) {
    for (const f of await readdir(path.join(packDir, 'fonts', dir))) if (/\.(ttf|otf|woff2?)$/i.test(f)) onDisk.push(path.join(packDir, 'fonts', dir, f));
  }
  assert.deepEqual(onDisk.sort(), [...listed].sort());
});

test('zine.css loads every font of the pack', async () => {
  const css = await readFile(path.join(packDir, 'zine.css'), 'utf8');
  for (const a of zine.assets) {
    assert.ok(css.includes(`font-family: "${a.name}"`) && css.includes(a.file), `${a.name} is not in zine.css`);
  }
});

// The example outputs against their goldens.

test('the example zine page renders and equals its golden', async () => {
  const { png, width, checks } = await buildPage(renderer, examplePage, { seed: exampleSeeds.zinePage });
  assert.equal(width, 1600);
  assert.ok(checks.every((c) => c.ok));
  await assertSameImage(png, await readFile(path.join(root, 'examples/zine-page/page.png')), 'zine-page');
  assert.ok((await zine.checks({ png, width, height: 1000 })).every((c) => c.ok));
});

test('the same seed gives the same page twice, and another seed gives another page', async () => {
  const a = await buildPage(renderer, examplePage, { seed: 3 });
  const b = await buildPage(renderer, examplePage, { seed: 3 });
  assert.ok(a.png.equals(b.png));
  const c = await buildPage(renderer, examplePage, { seed: 4 });
  assert.ok(!a.png.equals(c.png));
});

/** The data URIs of an SVG cut out, so the markup and the style can be compared apart from the pixels. */
const stripImages = (/** @type {string} */ svg) => {
  /** @type {string[]} */
  const uris = [];
  const text = svg.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, (m) => `data:#${uris.push(m) - 1}`);
  return { text, uris };
};

/**
 * Compares two texts that hold pixel numbers (`12.5px`, x="12"): the text must match, and each number may differ by `tolerance`.
 * @param {string} a
 * @param {string} b
 * @param {number} tolerance
 */
function assertSameWithinPx(a, b, tolerance) {
  const split = (/** @type {string} */ text) => text.split(/(-?\d+(?:\.\d+)?px|(?<=\s(?:x|y|width|height)=")-?\d+(?=")|(?<=translate\()-?\d+(?:\.\d+)?)/);
  const pa = split(a);
  const pb = split(b);
  assert.equal(pa.length, pb.length, 'the markup differs');
  pa.forEach((part, i) => {
    if (i % 2 === 0) assert.equal(part, pb[i], 'the markup differs');
    else assert.ok(Math.abs(parseFloat(part) - parseFloat(pb[i])) <= tolerance, `${part} and ${pb[i]} differ by more than ${tolerance}`);
  });
}

test('the example ransom title renders and equals its golden', async () => {
  const { svg, still, letters, checks } = await exampleTitleBuild();
  assert.ok(checks.every((c) => c.ok));
  assert.equal(letters.length, 7, 'the title has seven letters, not the six of the profile title');
  await assertSameImage(still, await readFile(path.join(root, 'examples/ransom-title/title-still.png')), 'ransom-title still');

  const golden = stripImages(await readFile(path.join(root, 'examples/ransom-title/title.svg'), 'utf8'));
  const fresh = stripImages(svg);
  assertSameWithinPx(fresh.text, golden.text, 3);
  assert.equal(fresh.uris.length, golden.uris.length);
  for (let i = 0; i < fresh.uris.length; i++) {
    const read = (/** @type {string} */ uri) => Buffer.from(uri.split(',')[1], 'base64');
    await assertSameImage(read(fresh.uris[i]), read(golden.uris[i]), `ransom-title image ${i}`);
  }
});

test('the stored animated title has no script, no external reference and stays under the size budget', async () => {
  const svg = await readFile(path.join(root, 'examples/ransom-title/title.svg'), 'utf8');
  assert.ok(checkAnimatedSvg('title', svg).every((c) => c.ok));
  assert.ok(Buffer.byteLength(svg) <= budgets.ransomSvg);
  assert.doesNotMatch(svg, /<script|\son\w+=/i);
  const references = [...svg.matchAll(/(?:href|src)="([^"]*)"|url\(([^)]*)\)/g)].map((m) => m[1] ?? m[2]);
  assert.ok(references.length > 0);
  assert.ok(references.every((r) => r.startsWith('data:') || r.startsWith('#')), 'an external reference');
});

// The checks fail on purpose-made bad input.

const problem = (/** @type {string} */ fragment) => `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">${fragment}</svg>`;

/** @type {[string, string, RegExp][]} */
const badSvgs = [
  ['a script element', problem('<script>alert(1)</script>'), /<script>/],
  ['a script element with attributes', problem('<script type="text/ecmascript" href="#x"/>'), /<script>/],
  ['an event handler attribute', problem('<rect width="4" height="4" onload="alert(1)"/>'), /event handler/],
  ['an external image', problem('<image href="https://example.com/a.png" width="4" height="4"/>'), /external reference href/],
  ['an external image with xlink', problem('<image xlink:href="http://example.com/a.png" width="4" height="4"/>'), /external reference href/],
  ['a relative file reference', problem('<image href="a.png" width="4" height="4"/>'), /external reference href/],
  ['an external url() in the style', problem('<style>rect { fill: url(https://example.com/p.svg#a); }</style>'), /external reference url/],
  ['an external url() with quotes', problem('<style>rect { fill: url("//example.com/p.svg"); }</style>'), /external reference url/],
  ['a style import', problem('<style>@import "https://example.com/a.css";</style>'), /@import/],
  ['a foreignObject', problem('<foreignObject width="4" height="4"/>'), /foreignObject/],
  ['a javascript address', problem('<a href="javascript:alert(1)"><rect width="1" height="1"/></a>'), /javascript:/],
];

for (const [name, svg, expected] of badSvgs) {
  test(`the animated SVG check fails ${name}`, () => {
    const results = checkAnimatedSvg('bad', svg, 100_000);
    const failed = results.filter((r) => !r.ok);
    assert.equal(failed.length, 1, JSON.stringify(results));
    assert.match(failed[0].message, expected);
  });
}

test('the animated SVG check accepts data URIs and fragments', () => {
  const svg = problem('<style>#a { fill: url(#g); }</style><image href="data:image/png;base64,AAAA" width="1" height="1"/><use href="#a"/>');
  assert.ok(checkAnimatedSvg('good', svg, 100_000).every((r) => r.ok));
});

test('the animated SVG check fails a file over its size budget', () => {
  const svg = problem(`<!-- ${'x'.repeat(2000)} -->`);
  const results = checkAnimatedSvg('big', svg, 1000);
  assert.equal(results.find((r) => /size/.test(r.name))?.ok, false);
  assert.match(results[0].message, /over the 1000 byte limit/);
  assert.equal(checkAnimatedSvg('big', svg, 5000)[0].ok, true);
});

test('a build stops when the title is over its size budget', async () => {
  await assert.rejects(buildRansomTitle(renderer, exampleTitle, { ...titleOptions, maxBytes: 1000 }), /over the 1000 byte limit/);
});

test('a page that is over its size budget fails the build', async () => {
  await assert.rejects(buildPage(renderer, examplePage, { seed: 1, maxBytes: 1000 }), /over the 1000 byte limit/);
});

// The motion is general: it follows from the options and the letters, whatever the title says.

/** @param {number} n @param {number} [y] */
const lettersOf = (n, y = 200) => Array.from({ length: n }, (_, i) => ({ normal: Buffer.alloc(0), inverted: Buffer.alloc(0), x: 100 + i * 120, y, width: 100, height: 150 }));


for (const count of [1, 2, 3, 5, 9]) {
  test(`the motion of a title of ${count} letter${count === 1 ? '' : 's'} is well formed`, () => {
    const letters = lettersOf(count);
    const css = ransomCss(letters);
    assert.doesNotMatch(css, /NaN|undefined|Infinity/);
    const t = ransomTimeline(letters);
    assert.ok(Math.abs(t.period - (t.lead + 2 * t.fanLength + t.hold + t.waves * (count * t.step + t.rest))) < 1e-9);
    for (let i = 0; i < count; i++) {
      assert.match(css, new RegExp(`@keyframes enter-${i} `));
      assert.match(css, new RegExp(`#l${i} \\.twin \\{`));
      assert.equal(new RegExp(`@keyframes hop-${i} `).test(css), i > 0, `letter ${i} hops only if a letter flips before it`);
    }
    // The percentages of every block rise from 0% to 100%.
    for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{ ([^@]*?) \}(?=\n|\s*#|\s*@)/g)) {
      const stops = [...body.matchAll(/([\d.]+)% \{/g)].map((m) => parseFloat(m[1]));
      assert.equal(stops[0], 0, name);
      assert.equal(stops[stops.length - 1], 100, name);
      assert.deepEqual([...stops].sort((a, b) => a - b), stops, `${name}: the stops must not go backward`);
    }
    // The first entrance step shows a letter that exists, also for a title of one letter.
    const first = t.entrance[0].shown;
    assert.ok(Array.isArray(first) && first.length === 1 && first[0] >= 0 && first[0] < count);
    assert.ok(t.entrance.every((s) => s.shown === 'all' || s.shown.every((i) => i < count)));
  });
}

test('the lone letter of a title of one letter shows in the first step', () => {
  const css = ransomCss(lettersOf(1));
  assert.match(css, /@keyframes enter-0 \{ 0% \{ opacity: 0;[^}]*\} [\d.]+% \{ opacity: 1;/);
});

test('every step of the entrance, the waves and the rests add up to the period', () => {
  const t = ransomTimeline(lettersOf(6), { lead: 1, fanStep: 0.1, step: 0.2, hold: 0.5, rest: 2, waves: 3 });
  assert.equal(t.waveStarts.length, 3);
  assert.ok(Math.abs(t.waveStarts[1] - t.waveStarts[0] - (6 * 0.2 + 2)) < 1e-9);
  assert.ok(Math.abs(t.period - (1 + 3 * 0.1 + 0.5 + 3 * (6 * 0.2 + 2) + 3 * 0.1)) < 1e-9);
});

test('a title with no entrance and no flip, where every letter hops in its own step, is a hop strip', () => {
  const letters = lettersOf(8, 100).map(({ inverted, ...rest }) => rest);
  const css = ransomCss(letters, { entrance: false, hopFollowsFlip: false, waves: 1, hop: 40, rest: 3 });
  assert.doesNotMatch(css, /enter-|flip-|\.twin/);
  for (let i = 0; i < 8; i++) assert.match(css, new RegExp(`@keyframes hop-${i} `), `letter ${i} must hop`);
  const t = ransomTimeline(letters, { entrance: false, hopFollowsFlip: false, waves: 1, rest: 3 });
  assert.ok(Math.abs(t.period - (t.lead + 8 * t.step + 3)) < 1e-9);
  assert.equal(t.hold, 0);
});

test('the hop is cut to the free space above the hopping letters', () => {
  assert.equal(fitHop([{ y: 200 }, { y: 30 }], 70), 29);
  assert.equal(fitHop([{ y: 200 }], 70), 70);
  assert.equal(fitHop([{ y: 0 }], 70), 0);
  assert.equal(fitHop([], 70), 0);
  const css = ransomCss(lettersOf(4, 30), { hop: 70 });
  assert.match(css, /translateY\(-29px\)/);
  assert.doesNotMatch(css, /translateY\(-70px\)/);
  assert.doesNotMatch(ransomCss(lettersOf(4, 0), { hop: 70 }), /@keyframes hop-/);
});

test('a hopping letter that would reach into a named box is an error', () => {
  const letters = lettersOf(4, 200);
  const header = { x: 100, y: 60, w: 300, h: 100 };
  assert.throws(() => assertHopsClearOf({ header }, letters, { hop: 70 }), /letter 1 hops into "header"/);
  assert.doesNotThrow(() => assertHopsClearOf({ header }, letters, { hop: 30 }));
  assert.doesNotThrow(() => assertHopsClearOf({ header: { x: 2000, y: 60, w: 50, h: 100 } }, letters, { hop: 70 }));
  assert.throws(() => assertHopsClearOf({ header: { x: 0, y: 0, w: 0, h: 0 } }, letters), /missing or empty/);
});

// The animated title, played.

test('the animated title plays: bare, the entrance, in place, a flip and a hop, and reduced motion shows the finished title', async () => {
  const { svg, still, letters } = await exampleTitleBuild();
  const t = ransomTimeline(letters, ransomMotion);
  const { width, height } = await decodeGrayPng(still);
  const half = t.waveStarts[0];
  const times = [0.1, t.lead + 0.01, t.inPlace + 0.05, half + 2.5 * t.step, t.period - 0.01];
  const [bare, lone, placed, mid, ending] = (await svgFramesAt(svg, times, { width, height })).map((f) => sharp(f));
  const [reduced] = (await svgFramesAt(svg, [0.1], { width, height }, { reducedMotion: true })).map((f) => sharp(f));
  const raw = async (/** @type {import('sharp').Sharp} */ s) => (await s.clone().ensureAlpha().raw().toBuffer());
  const differing = async (/** @type {import('sharp').Sharp} */ a, /** @type {import('sharp').Sharp} */ b) => {
    const [x, y] = [await raw(a), await raw(b)];
    let n = 0;
    for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i]) n++;
    return n;
  };
  const total = width * height;
  const stillImage = sharp(still);
  assert.ok((await differing(bare, stillImage)) > 5000, 'at the start only the paper shows');
  assert.ok((await differing(bare, lone)) > 200, 'one letter shows in the first step');
  assert.ok((await differing(bare, lone)) < (await differing(bare, placed)) / 4, 'the lone letter is much smaller than the whole title');
  assert.ok((await differing(placed, stillImage)) < total * 0.0005, 'in place the frames show the still');
  assert.ok((await differing(reduced, stillImage)) < total * 0.0005, 'with reduced motion the title stands still, in place');
  assert.ok((await differing(mid, placed)) > 500, 'a flip and a hop change the title');
  assert.ok((await differing(ending, lone)) < total * 0.0005, 'the fan in ends on the lone letter, as the fan out begins');
});

// The page parts and their random streams.

test('the streams and the noise of the page parts are the streams and the noise of the core', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, 'test/packs/zine/fixtures/blank.html')).href);
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    const seen = await page.evaluate(() => {
      const z = /** @type {any} */ (window).zine;
      return {
        draws: [z.stream(7, 'wear.patch', 3), z.stream(123456789, 'paper.edge.top.0', 0), z.stream(0, 'x', 1000)].map((r) => Array.from({ length: 5 }, () => r())),
        key: z.key(42, 'burn.big'),
        noise: [[0, 0], [13.5, 7.25], [300, 410]].map(([x, y]) => z.noise(z.key(42, 'burn.big'), 75)(x, y)),
      };
    });
    const core = (/** @type {number} */ seed, /** @type {string} */ name, /** @type {number} */ index) => {
      const r = createStreams(seed).stream(name, index);
      return Array.from({ length: 5 }, () => r());
    };
    assert.deepEqual(seen.draws, [core(7, 'wear.patch', 3), core(123456789, 'paper.edge.top.0', 0), core(0, 'x', 1000)]);
    assert.equal(seen.key, createStreams(42).key('burn.big'));
    const field = noiseField(320, 420, 75, createStreams(42).key('burn.big'));
    assert.ok(Math.abs(seen.noise[0] - field[0]) < 1e-5);
    assert.ok(Math.abs(seen.noise[2] - field[410 * 320 + 300]) < 1e-5);
  } finally {
    await browser.close();
  }
});

test('ink that wears off a stamp: a keep-out box changes only the patches near it', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, 'test/packs/zine/fixtures/blank.html')).href);
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    const [free, kept] = await page.evaluate(() => {
      const z = /** @type {any} */ (window).zine;
      return [undefined, { x: 150, y: 50, w: 100, h: 60 }].map((box) => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:160px';
        document.body.appendChild(el);
        z.wear(el, { seed: 12, patches: 120, scratches: 0, size: 5, keepOut: box ? [box] : [] });
        return el.style.maskImage.slice(5, -2);
      });
    });
    const alphaOf = async (/** @type {string} */ uri) => (await sharp(Buffer.from(uri.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer());
    const [a, b] = [await alphaOf(free), await alphaOf(kept)];
    let inside = 0;
    let outside = 0;
    for (let i = 0; i < a.length / 4; i++) {
      if (a[i * 4 + 3] === b[i * 4 + 3]) continue;
      const x = i % 400;
      const y = Math.floor(i / 400);
      // A patch is skipped when its centre lies within 1.45 radii of the box and its shape reaches 1.45 radii from the centre. The radius is at most 11.
      const m = 33;
      const near = x >= 150 - m && x < 250 + m && y >= 50 - m && y < 110 + m;
      if (near) inside++;
      else outside++;
    }
    assert.ok(inside > 0, 'the box must keep some patches out');
    assert.equal(outside, 0, 'a patch that is skipped must not move any other patch');
  } finally {
    await browser.close();
  }
});

test('the look of one ransom letter does not change when another letter changes', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, 'test/packs/zine/fixtures/blank.html')).href);
    await page.waitForSelector('body[data-ready]', { state: 'attached' });
    const [a, b, c] = await page.evaluate(() => {
      const z = /** @type {any} */ (window).zine;
      return ['paste', 'pasta', 'paste'].map((text) => z.ransomLetters(text, { seed: 9 }));
    });
    assert.deepEqual(a.slice(0, 4), b.slice(0, 4));
    assert.notDeepEqual(a[4], b[4]);
    assert.deepEqual(a, c);
    assert.equal(a.length, 5);
    const spaced = await page.evaluate(() => /** @type {any} */ (window).zine.ransomLetters('a b', { seed: 9, gap: -12, wordGap: 40 }));
    assert.equal(spaced.length, 2);
    assert.equal(spaced[0].gap, 28);
  } finally {
    await browser.close();
  }
});

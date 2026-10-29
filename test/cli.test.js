// The command-line tool, run as a program the way a user runs it: `printshop build`, `printshop new-style` and `printshop ref frames|register|trace`.
// The tests that need ffmpeg use the program that the FFMPEG environment variable names, or `ffmpeg` on PATH, and skip with a message if there is none.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { assertMatchesGolden } from '../src/core/golden.js';
import { fractalField } from '../src/core/noise.js';
import { checkAnimatedSvg } from '../packs/zine/checks.js';
import { findFfmpeg } from '../src/core/ref/ffmpeg.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = path.join(root, 'bin/printshop.js');
const run = promisify(execFile);

/** Zine pages are stored pixel for pixel; the collage has its own tolerance. */
const EXACT = { share: 0, window: 16, inWindow: 0 };

/**
 * Runs the tool as a child process.
 * @param {string[]} args
 * @param {{ cwd: string, env?: Record<string, string | undefined> }} options `env` replaces the environment of the parent when given.
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
async function printshop(args, { cwd, env }) {
  const childEnv = { ...(env ?? process.env) };
  // A test run inside `node --test` must not make a nested `node --test` report as a child of it.
  delete childEnv.NODE_TEST_CONTEXT;
  try {
    const { stdout, stderr } = await run(process.execPath, [bin, ...args], { cwd, env: childEnv, maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = /** @type {{ code?: number, stdout?: string, stderr?: string }} */ (error);
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

/** @type {string} */
let work;
before(async () => {
  work = await mkdtemp(path.join(os.tmpdir(), 'printshop-cli-'));
});
after(async () => {
  await rm(work, { recursive: true, force: true });
});

const ffmpeg = await findFfmpeg().catch(() => null);
const NO_FFMPEG = 'ffmpeg not found: set FFMPEG to the ffmpeg program, or put ffmpeg on PATH, to run this test';

test('the tool shows its help and the version, and a wrong call gives exit code 2', async () => {
  const help = await printshop(['--help'], { cwd: work });
  assert.equal(help.code, 0);
  for (const word of ['build', 'new-style', 'ref']) assert.match(help.stdout, new RegExp(word));
  const version = await printshop(['--version'], { cwd: work });
  assert.equal(version.stdout.trim(), JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  const none = await printshop([], { cwd: work });
  assert.equal(none.code, 2);
  const unknown = await printshop(['paint'], { cwd: work });
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /unknown command "paint"/);
  const option = await printshop(['build', '--colour', 'x'], { cwd: work });
  assert.equal(option.code, 2);
  assert.match(option.stderr, /Unknown option/);
  for (const command of ['build', 'new-style', 'ref']) assert.equal((await printshop([command, '--help'], { cwd: work })).code, 0);
  for (const tool of ['frames', 'register', 'trace']) assert.match((await printshop(['ref', tool, '--help'], { cwd: work })).stdout, new RegExp(`printshop ref ${tool}`));
});

test('build: an HTML layout of a pack example gives the zine page of its golden image', async () => {
  const out = path.join(work, 'page');
  const r = await printshop(['build', 'examples/zine-page/page.html', '--out', out], { cwd: root });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /checks: \d+ of \d+ ok/);
  await assertMatchesGolden(await readFile(`${out}.png`), path.join(root, 'examples/zine-page/page.png'), { update: false, tolerance: EXACT, name: 'zine page' });
});

test('build: the animated ransom title writes the svg and the still, and takes options', async () => {
  const out = path.join(work, 'title');
  const r = await printshop(['build', 'examples/ransom-title/title.html', '--out', out], { cwd: root });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  await assertMatchesGolden(await readFile(`${out}-still.png`), path.join(root, 'examples/ransom-title/title-still.png'), { update: false, tolerance: EXACT, name: 'ransom title still' });
  const svg = await readFile(`${out}.svg`, 'utf8');
  assert.ok(checkAnimatedSvg('title', svg).every((c) => c.ok));
  assert.match(svg, /aria-label="Paste up, a title cut from magazine letters on a burnt photocopied sheet"/);
  // An option of the kind reaches the build: the label of the title.
  const labelled = path.join(work, 'labelled');
  const l = await printshop(['build', 'examples/ransom-title/title.html', '--out', labelled, '--option', 'label=Another label'], { cwd: root });
  assert.equal(l.code, 0, l.stderr);
  assert.match(await readFile(`${labelled}.svg`, 'utf8'), /aria-label="Another label"/);
});

test('build: a layout made in code builds from its layout file and from its build module, and runs the collage checks', async () => {
  const golden = path.join(root, 'examples/collage/collage.png');
  for (const input of ['examples/collage/scene.js', 'examples/collage/build.js']) {
    const out = path.join(work, `collage-${path.basename(input, '.js')}`);
    const r = await printshop(['build', input, '--out', out, '--verbose'], { cwd: root });
    assert.equal(r.code, 0, r.stderr + r.stdout);
    for (const check of ['hidden marks', 'collage coverage', 'collage size']) assert.match(r.stdout, new RegExp(`ok   ${check}:`));
    await assertMatchesGolden(await readFile(`${out}.png`), golden, { update: false, name: input });
  }
  // The seed comes from the command line. Another seed is another collage, and the checks may or may not pass for it.
  const seeded = path.join(work, 'collage-seed');
  assert.ok([0, 1].includes((await printshop(['build', 'examples/collage/scene.js', '--out', seeded, '--seed', '305'], { cwd: root })).code));
  assert.notDeepEqual(await readFile(`${seeded}.png`), await readFile(`${path.join(work, 'collage-scene')}.png`));
});

test('build: an HTML layout that no pack names is printed through the filters of the pack that --pack names', async () => {
  const project = await mkdtemp(path.join(work, 'plain-'));
  await writeFile(path.join(project, 'layout.html'), '<!doctype html><body><div id="page" style="width:100%;height:120px;background:linear-gradient(90deg,#000,#fff)"></div><script>document.body.setAttribute("data-ready","")</script></body>');
  const out = path.join(project, 'result');
  const r = await printshop(['build', 'layout.html', '--pack', 'collage', '--out', out], { cwd: project });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const info = await sharp(await readFile(`${out}.png`)).metadata();
  assert.deepEqual([info.width, info.height], [800, 120]);
  const same = await printshop(['build', 'layout.html', '--pack', 'collage', '--out', out, '--seed', '5'], { cwd: project });
  assert.equal(same.code, 0);
});

test('build: a wrong call gives a message and a failure, and nothing replaces a golden image', async () => {
  const missing = await printshop(['build', 'nothing.html'], { cwd: work });
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /no such file: nothing\.html/);
  assert.equal((await printshop(['build'], { cwd: work })).code, 2);
  const pack = await printshop(['build', 'examples/zine-page/page.html', '--pack', 'nope', '--out', path.join(work, 'x')], { cwd: root });
  assert.equal(pack.code, 1);
  assert.match(pack.stderr, /no pack named "nope" \(known packs: .*zine/);
  const kind = await printshop(['build', 'examples/zine-page/page.html', '--kind', 'poster', '--out', path.join(work, 'x')], { cwd: root });
  assert.equal(kind.code, 1);
  assert.match(kind.stderr, /no build for the kind "poster"/);
  const preset = await printshop(['build', 'examples/zine-page/page.html', '--preset', 'poster', '--out', path.join(work, 'x')], { cwd: root });
  assert.equal(preset.code, 1);
  assert.match(preset.stderr, /unknown preset "poster"/);
  assert.equal((await printshop(['build', 'examples/zine-page/page.html', '--seed', 'x'], { cwd: root })).code, 2);
  const module = await printshop(['build', 'src/core/seed.js', '--out', path.join(work, 'x')], { cwd: root });
  assert.equal(module.code, 1);
  assert.match(module.stderr, /must export a function as its default/);

  const goldens = ['examples/zine-page/page.png', 'examples/ransom-title/title-still.png', 'examples/ransom-title/title.svg', 'examples/collage/collage.png'];
  const before = await Promise.all(goldens.map((g) => readFile(path.join(root, g))));
  for (const [input, golden] of [['examples/zine-page/page.html', goldens[0]], ['examples/ransom-title/title.html', goldens[2]], ['examples/collage/scene.js', goldens[3]]]) {
    const r = await printshop(['build', input, '--out', golden], { cwd: root });
    assert.equal(r.code, 1, `${input} -> ${golden}`);
    assert.match(r.stderr, /refusing to write over the golden image/);
  }
  assert.deepEqual(await Promise.all(goldens.map((g) => readFile(path.join(root, g)))), before);
});

test('new-style: a new pack builds its example and passes its own test out of the box', async () => {
  // A project that has printshop as a dependency: node_modules/@tranbao0/printshop is the package.
  const project = await mkdtemp(path.join(work, 'project-'));
  await mkdir(path.join(project, 'node_modules/@tranbao0'), { recursive: true });
  await symlink(root, path.join(project, 'node_modules/@tranbao0/printshop'), 'junction');

  const made = await printshop(['new-style', 'riso-test'], { cwd: project });
  assert.equal(made.code, 0, made.stderr);
  assert.match(made.stdout, /created packs[\\/]riso-test/);
  for (const file of ['index.js', 'filter.js', 'README.md', 'pack.test.js', 'example/page.html', 'example/page.png']) await access(path.join(project, 'packs/riso-test', file));
  const index = await readFile(path.join(project, 'packs/riso-test/index.js'), 'utf8');
  assert.match(index, /name: 'riso-test'/);
  assert.doesNotMatch(index, /__PACK_NAME__/);
  assert.doesNotMatch(await readFile(path.join(project, 'packs/riso-test/README.md'), 'utf8'), /__PACK_NAME__/);

  const built = await printshop(['build', 'packs/riso-test/example/page.html', '--out', path.join(project, 'out/riso')], { cwd: project });
  assert.equal(built.code, 0, built.stderr + built.stdout);
  await assertMatchesGolden(await readFile(path.join(project, 'out/riso.png')), path.join(project, 'packs/riso-test/example/page.png'), { update: false, tolerance: EXACT, name: 'riso-test example' });

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.UPDATE_GOLDENS;
  const tested = await run(process.execPath, ['--test', 'packs/riso-test/pack.test.js'], { cwd: project, env }).catch((e) => e);
  assert.equal(tested.code ?? 0, 0, `the test of the new pack failed:\n${tested.stdout}\n${tested.stderr}`);
  assert.match(tested.stdout, /pass 3/);

  // The pack is found by its name in ./packs, and a second pack of the same name is refused.
  assert.equal((await printshop(['build', 'packs/riso-test/example/page.html', '--pack', 'riso-test', '--out', path.join(project, 'out/again')], { cwd: project })).code, 0);
  const again = await printshop(['new-style', 'riso-test'], { cwd: project });
  assert.equal(again.code, 1);
  assert.match(again.stderr, /already exists/);

  // A failed check of the pack gives the exit code 1, and the image is still written.
  const indexFile = path.join(project, 'packs/riso-test/index.js');
  await writeFile(indexFile, (await readFile(indexFile, 'utf8')).replace('60 * 1024', '10'));
  const failing = await printshop(['build', 'packs/riso-test/example/page.html', '--out', path.join(project, 'out/failing')], { cwd: project });
  assert.equal(failing.code, 1);
  assert.match(failing.stdout, /FAIL png size/);
  assert.match(failing.stderr, /1 check failed/);
  await access(path.join(project, 'out/failing.png'));
});

test('new-style: bad names and the folder option', async () => {
  for (const name of ['Riso', 'riso_test', '1riso', 'riso--test', 'riso-', '../riso']) {
    const r = await printshop(['new-style', name], { cwd: work });
    assert.equal(r.code, 2, name);
    assert.match(r.stderr, /is not a good pack name/);
  }
  assert.equal((await printshop(['new-style'], { cwd: work })).code, 2);
  const zine = await printshop(['new-style', 'zine'], { cwd: work });
  assert.equal(zine.code, 1);
  assert.match(zine.stderr, /already ships with printshop/);
  const project = await mkdtemp(path.join(work, 'dir-'));
  const r = await printshop(['new-style', 'tag-test', '--dir', project], { cwd: work });
  assert.equal(r.code, 0, r.stderr);
  await access(path.join(project, 'packs/tag-test/index.js'));
});

test('ref frames: without ffmpeg it says so and exits with 1', async () => {
  const empty = await mkdtemp(path.join(work, 'empty-'));
  const noPath = await printshop(['ref', 'frames', 'clip.mp4'], { cwd: work, env: { PATH: empty } });
  assert.equal(noPath.code, 1);
  assert.match(noPath.stderr, /ffmpeg not found.*PATH.*FFMPEG/);
  const wrong = await printshop(['ref', 'frames', 'clip.mp4'], { cwd: work, env: { PATH: empty, FFMPEG: path.join(empty, 'ffmpeg') } });
  assert.equal(wrong.code, 1);
  assert.match(wrong.stderr, /FFMPEG environment variable.*not an executable file/);
});

test('ref frames: a frame sheet from a short video, with the frame numbers', { skip: ffmpeg ? false : NO_FFMPEG }, async () => {
  const env = { ...process.env, FFMPEG: /** @type {string} */ (ffmpeg) };
  const clip = path.join(work, 'clip.mp4');
  await run(/** @type {string} */ (ffmpeg), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10', '-c:v', 'mpeg4', '-q:v', '3', clip]);
  const sheet = path.join(work, 'sheet.png');
  const r = await printshop(['ref', 'frames', clip, '--every', '3', '--cols', '4', '--width', '160', '--out', sheet], { cwd: work, env });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /frames: #0 #3 #6 #9 #12 #15 #18/);
  const { data, info } = await sharp(sheet).raw().toBuffer({ resolveWithObject: true });
  // 7 thumbnails of 160x120 in 4 columns and 2 rows, each with a label strip above it.
  const label = info.height / 2 - 120;
  assert.equal(info.width, 640);
  assert.equal(info.height, 2 * (120 + label));
  assert.ok(label >= 10 && label <= 30, `a label strip of ${label} px`);
  // The label of the first thumbnail has black pixels (the text), and the label strip has no colour but black and white.
  let ink = 0;
  for (let y = 0; y < label; y++) for (let x = 0; x < 160; x++) if (data[(y * info.width + x) * info.channels] === 0) ink++;
  assert.ok(ink > 40, `the label has ${ink} black pixels`);

  const picked = await printshop(['ref', 'frames', clip, '--frames', '2,7', '--out', sheet], { cwd: work, env });
  assert.equal(picked.code, 0, picked.stderr);
  assert.match(picked.stdout, /frames: #2 #7\b/);
  assert.equal((await sharp(sheet).metadata()).width, 640);

  const missing = await printshop(['ref', 'frames', clip, '--frames', '99'], { cwd: work, env });
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /there is no frame 99/);
  const notVideo = path.join(work, 'not-a-video.mp4');
  await writeFile(notVideo, 'text');
  const bad = await printshop(['ref', 'frames', notVideo], { cwd: work, env });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /ffmpeg could not read video frames/);
  assert.equal((await printshop(['ref', 'frames', path.join(work, 'none.mp4')], { cwd: work, env })).code, 1);
});

/** A gray image of smooth noise, and a screenshot of it: scaled, moved, on a white page with a red line and a label strip. */
async function syntheticPair() {
  const size = 400;
  const field = fractalField(size, size, [[40, 0.6], [12, 0.4]], 12345);
  const raw = Buffer.alloc(size * size);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.round(255 * Math.min(1, Math.max(0, (field[i] - 0.5) * 2.2 + 0.5)));
  const image = await sharp(raw, { raw: { width: size, height: size, channels: 1 } }).png().toBuffer();
  const small = await sharp(image).resize(320, 320).png().toBuffer();
  const overlay = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="420"><path d="M60 80 L300 200 L420 120" stroke="#e61b1b" stroke-width="6" fill="none"/><rect x="0" y="396" width="480" height="24" fill="#ddd"/></svg>');
  const screenshot = await sharp({ create: { width: 480, height: 420, channels: 3, background: '#ffffff' } }).composite([{ input: small, left: 77, top: 31 }, { input: overlay }]).png().toBuffer();
  return { image, screenshot, truth: { sx: 0.8, sy: 0.8, ox: 77, oy: 31 } };
}

test('ref register and ref trace: the scale and offset of a screenshot, and the red line in image coordinates', async () => {
  const { image, screenshot, truth } = await syntheticPair();
  const dir = await mkdtemp(path.join(work, 'ref-'));
  await writeFile(path.join(dir, 'image.png'), image);
  await writeFile(path.join(dir, 'shot.png'), screenshot);

  const reg = await printshop(['ref', 'register', 'shot.png', 'image.png', '--margin', '6,6,26,6', '--out', 'fit.json'], { cwd: dir });
  assert.equal(reg.code, 0, reg.stderr);
  const fit = JSON.parse(await readFile(path.join(dir, 'fit.json'), 'utf8'));
  for (const key of /** @type {const} */ (['sx', 'sy', 'ox', 'oy'])) assert.ok(Math.abs(fit[key] - truth[key]) < (key[0] === 's' ? 0.002 : 0.3), `${key} is ${fit[key]}, not ${truth[key]}`);
  assert.ok(fit.score > 0.99);
  assert.deepEqual(fit.screenshot, { width: 480, height: 420 });

  // Without --out the JSON goes to standard output. --free-aspect fits both scales.
  const printed = await printshop(['ref', 'register', 'shot.png', 'image.png', '--margin', '6,6,26,6', '--free-aspect'], { cwd: dir });
  const free = JSON.parse(printed.stdout);
  assert.ok(Math.abs(free.sx - 0.8) < 0.002 && Math.abs(free.sy - 0.8) < 0.002);

  const traced = await printshop(['ref', 'trace', 'shot.png', '--fit', 'fit.json', '--image', 'image.png', '--overlay', 'overlay.png', '--out', 'marks.json'], { cwd: dir });
  assert.equal(traced.code, 0, traced.stderr);
  const { marks } = JSON.parse(await readFile(path.join(dir, 'marks.json'), 'utf8'));
  assert.equal(marks.length, 1, 'one red line; the gray label strip is no mark');
  const [first, last] = [marks[0].path[0], marks[0].path[marks[0].path.length - 1]];
  // The line runs from (60, 80) to (300, 200) to (420, 120) in the screenshot. In the image that is the map of these points.
  const toImage = (/** @type {number} */ x, /** @type {number} */ y) => [(x - truth.ox) / truth.sx, (y - truth.oy) / truth.sy];
  const [a, b] = [toImage(60, 80), toImage(420, 120)];
  assert.ok(Math.hypot(first[0] - a[0], first[1] - a[1]) < 8, `the line starts at ${first}, near ${a}`);
  assert.ok(Math.hypot(last[0] - b[0], last[1] - b[1]) < 8, `the line ends at ${last}, near ${b}`);
  const overlay = await sharp(path.join(dir, 'overlay.png')).metadata();
  assert.deepEqual([overlay.width, overlay.height], [400, 400]);

  const none = await printshop(['ref', 'trace', 'shot.png', '--fit', 'fit.json', '--colour', 'blue'], { cwd: dir });
  assert.equal(none.code, 0);
  assert.deepEqual(JSON.parse(none.stdout).marks, []);
  assert.match(none.stderr, /no marks of this colour/);
  const points = await printshop(['ref', 'trace', 'shot.png', '--fit', 'fit.json', '--points'], { cwd: dir });
  assert.equal(JSON.parse(points.stdout).marks[0].points.length, marks[0].pixels);
});

test('ref register and ref trace: wrong calls and a screenshot that does not show the image', async () => {
  const { image, screenshot } = await syntheticPair();
  const dir = await mkdtemp(path.join(work, 'ref-bad-'));
  await writeFile(path.join(dir, 'image.png'), image);
  await writeFile(path.join(dir, 'shot.png'), screenshot);
  // Another picture: the same noise field with another key.
  const field = fractalField(400, 400, [[40, 0.6], [12, 0.4]], 999);
  const raw = Buffer.alloc(400 * 400);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.round(255 * field[i]);
  await sharp(raw, { raw: { width: 400, height: 400, channels: 1 } }).png().toFile(path.join(dir, 'other.png'));
  const poor = await printshop(['ref', 'register', 'shot.png', 'other.png', '--margin', '6,6,26,6'], { cwd: dir });
  assert.equal(poor.code, 1);
  assert.match(poor.stderr, /no good match/);

  assert.equal((await printshop(['ref', 'register', 'shot.png'], { cwd: dir })).code, 2);
  assert.equal((await printshop(['ref', 'register', 'shot.png', 'nope.png'], { cwd: dir })).code, 1);
  assert.equal((await printshop(['ref', 'register', 'shot.png', 'image.png', '--scale', '1'], { cwd: dir })).code, 2);
  assert.equal((await printshop(['ref', 'register', 'shot.png', 'image.png', '--margin', '1,2'], { cwd: dir })).code, 2);
  assert.equal((await printshop(['ref', 'trace', 'shot.png'], { cwd: dir })).code, 2);
  await writeFile(path.join(dir, 'bad.json'), '{"sx":1}');
  const badFit = await printshop(['ref', 'trace', 'shot.png', '--fit', 'bad.json'], { cwd: dir });
  assert.equal(badFit.code, 1);
  assert.match(badFit.stderr, /has no number "sy"/);
  assert.equal((await printshop(['ref', 'trace', 'shot.png', '--fit', 'bad.json', '--overlay', 'o.png'], { cwd: dir })).code, 2);
  assert.equal((await printshop(['ref', 'paint'], { cwd: dir })).code, 2);
});

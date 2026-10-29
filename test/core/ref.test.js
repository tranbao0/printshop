import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { drawText, textWidth, GLYPH_HEIGHT } from '../../src/core/ref/bitmap-font.js';
import { FfmpegError, findFfmpeg } from '../../src/core/ref/ffmpeg.js';
import { chooseFrames } from '../../src/core/ref/frames.js';
import { grow, shrink } from '../../src/core/ref/raster.js';
import { registerRasters } from '../../src/core/ref/register.js';
import { groupPixels, longestPath, simplifyPath, thin } from '../../src/core/ref/trace.js';
import { fractalField } from '../../src/core/noise.js';

/** A video of `n` frames, one every 100 ms. */
const video = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => ({ n: i, ms: i * 100 }));

test('chooseFrames takes a list, a range or a step, and refuses frames that the video does not have', () => {
  const frames = video(100);
  assert.deepEqual(chooseFrames(frames, { frames: [9, 3, 3] }).map((f) => f.n), [3, 9]);
  assert.deepEqual(chooseFrames(frames, { from: 10, to: 20, every: 5 }).map((f) => f.n), [10, 15, 20]);
  // Without a step, at most `max` frames come out, spread over the range.
  const spread = chooseFrames(frames, { max: 10 });
  assert.ok(spread.length <= 10 && spread[0].n === 0);
  assert.equal(chooseFrames(video(5)).length, 5);
  assert.throws(() => chooseFrames(frames, { frames: [100] }), /there is no frame 100/);
  assert.throws(() => chooseFrames(frames, { from: 50, to: 40 }), /does not fit/);
  assert.throws(() => chooseFrames(frames, { to: 100 }), /does not fit/);
  assert.throws(() => chooseFrames(frames, { every: 0 }), /every/);
});

test('findFfmpeg uses FFMPEG, then PATH, and says what to do when there is none', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'printshop-ffmpeg-'));
  try {
    await assert.rejects(findFfmpeg({ PATH: dir }), (e) => e instanceof FfmpegError && /on PATH, or set the FFMPEG/.test(e.message));
    await assert.rejects(findFfmpeg({ PATH: dir, FFMPEG: path.join(dir, 'missing') }), /not an executable file/);
    const fake = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    await writeFile(fake, '#!/bin/sh\n');
    await chmod(fake, 0o755);
    assert.equal(await findFfmpeg({ PATH: dir }), fake);
    assert.equal(await findFfmpeg({ PATH: '', FFMPEG: fake }), fake);
    if (process.platform !== 'win32') {
      await chmod(fake, 0o644);
      await assert.rejects(findFfmpeg({ PATH: dir }), FfmpegError);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the label font draws the same pixels every time, clips at the edge and shows a text of known width', () => {
  const width = 60;
  const draw = () => {
    const rgb = new Uint8Array(width * 12 * 3).fill(255);
    drawText(rgb, width, '#12 3ms', 1, 1, 1, [0, 0, 0]);
    return rgb;
  };
  const a = draw();
  assert.deepEqual(a, draw());
  assert.ok(a.some((v) => v === 0));
  assert.equal(textWidth('#12 3ms', 1), 7 * 6 - 1);
  assert.equal(textWidth('', 2), 0);
  assert.equal(GLYPH_HEIGHT, 7);
  // Drawing past the edge changes nothing outside the buffer and does not throw.
  const small = new Uint8Array(4 * 4 * 3).fill(255);
  drawText(small, 4, '0000', -3, -2, 2, [0, 0, 0]);
  assert.equal(small.length, 48);
  // Each digit looks different from the others.
  const looks = new Set([...'0123456789'].map((d) => {
    const rgb = new Uint8Array(6 * 7 * 3).fill(255);
    drawText(rgb, 6, d, 0, 0, 1, [0, 0, 0]);
    return Buffer.from(rgb).toString('hex');
  }));
  assert.equal(looks.size, 10);
});

test('grow and shrink', () => {
  const mask = new Uint8Array(7 * 7);
  mask[3 * 7 + 3] = 1;
  const grown = grow(mask, 7, 7, 1);
  assert.equal(grown.reduce((a, b) => a + b, 0), 9);
  assert.deepEqual(Array.from(grow(mask, 7, 7, 0)), Array.from(mask));
  const raster = { width: 4, height: 4, gray: Float32Array.from([0, 0, 100, 100, 0, 0, 100, 100, 50, 50, 200, 200, 50, 50, 200, 200]) };
  const valid = Uint8Array.from({ length: 16 }, (_, i) => (i === 0 ? 0 : 1));
  const small = shrink(raster, valid, 2);
  assert.deepEqual(Array.from(small.gray), [0, 100, 50, 200]);
  assert.deepEqual(Array.from(small.valid ?? []), [0, 1, 1, 1]);
});

test('groupPixels joins pixels within reach, thin leaves a line, longestPath follows it and simplifyPath keeps its corners', () => {
  const w = 40;
  const h = 20;
  const mask = new Uint8Array(w * h);
  // A thick L: a bar across and a bar down, 3 px thick. And a speck far away.
  for (let y = 5; y < 8; y++) for (let x = 5; x < 30; x++) mask[y * w + x] = 1;
  for (let y = 5; y < 17; y++) for (let x = 5; x < 8; x++) mask[y * w + x] = 1;
  mask[18 * w + 38] = 1;
  const groups = groupPixels(mask, w, h, 2);
  assert.deepEqual(groups.map((g) => g.length).sort((a, b) => a - b), [1, 75 + 27]);
  // A gap of two empty pixels joins at reach 3, not at reach 2.
  const gap = new Uint8Array(20);
  gap[2] = 1;
  gap[5] = 1;
  assert.equal(groupPixels(gap, 20, 1, 3).length, 1);
  assert.equal(groupPixels(gap, 20, 1, 2).length, 2);

  const skeleton = Uint8Array.from(mask);
  skeleton[18 * w + 38] = 0;
  thin(skeleton, w, h);
  const left = skeleton.reduce((a, b) => a + b, 0);
  assert.ok(left > 20 && left < 60, `the skeleton has ${left} pixels`);
  const path = longestPath(skeleton, w, h);
  assert.ok(path.length >= 25);
  const ends = [path[0], path[path.length - 1]].sort((a, b) => a[1] - b[1]);
  assert.ok(ends[0][0] >= 25 && ends[0][1] <= 8, `one end is at the far end of the bar: ${ends[0]}`);
  assert.ok(ends[1][0] <= 8 && ends[1][1] >= 14, `the other end is at the foot of the post: ${ends[1]}`);
  const simple = simplifyPath(path, 2);
  assert.ok(simple.length >= 3 && simple.length <= 5, `${simple.length} points`);
  assert.deepEqual(longestPath(new Uint8Array(9), 3, 3), []);
  assert.deepEqual(simplifyPath([[0, 0], [1, 0.1], [2, 0]], 1), [[0, 0], [2, 0]]);
});

test('registerRasters finds the scale and the offset, with marks and a label strip left out, also for another scale per axis', () => {
  const size = 300;
  const field = fractalField(size, size, [[30, 0.6], [9, 0.4]], 4242);
  const image = { width: size, height: size, gray: Float32Array.from(field, (v) => Math.min(255, Math.max(0, ((v - 0.5) * 2.2 + 0.5) * 255))) };
  // A screenshot made by sampling the image: scale (0.7, 0.9) and offset (31.5, 18.25).
  const truth = { sx: 0.7, sy: 0.9, ox: 31.5, oy: 18.25 };
  const width = 300;
  const height = 330;
  const gray = new Float32Array(width * height).fill(255);
  const valid = new Uint8Array(width * height).fill(1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ax = (x + 0.5 - truth.ox) / truth.sx - 0.5;
      const ay = (y + 0.5 - truth.oy) / truth.sy - 0.5;
      if (ax < 0 || ay < 0 || ax > size - 1.001 || ay > size - 1.001) continue;
      const x0 = Math.floor(ax);
      const y0 = Math.floor(ay);
      const fx = ax - x0;
      const fy = ay - y0;
      const g = image.gray;
      gray[y * width + x] = g[y0 * size + x0] * (1 - fx) * (1 - fy) + g[y0 * size + x0 + 1] * fx * (1 - fy) + g[(y0 + 1) * size + x0] * (1 - fx) * fy + g[(y0 + 1) * size + x0 + 1] * fx * fy;
    }
  }
  // Pixels that are left out, as a mark and a label strip would be.
  for (let y = 100; y < 110; y++) for (let x = 20; x < 280; x++) valid[y * width + x] = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (y < 6 || y >= height - 30 || x < 6 || x >= width - 6) valid[y * width + x] = 0;
  for (let y = 100; y < 110; y++) for (let x = 20; x < 280; x++) gray[y * width + x] = 0;

  const found = registerRasters({ width, height, gray, valid }, image, { freeAspect: true });
  assert.ok(Math.abs(found.sx - truth.sx) < 0.003, `sx ${found.sx}`);
  assert.ok(Math.abs(found.sy - truth.sy) < 0.003, `sy ${found.sy}`);
  assert.ok(Math.abs(found.ox - truth.ox) < 0.4, `ox ${found.ox}`);
  assert.ok(Math.abs(found.oy - truth.oy) < 0.4, `oy ${found.oy}`);
  assert.ok(found.score > 0.99);
  assert.throws(() => registerRasters({ width, height, gray, valid }, image, { scale: [2, 1] }), /scale range/);
});

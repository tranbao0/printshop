import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { REDUCED_MOTION_CSS, STEP, letterTiles, pct, pulseKeyframes, sec, svgDocument, waveKeyframes } from '../../src/core/svg-anim.js';

// A 1 x 1 PNG.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const letters = [0, 1, 2].map((i) => ({ normal: png, inverted: i === 1 ? undefined : png, x: 10 + i * 30, y: 5, width: 20, height: 40 }));

// The stored strings are the reference output of the helpers for this input.
const golden = JSON.parse(await readFile(fileURLToPath(new URL('./fixtures/svg-anim.json', import.meta.url)), 'utf8'));

test('the helpers give the stored reference strings', () => {
  assert.deepEqual([0, 0.5, 0.123456789, 1].map(pct), golden.pct);
  assert.deepEqual([0, 0.0833333, 2.5].map(sec), golden.sec);
  assert.equal(pulseKeyframes('p', [[0, 0.5], [1, 1.5]], 5, 'opacity: 1;', 'opacity: 0;'), golden.pulse);
  assert.equal(pulseKeyframes('p', [[0.2, 0.5]], 5, 'opacity: 1;', 'opacity: 0;'), golden.pulse2);
  assert.equal(waveKeyframes('w', 3, 6, 'transform: none;', 'opacity: 0;'), golden.wave);
  assert.equal(STEP, golden.step);
  assert.equal(REDUCED_MOTION_CSS, golden.reduced);
  assert.equal(letterTiles(letters), golden.tiles);
  assert.equal(svgDocument({ width: 100, height: 50, label: 'a label', css: '#l0 { opacity: 1; }', base: png, tiles: letterTiles(letters) }), golden.doc);
});

test('a pulse holds the on state during the pulse and the off state the rest of the period', () => {
  assert.equal(pulseKeyframes('x', [[1, 2]], 10, 'a: 1;', 'a: 0;'), '@keyframes x { 0% { a: 0; } 10% { a: 1; } 20% { a: 0; } 100% { a: 0; } }');
  assert.equal(pulseKeyframes('x', [[0, 2]], 10, 'a: 1;', 'a: 0;'), '@keyframes x { 0% { a: 1; } 20% { a: 0; } 100% { a: 0; } }');
});

test('a wave turns item i on for one step, at the step length given', () => {
  assert.equal(waveKeyframes('x', 2, 1, 'a: 1;', 'a: 0;', 0.1), '@keyframes x { 0% { a: 0; } 20% { a: 1; } 30% { a: 0; } 100% { a: 0; } }');
});

test('reduced motion switches every animation off', () => {
  assert.match(REDUCED_MOTION_CSS, /prefers-reduced-motion: reduce[^}]*\{\s*\* \{ animation: none !important; \}/);
});

test('the tile groups are numbered from zero and a twin shares the place of its tile', () => {
  const svg = letterTiles(letters);
  assert.deepEqual([...svg.matchAll(/<g id="(l\d+)" class="letter">/g)].map((m) => m[1]), ['l0', 'l1', 'l2']);
  const places = [...svg.matchAll(/<image (?:class="twin" )?(x="\d+" y="\d+" width="\d+" height="\d+")/g)].map((m) => m[1]);
  assert.equal(places.length, 5);
  assert.equal(places[0], places[1]);
  assert.equal(places[3], places[4]);
});

test('a document has no script and no external reference', () => {
  const svg = svgDocument({ width: 100, height: 50, label: 'x', css: '', base: png, tiles: letterTiles(letters) });
  assert.doesNotMatch(svg, /<script|onload|http:\/\/(?!www\.w3\.org)|https:\/\//);
  const hrefs = [...svg.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0 && hrefs.every((h) => h.startsWith('data:image/png;base64,')));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="50" viewBox="0 0 100 50" role="img" aria-label="x">/);
});

test('the label is escaped in the attribute', () => {
  const svg = svgDocument({ width: 1, height: 1, label: 'a "b" <c> & d', css: '', base: png, tiles: '' });
  assert.match(svg, /aria-label="a &quot;b&quot; &lt;c&gt; &amp; d"/);
});

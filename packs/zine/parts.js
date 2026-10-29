// Zine parts, drawn in the page: torn and cut paper, tape, track labels, worn ink masks, burnt paper and
// cut-out letter tiles that make a ransom-note title.
// This is a classic script, because headless Chromium blocks ES module imports from file:// pages.
// A page loads it with <script src="parts.js"> and calls window.zine.
//
// Every random draw comes from a named stream. A stream depends only on the part seed, its name and an index, and it uses
// the same hashes as src/core/seed.js and src/core/noise.js, so the pages and the node side agree (a test checks this).
// A change in one part of a page, or to one patch or one letter, does not re-roll the random features of another.
(() => {
  /** @typedef {() => number} Rng */
  /** @typedef {{ x: number, y: number, w: number, h: number }} KeepOut */
  /** @typedef {'torn' | 'cut' | 'clean'} EdgeKind */
  /** @typedef {{ top?: EdgeKind, right?: EdgeKind, bottom?: EdgeKind, left?: EdgeKind }} Sides */

  /** @typedef {object} LetterSpec
   * @property {string} text One glyph.
   * @property {string} font A font family that the page loads.
   * @property {number} heightInk Height of the glyph itself, in pixels, before the title is scaled to fit.
   * @property {string} [fill] Paper colour. Default white.
   * @property {string} [color] Ink colour. Default black.
   * @property {{ fill: string, color: string }} [inverse] The flipped clipping of the same tile: paper and letter swap light and dark.
   * @property {number} [rot] Turn in degrees.
   * @property {number} [dy] Nudge off the baseline, in pixels.
   * @property {number} [gap] Space to the next tile, in pixels. Default 0.
   */

  const layer = new URLSearchParams(location.search).get('layer') || 'all';
  document.documentElement.classList.add(`layer-${layer}`);
  document.body.classList.add(`layer-${layer}`);

  // Streams: the same numbers as createStreams(seed).stream(name, index) in src/core/seed.js.

  /** @param {number} h */
  const mix = (h) => {
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };

  /** @param {string} text */
  const hashName = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };

  /** The 32-bit key of a stream. @param {number} seed @param {string} name @param {number} [index] */
  const key = (seed, name, index = 0) => mix(mix(hashName(name) ^ mix(seed >>> 0)) + Math.imul(index >>> 0, 0x9e3779b1));

  /** @param {number} seed */
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** A fresh stream. @param {number} seed @param {string} name @param {number} [index] @returns {Rng} */
  const stream = (seed, name, index = 0) => rng(key(seed, name, index));

  const smooth = (/** @type {number} */ f) => f * f * (3 - 2 * f);

  // Value noise, the same as latticeValue and noiseField in src/core/noise.js.
  const lattice = (/** @type {number} */ k, /** @type {number} */ gx, /** @type {number} */ gy) =>
    mix(mix(k ^ Math.imul(gx, 0x27d4eb2d)) + Math.imul(gy, 0x165667b1)) / 4294967296;

  /**
   * Smooth noise on a grid of `cell` pixels, in 0..1. The value at a point does not depend on the size of the element.
   * @param {number} k The key of the field.
   * @param {number} cell
   * @returns {(x: number, y: number) => number}
   */
  const noise = (k, cell) => (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const top = lattice(k, ix, iy) * (1 - tx) + lattice(k, ix + 1, iy) * tx;
    const bottom = lattice(k, ix, iy + 1) * (1 - tx) + lattice(k, ix + 1, iy + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  /**
   * 1D smooth noise. `parts` is a list of [cell, amplitude]; the result swings by +/- the sum of amplitudes.
   * The table of part k draws from the stream `<name>.<k>`.
   * @param {number} seed
   * @param {string} name
   * @param {number} length
   * @param {[number, number][]} parts
   * @returns {(t: number) => number}
   */
  const wave = (seed, name, length, parts) => {
    const tables = parts.map(([cell, amp], k) => {
      const rand = stream(seed, `${name}.${k}`);
      return { cell, amp, values: Array.from({ length: Math.ceil(length / cell) + 3 }, rand) };
    });
    return (t) =>
      tables.reduce((sum, { cell, amp, values }) => {
        const x = t / cell;
        const i = Math.floor(x);
        const u = smooth(x - i);
        return sum + amp * 2 * (values[i] * (1 - u) + values[i + 1] * u - 0.5);
      }, 0);
  };

  /** @param {[number, number][]} list */
  const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  /** @type {Record<EdgeKind, { parts: [number, number][], base: number, rim: [number, number], step: [number, number] }>} */
  const EDGE = {
    // parts: size of the tear or cut, rim: width of the pale fibre rim along the tear
    torn: { parts: [[90, 5], [26, 3.5], [7, 2.2]], base: 10.7, rim: [4, 4.5], step: [5, 11] },
    cut: { parts: [[260, 1.6], [50, 0.5]], base: 2.1, rim: [0, 0], step: [60, 90] },
    clean: { parts: [], base: 0, rim: [0, 0], step: [200, 400] },
  };

  /**
   * Outline of a piece of paper. Returns the outer outline and the inner one (outer minus the fibre rim).
   * Each side draws from its own streams: `paper.edge.<side>`, `paper.rim.<side>` and `paper.step.<side>`.
   * @param {number} w
   * @param {number} h
   * @param {Required<Sides>} sides
   * @param {number} seed
   */
  function outline(w, h, sides, seed) {
    /** @type {[number, number][]} */
    const outer = [];
    /** @type {[number, number][]} */
    const inner = [];
    /** @type {{ name: string, kind: EdgeKind, len: number, at: (t: number, o: number) => [number, number] }[]} */
    const runs = [
      { name: 'top', kind: sides.top, len: w, at: (t, o) => [t, o] },
      { name: 'right', kind: sides.right, len: h, at: (t, o) => [w - o, t] },
      { name: 'bottom', kind: sides.bottom, len: w, at: (t, o) => [w - t, h - o] },
      { name: 'left', kind: sides.left, len: h, at: (t, o) => [o, h - t] },
    ];
    for (const { name, kind, len, at } of runs) {
      const spec = EDGE[kind];
      const edge = wave(seed, `paper.edge.${name}`, len, spec.parts);
      const rim = wave(seed, `paper.rim.${name}`, len, [[30, spec.rim[1]], [8, spec.rim[1] * 0.4]]);
      const spacing = stream(seed, `paper.step.${name}`);
      let t = 0;
      while (t < len) {
        const off = Math.max(0, spec.base + edge(t));
        outer.push(at(t, off));
        inner.push(at(t, off + (spec.rim[0] ? Math.max(1.5, spec.rim[0] + rim(t)) : 0)));
        t += spec.step[0] + spacing() * (spec.step[1] - spec.step[0]);
      }
    }
    return { outer, inner };
  }

  /** @param {HTMLElement} el @param {string} svg */
  function addShape(el, svg) {
    el.insertAdjacentHTML('afterbegin', `<svg class="shape" width="${el.offsetWidth}" height="${el.offsetHeight}">${svg}</svg>`);
  }

  /**
   * Paper piece: each side is 'torn', 'cut' or 'clean'.
   * @param {HTMLElement} el
   * @param {{ seed?: number, sides?: Sides, fill?: string, rim?: string, shadow?: { fill: string, x: number, y: number } | null }} [options]
   */
  function paper(el, { seed = 1, sides = {}, fill = '#fff', rim = '#8f8f8f', shadow = null } = {}) {
    el.classList.add('part');
    const { outer, inner } = outline(el.offsetWidth, el.offsetHeight, { top: 'cut', right: 'cut', bottom: 'cut', left: 'cut', ...sides }, seed);
    let svg = '';
    if (shadow) svg += `<polygon points="${pts(outer)}" fill="${shadow.fill}" transform="translate(${shadow.x} ${shadow.y})"/>`;
    svg += `<polygon points="${pts(outer)}" fill="${rim}"/><polygon points="${pts(inner)}" fill="${fill}"/>`;
    addShape(el, svg);
  }

  /**
   * Strip of tape: light gray, slightly see-through, with rough zigzag ends.
   * Streams: `tape.top`, `tape.bottom`, `tape.end.left`, `tape.end.right`.
   * @param {HTMLElement} el
   * @param {{ seed?: number, fill?: string }} [options]
   */
  function tape(el, { seed = 1, fill = 'rgba(214,214,214,0.7)' } = {}) {
    el.classList.add('part');
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const topWave = wave(seed, 'tape.top', w, [[150, 1.6]]);
    const bottomWave = wave(seed, 'tape.bottom', w, [[150, 1.6]]);
    /** @param {string} name @param {number} x0 @param {number} dir */
    const end = (name, x0, dir) => {
      const rand = stream(seed, name);
      /** @type {[number, number][]} */
      const list = [];
      for (let y = 0; y <= h; y += 6 + rand() * 6) list.push([x0 + dir * (3 + rand() * 12), Math.min(y, h)]);
      return list;
    };
    const left = end('tape.end.left', 0, 1).reverse();
    const right = end('tape.end.right', w, -1);
    /** @type {[number, number][]} */
    const top = [];
    for (let x = 0; x <= w; x += 40) top.push([x, 1.5 + topWave(x)]);
    /** @type {[number, number][]} */
    const bottom = [];
    for (let x = w; x >= 0; x -= 40) bottom.push([x, h - 1.5 + bottomWave(x)]);
    addShape(el, `<polygon points="${pts([...top, ...right, ...bottom, ...left])}" fill="${fill}"/>`);
  }

  /**
   * Track label strip: a paler, denser tape than loose tape, so the typewriter letters stay solid on the halftone.
   * @param {HTMLElement} el
   * @param {{ seed?: number }} [options]
   */
  function track(el, { seed = 1 } = {}) {
    tape(el, { seed, fill: 'rgba(222,222,222,0.84)' });
  }

  /**
   * Ink that wears off in small patches and scratches, used as a CSS mask. Patches stay out of the `keepOut` boxes
   * ({ x, y, w, h } in the element's own pixels), so worn ink can leave the lettering of a stamp whole.
   * Patch i draws from the stream `wear.patch` with index i, and a patch takes all its draws whether it lands or not,
   * so a change to `keepOut` leaves every other patch where it was. Scratches use the stream `wear.scratch`.
   * @param {HTMLElement} el
   * @param {{ seed?: number, patches?: number, scratches?: number, size?: number, keepOut?: KeepOut[] }} [options]
   */
  function wear(el, { seed = 1, patches = 70, scratches = 8, size = 5, keepOut = [] } = {}) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < patches; i++) {
      const rand = stream(seed, 'wear.patch', i);
      const x = rand() * w;
      const y = rand() * h;
      const r = 1 + Math.pow(rand(), 2) * size * 2;
      const radii = Array.from({ length: 7 }, () => r * (0.55 + rand() * 0.9));
      const reach = r * 1.45;
      if (keepOut.some((k) => x > k.x - reach && x < k.x + k.w + reach && y > k.y - reach && y < k.y + k.h + reach)) continue;
      ctx.beginPath();
      radii.forEach((rr, k) => {
        const a = (k / 7) * Math.PI * 2;
        if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      });
      ctx.fill();
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#000';
    for (let i = 0; i < scratches; i++) {
      const rand = stream(seed, 'wear.scratch', i);
      ctx.beginPath();
      const x = rand() * w;
      const y = rand() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 120, y + (rand() - 0.5) * 30);
      ctx.stroke();
    }
    const url = `url(${canvas.toDataURL()})`;
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
  }

  // Measures the ink of one string, so tiles can fit tightly around the letters.
  const ruler = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));

  /**
   * The size of the font that makes the ink of `text` `targetHeight` pixels tall, and the box of that ink.
   * @param {string} text
   * @param {string} font
   * @param {number} weight
   * @param {number} targetHeight
   */
  function ink(text, font, weight, targetHeight) {
    ruler.font = `${weight} 100px "${font}"`;
    const probe = ruler.measureText(text);
    const size = (targetHeight / (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent)) * 100;
    ruler.font = `${weight} ${size}px "${font}"`;
    const m = ruler.measureText(text);
    return {
      size,
      left: m.actualBoundingBoxLeft,
      ascent: m.actualBoundingBoxAscent,
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    };
  }

  /**
   * A cut-out tile with one glyph, like a letter in a ransom note. `heightInk` is the height of the glyph itself.
   * @param {HTMLElement} parent
   * @param {{ text: string, font: string, heightInk: number, padX?: number, padY?: number, x: number, y: number, rot?: number,
   *   fill?: string, color?: string, seed?: number, shadow?: boolean, sides?: Sides }} options
   */
  function tile(parent, { text, font, heightInk, padX = 26, padY = 24, x, y, rot = 0, fill = '#fff', color = '#000', seed = 1, shadow = true, sides }) {
    const m = ink(text, font, 400, heightInk);
    const el = document.createElement('div');
    el.className = 'tile';
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${Math.ceil(m.width + padX * 2)}px;height:${Math.ceil(m.height + padY * 2)}px;transform:rotate(${rot}deg)`;
    parent.appendChild(el);
    paper(el, {
      seed,
      sides: sides || { top: 'cut', right: 'cut', bottom: 'cut', left: 'cut' },
      fill,
      rim: fill === '#fff' ? '#8f8f8f' : fill,
      shadow: shadow ? { fill: '#555', x: 7, y: 8 } : null,
    });
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(padX + m.left));
    label.setAttribute('y', String(padY + m.ascent));
    label.setAttribute('font-family', font);
    label.setAttribute('font-size', String(m.size));
    label.setAttribute('fill', color);
    label.textContent = text;
    /** @type {SVGElement} */ (el.querySelector('svg.shape')).appendChild(label);
    return el;
  }

  /**
   * Lays out the letters of a title as cut-out tiles, left to right on one baseline, like a ransom note.
   * The tiles are scaled together so that the whole row is `fit` pixels wide (if given).
   * Tile i is the element `data-box="tile-<i>"`, so a build can read its box.
   * The page query `?letter=N` keeps only tile N and `?inverted=1` shows the flipped clipping. The layout always runs over every tile,
   * so a single tile sits exactly where it sits in the whole title.
   * Streams: the paper of tile i uses the stream seed `ransom.tile` with index i.
   * @param {HTMLElement} parent
   * @param {{ letters: LetterSpec[], baseline: number, left?: number, fit?: number, padX?: number, padY?: number, seed?: number,
   *   only?: number | null, flipped?: boolean }} options
   */
  function ransom(parent, { letters, baseline, left = 0, fit, padX = 12, padY = 18, seed = 1, only, flipped }) {
    const query = new URLSearchParams(location.search);
    only ??= query.has('letter') ? Number(query.get('letter')) : null;
    flipped ??= query.get('inverted') === '1';
    const glyphWidth = letters.reduce((sum, l) => sum + ink(l.text, l.font, 400, l.heightInk).width, 0);
    const fixed = letters.reduce((sum, l, i) => sum + padX * 2 + (i < letters.length - 1 ? (l.gap ?? 0) : 0), 0);
    const scale = fit === undefined ? 1 : (fit - fixed) / glyphWidth;
    let x = left;
    const tiles = letters.map((l, i) => {
      const look = flipped && l.inverse ? { ...l, ...l.inverse } : l;
      const el = tile(parent, {
        text: look.text,
        font: look.font,
        fill: look.fill,
        color: look.color,
        rot: look.rot,
        heightInk: l.heightInk * scale,
        padX,
        padY,
        x,
        y: 0,
        seed: key(seed, 'ransom.tile', i),
      });
      el.dataset.box = `tile-${i}`;
      el.style.top = `${baseline + (l.dy ?? 0) - (el.offsetHeight - padY)}px`;
      x += el.offsetWidth + (l.gap ?? 0);
      if (only !== null && only !== i) el.remove();
      return el;
    });
    return { scale, tiles };
  }

  /** @typedef {{ fill: string, color: string, inverse: { fill: string, color: string } }} Tone Paper and ink colours of a tile, and of its flipped clipping. */

  /** @type {Tone[]} */
  const TONES = [
    { fill: '#fff', color: '#000', inverse: { fill: '#000', color: '#fff' } },
    { fill: '#000', color: '#fff', inverse: { fill: '#fff', color: '#000' } },
    { fill: '#8f8f8f', color: '#000', inverse: { fill: '#6e6e6e', color: '#fff' } },
  ];
  const FONTS = ['Anton', 'Alfa Slab One', 'Archivo Black', 'Rubik Mono One'];
  const TALL = /[A-Z0-9bdfhkl]/;

  /**
   * Makes the letter specs for a string: a font, a paper tone, a turn and a nudge for each letter, drawn from the stream
   * `ransom.letter` with the index of the letter, so changing one letter does not change the look of another.
   * A space widens the gap after the letter before it.
   * @param {string} text
   * @param {{ seed?: number, fonts?: string[], tones?: Tone[],
   *   tall?: number, short?: number, rot?: number, dy?: number, gap?: number, wordGap?: number }} [options]
   *   `tall` and `short` are glyph heights: capitals, digits and letters with an ascender are tall.
   *   `rot` and `dy` are the most that a tile turns (degrees) and moves off the baseline (pixels).
   * @returns {LetterSpec[]}
   */
  function ransomLetters(text, { seed = 1, fonts = FONTS, tones = TONES, tall = 320, short = 185, rot = 3, dy = 8, gap = -12, wordGap = 44 } = {}) {
    /** @type {LetterSpec[]} */
    const out = [];
    [...text].forEach((ch, i) => {
      if (/\s/.test(ch)) {
        if (out.length) out[out.length - 1].gap = (out[out.length - 1].gap ?? 0) + wordGap;
        return;
      }
      const rand = stream(seed, 'ransom.letter', i);
      const font = fonts[Math.floor(rand() * fonts.length)];
      const tone = tones[Math.floor(rand() * tones.length)];
      out.push({
        text: ch,
        font,
        heightInk: TALL.test(ch) ? tall : short,
        ...tone,
        rot: +((rand() * 2 - 1) * rot).toFixed(1),
        dy: Math.round((rand() * 2 - 1) * dy),
        gap,
      });
    });
    if (out.length) out[out.length - 1].gap = 0;
    return out;
  }

  /**
   * Burnt sheet: charred edge that eats into the paper, then a gray halftone singe zone, then clean paper.
   * The noise fields are hashed from their grid points (streams `burn.big`, `burn.mid`, `burn.small`, `burn.fine`, `burn.grit`),
   * so a taller or wider sheet keeps the burn of the part it shares with a smaller one.
   * @param {HTMLElement} el
   * @param {{ seed?: number, depth?: number, singe?: number, reach?: number }} [options]
   */
  function burn(el, { seed = 1, depth = 120, singe = 110, reach = 100 } = {}) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const big = noise(key(seed, 'burn.big'), 210);
    const mid = noise(key(seed, 'burn.mid'), 75);
    const small = noise(key(seed, 'burn.small'), 26);
    const fine = noise(key(seed, 'burn.fine'), 9);
    const grit = noise(key(seed, 'burn.grit'), 3);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wx = x + 46 * (mid(x, y) - 0.5);
        const wy = y + 46 * (small(x, h - 1 - y) - 0.5);
        const d = Math.min(wx, w - 1 - wx, wy, h - 1 - wy);
        const m = 0.42 * big(x, y) + 0.3 * mid(x, y) + 0.18 * small(x, y) + 0.1 * fine(x, y);
        const bite = Math.max(0, (m - 0.36) / 0.4);
        const raw = 22 + depth * Math.pow(bite, 1.5) + 20 * (grit(x, y) - 0.5) + 22 * (fine(x, y) - 0.5);
        const eaten = reach * Math.tanh(Math.max(raw, 0) / reach);
        const s = d - eaten;
        let tone = 255;
        if (s < 0) tone = 0;
        else {
          const width = singe * (0.45 + 0.9 * mid(x, y));
          const t = Math.max(0, 1 - s / width);
          const dark = Math.pow(t, 1.35) * 0.95 + (grit(x, y) - 0.5) * 0.35 * t;
          tone = 255 * (1 - Math.max(0, Math.min(1, dark)));
        }
        const i = (y * w + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = tone;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
    el.style.backgroundSize = '100% 100%';
  }

  /**
   * Waits for fonts, runs the page's own setup, then tells the renderer the page is ready.
   * @param {string[]} families The font families that the page uses.
   * @param {() => void} setup
   * @param {{ probe?: string }} [options] `probe` is the text that loads each family. Default `Aa0`.
   */
  async function ready(families, setup, { probe = 'Aa0' } = {}) {
    await Promise.all(families.map((f) => document.fonts.load(`100px "${f}"`, probe)));
    await document.fonts.ready;
    setup();
    document.body.dataset.ready = '1';
  }

  /** @type {any} */ (window).zine = { rng, key, stream, noise, ink, paper, tape, track, tile, ransom, ransomLetters, wear, burn, ready };
})();

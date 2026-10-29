// Output checks: small functions over sizes, pixels and masks. They return results and do not print or exit,
// so a build can list every failure at once with `assertChecks`.

/**
 * @typedef {object} CheckResult
 * @property {string} name
 * @property {boolean} ok
 * @property {string} message One line that says what was measured and, on failure, what is wrong.
 */

/**
 * Throws one error that lists every failed check. Returns the results when all pass.
 * @param {CheckResult[]} results
 * @returns {CheckResult[]}
 */
export function assertChecks(results) {
  const failed = results.filter((r) => !r.ok);
  if (failed.length) throw new Error(`${failed.length} check${failed.length === 1 ? '' : 's'} failed:\n${failed.map((r) => `  ${r.name}: ${r.message}`).join('\n')}`);
  return results;
}

/**
 * Size budget: the file must not be larger than `maxBytes`.
 * @param {string} name
 * @param {number} bytes
 * @param {number} maxBytes
 * @returns {CheckResult}
 */
export function checkSize(name, bytes, maxBytes) {
  const ok = bytes <= maxBytes;
  return { name: `${name} size`, ok, message: ok ? `${bytes} bytes, within ${maxBytes}` : `${bytes} bytes is over the ${maxBytes} byte limit` };
}

/**
 * The image must have exactly the expected pixel size.
 * @param {string} name
 * @param {{ width: number, height: number }} actual
 * @param {{ width: number, height: number }} expected
 * @returns {CheckResult}
 */
export function checkDimensions(name, actual, expected) {
  const ok = actual.width === expected.width && actual.height === expected.height;
  const text = `${actual.width}x${actual.height}`;
  return { name: `${name} dimensions`, ok, message: ok ? text : `${text}, expected ${expected.width}x${expected.height}` };
}

/**
 * The image must use at most `max` distinct colours.
 * @param {string} name
 * @param {number | Set<number>} colours The number of distinct colours, or the set of them.
 * @param {number} max
 * @returns {CheckResult}
 */
export function checkColourCount(name, colours, max) {
  const count = typeof colours === 'number' ? colours : colours.size;
  const ok = count <= max;
  return { name: `${name} colours`, ok, message: ok ? `${count} colours, at most ${max}` : `${count} colours is over the limit of ${max}` };
}

/**
 * Counts the pixels that show the probe colour. Coverage probe: render the layout on a magenta page,
 * and no magenta pixel may remain, because every pixel must lie on paper.
 * @param {Uint8Array} data Pixels, `channels` bytes each (at least 3: red, green, blue first).
 * @param {number} [channels] Default 4.
 * @param {(r: number, g: number, b: number) => boolean} [isProbe] Default: strong magenta.
 * @returns {number}
 */
export function countProbePixels(data, channels = 4, isProbe = (r, g, b) => r > 200 && g < 60 && b > 200) {
  let count = 0;
  for (let i = 0; i + 2 < data.length; i += channels) if (isProbe(data[i], data[i + 1], data[i + 2])) count++;
  return count;
}

/**
 * Coverage check: no pixel of the page may be left without paper.
 * @param {string} name
 * @param {number} barePixels The result of `countProbePixels`.
 * @returns {CheckResult}
 */
export function checkCoverage(name, barePixels) {
  const ok = barePixels === 0;
  return { name: `${name} coverage`, ok, message: ok ? 'no pixel is left without paper' : `${barePixels} pixels have no paper` };
}

/**
 * The black share of the pixels under a mask: gray values under `threshold` count as black.
 * `circle` limits the count to a disc, for a picture that is shown round.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {Uint8Array} mask 1 where a pixel belongs to the region.
 * @param {{ circle?: { cx: number, cy: number, r: number }, threshold?: number }} [options]
 * @returns {{ share: number, n: number }} `n` is the number of pixels measured.
 */
export function blackShare(gray, width, mask, { circle, threshold = 128 } = {}) {
  let n = 0;
  let black = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    if (circle) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (Math.hypot(x + 0.5 - circle.cx, y + 0.5 - circle.cy) > circle.r) continue;
    }
    n++;
    if (gray[i] < threshold) black++;
  }
  return { share: n ? black / n : 0, n };
}

/**
 * Ring check: two regions of paper must print as different tones, in either order.
 * Their black shares must be at least `gap` apart, and each region needs at least `minPixels` pixels to be measured.
 * Use `checkToneOrder` when one region must print darker than the other.
 * @param {string} name
 * @param {{ share: number, n: number }} a
 * @param {{ share: number, n: number }} b
 * @param {number} gap
 * @param {number} [minPixels]
 * @returns {CheckResult}
 */
export function checkTonalGap(name, a, b, gap, minPixels = 100) {
  if (a.n < minPixels || b.n < minPixels) {
    return { name, ok: false, message: `too few pixels to measure (${a.n} and ${b.n}, at least ${minPixels} needed)` };
  }
  const apart = Math.abs(a.share - b.share);
  const text = `black ${a.share.toFixed(2)} and ${b.share.toFixed(2)}, ${apart.toFixed(2)} apart`;
  return { name, ok: apart >= gap, message: apart >= gap ? text : `${text}, needs at least ${gap}` };
}

/**
 * Tone order check: the region that should print darker must have a black share at least `gap` above the region that should print lighter.
 * A pair in the wrong order fails however far apart the shares are. Each region needs at least `minPixels` pixels to be measured.
 * @param {string} name
 * @param {{ share: number, n: number }} darker The region that must print darker.
 * @param {{ share: number, n: number }} lighter The region that must print lighter.
 * @param {number} gap
 * @param {number} [minPixels]
 * @returns {CheckResult}
 */
export function checkToneOrder(name, darker, lighter, gap, minPixels = 100) {
  if (darker.n < minPixels || lighter.n < minPixels) {
    return { name, ok: false, message: `too few pixels to measure (${darker.n} and ${lighter.n}, at least ${minPixels} needed)` };
  }
  const step = darker.share - lighter.share;
  const text = `black ${darker.share.toFixed(2)} for the darker region and ${lighter.share.toFixed(2)} for the lighter one, ${step.toFixed(2)} darker`;
  if (step >= gap) return { name, ok: true, message: text };
  return { name, ok: false, message: `${text}, needs at least ${gap}${step < 0 ? ' (the order is reversed)' : ''}` };
}

/**
 * @typedef {object} Sliver
 * @property {number} length Length of the thin run in pixels.
 * @property {[number, number]} from Start of the run, in pixels from the origin of the grid.
 * @property {[number, number]} to End of the run.
 */

/**
 * Finds slivers: bands of a piece that show thinner than `minWidth` over a run of `minLength` or more.
 * The width at a visible point is its shortest run through visible points along four directions.
 * Short thin runs, such as the tips of acute corners, are not slivers.
 * @param {Uint8Array} visible 1 where the piece shows, on a grid of `width` x `height` cells.
 * @param {number} width
 * @param {number} height
 * @param {{ step?: number, minWidth?: number, minLength?: number }} [options] `step` is the size of one grid cell in pixels (default 2), `minWidth` default 8, `minLength` default 50.
 * @returns {{ slivers: Sliver[], longestThinRun: number }}
 */
export function findSlivers(visible, width, height, { step = 2, minWidth = 8, minLength = 50 } = {}) {
  /** @param {number} i @param {number} j @param {number} di @param {number} dj */
  const run = (i, j, di, dj) => {
    let n = 1;
    for (let k = 1; ; k++) {
      const a = i + di * k;
      const b = j + dj * k;
      if (a < 0 || b < 0 || a >= width || b >= height || !visible[b * width + a]) break;
      n++;
    }
    for (let k = 1; ; k++) {
      const a = i - di * k;
      const b = j - dj * k;
      if (a < 0 || b < 0 || a >= width || b >= height || !visible[b * width + a]) break;
      n++;
    }
    return n * step * Math.hypot(di, dj);
  };
  const thin = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (visible[j * width + i] && Math.min(run(i, j, 1, 0), run(i, j, 0, 1), run(i, j, 1, 1), run(i, j, 1, -1)) < minWidth) thin[j * width + i] = 1;
    }
  }
  const seen = new Uint8Array(width * height);
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  let longestThinRun = 0;
  /** @type {Sliver[]} */
  const slivers = [];
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (!thin[j * width + i] || seen[j * width + i]) continue;
      /** @type {[number, number][]} */
      const stack = [[i, j]];
      seen[j * width + i] = 1;
      let a0 = i;
      let a1 = i;
      let b0 = j;
      let b1 = j;
      while (stack.length) {
        const [ci, cj] = /** @type {[number, number]} */ (stack.pop());
        a0 = Math.min(a0, ci);
        a1 = Math.max(a1, ci);
        b0 = Math.min(b0, cj);
        b1 = Math.max(b1, cj);
        for (const [di, dj] of neighbours) {
          const a = ci + di;
          const b = cj + dj;
          if (a < 0 || b < 0 || a >= width || b >= height || !thin[b * width + a] || seen[b * width + a]) continue;
          seen[b * width + a] = 1;
          stack.push([a, b]);
        }
      }
      const length = Math.hypot(a1 - a0, b1 - b0) * step;
      longestThinRun = Math.max(longestThinRun, length);
      if (length >= minLength) slivers.push({ length, from: [a0 * step, b0 * step], to: [a1 * step, b1 * step] });
    }
  }
  return { slivers, longestThinRun };
}

/**
 * Sliver check: no piece may show as a band thinner than `minWidth`.
 * @param {string} name
 * @param {{ slivers: Sliver[], longestThinRun: number }} found The result of `findSlivers`.
 * @param {number} [minWidth] The width that was searched for. Default 8.
 * @returns {CheckResult}
 */
export function checkSlivers(name, found, minWidth = 8) {
  if (!found.slivers.length) return { name: `${name} slivers`, ok: true, message: `no band thinner than ${minWidth} px (longest thin run ${found.longestThinRun.toFixed(0)} px)` };
  const list = found.slivers.map((s) => `${s.length.toFixed(0)} px long, from ${s.from.join(',')} to ${s.to.join(',')}`).join('; ');
  return { name: `${name} slivers`, ok: false, message: `shows a band thinner than ${minWidth} px: ${list}` };
}

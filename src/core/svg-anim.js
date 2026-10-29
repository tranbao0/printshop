// Per-piece animated SVG: a base image and tiles (pieces), each with an optional inverted twin, moved by stop-motion keyframes.
// An SVG built here has no script and no external reference: every image is a data URI inside the file.
// Everything moves in steps (no easing, no fades), and every animated element repeats one period, so the parts never drift apart.

/** The length of one stop-motion step, in seconds: 5 frames at 60 fps. */
export const STEP = 5 / 60;

/**
 * A fraction of a period as a CSS percentage.
 * @param {number} v
 */
export const pct = (v) => `${+(v * 100).toFixed(4)}%`;

/**
 * Seconds as a CSS time.
 * @param {number} v
 */
export const sec = (v) => `${+v.toFixed(4)}s`;

/**
 * Keyframes that hold `on` during each pulse ([start, end] in seconds from the start of the period) and `off` the rest of the period.
 * @param {string} name
 * @param {[number, number][]} pulses
 * @param {number} period
 * @param {string} on CSS declarations.
 * @param {string} off CSS declarations.
 * @returns {string}
 */
export function pulseKeyframes(name, pulses, period, on, off) {
  const stops = pulses.flatMap(([start, end]) => [`${pct(start / period)} { ${on} }`, `${pct(end / period)} { ${off} }`]);
  const first = pulses[0][0] === 0 ? [] : [`0% { ${off} }`];
  return `@keyframes ${name} { ${[...first, ...stops, `100% { ${off} }`].join(' ')} }`;
}

/**
 * Keyframes for a wave in which item `i` is "on" for one step and "off" for the rest of the period.
 * @param {string} name
 * @param {number} i
 * @param {number} period
 * @param {string} on CSS declarations.
 * @param {string} off CSS declarations.
 * @param {number} [step] Length of one step in seconds. Default `STEP`.
 * @returns {string}
 */
export function waveKeyframes(name, i, period, on, off, step = STEP) {
  return pulseKeyframes(name, [[i * step, (i + 1) * step]], period, on, off);
}

/** Switches every animation off for readers who ask for less motion. */
export const REDUCED_MOTION_CSS = `
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }`;

/** @param {Buffer} png */
const dataUri = (png) => `data:image/png;base64,${png.toString('base64')}`;

/** @param {string} text */
const escapeAttribute = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A tile: a cropped PNG placed on the base, with an optional inverted twin of the same size and place.
 * @typedef {object} Tile
 * @property {Buffer} normal
 * @property {Buffer} [inverted]
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * One group per tile: an outer group for entrance moves, an inner one (class `hop`) for the hop, then the tile and its inverted twin (class `twin`) if it has one.
 * The two PNGs of a tile have the same size and place, so a flip never shifts the tile.
 * The groups are named l0, l1, ... from the first tile on, so the keyframes of a style can address them.
 * @param {Tile[]} letters
 * @returns {string}
 */
export function letterTiles(letters) {
  return letters
    .map((l, i) => {
      const image = (/** @type {Buffer} */ png, cls = '') => `<image ${cls}x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" href="${dataUri(png)}"/>`;
      return `<g id="l${i}" class="letter"><g class="hop">\n  ${image(l.normal)}${l.inverted ? `\n  ${image(l.inverted, 'class="twin" ')}` : ''}\n</g></g>`;
    })
    .join('\n');
}

/**
 * The SVG wrapper: a black sheet, the base image, then the tiles.
 * @param {object} parts
 * @param {number} parts.width
 * @param {number} parts.height
 * @param {string} parts.label The accessible name of the image.
 * @param {string} parts.css The style rules, with the keyframes.
 * @param {Buffer} parts.base The base image as a PNG.
 * @param {string} parts.tiles The markup from `letterTiles`.
 * @returns {string}
 */
export function svgDocument({ width, height, label, css, base, tiles }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(label)}">
<style>${css}
</style>
<rect width="${width}" height="${height}" fill="#000"/>
<image width="${width}" height="${height}" href="${dataUri(base)}"/>
${tiles}
</svg>
`;
}

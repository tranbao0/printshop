// Calm zones: areas of a page where a filter step is weaker or off.
// A page marks an element data-clean, data-soft or data-nospeck. The renderer reports its box; the filter reads it as a zone.
//   speck: keeps toner specks and hairs out of the zone.
//   clean: also lowers the ink bleed and swaps the dot screen for a plain threshold, so small type keeps its strokes.
//   soft:  also keeps specks out, with half the ink bleed and a weak dot screen, so pale tones still show as dots.

/** @typedef {import('./render.js').Zone} Zone */

/**
 * The share of a filter effect that stays inside a calm zone.
 * @typedef {object} CalmShare
 * @property {number} bleed Share of the ink bleed that stays.
 * @property {number} screen Share of the dot screen that stays.
 */

/**
 * @typedef {object} CalmSettings
 * @property {CalmShare} clean
 * @property {CalmShare} soft
 */

/**
 * Pixels added around a zone of each mode.
 * @typedef {{ speck: number, clean: number, soft: number }} ZonePad
 */

/**
 * The masks of a zone list.
 * @typedef {object} ZoneMasks
 * @property {Uint8Array} speck 1 where specks and hairs stay out (every zone mode).
 * @property {Uint8Array} calm 0 outside, 1 in a clean zone, 2 in a soft zone.
 */

/** @type {CalmSettings} */
export const calmDefaults = {
  clean: { bleed: 0.25, screen: 0 },
  soft: { bleed: 0.5, screen: 0.35 },
};

/** @type {ZonePad} */
export const zonePadDefaults = { speck: 8, clean: 4, soft: 4 };

/**
 * Marks every pixel of the padded zones of the given modes with `value`.
 * @param {Zone[]} zones
 * @param {string[]} modes
 * @param {ZonePad} pad
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} [mask]
 * @param {number} [value]
 * @returns {Uint8Array}
 */
export function zoneMask(zones, modes, pad, width, height, mask = new Uint8Array(width * height), value = 1) {
  for (const z of zones) {
    if (!modes.includes(z.mode)) continue;
    const p = pad[z.mode];
    const x0 = Math.max(0, Math.floor(z.x - p));
    const y0 = Math.max(0, Math.floor(z.y - p));
    const x1 = Math.min(width, Math.ceil(z.x + z.w + p));
    const y1 = Math.min(height, Math.ceil(z.y + z.h + p));
    for (let y = y0; y < y1; y++) mask.fill(value, y * width + x0, y * width + x1);
  }
  return mask;
}

/**
 * @param {Zone[]} zones
 * @param {ZonePad} pad
 * @param {number} width
 * @param {number} height
 * @returns {ZoneMasks | null} Null when there are no zones.
 */
export function buildZoneMasks(zones, pad, width, height) {
  if (zones.length === 0) return null;
  return {
    speck: zoneMask(zones, ['clean', 'soft', 'speck'], pad, width, height),
    calm: zoneMask(zones, ['soft'], pad, width, height, zoneMask(zones, ['clean'], pad, width, height), 2),
  };
}

/**
 * The calm settings at one pixel, or null outside the calm zones.
 * @param {ZoneMasks | null} masks
 * @param {CalmSettings} calm
 * @param {number} i Pixel index.
 * @returns {CalmShare | null}
 */
export function calmAt(masks, calm, i) {
  if (!masks) return null;
  const v = masks.calm[i];
  return v === 1 ? calm.clean : v === 2 ? calm.soft : null;
}

/**
 * True when any pixel of the square around (cx, cy) is marked.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {boolean}
 */
export function touches(mask, width, height, cx, cy, radius) {
  const r = Math.ceil(radius * 1.6 + 2);
  const x0 = Math.max(0, Math.round(cx) - r);
  const x1 = Math.min(width - 1, Math.round(cx) + r);
  const y0 = Math.max(0, Math.round(cy) - r);
  const y1 = Math.min(height - 1, Math.round(cy) + r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * width + x]) return true;
  return false;
}

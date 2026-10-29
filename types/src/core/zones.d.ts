export type Zone = import('./render.js').Zone;
export type CalmShare = {
    /**
     * Share of the ink bleed that stays.
     */
    bleed: number;
    /**
     * Share of the dot screen that stays.
     */
    screen: number;
};
export type CalmSettings = {
    clean: CalmShare;
    soft: CalmShare;
};
export type ZonePad = {
    speck: number;
    clean: number;
    soft: number;
};
export type ZoneMasks = {
    /**
     * 1 where specks and hairs stay out (every zone mode).
     */
    speck: Uint8Array;
    /**
     * 0 outside, 1 in a clean zone, 2 in a soft zone.
     */
    calm: Uint8Array;
};
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
export declare const calmDefaults: CalmSettings;
/** @type {ZonePad} */
export declare const zonePadDefaults: ZonePad;
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
export declare function zoneMask(zones: Zone[], modes: string[], pad: ZonePad, width: number, height: number, mask?: Uint8Array, value?: number): Uint8Array;
/**
 * @param {Zone[]} zones
 * @param {ZonePad} pad
 * @param {number} width
 * @param {number} height
 * @returns {ZoneMasks | null} Null when there are no zones.
 */
export declare function buildZoneMasks(zones: Zone[], pad: ZonePad, width: number, height: number): ZoneMasks | null;
/**
 * The calm settings at one pixel, or null outside the calm zones.
 * @param {ZoneMasks | null} masks
 * @param {CalmSettings} calm
 * @param {number} i Pixel index.
 * @returns {CalmShare | null}
 */
export declare function calmAt(masks: ZoneMasks | null, calm: CalmSettings, i: number): CalmShare | null;
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
export declare function touches(mask: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number): boolean;

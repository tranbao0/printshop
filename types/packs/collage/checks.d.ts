export type CheckResult = import('../../src/core/checks.js').CheckResult;
export type GrayImage = import('../../src/core/filters.js').GrayImage;
export type Pt = import('./geometry.js').Pt;
export type Poly = import('./geometry.js').Poly;
export type Built = import('./scene.js').Built;
export type Item = import('./scene.js').Item;
/**
 * Marks: each mark lies inside the cut edge of its own piece, at least `margin` px from it, and no later piece, shadow or tape covers it.
 * `allow` names the covers that are on purpose: `{ mark: 'label', by: 'flap' }` lets the tile `flap` lie over the marks of `label`.
 * @param {Built} built
 * @param {{ margin?: number, allow?: { mark: string, by: string }[] }} [options] `margin` default 3.
 * @returns {CheckResult[]}
 */
export declare function checkMarks(built: Built, { margin, allow }?: {
    margin?: number;
    allow?: {
        mark: string;
        by: string;
    }[];
}): CheckResult[];
/**
 * Motifs: each lies flat (no part casts a shadow), sits on a holder that casts the shadow, and keeps `fit` px of the holder around its whole outline.
 * @param {Built} built
 * @param {{ fit?: number }} [options] `fit` default 8.
 * @returns {CheckResult[]}
 */
export declare function checkMotifs(built: Built, { fit }?: {
    fit?: number;
}): CheckResult[];
/**
 * Hidden pieces: a tile, holder or motif must show at least `min` of its area (a motif at least `minMotif`).
 * Paper pasted later, the shadows of later pieces, tape, the area outside the page and the area outside the round window of the scene count as hiding.
 * A holder counts the paper under its own motif as shown.
 * @param {Built} built
 * @param {{ min?: number, minMotif?: number, step?: number }} [options] `min` default 0.5, `minMotif` default 0.85, `step` (grid, px) default 3.
 * @returns {CheckResult[]}
 */
export declare function checkShown(built: Built, { min, minMotif, step }?: {
    min?: number;
    minMotif?: number;
    step?: number;
}): CheckResult[];
/**
 * Slivers: no sheet or mat may show as a band thinner than `minWidth` over a run of `minLength` or more.
 * A point shows when no paper is pasted over it and no shadow falls on it. A shadow prints as dark as black or deep gray paper,
 * so on such a sheet a shadow does not hide the sheet; the sheet's own shadow then belongs to the band.
 * @param {Built} built
 * @param {{ minWidth?: number, minLength?: number, step?: number, darkest?: number }} [options]
 *   `darkest`: the highest brightness (0 to 255) of a paper that prints as dark as the shadow. Default 94 (#5e).
 * @returns {CheckResult[]}
 */
export declare function checkSheetSlivers(built: Built, { minWidth, minLength, step, darkest }?: {
    minWidth?: number;
    minLength?: number;
    step?: number;
    darkest?: number;
}): CheckResult[];
/**
 * The safety sheet: no point of the page may show only the base.
 * @param {Built} built
 * @param {{ step?: number }} [options] `step`: the sample grid in px. Default 4.
 * @returns {CheckResult}
 */
export declare function checkBase(built: Built, { step }?: {
    step?: number;
}): CheckResult;
/**
 * Coverage from a probe render: the page is rendered on magenta and no magenta pixel may remain.
 * @param {Built} built
 * @param {{ data: Uint8Array, width: number, height: number }} probe RGBA pixels of the probe render.
 * @returns {CheckResult}
 */
export declare function checkProbe(built: Built, { data, width, height }: {
    data: Uint8Array;
    width: number;
    height: number;
}): CheckResult;
/**
 * Shadow checks on the printed paper (no marks). For each motif and its holder:
 *  - no shadow: the strip where the motif's shadow would fall must print like the holder's plain paper (`same` at most apart);
 *  - value: the motif's own paper must differ from the holder's by `valueGap` in black share;
 *  - the holder's shadow must differ from the paper under it by `shadowGap`, so it shows against the paper below the holder,
 *    and from the holder's own paper by `shadowGap`, so it also shows against the piece it belongs to (a black holder hides its own shadow).
 * Everything pasted over the motif or the holder is left out. A region with fewer than `minPixels` pixels fails the check, it is not skipped.
 * @param {Built} built
 * @param {GrayImage} paper The print of the paper alone: render the collage with `paper: true`, then run the print filter.
 * @param {{ same?: number, valueGap?: number, shadowGap?: number, minPixels?: number }} [options]
 * @returns {CheckResult[]}
 */
export declare function checkShadows(built: Built, paper: GrayImage, { same, valueGap, shadowGap, minPixels }?: {
    same?: number;
    valueGap?: number;
    shadowGap?: number;
    minPixels?: number;
}): CheckResult[];
/**
 * The black share of the paper of a tile, measured in a band just inside its outline (6 to 15 px in, or all but the outer 2 px for a small tile).
 * Pasted later paper and its shadows are left out.
 * @param {Built} built
 * @param {GrayImage} paper
 * @param {number} index Index of the tile in the stack.
 * @returns {{ share: number, n: number }}
 */
export declare function paperShare(built: Built, paper: GrayImage, index: number): {
    share: number;
    n: number;
};
/**
 * Tone order: the tiles named in `darkest` are the darkest tiles; every other tile (except those in `skip`) must print at least `gap` lighter in black share
 * than the lightest of them. A tile whose paper band is too small to measure fails: it must not drop out unseen.
 * @param {Built} built
 * @param {GrayImage} paper The print of the paper alone.
 * @param {{ darkest: string[], gap?: number, skip?: string[], minPixels?: number }} options `gap` default 0.1, `minPixels` default 150.
 * @returns {CheckResult[]}
 */
export declare function checkTones(built: Built, paper: GrayImage, { darkest, gap, skip, minPixels }: {
    darkest: string[];
    gap?: number;
    skip?: string[];
    minPixels?: number;
}): CheckResult[];
/** The grays that the tone measurements go through, as #rrggbb fills, pale to deep. */
export declare const RAMP_FILLS: string[];
/**
 * Prints flat strips of paper through the print filter and measures the black share of each.
 * @param {string[]} fills #rrggbb fills.
 * @param {Partial<import('./filter.js').CollageFilterOptions>} [filter]
 * @returns {Map<string, { share: number, n: number }>}
 */
export declare function measureFills(fills: string[], filter?: Partial<import('./filter.js').CollageFilterOptions>): Map<string, {
    share: number;
    n: number;
}>;
/**
 * The gray ramp: the palette, pale to deep (white first), is printed through the filter, and neighbouring grays must differ by `gap` in black share.
 * White comes first, so the palest gray must print dots of its own.
 * @param {string[]} palette The gray fills of the collage.
 * @param {{ gap?: number, filter?: Partial<import('./filter.js').CollageFilterOptions> }} [options] `gap` default 0.06.
 * @returns {CheckResult[]}
 */
export declare function checkRamp(palette: string[], { gap, filter }?: {
    gap?: number;
    filter?: Partial<import('./filter.js').CollageFilterOptions>;
}): CheckResult[];
/**
 * Gray neighbours: where two different gray papers touch (visible, not under a shadow), they must print as different tones, `gap` apart in black share.
 * Black and white papers are told apart by their own contrast. The paper colours are measured through the print filter.
 * @param {Built} built
 * @param {{ gap?: number, filter?: Partial<import('./filter.js').CollageFilterOptions>, minLength?: number }} [options] `gap` default 0.06, `minLength` default 24 (px of shared edge).
 * @returns {CheckResult}
 */
export declare function checkNeighbours(built: Built, { gap, filter, minLength }?: {
    gap?: number;
    filter?: Partial<import('./filter.js').CollageFilterOptions>;
    minLength?: number;
}): CheckResult;
/**
 * Runs every check over a collage.
 * @param {Built} built
 * @param {{
 *   paper: GrayImage,
 *   probe: { data: Uint8Array, width: number, height: number },
 *   darkest?: string[],
 *   allow?: { mark: string, by: string }[],
 *   filter?: Partial<import('./filter.js').CollageFilterOptions>,
 * }} input `paper`: the print of the paper alone. `probe`: the pixels of the probe render. `darkest`: tiles for the tone order check (leave out to skip it).
 * @returns {CheckResult[]}
 */
export declare function runCollageChecks(built: Built, { paper, probe, darkest, allow, filter }: {
    paper: GrayImage;
    probe: {
        data: Uint8Array;
        width: number;
        height: number;
    };
    darkest?: string[];
    allow?: {
        mark: string;
        by: string;
    }[];
    filter?: Partial<import('./filter.js').CollageFilterOptions>;
}): CheckResult[];

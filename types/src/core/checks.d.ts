export type CheckResult = {
    name: string;
    ok: boolean;
    /**
     * One line that says what was measured and, on failure, what is wrong.
     */
    message: string;
};
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
export declare function assertChecks(results: CheckResult[]): CheckResult[];
/**
 * Size budget: the file must not be larger than `maxBytes`.
 * @param {string} name
 * @param {number} bytes
 * @param {number} maxBytes
 * @returns {CheckResult}
 */
export declare function checkSize(name: string, bytes: number, maxBytes: number): CheckResult;
/**
 * The image must have exactly the expected pixel size.
 * @param {string} name
 * @param {{ width: number, height: number }} actual
 * @param {{ width: number, height: number }} expected
 * @returns {CheckResult}
 */
export declare function checkDimensions(name: string, actual: {
    width: number;
    height: number;
}, expected: {
    width: number;
    height: number;
}): CheckResult;
/**
 * The image must use at most `max` distinct colours.
 * @param {string} name
 * @param {number | Set<number>} colours The number of distinct colours, or the set of them.
 * @param {number} max
 * @returns {CheckResult}
 */
export declare function checkColourCount(name: string, colours: number | Set<number>, max: number): CheckResult;
/**
 * Counts the pixels that show the probe colour. Coverage probe: render the layout on a magenta page,
 * and no magenta pixel may remain, because every pixel must lie on paper.
 * @param {Uint8Array} data Pixels, `channels` bytes each (at least 3: red, green, blue first).
 * @param {number} [channels] Default 4.
 * @param {(r: number, g: number, b: number) => boolean} [isProbe] Default: strong magenta.
 * @returns {number}
 */
export declare function countProbePixels(data: Uint8Array, channels?: number, isProbe?: (r: number, g: number, b: number) => boolean): number;
/**
 * Coverage check: no pixel of the page may be left without paper.
 * @param {string} name
 * @param {number} barePixels The result of `countProbePixels`.
 * @returns {CheckResult}
 */
export declare function checkCoverage(name: string, barePixels: number): CheckResult;
/**
 * The black share of the pixels under a mask: gray values under `threshold` count as black.
 * `circle` limits the count to a disc, for a picture that is shown round.
 * @param {Uint8Array} gray
 * @param {number} width
 * @param {Uint8Array} mask 1 where a pixel belongs to the region.
 * @param {{ circle?: { cx: number, cy: number, r: number }, threshold?: number }} [options]
 * @returns {{ share: number, n: number }} `n` is the number of pixels measured.
 */
export declare function blackShare(gray: Uint8Array, width: number, mask: Uint8Array, { circle, threshold }?: {
    circle?: {
        cx: number;
        cy: number;
        r: number;
    };
    threshold?: number;
}): {
    share: number;
    n: number;
};
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
export declare function checkTonalGap(name: string, a: {
    share: number;
    n: number;
}, b: {
    share: number;
    n: number;
}, gap: number, minPixels?: number): CheckResult;
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
export declare function checkToneOrder(name: string, darker: {
    share: number;
    n: number;
}, lighter: {
    share: number;
    n: number;
}, gap: number, minPixels?: number): CheckResult;
export type Sliver = {
    /**
     * Length of the thin run in pixels.
     */
    length: number;
    /**
     * Start of the run, in pixels from the origin of the grid.
     */
    from: [number, number];
    /**
     * End of the run.
     */
    to: [number, number];
};
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
export declare function findSlivers(visible: Uint8Array, width: number, height: number, { step, minWidth, minLength }?: {
    step?: number;
    minWidth?: number;
    minLength?: number;
}): {
    slivers: Sliver[];
    longestThinRun: number;
};
/**
 * Sliver check: no piece may show as a band thinner than `minWidth`.
 * @param {string} name
 * @param {{ slivers: Sliver[], longestThinRun: number }} found The result of `findSlivers`.
 * @param {number} [minWidth] The width that was searched for. Default 8.
 * @returns {CheckResult}
 */
export declare function checkSlivers(name: string, found: {
    slivers: Sliver[];
    longestThinRun: number;
}, minWidth?: number): CheckResult;

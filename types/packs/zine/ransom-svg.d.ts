export type Tile = import('../../src/core/svg-anim.js').Tile;
export type EntranceStep = {
    /**
     * The letters (counted from 0, left to right) that show in this step.
     */
    shown: number[] | 'all';
    /**
     * How far the shown letters have come from the pile at the middle of the word to their place: 0 is the pile, 1 is the place.
     */
    travelled: number;
    /**
     * Sideways moves in pixels by letter number, so that no letter hides behind a neighbour.
     */
    nudge?: Record<number, number>;
};
export type RansomMotion = {
    /**
     * Length of one stop-motion step of a wave, in seconds. Default 5 frames at 60 fps.
     */
    step?: number;
    /**
     * Seconds before the first step. Default 0.4.
     */
    lead?: number;
    /**
     * Length of one step of the entrance. Default 7.5 / 60.
     */
    fanStep?: number;
    /**
     * `true` for the steps of `fanSteps`, `false` for no entrance, or your own steps. Default `true`.
     */
    entrance?: boolean | EntranceStep[];
    /**
     * The letter that shows alone in the first step of the default entrance. Default: the middle letter.
     */
    first?: number;
    /**
     * Jump waves between the fan out and the fan in. Default 2.
     */
    waves?: number;
    /**
     * Seconds between the fan out and the first wave. Default 20 / 60. Only with an entrance.
     */
    hold?: number;
    /**
     * Seconds of rest after each wave. Default 3.
     */
    rest?: number;
    /**
     * Letters with an inverted twin flip in each wave. Default: on when any letter has a twin.
     */
    flip?: boolean;
    /**
     * Pixels that a hopping letter rises. Default 70. The hop is cut to the free space above the letters.
     */
    hop?: number;
    /**
     * A letter hops in the step in which the letter before it flips, so the first letter does not hop.
     * Default: the same as `flip`. When off, every letter hops in its own step.
     */
    hopFollowsFlip?: boolean;
};
/**
 * The steps of a default entrance: one letter alone, a small cluster, every letter bunched.
 * @param {number} count Number of letters.
 * @param {number} [first] The letter that shows alone. Default: the middle letter.
 * @returns {EntranceStep[]}
 */
export declare function fanSteps(count: number, first?: number): EntranceStep[];
/**
 * The most that the hopping letters can rise and still stay inside the image, up to `wanted` pixels.
 * @param {{ y: number }[]} letters The hopping letters.
 * @param {number} wanted
 * @param {number} [margin] Pixels kept above the highest letter.
 * @returns {number}
 */
export declare function fitHop(letters: {
    y: number;
}[], wanted: number, margin?: number): number;
/**
 * Whether letter `i` hops under the settings.
 * @param {number} i
 * @param {boolean} followsFlip
 */
export declare const hops: (i: number, followsFlip: boolean) => boolean;
/**
 * The settings with their defaults, and the times of the cycle.
 * @param {(Pick<Tile, 'y'> & { inverted?: Buffer })[]} letters
 * @param {RansomMotion} [motion]
 */
export declare function ransomTimeline(letters: (Pick<Tile, 'y'> & {
    inverted?: Buffer;
})[], motion?: RansomMotion): {
    count: number;
    step: number;
    lead: number;
    fanStep: number;
    waves: number;
    rest: number;
    flip: boolean;
    hopFollowsFlip: boolean;
    entrance: EntranceStep[];
    hold: number;
    hop: number;
    fanLength: number;
    waveLength: number;
    inPlace: number;
    waveStarts: number[];
    fanInStart: number;
    period: number;
};
/**
 * The keyframes and rules of the title.
 * @param {Tile[]} letters
 * @param {RansomMotion} [motion]
 * @returns {string}
 */
export declare function ransomCss(letters: Tile[], motion?: RansomMotion): string;
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/**
 * A box on the page, in pixels.
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 */
/**
 * Throws when a hopping letter, at the top of its hop, would touch one of the boxes.
 * @param {Record<string, Box>} boxes The named boxes to keep clear, such as a header.
 * @param {Tile[]} letters
 * @param {RansomMotion} [motion]
 * @param {number} [margin]
 */
export declare function assertHopsClearOf(boxes: Record<string, Box>, letters: Tile[], motion?: RansomMotion, margin?: number): void;
/**
 * The animated title as an SVG document.
 * `letters` lists the tiles from left to right, each { normal, inverted?, x, y, width, height }.
 * The two PNGs of a tile have the same size and place, so a flip never shifts the letter.
 * @param {object} parts
 * @param {Buffer} parts.base The base image as a PNG.
 * @param {Tile[]} parts.letters
 * @param {number} parts.width
 * @param {number} parts.height
 * @param {string} parts.label The accessible name of the image.
 * @param {RansomMotion} [parts.motion]
 * @returns {string}
 */
export declare function ransomSvg({ base, letters, width, height, label, motion }: {
    base: Buffer;
    letters: Tile[];
    width: number;
    height: number;
    label: string;
    motion?: RansomMotion;
}): string;

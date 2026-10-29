import { createStreams } from '../../src/core/seed.js';
export type Pt = import('./geometry.js').Pt;
export type Poly = import('./geometry.js').Poly;
export type EdgeKind = import('./edges.js').EdgeKind;
export type PatternKind = 'ruled' | 'grid' | 'dots' | 'stripes';
export type Offset = {
    x: number;
    y: number;
};
export type ShadowStyle = {
    fill: string;
    x: number;
    y: number;
};
export type Part = {
    outline: Poly;
    fill: string;
    pattern?: PatternKind;
    /**
     * Degrees that the pattern is turned by.
     */
    patternTurn?: number;
    castsShadow: boolean;
};
export type Mark = {
    poly: Poly;
    /**
     * Default black.
     */
    fill?: string;
};
export type Role = 'base' | 'sheet' | 'mat' | 'tile' | 'motif' | 'holder' | 'tape';
export type Item = {
    name: string;
    role: Role;
    /**
     * A tile or sheet has one part, a motif has one part for each piece of its shape.
     */
    parts: Part[];
    /**
     * Where the drop shadow falls, or null for a piece that lies flat.
     */
    shadow: Offset | null;
    /**
     * In page coordinates, already turned.
     */
    marks: Mark[];
    /**
     * On a holder: the name of the motif it holds.
     */
    of?: string;
    /**
     * On a motif: the name of its holder.
     */
    holds?: string;
};
export type SceneOptions = {
    /**
     * Page width in pixels.
     */
    width: number;
    /**
     * Page height in pixels.
     */
    height: number;
    seed: number;
    /**
     * The default drop shadow.
     */
    shadow?: Partial<ShadowStyle>;
    /**
     * A round window. Checks look only inside it (a picture that is shown round).
     */
    region?: {
        cx: number;
        cy: number;
        r: number;
    };
};
/** @typedef {import('./geometry.js').Pt} Pt */
/** @typedef {import('./geometry.js').Poly} Poly */
/** @typedef {import('./edges.js').EdgeKind} EdgeKind */
/** @typedef {'ruled' | 'grid' | 'dots' | 'stripes'} PatternKind */
/**
 * @typedef {object} Offset
 * @property {number} x
 * @property {number} y
 */
/** @typedef {{ fill: string, x: number, y: number }} ShadowStyle */
/**
 * One piece of paper: an outline, a colour and perhaps a pattern.
 * @typedef {object} Part
 * @property {Poly} outline
 * @property {string} fill
 * @property {PatternKind} [pattern]
 * @property {number} [patternTurn] Degrees that the pattern is turned by.
 * @property {boolean} castsShadow
 */
/**
 * Ink printed on a piece. It turns with the piece.
 * @typedef {object} Mark
 * @property {Poly} poly
 * @property {string} [fill] Default black.
 */
/** @typedef {'base' | 'sheet' | 'mat' | 'tile' | 'motif' | 'holder' | 'tape'} Role */
/**
 * @typedef {object} Item
 * @property {string} name
 * @property {Role} role
 * @property {Part[]} parts A tile or sheet has one part, a motif has one part for each piece of its shape.
 * @property {Offset | null} shadow Where the drop shadow falls, or null for a piece that lies flat.
 * @property {Mark[]} marks In page coordinates, already turned.
 * @property {string} [of] On a holder: the name of the motif it holds.
 * @property {string} [holds] On a motif: the name of its holder.
 */
/**
 * The scene before it is built.
 * @typedef {object} SceneOptions
 * @property {number} width Page width in pixels.
 * @property {number} height Page height in pixels.
 * @property {number} seed
 * @property {Partial<ShadowStyle>} [shadow] The default drop shadow.
 * @property {{ cx: number, cy: number, r: number }} [region] A round window. Checks look only inside it (a picture that is shown round).
 */
export declare const SHADOW: ShadowStyle;
/** A motif lies at least this far inside the cut edge of its holder, so the holder grows until it does. */
export declare const MOTIF_FIT = 10;
/**
 * The brightness of a paper colour, 0 (black) to 255 (white).
 * @param {string} fill A colour like #8f8f8f.
 * @returns {number}
 */
export declare function lumaOf(fill: string): number;
export type MotifShape = {
    type: 'sparkle';
    cx: number;
    cy: number;
    a: number;
    b: number;
    rot: number;
    w?: number;
} | {
    type: 'burst';
    cx: number;
    cy: number;
    R: number;
    n: number;
    k: number;
    rot: number;
} | {
    type: 'snowflake';
    cx: number;
    cy: number;
    R: number;
    rot: number;
    kind: string;
} | {
    type: 'crescent';
    cx: number;
    cy: number;
    r: number;
    rot: number;
} | {
    type: 'note';
    cx: number;
    cy: number;
    s: number;
    rot: number;
} | {
    type: 'polygons';
    parts: Poly[];
};
export type HolderSpec = {
    fill: string;
    w: number;
    h: number;
    rot?: number;
    /**
     * Moves the holder against the centre of the motif.
     */
    dx?: number;
    dy?: number;
    pattern?: PatternKind;
    /**
     * Default `MOTIF_FIT`.
     */
    fit?: number;
    /**
     * Default true. With false the holder keeps the size asked for, whatever the motif needs.
     */
    grow?: boolean;
    shadow?: Offset;
};
export type Spec = {
    role: Role | 'motif+holder';
    name: string;
    build: (ctx: BuildContext) => void;
};
export type BuildContext = {
    /**
     * The items built so far (bottom first). The builder pushes its own items.
     */
    items: Item[];
    streams: ReturnType<typeof createStreams>;
    shadow: ShadowStyle;
};
/**
 * Creates an empty scene. Add pieces bottom first, then call `build()`.
 * @param {SceneOptions} options
 */
export declare function createScene({ width, height, seed, shadow: shadowOptions, region }: SceneOptions): {
    width: number;
    height: number;
    seed: number;
    /**
     * A safety sheet under everything. No pixel of the page may show it.
     * @param {string} fill
     */
    base(fill: string): /*elided*/ any;
    /**
     * A sheet of paper with torn or cut edges. `poly` is authored in page coordinates.
     * @param {string} name
     * @param {Poly} poly
     * @param {{ fill: string, kinds?: EdgeKind | EdgeKind[], rot?: number, pattern?: PatternKind, patternTurn?: number, shadow?: Offset | false }} o
     */
    sheet(name: string, poly: Poly, { fill, kinds, rot, pattern, patternTurn, shadow }: {
        fill: string;
        kinds?: EdgeKind | EdgeKind[];
        rot?: number;
        pattern?: PatternKind;
        patternTurn?: number;
        shadow?: Offset | false;
    }): /*elided*/ any;
    /**
     * A scissor-cut tile that carries marks. The tile and its marks turn together by `rot` about `origin`.
     * @param {string} name
     * @param {Poly} poly
     * @param {{ fill: string, rot?: number, origin?: Pt, kinds?: EdgeKind | EdgeKind[], trim?: { a: Pt, n: Pt }[], marks?: Mark[], pattern?: PatternKind, shadow?: Offset | false, flat?: boolean }} o
     *   `trim`: straight cuts in page coordinates after the turn, each `{ a, n }`: a point on the cut line and the normal of the side that stays.
     *   `flat`: the tile lies flat and casts no shadow.
     */
    tile(name: string, poly: Poly, { fill, rot, origin, kinds, trim, marks, pattern, shadow, flat }: {
        fill: string;
        rot?: number;
        origin?: Pt;
        kinds?: EdgeKind | EdgeKind[];
        trim?: {
            a: Pt;
            n: Pt;
        }[];
        marks?: Mark[];
        pattern?: PatternKind;
        shadow?: Offset | false;
        flat?: boolean;
    }): /*elided*/ any;
    /**
     * Paper a little larger than a tile, pasted just under it, turned and shifted against it, so the tile keeps an edge on paper of its own tone.
     * `pad` is the width of the border. `turn` turns the mat about the centre of the tile, `dx` and `dy` move it, `clip` cuts off one corner
     * (the index of the tile corner), and each line in `keep` is a pair of points in tile coordinates: the mat keeps only the side of the line that holds the tile's centre.
     * @param {string} target The name of the tile the mat goes under. The tile must be added before the scene is built.
     * @param {number} pad
     * @param {string} fill
     * @param {{ name?: string, turn?: number, dx?: number, dy?: number, clip?: number, keep?: [Pt, Pt][], pattern?: PatternKind, shadow?: Offset | false }} [o]
     */
    mat(target: string, pad: number, fill: string, { name, turn, dx, dy, clip, keep, pattern, shadow }?: {
        name?: string;
        turn?: number;
        dx?: number;
        dy?: number;
        clip?: number;
        keep?: [Pt, Pt][];
        pattern?: PatternKind;
        shadow?: Offset | false;
    }): /*elided*/ any;
    /**
     * A motif cut from paper. It lies flat on its holder (`back`), which casts the drop shadow; the motif casts none.
     * The holder is added just under the motif and is called `<name>-holder`.
     * @param {string} name
     * @param {MotifShape} shape
     * @param {{ fill: string, back: HolderSpec }} o
     */
    motif(name: string, shape: MotifShape, { fill, back }: {
        fill: string;
        back: HolderSpec;
    }): /*elided*/ any;
    /**
     * A strip of see-through tape. It is pasted at this place in the stack: pieces added later cover it.
     * @param {string} name
     * @param {number} cx
     * @param {number} cy
     * @param {number} w
     * @param {number} h
     * @param {number} rot
     */
    tape(name: string, cx: number, cy: number, w: number, h: number, rot: number): /*elided*/ any;
    /**
     * Builds the geometry of every piece.
     * @returns {Built}
     */
    build(): Built;
};
export type Built = {
    width: number;
    height: number;
    seed: number;
    /**
     * Bottom first.
     */
    items: Item[];
    shadow: ShadowStyle;
    region: {
        cx: number;
        cy: number;
        r: number;
    } | null;
    get: (name: string) => Item;
    /**
     *   The topmost paper at a point, looking only at items below index `below` (default: all). Tape is not paper.
     */
    topAt: (pt: Pt, below?: number) => {
        item: Item;
        part: Part;
        index: number;
    } | null;
    /**
     *   True when an item pasted after index `above` covers the point, or its shadow does (`shadows: false` ignores shadows, `tape: false` ignores tape).
     */
    coveredAbove: (pt: Pt, above: number, options?: {
        shadows?: boolean;
        tape?: boolean;
    }) => boolean;
    inRegion: (pt: Pt) => boolean;
    svg: (options?: {
        marks?: boolean;
        base?: boolean;
    }) => string;
};
/**
 * A built scene: final outlines in paste order, with the questions that the checks ask of the stack.
 * @typedef {object} Built
 * @property {number} width
 * @property {number} height
 * @property {number} seed
 * @property {Item[]} items Bottom first.
 * @property {ShadowStyle} shadow
 * @property {{ cx: number, cy: number, r: number } | null} region
 * @property {(name: string) => Item} get
 * @property {(pt: Pt, below?: number) => { item: Item, part: Part, index: number } | null} topAt
 *   The topmost paper at a point, looking only at items below index `below` (default: all). Tape is not paper.
 * @property {(pt: Pt, above: number, options?: { shadows?: boolean, tape?: boolean }) => boolean} coveredAbove
 *   True when an item pasted after index `above` covers the point, or its shadow does (`shadows: false` ignores shadows, `tape: false` ignores tape).
 * @property {(pt: Pt) => boolean} inRegion
 * @property {(options?: { marks?: boolean, base?: boolean }) => string} svg
 */
/**
 * @param {{ width: number, height: number, seed: number, items: Item[], region?: { cx: number, cy: number, r: number }, shadow: ShadowStyle }} o
 * @returns {Built}
 */
export declare function makeBuilt({ width, height, seed, items, region, shadow }: {
    width: number;
    height: number;
    seed: number;
    items: Item[];
    region?: {
        cx: number;
        cy: number;
        r: number;
    };
    shadow: ShadowStyle;
}): Built;

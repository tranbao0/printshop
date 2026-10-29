// An example collage of plain shapes and motifs: sheets of paper, tiles with simple marks, a mat, snowflakes, sparkles, bursts,
// a crescent, a note and tape. It has no picture in it; it shows what the collage pack does and is the input of its golden test.
import { createScene } from '../../packs/collage/scene.js';
import { ellipsePoly } from '../../packs/collage/geometry.js';

/** @typedef {import('../../packs/collage/geometry.js').Poly} Poly */

export const WIDTH = 800;
export const HEIGHT = 800;
export const SEED = 302;

// The papers. Every gray prints as a different share of black dots.
const WHITE = '#ffffff';
const BLACK = '#000000';
const PALE = '#b2b2b2';
const LIGHT = '#a2a2a2';
const MID = '#929292';
const SLATE = '#858585';

/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {Poly} */
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {Poly} */
const triangle = (x, y, w, h) => [[x + w / 2, y], [x + w, y + h], [x, y + h]];

/** The tile whose paper prints darkest. The tone order check holds every other tile lighter than it. */
export const DARKEST_TILES = ['slate'];

/**
 * Builds the example scene.
 * @param {number} [seed]
 */
export function exampleScene(seed = SEED) {
  const scene = createScene({ width: WIDTH, height: HEIGHT, seed });
  scene.base(SLATE);

  // Sheets, bottom first. A gray sheet covers the page and a black sheet with a torn edge sweeps in from the left over it.
  scene.sheet('gray-right', [[200, -60], [880, -60], [880, 880], [200, 880]], { fill: MID, kinds: 'clean' });
  scene.sheet('black-left', [[-80, -60], [450, -60], [330, 250], [190, 400], [330, 590], [400, 880], [-80, 880]], {
    fill: BLACK,
    kinds: ['clean', 'clean', 'torn', 'torn', 'torn', 'clean', 'clean'],
  });
  // Pale strips over the black and gray sheets, where the motifs sit, so their holders cast shadows on light paper.
  scene.sheet('pale-top', [[40, -60], [560, -60], [520, 60], [380, 110], [230, 125], [140, 160], [60, 110]], {
    fill: PALE,
    kinds: ['clean', 'torn', 'torn', 'torn', 'torn', 'torn', 'torn'],
  });
  scene.sheet('light-bottom', [[110, 600], [420, 610], [660, 600], [880, 590], [880, 880], [110, 880]], {
    fill: LIGHT,
    kinds: ['torn', 'torn', 'torn', 'torn', 'clean', 'clean'],
  });

  // Motifs on holders: each holder casts the shadow, each motif lies flat.
  scene.motif('sparkle-top', { type: 'sparkle', cx: 130, cy: 44, a: 42, b: 28, rot: 24, w: 0.26 }, { fill: BLACK, back: { fill: WHITE, w: 96, h: 62, rot: 6 } });
  scene.motif('flake-top', { type: 'snowflake', cx: 330, cy: 46, R: 38, rot: 8, kind: 'fir' }, { fill: BLACK, back: { fill: WHITE, w: 100, h: 90, rot: -4 } });
  scene.motif('burst-top', { type: 'burst', cx: 470, cy: 36, R: 28, n: 8, k: 0.55, rot: 9 }, { fill: BLACK, back: { fill: WHITE, w: 70, h: 62, rot: 10 } });
  scene.motif('crescent-bottom', { type: 'crescent', cx: 190, cy: 760, r: 42, rot: -20 }, { fill: BLACK, back: { fill: WHITE, w: 100, h: 100, rot: -6 } });
  scene.motif('flake-bottom', { type: 'snowflake', cx: 370, cy: 760, R: 40, rot: 15, kind: 'comb' }, { fill: BLACK, back: { fill: PALE, w: 104, h: 96, rot: 5 } });
  scene.motif('note-bottom', { type: 'note', cx: 550, cy: 772, s: 50, rot: 12 }, { fill: BLACK, back: { fill: WHITE, w: 80, h: 100, rot: -7 } });
  scene.motif('burst-bottom', { type: 'burst', cx: 700, cy: 760, R: 36, n: 12, k: 0.6, rot: 5 }, { fill: BLACK, back: { fill: WHITE, w: 86, h: 80, rot: 8 } });

  // The middle: four light sheets cut into pieces, each with its own value or pattern and tilt.
  scene.sheet('light-top', [[110, 150], [700, 140], [730, 330], [100, 335]], { fill: WHITE, kinds: ['torn', 'torn', 'torn', 'torn'], rot: -2, pattern: 'ruled' });
  scene.sheet('light-mid', [[60, 290], [740, 280], [770, 470], [70, 490]], { fill: PALE, kinds: ['cut', 'torn', 'torn', 'torn'], rot: 1.5, pattern: 'stripes' });
  scene.sheet('light-low', [[120, 460], [700, 450], [690, 660], [130, 670]], { fill: WHITE, kinds: ['cut', 'cut', 'torn', 'torn'], rot: -1, pattern: 'grid' });

  // Tiles with simple marks. Each is cut and turned on its own.
  scene.tile('bars', rect(150, 190, 190, 120), {
    fill: WHITE,
    rot: -4,
    marks: [rect(180, 215, 22, 70), rect(222, 235, 22, 50), rect(264, 205, 22, 80), rect(306, 250, 22, 35)].map((poly) => ({ poly })),
  });
  scene.mat('bars', 18, LIGHT, { turn: 3, dx: 6, dy: 4, clip: 1 });
  scene.tile('squares', rect(420, 200, 220, 110), {
    fill: LIGHT,
    rot: 3,
    marks: [0, 1, 2, 3, 4].map((k) => ({ poly: rect(446 + k * 38, 235, 24, 24) })),
  });
  scene.tile('slate', rect(130, 360, 200, 150), {
    fill: SLATE,
    rot: 5,
    marks: [{ poly: triangle(160, 390, 60, 70) }, { poly: triangle(240, 410, 60, 70) }],
  });
  scene.tile('stripes', rect(400, 340, 250, 130), {
    fill: WHITE,
    rot: -3,
    marks: [0, 1, 2, 3, 4, 5].map((k) => ({ poly: [[440 + k * 34, 365], [458 + k * 34, 365], [428 + k * 34, 445], [410 + k * 34, 445]], fill: BLACK })),
  });
  scene.tile('rings', rect(300, 520, 170, 110), {
    fill: PALE,
    rot: 4,
    marks: [{ poly: ellipsePoly(385, 575, 36, 36, 0, 24) }],
  });
  scene.tile('pennant', rect(520, 520, 150, 110), {
    fill: WHITE,
    rot: -6,
    marks: [{ poly: triangle(560, 540, 70, 66) }],
  });

  // Tape across the corners of the sheets and tiles, clear of every mark.
  scene.tape('tape-1', 118, 150, 120, 36, 38);
  scene.tape('tape-2', 725, 300, 130, 38, -35);
  scene.tape('tape-3', 640, 640, 120, 34, -12);
  return scene;
}

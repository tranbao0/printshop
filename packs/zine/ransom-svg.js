// The animated ransom title: a base image and one cut-out per letter, each with an optional inverted twin.
// Everything moves in stop-motion steps (no easing, no fades), like a title cut from magazine letters.
// The whole cycle is one period, and every animated element repeats it, so the parts never drift apart.
// The motion is driven by options only. It knows nothing about the words of the title.
//
// One cycle, in seconds:
//   lead                    bare paper (with an entrance) or the title at rest (without one)
//   fan out                 the steps of the entrance: for example one letter alone at the middle, a small cluster, every letter bunched, then all in place
//   hold                    nothing moves
//   jump wave               in step k letter k flips to its inverted twin while letter k + 1 hops up (one step behind the flip)
//   rest                    nothing moves
//   (more waves, each followed by a rest)
//   fan in                  the fan out played backward, ending on bare paper
//   then the cycle starts again with the lead
import { REDUCED_MOTION_CSS, STEP, letterTiles, pct, pulseKeyframes, svgDocument } from '../../src/core/svg-anim.js';

/** @typedef {import('../../src/core/svg-anim.js').Tile} Tile */

/**
 * One step of the entrance.
 * @typedef {object} EntranceStep
 * @property {number[] | 'all'} shown The letters (counted from 0, left to right) that show in this step.
 * @property {number} travelled How far the shown letters have come from the pile at the middle of the word to their place: 0 is the pile, 1 is the place.
 * @property {Record<number, number>} [nudge] Sideways moves in pixels by letter number, so that no letter hides behind a neighbour.
 */

/**
 * @typedef {object} RansomMotion
 * @property {number} [step] Length of one stop-motion step of a wave, in seconds. Default 5 frames at 60 fps.
 * @property {number} [lead] Seconds before the first step. Default 0.4.
 * @property {number} [fanStep] Length of one step of the entrance. Default 7.5 / 60.
 * @property {boolean | EntranceStep[]} [entrance] `true` for the steps of `fanSteps`, `false` for no entrance, or your own steps. Default `true`.
 * @property {number} [first] The letter that shows alone in the first step of the default entrance. Default: the middle letter.
 * @property {number} [waves] Jump waves between the fan out and the fan in. Default 2.
 * @property {number} [hold] Seconds between the fan out and the first wave. Default 20 / 60. Only with an entrance.
 * @property {number} [rest] Seconds of rest after each wave. Default 3.
 * @property {boolean} [flip] Letters with an inverted twin flip in each wave. Default: on when any letter has a twin.
 * @property {number} [hop] Pixels that a hopping letter rises. Default 70. The hop is cut to the free space above the letters.
 * @property {boolean} [hopFollowsFlip] A letter hops in the step in which the letter before it flips, so the first letter does not hop.
 *   Default: the same as `flip`. When off, every letter hops in its own step.
 */

/**
 * Pixels of the image kept above the highest hopping letter.
 */
const TOP_MARGIN = 1;

/**
 * The steps of a default entrance: one letter alone, a small cluster, every letter bunched.
 * @param {number} count Number of letters.
 * @param {number} [first] The letter that shows alone. Default: the middle letter.
 * @returns {EntranceStep[]}
 */
export function fanSteps(count, first = Math.min(count - 1, Math.floor(count / 2))) {
  const cluster = [...new Set([0, Math.min(1, count - 1), first])].sort((a, b) => a - b);
  return [
    { shown: [first], travelled: 0.12 },
    { shown: cluster, travelled: 0.29 },
    { shown: 'all', travelled: 0.67 },
  ];
}

/**
 * The most that the hopping letters can rise and still stay inside the image, up to `wanted` pixels.
 * @param {{ y: number }[]} letters The hopping letters.
 * @param {number} wanted
 * @param {number} [margin] Pixels kept above the highest letter.
 * @returns {number}
 */
export function fitHop(letters, wanted, margin = TOP_MARGIN) {
  if (!letters.length) return 0;
  const free = Math.floor(Math.min(...letters.map((l) => l.y))) - margin;
  return Math.max(0, Math.min(wanted, free));
}

/**
 * Whether letter `i` hops under the settings.
 * @param {number} i
 * @param {boolean} followsFlip
 */
export const hops = (i, followsFlip) => !followsFlip || i > 0;

/**
 * The settings with their defaults, and the times of the cycle.
 * @param {(Pick<Tile, 'y'> & { inverted?: Buffer })[]} letters
 * @param {RansomMotion} [motion]
 */
export function ransomTimeline(letters, motion = {}) {
  const count = letters.length;
  const step = motion.step ?? STEP;
  const lead = motion.lead ?? 0.4;
  const fanStep = motion.fanStep ?? 7.5 / 60;
  const waves = motion.waves ?? 2;
  const rest = motion.rest ?? 3;
  const flip = motion.flip ?? letters.some((l) => l.inverted);
  const hopFollowsFlip = motion.hopFollowsFlip ?? flip;
  const entrance = motion.entrance === false ? [] : Array.isArray(motion.entrance) ? motion.entrance : fanSteps(count, motion.first);
  const hold = entrance.length ? (motion.hold ?? 20 / 60) : 0;
  const hop = fitHop(letters.filter((_, i) => hops(i, hopFollowsFlip)), motion.hop ?? 70);
  const fanLength = entrance.length * fanStep;
  const waveLength = count * step;
  const inPlace = lead + fanLength; // the fan out is done
  const waveStarts = Array.from({ length: waves }, (_, w) => inPlace + hold + w * (waveLength + rest));
  const fanInStart = inPlace + hold + waves * (waveLength + rest);
  const period = entrance.length ? fanInStart + fanLength : fanInStart;
  return { count, step, lead, fanStep, waves, rest, flip, hopFollowsFlip, entrance, hold, hop, fanLength, waveLength, inPlace, waveStarts, fanInStart, period };
}

/** Seconds with enough digits that the period does not round away from the sum of its parts. @param {number} v */
const exact = (v) => `${+v.toFixed(6)}s`;

/**
 * The keyframes and rules of the title.
 * @param {Tile[]} letters
 * @param {RansomMotion} [motion]
 * @returns {string}
 */
export function ransomCss(letters, motion = {}) {
  const t = ransomTimeline(letters, motion);
  const duration = exact(t.period);
  // The piled letters gather at the middle of the word, from its left edge to its right edge.
  const left = Math.min(...letters.map((l) => l.x));
  const right = Math.max(...letters.map((l) => l.x + l.width));
  const middle = (left + right) / 2;
  let css = '';

  letters.forEach((l, i) => {
    if (t.entrance.length) {
      const centre = l.x + l.width / 2;
      const bare = 'opacity: 0; transform: translate(0, 0);';
      /** @param {number} k */
      const stateOf = (k) => {
        const s = t.entrance[k];
        const shown = s.shown === 'all' || s.shown.includes(i);
        const dx = (middle - centre) * (1 - s.travelled) + (s.nudge?.[i] ?? 0);
        return `opacity: ${shown ? 1 : 0}; transform: translate(${dx.toFixed(1)}px, 0);`;
      };
      // Bare paper, then each fan out step in order, all in place, then the same steps in reverse order, then bare paper again.
      const frames = [`0% { ${bare} }`];
      t.entrance.forEach((_, k) => frames.push(`${pct((t.lead + k * t.fanStep) / t.period)} { ${stateOf(k)} }`));
      frames.push(`${pct(t.inPlace / t.period)} { opacity: 1; transform: translate(0, 0); }`);
      t.entrance.forEach((_, j) => frames.push(`${pct((t.fanInStart + j * t.fanStep) / t.period)} { ${stateOf(t.entrance.length - 1 - j)} }`));
      frames.push(`100% { ${bare} }`);
      css += `
  @keyframes enter-${i} { ${frames.join(' ')} }
  #l${i} { animation: enter-${i} ${duration} step-end infinite; }`;
    }
    if (!t.waves) return;

    // The flip: the inverted twin shows for letter i's step of every wave.
    if (t.flip && l.inverted) {
      const flips = t.waveStarts.map((w) => /** @type {[number, number]} */ ([w + i * t.step, w + (i + 1) * t.step]));
      css += `
  ${pulseKeyframes(`flip-${i}`, flips, t.period, 'opacity: 1;', 'opacity: 0;')}
  #l${i} .twin { opacity: 0; animation: flip-${i} ${duration} step-end infinite; }`;
    }

    // The hop: letter i rises for its own step, or for the step in which letter i - 1 flips, in every wave.
    if (t.hop && hops(i, t.hopFollowsFlip)) {
      const at = t.hopFollowsFlip ? i - 1 : i;
      const rises = t.waveStarts.map((w) => /** @type {[number, number]} */ ([w + at * t.step, w + (at + 1) * t.step]));
      css += `
  ${pulseKeyframes(`hop-${i}`, rises, t.period, `transform: translateY(${-t.hop}px);`, 'transform: translateY(0);')}
  #l${i} .hop { animation: hop-${i} ${duration} step-end infinite; }`;
    }
  });

  return css + REDUCED_MOTION_CSS;
}

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
export function assertHopsClearOf(boxes, letters, motion = {}, margin = 4) {
  const t = ransomTimeline(letters, motion);
  for (const [name, box] of Object.entries(boxes)) {
    if (!box || !(box.w > 0 && box.h > 0)) throw new Error(`the box "${name}" is missing or empty, so the hops cannot be checked`);
    letters.forEach((l, i) => {
      if (!hops(i, t.hopFollowsFlip) || !t.waves) return;
      const top = l.y - t.hop;
      const apart = l.x >= box.x + box.w + margin || l.x + l.width <= box.x - margin || top >= box.y + box.h + margin;
      if (!apart) throw new Error(`letter ${i} hops into "${name}": its top reaches y ${top}, the box ends at y ${Math.ceil(box.y + box.h)}`);
    });
  }
}

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
export function ransomSvg({ base, letters, width, height, label, motion }) {
  return svgDocument({ width, height, label, css: ransomCss(letters, motion), base, tiles: letterTiles(letters) });
}

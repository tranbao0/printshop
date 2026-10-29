// Checks for the output of the zine pack.
import { checkSize } from '../../src/core/checks.js';

/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */

/**
 * The size budgets of the pack, in bytes. A build fails when a file is over its budget.
 * `ransomSvg`: an animated title with its base image and its letters, all inside the file.
 * `page`: one still page as a palette PNG, 1600 px wide.
 * `card`: one page narrower than 1600 px (for example a 800 px wide card or tag) as a palette PNG.
 */
export const budgets = Object.freeze({ ransomSvg: 150_000, page: 450_000, card: 200_000 });

/**
 * The size budget for a still page of a given width: the `page` budget from 1600 px, the `card` budget below that.
 * @param {number} width
 */
export const budgetFor = (width) => (width >= 1600 ? budgets.page : budgets.card);

/** Elements that run code or load another document. */
const FORBIDDEN_ELEMENTS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'link'];

/** An optional XML namespace prefix, as in `<s:script>` or `q:href`. */
const PREFIX = '(?:[\\w.-]+:)?';

/**
 * Whether a reference stays inside the file: a raster image as a data URI, or a fragment of the document.
 * @param {string} value
 */
const isLocal = (value) => /^\s*(data:image\/(png|jpeg|gif|webp)[;,]|#)/i.test(value);

/**
 * Finds what an SVG file may not hold: script, event handler attributes, animation of a reference, and any reference to something outside the file.
 * The only references allowed are raster data URIs and fragments (`#id`).
 * @param {string} svg
 * @returns {string[]} One line for each problem found.
 */
export function findSvgProblems(svg) {
  /** @type {string[]} */
  const problems = [];
  for (const name of FORBIDDEN_ELEMENTS) {
    if (new RegExp(`<${PREFIX}${name}[\\s>/]`, 'i').test(svg)) problems.push(`has a <${name}> element`);
  }
  if (/<!(DOCTYPE|ENTITY)/i.test(svg) || /<\?xml-stylesheet/i.test(svg)) problems.push('has a DOCTYPE, an ENTITY or an xml-stylesheet');
  for (const m of svg.matchAll(new RegExp(`\\s${PREFIX}on[a-z]+\\s*=`, 'gi'))) problems.push(`has the event handler attribute ${m[0].trim()}`);
  // An animation can set a reference to any address, so none may target one.
  if (new RegExp(`attributeName\\s*=\\s*(["'])${PREFIX}(href|src)\\1`, 'i').test(svg)) problems.push('animates a reference (attributeName href)');
  if (/javascript:/i.test(svg)) problems.push('has a javascript: address');
  if (/@import/i.test(svg)) problems.push('has a CSS @import');
  // A CSS escape can spell `url(` without the letters, so style text may hold none.
  const styleTexts = [...svg.matchAll(/<(?:[\w.-]+:)?style[\s>][\s\S]*?<\/(?:[\w.-]+:)?style>/gi), ...svg.matchAll(/\sstyle\s*=\s*(["'])(.*?)\1/gis)];
  if (styleTexts.some((m) => m[0].includes('\\'))) problems.push('has a CSS escape in a style');
  for (const m of svg.matchAll(new RegExp(`${PREFIX}href\\s*=\\s*(["'])(.*?)\\1`, 'gis'))) {
    if (!isLocal(m[2])) problems.push(`has the external reference href="${m[2].slice(0, 60)}"`);
  }
  for (const m of svg.matchAll(/\ssrc\s*=\s*(["'])(.*?)\1/gis)) {
    if (!isLocal(m[2])) problems.push(`has the external reference src="${m[2].slice(0, 60)}"`);
  }
  for (const m of svg.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi)) {
    if (!isLocal(m[2])) problems.push(`has the external reference url(${m[2].slice(0, 60)})`);
  }
  for (const m of svg.matchAll(/image-set\(\s*(["'])(.*?)\1/gis)) {
    if (!isLocal(m[2])) problems.push(`has the external reference image-set(${m[2].slice(0, 60)})`);
  }
  return problems;
}

/**
 * An animated SVG must hold no script and no external reference, and must stay within its size budget.
 * @param {string} name
 * @param {string} svg
 * @param {number} [maxBytes] Default: the `ransomSvg` budget of the pack.
 * @returns {CheckResult[]}
 */
export function checkAnimatedSvg(name, svg, maxBytes = budgets.ransomSvg) {
  const problems = findSvgProblems(svg);
  return [
    checkSize(name, Buffer.byteLength(svg), maxBytes),
    {
      name: `${name} self-contained`,
      ok: problems.length === 0,
      message: problems.length ? problems.join('; ') : 'no script, no event handler and no external reference',
    },
  ];
}

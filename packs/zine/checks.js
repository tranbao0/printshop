// Checks for the output of the zine pack.
import { checkSize } from '../../src/core/checks.js';

/** @typedef {import('../../src/core/checks.js').CheckResult} CheckResult */

/**
 * The size budgets of the pack, in bytes. A build fails when a file is over its budget.
 * `ransomSvg`: an animated title with its base image and its letters, all inside the file.
 * `page`: one still page as a palette PNG, 1600 px wide.
 * `card`: one half-width card or tag as a palette PNG, 800 px wide.
 */
export const budgets = Object.freeze({ ransomSvg: 150_000, page: 450_000, card: 200_000 });

/** Elements that run code or load another document. */
const FORBIDDEN_ELEMENTS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'link'];

/**
 * Whether a reference stays inside the file: a data URI or a fragment of the document.
 * @param {string} value
 */
const isLocal = (value) => /^\s*(data:|#)/i.test(value);

/**
 * Finds what an SVG file may not hold: script, event handler attributes, and any reference to something outside the file.
 * The only references allowed are data URIs and fragments (`#id`).
 * @param {string} svg
 * @returns {string[]} One line for each problem found.
 */
export function findSvgProblems(svg) {
  /** @type {string[]} */
  const problems = [];
  for (const name of FORBIDDEN_ELEMENTS) {
    if (new RegExp(`<${name}[\\s>/]`, 'i').test(svg)) problems.push(`has a <${name}> element`);
  }
  if (/<!(DOCTYPE|ENTITY)/i.test(svg) || /<\?xml-stylesheet/i.test(svg)) problems.push('has a DOCTYPE, an ENTITY or an xml-stylesheet');
  for (const m of svg.matchAll(/\son[a-z]+\s*=/gi)) problems.push(`has the event handler attribute ${m[0].trim()}`);
  if (/javascript:/i.test(svg)) problems.push('has a javascript: address');
  if (/@import/i.test(svg)) problems.push('has a CSS @import');
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gis)) {
    if (!isLocal(m[2])) problems.push(`has the external reference href="${m[2].slice(0, 60)}"`);
  }
  for (const m of svg.matchAll(/\ssrc\s*=\s*(["'])(.*?)\1/gis)) {
    if (!isLocal(m[2])) problems.push(`has the external reference src="${m[2].slice(0, 60)}"`);
  }
  for (const m of svg.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi)) {
    if (!isLocal(m[2])) problems.push(`has the external reference url(${m[2].slice(0, 60)})`);
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

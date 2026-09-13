/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A stylesheet as the window receives it, and the rules in it.
 *
 * For tests about what jsdom cannot show — motion, dimming, which elements
 * arrive when — held against the compiled CSS rather than the Sass source, so
 * a mixin or a loop is checked for what it actually emits.
 */

import { execFileSync } from 'child_process';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..');
const STYLES_DIR = path.join(ROOT, 'src', 'renderer', 'styles');

/**
 * Compiles one of the renderer's stylesheets.
 *
 * Through the Sass command line in a child process rather than `compile`:
 * under jsdom's export conditions Sass resolves its browser build, which
 * cannot read files, and a test that renders components needs jsdom.
 */
export const compileStylesheet = (file: string): string =>
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'sass', 'sass.js'),
      '--no-source-map',
      `--load-path=${STYLES_DIR}`,
      path.join(STYLES_DIR, file),
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

export interface IRule {
  /** Each selector of the rule, split on the commas between them. */
  selectors: string[];
  declarations: Map<string, string>;
  /** The at-rules it sits inside, outermost first. */
  within: string[];
}

/** Splits on top-level commas, so `:is(a, b)` stays one selector. */
const splitSelectors = (prelude: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < prelude.length; at += 1) {
    if (prelude[at] === '(') {
      depth += 1;
    } else if (prelude[at] === ')') {
      depth -= 1;
    } else if (prelude[at] === ',' && depth === 0) {
      parts.push(prelude.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

const parseDeclarations = (body: string): Map<string, string> =>
  new Map(
    body
      .split(';')
      .map((line) => line.trim())
      .filter((line) => line.includes(':') && !line.includes('{'))
      .map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );

/** Every `{ … }` block directly in `css`, braces balanced. */
const blocks = (css: string): { prelude: string; body: string }[] => {
  const found: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let at = 0; at < css.length; at += 1) {
    if (css[at] === '{') {
      if (depth === 0) {
        open = at;
      }
      depth += 1;
    } else if (css[at] === '}') {
      depth -= 1;
      if (depth === 0) {
        found.push({
          prelude: css.slice(start, open).trim(),
          body: css.slice(open + 1, at),
        });
        start = at + 1;
      }
    }
  }
  return found;
};

/** Every style rule, at any depth, outside `@keyframes`. */
export const styleRules = (css: string, within: string[] = []): IRule[] =>
  blocks(css).flatMap(({ prelude, body }) => {
    if (prelude.startsWith('@keyframes')) {
      return [];
    }
    if (prelude.startsWith('@')) {
      return styleRules(body, [...within, prelude]);
    }
    return [
      {
        selectors: splitSelectors(prelude),
        declarations: parseDeclarations(body),
        within,
      },
    ];
  });

/** The rules outside any media or container query. */
export const baseRules = (css: string): IRule[] =>
  styleRules(css).filter(({ within }) => within.length === 0);

/** The frames of `@keyframes name`, keyed by selector (`from`, `50%`, `to`). */
export const keyframes = (
  css: string,
  name: string,
): Map<string, Map<string, string>> => {
  const found = blocks(css).find(
    ({ prelude }) => prelude === `@keyframes ${name}`,
  );
  if (!found) {
    throw new Error(`no @keyframes ${name}`);
  }
  return new Map(
    blocks(found.body).map(({ prelude, body }) => [
      prelude,
      parseDeclarations(body),
    ]),
  );
};

/** The keyframes an `animation` shorthand names: its first word. */
export const animationName = (shorthand: string | undefined): string =>
  (shorthand ?? 'none').split(/\s+/)[0];

/**
 * The value `property` is given for `selector` by the base rules, the last
 * declaration winning as it does for rules of equal specificity.
 */
export const baseValue = (
  css: string,
  selector: string,
  property: string,
): string | undefined =>
  baseRules(css)
    .filter((rule) => rule.selectors.includes(selector))
    .reduce<string | undefined>(
      (value, rule) => rule.declarations.get(property) ?? value,
      undefined,
    );

/** `a > :is(b, c)` as `a > b` and `a > c`, which jsdom can match everywhere. */
export const expandIs = (selector: string): string[] => {
  const match = /^(.*):is\((.*)\)(.*)$/.exec(selector);
  if (!match) {
    return [selector];
  }
  const [, before, inside, after] = match;
  return splitSelectors(inside).map((each) => `${before}${each}${after}`);
};

/** The highest `N` among selectors written `${prefix}:nth-child(N)`. */
export const highestNthChild = (css: string, prefix: string): number =>
  baseRules(css)
    .flatMap(({ selectors }) => selectors)
    .reduce((highest, selector) => {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp(`^${escaped}:nth-child\\((\\d+)\\)$`).exec(
        selector,
      );
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

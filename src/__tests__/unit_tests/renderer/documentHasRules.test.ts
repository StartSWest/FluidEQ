/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * No `:has()` asked of the whole document.
 *
 * A `:has()` on `body`, `html`, `:root` or `#root` is a question about
 * everything under it, so the browser has to be ready to ask it again after a
 * change anywhere in the window. The notices hid one another that way, and
 * full screen was read that way; both are decided in React now
 * (`noticeTurn.ts`, `useAppFullMark.ts`), and nothing on screen can show that
 * a new one has come back — it costs style work on every change instead.
 *
 * One stays: the player window's shell (`_miniPlayerShell.scss`), whose
 * argument only reaches the root's and the body's own children and whose
 * anchor only matches while the window is the player at all.
 *
 * Held against the compiled CSS, so a rule nested under `body { &:has() }`
 * or produced by a mixin is seen as the selector it becomes.
 */

import { readdirSync } from 'fs';
import path from 'path';
import { compileString } from 'sass';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

/** The one rule allowed, as Sass prints it. */
const ALLOWED = [
  ':root[data-window-mode=player]:has(> body > .mini-player-host)',
];

/** The top-level compounds of a selector: split on combinators, not inside brackets. */
const compounds = (selector: string): string[] => {
  const found: string[] = [];
  let depth = 0;
  let current = '';
  Array.from(selector).forEach((char) => {
    if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    }
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current) {
        found.push(current);
      }
      current = '';
      return;
    }
    current += char;
  });
  if (current) {
    found.push(current);
  }
  return found;
};

const DOCUMENT_ANCHOR = /^(html|body|:root|#root)(?![\w-])/;

/** The compounds in `selector` that ask `:has()` of the whole document. */
const documentHasAnchors = (selector: string): string[] =>
  compounds(selector).filter(
    (compound) => compound.includes(':has(') && DOCUMENT_ANCHOR.test(compound),
  );

/** Splits a rule's prelude on top-level commas. */
const selectorsOf = (prelude: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  Array.from(prelude).forEach((char, at) => {
    if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push(prelude.slice(start, at));
      start = at + 1;
    }
  });
  parts.push(prelude.slice(start));
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

/** Every selector in `css` that carries a `:has(`, with the prelude it sits in. */
const hasSelectors = (css: string): string[] => {
  const found: string[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let start = 0;
  Array.from(text).forEach((char, at) => {
    if (char === '{' || char === '}' || char === ';') {
      const prelude = text.slice(start, at).trim();
      start = at + 1;
      if (
        char === '{' &&
        !prelude.startsWith('@') &&
        prelude.includes(':has(')
      ) {
        found.push(...selectorsOf(prelude));
      }
    }
  });
  return found;
};

describe('the detector', () => {
  it('finds a :has() asked of the document, and nothing else', () => {
    expect(documentHasAnchors('body:has(.a) .b')).toEqual(['body:has(.a)']);
    expect(
      documentHasAnchors('#root:has(> .app-workspace.is-app-full) .bar'),
    ).toEqual(['#root:has(> .app-workspace.is-app-full)']);
    expect(documentHasAnchors(':root:not(:has(.a)) .b')).toHaveLength(1);
    expect(documentHasAnchors('html:has(dialog[open])')).toHaveLength(1);
    // A :has() on an element inside the root is its own business.
    expect(
      documentHasAnchors(
        '#root:not(.is-chrome-idle) > .window-titlebar:has(~ .app-workspace)',
      ),
    ).toEqual([]);
    expect(documentHasAnchors('.library-workspace:has(.x .y)')).toEqual([]);
    expect(documentHasAnchors('#rooted:has(.x)')).toEqual([]);
    expect(documentHasAnchors(':root[data-app-full] #root .bar')).toEqual([]);
  });

  it('reads selectors out of compiled CSS', () => {
    expect(
      hasSelectors(
        '/* body:has(.c) */ .a{x:1}\nbody:has(.a, .b) .c, .d:has(.e){y:2}',
      ),
    ).toEqual(['body:has(.a, .b) .c', '.d:has(.e)']);
  });
});

describe('the stylesheets', () => {
  it('ask no :has() of the whole document outside the player shell', () => {
    // Every stylesheet a component imports, as one module graph: each shared
    // partial is compiled once rather than once per sheet, which halves the
    // time, and a rule is the same selector either way.
    const entries = readdirSync(STYLES_DIR)
      .filter((name) => name.endsWith('.scss') && !name.startsWith('_'))
      .map(
        (name, index) =>
          `@use '${name.slice(0, -'.scss'.length)}' as s${index};`,
      );
    const { css } = compileString(entries.join('\n'), {
      loadPaths: [STYLES_DIR],
      quietDeps: true,
    });
    const selectors = hasSelectors(css);
    // Positive control: the player shell's own rule is found, so a document
    // with none left is not a detector that sees nothing.
    expect(
      selectors.filter((selector) => documentHasAnchors(selector).length > 0),
    ).toContainEqual(
      expect.stringMatching(/^:root\[data-window-mode=player\]/),
    );
    const offenders = selectors.filter(
      (selector) =>
        documentHasAnchors(selector).length > 0 &&
        !ALLOWED.some((allowed) => selector.startsWith(allowed)),
    );
    expect([...new Set(offenders)]).toEqual([]);
  });
});

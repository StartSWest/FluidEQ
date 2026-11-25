/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's Code tab on the white window (Ivan, 2026-11-25: "The studio
 * code is too dark"). Its well was 32% black over the block, made for a dark
 * window, and on the white one it came out a mid grey (#aaa at Brightness
 * 100) under inks that stood on it at 1.8 to 3.9:1. On the white window the
 * well is now the floor, the grey the side columns stand on, and every kind
 * of word is drawn in an ink `codeInkTokens` solves on that floor
 * (`codeInks.test.ts` measures them). jsdom paints nothing, so what is held
 * here is the shape of the compiled rules: which surface and which ink each
 * part reads on the white window, beside the dark window's rule left as it
 * shipped.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const { css } = compile(path.join(STYLES_DIR, 'StudioCode.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
});

/** The declarations of the first rule whose selector is exactly `selector`. */
const declarationsOf = (selector: string) => {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) {
    throw new Error(`no rule for ${selector}`);
  }
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};

const WHITE = ':root[data-window-ink=dark]';

describe('the Code tab on the white window', () => {
  it.each(['.studio-code__editor', '.studio-code__diff'])(
    'stands %s on the floor, the grey the side columns stand on',
    (part) => {
      expect(declarationsOf(`${WHITE} ${part}`)).toMatch(
        /background:\s*var\(--surface-base\);/,
      );
    },
  );

  it.each([
    ['.studio-code__paint', '--code-studio-text'],
    ['.studio-code__row', '--code-studio-text'],
    ['.studio-code__gutter', '--code-studio-line'],
    ['.studio-code__num', '--code-studio-line'],
    ['.studio-code__skip', '--code-studio-line'],
    ['.studio-code__glsl--comment', '--code-studio-comment'],
    ['.studio-code__glsl--keyword', '--code-studio-keyword'],
    ['.studio-code__glsl--number', '--code-studio-number'],
    ['.studio-code__glsl--uniform', '--code-studio-uniform'],
    ['.studio-code__glsl--builtin', '--code-studio-builtin'],
    ['.studio-code__glsl--call', '--code-studio-call'],
  ])('draws %s in the ink solved on that floor, %s', (part, token) => {
    expect(declarationsOf(`${WHITE} ${part}`)).toMatch(
      new RegExp(`(^|;)\\s*color:\\s*var\\(${token}\\);`),
    );
  });

  it('gives an open file no fill: its chevron in the accent says it is open', () => {
    const open = `${WHITE} .studio-code__toggle[aria-expanded=true]`;
    expect(declarationsOf(open)).toMatch(/background:\s*none;/);
    expect(declarationsOf(`${open} .studio-code__chevron`)).toMatch(
      /stroke:\s*var\(--accent-light\);/,
    );
  });

  it('draws a file as steps of the floor with no edge round it', () => {
    expect(declarationsOf(`${WHITE} .studio-code__item`)).toMatch(
      /border-color:\s*transparent;/,
    );
    expect(declarationsOf(`${WHITE} .studio-code__item`)).toMatch(
      /background:\s*color-mix\(in srgb, var\(--surface-base\) 50%, var\(--surface-panel\)\);/,
    );
  });
});

describe('the dark window (the control)', () => {
  it.each(['.studio-code__editor', '.studio-code__diff'])(
    'keeps %s on the dark well it shipped with',
    (part) => {
      expect(declarationsOf(part)).toMatch(
        /background:\s*color-mix\(in srgb, #000000 32%, var\(--surface-block\)\);/,
      );
    },
  );

  it('reads none of the white window’s code inks outside its rules', () => {
    const outside = css
      .split('}')
      .filter(
        (rule) => !rule.includes(WHITE) && rule.includes('--code-studio-'),
      );
    expect(outside).toEqual([]);
  });
});

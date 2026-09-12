/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP page's layout rules, read from the compiled stylesheet.
 *
 * jsdom lays nothing out, so no rendered test could see the Exciter's dials
 * drawn over each other: five 78px knobs in a row that refused to wrap, inside
 * a band 290px wide, chosen by the window's HEIGHT on a narrow tall window.
 * What a test can hold is the shape of the rules that stop it — the page's
 * breakpoints on the standard scale, the height query changing density and
 * never arrangement, and dial rows that give way instead of overflowing.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const compiled = compile(path.join(STYLES_DIR, 'Dsp.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
}).css;

/** Tailwind's scale, which carries the classic 768, 1024 and 1280. */
const STANDARD_WIDTHS = [640, 768, 1024, 1280, 1536];
/** Full HD's height: the one density tier the page has. */
const STANDARD_HEIGHTS = [1080];

/** A property that decides where things go rather than how dense they are. */
const ARRANGEMENT = new Set([
  'display',
  'order',
  'flex-direction',
  'flex-wrap',
  'grid-auto-flow',
  'grid-column',
  'grid-row',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
]);

interface IBlock {
  prelude: string;
  body: string;
}

/** Every `{ … }` block at the top level of `css`, braces balanced. */
const blocks = (css: string): IBlock[] => {
  const found: IBlock[] = [];
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

/** Every block at any depth, with the at-rules it sits inside. */
const allBlocks = (
  css: string,
  within: string[] = [],
): (IBlock & { within: string[] })[] =>
  blocks(css).flatMap((block) =>
    block.prelude.startsWith('@')
      ? allBlocks(block.body, [...within, block.prelude])
      : [{ ...block, within }],
  );

const declarations = (body: string): Map<string, string> =>
  new Map(
    body
      .split(';')
      .map((line) => line.trim())
      .filter((line) => line.includes(':'))
      .map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );

/** Each size a query tests, as the axis and the number of pixels. */
const querySizes = (
  css: string,
): { query: string; axis: string; px: number }[] =>
  Array.from(css.matchAll(/@(?:media|container)([^{]*)\{/g)).flatMap(
    ([, query]) =>
      Array.from(
        query.matchAll(
          /(?:min-|max-)?(width|height)\s*(?::|[<>]=?)\s*([\d.]+)px/g,
        ),
      ).map(([, axis, px]) => ({ query: query.trim(), axis, px: Number(px) })),
  );

const offScale = (css: string) =>
  querySizes(css).filter(({ axis, px }) =>
    axis === 'width'
      ? !STANDARD_WIDTHS.includes(px)
      : !STANDARD_HEIGHTS.includes(px),
  );

/** Arrangement set inside a height query: the window deciding the layout. */
const arrangedByHeight = (css: string) =>
  allBlocks(css)
    .filter(({ within }) => within.some((query) => /height/.test(query)))
    .flatMap(({ prelude, body }) =>
      Array.from(declarations(body).keys())
        .filter((property) => ARRANGEMENT.has(property))
        .map((property) => `${prelude} { ${property} }`),
    );

/** Whether a dial row's tracks can give way below the knob size. */
const dialRowsShrink = (css: string) => {
  const rows = allBlocks(css).filter(
    ({ prelude, within }) =>
      within.length === 0 &&
      prelude.split(',').some((part) => part.trim() === '.dsp-band-dials'),
  );
  return rows.some((row) => {
    const declared = declarations(row.body);
    return (
      declared.get('display') === 'grid' &&
      /^minmax\(0,/.test(declared.get('grid-auto-columns') ?? '')
    );
  });
};

describe('the DSP stylesheet', () => {
  it('uses only standard breakpoints', () => {
    expect(querySizes(compiled).length).toBeGreaterThan(0);
    expect(offScale(compiled)).toEqual([]);
  });

  it('POSITIVE CONTROL: flags a width measured off one layout', () => {
    const measured =
      '@container dsp-card (max-width: 900px) { .x { color: red; } }\n' +
      '@media (max-height: 1100px) { .y { color: red; } }\n' +
      '@container dsp-card (width < 1024px) { .z { color: red; } }';
    expect(offScale(measured).map(({ px }) => px)).toEqual([900, 1100]);
  });

  it('lets the window height change density and never arrangement', () => {
    expect(
      allBlocks(compiled).some(({ within }) =>
        within.some((query) => /height/.test(query)),
      ),
    ).toBe(true);
    expect(arrangedByHeight(compiled)).toEqual([]);
  });

  it('POSITIVE CONTROL: flags the rule that laid the Exciter out by height', () => {
    const byHeight =
      '@media (max-height: 1100px) {\n' +
      '  #dsp-exciter .dsp-exciter-controls { grid-template-columns: minmax(0, 1fr); gap: 8px; }\n' +
      '  #dsp-exciter .knob { width: 64px; }\n' +
      '}';
    expect(arrangedByHeight(byHeight)).toEqual([
      '#dsp-exciter .dsp-exciter-controls { grid-template-columns }',
    ]);
  });

  it('gives every dial row tracks that narrow instead of overflowing', () => {
    expect(dialRowsShrink(compiled)).toBe(true);
    const knob = allBlocks(compiled).find(
      ({ prelude }) =>
        prelude.includes('.dsp-band-dials') && prelude.endsWith('.knob'),
    );
    expect(knob && declarations(knob.body).get('width')).toBe('100%');
    expect(knob && declarations(knob.body).get('aspect-ratio')).toBe('1');
  });

  it('POSITIVE CONTROL: the row that overlapped does not pass', () => {
    const overlapping =
      '.dsp-band-dials { display: flex; gap: 2px; flex-wrap: wrap; }\n' +
      '.dsp-exciter-controls .dsp-band-dials { justify-content: center; flex-wrap: nowrap; }';
    expect(dialRowsShrink(overlapping)).toBe(false);
  });
});

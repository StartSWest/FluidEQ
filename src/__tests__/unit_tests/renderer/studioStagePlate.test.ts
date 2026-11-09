/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio stage's plate is one row on one middle line (Ivan, 2026-11-09,
 * circling "Runs smoothly": "center this"; and "With the music" cut against
 * the divider). The reading is one line there - light, words and figures -
 * where the card down the column keeps its two; the figures fold away on a
 * stage too narrow to carry them; the drawings never give way, so the words
 * of what the scene hears are what is cut short, with an ellipsis and room
 * for their last letter. jsdom lays nothing out, so what is held is the
 * compiled rule; each was measured in the harness (`getBoundingClientRect`)
 * at 2560, 1600, the 1024 floor and the 284x121 stage.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

// Without its comments: a `/** */` block is kept in the compiled sheet and
// would stand in front of the selector under it.
const compiled = (file: string) =>
  compile(path.join(STYLES_DIR, file), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  })
    .css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

const stage = compiled('StudioStage.scss');
const work = compiled('StudioWork.scss');

/** The declarations of the plain rule with exactly this selector. */
const bodyOf = (css: string, selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, found, body]) => ({ found: found.trim(), body }))
    .find(({ found }) => found === selector)?.body ?? '';

/** What a container query holds, up to the end of its block. */
const queryOf = (css: string, condition: string) => {
  const start = css.indexOf(`@container studio-stage (${condition})`);
  if (start < 0) {
    return '';
  }
  let depth = 0;
  for (let at = css.indexOf('{', start); at < css.length; at += 1) {
    if (css[at] === '{') {
      depth += 1;
    }
    if (css[at] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(start, at + 1);
      }
    }
  }
  return '';
};

describe('the reading on the stage’s plate', () => {
  it('is one line, its light, words and figures centred on the plate’s middle', () => {
    const reading = bodyOf(stage, '.studio-stage__reading');
    expect(reading).toContain('display: inline-flex');
    expect(reading).toContain('align-items: center');
    // The row's whole height, so the hairline after it matches the others.
    expect(reading).toContain('align-self: stretch');
    expect(reading).toContain('white-space: nowrap');
    expect(
      bodyOf(stage, '.studio-stage__reading .studio-cost__reading'),
    ).toContain('grid-column: auto');
  });

  it('control: the card down the column keeps its two lines', () => {
    expect(bodyOf(stage, '.studio-cost')).toContain('display: grid');
    expect(bodyOf(stage, '.studio-cost__reading')).toContain('grid-column: 2');
  });

  it('folds its figures away on a stage too narrow to carry them', () => {
    const narrow = queryOf(work, 'max-width: 720px');
    expect(narrow).toContain('.studio-stage__bar .studio-cost__reading');
    expect(narrow).toContain('display: none');
  });
});

describe('the plate’s one row', () => {
  it('never lets the drawings give way', () => {
    expect(bodyOf(work, '.studio-stage__tools')).toContain('flex: none');
  });

  it('cuts the words of what the scene hears short with an ellipsis, never at the letter', () => {
    const label = bodyOf(stage, '.studio-stage-motion__label');
    expect(label).toContain('min-width: 0');
    expect(label).toContain('overflow: hidden');
    expect(label).toContain('text-overflow: ellipsis');
    expect(label).toContain('max-width: 20em');
    // The clip a little past the last letter, taken back from the layout.
    expect(label).toContain('padding-inline-end: 0.15em');
    expect(label).toContain('margin-inline-end: -0.15em');
    // Its button is what may narrow, the plate's other parts never.
    expect(
      bodyOf(stage, '.studio-stage__bar .studio-stage-motion__button'),
    ).toContain('flex: 0 1 auto');
  });

  it('control: a small stage still folds the words to their glyphs', () => {
    const small = queryOf(work, 'max-width: 440px');
    expect(small).toContain('.studio-stage__bar .studio-stage__reading');
    expect(small).toContain('.studio-stage__bar .studio-stage-motion__button');
    expect(small).toContain('font-size: 0');
  });
});

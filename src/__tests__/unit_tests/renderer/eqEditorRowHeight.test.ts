/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The row under the bands, and what the bands are measured from.
 *
 * Two rows stand in that one place: the selected band's editor, and — with
 * nothing selected — the Tone row, whose dials are deliberately bigger. The
 * bands above them used to be sized from the pane's height less a constant
 * for everything that is not track, and that constant could only ever match
 * one of the two rows: on a 1545x1105 window the page fitted with a band
 * selected and scrolled by twelve pixels the moment the selection was dropped
 * (Ivan, 2026-09-23: "the tone pane ... is bigger than the band setting
 * pane"). jsdom lays nothing out and no rendered test can see a scrollbar, so
 * what is held here is the shape of the rules that stop it.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const compiled = compile(path.join(STYLES_DIR, 'MainContent.scss'), {
  loadPaths: [STYLES_DIR],
  quietDeps: true,
}).css;

interface IBlock {
  prelude: string;
  body: string;
  within: string[];
}

/** Every rule in `css`, with the at-rules it sits inside. */
const rules = (css: string, within: string[] = []): IBlock[] => {
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
        const prelude = css.slice(start, open).trim();
        const body = css.slice(open + 1, at);
        if (prelude.startsWith('@')) {
          found.push(...rules(body, [...within, prelude]));
        } else {
          found.push({ prelude, body, within });
        }
        start = at + 1;
      }
    }
  }
  return found;
};

const all = rules(compiled);

/** The value of `property` in the last rule whose selector is exactly `selector`. */
const declared = (
  selector: string,
  property: string,
  inside?: RegExp,
): string | undefined => {
  const matches = all.filter(
    (rule) =>
      rule.prelude.split(',').some((part) => part.trim() === selector) &&
      (inside
        ? rule.within.some((query) => inside.test(query))
        : rule.within.length === 0),
  );
  const values = matches
    .flatMap((rule) =>
      rule.body
        .split(';')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(`${property}:`))
        .map((line) => line.slice(property.length + 1).trim()),
    )
    .filter(Boolean);
  return values[values.length - 1];
};

const SHORT = /max-height:\s*1100px/;

describe('the row under the EQ bands', () => {
  it('measures the bands from the room left, never from a constant', () => {
    const length = declared('.bandWrapper .range', '--range-length');
    expect(length).toBeDefined();
    // The rail is a size container, so `100cqh` is the band row's own height.
    expect(length).toContain('100cqh');
    // The pane's height less a fixed allowance is what could not know which
    // of the two rows was showing.
    expect(length).not.toContain('--editor-height');
  });

  it('reserves the taller of the two rows, so neither state moves the bands', () => {
    expect(declared('.eq-flat-editor', 'min-height')).toBe('100px');
    // And gives it back where the two rows are already one box, rather than
    // holding a floor of zero that lets the row squash under its controls.
    expect(declared('.eq-flat-editor', 'min-height', SHORT)).toBe('auto');
  });

  it('POSITIVE CONTROL: the Tone row is the taller one, and only above that tier', () => {
    // If these two were ever the same, the reservation above would be dead
    // weight — and this is the measurement the reservation is made from.
    expect(
      declared('.eq-flat-editor.eq-flat-editor--tone .knob', 'height'),
    ).toBe('68px');
    expect(
      declared('.eq-flat-editor.eq-flat-editor--tone .knob', 'height', SHORT),
    ).toBe('52px');
  });

  it('grows the grid to the panel so the bands can give way', () => {
    const grid =
      '.workspace-tab-panel--eq .workspace-tab-panel__scroll > .main-content';
    expect(declared(grid, 'flex')).toBe('1 0 0');
    expect(declared(grid, 'align-content')).toBe('start');
    // A floor-length band and a ceiling-length one, each with the 114px of
    // caption, arrows and readout a band carries around its track.
    expect(declared(grid, 'grid-template-rows')).toBe(
      'minmax(186px, 378px) auto',
    );
  });
});

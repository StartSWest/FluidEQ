/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the EQ's dB scale stands (Ivan, 2026-11-17: "freeze the EQ values on
 * the left", "fix the bands' left scroll"). While the bands are placed they
 * may stand centred far from the column, and the scale goes with them, 6px
 * off the first band's column (`--eq-first-band`) so the band's hover face
 * stays off the numbers. On a row that scrolls the anchor is read at the
 * row's unscrolled place, which shoved the scale onto the arrow back, so
 * there it holds the edge of its own column. jsdom lays nothing out: the
 * compiled stylesheet is what is held.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '__tests__/utils/stylesheetRules';

const RULES = styleRules(compileStylesheet('MainContent.scss')).filter(
  ({ within }) => within.length === 0,
);

/** The last value `property` is given by a rule naming exactly `selector`. */
const declared = (selector: string, property: string): string | undefined =>
  RULES.filter(
    ({ selectors, declarations }: IRule) =>
      selectors.includes(selector) && declarations.has(property),
  )
    .map(({ declarations }) => declarations.get(property))
    .pop();

describe('the dB scale beside the bands', () => {
  it('holds the edge of its own column on a row that scrolls', () => {
    expect(declared('.eq-scale', 'right')).toBe('0');
    // Never read off the first band there: its anchor is the unscrolled row.
    expect(declared('.eq-scale', 'right')).not.toContain('--eq-first-band');
    // Its own column: the first of the bands' row, out of the row's flow.
    expect(declared('.main-content > .eq-scale', 'grid-column')).toBe('1/2');
    expect(declared('.main-content > .eq-scale', 'position')).toBe('absolute');
  });

  it('stands 6px off the first band’s column while the bands are placed', () => {
    const placed = declared('.main-content.is-placed > .eq-scale', 'right');
    expect(placed).toContain('anchor(--eq-first-band left');
    expect(placed).toContain('6px');
  });

  it('stands on the first band’s travel, top to bottom, at every length', () => {
    expect(declared('.eq-scale', 'top')).toContain('anchor(--eq-travel top');
    expect(declared('.eq-scale', 'bottom')).toContain(
      'anchor(--eq-travel bottom',
    );
  });
});

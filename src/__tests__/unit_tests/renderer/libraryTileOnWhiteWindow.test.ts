/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song with no cover gets a generated tile: its initials over a deep hue
 * (`libraryTileBackground`, 34% and 20% lightness), on every window. Written
 * in the window's ink, the initials turned near-black on a white window and
 * stood at 2:1 at best on the hue, in the Library, the bar and the amp (Ivan,
 * 2026-11-24, the white theme). jsdom paints nothing, so the compiled rule
 * is what is held.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';

describe('a song’s generated cover on a white window', () => {
  it('keeps its initials white', () => {
    const rules = styleRules(compileStylesheet('Library.scss'));
    const colours = rules
      .filter((rule) =>
        rule.selectors.includes(`${LIGHT} .library-cover-art__tile`),
      )
      .map((rule) => rule.declarations.get('color'));
    expect(colours).toEqual(['#ffffff']);
    // Positive control: on a dark window the initials are the window's ink,
    // as they always were.
    expect(
      rules
        .filter((rule) => rule.selectors.includes('.library-cover-art__tile'))
        .map((rule) => rule.declarations.get('color'))
        .filter(Boolean),
    ).toContain('var(--text-primary)');
  });
});

/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The neon yellow (#ffe66d) is a light: on a white window it stands at
 * 1.2:1. The Library's favourite star wore it, and three lines of words -
 * the output profile's "editing" note, the extra output's latency, the
 * output's Editing/Done key while pressed (2026-11-24, the white theme). On
 * a light window the star takes a deep gold of the same hue (`$ink-star`)
 * and the words the caution ink (`$ink-caution`); a dark window keeps the
 * yellow. jsdom paints nothing, so the compiled rules are what is held.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';

const colourOf = (sheet: string, selector: string) =>
  styleRules(compileStylesheet(sheet))
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.declarations.get('color'))
    .filter(Boolean);

describe('the neon yellow on a white window', () => {
  it('paints the favourite star in the star ink, a deep gold on white', () => {
    expect(colourOf('Library.scss', '.library-list__badge--favorite')).toEqual([
      'var(--ink-star, #ffe66d)',
    ]);
    const light = styleRules(compileStylesheet('App.scss'))
      .filter((rule) => rule.selectors.includes('html[data-window-ink=dark]'))
      .map((rule) => rule.declarations.get('--ink-star'))
      .filter(Boolean);
    expect(light).toEqual(['oklch(from #ffe66d 0.62 0.15 h)']);
  });

  it.each([
    ['DeviceProfiles.scss', '.device-profiles__editing'],
    ['ExtraOutputs.scss', '.extra-outputs__latency'],
    [
      'OutputEditButton.scss',
      '.link-button.output-edit-button[aria-pressed=true]',
    ],
  ])('writes %s words in the caution ink on white', (sheet, selector) => {
    // Positive control: the dark window's rule is the yellow, as before.
    expect(colourOf(sheet, selector)).toContain('#ffe66d');
    expect(colourOf(sheet, `${LIGHT} ${selector}`)).toEqual([
      'var(--ink-caution, #ffb059)',
    ]);
  });
});

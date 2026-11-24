/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A member's name in their own hue (the Scenes rail's account card, the
 * gallery's maker page, the profile name preview) is a light of that hue at
 * 80% lightness: on a white window it stood at 1.8:1 (2026-11-24, the white
 * theme). There it is the same hue held under the light window's ink
 * ceiling (`readable-ink`, `--ink-ceiling` 0.5 in `App.scss`), and a dark
 * window keeps its light. jsdom paints nothing, so the compiled rules are
 * what is held.
 */

import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';

describe('a member’s name in their own hue on a white window', () => {
  const rules = styleRules(compileStylesheet('CommunityRail.scss'));
  const colours = (selector: string) =>
    rules
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations.get('color'))
      .filter(Boolean);

  it('is held under the light window’s ink ceiling', () => {
    const light = colours(`${LIGHT} .community__name--hued`);
    expect(light).toHaveLength(1);
    expect(light[0]).toContain('var(--identity-hue');
    expect(light[0]).toContain('min(l, var(--ink-ceiling');
  });

  // The account card's hover glow, a coloured smudge on white: none there,
  // kept on a dark window.
  it('lifts the account card under the pointer with no glow on white', () => {
    const shadow = (selector: string) =>
      rules
        .filter((rule) => rule.selectors.includes(selector))
        .map((rule) => rule.declarations.get('box-shadow'))
        .filter(Boolean);
    expect(shadow('.community__account:hover').join(' ')).toContain('16px');
    expect(shadow(`${LIGHT} .community__account:hover`)).toEqual(['none']);
  });

  it('keeps its light on a dark window', () => {
    expect(colours('.community__name--hued')).toEqual([
      'hsl(var(--identity-hue, 170deg), 80%, 80%)',
    ]);
  });
});

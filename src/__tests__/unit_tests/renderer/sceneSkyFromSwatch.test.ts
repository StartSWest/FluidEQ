/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's colour before it is measured: its swatch read as a tiny picture
 * (`skyFromSwatch`), so the window takes a scene's colour as it is chosen
 * rather than after it has loaded (Ivan, 2026-09-25: "I want the color to
 * change first then it loads the viz").
 */

import { hueDistance } from '../../../renderer/utils/oklab';
import { skyFromSwatch } from '../../../renderer/utils/sceneTint';

describe('a sky from a swatch', () => {
  it('takes the hue of the colour listed first', () => {
    const sky = skyFromSwatch(['#0b2a33', '#3fd9c4', '#b8fff2']);
    expect(sky).toBeDefined();
    // Teal: OKLCH hue around 200 degrees for #0b2a33.
    expect(hueDistance(sky?.hue ?? 0, 210)).toBeLessThan(30);
  });

  it('keeps a second colour well apart from it as the accent', () => {
    const sky = skyFromSwatch(['#1a1440', '#d95a3f', '#ffcf6b']);
    expect(sky).toBeDefined();
    expect(sky?.accent).not.toBeNull();
    expect(hueDistance(sky?.hue ?? 0, sky?.accent?.hue ?? 0)).toBeGreaterThan(
      50,
    );
  });

  it('lends nothing from no colours, or from colours it cannot read', () => {
    expect(skyFromSwatch([])).toBeUndefined();
    expect(skyFromSwatch(['not a colour'])).toBeUndefined();
  });
});

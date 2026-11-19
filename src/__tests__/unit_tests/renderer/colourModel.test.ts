/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one colour model (Ivan, 2026-11-17, option A): the Brightness alone
 * says light or dark, a light window stays white whatever is named (only the
 * accent and the glow carry colour there), picking a surface across the line
 * moves the Brightness, a scene's time of day reads the Brightness's own
 * number, and the EQ page's panels never thin into the mid-greys over the
 * picture behind them.
 *
 * Each case stands beside a control that shows it is not passing by
 * returning one answer for everything.
 */

import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import { daylightOfShade } from 'renderer/graph/sceneDaylight';
import {
  SECTION_FACE_ALPHA,
  scenePanelFloor,
} from 'renderer/graph/scenePanelFloor';
import {
  contrast,
  luminance,
  parseCssColour,
  toGamma,
  toLinear,
} from 'renderer/utils/oklab';
import pickedWindow from 'renderer/utils/pickedWindow';
import {
  DARK_END_SHADE,
  THEME_SHADE_MAX,
  themeShadeTokens,
} from 'renderer/utils/themeShade';

/** Crystal's colours as Ivan picked them: a white surface, a deep violet. */
const CRYSTAL = { surface: '#ffffff', accent: '#342942', glow: '#342942' };
/** A pack naming a dark window: a deep plum floor. */
const PLUM = { surface: '#1d1030', accent: '#c48bff', glow: '#7cf0b0' };

const lum = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  return luminance(parsed.rgb.map(toLinear));
};

describe('named colours under the Brightness', () => {
  it('wear a white surface as a dark window below the line', () => {
    const dark = pickedWindow(CRYSTAL, 20);
    expect(dark?.ink).toBe('light');
    // As dark as the theme's own window there, never the white it names.
    expect(lum(dark?.tokens['--surface-panel'] ?? '')).toBeLessThan(0.1);
    // CONTROL: the same colours past the line are the white they name.
    const light = pickedWindow(CRYSTAL, THEME_SHADE_MAX);
    expect(light?.ink).toBe('dark');
    expect(light?.tokens['--surface-panel']).toBe('#ffffff');
  });

  it('wear a dark surface as a light window past the line', () => {
    const light = pickedWindow(PLUM, 90);
    expect(light?.ink).toBe('dark');
    expect(lum(light?.tokens['--surface-panel'] ?? '')).toBeGreaterThan(0.6);
    // CONTROL: on the dark side the floor is the plum as named.
    const dark = pickedWindow(PLUM, DARK_END_SHADE);
    expect(dark?.ink).toBe('light');
    expect(lum(dark?.tokens['--surface-base'] ?? '')).toBeCloseTo(
      lum(PLUM.surface),
      3,
    );
  });

  it('leave a light window white and grey, whatever surface is named', () => {
    // Ivan, 2026-11-17: past the line the window stays white so the accent
    // can be seen; no named surface, dark or light, tints the panes.
    const panel = parseCssColour(
      pickedWindow(PLUM, 90)?.tokens['--surface-panel'] ?? '',
    );
    expect(panel?.rgb[0]).toBeCloseTo(panel?.rgb[1] ?? -1, 6);
    expect(panel?.rgb[2]).toBeCloseTo(panel?.rgb[1] ?? -1, 6);
    expect(pickedWindow(PLUM, THEME_SHADE_MAX)?.tokens['--surface-panel']).toBe(
      '#ffffff',
    );
    // The accent is still the plum's own violet there: the colour lives in it.
    const accent = parseCssColour(
      pickedWindow(PLUM, 90)?.tokens['--accent'] ?? '',
    );
    expect(accent?.rgb[2]).toBeGreaterThan(accent?.rgb[1] ?? 1);
    // CONTROL: on the dark side the same colours put Plum's hue in the panes,
    // blue over green and red over green.
    const dark = parseCssColour(
      pickedWindow(PLUM, DARK_END_SHADE)?.tokens['--surface-panel'] ?? '',
    );
    expect(dark?.rgb[2]).toBeGreaterThan(dark?.rgb[1] ?? 1);
    expect(dark?.rgb[0]).toBeGreaterThan(dark?.rgb[1] ?? 1);
  });

  it('walk a light window from the soft grey at the line to white at 100', () => {
    const atLine = lum(
      pickedWindow(CRYSTAL, DARK_END_SHADE + 1)?.tokens['--surface-panel'] ??
        '',
    );
    const atTop = lum(
      pickedWindow(CRYSTAL, THEME_SHADE_MAX)?.tokens['--surface-panel'] ?? '',
    );
    expect(atLine).toBeLessThan(atTop);
    // The theme's own light window stands at the same place at the line.
    expect(atLine).toBeCloseTo(
      lum(themeShadeTokens(DARK_END_SHADE + 1)['--surface-panel']),
      1,
    );
  });
});
describe('a scene’s time of day following the Brightness', () => {
  it('reads the same number as the Brightness, night at 0 and day at 100', () => {
    // Ivan, 2026-11-17: "why 66 and not 50 ... the same as the brightness".
    expect(daylightOfShade(0)).toBe(SCENE_DAYLIGHT_MIN);
    expect(daylightOfShade(THEME_SHADE_MAX)).toBe(SCENE_DAYLIGHT_MAX);
    expect(daylightOfShade(50)).toBeCloseTo(50, 9);
    expect(daylightOfShade(DARK_END_SHADE)).toBeCloseTo(DARK_END_SHADE, 9);
    // CONTROL: not the dark stretch's own scale, which put full day at the
    // line and Brightness 50 at 66% of the day beside it in the same menu.
    expect(daylightOfShade(DARK_END_SHADE)).toBeLessThan(SCENE_DAYLIGHT_MAX);
    expect(daylightOfShade(50)).toBeLessThan(60);
  });
});

describe('the EQ page’s panels over a picture', () => {
  const LIGHT_PANEL = '#ffffff';
  const LIGHT_INKS = [
    { colour: '#071f20', contrast: 7 },
    { colour: '#344d4e', contrast: 4.5 },
  ];
  const DARK_PANEL = '#0c0e12';
  const DARK_INKS = [
    { colour: '#ecf5fb', contrast: 7 },
    { colour: '#d6e9f7', contrast: 4.5 },
  ];

  /** The contrast the floor leaves, composited as the browser does. */
  const leftAt = (
    floor: number,
    picture: number,
    panel: string,
    ink: string,
  ) => {
    const face = parseCssColour(panel);
    const alpha = (floor / 100) * SECTION_FACE_ALPHA;
    const behind = toGamma(picture);
    const ground = luminance(
      (face?.rgb ?? [0, 0, 0]).map((channel) =>
        toLinear(alpha * channel + (1 - alpha) * behind),
      ),
    );
    return contrast(lum(ink), ground);
  };

  it('keep a light window’s card over a night sky readable', () => {
    const floor = scenePanelFloor(0.005, LIGHT_PANEL, LIGHT_INKS);
    expect(floor).toBeGreaterThan(50);
    expect(leftAt(floor, 0.005, LIGHT_PANEL, '#071f20')).toBeGreaterThanOrEqual(
      7,
    );
    // CONTROL: over a pale sky the same card may be as clear as chosen.
    expect(scenePanelFloor(0.85, LIGHT_PANEL, LIGHT_INKS)).toBe(0);
  });

  it('keep a dark window’s card over a pale sky readable', () => {
    const floor = scenePanelFloor(0.85, DARK_PANEL, DARK_INKS);
    expect(floor).toBeGreaterThan(50);
    expect(leftAt(floor, 0.85, DARK_PANEL, '#ecf5fb')).toBeGreaterThanOrEqual(
      7,
    );
    // CONTROL: over a night sky it lets the picture through.
    expect(scenePanelFloor(0.005, DARK_PANEL, DARK_INKS)).toBe(0);
  });

  it('asks for no more than the full face, and nothing for no reading', () => {
    expect(scenePanelFloor(0.4, '#808080', DARK_INKS)).toBe(100);
    expect(scenePanelFloor(Number.NaN, DARK_PANEL, DARK_INKS)).toBe(0);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one colour model (Ivan, 2026-11-17, option A): the Brightness alone
 * says light or dark, named colours across the line lend their hue, picking
 * a surface across it moves the Brightness, a scene's time of day walks the
 * dark stretch, and the EQ page's panels never thin into the mid-greys over
 * the picture behind them.
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
import pickedWindow, {
  shadeForPickedSurface,
} from 'renderer/utils/pickedWindow';
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

  it('keep the colour of a dark surface lent to a light window, faintly', () => {
    const panel = parseCssColour(
      pickedWindow(PLUM, 90)?.tokens['--surface-panel'] ?? '',
    );
    // Plum's hue in it: blue over green, red over green.
    expect(panel?.rgb[2]).toBeGreaterThan(panel?.rgb[1] ?? 1);
    expect(panel?.rgb[0]).toBeGreaterThan(panel?.rgb[1] ?? 1);
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

describe('picking a surface in the editor', () => {
  it('moves the Brightness across the line only when the surface is across it', () => {
    expect(shadeForPickedSurface('#ffffff', 30)).toBe(THEME_SHADE_MAX);
    expect(shadeForPickedSurface('#1d1030', 90)).toBe(DARK_END_SHADE);
    // CONTROL: a surface on the Brightness's side leaves it where it is.
    expect(shadeForPickedSurface('#ffffff', 90)).toBe(90);
    expect(shadeForPickedSurface('#1d1030', 30)).toBe(30);
  });
});

describe('a scene’s time of day following the Brightness', () => {
  it('reaches full day at the top of the dark stretch, and stays there', () => {
    expect(daylightOfShade(0)).toBe(SCENE_DAYLIGHT_MIN);
    expect(daylightOfShade(DARK_END_SHADE)).toBe(SCENE_DAYLIGHT_MAX);
    expect(daylightOfShade(THEME_SHADE_MAX)).toBe(SCENE_DAYLIGHT_MAX);
    // CONTROL: half the dark stretch is half the day, not the whole slider's
    // share of it, which put a dark window's top at 76% of the day.
    expect(daylightOfShade(DARK_END_SHADE / 2)).toBeCloseTo(
      (SCENE_DAYLIGHT_MIN + SCENE_DAYLIGHT_MAX) / 2,
      5,
    );
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

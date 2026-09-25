/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window-colours menu's Brightness under a visualizer's colours: the
 * theme's own slider, walking the tinted window from its darkest — the
 * visualizer's colour, never black — to its lightest, under the ceiling
 * where the app's light text still reads (Ivan, 2026-09-25: "if ambient is on
 * is not black is ambient color … dark to more lighter").
 */

import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import type { ISceneSky } from 'renderer/utils/sceneTint';
import {
  SCENE_TINT_SURFACES,
  TINT_SHADE_LIFT,
  tintLiftForShade,
  tintThemePalette,
} from 'renderer/utils/sceneTintPalette';
import {
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  themeShadeTokens,
} from 'renderer/utils/themeShade';

const labOf = (hex: string | undefined) => {
  const colour = parseCssColour(hex ?? '');
  if (!colour) {
    throw new Error(`not a colour: ${hex}`);
  }
  return rgbToLab(colour.rgb);
};

const chromaOf = (hex: string | undefined) => {
  const { a, b } = labOf(hex);
  return Math.hypot(a, b);
};

const sky: ISceneSky = {
  lightness: 0.32,
  chroma: 0.13,
  hue: 300,
  share: 0.5,
  accent: null,
  active: null,
};

/** The window at `shade`, as the tint paints it under `sky`. */
const tintedAt = (shade: number) =>
  tintThemePalette(themeShadeTokens(shade), sky, tintLiftForShade(shade));

describe('Brightness under a visualizer’s colours', () => {
  it('lifts nothing at the left end and all of its reach at the right', () => {
    expect(tintLiftForShade(THEME_SHADE_MIN)).toBe(0);
    expect(tintLiftForShade(THEME_SHADE_MAX)).toBeCloseTo(TINT_SHADE_LIFT, 6);
    expect(tintLiftForShade(THEME_SHADE_MAX / 2)).toBeCloseTo(
      TINT_SHADE_LIFT / 2,
      6,
    );
  });

  it('is the visualizer’s colour at its darkest, where the theme is black', () => {
    const theme = themeShadeTokens(THEME_SHADE_MIN)['--surface-base'];
    const tinted = tintedAt(THEME_SHADE_MIN)['--surface-base'];
    // Positive control: the theme itself is a grey at this end.
    expect(chromaOf(theme)).toBeLessThan(0.01);
    expect(chromaOf(tinted)).toBeGreaterThan(0.03);
    expect(labOf(tinted).l).toBeCloseTo(labOf(theme).l, 2);
  });

  it('only gets lighter from left to right, and keeps its surfaces in order', () => {
    const floors = [0, 25, 50, 75, 100].map(
      (shade) => labOf(tintedAt(shade)['--surface-base']).l,
    );
    floors.slice(1).forEach((floor, at) => {
      expect(floor).toBeGreaterThan(floors[at]);
    });
    const right = tintedAt(THEME_SHADE_MAX);
    expect(labOf(right['--surface-base']).l).toBeLessThan(
      labOf(right['--surface-panel']).l,
    );
    expect(labOf(right['--surface-panel']).l).toBeLessThan(
      labOf(right['--surface-block']).l,
    );
  });

  it('never lifts a surface past where light text still reads', () => {
    const lifted = tintThemePalette(themeShadeTokens(THEME_SHADE_MAX), sky, 5);
    // Positive control: every surface came back to be measured.
    expect(SCENE_TINT_SURFACES.every((token) => lifted[token])).toBe(true);
    SCENE_TINT_SURFACES.forEach((token) =>
      expect(labOf(lifted[token]).l).toBeLessThanOrEqual(0.53),
    );
  });
});

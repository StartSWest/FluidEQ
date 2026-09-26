/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window-colours menu's Brightness under a visualizer's colours: the
 * theme's own slider, walking the tinted window from its darkest — the
 * visualizer's colour, never black — to its lightest (Ivan, 2026-09-25: "if
 * ambient is on is not black is ambient color … dark to more lighter"), and
 * exactly as light as Original at every step (2026-09-26: "when I choose
 * tema is darker than when I choose colores … with same 100% brightness").
 */

import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import type { ISceneSky } from 'renderer/utils/sceneTint';
import {
  SCENE_TINT_SURFACES,
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
  tintThemePalette(themeShadeTokens(shade), sky);

describe('Brightness under a visualizer’s colours', () => {
  it('is as light as Original at every step, in the visualizer’s hue', () => {
    [0, 25, 50, 75, 100].forEach((shade) => {
      const theme = themeShadeTokens(shade);
      const tinted = tintedAt(shade);
      SCENE_TINT_SURFACES.forEach((token) => {
        expect([shade, token, labOf(tinted[token]).l]).toEqual([
          shade,
          token,
          expect.closeTo(labOf(theme[token]).l, 2),
        ]);
      });
    });
    // Positive control: the hue did change, so the two were compared as two
    // different colours of one lightness and not as one colour.
    expect(
      chromaOf(tintedAt(THEME_SHADE_MAX)['--surface-base']),
    ).toBeGreaterThan(
      chromaOf(themeShadeTokens(THEME_SHADE_MAX)['--surface-base']) + 0.02,
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

  it('never stands a surface past where light text still reads', () => {
    const right = tintedAt(THEME_SHADE_MAX);
    // Positive control: every surface came back to be measured.
    expect(SCENE_TINT_SURFACES.every((token) => right[token])).toBe(true);
    SCENE_TINT_SURFACES.forEach((token) =>
      expect(labOf(right[token]).l).toBeLessThanOrEqual(0.53),
    );
  });
});

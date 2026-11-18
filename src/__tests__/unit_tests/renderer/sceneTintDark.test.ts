/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * At Brightness 0 every surface under a scene's colours is dark, keeps the
 * scene's hue and enough colour to be seen (Ivan, 2026-11-14: "make sure on 0
 * brightness always the lower colour fulfil so is dark but the colour can be
 * seen ... the Aurora Fjord that even on 0 brightness the green is too light
 * on the panels"). Below the knee only the floor used to walk down; the panes
 * stood at the held shade's lightness (`sceneTintDark.ts`).
 */

import {
  contrast,
  hueDistance,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
} from 'renderer/utils/oklab';
import { DARK_KNEE, darkenSurfaces } from 'renderer/utils/sceneTintDark';
import type { ISceneSky } from 'renderer/utils/sceneTint';
import {
  SCENE_TINT_SURFACES,
  tintThemePalette,
} from 'renderer/utils/sceneTintPalette';
import { toneShadeOf } from 'renderer/utils/sceneTintStore';
import { SHIPPED_TEXT } from 'renderer/utils/themeInk';
import { DARK_END_SHADE, themeShadeTokens } from 'renderer/utils/themeShade';

const sky = (lightness: number, chroma: number, hue: number): ISceneSky => ({
  lightness,
  chroma,
  hue,
  share: 0.6,
  accent: null,
  active: null,
});

/** The kinds of sky a scene lends, light ones first: the ones that escaped. */
const SKIES: Record<string, { sky: ISceneSky; coloured: boolean }> = {
  'light green': { sky: sky(0.85, 0.12, 150), coloured: true },
  'light pink': { sky: sky(0.85, 0.09, 350), coloured: true },
  'pale blue': { sky: sky(0.88, 0.06, 240), coloured: true },
  'saturated red': { sky: sky(0.6, 0.22, 25), coloured: true },
  'near-white': { sky: sky(0.97, 0.008, 90), coloured: false },
  'near-black': { sky: sky(0.05, 0.01, 270), coloured: false },
};

/** The panes, menus and fields: what reads as "the panels". */
const PANELS = SCENE_TINT_SURFACES.filter(
  (token) => token !== '--track-well' && token !== '--surface-well',
);
/** The dark ceilings at 0: panels, and the slider wells a step above them. */
const PANEL_CEILING = 0.19;
const WELL_CEILING = 0.25;
/** Below this chroma a dark surface reads as a grey with a cast. */
const VISIBLE_CHROMA = 0.02;

const base = (shade: number) =>
  themeShadeTokens(shade) as unknown as Record<string, string>;

/** What the window paints in Colours at `brightness`, as the store does. */
const shown = (lent: ISceneSky, brightness: number) =>
  darkenSurfaces(
    tintThemePalette(base(toneShadeOf('held', brightness)), lent),
    tintThemePalette(base(toneShadeOf('held', DARK_KNEE)), lent),
    brightness,
  );

const lch = (hex: string | undefined) => {
  const parsed = parseCssColour(hex ?? '');
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { l, a, b } = rgbToLab(parsed.rgb);
  return {
    l,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
    lum: luminance(parsed.rgb.map(toLinear)),
  };
};

describe.each(Object.entries(SKIES))(
  'a %s sky at Brightness 0',
  (_, { sky: lent, coloured }) => {
    const zero = shown(lent, 0);
    const knee = tintThemePalette(base(toneShadeOf('held', DARK_KNEE)), lent);

    it('leaves every surface under the dark ceiling', () => {
      PANELS.forEach((token) =>
        expect(lch(zero[token]).l).toBeLessThan(PANEL_CEILING),
      );
      ['--surface-well', '--track-well'].forEach((token) =>
        expect(lch(zero[token]).l).toBeLessThan(WELL_CEILING),
      );
    });

    it('keeps light text legible on every surface', () => {
      const text = lch(SHIPPED_TEXT['--text-primary']).lum;
      SCENE_TINT_SURFACES.forEach((token) =>
        expect(contrast(text, lch(zero[token]).lum)).toBeGreaterThan(7),
      );
    });

    // Up to the top of the dark stretch (`DARK_END_SHADE`): past it the
    // window turns light, and a scene's colour leaves the panes there
    // (2026-11-17), so the walk ends where the dark window does.
    it('gets no darker as the Brightness rises, up to the top of the dark window', () => {
      const walk = Array.from({ length: DARK_END_SHADE / 4 + 1 }, (_, step) =>
        shown(lent, step * 4),
      );
      walk
        .slice(1)
        .forEach((next, step) =>
          SCENE_TINT_SURFACES.forEach((token) =>
            expect(lch(next[token]).l).toBeGreaterThanOrEqual(
              lch(walk[step][token]).l - 1e-3,
            ),
          ),
        );
    });

    if (coloured) {
      it("keeps the scene's hue and enough colour to see it, never a grey", () => {
        SCENE_TINT_SURFACES.forEach((token) => {
          const dark = lch(zero[token]);
          expect(dark.c).toBeGreaterThan(VISIBLE_CHROMA);
          expect(hueDistance(dark.h, lch(knee[token]).h)).toBeLessThan(6);
        });
      });
    }
  },
);

describe('the mapping before', () => {
  // The control: toned at the held shade with only the floor walked down,
  // a light green's panes stood above the ceiling at 0 - what Ivan saw.
  it('left the panels of a light green light at Brightness 0', () => {
    const before = tintThemePalette(
      base(toneShadeOf('held', 0)),
      SKIES['light green'].sky,
    );
    expect(
      PANELS.some(
        (token) =>
          token !== '--surface-base' && lch(before[token]).l >= PANEL_CEILING,
      ),
    ).toBe(true);
  });

  it('is untouched from the knee up, where the theme carries the light end', () => {
    const lent = SKIES['light green'].sky;
    const palette = tintThemePalette(base(toneShadeOf('held', 100)), lent);
    expect(
      darkenSurfaces(
        palette,
        tintThemePalette(base(toneShadeOf('held', DARK_KNEE)), lent),
        100,
      ),
    ).toEqual(palette);
  });
});

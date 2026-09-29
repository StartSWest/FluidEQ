/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The theme's slider, Black to a lighter Ocean (Ivan, 2026-09-25).
 *
 * What has to hold: each end and Ocean are exactly the colours they promise,
 * the light moves one way along the track, somebody's old choice of Black or
 * Ocean opens on its own colours, and the slider's Ocean is the stylesheet's
 * — `App.scss` paints it before any script has run, and two copies that
 * disagree would flash from one to the other at every launch.
 */

import fs from 'fs';
import path from 'path';
import { parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  BLACK_THEME,
  OCEAN_SHADE,
  OCEAN_THEME,
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  THEME_SHADE_TOKENS,
  clampThemeShade,
  themeShadeRule,
  themeShadeTokens,
} from 'renderer/utils/themeShade';

const lightness = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  return rgbToLab(parsed.rgb).l;
};

const same = (left: string, right: string) =>
  left.replace(/\s+/g, '').toLowerCase() ===
  right.replace(/\s+/g, '').toLowerCase();

/** The `:root` block's declarations in App.scss, as written. */
const stylesheetRoot = (): Record<string, string> => {
  const text = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'renderer', 'styles', 'App.scss'),
    'utf8',
  );
  const start = text.indexOf('// THE THEME, in one place.');
  const open = text.indexOf(':root {', start);
  const close = text.indexOf('\n}', open);
  const block = text.slice(open, close);
  return Object.fromEntries(
    [...block.matchAll(/^\s*(--[a-z-]+):\s*([^;]+);/gm)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
};

describe("the theme's slider", () => {
  // Each end's table is where the slider walks through, not all of what it
  // paints there: the panes stand a solved step over the floor, every card-
  // coloured surface — a menu, its head and face — is the card's one colour,
  // and the edges take the opacity that reaches their contrast
  // (`themeShadeTokens`). What the tables hold as painted is the floor, the
  // wells and the accents.
  it('holds Black at its left end and Ocean where Ocean users land', () => {
    const left = themeShadeTokens(THEME_SHADE_MIN);
    const ocean = themeShadeTokens(OCEAN_SHADE);
    (
      [
        '--surface-base',
        '--surface-well',
        '--track-well',
        '--accent',
        '--accent-light',
        '--accent-dark',
        '--accent-darker',
      ] as const
    ).forEach((token) => {
      expect([token, same(left[token], BLACK_THEME[token])]).toEqual([
        token,
        true,
      ]);
      expect([token, same(ocean[token], OCEAN_THEME[token])]).toEqual([
        token,
        true,
      ]);
    });
  });

  it("lifts Ocean's surfaces at its right end and keeps its accent", () => {
    // Measured from the slider's own Ocean. The light end was built 0.145
    // over it — the theme's own 0.045 and the 0.1 a visualizer's colours
    // used to add, which made Original the darker of the two at 100%
    // (2026-09-26) — and the slider stops three fifths of the way there, so
    // 100 is what 90 was (2026-09-27: "lower the brightness"); the panes
    // keep their step over the floor all the way.
    const ocean = themeShadeTokens(OCEAN_SHADE);
    const right = themeShadeTokens(THEME_SHADE_MAX);
    const lift =
      lightness(right['--surface-panel']) - lightness(ocean['--surface-panel']);
    expect(lift).toBeGreaterThan(0.11);
    expect(lift).toBeLessThan(0.12);
    expect(right['--accent']).toBe(OCEAN_THEME['--accent']);
  });

  it('keeps Ocean’s colour as it lightens, never grey', () => {
    // Lifted with Ocean's chroma left as it was, the light end read as a
    // blue-grey (2026-09-26: "the light original is too not colored").
    const chroma = (hex: string) => {
      const colour = parseCssColour(hex);
      if (!colour) {
        throw new Error(`not a colour: ${hex}`);
      }
      const { a, b } = rgbToLab(colour.rgb);
      return Math.hypot(a, b);
    };
    const ocean = themeShadeTokens(OCEAN_SHADE);
    const right = themeShadeTokens(THEME_SHADE_MAX);
    (['--surface-base', '--surface-panel'] as const).forEach((token) => {
      // Positive control: Ocean itself is a muted blue.
      expect(chroma(ocean[token])).toBeLessThan(0.056);
      expect(chroma(right[token])).toBeGreaterThan(chroma(ocean[token]) * 1.3);
      expect(chroma(right[token])).toBeLessThanOrEqual(0.081);
    });
  });

  it('lifts no surface past where light text still reads', () => {
    const right = themeShadeTokens(THEME_SHADE_MAX);
    // Positive control: the track's well, Ocean's lightest surface, is one
    // the full lift would have taken past the ceiling.
    expect(lightness(OCEAN_THEME['--track-well']) + 0.145).toBeGreaterThan(
      0.53,
    );
    expect(lightness(right['--track-well'])).toBeLessThanOrEqual(0.521);
  });

  it('only ever gets lighter from left to right', () => {
    const steps = Array.from(
      { length: THEME_SHADE_MAX - THEME_SHADE_MIN + 1 },
      (_, at) => lightness(themeShadeTokens(at)['--surface-base']),
    );
    // Positive control: the two ends are far apart, so a flat run would show.
    expect(steps[steps.length - 1] - steps[0]).toBeGreaterThan(0.15);
    steps.slice(1).forEach((step, at) => {
      expect(step).toBeGreaterThanOrEqual(steps[at] - 1e-4);
    });
  });

  it('keeps a stored shade on the track', () => {
    expect(clampThemeShade(-20)).toBe(THEME_SHADE_MIN);
    expect(clampThemeShade(140)).toBe(THEME_SHADE_MAX);
    expect(clampThemeShade(37.4)).toBe(37);
    expect(clampThemeShade(Number.NaN)).toBe(THEME_SHADE_MIN);
  });

  it('keeps the coverage columns grey on Black and in the accent from Ocean up', () => {
    expect(themeShadeRule(THEME_SHADE_MIN)).toContain(
      'color-mix(in oklab, #7a8594, var(--accent) 0%)',
    );
    expect(themeShadeRule(OCEAN_SHADE)).toContain('var(--accent) 100%)');
    expect(themeShadeRule(THEME_SHADE_MAX)).toContain('var(--accent) 100%)');
  });

  it("is the stylesheet's Ocean at Ocean", () => {
    const root = stylesheetRoot();
    // Positive control: the block was found and read.
    expect(root['--surface-base']).toBe('#0d2030');
    const ocean = themeShadeTokens(OCEAN_SHADE);
    THEME_SHADE_TOKENS.forEach((token) => {
      expect([token, same(root[token] ?? '', ocean[token])]).toEqual([
        token,
        true,
      ]);
    });
  });
});

describe('a theme chosen before the slider', () => {
  const openWith = (stored: string | null) => {
    window.localStorage.clear();
    if (stored !== null) {
      window.localStorage.setItem('fluideq.theme', stored);
    }
    let shade = -1;
    jest.isolateModules(() => {
      // A fresh copy of the store per stored value, read as it loads.
      const theme = jest.requireActual<typeof import('renderer/utils/theme')>(
        'renderer/utils/theme',
      );
      shade = theme.getThemeShade();
    });
    return shade;
  };

  afterEach(() => window.localStorage.clear());

  it('opens Black on the left and Ocean on its own colours', () => {
    expect(openWith('black')).toBe(THEME_SHADE_MIN);
    expect(openWith('ocean')).toBe(OCEAN_SHADE);
  });

  // Half way is where a window with no choice opens (Ivan, 2026-09-28:
  // "brightness default to 50%"); Black was the default before.
  it('opens a shade where it was left, and anything else half way', () => {
    expect(openWith('37')).toBe(37);
    expect(openWith('purple')).toBe(50);
    expect(openWith(null)).toBe(50);
  });
});

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
  it('holds Black at its left end and Ocean where Ocean users land', () => {
    const left = themeShadeTokens(THEME_SHADE_MIN);
    const ocean = themeShadeTokens(OCEAN_SHADE);
    THEME_SHADE_TOKENS.forEach((token) => {
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
    const right = themeShadeTokens(THEME_SHADE_MAX);
    const lift =
      lightness(right['--surface-panel']) -
      lightness(OCEAN_THEME['--surface-panel']);
    expect(lift).toBeGreaterThan(0.04);
    expect(lift).toBeLessThan(0.05);
    expect(right['--accent']).toBe(OCEAN_THEME['--accent']);
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
    THEME_SHADE_TOKENS.forEach((token) => {
      expect([token, same(root[token] ?? '', OCEAN_THEME[token])]).toEqual([
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

  it('opens a shade where it was left, and anything else on Black', () => {
    expect(openWith('37')).toBe(37);
    expect(openWith('purple')).toBe(THEME_SHADE_MIN);
    expect(openWith(null)).toBe(THEME_SHADE_MIN);
  });
});

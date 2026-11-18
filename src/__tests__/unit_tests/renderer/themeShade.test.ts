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
  DARK_END_SHADE,
  OCEAN_SHADE,
  OCEAN_THEME,
  THEME_SHADE_MAX,
  THEME_SHADE_MIN,
  THEME_SHADE_TOKENS,
  clampThemeShade,
  isLightShade,
  shadeOfDarkStep,
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

const chroma = (hex: string) => {
  const colour = parseCssColour(hex);
  if (!colour) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { a, b } = rgbToLab(colour.rgb);
  return Math.hypot(a, b);
};

const same = (left: string, right: string) =>
  left.replace(/\s+/g, '').toLowerCase() ===
  right.replace(/\s+/g, '').toLowerCase();

/**
 * The shipped theme's declarations as written: the mixin App.scss includes on
 * `:root` (and the desktop background's page with it).
 */
const stylesheetRoot = (): Record<string, string> => {
  const text = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'renderer',
      'styles',
      '_shippedTheme.scss',
    ),
    'utf8',
  );
  const start = text.indexOf('// THE THEME, in one place.');
  const open = text.indexOf('@mixin shipped-theme {', start);
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

  // The dark window's walk ends at `DARK_END_SHADE` since the slider runs on
  // into a light window (2026-11-17); its top is what the right end used to
  // be.
  it("lifts Ocean's surfaces at the top of the dark window and keeps its accent", () => {
    // Measured from the slider's own Ocean. The light end was built 0.145
    // over it — the theme's own 0.045 and the 0.1 a visualizer's colours
    // used to add, which made Original the darker of the two at 100%
    // (2026-09-26) — and the walk stops three fifths of the way there
    // (2026-09-27: "lower the brightness"); the panes keep their step over
    // the floor all the way.
    const ocean = themeShadeTokens(OCEAN_SHADE);
    const top = themeShadeTokens(DARK_END_SHADE);
    const lift =
      lightness(top['--surface-panel']) - lightness(ocean['--surface-panel']);
    expect(lift).toBeGreaterThan(0.11);
    expect(lift).toBeLessThan(0.12);
    expect(top['--accent']).toBe(OCEAN_THEME['--accent']);
  });

  it('keeps Ocean’s colour as it lightens, never grey', () => {
    // Lifted with Ocean's chroma left as it was, the light end read as a
    // blue-grey (2026-09-26: "the light original is too not colored").
    const ocean = themeShadeTokens(OCEAN_SHADE);
    const top = themeShadeTokens(DARK_END_SHADE);
    (['--surface-base', '--surface-panel'] as const).forEach((token) => {
      // Positive control: Ocean itself is a muted blue.
      expect(chroma(ocean[token])).toBeLessThan(0.056);
      expect(chroma(top[token])).toBeGreaterThan(chroma(ocean[token]) * 1.3);
      expect(chroma(top[token])).toBeLessThanOrEqual(0.081);
    });
  });

  it('lifts no surface of the dark window past where light text still reads', () => {
    const top = themeShadeTokens(DARK_END_SHADE);
    // Positive control: the track's well, Ocean's lightest surface, is one
    // the full lift would have taken past the ceiling.
    expect(lightness(OCEAN_THEME['--track-well']) + 0.145).toBeGreaterThan(
      0.53,
    );
    expect(lightness(top['--track-well'])).toBeLessThanOrEqual(0.521);
  });

  // Past the line the window is light (Ivan, 2026-11-17: "Brightness runs
  // from fully dark to fully white"), and it stays white so the accent can
  // be seen: neutral greys walking from a soft grey at the line to white
  // panes at 100, the accent the only colour.
  it('turns into a white window past the line, with no hue in its surfaces', () => {
    const top = themeShadeTokens(THEME_SHADE_MAX);
    expect(top['--surface-panel']).toBe('#ffffff');
    const atLine = themeShadeTokens(DARK_END_SHADE + 1);
    expect(lightness(atLine['--surface-panel'])).toBeGreaterThan(0.8);
    expect(lightness(atLine['--surface-panel'])).toBeLessThan(
      lightness(top['--surface-panel']),
    );
    [DARK_END_SHADE + 1, 90, THEME_SHADE_MAX].forEach((shade) => {
      const tokens = themeShadeTokens(shade);
      (['--surface-base', '--surface-panel'] as const).forEach((token) => {
        expect(chroma(tokens[token])).toBeLessThan(0.005);
      });
    });
    // CONTROL: one step back over the line the window is the dark Ocean blue.
    expect(
      chroma(themeShadeTokens(DARK_END_SHADE)['--surface-panel']),
    ).toBeGreaterThan(0.02);
    expect(isLightShade(DARK_END_SHADE)).toBe(false);
    expect(isLightShade(DARK_END_SHADE + 1)).toBe(true);
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
  /** The same, with the choice stored on today's scale. */
  const openWithScale = (stored: string) => {
    window.localStorage.clear();
    window.localStorage.setItem('fluideq.themeScale', '2');
    window.localStorage.setItem('fluideq.theme', stored);
    let shade = -1;
    jest.isolateModules(() => {
      shade = jest
        .requireActual<typeof import('renderer/utils/theme')>(
          'renderer/utils/theme',
        )
        .getThemeShade();
    });
    return shade;
  };

  afterEach(() => window.localStorage.clear());

  it('opens Black on the left and Ocean on its own colours', () => {
    expect(openWith('black')).toBe(THEME_SHADE_MIN);
    expect(openWith('ocean')).toBe(OCEAN_SHADE);
  });

  // Half way along the dark walk is where a window with no choice opens
  // (Ivan, 2026-09-28: "brightness default to 50%"), which is no longer 50
  // on a slider that runs on into a light window (2026-11-17).
  it('opens a shade where it was left, and anything else half way along the dark walk', () => {
    expect(openWithScale('37')).toBe(37);
    expect(openWith('purple')).toBe(shadeOfDarkStep(50));
    expect(openWith(null)).toBe(shadeOfDarkStep(50));
  });

  // A Brightness stored before the slider ran on into a light window was a
  // place on the dark walk alone; it is moved onto the dark stretch once, so
  // a window left at 100 then - a dark window - does not open white.
  it('moves a Brightness stored on the old scale onto the dark stretch, once', () => {
    expect(openWith('100')).toBe(DARK_END_SHADE);
    expect(openWith('37')).toBe(shadeOfDarkStep(37));
    expect(window.localStorage.getItem('fluideq.themeScale')).toBe('2');
    // CONTROL: on today's scale it is left where it is.
    expect(openWithScale('100')).toBe(THEME_SHADE_MAX);
  });
});

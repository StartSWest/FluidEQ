/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The inks the theme solves for every shade (`themeInk.ts`): what is read on
 * the panes, and the lines they are ruled with, reach their contrast at every
 * step of the Brightness slider (Ivan, 2026-09-27: "panes are subtle, but
 * borders, text, disabled text, info text need to look with good contrast";
 * the EQ page first, where edges under 1.8:1 measured as missing).
 *
 * Measured the way the window paints them — the ink at its alpha over the
 * ground, in sRGB — on the lightest ground they stand on, the pane itself;
 * every other ground only does better.
 */

import {
  contrast,
  luminance,
  parseCssColour,
  toLinear,
} from 'renderer/utils/oklab';
import {
  EDGE_CONTRAST,
  SHIPPED_TEXT,
  cardOf,
  groundOf,
} from 'renderer/utils/themeInk';
import {
  DARK_END_SHADE,
  OCEAN_SHADE,
  THEME_SHADE_MAX,
  themeInkTokens,
  themeShadeTokens,
} from 'renderer/utils/themeShade';

type TRgb = readonly [number, number, number];

const SHADES = [0, 25, 50, OCEAN_SHADE, 90, 100];

const rgbaOf = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  return parsed;
};

const lum = (rgb: readonly number[]) => luminance(rgb.map(toLinear));

/** `ink` at `alpha` (and its own) over `ground`, as the window blends it. */
const measured = (ink: string, ground: TRgb, alpha = 1) => {
  const { rgb, alpha: own } = rgbaOf(ink);
  const share = own * alpha;
  const mixed = rgb.map(
    (channel, index) => channel * share + ground[index] * (1 - share),
  );
  return contrast(lum(mixed), lum(ground));
};

const groundAt = (shade: number) => {
  const tokens = themeShadeTokens(shade);
  return groundOf(tokens['--surface-base'], tokens['--surface-panel']);
};

const share = (percent: string) => Number.parseFloat(percent) / 100;

describe('the ground the inks are solved on', () => {
  it('is the pane where the pane is lighter than a card on the floor', () => {
    const tokens = themeShadeTokens(OCEAN_SHADE);
    const pane = rgbaOf(tokens['--surface-panel']).rgb;
    expect(groundAt(OCEAN_SHADE)).toEqual(pane);
  });

  // The control: a pane darker than its floor leaves the card the lighter.
  it('is the card where the card is the lighter', () => {
    const ground = groundOf('#ffffff', '#000000');
    expect(ground).toEqual(cardOf('#ffffff', '#000000'));
  });
});

describe('the hairlines at every shade', () => {
  // The numbers themselves, not the solver's own table: a target lowered in
  // `themeInk.ts` has to fail here. Under 1.8:1 the EQ page's edges read as
  // missing (2026-09-27).
  const AT_LEAST = {
    '--border-subtle': 1.8,
    '--border-panel': 2,
    '--border-menu': 2.5,
  } as const;

  it('reach 1.8, 2 and 2.5 to one on the pane', () => {
    expect(Object.keys(EDGE_CONTRAST).sort()).toEqual(
      Object.keys(AT_LEAST).sort(),
    );
    SHADES.forEach((shade) => {
      const tokens = themeShadeTokens(shade);
      const ground = groundAt(shade);
      (Object.keys(AT_LEAST) as (keyof typeof AT_LEAST)[]).forEach((token) => {
        expect([
          shade,
          token,
          measured(tokens[token], ground) >= AT_LEAST[token] - 0.01,
        ]).toEqual([shade, token, true]);
      });
    });
  });

  it('keep their order: rows under cards under menus', () => {
    SHADES.forEach((shade) => {
      const tokens = themeShadeTokens(shade);
      const ground = groundAt(shade);
      const subtle = measured(tokens['--border-subtle'], ground);
      const panel = measured(tokens['--border-panel'], ground);
      const menu = measured(tokens['--border-menu'], ground);
      expect(subtle).toBeLessThan(panel);
      expect(panel).toBeLessThan(menu);
    });
  });
});

describe('the graph’s ruled paper', () => {
  it('stands under the hairlines, the minor lines under the major', () => {
    SHADES.forEach((shade) => {
      const inks = themeInkTokens(shade);
      const ground = groundAt(shade);
      const major = measured(inks['--rule-major'], ground);
      const minor = measured(inks['--rule-minor'], ground);
      expect(major).toBeGreaterThanOrEqual(1.49);
      expect(minor).toBeGreaterThanOrEqual(1.21);
      expect(minor).toBeLessThan(major);
      expect(major).toBeLessThan(
        measured(themeShadeTokens(shade)['--border-subtle'], ground),
      );
    });
  });
});

// The one control theme (Ivan, 2026-11-17): every control's edge at rest is
// the accent's light at 2.0:1 against the card, softer than the 42% every
// control used to wear, and 3.2:1 under the pointer, never under half.
describe('a control’s edge', () => {
  it('stands as clear as a card’s at rest and a clear step over that under the pointer', () => {
    SHADES.forEach((shade) => {
      const tokens = themeShadeTokens(shade);
      const inks = themeInkTokens(shade);
      const ground = groundAt(shade);
      const accentLight = tokens['--accent-light'];
      const rest = measured(
        accentLight,
        ground,
        share(inks['--field-edge-share']),
      );
      const hover = measured(
        accentLight,
        ground,
        share(inks['--field-edge-hover-share']),
      );
      expect(rest).toBeGreaterThanOrEqual(1.99);
      // As clear as a card's edge at rest: both are 2.0:1 since the one
      // control theme, apart by rounding alone.
      expect(rest).toBeGreaterThanOrEqual(
        measured(tokens['--border-panel'], ground) - 0.01,
      );
      expect(hover).toBeGreaterThanOrEqual(3.19);
      expect(hover).toBeGreaterThan(rest);
      expect(share(inks['--field-edge-share'])).toBeGreaterThanOrEqual(0.24);
      expect(share(inks['--field-edge-hover-share'])).toBeGreaterThanOrEqual(
        0.5,
      );
    });
  });
});

describe('the text tiers', () => {
  const TARGETS = {
    '--text-primary': 7,
    '--text-muted': 5.8,
    '--text-faint': 4.8,
  } as const;

  // White is as far as a colour goes: on the lightest pane the primary tier's
  // 7:1 is out of reach (white measures 6.5 there), and the tier is white.
  it('reach 7, 5.8 and 4.8 to one on the pane, or are white where nothing can', () => {
    SHADES.forEach((shade) => {
      const inks = themeInkTokens(shade);
      const ground = groundAt(shade);
      (Object.keys(TARGETS) as (keyof typeof TARGETS)[]).forEach((token) => {
        const reached = measured(inks[token], ground) >= TARGETS[token] - 0.01;
        const whiteOutOfReach =
          inks[token] === '#ffffff' &&
          measured('#ffffff', ground) < TARGETS[token];
        expect([shade, token, reached || whiteOutOfReach]).toEqual([
          shade,
          token,
          true,
        ]);
      });
    });
  });

  // The top of the dark window stops three fifths of the way to the end it
  // was built toward (`themeShade.ts`, 2026-09-27: "lower the brightness"),
  // where the shipped ink still reaches its contrast: nothing has to lift it
  // to white. Past it the window is white (2026-11-17), and its words are a
  // dark neutral ink solved to the same tiers.
  it('keep the primary tier its shipped ink at the top of the dark window, and write dark ink on the white one', () => {
    expect(themeInkTokens(DARK_END_SHADE)['--text-primary']).toBe(
      SHIPPED_TEXT['--text-primary'],
    );
    const white = themeInkTokens(THEME_SHADE_MAX)['--text-primary'];
    expect(measured(white, groundAt(THEME_SHADE_MAX))).toBeGreaterThanOrEqual(
      7 - 0.01,
    );
    const ink = parseCssColour(white)?.rgb ?? [];
    expect(Math.max(...ink) - Math.min(...ink)).toBeLessThanOrEqual(1 / 255);
    // CONTROL: that is not the shipped light ink.
    expect(white).not.toBe(SHIPPED_TEXT['--text-primary']);
  });

  // Only a lighter ground moves them: up to Ocean they are what shipped.
  it('keep the colours they shipped in wherever those already reach', () => {
    [0, 25, 50, OCEAN_SHADE].forEach((shade) => {
      const inks = themeInkTokens(shade);
      (Object.keys(SHIPPED_TEXT) as (keyof typeof SHIPPED_TEXT)[]).forEach(
        (token) => {
          expect([shade, token, inks[token]]).toEqual([
            shade,
            token,
            SHIPPED_TEXT[token],
          ]);
        },
      );
    });
  });
});

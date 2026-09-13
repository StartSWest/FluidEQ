/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's colours, measured from its pixels, and the window toned to them.
 *
 * Each finding is checked on frames built to hold it, beside a frame built to
 * hold nothing — a finder that answered the same for every frame would pass
 * the null case alone.
 */

import {
  contrast,
  hueDistance,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
} from '../../../renderer/utils/oklab';
import {
  findSceneSky,
  sceneSkyColour,
  tintThemePalette,
  type ISceneSky,
} from '../../../renderer/utils/sceneTint';

type TRgb = readonly [number, number, number];

/** An RGBA frame: each colour repeated for its share of `size` pixels. */
const frame = (parts: ReadonlyArray<[TRgb, number]>, size = 2000) => {
  const pixels: number[] = [];
  parts.forEach(([rgb, share]) => {
    for (let index = 0; index < Math.round(size * share); index += 1) {
      pixels.push(rgb[0], rgb[1], rgb[2], 255);
    }
  });
  return Uint8Array.from(pixels);
};

const hueOf = (rgb: TRgb) => {
  const lab = rgbToLab(rgb.map((channel) => channel / 255));
  return ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
};

const labOfHex = (hex: string | undefined) => {
  const colour = parseCssColour(hex ?? '');
  if (!colour) {
    throw new Error(`not a colour: ${hex}`);
  }
  const lab = rgbToLab(colour.rgb);
  return {
    ...lab,
    hue: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360,
    luminance: luminance(colour.rgb.map(toLinear)),
  };
};

const VIOLET: TRgb = [80, 40, 150];
const CYAN: TRgb = [60, 220, 240];
const BLUE: TRgb = [40, 60, 160];
const PINK: TRgb = [240, 80, 170];
const ORANGE: TRgb = [230, 140, 50];
const BLACK: TRgb = [0, 0, 0];
const WHITE: TRgb = [255, 255, 255];
const AMBER_HUE = hueOf([255, 176, 89]);

describe('a scene’s sky and second colour', () => {
  it('finds the colour covering the frame, and the lit colour in front of it', () => {
    const sky = findSceneSky(
      frame([
        [VIOLET, 0.8],
        [CYAN, 0.05],
        [BLACK, 0.15],
      ]),
    );
    expect(sky).toBeDefined();
    expect(hueDistance(sky?.hue ?? 0, hueOf(VIOLET))).toBeLessThan(10);
    expect(sky?.share).toBeGreaterThan(0.6);
    expect(hueDistance(sky?.accent?.hue ?? 0, hueOf(CYAN))).toBeLessThan(10);
  });

  it('has no second colour for a scene in one colour', () => {
    const sky = findSceneSky(
      frame([
        [VIOLET, 0.9],
        [BLACK, 0.1],
      ]),
    );
    expect(sky?.accent).toBeNull();
    // Nothing apart from the buttons' own hue to say "on" in either.
    expect(sky?.active).toBeNull();
  });

  it('lends nothing from a black starfield', () => {
    expect(
      findSceneSky(
        frame([
          [BLACK, 0.98],
          [WHITE, 0.02],
        ]),
      ),
    ).toBeUndefined();
  });

  it('never picks red or amber to say "on", however much of the frame is orange', () => {
    const sky = findSceneSky(
      frame([
        [BLUE, 0.6],
        [PINK, 0.05],
        [ORANGE, 0.25],
        [BLACK, 0.1],
      ]),
    );
    const active = sky?.active;
    expect(active).not.toBeNull();
    expect(hueDistance(active?.hue ?? 0, AMBER_HUE)).toBeGreaterThanOrEqual(35);
    // Clear of the buttons' hue too: the blue sky, not the pink.
    expect(hueDistance(active?.hue ?? 0, hueOf(BLUE))).toBeLessThan(15);
  });
});

/** Ocean's own values for the tokens a tint tones. */
const OCEAN = {
  '--surface-base': '#0d2030',
  '--surface-panel': '#1a3a4e',
  '--surface-block': '#1e4257',
  '--border-subtle': 'rgba(214, 233, 247, 0.09)',
  '--accent': '#00e5cf',
  '--accent-light': '#9cfff4',
  '--accent-dark': '#00a9d6',
  '--accent-darker': '#007f95',
  '--active': '#54ff8a',
};

const violetSky: ISceneSky = {
  lightness: 0.35,
  chroma: 0.09,
  hue: 300,
  share: 0.6,
  accent: { lightness: 0.75, chroma: 0.12, hue: 200, share: 0.05 },
  active: { lightness: 0.7, chroma: 0.05, hue: 250, share: 0.02 },
};

describe('the window in a scene’s colour', () => {
  const palette = tintThemePalette(OCEAN, violetSky);

  it('turns the surfaces to the sky’s hue at the theme’s own lightness', () => {
    (['--surface-base', '--surface-panel', '--surface-block'] as const).forEach(
      (token) => {
        const before = labOfHex(OCEAN[token]);
        const after = labOfHex(palette[token]);
        expect(Math.abs(after.l - before.l)).toBeLessThan(0.02);
        expect(hueDistance(after.hue, 300)).toBeLessThan(20);
      },
    );
    expect(palette['--border-subtle']).toMatch(/^rgba\(.+, 0\.09\)$/);
  });

  it('gives the buttons the scene’s second colour, keeping their labels readable', () => {
    const accent = labOfHex(palette['--accent']);
    const label = labOfHex(palette['--surface-base']);
    expect(hueDistance(accent.hue, 200)).toBeLessThan(12);
    expect(contrast(accent.luminance, label.luminance)).toBeGreaterThanOrEqual(
      6.9,
    );
    // The light shade is the hover and the kickers, and stays as light.
    expect(
      Math.abs(
        labOfHex(palette['--accent-light']).l -
          labOfHex(OCEAN['--accent-light']).l,
      ),
    ).toBeLessThan(0.02);
  });

  it('says "on" in the scene’s third colour, lit, not deep like a button', () => {
    const active = labOfHex(palette['--active']);
    expect(hueDistance(active.hue, 250)).toBeLessThan(15);
    expect(labOfHex(OCEAN['--active']).l - active.l).toBeLessThanOrEqual(0.101);
  });

  it('says "on" in a pale light of the sky when the scene has no colour fit for it', () => {
    const fire = tintThemePalette(OCEAN, { ...violetSky, active: null });
    const active = labOfHex(fire['--active']);
    expect(active.l).toBeGreaterThan(0.88);
    expect(hueDistance(active.hue, 300)).toBeLessThan(20);
  });

  it('leaves the theme’s buttons and "on" alone under a faint sky with no second colour', () => {
    const faint = tintThemePalette(OCEAN, {
      ...violetSky,
      share: 0.05,
      accent: null,
    });
    expect(faint['--accent']).toBeUndefined();
    expect(faint['--active']).toBeUndefined();
    expect(faint['--surface-base']).toBeDefined();
  });
});

describe('what a loading scene waits on', () => {
  it('is the sky’s hue as dark as a scene’s ground, even for a mid-tone sky', () => {
    const colour = labOfHex(
      sceneSkyColour({ ...violetSky, lightness: 0.6, chroma: 0.12 }),
    );
    expect(colour.l).toBeLessThanOrEqual(0.145);
    expect(hueDistance(colour.hue, 300)).toBeLessThan(25);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The five measuring looks Ivan sent back on 2026-11-27, each held beside a
 * control showing what was wrong:
 *  - the Note spectrum's names were dark letters on a fixed dark key on the
 *    white window ("notes not visible in white");
 *  - the Analyzer's peak hold was cut by screen column in the engine, where
 *    the page dashes it along its line ("this is what I want");
 *  - Before & after stacked a before-body under the reading;
 *  - the Spectrogram's ramp through two light colours carried no lightness,
 *    and it stopped a handle's headroom under the graph's top;
 *  - the Energy bands' names stood inside the frequency names' box.
 */

import type { IAnalysisReading } from '../../../../renderer/graph/analysis/analysisFrame';
import {
  FOOT_WORD_LIFT,
  footWordKey,
  footWordLine,
} from '../../../../renderer/graph/analysis/footWords';
import { holdLengths } from '../../../../renderer/graph/analysis/holdDashes';
import { spectrogramBand } from '../../../../renderer/graph/analysis/spectrogramView';
import { engineLookPack } from '../../../../renderer/graph/engineLooks/engineLooks';
import { readEdge } from '../../../../renderer/utils/theme';
import { levelRampThrough } from '../../../../renderer/utils/levelRamp';
import { parseCssColour, rgbToLab } from '../../../../renderer/utils/oklab';
import { setLightWindow } from '../../../../renderer/utils/windowSide';

const root = document.documentElement;

afterEach(() => {
  setLightWindow(false);
  ['--surface-base', '--edge-tint', '--ink'].forEach((name) =>
    root.style.removeProperty(name),
  );
});

/** A CSS colour laid over an opaque ground, as 0..255 channels. */
const over = (colour: string, ground: readonly number[]): number[] => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`Unreadable colour ${colour}`);
  }
  const alpha = parsed.alpha ?? 1;
  return parsed.rgb.map(
    (channel, index) => channel * 255 * alpha + ground[index] * (1 - alpha),
  );
};

const luminance = (rgb: readonly number[]) => {
  const linear = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
  );
};

const contrast = (a: readonly number[], b: readonly number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The word's ink against its key, over a pale column on the window. */
const wordContrast = (key: string, column: readonly number[]) => {
  const keyed = over(key, column);
  return contrast(over(readEdge(0.8), keyed), keyed);
};

/** The theme as the white window paints it. */
const whiteWindow = () => {
  root.style.setProperty('--surface-base', '#ececec');
  root.style.setProperty('--edge-tint', '#222222');
  root.style.setProperty('--ink', '#141414');
  setLightWindow(true);
};

/** The theme as Ocean paints it. */
const darkWindow = () => {
  root.style.setProperty('--surface-base', '#002231');
  root.style.setProperty('--edge-tint', '#d6e9f7');
  root.style.setProperty('--ink', '#ffffff');
  setLightWindow(false);
};

/** A bar the names stand on: pale on white, deep on the dark window. */
const PALE_BAR = [150, 205, 225];
const DEEP_BAR = [20, 90, 120];

describe('the names printed along the foot (Note spectrum, Energy bands)', () => {
  it('stand clear of their key on the white window', () => {
    whiteWindow();
    expect(wordContrast(footWordKey(), PALE_BAR)).toBeGreaterThanOrEqual(4.5);
  });

  it('stand clear of their key on the dark window', () => {
    darkWindow();
    expect(wordContrast(footWordKey(), DEEP_BAR)).toBeGreaterThanOrEqual(4.5);
  });

  it('control: the old fixed near-black key read on dark and not on white', () => {
    const old = 'rgba(2, 8, 15, 0.75)';
    darkWindow();
    expect(wordContrast(old, DEEP_BAR)).toBeGreaterThanOrEqual(4.5);
    whiteWindow();
    expect(wordContrast(old, PALE_BAR)).toBeLessThan(2);
  });

  it('stand on a row above the frequency names, with the key above it', () => {
    // The frequency names' box reaches 20px over the foot, measured in the
    // window; the row stood at 17 inside it.
    const band = { top: 0, bottom: 400, flipped: false, opacity: 1 };
    const line = footWordLine(band);
    expect(band.bottom - line.y).toBe(FOOT_WORD_LIFT);
    expect(FOOT_WORD_LIFT).toBeGreaterThanOrEqual(20 + 4);
  });
});

describe("the Analyzer's peak hold", () => {
  const reading = {
    xs: Float64Array.from([0, 3, 7, 7, 15]),
    band: { top: 0, bottom: 100, flipped: false, opacity: 1 },
  } as unknown as IAnalysisReading;
  const hold = Float64Array.from([0.5, 0.54, 0.54, 0.24, 0.24]);

  it('knows how far along its line each point stands, as the canvas dashes it', () => {
    const lengths = holdLengths(reading, hold, new Float64Array(5));
    // 3 across and 4 up, 4 across, 30 straight down, 8 across.
    expect(Array.from(lengths)).toEqual([0, 5, 9, 39, 47]);
  });

  it('is dashed along that length in the engine, on both windows', () => {
    const source = engineLookPack('analyzer')?.source ?? '';
    expect(source).toContain('analyzerHoldDash(p, row, seg)');
    expect(source).toContain('anPoint(j, row + 4).x');
    // Control: the column cut that broke every cliff of the hold.
    expect(source).not.toMatch(/fract\(p\.x \//);
  });
});

describe('Before & after on the engine', () => {
  it('parts the two curves into a lift and a cut, with no before-body', () => {
    const source = engineLookPack('compare')?.source ?? '';
    expect(source).toContain('bool lifted');
    // Control: the faint before-body that stacked into mud.
    expect(source).not.toContain('anBody(picture, p, band, beforeMate');
  });
});

describe('the Spectrogram', () => {
  const lightness = (hex: string) => {
    const parsed = parseCssColour(hex);
    return parsed ? rgbToLab(parsed.rgb).l : Number.NaN;
  };
  // Two light colours, as a Tint's second colour gives them.
  const colours = ['#7fd6e0', '#b9a8f5'];

  it.each([
    ['white', '#ececec', -1],
    ['dark', '#002231', 1],
  ] as const)(
    'climbs away from the %s floor as the level rises, through the colours',
    (_side, ground, away) => {
      const ramp = levelRampThrough(colours, ground);
      const ls = ramp.map(lightness);
      ls.slice(1).forEach((l, index) =>
        expect((l - ls[index]) * away).toBeGreaterThan(0),
      );
      expect(Math.abs(ls[ls.length - 1] - ls[0])).toBeGreaterThan(0.35);
    },
  );

  it('control: the two colours alone are nearly one lightness', () => {
    const [a, b] = colours.map(lightness);
    expect(Math.abs(a - b)).toBeLessThan(0.1);
  });

  it("reaches the graph's top where its band reaches the plot's", () => {
    const plot = { left: 0, right: 100, top: 14, bottom: 300 };
    const band = { top: 14, bottom: 300, flipped: false, opacity: 1 };
    expect(spectrogramBand({ band, plot }).top).toBe(0);
    // Control: a band the wave's height control shrank keeps its own top.
    const shrunk = { ...band, top: 120 };
    expect(spectrogramBand({ band: shrunk, plot }).top).toBe(120);
  });
});

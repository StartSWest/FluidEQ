/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Rainbow mode's palette: Aurora, never the flag, and a Plus visualizer's own
 * colours while one is chosen (Ivan, 2026-09-26: "que podemos hacer para que
 * no se parezca al LGBT", then "quiero el aurora ... different rainbow modes
 * depending on the current plus viz").
 */

import { getBandColor } from '../../../renderer/utils/bandColors';
import { parseCssColour, rgbToLab } from '../../../renderer/utils/oklab';
import {
  AURORA,
  RAINBOW_STOP_COUNT,
  RAINBOW_TOKENS,
  getRainbowStops,
  rainbowColourAt,
  rainbowFromColours,
  setRainbowStops,
} from '../../../renderer/utils/rainbowPalette';

const lchOf = (colour: string) => {
  const parsed = parseCssColour(colour);
  if (!parsed) {
    throw new Error(`not a colour: ${colour}`);
  }
  const { l, a, b } = rgbToLab(parsed.rgb);
  return {
    l,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
};

/** Red, orange, yellow and green: the half of the flag Aurora leaves out. */
const isFlagWarmOrGreen = (hue: number) => hue > 15 && hue < 165;

afterEach(() => {
  setRainbowStops(undefined);
  document.documentElement.removeAttribute('style');
});

describe('Aurora', () => {
  it('is seven stops, cold hues only: no red, orange, yellow or green', () => {
    expect(AURORA).toHaveLength(RAINBOW_STOP_COUNT);
    AURORA.forEach((stop) => {
      expect(isFlagWarmOrGreen(lchOf(stop).h)).toBe(false);
    });
    // Positive control: the palette it replaced was the flag.
    const flag = ['#ff4d6d', '#ff9f45', '#ffd93d', '#6bcb77'];
    expect(
      flag.filter((stop) => isFlagWarmOrGreen(lchOf(stop).h)),
    ).toHaveLength(3);
  });

  it('is the palette in use until a visualizer lends one', () => {
    expect(getRainbowStops()).toEqual(AURORA);
  });
});

describe('the palette in use', () => {
  it('is written on the root, a token per stop, and put back as Aurora', () => {
    const fire = rainbowFromColours(['#1a0500', '#ff6a00', '#ffd000']);
    if (!fire) {
      throw new Error('a fire scene gave no rainbow');
    }
    setRainbowStops(fire);
    const { style } = document.documentElement;
    RAINBOW_TOKENS.forEach((token, index) => {
      expect(style.getPropertyValue(token)).toBe(fire[index]);
    });
    setRainbowStops(undefined);
    RAINBOW_TOKENS.forEach((token, index) => {
      expect(style.getPropertyValue(token)).toBe(AURORA[index]);
    });
  });

  it('refuses anything but seven stops', () => {
    setRainbowStops(['#ff0000', '#00ff00']);
    expect(getRainbowStops()).toEqual(AURORA);
  });

  it('colours the bands, low to high, first stop to last', () => {
    const fire = rainbowFromColours(['#1a0500', '#ff6a00', '#ffd000']);
    if (!fire) {
      throw new Error('a fire scene gave no rainbow');
    }
    setRainbowStops(fire);
    const low = parseCssColour(getBandColor(0).color);
    const first = parseCssColour(fire[0]);
    expect(low?.rgb.map((channel) => Math.round(channel * 255))).toEqual(
      first?.rgb.map((channel) => Math.round(channel * 255)),
    );
    // And a palette handed in wins over the one in use.
    expect(getBandColor(0, AURORA).color).toBe('rgb(0, 229, 207)');
  });

  it('turns as a loop: a whole turn is the first stop again', () => {
    expect(rainbowColourAt(0)).toBe(rainbowColourAt(1));
    expect(rainbowColourAt(0)).toBe('rgb(0, 229, 207)');
    expect(rainbowColourAt(0.5, 0, 0.3)).toMatch(/^rgba\(.*, 0\.300\)$/);
  });
});

describe('a visualizer’s colours', () => {
  it('keeps Aurora for a scene in greys', () => {
    expect(
      rainbowFromColours(['#000000', '#ffffff', '#808080']),
    ).toBeUndefined();
  });

  it('stays in a warm scene’s own colours, never wandering into blue or green', () => {
    const fire = rainbowFromColours(['#1a0500', '#ff6a00', '#ffd000']) ?? [];
    expect(fire).toHaveLength(RAINBOW_STOP_COUNT);
    fire.forEach((stop) => {
      const { h } = lchOf(stop);
      expect(h > 20 && h < 120).toBe(true);
    });
  });

  it('holds a teal and a pink apart rather than blending them through grey', () => {
    const neon = rainbowFromColours(['#050a1a', '#00e5cf', '#ef1684']) ?? [];
    expect(neon).toHaveLength(RAINBOW_STOP_COUNT);
    neon.forEach((stop) => {
      expect(lchOf(stop).c).toBeGreaterThan(0.1);
    });
  });

  it('spreads a scene in one colour either side of its hue', () => {
    const blue = rainbowFromColours(['#1e60ff']) ?? [];
    const hues = blue.map((stop) => lchOf(stop).h);
    expect(new Set(blue).size).toBeGreaterThan(2);
    const centre = lchOf('#1e60ff').h;
    hues.forEach((hue) => {
      const apart = Math.abs(((hue - centre + 540) % 360) - 180);
      expect(apart).toBeLessThanOrEqual(30);
    });
  });

  it('lifts a deep colour to where a thin mark can be read on the dark floor', () => {
    const deep = rainbowFromColours(['#120a40', '#40106a']) ?? [];
    deep.forEach((stop) => {
      expect(lchOf(stop).l).toBeGreaterThanOrEqual(0.69);
    });
  });
});

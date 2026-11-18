/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Rainbow mode's palette: Lagoon, never the flag, and a Plus visualizer's own
 * colours while one is chosen (Ivan, 2026-09-26: "que podemos hacer para que
 * no se parezca al LGBT", then "different rainbow modes depending on the
 * current plus viz", then "wave lagoon" — the icon's own colours).
 */

import { getBandColor } from '../../../renderer/utils/bandColors';
import {
  contrast,
  luminance,
  parseCssColour,
  rgbToLab,
  toLinear,
} from '../../../renderer/utils/oklab';
import {
  LAGOON,
  RAINBOW_STOP_COUNT,
  RAINBOW_TOKENS,
  getRainbowStops,
  rainbowBetween,
  rainbowColourAt,
  rainbowFromColours,
  setRainbowStops,
  stopOnWhite,
} from '../../../renderer/utils/rainbowPalette';
import { setLightWindow } from '../../../renderer/utils/windowSide';

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

/** Red, orange, yellow and green: the half of the flag Lagoon leaves out. */
const isFlagWarmOrGreen = (hue: number) => hue > 15 && hue < 165;

afterEach(() => {
  setRainbowStops(undefined);
  document.documentElement.removeAttribute('style');
});

describe('Lagoon', () => {
  it('is seven stops, cold hues only: no red, orange, yellow or green', () => {
    expect(LAGOON).toHaveLength(RAINBOW_STOP_COUNT);
    LAGOON.forEach((stop) => {
      expect(isFlagWarmOrGreen(lchOf(stop).h)).toBe(false);
    });
    // Positive control: the palette it replaced was the flag.
    const flag = ['#ff4d6d', '#ff9f45', '#ffd93d', '#6bcb77'];
    expect(
      flag.filter((stop) => isFlagWarmOrGreen(lchOf(stop).h)),
    ).toHaveLength(3);
  });

  it('is the palette in use until a visualizer lends one', () => {
    expect(getRainbowStops()).toEqual(LAGOON);
  });
});

describe('the palette in use', () => {
  it('is written on the root, a token per stop, and put back as Lagoon', () => {
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
      expect(style.getPropertyValue(token)).toBe(LAGOON[index]);
    });
  });

  it('refuses anything but seven stops', () => {
    setRainbowStops(['#ff0000', '#00ff00']);
    expect(getRainbowStops()).toEqual(LAGOON);
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
    expect(getBandColor(0, LAGOON).color).toBe('rgb(114, 247, 221)');
  });

  it('turns as a loop: a whole turn is the first stop again', () => {
    expect(rainbowColourAt(0)).toBe(rainbowColourAt(1));
    expect(rainbowColourAt(0)).toBe('rgb(114, 247, 221)');
    expect(rainbowColourAt(0.5, 0, 0.3)).toMatch(/^rgba\(.*, 0\.300\)$/);
  });
});

describe('a visualizer’s colours', () => {
  it('keeps Lagoon for a scene in greys', () => {
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

/** A colour's contrast against the white panes of a light window. */
const onWhite = (hex: string) => {
  const parsed = parseCssColour(hex);
  return parsed ? contrast(luminance(parsed.rgb.map(toLinear)), 1) : 0;
};

const hueApart = (left: number, right: number) => {
  const apart = Math.abs(left - right) % 360;
  return apart > 180 ? 360 - apart : apart;
};

/**
 * The window's own pair (2026-11-18, `windowTint.ts`): one colour seven
 * times, or a gradient from the first to the second the short way round the
 * wheel, its ends exactly the two colours.
 */
describe('the stops between two colours', () => {
  it('is one colour seven times when both are the same', () => {
    expect(rainbowBetween('#3fa4d0', '#3fa4d0')).toEqual(
      Array(RAINBOW_STOP_COUNT).fill('#3fa4d0'),
    );
  });

  it('runs from one to the other the short way round, its ends exact', () => {
    const stops = rainbowBetween('#00c8d0', '#7a5cff');
    expect(stops).toHaveLength(RAINBOW_STOP_COUNT);
    expect(stops[0]).toBe('#00c8d0');
    expect(stops[RAINBOW_STOP_COUNT - 1]).toBe('#7a5cff');
    const from = lchOf('#00c8d0').h;
    const to = lchOf('#7a5cff').h;
    stops.slice(1, -1).forEach((stop) => {
      const { h } = lchOf(stop);
      // Between the two on the short arc: never back through green.
      expect(hueApart(h, from) + hueApart(h, to)).toBeLessThan(
        hueApart(from, to) + 2,
      );
    });
  });

  it('fades a colour to a grey end in its own hue', () => {
    const stops = rainbowBetween('#d03f8a', '#808080');
    const hue = lchOf('#d03f8a').h;
    stops.slice(1, -1).forEach((stop) => {
      expect(hueApart(lchOf(stop).h, hue)).toBeLessThan(4);
    });
  });
});

/**
 * Colourful mode on a light window (2026-11-18, "Consola"): every stop taken
 * down in lightness until a 2px line in it reads on white at 3:1 (WCAG
 * 1.4.11), its hue kept, a stop that reads already left alone.
 */
describe('the palette on a light window', () => {
  it('takes a pastel down until it reads on white, keeping its hue', () => {
    const pastel = '#9ff0ff';
    expect(onWhite(pastel)).toBeLessThan(3);
    const worn = stopOnWhite(pastel);
    expect(onWhite(worn)).toBeGreaterThanOrEqual(3);
    expect(hueApart(lchOf(worn).h, lchOf(pastel).h)).toBeLessThan(6);
    // Only as far as it has to: well short of a dark ink.
    expect(onWhite(worn)).toBeLessThan(3.2);
  });

  it('reads on white at every stop of Lagoon once worn there', () => {
    LAGOON.forEach((stop) => {
      expect([stop, onWhite(stopOnWhite(stop)) >= 3]).toEqual([stop, true]);
    });
  });

  it('leaves a stop that already reads as it is, and takes a worn one no further', () => {
    expect(stopOnWhite('#1d3a8a')).toBe('#1d3a8a');
    const worn = stopOnWhite('#9ff0ff');
    expect(stopOnWhite(worn)).toBe(worn);
  });

  it('wears the chosen palette on the side of the Brightness the window is on', () => {
    setRainbowStops(LAGOON);
    expect(getRainbowStops()).toEqual(LAGOON);
    setLightWindow(true);
    try {
      expect(getRainbowStops()).toEqual(LAGOON.map(stopOnWhite));
      expect(getRainbowStops()).not.toEqual(LAGOON);
      // A palette chosen while light is worn light at once.
      const pair = rainbowBetween('#9ff0ff', '#ffb0e0');
      setRainbowStops(pair);
      expect(getRainbowStops()).toEqual(pair.map(stopOnWhite));
    } finally {
      setLightWindow(false);
    }
    // CONTROL: back on the dark side, the palette as chosen.
    expect(getRainbowStops()).toEqual(rainbowBetween('#9ff0ff', '#ffb0e0'));
  });
});

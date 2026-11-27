/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The standard looks read on the white window (Ivan, 2026-11-19: "review all
 * standard viz to make sure they work also nice on white theme"). A scan of
 * the 39 looks found the night colours, the whitened highlights, the glow
 * added as light and the floor darkened toward black all vanishing or going
 * grey on white: Skyline's towers at 1.1:1, LED bars at 1.2:1. What each picture does with these is checked on screen;
 * what every picture is handed for each side of the Brightness is held here,
 * each light-window case beside the dark-window answer it must not change.
 */

import {
  CITY_DAY_INKS,
  CITY_INKS,
  cityInks,
  cityTowerColours,
  towerEdgeInk,
} from '../../../../renderer/graph/citySkyline';
import LOOK_GLSL from '../../../../renderer/graph/engineLooks/lookGlsl';
import ANALYSIS_GLSL from '../../../../renderer/graph/engineLooks/analysisGlsl';
import {
  createLookInput,
  lightRamp,
  writeWindowInk,
} from '../../../../renderer/graph/engineLooks/lookInput';
import {
  glowComposite,
  lightInkAt,
  sparkRgb,
  starShare,
} from '../../../../renderer/graph/sceneViews/sceneFrame';
import {
  DAY_HALO_STOPS,
  HALO_STOPS,
  haloStops,
} from '../../../../renderer/graph/nightSurfaces';
import {
  floorDarkening,
  floorInk,
  windowFloor,
} from '../../../../renderer/utils/windowInk';
import { setLightWindow } from '../../../../renderer/utils/windowSide';

/** The white window's floor, as the scan measured it. */
const WHITE_FLOOR = '#ececec';
const DARK_FLOOR = '#0a1826';
const ACCENT = '#00777d';

const channels = (colour: string): [number, number, number] => {
  const rgba = /rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)/.exec(
    colour,
  );
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  }
  const hex = colour.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : hex.slice(0, 6);
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const luminance = ([red, green, blue]: readonly number[]): number => {
  const lin = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue);
};

/** The WCAG contrast of two colours, `#rrggbb` or `rgba(...)`. */
const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(channels(a)), luminance(channels(b))].sort(
    (x, y) => y - x,
  );
  return (high + 0.05) / (low + 0.05);
};

const root = document.documentElement;

afterEach(() => {
  setLightWindow(false);
  root.style.removeProperty('--surface-base');
  root.style.removeProperty('--ink');
});

describe('a highlight', () => {
  it('lifts toward white on a dark window and deepens on a light one', () => {
    const base = luminance(channels(ACCENT));
    const night = luminance(channels(lightInkAt([ACCENT], 0.5, 0.55, 1)));
    expect(night).toBeGreaterThan(base);
    setLightWindow(true);
    const day = lightInkAt([ACCENT], 0.5, 0.55, 1);
    expect(luminance(channels(day))).toBeLessThan(base);
    // A held peak reads on the white floor; whitened, it was the floor.
    expect(contrast(day, WHITE_FLOOR)).toBeGreaterThan(
      contrast(ACCENT, WHITE_FLOOR),
    );
  });

  it('colours the engine sprites the same way as the page paints', () => {
    const [red] = lightRamp([ACCENT], 0.5, 0.55);
    expect(red).toBeGreaterThan(0);
    setLightWindow(true);
    const day = lightRamp([ACCENT], 0.5, 0.55);
    const page = channels(lightInkAt([ACCENT], 0.5, 0.55, 1));
    day.forEach((channel, index) =>
      expect(Math.round(channel * 255)).toBeCloseTo(page[index], -0.5),
    );
  });
});

describe('a glow', () => {
  it('is added as light on a dark window and laid on as colour on a light one', () => {
    expect(glowComposite()).toBe('lighter');
    setLightWindow(true);
    expect(glowComposite()).toBe('source-over');
  });
});

describe('a spark and a star', () => {
  it('are white and shown on a dark window', () => {
    expect(sparkRgb([ACCENT])).toEqual([1, 1, 1]);
    expect(starShare()).toBe(1);
  });

  it("take the look's colour, deepened, and leave the sky on a light one", () => {
    setLightWindow(true);
    const spark = sparkRgb([ACCENT]).map((channel) =>
      Math.round(channel * 255),
    );
    expect(luminance(spark)).toBeLessThan(luminance(channels(ACCENT)));
    expect(starShare()).toBe(0);
  });
});

describe('a body made of the floor', () => {
  it('keeps all its darkening on a dark window', () => {
    expect(floorDarkening(0.3)).toBeCloseTo(0.3);
  });

  it('stays near the floor on a light window instead of turning grey', () => {
    root.style.setProperty('--surface-base', WHITE_FLOOR);
    setLightWindow(true);
    expect(floorDarkening(0.3)).toBeLessThan(0.06);
    // The legend's pill: the grey the scan saw would be 1.7:1 off the floor.
    expect(contrast(floorInk(1, 0.3), WHITE_FLOOR)).toBeLessThan(1.2);
  });
});

describe("the Skyline's towers", () => {
  it('stand out of a dark floor by being lighter than it', () => {
    root.style.setProperty('--surface-base', DARK_FLOOR);
    expect(windowFloor()).toEqual(channels(DARK_FLOOR));
    cityTowerColours().forEach((tower) =>
      expect(luminance(channels(tower))).toBeGreaterThan(
        luminance(channels(DARK_FLOOR)),
      ),
    );
  });

  it('stand out of a white floor by being darker, where lifted they were white on white', () => {
    root.style.setProperty('--surface-base', WHITE_FLOOR);
    setLightWindow(true);
    const towers = cityTowerColours();
    towers.forEach((tower) =>
      expect(contrast(tower, WHITE_FLOOR)).toBeGreaterThan(2.3),
    );
    // The street darkest, the sunlit roofs lightest.
    expect(contrast(towers[0], WHITE_FLOOR)).toBeGreaterThan(3);
  });
});

describe("the Skyline's outlines", () => {
  it('are a lighter tone of each tower on a dark window', () => {
    root.style.setProperty('--surface-base', DARK_FLOOR);
    cityTowerColours().forEach((tower) => {
      const edge = towerEdgeInk(tower);
      expect(luminance(channels(edge))).toBeGreaterThan(
        luminance(channels(tower)),
      );
      // Clear of the tower it outlines, so the edge reads.
      expect(contrast(edge, tower)).toBeGreaterThan(2);
    });
  });

  it('are a darker tone of each tower on a light window', () => {
    root.style.setProperty('--surface-base', WHITE_FLOOR);
    setLightWindow(true);
    cityTowerColours().forEach((tower) => {
      const edge = towerEdgeInk(tower);
      expect(luminance(channels(edge))).toBeLessThan(
        luminance(channels(tower)),
      );
      expect(contrast(edge, tower)).toBeGreaterThan(2);
    });
  });

  it("follow a palette's colour rather than a fixed ink", () => {
    // The control: two towers of different colours get different edges, and
    // neither is plain white or black.
    const blue = towerEdgeInk('#2060c0');
    const red = towerEdgeInk('#c02040');
    expect(blue).not.toBe(red);
    [blue, red].forEach((edge) => {
      expect(edge).not.toMatch(/rgba\(255, 255, 255|rgba\(0, 0, 0/);
    });
  });
});

describe('the night scenes by day', () => {
  it('keep their night inks on a dark window', () => {
    expect(cityInks()).toBe(CITY_INKS);
    expect(haloStops()).toBe(HALO_STOPS);
  });

  it('change every ink that vanished on white for one that reads', () => {
    setLightWindow(true);
    expect(cityInks()).toBe(CITY_DAY_INKS);
    expect(haloStops()).toBe(DAY_HALO_STOPS);
    // The sun where the moon stood, and no craters on it.
    expect(contrast(CITY_INKS.moon.colour, WHITE_FLOOR)).toBeLessThan(1.3);
    expect(contrast(CITY_DAY_INKS.moon.colour, WHITE_FLOOR)).toBeGreaterThan(2);
    expect(CITY_DAY_INKS.crater.alpha).toBe(0);
  });
});

describe("the engine's shaders", () => {
  it('declare the window ink once, for every look', () => {
    const declared = (text: string) =>
      text.split('uniform vec3 uWindowInk;').length - 1;
    expect(declared(LOOK_GLSL)).toBe(1);
    expect(declared(ANALYSIS_GLSL)).toBe(0);
  });

  it('define each light-window helper before what calls it', () => {
    // GLSL has no forward use: a helper written after its caller fails to
    // compile and the look goes back to the page for the session.
    const at = (signature: string) => {
      const index = LOOK_GLSL.indexOf(signature);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(at('bool lookOnLight()')).toBeLessThan(at('vec3 lookLightInk('));
    expect(at('vec3 lookLightInk(')).toBeLessThan(at('vec3 lookSpark()'));
    expect(at('vec4 lookOver(')).toBeLessThan(at('vec4 lookGlow('));
    expect(at('vec4 lookOver(')).toBeLessThan(at('vec4 lookBloomed('));
  });

  it("are told the side by the window's ink, for scenes as for measuring views", () => {
    const input = createLookInput('ledbars');
    root.style.setProperty('--ink', '#1b1b1b');
    writeWindowInk(input);
    expect(Array.from(input.windowInk)).toEqual(
      [0x1b, 0x1b, 0x1b].map((channel) => expect.closeTo(channel / 255, 3)),
    );
  });
});

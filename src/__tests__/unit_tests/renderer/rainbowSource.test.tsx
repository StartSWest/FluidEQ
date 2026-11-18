/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Colourful mode draws in (`RainbowSource`). With a standard look, the
 * window's own pair (2026-11-18, `windowTint.ts`): its first colour seven
 * times, or a gradient to a second the listener chose. With a Plus
 * visualizer, the scene's: its palette, else the accent and the glow it
 * lends the window at its hour (made from its picture as measured, where it
 * names none), else its picker icon's colours until then (Ivan, 2026-09-26:
 * "read from the same viz automatically, because the viz know nothing about
 * colours"). A scene the window is set to Original over, with a Tint the
 * listener touched, draws the Tint's pair; a scene in greys, the window's
 * own pair rather than Lagoon.
 */

import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import { hueDistance, parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  RAINBOW_STOP_COUNT,
  rainbowBetween,
} from 'renderer/utils/rainbowPalette';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneColour,
  type ISceneSky,
} from 'renderer/utils/sceneTint';

let mockLookId = 'premium:forest';
let mockSwatch: string[] = ['#1a0500', '#ff6a00', '#ffd000'];

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'forest',
      lookId: 'premium:forest',
      version: 1,
      // Warm: nothing like the measured palette below.
      swatch: mockSwatch,
    },
  ],
}));
jest.mock('renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));

const colour = (hue: number): ISceneColour => ({
  lightness: 0.75,
  chroma: 0.14,
  hue,
  share: 0.05,
});

const MEASURED: ISceneSky = {
  ...colour(150),
  accent: colour(130),
  active: colour(195),
  palette: [130, 195, 245, 300, 80].map(colour),
};

const hueOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  const { a, b } = rgbToLab(parsed.rgb);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};

beforeEach(() => {
  mockLookId = 'premium:forest';
  mockSwatch = ['#1a0500', '#ff6a00', '#ffd000'];
});

/**
 * The stops in use once `RainbowSource` has rendered, from a fresh app with
 * `stored` measured for the scene and `settings` in storage.
 */
const stopsWith = (
  stored: ISceneSky | undefined,
  settings: Record<string, string> = {},
): readonly string[] => {
  window.localStorage.clear();
  if (stored) {
    window.localStorage.setItem(
      'fluideq.sceneTint.skies',
      JSON.stringify({
        measurement: SCENE_SKY_MEASUREMENT,
        rows: [['premium:forest', '1', stored]],
      }),
    );
  }
  Object.entries(settings).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let stops: readonly string[] = [];
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh store for each launch */
    const library: typeof TestingLibrary = require('@testing-library/react/pure');
    const RainbowSource: () => ReactElement | null =
      require('renderer/components/RainbowSource').default;
    const palette: typeof import('renderer/utils/rainbowPalette') = require('renderer/utils/rainbowPalette');
    /* eslint-enable global-require */
    library.render(<RainbowSource />);
    stops = palette.getRainbowStops();
    library.cleanup();
  });
  return stops;
};

describe('Colourful mode with a Plus visualizer', () => {
  // A scene that names no window colours lends the accent and the glow the
  // app works out of its picture: every stop near one of the measured hues.
  it('draws in the window colours made from the visualizer’s measured picture', () => {
    const stops = stopsWith(MEASURED);
    expect(stops).toHaveLength(RAINBOW_STOP_COUNT);
    // None in the swatch's orange.
    stops.forEach((stop) => {
      const nearest = Math.min(
        ...[130, 195, 245, 300, 80].map((hue) => hueDistance(hueOf(stop), hue)),
      );
      expect(nearest).toBeLessThan(40);
    });
  });

  // The control: never measured, it is the picker icon's warm colours.
  it('draws in its icon’s colours before it has been measured', () => {
    const stops = stopsWith(undefined);
    stops.forEach((stop) => {
      const hue = hueOf(stop);
      expect(hue > 20 && hue < 120).toBe(true);
    });
  });

  it('draws in the Tint’s pair over a scene the window is set to Original over', () => {
    const settings = {
      'fluideq.sceneTintMode': 'off',
      'fluideq.windowTintColour': '#ff0080',
      'fluideq.windowTint': '350',
      'fluideq.windowTintSecondary': '#00c0ff',
    };
    expect(stopsWith(MEASURED, settings)).toEqual(
      rainbowBetween('#ff0080', '#00c0ff'),
    );
    // CONTROL: in the scene's colours, the scene's stops, whatever the Tint.
    const inScene = stopsWith(MEASURED, {
      ...settings,
      'fluideq.sceneTintMode': 'tint',
    });
    expect(inScene).not.toEqual(rainbowBetween('#ff0080', '#00c0ff'));
  });

  it('leaves a scene its colours on Original while the Tint is untouched', () => {
    const stops = stopsWith(MEASURED, { 'fluideq.sceneTintMode': 'off' });
    stops.forEach((stop) => {
      const nearest = Math.min(
        ...[130, 195, 245, 300, 80].map((hue) => hueDistance(hueOf(stop), hue)),
      );
      expect(nearest).toBeLessThan(40);
    });
  });

  it('draws a scene in greys in the window’s own colour, not a rainbow', () => {
    mockSwatch = ['#101010', '#808080', '#e0e0e0'];
    const stops = stopsWith(undefined, {
      'fluideq.windowTintColour': '#40c0a0',
      'fluideq.windowTint': '165',
    });
    expect(stops).toEqual(Array(RAINBOW_STOP_COUNT).fill('#40c0a0'));
  });
});

describe('Colourful mode with a standard look', () => {
  beforeEach(() => {
    mockLookId = 'look:signal';
  });

  it('draws in one colour by default, seven times', () => {
    const stops = stopsWith(undefined);
    expect(stops).toHaveLength(RAINBOW_STOP_COUNT);
    expect(new Set(stops).size).toBe(1);
  });

  it('draws a gradient once the Tint is given a second colour', () => {
    const stops = stopsWith(undefined, {
      'fluideq.windowTintColour': '#ff8800',
      'fluideq.windowTint': '50',
      'fluideq.windowTintSecondary': '#8800ff',
    });
    expect(stops).toEqual(rainbowBetween('#ff8800', '#8800ff'));
    expect(new Set(stops).size).toBeGreaterThan(2);
  });
});

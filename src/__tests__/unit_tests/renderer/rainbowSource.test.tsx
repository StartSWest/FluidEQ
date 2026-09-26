/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Rainbow mode's palette while a Plus visualizer is chosen: the five colours
 * read from its own frames once it has been measured, its picker icon's two
 * to four until then (Ivan, 2026-09-26: "read from the same viz
 * automatically, because the viz know nothing about colours").
 */

import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import { hueDistance, parseCssColour, rgbToLab } from 'renderer/utils/oklab';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneColour,
  type ISceneSky,
} from 'renderer/utils/sceneTint';

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => 'premium:forest',
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'forest',
      lookId: 'premium:forest',
      version: 1,
      // Warm: nothing like the measured palette below.
      swatch: ['#1a0500', '#ff6a00', '#ffd000'],
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

/** The stops in use once `RainbowSource` has rendered, from a fresh app. */
const stopsWith = (stored: ISceneSky | undefined): readonly string[] => {
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

describe('Rainbow mode with a Plus visualizer', () => {
  it('draws in the colours measured from the visualizer', () => {
    const stops = stopsWith(MEASURED);
    expect(stops).toHaveLength(7);
    // Every stop lies near one of the measured colours, none in the swatch's
    // orange.
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
});

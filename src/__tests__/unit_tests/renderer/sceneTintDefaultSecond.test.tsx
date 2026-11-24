/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "On" in the window's own colours (`SceneTint`, `IOwnOn`) with the Tint's
 * default second colour (Ivan, 2026-11-24: "I think we should default a
 * second color for the app UI. Pick a nice purple one"). On a standard look
 * the switches, pills and lit marks say "on" in the violet from the first
 * launch; one colour asked for puts "on" back in the accent. Over a scene the
 * window is set to Original over, the default is no choice of the
 * listener's: "on" is what it was before the default - the scene's own glow
 * where it lends one, the accent otherwise - never the violet.
 */

import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import { labOf } from 'renderer/utils/windowFill';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneColour,
  type ISceneSky,
} from 'renderer/utils/sceneTint';

let mockLookId = 'look:signal';

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'forest',
      lookId: 'premium:forest',
      version: 1,
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

/** A scene measured green, with a warm yellow glow far from the violet. */
const MEASURED: ISceneSky = {
  ...colour(150),
  accent: colour(150),
  active: colour(90),
  palette: [150, 90].map(colour),
};

beforeEach(() => {
  mockLookId = 'look:signal';
});

/** The hue of a CSS colour in OKLab, in degrees. */
const hueOf = (text: string): number => {
  const lab = labOf(text);
  if (!lab) {
    throw new Error(`not a colour: ${text}`);
  }
  return ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
};

const hueGap = (left: number, right: number) => {
  const gap = Math.abs(left - right) % 360;
  return Math.min(gap, 360 - gap);
};

/** `--active` and `--accent` on the root once `SceneTint` has painted. */
const paintedWith = (
  settings: Record<string, string>,
  stored?: ISceneSky,
): { active: string; accent: string } => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('style');
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
  let painted = { active: '', accent: '' };
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh store for each launch */
    const library: typeof TestingLibrary = require('@testing-library/react/pure');
    const SceneTint: () => ReactElement | null =
      require('renderer/components/SceneTint').default;
    /* eslint-enable global-require */
    library.render(<SceneTint />);
    const root = document.documentElement.style;
    painted = {
      active: root.getPropertyValue('--active').trim(),
      accent: root.getPropertyValue('--accent').trim(),
    };
    library.cleanup();
  });
  window.localStorage.clear();
  document.documentElement.removeAttribute('style');
  return painted;
};

const VIOLET_HUE = hueOf('#8b6cff');

describe('"on" with the Tint’s default second colour', () => {
  it('is the default violet on a standard look where nothing was chosen', () => {
    const { active } = paintedWith({});
    expect(hueGap(hueOf(active), VIOLET_HUE)).toBeLessThan(12);
  });

  it('is the accent once one colour is asked for', () => {
    const { active, accent } = paintedWith({
      'fluideq.windowTintSecondary': 'none',
    });
    expect(active).toBe(accent);
    // CONTROL: the violet is far from the accent, so the two cases differ.
    expect(hueGap(hueOf(active), VIOLET_HUE)).toBeGreaterThan(40);
  });

  it('keeps a colour chosen there, #ae00ff included', () => {
    const { active } = paintedWith({
      'fluideq.windowTintSecondary': '#ae00ff',
    });
    expect(hueGap(hueOf(active), hueOf('#ae00ff'))).toBeLessThan(12);
  });

  it('leaves a scene on Original its own colours, not the default violet', () => {
    mockLookId = 'premium:forest';
    const { active } = paintedWith(
      { 'fluideq.sceneTintMode': 'off' },
      MEASURED,
    );
    expect(hueGap(hueOf(active), VIOLET_HUE)).toBeGreaterThan(40);
    // CONTROL: a second colour CHOSEN takes "on" over the scene.
    const chosen = paintedWith(
      {
        'fluideq.sceneTintMode': 'off',
        'fluideq.windowTintSecondary': '#8b6cff',
      },
      MEASURED,
    );
    expect(hueGap(hueOf(chosen.active), VIOLET_HUE)).toBeLessThan(12);
  });
});

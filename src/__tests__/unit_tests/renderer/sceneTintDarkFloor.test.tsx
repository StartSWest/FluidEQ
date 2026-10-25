/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's floor under a visualizer's colours below 50% Brightness: the
 * colour it has at 50%, darkened toward near black at 0, and nothing else
 * moved (Ivan, 2026-10-24/25: "just the bg color dont touch primary or sec",
 * "when I move to 0 it gets lost its color when on ambient or color mode").
 *
 * The scene is never drawn here: its measurement is stood in for by a
 * remembered sky, as in `sceneTintWindow.test.tsx`.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneSky,
} from '../../../renderer/utils/sceneTint';
import { tintThemePalette } from '../../../renderer/utils/sceneTintPalette';
import { themeShadeTokens } from '../../../renderer/utils/themeShade';
import { parseCssColour, rgbToLab } from '../../../renderer/utils/oklab';

jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => 'premium:fireflies',
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    { id: 'fireflies', lookId: 'premium:fireflies', version: 3, swatch: [] },
  ],
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));
jest.mock('../../../renderer/graph/sceneSky', () => ({
  measureSceneSky: () => Promise.resolve(undefined),
  measureStudioSky: () => Promise.resolve(undefined),
}));

const root = document.documentElement;

/**
 * Fireflies as Ivan's window measured it: little of the frame, little colour,
 * so the toning lends the window a fifth of its hue — the scene the tint was
 * lost on.
 */
const FAINT: ISceneSky = {
  hue: 131,
  chroma: 0.049,
  lightness: 0.22,
  share: 0.13,
  accent: null,
  active: null,
};

const THEME = `:root { --surface-base: #0d2030; --surface-panel: #1a3a4e; --accent: #00e5cf; --active: #54ff8a; }`;

let library: typeof TestingLibrary | undefined;
type TTheme = typeof import('../../../renderer/utils/theme');

beforeEach(() => {
  window.localStorage.setItem(
    'fluideq.sceneTint.skies',
    JSON.stringify({
      measurement: SCENE_SKY_MEASUREMENT,
      rows: [['premium:fireflies', '3', FAINT]],
    }),
  );
  const style = document.createElement('style');
  style.id = 'theme';
  style.textContent = THEME;
  document.head.appendChild(style);
});

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
  root.removeAttribute('style');
  root.removeAttribute('data-scene-tint');
  document.getElementById('theme')?.remove();
});

/** The window at `shade` in `mode`, and the theme module it reads. */
const mount = (mode: string, shade: number) => {
  window.localStorage.setItem('fluideq.sceneTintMode', mode);
  window.localStorage.setItem('fluideq.theme', String(shade));
  let theme: TTheme | undefined;
  let SceneTint: (() => ReactElement | null) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    theme = require('../../../renderer/utils/theme');
    SceneTint = require('../../../renderer/components/SceneTint').default;
    /* eslint-enable global-require */
  });
  if (!theme || !SceneTint || !library) {
    throw new Error('the tint did not load');
  }
  const Tint = SceneTint;
  library.render(<Tint />);
  return theme;
};

const token = (name: string) => root.style.getPropertyValue(name);

const floorAt = (mode: string, shade: number) => {
  mount(mode, shade);
  const floor = token('--surface-base');
  library?.cleanup();
  root.removeAttribute('style');
  return floor;
};

const labOf = (hex: string) => {
  const parsed = parseCssColour(hex);
  if (!parsed) {
    throw new Error(`not a colour: ${hex}`);
  }
  return rgbToLab(parsed.rgb);
};

const hueOf = (hex: string) => {
  const { a, b } = labOf(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};

const hueApart = (left: number, right: number) => {
  const apart = Math.abs(left - right) % 360;
  return apart > 180 ? 360 - apart : apart;
};

/** What the toning alone gives at the theme's `toneShade`. */
const toned = (toneShade: number) =>
  tintThemePalette(themeShadeTokens(toneShade), FAINT, 1);

// Colours and Ambient tone against a shorter walk: 30 at 0, 65 at 50
// (`toneShadeOf`); the Backdrop against the Brightness itself.
const heldShade = (brightness: number) => Math.round(30 + brightness * 0.7);

describe('the floor below 50% Brightness', () => {
  // Within 8 degrees: a near-black floor is written in whole bytes, and at
  // #03090a one step of red turns the hue 6 degrees (measured, the Backdrop at
  // 0); the drift this guards against was 55.
  it('keeps the hue it has at 50% all the way to 0, in Colours, Ambient and the Backdrop', () => {
    ['tint', 'pulse', 'cover'].forEach((mode) => {
      const knee = hueOf(floorAt(mode, 50));
      [0, 10, 25, 40].forEach((shade) => {
        expect(hueApart(hueOf(floorAt(mode, shade)), knee)).toBeLessThan(8);
      });
    });
    // POSITIVE CONTROL: the toning on its own, which the floor used to be,
    // drifts well off that hue at 0 — the lost tint this test exists for.
    expect(
      hueApart(
        hueOf(toned(0)['--surface-base'] ?? ''),
        hueOf(toned(50)['--surface-base'] ?? ''),
      ),
    ).toBeGreaterThan(20);
  });

  it('is near black at 0 and darker at every step down', () => {
    let previous = Number.POSITIVE_INFINITY;
    [50, 40, 25, 10, 0].forEach((shade) => {
      const { l } = labOf(floorAt('tint', shade));
      expect(l).toBeLessThan(previous);
      previous = l;
    });
    expect(previous).toBeCloseTo(0.13, 2);
  });

  it('moves the floor alone: the panes, edges and accent keep their toning', () => {
    mount('tint', 0);
    const expected = toned(heldShade(0));
    [
      '--surface-panel',
      '--surface-block',
      '--border-panel',
      '--border-subtle',
    ].forEach((name) =>
      expect(token(name)).toBe(expected[name as keyof typeof expected]),
    );
    // POSITIVE CONTROL: the floor is the one token that moved.
    expect(token('--surface-base')).not.toBe(expected['--surface-base']);
  });

  it('leaves 50% and the light half exactly as the toning paints them', () => {
    [50, 75, 100].forEach((shade) => {
      expect(floorAt('tint', shade)).toBe(
        toned(heldShade(shade))['--surface-base'],
      );
      expect(floorAt('cover', shade)).toBe(toned(shade)['--surface-base']);
    });
  });

  // 1% and 2% tone against the same rounded shade (31), so a repaint keyed on
  // that shade alone would leave the floor where 1% put it.
  it('follows every step of the slider, not only the steps that move the toning', () => {
    expect(heldShade(1)).toBe(heldShade(2));
    const theme = mount('tint', 1);
    const atOne = token('--surface-base');
    theme.setThemeShade(2);
    expect(token('--surface-base')).not.toBe(atOne);
  });
});

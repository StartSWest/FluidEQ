/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whose colour the window is in: the graph's Plus visualizer, the Studio's
 * project on the bench, or the theme — and what a launch remembers.
 *
 * The scene is never drawn here: its measurement is stood in for, and the
 * remembered skies are what a launch reads from storage.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneSky,
} from '../../../renderer/utils/sceneTint';

let mockLookId = 'premium:bloom';
// The colours of the scene's picker icon, which every scene the list offers
// carries — none, unless a test gives it some.
let mockSwatch: string[] = [];
const mockMeasureScene = jest.fn();
const mockMeasureStudio = jest.fn();

jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    { id: 'bloom', lookId: 'premium:bloom', version: 3, swatch: mockSwatch },
  ],
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));
jest.mock('../../../renderer/graph/sceneSky', () => ({
  measureSceneSky: (...args: unknown[]) => mockMeasureScene(...args),
  measureStudioSky: (...args: unknown[]) => mockMeasureStudio(...args),
}));

// The measurement the app stores now, whatever its number: written as a
// literal it went stale the first time the measuring changed.
const MEASUREMENT = SCENE_SKY_MEASUREMENT;
const root = document.documentElement;

const sky = (hue: number): ISceneSky => ({
  lightness: 0.35,
  chroma: 0.09,
  hue,
  share: 0.6,
  accent: {
    lightness: 0.75,
    chroma: 0.12,
    hue: (hue + 120) % 360,
    share: 0.05,
  },
  active: null,
});

type TStore = typeof import('../../../renderer/utils/sceneTintStore');
let library: typeof TestingLibrary | undefined;

/** The theme's own values, as a stylesheet on the root would declare them. */
const THEME = `:root { --surface-base: #0d2030; --surface-panel: #1a3a4e; --accent: #00e5cf; --active: #54ff8a; }`;

beforeEach(() => {
  mockLookId = 'premium:bloom';
  mockSwatch = [];
  mockMeasureScene.mockReset().mockResolvedValue(undefined);
  mockMeasureStudio.mockReset().mockResolvedValue(undefined);
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

const remember = (
  rows: Array<[string, string, ISceneSky | null]>,
  measurement = MEASUREMENT,
) =>
  window.localStorage.setItem(
    'fluideq.sceneTint.skies',
    JSON.stringify({ measurement, rows }),
  );

const mount = () => {
  let store: TStore | undefined;
  let SceneTint: (() => ReactElement | null) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    store = require('../../../renderer/utils/sceneTintStore');
    SceneTint = require('../../../renderer/components/SceneTint').default;
    /* eslint-enable global-require */
  });
  if (!store || !SceneTint || !library) {
    throw new Error('the tint did not load');
  }
  const Tint = SceneTint;
  library.render(<Tint />);
  return { store, fresh: library };
};

describe('the graph’s visualizer', () => {
  it('opens the window in the colour it was last measured, before anything is drawn', () => {
    remember([['premium:bloom', '3', sky(300)]]);
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toMatch(/^#/);
    expect(mockMeasureScene).not.toHaveBeenCalled();
  });

  // A scene never measured lends its swatch's colour as it is chosen, not
  // after it has loaded (Ivan, 2026-09-25: "I want the color to change first
  // then it loads the viz"), and is measured all the same.
  it('lends a scene never measured its swatch’s colour at once', () => {
    mockSwatch = ['#3a1060', '#e04f9a', '#ffd0ea'];
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toMatch(/^#/);
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3');
  });

  // The control: with no swatch there is nothing to lend before measuring.
  it('lends nothing before measuring a scene with no swatch', () => {
    mount();
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3');
  });

  it('measures a version it has not seen, keeping the colour it had meanwhile', () => {
    remember([['premium:bloom', '2', sky(300)]]);
    mount();
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3');
  });

  it('forgets every sky measured the way it used to be measured', () => {
    remember([['premium:bloom', '3', sky(300)]], MEASUREMENT - 1);
    const { store } = mount();
    expect(store.recallSceneSky('premium:bloom')).toBeUndefined();
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3');
  });

  it('puts the theme back when its mode is the theme', () => {
    remember([['premium:bloom', '3', sky(300)]]);
    const { store, fresh } = mount();
    expect(root).toHaveAttribute('data-scene-tint');
    fresh.act(() => store.setSceneTintMode('off'));
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toBe('');
  });

  it('puts the theme back on a look that is not a scene', () => {
    remember([['premium:bloom', '3', sky(300)]]);
    mockLookId = 'look:signal';
    mount();
    expect(root).not.toHaveAttribute('data-scene-tint');
  });
});

describe('the Studio’s project', () => {
  it('wins over the graph while it is on the bench, and waits on the theme until it is measured', () => {
    remember([
      ['premium:bloom', '3', sky(300)],
      ['studio:mine', 'build-1', sky(40)],
    ]);
    const { store, fresh } = mount();
    const graphSurface = root.style.getPropertyValue('--surface-base');

    fresh.act(() => store.setStudioTintSource({ project: 'mine' }));
    const studioSurface = root.style.getPropertyValue('--surface-base');
    expect(studioSurface).not.toBe(graphSurface);

    // A project never measured is the theme, never the last project's colour.
    fresh.act(() => store.setStudioTintSource({ project: 'unmeasured' }));
    expect(root).not.toHaveAttribute('data-scene-tint');

    fresh.act(() => store.setStudioTintSource(undefined));
    expect(root.style.getPropertyValue('--surface-base')).toBe(graphSurface);
  });
});

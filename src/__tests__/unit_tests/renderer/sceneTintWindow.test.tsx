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
  // At Black, night (`@0`, below): the step a sky is measured at is the
  // Brightness's, and a window with no choice stored opens half way
  // (`theme.ts`). The tests that want Ocean store it over this.
  window.localStorage.setItem('fluideq.theme', 'black');
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

// A scene's colour is measured, and remembered, at the step of the day the
// Brightness stands at (`SceneTint.tsx`): Black, where these run, is night —
// `@0`.
describe('the graph’s visualizer', () => {
  it('opens the window in the colour it was last measured, before anything is drawn', () => {
    remember([['premium:bloom', '3@0', sky(300)]]);
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
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3@0');
  });

  // The control: with no swatch there is nothing to lend before measuring.
  it('lends nothing before measuring a scene with no swatch', () => {
    mount();
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3@0');
  });

  it('measures a version it has not seen, keeping the colour it had meanwhile', () => {
    remember([['premium:bloom', '2@0', sky(300)]]);
    mount();
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3@0');
  });

  it('forgets every sky measured the way it used to be measured', () => {
    remember([['premium:bloom', '3@0', sky(300)]], MEASUREMENT - 1);
    const { store } = mount();
    expect(store.recallSceneSky('premium:bloom')).toBeUndefined();
    expect(mockMeasureScene).toHaveBeenCalledWith('premium:bloom', '3@0');
  });

  it('puts the theme back when its mode is the theme', () => {
    remember([['premium:bloom', '3@0', sky(300)]]);
    const { store, fresh } = mount();
    expect(root).toHaveAttribute('data-scene-tint');
    fresh.act(() => store.setSceneTintMode('off'));
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toBe('');
  });

  // Rainbow mode with no visualizer lends the window Lagoon, as a scene would
  // lend its own colours (Ivan, 2026-09-26: "la interfaz ... debe también kind
  // of match some of the aurora color when there is not plus viz"; the mode's
  // palette is Lagoon since "wave lagoon").
  it('lends the window Lagoon in Rainbow mode with no visualizer chosen', () => {
    mockLookId = 'look:signal';
    window.localStorage.setItem('fluideq.theme', 'ocean');
    root.classList.add('is-euphoric');
    try {
      mount();
      expect(root).toHaveAttribute('data-scene-tint');
      expect(root.style.getPropertyValue('--surface-base')).toMatch(/^#/);
    } finally {
      root.classList.remove('is-euphoric');
    }
  });

  // And outside the mode the same colours, to the digit: Rainbow changes what
  // is drawn in its stops and never the panes or the floor (Ivan, 2026-09-27:
  // "app or pane … need to be exactly the same with rainbow and no rainbow,
  // and I want the one that rainbow on has now").
  it('lends the window the same Lagoon with Rainbow mode off', () => {
    mockLookId = 'look:signal';
    window.localStorage.setItem('fluideq.theme', 'ocean');
    root.classList.add('is-euphoric');
    let inRainbow = '';
    try {
      mount();
      inRainbow = root.style.getPropertyValue('--surface-base');
    } finally {
      root.classList.remove('is-euphoric');
    }
    library?.cleanup();
    root.removeAttribute('style');
    root.removeAttribute('data-scene-tint');

    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toBe(inRainbow);
    // POSITIVE CONTROL: that is a colour of its own, not the theme's floor.
    expect(inRainbow).toMatch(/^#/);
    expect(inRainbow).not.toBe('#0d2030');
  });

  // A visualizer chosen in Theme mode keeps the theme, Rainbow or not: the
  // mode's own colours are the rainbow's, and the window's are the menu's.
  it('keeps the theme for a visualizer in Theme mode, even in Rainbow mode', () => {
    remember([['premium:bloom', '3@0', sky(300)]]);
    window.localStorage.setItem('fluideq.sceneTintMode', 'off');
    root.classList.add('is-euphoric');
    try {
      mount();
      expect(root).not.toHaveAttribute('data-scene-tint');
    } finally {
      root.classList.remove('is-euphoric');
    }
  });

  // Black is the window with no colour in it: the sky lent with no visualizer
  // fades out toward it (Ivan, 2026-09-27: "moving toward the 0 make it no
  // tinting so is pure black / dark gray"), while a visualizer's own colour
  // stays there, darkened (2026-09-25: "is not black is ambient color").
  it('lends no Lagoon at Black, and still a visualizer’s colour there', () => {
    mockLookId = 'look:signal';
    const lent = mount();
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toBe('');
    lent.fresh.cleanup();
    root.removeAttribute('style');

    // POSITIVE CONTROL: a visualizer at the same Black keeps its colour.
    mockLookId = 'premium:bloom';
    remember([['premium:bloom', '3@0', sky(300)]]);
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(root.style.getPropertyValue('--surface-base')).toMatch(/^#/);
  });

  // A Plus visualizer's colours hold in Colours and Ambient however low the
  // Brightness goes (Ivan, 2026-09-28: "on plus viz we keep the viz original
  // color when moving the app brightness"): their walk starts at 30, so Black
  // paints them as the Backdrop, which follows the Brightness all the way,
  // paints them at 30.
  it('holds a visualizer’s colours at Black in Colours and Ambient', () => {
    remember([['premium:bloom', '3@0', sky(300)]]);
    const floorIn = (mode: string, shade: string) => {
      window.localStorage.setItem('fluideq.sceneTintMode', mode);
      window.localStorage.setItem('fluideq.theme', shade);
      const shown = mount();
      const floor = root.style.getPropertyValue('--surface-base');
      shown.fresh.cleanup();
      root.removeAttribute('style');
      root.removeAttribute('data-scene-tint');
      return floor;
    };
    const colours = floorIn('tint', 'black');
    expect(colours).toMatch(/^#/);
    expect(floorIn('pulse', 'black')).toBe(colours);
    expect(floorIn('cover', '30')).toBe(colours);
    // POSITIVE CONTROL: the Backdrop at Black has gone darker than that.
    expect(floorIn('cover', 'black')).not.toBe(colours);
  });

  it('gives a look that is not a scene Lagoon, not a remembered scene’s colour', () => {
    remember([['premium:bloom', '3@0', sky(300)]]);
    window.localStorage.setItem('fluideq.theme', 'ocean');
    const scene = mount();
    const bloomFloor = root.style.getPropertyValue('--surface-base');
    scene.fresh.cleanup();
    root.removeAttribute('style');
    root.removeAttribute('data-scene-tint');

    mockLookId = 'look:signal';
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    // POSITIVE CONTROL: the scene did lend a colour, and this is another.
    expect(bloomFloor).toMatch(/^#/);
    expect(root.style.getPropertyValue('--surface-base')).not.toBe(bloomFloor);
  });
});

describe('the Studio’s project', () => {
  it('wins over the graph while it is on the bench, and waits on the theme until it is measured', () => {
    remember([
      ['premium:bloom', '3@0', sky(300)],
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

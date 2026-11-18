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
import { parseCssColour, rgbToLab } from '../../../renderer/utils/oklab';
import {
  SCENE_SKY_MEASUREMENT,
  type ISceneSky,
} from '../../../renderer/utils/sceneTint';
import { themeShadeTokens } from '../../../renderer/utils/themeShade';

let mockLookId = 'premium:bloom';
// The colours of the scene's picker icon, which every scene the list offers
// carries — none, unless a test gives it some.
let mockSwatch: string[] = [];
// The colours the scene names for the window, when a test gives it some.
let mockWindowColours: Record<string, string> | undefined;
const mockMeasureScene = jest.fn();
const mockMeasureStudio = jest.fn();

jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'bloom',
      lookId: 'premium:bloom',
      version: 3,
      swatch: mockSwatch,
      ...(mockWindowColours ? { windowColours: mockWindowColours } : {}),
    },
  ],
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));
jest.mock('../../../renderer/graph/sceneSky', () => ({
  measureSceneSky: (...args: unknown[]) => mockMeasureScene(...args),
  measureStudioSky: (...args: unknown[]) => mockMeasureStudio(...args),
  // A scene with no choices made is remembered under its own version.
  sceneSkyVersion: (_lookId: string, version: string) => version,
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

/** Two colours a byte apart at most in every channel: one colour, written twice. */
const sameColour = (left: string, right: string) => {
  const a = parseCssColour(left);
  const b = parseCssColour(right);
  return (
    a !== undefined &&
    b !== undefined &&
    a.rgb.every((channel, at) => Math.abs(channel - b.rgb[at]) <= 1 / 255)
  );
};

type TStore = typeof import('../../../renderer/utils/sceneTintStore');
let library: typeof TestingLibrary | undefined;

/** The theme's own values, as a stylesheet on the root would declare them. */
const THEME = `:root { --surface-base: #0d2030; --surface-panel: #1a3a4e; --accent: #00e5cf; --active: #54ff8a; }`;

beforeEach(() => {
  // At Black: a window with no choice stored opens half way
  // (`theme.ts`). The tests that want Ocean store it over this.
  window.localStorage.setItem('fluideq.theme', 'black');
  mockLookId = 'premium:bloom';
  mockSwatch = [];
  mockWindowColours = undefined;
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

// A scene's colour is measured, and remembered, once per version, at the
// time of day its author set it at (`sampleSceneInWorker`): the Brightness
// tones the colour found and never chooses it (Ivan, 2026-10-14: "each scene
// has their colors cant be like that due to day or night just darker or
// lighter").
describe('the graph’s visualizer', () => {
  // A scene that names its window colours (Ivan, 2026-11-14: "we want the
  // agent to give those colours") is shown in them as it is chosen, on every
  // computer the same, and never drawn to second-guess them.
  it('wears the colours a scene names at once, and never draws it to measure', () => {
    mockWindowColours = {
      surface: '#1d2b4f',
      accent: '#5fd4ff',
      glow: '#7dffb0',
    };
    // Even over a remembered measurement of another colour.
    remember([['premium:bloom', '3', sky(30)]]);
    const { store } = mount();
    expect(root).toHaveAttribute('data-scene-tint');
    const shown = store.getShownSceneSky();
    expect(Math.abs((shown?.hue ?? 0) - 266.3)).toBeLessThan(1);
    expect(mockMeasureScene).not.toHaveBeenCalled();
  });

  // The listener's own colours for a scene, from the Window colours menu,
  // over the scene's (Ivan, 2026-11-14: "implement that").
  it('wears the colours the listener chose for the scene over its own', () => {
    mockWindowColours = {
      surface: '#1d2b4f',
      accent: '#5fd4ff',
      glow: '#7dffb0',
    };
    window.localStorage.setItem(
      'fluideq.sceneWindowColours',
      JSON.stringify({
        'premium:bloom': {
          surface: '#3a1d12',
          accent: '#5fd4ff',
          glow: '#7dffb0',
        },
      }),
    );
    const { store } = mount();
    // #3a1d12 is a red-brown, nowhere near the scene's own blue (266).
    const shown = store.getShownSceneSky();
    expect(shown?.hue).toBeLessThan(60);
    expect(mockMeasureScene).not.toHaveBeenCalled();
  });

  it('control: a scene naming none is measured, as before', () => {
    remember([['premium:bloom', '2', sky(30)]]);
    mount();
    expect(mockMeasureScene).toHaveBeenCalledWith(
      'premium:bloom',
      '3',
      undefined,
    );
  });

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
    expect(mockMeasureScene).toHaveBeenCalledWith(
      'premium:bloom',
      '3',
      undefined,
    );
  });

  // The control: with no swatch there is nothing to lend before measuring.
  it('lends nothing before measuring a scene with no swatch', () => {
    mount();
    expect(root).not.toHaveAttribute('data-scene-tint');
    expect(mockMeasureScene).toHaveBeenCalledWith(
      'premium:bloom',
      '3',
      undefined,
    );
  });

  it('measures a version it has not seen, keeping the colour it had meanwhile', () => {
    remember([['premium:bloom', '2', sky(300)]]);
    mount();
    expect(mockMeasureScene).toHaveBeenCalledWith(
      'premium:bloom',
      '3',
      undefined,
    );
  });

  // Brightness tones the colour; it is not a new measurement. Under the old
  // rule each step of the day was measured apart, so Bloom's window turned
  // from green to purple as it was dimmed.
  it('keeps the colour measured for a version at any Brightness', () => {
    window.localStorage.setItem('fluideq.theme', 'ocean');
    remember([['premium:bloom', '3', sky(300)]]);
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(mockMeasureScene).not.toHaveBeenCalled();
  });

  it('forgets every sky measured the way it used to be measured', () => {
    remember([['premium:bloom', '3', sky(300)]], MEASUREMENT - 1);
    const { store } = mount();
    expect(store.recallSceneSky('premium:bloom')).toBeUndefined();
    expect(mockMeasureScene).toHaveBeenCalledWith(
      'premium:bloom',
      '3',
      undefined,
    );
  });

  it('puts the theme back when its mode is the theme', () => {
    remember([['premium:bloom', '3', sky(300)]]);
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
    remember([['premium:bloom', '3', sky(300)]]);
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
  // stays there, darkened (2026-09-25: "is not black is ambient color"). It is
  // still painted there, lending no colour: left off at 0, everything that
  // takes a lent colour while `data-scene-tint` says so - the arrows, the
  // pet, the DSP's curves - jumped to colours of its own between 1 and 0.
  it('lends Lagoon no colour at Black and still paints it, and a visualizer’s colour there', () => {
    mockLookId = 'look:signal';
    const lent = mount();
    expect(root).toHaveAttribute('data-scene-tint');
    // The theme's own Black floor, with nothing of Lagoon in it.
    expect(
      sameColour(
        root.style.getPropertyValue('--surface-base'),
        themeShadeTokens(0)['--surface-base'],
      ),
    ).toBe(true);
    lent.fresh.cleanup();
    root.removeAttribute('style');
    root.removeAttribute('data-scene-tint');

    // POSITIVE CONTROL: a visualizer at the same Black keeps its colour.
    mockLookId = 'premium:bloom';
    remember([['premium:bloom', '3', sky(300)]]);
    mount();
    expect(root).toHaveAttribute('data-scene-tint');
    expect(
      sameColour(
        root.style.getPropertyValue('--surface-base'),
        themeShadeTokens(0)['--surface-base'],
      ),
    ).toBe(false);
  });

  // A Plus visualizer's colours hold in Colours and Ambient however low the
  // Brightness goes (Ivan, 2026-09-28: "on plus viz we keep the viz original
  // color when moving the app brightness"): their walk starts at 30, where
  // the Backdrop's follows the Brightness all the way. Below 50% every
  // surface walks down from its colour at 50% to a dark ceiling at Black,
  // keeping its hue (`sceneTintDark.test`; Ivan, 2026-11-14: "even on 0
  // brightness the green is too light on the panels"): Colours and Ambient
  // paint the same dark, coloured pane at Black, never the Backdrop's 30.
  it('holds a visualizer’s colours at Black in Colours and Ambient', () => {
    remember([['premium:bloom', '3', sky(300)]]);
    const paneIn = (mode: string, shade: string) => {
      window.localStorage.setItem('fluideq.sceneTintMode', mode);
      window.localStorage.setItem('fluideq.theme', shade);
      const shown = mount();
      const pane = root.style.getPropertyValue('--surface-panel');
      shown.fresh.cleanup();
      root.removeAttribute('style');
      root.removeAttribute('data-scene-tint');
      return pane;
    };
    const colours = paneIn('tint', 'black');
    expect(colours).toMatch(/^#/);
    expect(paneIn('pulse', 'black')).toBe(colours);
    const parsed = parseCssColour(colours);
    const lab = parsed ? rgbToLab(parsed.rgb) : { l: 1, a: 0, b: 0 };
    // Dark, and still the scene's colour rather than a grey.
    expect(lab.l).toBeLessThan(0.19);
    expect(Math.hypot(lab.a, lab.b)).toBeGreaterThan(0.02);
    // POSITIVE CONTROL: the Backdrop's 30 is lighter than Colours at Black.
    const backdrop = parseCssColour(paneIn('cover', '30'));
    expect(backdrop ? rgbToLab(backdrop.rgb).l : 0).toBeGreaterThan(lab.l);
  });

  it('gives a look that is not a scene Lagoon, not a remembered scene’s colour', () => {
    remember([['premium:bloom', '3', sky(300)]]);
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

// THE ONE COLOUR MODEL (Ivan, 2026-11-17, option A): the Brightness alone
// says light or dark, and the painter that writes the window's colours is
// the one that writes which way its words run, with them.
describe('light or dark', () => {
  type TTheme = typeof import('../../../renderer/utils/theme');

  const mountWithTheme = () => {
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
    return { theme, fresh: library };
  };

  const lum = (colour: string) => {
    const parsed = parseCssColour(colour);
    if (!parsed) {
      throw new Error(`not a colour: ${colour}`);
    }
    const [red, green, blue] = parsed.rgb.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  // Brightness on the slider's own scale: stored without it, a value is
  // moved onto the dark stretch once (`theme.ts`), and 100 would open dark.
  beforeEach(() => {
    window.localStorage.setItem('fluideq.themeScale', '2');
  });

  afterEach(() => {
    root.removeAttribute('data-window-ink');
  });

  it('follows the Brightness with colours a scene names, white ones included', () => {
    mockWindowColours = {
      surface: '#ffffff',
      accent: '#342942',
      glow: '#342942',
    };
    window.localStorage.setItem('fluideq.theme', '20');
    const { theme, fresh } = mountWithTheme();
    // A white surface on the dark side: a dark window, light words.
    expect(root).not.toHaveAttribute('data-window-ink');
    expect(lum(root.style.getPropertyValue('--surface-panel'))).toBeLessThan(
      0.1,
    );
    // CONTROL: past the line the same colours are the white they name.
    fresh.act(() => theme.setThemeShade(100));
    expect(root).toHaveAttribute('data-window-ink', 'dark');
    expect(root.style.getPropertyValue('--surface-panel')).toBe('#ffffff');
  });

  it('writes the words with the colours, the inks included', () => {
    mockLookId = 'look:signal';
    window.localStorage.setItem('fluideq.theme', '40');
    const { theme, fresh } = mountWithTheme();
    expect(root).not.toHaveAttribute('data-window-ink');
    expect(lum(root.style.getPropertyValue('--text-primary'))).toBeGreaterThan(
      0.7,
    );
    fresh.act(() => theme.setThemeShade(90));
    expect(root).toHaveAttribute('data-window-ink', 'dark');
    expect(lum(root.style.getPropertyValue('--text-primary'))).toBeLessThan(
      0.05,
    );
    // And back: the theme no longer writes it, so the painter must.
    fresh.act(() => theme.setThemeShade(40));
    expect(root).not.toHaveAttribute('data-window-ink');
  });

  it('leans a light window’s words to the scene’s colour, not the theme’s cyan', () => {
    const inkOf = (hue: number) => {
      remember([['premium:bloom', '3', sky(hue)]]);
      window.localStorage.setItem('fluideq.theme', '100');
      const shown = mountWithTheme();
      const ink = parseCssColour(root.style.getPropertyValue('--text-primary'));
      shown.fresh.cleanup();
      root.removeAttribute('style');
      root.removeAttribute('data-scene-tint');
      return ink?.rgb ?? [0, 0, 0];
    };
    const [rosyRed, , rosyBlue] = inkOf(0);
    expect(rosyRed).toBeGreaterThan(rosyBlue);
    // CONTROL: a cyan sky's words lean the other way.
    const [cyanRed, , cyanBlue] = inkOf(220);
    expect(cyanBlue).toBeGreaterThan(cyanRed);
  });

  it('forgets the per-mode Brightness nothing has read since 2026-09-25', () => {
    window.localStorage.setItem(
      'fluideq.sceneTintBrightness',
      '{"tint":0,"pulse":-50,"cover":50}',
    );
    // CONTROL: a key the theme does keep survives the same load.
    window.localStorage.setItem('fluideq.theme', '40');
    mountWithTheme();
    expect(window.localStorage.getItem('fluideq.sceneTintBrightness')).toBe(
      null,
    );
    expect(window.localStorage.getItem('fluideq.theme')).toBe('40');
  });
});

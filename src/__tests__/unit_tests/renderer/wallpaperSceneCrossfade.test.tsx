/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type {
  IWallpaperBootstrap,
  IWallpaperSurfaceBridge,
  IWallpaperSurfaceState,
} from '../../../common/wallpaper';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type { ISceneRunnerOptions } from '../../../renderer/graph/useSceneRunner';

const mockRunnerCalls: ISceneRunnerOptions[] = [];
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: function useMockSceneRunner(options: ISceneRunnerOptions) {
    mockRunnerCalls.push(options);
    return { current: null };
  },
}));

/* eslint-disable import/first -- install the runner mock first */
import WallpaperSurface from '../../../renderer/wallpaper/WallpaperSurface';
/* eslint-enable import/first */

const stateAt = (renderGeneration: number): IWallpaperSurfaceState => ({
  phase: 'running',
  renderGeneration,
  wave: { height: 1, position: 0 },
  motion: 'calm',
  performance: {
    frameRate: 'display',
    resolution: 'auto',
    autoFloor: 0.35,
    upscaler: 'fsr',
    smoothing: 'off',
  },
});

const sceneNamed = (id: string) => ({
  pack: { id, version: 1, names: { en: id } } as never,
  madeBy: 'fluideq' as const,
});

/**
 * A desktop page and main behind it: what main shows now, and each change of
 * visualizer announced the way main announces it — a newer render generation
 * in the surface's state, the scene itself asked for again.
 */
const desktop = () => {
  let current: IWallpaperBootstrap = {
    ...sceneNamed('alpine'),
    state: stateAt(1),
  };
  let push: ((next: IWallpaperSurfaceState) => void) | undefined;
  const bridge: IWallpaperSurfaceBridge = {
    bootstrap: jest.fn(async () => current),
    drawn: jest.fn(),
    failed: jest.fn(),
    requestAudio: jest.fn(async () => undefined),
    onState: (listener) => {
      push = listener;
      return () => undefined;
    },
  };
  const view = render(<WallpaperSurface bridge={bridge} />);
  return {
    bridge,
    /** Main putting another visualizer on the monitor. */
    change: async (id: string) => {
      const state = stateAt(current.state.renderGeneration + 1);
      current = { ...sceneNamed(id), state };
      await act(async () => push?.(state));
    },
    layers: () => [
      ...view.container.querySelectorAll<HTMLElement>('.wallpaper-scene'),
    ],
  };
};

/** The newest run of the scene with this id. */
const runOf = (id: string): ISceneRunnerOptions | undefined =>
  [...mockRunnerCalls].reverse().find((run) => run.source.identity === id);

/** One frame of `id` drawn, at `fade` of its own fade-in. */
const drawFrame = (id: string, fade: number) =>
  act(async () => {
    runOf(id)?.onDrawn?.(
      { fade } as ISceneFrame,
      1,
      0,
      { fade } as ISceneFrame,
      {} as never,
    );
  });

/** The browser saying an opacity transition on `target` ended. */
const fadeEnded = (target: Element) =>
  act(async () => {
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: 'opacity' });
    target.dispatchEvent(event);
  });

const setReducedMotion = (reduced: boolean) =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });

beforeEach(() => {
  mockRunnerCalls.length = 0;
});

afterEach(() => {
  // jsdom has none; a stub left behind changes what other suites see.
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('a desktop background changing visualizer', () => {
  it('keeps the one it shows until the new one has drawn, fades it off, and lets it go at the fade’s end', async () => {
    const page = desktop();
    await act(async () => undefined);
    await drawFrame('alpine', 0.5);
    expect(page.bridge.drawn).toHaveBeenLastCalledWith(1);

    await page.change('ember');
    await act(async () => undefined);
    // Both are built, the old one whole and over the new one.
    const [old, next] = page.layers();
    expect(page.layers()).toHaveLength(2);
    expect(old.className).toBe('wallpaper-scene wallpaper-scene--over');
    expect(next.className).toBe('wallpaper-scene');

    // A frame still black is not a first frame, and a fade that never began
    // cannot end: the old one stays, whole.
    await drawFrame('ember', 0);
    await fadeEnded(old);
    expect(page.layers()).toHaveLength(2);
    expect(old.classList).not.toContain('wallpaper-scene--leaving');
    expect(page.bridge.drawn).not.toHaveBeenCalledWith(2);

    // Its first frame with anything in it starts the fade, and main hears it.
    await drawFrame('ember', 0.3);
    expect(page.bridge.drawn).toHaveBeenLastCalledWith(2);
    expect(page.layers()).toHaveLength(2);
    expect(old.classList).toContain('wallpaper-scene--leaving');

    // The canvas inside has a fade of its own; its end is not this one's.
    const canvas = document.createElement('canvas');
    old.appendChild(canvas);
    await fadeEnded(canvas);
    expect(page.layers()).toHaveLength(2);

    await fadeEnded(old);
    expect(page.layers()).toEqual([next]);
    expect(next.className).toBe('wallpaper-scene');
  });

  it('swaps at once under reduced motion, once the new one has drawn', async () => {
    setReducedMotion(true);
    const page = desktop();
    await act(async () => undefined);
    await drawFrame('alpine', 0.5);
    await page.change('ember');
    await act(async () => undefined);
    const [old, next] = page.layers();
    expect(page.layers()).toHaveLength(2);

    await drawFrame('ember', 0);
    expect(page.layers()).toHaveLength(2);
    await drawFrame('ember', 0.3);
    expect(page.layers()).toEqual([next]);
    expect(old.isConnected).toBe(false);
    expect(next.className).toBe('wallpaper-scene');
  });

  // Two renderers at most: a change arriving while one is still being built
  // replaces that one, and one arriving mid-fade waits for the fade to end.
  it('never runs three at once', async () => {
    const page = desktop();
    await act(async () => undefined);
    await drawFrame('alpine', 0.5);

    await page.change('ember');
    await act(async () => undefined);
    const [, ember] = page.layers();
    await page.change('neon');
    await act(async () => undefined);
    expect(page.layers()).toHaveLength(2);
    expect(ember.isConnected).toBe(false);
    expect(runOf('neon')).toBeDefined();
    const [old] = page.layers();

    await drawFrame('neon', 0.3);
    expect(old.classList).toContain('wallpaper-scene--leaving');
    const asked = (page.bridge.bootstrap as jest.Mock).mock.calls.length;
    await page.change('aurora');
    await act(async () => undefined);
    expect(page.bridge.bootstrap).toHaveBeenCalledTimes(asked);
    expect(page.layers()).toHaveLength(2);

    await fadeEnded(old);
    await act(async () => undefined);
    expect(page.bridge.bootstrap).toHaveBeenCalledTimes(asked + 1);
    expect(page.layers()).toHaveLength(2);
    expect(runOf('aurora')).toBeDefined();
  });

  // Main writes a scene failure down against the look it says the monitor
  // shows; one from the scene on its way out would blame its successor.
  it('reports failures only of the visualizer main says it shows', async () => {
    const page = desktop();
    await act(async () => undefined);
    await drawFrame('alpine', 0.5);
    const alpine = runOf('alpine')?.source;
    await page.change('ember');
    await act(async () => undefined);

    alpine?.reportFailure('gpu-reset');
    alpine?.tooSlow();
    expect(page.bridge.failed).not.toHaveBeenCalled();
    runOf('ember')?.source.reportFailure('compile');
    expect(page.bridge.failed).toHaveBeenCalledWith('compile');
  });

  // Nothing of it was on the desktop yet, so there is nothing to fade from and
  // no reason to keep a second renderer building beside it.
  it('replaces one that has not drawn yet outright', async () => {
    const page = desktop();
    await act(async () => undefined);
    const [alpine] = page.layers();
    await page.change('ember');
    await act(async () => undefined);
    expect(page.layers()).toHaveLength(1);
    expect(alpine.isConnected).toBe(false);
    expect(runOf('ember')).toBeDefined();
  });

  it('draws the first visualizer at once, with nothing to fade from', async () => {
    const page = desktop();
    await act(async () => undefined);
    expect(page.layers()).toHaveLength(1);
    expect(page.layers()[0].className).toBe('wallpaper-scene');
    expect(new Set(mockRunnerCalls.map((run) => run.source.identity))).toEqual(
      new Set(['alpine']),
    );
  });
});

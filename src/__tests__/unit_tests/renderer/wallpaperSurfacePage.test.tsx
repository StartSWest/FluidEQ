/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type {
  IWallpaperAudio,
  IWallpaperBootstrap,
  IWallpaperSurfaceBridge,
  IWallpaperSurfaceState,
} from '../../../common/wallpaper';
import type { ISceneAudio } from '../../../renderer/audio/SceneAudioContext';
import type { ISceneRunnerOptions } from '../../../renderer/graph/useSceneRunner';

const mockRunnerCalls: ISceneRunnerOptions[] = [];
/** The music as the runner reads it, once for every frame it draws. */
let mockAudio: ISceneAudio | undefined;
jest.mock('../../../renderer/graph/useSceneRunner', () => {
  const { useSceneAudio } = jest.requireActual(
    '../../../renderer/audio/SceneAudioContext',
  );
  return {
    __esModule: true,
    // A hook, as the runner is: it reads the page's music the way the real
    // runner does, from the provider around it.
    default: function useMockSceneRunner(options: ISceneRunnerOptions) {
      mockRunnerCalls.push(options);
      mockAudio = useSceneAudio();
      return { current: null };
    },
  };
});

/* eslint-disable import/first -- install the runner mock first */
import WallpaperSurface from '../../../renderer/wallpaper/WallpaperSurface';
/* eslint-enable import/first */

const lastRun = (): ISceneRunnerOptions | undefined =>
  mockRunnerCalls[mockRunnerCalls.length - 1];

/** One frame drawn: the read the runner makes for it. */
const drawFrame = () => mockAudio?.readFrame();

/** An answer from main that arrives only when the test says so. */
const deferred = () => {
  let settle: (frame: IWallpaperAudio) => void = () => undefined;
  const promise = new Promise<IWallpaperAudio>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    answer: (frame: IWallpaperAudio) => act(async () => settle(frame)),
  };
};

const LOUD: IWallpaperAudio = {
  points: [{ x: 100, y: -12 }],
  waveform: [0.5, -0.5],
  stereo: [0.25, 0.8],
};

const pageFor = (
  state: IWallpaperSurfaceState,
  madeBy: IWallpaperBootstrap['madeBy'] = 'fluideq',
) => {
  let push: ((next: IWallpaperSurfaceState) => void) | undefined;
  const bridge: IWallpaperSurfaceBridge = {
    bootstrap: jest.fn(async (): Promise<IWallpaperBootstrap> => ({
      pack: {
        id: 'alpine',
        version: 49,
        names: { en: 'Alpine' },
      } as never,
      madeBy,
      state,
    })),
    drawn: jest.fn(),
    failed: jest.fn(),
    requestAudio: jest.fn(async () => ({ points: [], waveform: [] })),
    onState: (listener) => {
      push = listener;
      return () => undefined;
    },
  };
  return {
    bridge,
    push: (next: IWallpaperSurfaceState) => act(() => push?.(next)),
  };
};

beforeEach(() => {
  mockRunnerCalls.length = 0;
  mockAudio = undefined;
});

const running = (over: Partial<IWallpaperSurfaceState> = {}) => ({
  phase: 'running' as const,
  renderGeneration: 1,
  wave: { height: 1, position: 0 },
  motion: 'music' as const,
  performance: {
    frameRate: 'display' as const,
    resolution: 'auto' as const,
    autoFloor: 0.35 as const,
    upscaler: 'fsr' as const,
    smoothing: 'off' as const,
  },
  ...over,
});

describe('a desktop background’s page', () => {
  // The page has no store of its own: what the listener set for this
  // visualizer in the window arrives with the rest of its state.
  it('draws its scene with the controls and timing its visualizer is set to', async () => {
    const tuning = { params: { glow: 0.4 }, response: { attack: 120 } };
    const { bridge, push } = pageFor(running({ tuning }));
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    expect(lastRun()?.tuning).toEqual(tuning);

    const moved = { params: { glow: 0.9 }, response: { attack: 120 } };
    await push(running({ tuning: moved }));
    expect(lastRun()?.tuning).toEqual(moved);
  });

  it('draws it as its maker built it when nothing is set', async () => {
    const { bridge } = pageFor(running());
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    expect(lastRun()?.tuning).toBeUndefined();
  });

  // It used to read on a clock of its own at thirty a second, so on a display
  // drawing faster everything the music moved stepped at thirty beside a
  // graph that heard it on every frame.
  it('reads the music for each frame it draws, one read on the wire at a time', async () => {
    const { bridge } = pageFor(running());
    const first = deferred();
    const second = deferred();
    (bridge.requestAudio as jest.Mock)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    expect(bridge.requestAudio).not.toHaveBeenCalled();

    // Nothing heard yet: the first frame draws silence and asks.
    expect(drawFrame()).toEqual({ points: [], waveform: [] });
    expect(bridge.requestAudio).toHaveBeenCalledTimes(1);
    // Frames drawn while that answer is on its way ask for nothing more.
    drawFrame();
    drawFrame();
    expect(bridge.requestAudio).toHaveBeenCalledTimes(1);

    await first.answer(LOUD);
    // The next frame draws the newest answer, stereo and all, and asks again.
    expect(drawFrame()).toEqual(LOUD);
    expect(bridge.requestAudio).toHaveBeenCalledTimes(2);
  });

  it('never asks for the music while it is calm, and starts again when set back', async () => {
    const { bridge, push } = pageFor(running({ motion: 'calm' }));
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    for (let frame = 0; frame < 6; frame += 1) {
      expect(drawFrame()).toEqual({ points: [], waveform: [] });
    }
    expect(bridge.requestAudio).not.toHaveBeenCalled();
    expect(lastRun()?.shapeFrame).toBeDefined();

    await push(running({ motion: 'music' }));
    drawFrame();
    expect(bridge.requestAudio).toHaveBeenCalledTimes(1);
  });

  // An answer asked for before a switch to calm belongs to the music that
  // was playing then; drawn after it, the calm background would twitch once.
  it('drops an answer that arrives after it was set calm', async () => {
    const { bridge, push } = pageFor(running());
    const late = deferred();
    (bridge.requestAudio as jest.Mock).mockReturnValueOnce(late.promise);
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    drawFrame();

    await push(running({ motion: 'calm' }));
    await late.answer(LOUD);
    expect(drawFrame()).toEqual({ points: [], waveform: [] });
    expect(bridge.requestAudio).toHaveBeenCalledTimes(1);
  });

  // Told only that a member had made it, the page ran the listener's own
  // scene through the brightness limiter and ghosted it on the desktop while
  // the Studio showed it clean.
  it('runs the scene as main says who made it', async () => {
    const { bridge } = pageFor(running(), 'listener');
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    expect(lastRun()?.source.madeBy).toBe('listener');
  });

  // The band used to be [0, 0, 1, 1]: no width, on the top edge.
  it('hands its scene the band for its wave, and moves it without a new scene', async () => {
    const { bridge, push } = pageFor(running());
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    const whole = lastRun()?.spectrumRect;
    expect(whole).toEqual([0, 1, 0, 1]);
    const source = lastRun()?.source;

    await push(running({ wave: { height: 0.5, position: 0.5 } }));
    const moved = lastRun()?.spectrumRect;
    expect(moved?.[0]).toBe(0);
    expect(moved?.[1]).toBe(1);
    expect(moved?.[3]).toBeLessThan(1);
    expect(moved?.[2]).toBeGreaterThan(0);
    expect(moved?.[3]).toBeGreaterThan(moved?.[2] ?? 1);
    expect(lastRun()?.source).toBe(source);
  });

  // A paused background is never taken off the desktop, so its scene has to
  // stay with it: dropping it left the desktop black where the picture was,
  // and put it back only after a whole build.
  it('keeps its scene and its last picture while it is paused, drawing nothing', async () => {
    const { bridge, push } = pageFor(running());
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    const source = lastRun()?.source;
    expect(lastRun()?.asleep).toBe(false);

    await push(running({ phase: 'paused' }));
    expect(lastRun()?.asleep).toBe(true);
    // The same scene, not a new one, and no music read for it meanwhile.
    expect(lastRun()?.source).toBe(source);
    (bridge.requestAudio as jest.Mock).mockClear();
    drawFrame();
    expect(bridge.requestAudio).not.toHaveBeenCalled();

    await push(running());
    expect(lastRun()?.asleep).toBe(false);
    expect(lastRun()?.source).toBe(source);
  });

  // Main keeps a scene's code from running again only when told it was the
  // scene; a page or a machine that could not draw is tried again later.
  it('tells main why its scene failed, and gives no reason when the machine did', async () => {
    const { bridge } = pageFor(running());
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    const source = lastRun()?.source;

    source?.reportFailure('gpu-reset');
    expect(bridge.failed).toHaveBeenLastCalledWith('gpu-reset');
    source?.block();
    expect(bridge.failed).toHaveBeenLastCalledWith();
    source?.tooSlow();
    expect(bridge.failed).toHaveBeenLastCalledWith();
    expect(bridge.failed).toHaveBeenCalledTimes(3);
  });
});

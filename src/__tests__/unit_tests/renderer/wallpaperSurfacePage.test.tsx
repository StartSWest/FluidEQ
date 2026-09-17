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
import type { ISceneRunnerOptions } from '../../../renderer/graph/useSceneRunner';

const mockRunnerCalls: ISceneRunnerOptions[] = [];
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: (options: ISceneRunnerOptions) => {
    mockRunnerCalls.push(options);
    return { current: null };
  },
}));

/* eslint-disable import/first -- install the runner mock first */
import WallpaperSurface from '../../../renderer/wallpaper/WallpaperSurface';
/* eslint-enable import/first */

const lastRun = (): ISceneRunnerOptions | undefined =>
  mockRunnerCalls[mockRunnerCalls.length - 1];

const frames: FrameRequestCallback[] = [];
const runFrames = async (count: number) => {
  for (let index = 0; index < count; index += 1) {
    const due = frames.splice(0);
    // eslint-disable-next-line no-await-in-loop -- each frame's read settles before the next frame
    await act(async () => {
      due.forEach((callback) => callback(performance.now() + index * 50));
    });
  }
};

const pageFor = (state: IWallpaperSurfaceState) => {
  let push: ((next: IWallpaperSurfaceState) => void) | undefined;
  const bridge: IWallpaperSurfaceBridge = {
    bootstrap: jest.fn(async (): Promise<IWallpaperBootstrap> => ({
      pack: {
        id: 'alpine',
        version: 49,
        names: { en: 'Alpine' },
      } as never,
      member: false,
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
  frames.length = 0;
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

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
  it('asks for the music on its animation frames while it follows the music', async () => {
    const { bridge } = pageFor(running());
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    await runFrames(4);
    expect(bridge.requestAudio).toHaveBeenCalled();
  });

  it('never asks for the music while it is calm, and starts again when set back', async () => {
    const { bridge, push } = pageFor(running({ motion: 'calm' }));
    render(<WallpaperSurface bridge={bridge} />);
    await act(async () => undefined);
    await runFrames(6);
    expect(bridge.requestAudio).not.toHaveBeenCalled();
    expect(lastRun()?.shapeFrame).toBeDefined();

    await push(running({ motion: 'music' }));
    await runFrames(4);
    expect(bridge.requestAudio).toHaveBeenCalled();
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

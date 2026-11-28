/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene worker puts frames on the canvas on its own animation frames,
 * at the pace the page hands it, and that is the rate the Studio's stage
 * reads out. Held to sixty on a 100 Hz display it drew fifty: counted from
 * the last frame drawn, sixty is every second refresh. On the schedule the
 * page keeps too (`createPaceSchedule`), it is sixty.
 */

import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type { TSceneWorkerRequest } from '../../../renderer/graph/sceneWorkerMessages';

const mockProgramDraw = jest.fn();
let mockBehind = 0;
jest.mock('../../../renderer/graph/sceneGl', () => ({
  compileScene: () =>
    Promise.resolve({
      ok: true,
      program: {
        dispose: jest.fn(),
        draw: (...args: unknown[]) => mockProgramDraw(...args),
        musicAccent: () => 0,
      },
    }),
  createSceneContext: () => ({
    isContextLost: () => false,
    enable: jest.fn(),
    scissor: jest.fn(),
    bindFramebuffer: jest.fn(),
  }),
}));
jest.mock('../../../renderer/graph/sceneArtwork', () => ({
  decodeSceneArtwork: () => Promise.resolve(undefined),
}));
jest.mock('../../../renderer/graph/sceneGpuClock', () => ({
  SCENE_FRAMES_IN_FLIGHT: 2,
  createSceneGpuClock: () => ({
    // A cheap scene, a millisecond a frame; or, where a test says so, a GPU
    // still holding frames with no reading yet of how long they take.
    poll: () =>
      mockBehind > 0 ? { behind: mockBehind } : { behind: 0, costMs: 1 },
    begin: jest.fn(),
    mark: jest.fn(),
    end: jest.fn(),
    oldestInFlightMs: () => 0,
  }),
}));
jest.mock('../../../renderer/graph/sceneProbe', () => ({
  createSceneProbing: () => ({
    ask: jest.fn(),
    drew: jest.fn(),
    lost: jest.fn(),
  }),
}));

type TScope = {
  onmessage: (event: { data: unknown }) => void;
  postMessage: jest.Mock;
  requestAnimationFrame: (callback: (now: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
};

/** The worker's own animation frames, run by the test at a display's beat. */
let ticks: ((now: number) => void)[] = [];

const settle = async () => {
  for (let step = 0; step < 20; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step is the point
    await Promise.resolve();
  }
};

const startWorker = async (): Promise<TScope> => {
  const scope = globalThis as unknown as TScope;
  scope.postMessage = jest.fn();
  scope.requestAnimationFrame = (callback) => {
    ticks.push(callback);
    return ticks.length;
  };
  scope.cancelAnimationFrame = () => undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- the worker installs itself on load
    require('../../../renderer/graph/sceneRenderer.worker');
  });
  scope.onmessage({
    data: {
      kind: 'attach',
      canvas: { addEventListener: jest.fn(), width: 0, height: 0 },
    },
  });
  scope.onmessage({
    data: {
      kind: 'load',
      id: 1,
      pack: { id: 'scene', source: 'a', params: [] },
      unwatched: false,
    },
  });
  await settle();
  return scope;
};

/** The page's frame, held to `paceMs`. */
const pageFrame = (
  paceMs: number,
): Extract<TSceneWorkerRequest, { kind: 'draw' }> => ({
  kind: 'draw',
  turn: 1,
  // The program is a stand-in that reads nothing of the frame but its
  // clock, which the worker fills in.
  frame: { deltaMs: 16 } as unknown as ISceneFrame,
  width: 64,
  height: 36,
  output: { width: 64, height: 36 },
  finish: { fsr: false, fxaa: false },
  clip: [0, 0, 1, 1],
  paceMs,
});

/** Frames put on the canvas over `seconds` of a `hz` display. */
const drawnOver = async (hz: number, paceMs: number, seconds: number) => {
  const scope = await startWorker();
  // The page's first frame is drawn at once; the rest are the worker's.
  scope.onmessage({ data: pageFrame(paceMs) });
  mockProgramDraw.mockClear();
  const start = performance.now();
  for (let tick = 1; tick <= hz * seconds; tick += 1) {
    const due = ticks;
    ticks = [];
    due.forEach((run) => run(start + (tick * 1000) / hz));
  }
  return mockProgramDraw.mock.calls.length;
};

beforeEach(() => {
  ticks = [];
  mockBehind = 0;
  mockProgramDraw.mockReset();
});

describe('the scene worker', () => {
  it('draws sixty frames a second on a 100 Hz display, held to sixty', async () => {
    const drawn = await drawnOver(100, 1000 / 60, 5);
    expect(drawn / 5).toBeCloseTo(60, 0);
  });

  it('draws sixty frames a second on a 144 Hz display, held to sixty', async () => {
    const drawn = await drawnOver(144, 1000 / 60, 5);
    expect(drawn / 5).toBeCloseTo(60, 0);
  });

  // The control: held to nothing, every refresh of the display.
  it('draws every frame of a 100 Hz display held to nothing', async () => {
    expect(await drawnOver(100, 0, 5)).toBe(500);
  });

  // A frame the GPU made wait takes no slot: the next refresh tries again,
  // so a GPU behind for a moment costs the rate a refresh, not a pace.
  it('tries a frame the GPU made wait on the next refresh', async () => {
    const scope = await startWorker();
    const pace = 1000 / 60;
    scope.onmessage({ data: pageFrame(pace) });
    mockProgramDraw.mockClear();
    const start = performance.now();
    const at = (tick: number) => {
      const due = ticks;
      ticks = [];
      due.forEach((run) => run(start + tick * 10));
    };
    // Its slot comes at the second refresh, with the GPU holding two frames
    // and slower than the display (no clock reading under a refresh).
    mockBehind = 2;
    at(1);
    at(2);
    expect(mockProgramDraw).not.toHaveBeenCalled();
    mockBehind = 0;
    at(3);
    expect(mockProgramDraw).toHaveBeenCalledTimes(1);
  });
});

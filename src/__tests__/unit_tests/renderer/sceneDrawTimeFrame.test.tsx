/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render, waitFor } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type { ISceneDrawn } from '../../../renderer/graph/sceneWorkerClient';
import type { TSceneBuildResult } from '../../../renderer/graph/sceneWorkerMessages';
import type {
  ISceneDrawReport,
  ISceneRunnerOptions,
} from '../../../renderer/graph/sceneRunnerTypes';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';

/** A spectrum at one level everywhere, on the analyser's axis. */
const flat = (y: number) =>
  Array.from({ length: 320 }, (_, i) => ({
    x: 16 * (25_000 / 16) ** (i / 319),
    y,
  }));

let mockReactPoints = flat(-20);
let mockFresh:
  { points: { x: number; y: number }[]; waveform: number[] } | undefined;
const mockDraw = jest.fn();
/** What the worker answers a load with: ready, or a scene it could not build. */
let mockLoadResult: TSceneBuildResult = { kind: 'ready', rebuilt: true };
/** What the size ladder was asked to judge: the reading and the interval. */
const mockLadderFrame = jest.fn(
  (_reading: unknown, _intervalMs: number, _hidden: boolean) => 'ok' as const,
);
let mockFrameCallback: ((elapsedMs: number) => boolean) | undefined;

// The runner hears the music through the scene audio context, which the
// graph fills from the capture and a desktop background from its own relay.
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: mockReactPoints,
    waveform: [],
    isPaused: false,
    readFrame: () => mockFresh,
  }),
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: (onFrame: (elapsedMs: number) => boolean) => {
    mockFrameCallback = onFrame;
    return jest.fn();
  },
}));
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => ({
    load: () => Promise.resolve(mockLoadResult),
    canDraw: () => true,
    draw: mockDraw,
    idle: jest.fn(),
    dispose: jest.fn(),
  }),
}));
// The size ladder comes from the rules for who made the scene; this one only
// records what it was asked to judge.
jest.mock('../../../renderer/graph/sceneRules', () => ({
  sceneRulesFor: () => ({
    limited: false,
    warmWhenUnseen: false,
    createLadder: () => ({
      frame: mockLadderFrame,
      scale: () => 1,
      slowed: () => false,
      refloor: () => undefined,
      resume: () => undefined,
      reset: () => undefined,
      cheapFinish: () => false,
    }),
  }),
}));

const pack: IScenePack = {
  schema: 1,
  id: 'test-scene',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Test' },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.); }',
  params: [],
};
const source: ISceneSource = {
  identity: 'project',
  version: '1',
  name: 'Test',
  load: () => Promise.resolve(pack),
  block: jest.fn(),
  reportFailure: jest.fn(),
  tooSlow: jest.fn(),
  madeBy: 'fluideq' as const,
};

/**
 * Renders the stage and settles once its scene is the one being drawn —
 * the runner's own report, not a poll against a deadline, which failed under
 * the whole suite's load while passing alone.
 */
const renderLoaded = async (onDrawn?: ISceneRunnerOptions['onDrawn']) => {
  let loaded: () => void = () => undefined;
  const settled = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  function Stage() {
    const ref = useSceneRunner({
      source,
      width: 480,
      height: 270,
      spectrumRect: [0, 1, 0, 1],
      onLoaded: () => loaded(),
      ...(onDrawn ? { onDrawn } : {}),
    });
    return <div ref={ref} />;
  }
  // Rendered first, so its effects have run and started the load; rendering
  // inside the awaited act left them queued behind the very promise waiting
  // on them.
  render(<Stage />);
  await act(() => settled);
};

/** The stage, rendered without waiting to be told a scene is ready. */
const renderStage = () => {
  function Stage() {
    const ref = useSceneRunner({
      source,
      width: 480,
      height: 270,
      spectrumRect: [0, 1, 0, 1],
    });
    return <div ref={ref} />;
  }
  render(<Stage />);
};

/** One frame of the loop, and the bass the scene was handed in it. */
const drawBass = () => {
  mockDraw.mockClear();
  mockFrameCallback?.(16);
  const frame = mockDraw.mock.calls[0]?.[0] as ISceneFrame | undefined;
  return frame?.bands[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReactPoints = flat(-20);
  mockLoadResult = { kind: 'ready', rebuilt: true };
  mockFresh = undefined;
  // jsdom lays nothing out, and a scene with no box on screen draws nothing.
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 480,
    bottom: 270,
    width: 480,
    height: 270,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('a scene frame', () => {
  it('is drawn from the music as it is when the frame is drawn', async () => {
    await renderLoaded();
    expect(drawBass()).toBe(0);
    // The React frame still says silence; the draw-time read says full scale.
    mockFresh = { points: flat(20), waveform: [] };
    expect(drawBass()).toBe(1);
  });

  it('falls back to the published frame when there is no live read', async () => {
    // Positive control for the test above: with nothing read at draw time the
    // same loop draws the React frame, loud as it is.
    mockReactPoints = flat(20);
    await renderLoaded();
    expect(drawBass()).toBe(1);
  });
});

/**
 * A scene this build cannot compile is handed back to the listener as the
 * scene's own fallback style, and nothing else.
 *
 * This is now the ONLY way a scene too new for the app degrades: the loader
 * stopped refusing a pack by the contract number it was written against
 * (15a4257f8), because the number said what a scene was written for and not
 * what it needs, and Crystal would not open on a build one version behind. So
 * a scene that really does use a uniform this build has never heard of now
 * reaches the compiler and fails there, which must be an ordinary failure —
 * reported, the last working version kept, the fallback shown — and never
 * mistaken for the scene having taken the graphics card down, which is
 * remembered against its source and would follow it to every other machine.
 */
describe('a scene this build cannot compile', () => {
  it('is reported as a compile failure, with what the driver said', async () => {
    mockLoadResult = {
      kind: 'compile',
      log: "ERROR: 0:42: 'uMusicRun' : undeclared identifier",
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderStage();
    await waitFor(() => expect(source.reportFailure).toHaveBeenCalled());
    expect(source.reportFailure).toHaveBeenCalledWith(
      'compile',
      expect.stringContaining('undeclared identifier'),
    );
    // Not blocked as a machine that cannot run it, which is the other verdict
    // and the one that stops the scene for the session.
    expect(source.block).not.toHaveBeenCalled();
  });

  it('draws nothing rather than a broken frame', async () => {
    mockLoadResult = { kind: 'compile', log: 'no' };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderStage();
    await waitFor(() => expect(source.reportFailure).toHaveBeenCalled());
    mockDraw.mockClear();
    mockFrameCallback?.(16);
    expect(mockDraw).not.toHaveBeenCalled();
  });
});

/**
 * Frames are drawn on the worker's own animation frames, from the page's
 * latest, so how often they reach the screen is the worker's to report and
 * not the page's to guess. The page's loop shares a thread with the whole
 * interface: measured in the running window it was handing over 72 frames a
 * second while the display ran at 100, and a cost judged against 14 ms
 * instead of 10 is a scene held at a smaller size than it needed to be — and
 * a readout that said 72 fps while the screen was getting 100.
 */
describe('how often frames are reaching the screen', () => {
  /** One frame of the loop, answered by the worker with `reply`. */
  const answer = (reply: { intervalMs?: number }) => {
    mockDraw.mockClear();
    mockLadderFrame.mockClear();
    mockFrameCallback?.(16);
    const shown = mockDraw.mock.calls[0]?.[6] as
      ((drawn: ISceneDrawn) => void) | undefined;
    shown?.({ accent: 0, cost: { behind: 0 }, skipped: false, ...reply });
  };

  it('is what the worker says, not how often the page handed a frame over', async () => {
    const reports: ISceneDrawReport[] = [];
    await renderLoaded((_frame, _scale, _accent, _heard, report) => {
      reports.push(report);
    });
    answer({ intervalMs: 10 });
    expect(mockLadderFrame.mock.calls[0]?.[1]).toBe(10);
    expect(reports[reports.length - 1]?.intervalMs).toBe(10);
  });

  it('falls back to the page’s own cadence when the worker has not said', async () => {
    // Its first frame: the worker has drawn one picture and has no interval
    // to report yet, and the loop's own gap stands in.
    const reports: ISceneDrawReport[] = [];
    await renderLoaded((_frame, _scale, _accent, _heard, report) => {
      reports.push(report);
    });
    answer({});
    expect(mockLadderFrame.mock.calls[0]?.[1]).not.toBe(10);
    expect(reports[reports.length - 1]?.intervalMs).toBeGreaterThan(0);
  });
});

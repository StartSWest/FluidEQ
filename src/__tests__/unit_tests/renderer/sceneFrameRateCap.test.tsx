/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frame rate the listener chose holds on every surface of the main
 * window (Ivan, 2026-11-28: "make sure the frametate limit works on studio
 * asw well"). His Studio stage at "60 a second" read 100 fps: the window's
 * root carries `is-euphoric` for good since colourful mode is always on
 * (`EuphoriaGlow`), and the runner read euphoria as "every frame".
 *
 * Measured where the pace leaves the runner: the page's own loop
 * (`useSmoothFrames`' `minFrameMs`) and every frame handed to the worker,
 * which keeps that pace on its own animation frames.
 */

import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import { THIRTY_A_SECOND_MS } from '../../../common/smoothing';
import type { TSceneFrameRate } from '../../../common/scenePerformance';
import type { ISceneDrawn } from '../../../renderer/graph/sceneWorkerClient';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';
import {
  resetScenePerformanceForTesting,
  setScenePerformance,
} from '../../../renderer/utils/scenePerformanceStore';

const mockDraw = jest.fn();
// One kick for the life of the loop, as the real hook's is: a new one on
// every render would tear the scene's worker down whenever the rate changed.
const mockKick = jest.fn();
let mockFrameCallback: ((elapsedMs: number) => boolean) | undefined;
let mockLoopPace: (() => number) | undefined;

jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: (
    onFrame: (elapsedMs: number) => boolean,
    options: { minFrameMs?: () => number },
  ) => {
    mockFrameCallback = onFrame;
    mockLoopPace = options.minFrameMs;
    return mockKick;
  },
}));
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => ({
    load: () => Promise.resolve({ kind: 'ready', rebuilt: true }),
    canDraw: () => true,
    draw: mockDraw,
    idle: jest.fn(),
    holdPicture: jest.fn(),
    probe: jest.fn(),
    dispose: jest.fn(),
  }),
}));
/** The interval each frame's cost was judged against by the size ladder. */
const mockLadderFrame = jest.fn(
  (_reading: unknown, _intervalMs: number, _seen: unknown) => 'ok' as const,
);
jest.mock('../../../renderer/graph/sceneRules', () => ({
  sceneRulesFor: () => ({
    unwatched: false,
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

/** A scene on `surface`, as the Studio's stage and the graph build theirs. */
const sourceOn = (surface: ISceneSource['surface']): ISceneSource => ({
  identity: `project-${surface}`,
  surface,
  version: '1',
  name: 'Test',
  load: () => Promise.resolve(pack),
  block: jest.fn(),
  reportFailure: jest.fn(),
  tooSlow: jest.fn(),
  madeBy: surface === 'studio' ? 'listener' : 'fluideq',
});

/** Renders a scene on `surface` and settles once it is the one drawn. */
const renderLoaded = async (surface: ISceneSource['surface']) => {
  let loaded: () => void = () => undefined;
  const settled = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  const source = sourceOn(surface);
  function Stage() {
    const ref = useSceneRunner({
      source,
      width: 480,
      height: 270,
      spectrumRect: [0, 1, 0, 1],
      onLoaded: () => loaded(),
    });
    return <div ref={ref} />;
  }
  render(<Stage />);
  await act(() => settled);
};

/** The pace the page's loop keeps, and the one the worker was handed. */
const pacesKept = () => {
  mockDraw.mockClear();
  mockFrameCallback?.(16);
  return {
    page: mockLoopPace?.(),
    worker: mockDraw.mock.calls[0]?.[5] as number | undefined,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.removeItem('fluideq.scenePerformance');
  resetScenePerformanceForTesting();
  // The main window, as `EuphoriaGlow` leaves it for good.
  document.documentElement.classList.add('is-euphoric');
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
  document.documentElement.classList.remove('is-euphoric');
  window.localStorage.removeItem('fluideq.scenePerformance');
  resetScenePerformanceForTesting();
  jest.restoreAllMocks();
});

const RATES: [TSceneFrameRate, number][] = [
  ['sixty', 1000 / 60],
  ['thirty', THIRTY_A_SECOND_MS],
  // The control: the display's own rate is no cap at all, so a probe that
  // read nothing, or always one number, would fail one of the three.
  ['display', 0],
];

describe.each(['studio', 'graph', 'player'] as const)(
  'a scene on the %s',
  (surface) => {
    it.each(RATES)(
      'keeps the "%s" rate in the main window',
      async (frameRate, paceMs) => {
        setScenePerformance({ frameRate });
        await renderLoaded(surface);
        const kept = pacesKept();
        expect(kept.page).toBeCloseTo(paceMs, 6);
        expect(kept.worker).toBeCloseTo(paceMs, 6);
      },
    );

    // Held to sixty on a 100 Hz display, the worker draws one refresh and two
    // refreshes apart; its newest gap can be the one refresh. Judged against
    // that, Auto would hold the picture to the panel's size for a rate it was
    // never asked to draw.
    it.each([
      ['sixty', 1000 / 60],
      // The control: held to nothing, the display's own beat is the budget.
      ['display', 10],
    ] as [TSceneFrameRate, number][])(
      'judges its picture’s size at "%s" against %d ms',
      async (frameRate, judgedMs) => {
        setScenePerformance({ frameRate });
        await renderLoaded(surface);
        mockDraw.mockClear();
        mockLadderFrame.mockClear();
        mockFrameCallback?.(16);
        const shown = mockDraw.mock.calls[0]?.[6] as
          ((drawn: ISceneDrawn) => void) | undefined;
        shown?.({
          accent: 0,
          cost: { behind: 0, costMs: 2.3 },
          skipped: false,
          intervalMs: 10,
        });
        expect(mockLadderFrame.mock.calls[0]?.[1]).toBeCloseTo(judgedMs, 6);
      },
    );

    it('takes a rate changed while it plays on its next frame', async () => {
      await renderLoaded(surface);
      expect(pacesKept().worker).toBe(0);
      act(() => setScenePerformance({ frameRate: 'sixty' }));
      expect(pacesKept()).toEqual({ page: 1000 / 60, worker: 1000 / 60 });
    });
  },
);

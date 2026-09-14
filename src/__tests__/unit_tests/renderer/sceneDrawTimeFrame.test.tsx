/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
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
    load: () => Promise.resolve({ kind: 'ready', rebuilt: true }),
    canDraw: () => true,
    draw: mockDraw,
    dispose: jest.fn(),
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
  createLadder: () => ({ frame: () => 'ok', scale: () => 1, reset: jest.fn() }),
};

/**
 * Renders the stage and settles once its scene is the one being drawn —
 * the runner's own report, not a poll against a deadline, which failed under
 * the whole suite's load while passing alone.
 */
const renderLoaded = async () => {
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
    });
    return <div ref={ref} />;
  }
  // Rendered first, so its effects have run and started the load; rendering
  // inside the awaited act left them queued behind the very promise waiting
  // on them.
  render(<Stage />);
  await act(() => settled);
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

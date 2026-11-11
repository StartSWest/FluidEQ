/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Only the part of a scene inside the window is drawn, and a host that moves
 * without resizing says so (`moved`; Ivan, 2026-11-08: "when zooming and
 * panning not redrawing the new discovered zone"): the Studio's zoomed stage,
 * panned, draws the part the pan brought in — beside the same move unsaid,
 * which keeps drawing the part that was there before.
 */

import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';

const mockDraw = jest.fn();
let mockFrameCallback: ((elapsedMs: number) => boolean) | undefined;
/** One kick for the runner's life, as the real frame loop gives: a new one per render rebuilt the renderer. */
const mockKick = jest.fn();

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
  default: (onFrame: (elapsedMs: number) => boolean) => {
    mockFrameCallback = onFrame;
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
    dispose: jest.fn(),
  }),
}));
jest.mock('../../../renderer/graph/sceneRules', () => ({
  sceneRulesFor: () => ({
    unwatched: false,
    warmWhenUnseen: false,
    createLadder: () => ({
      frame: () => 'ok' as const,
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
  surface: 'graph' as const,
  version: '1',
  name: 'Test',
  load: () => Promise.resolve(pack),
  block: jest.fn(),
  reportFailure: jest.fn(),
  tooSlow: jest.fn(),
  madeBy: 'fluideq' as const,
};

/** Where the host stands: a 2048-wide zoomed picture, `left` from the window's edge. */
let left = -1024;
const box = () => ({
  left,
  top: 0,
  right: left + 2048,
  bottom: 768,
  width: 2048,
  height: 768,
  x: left,
  y: 0,
  toJSON: () => ({}),
});

function Stage({ moved }: { moved?: string }) {
  const ref = useSceneRunner({
    source,
    width: 2048,
    height: 768,
    spectrumRect: [0, 1, 0, 1],
    ...(moved !== undefined ? { moved } : {}),
  });
  return <div ref={ref} />;
}

/** The part of the host one frame is drawn in: left, top, right, bottom. */
const drawnPart = () => {
  mockDraw.mockClear();
  mockFrameCallback?.(16);
  return mockDraw.mock.calls[0]?.[4] as readonly number[] | undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  left = -1024;
  // jsdom's window is 1024 wide: the picture's right half is on screen.
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(box);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const settled = async (moved?: string) => {
  const view = render(<Stage moved={moved} />);
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
};

it('draws the part a pan brought on screen, once told the host moved', async () => {
  const view = await settled('-1024,0');
  expect(drawnPart()).toEqual([0.5, 0, 1, 1]);
  // Panned right by 512: the picture's left quarter comes on screen.
  left = -512;
  view.rerender(<Stage moved="-512,0" />);
  expect(drawnPart()).toEqual([0.25, 0, 0.75, 1]);
});

it('keeps drawing the part that was there when a move goes unsaid', async () => {
  // The control: the same pan, nothing said, the old part drawn on.
  const view = await settled('-1024,0');
  left = -512;
  view.rerender(<Stage moved="-1024,0" />);
  expect(drawnPart()).toEqual([0.5, 0, 1, 1]);
});

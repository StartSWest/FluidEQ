/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Plus scene's own pieces outside its picture come with that picture,
 * never ahead of it (Ivan, 2026-11-27: "after 10 sec is loading next one and
 * showing the sparkles of the nextone right there on current alpine").
 *
 * Auto puts the next scene on, and the graph keeps the last one's picture up
 * until the next one's first frame is drawn; the elements the window's
 * Ambient flies (`SceneAmbient`) and the pieces thrown from the hand
 * (`ScenePointerLayer`) used to change to the next scene's at the choice, or
 * as soon as it was built, and flew over the picture still on screen. Here
 * the real host, canvas and runner draw two scenes with a worker that draws
 * when it is asked, the window's own layer paints what it is given, and each
 * case looks at the wait between the choice and the first frame - beside the
 * frame after it, where the new scene's pieces must be there.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import SceneAmbient from '../../../renderer/ambient/SceneAmbient';
import GraphScene from '../../../renderer/graph/GraphScene';
import {
  publishScenePlot,
  type IScenePlot,
} from '../../../renderer/graph/graphScenePlace';
import type { IPreparedScene } from '../../../renderer/graph/sceneRunnerTypes';
import type { ISceneDrawn } from '../../../renderer/graph/sceneWorkerClient';
import type { IUsableScene } from '../../../renderer/utils/scenePacks';
import { publishSceneColumnHost } from '../../../renderer/utils/sceneCover';
import { setSceneTintMode } from '../../../renderer/utils/sceneTintStore';

/** The graph's choice, as the store hands it out: one scene, or a standard look. */
const mockChoice: {
  scene: IUsableScene | null;
  listeners: Set<() => void>;
} = { scene: null, listeners: new Set() };

/** The worker clients started, in order, and what each was asked to do. */
interface IFakeClient {
  client: Record<string, unknown>;
  draw: jest.Mock;
  idle: jest.Mock;
  dispose: jest.Mock;
}
const mockClients: IFakeClient[] = [];
/** A first picture that never finishes fading in. */
const mockNeverShown = new Promise<void>(() => {
  // Never settled: nothing in these cases waits past the first frame.
});

/** A worker that builds at once and draws every frame it is asked for. */
const mockFakeClient = (): IFakeClient => {
  const draw = jest.fn(
    (
      _frame: unknown,
      _drawn: unknown,
      _output: unknown,
      _finish: unknown,
      _clip: unknown,
      _pace: number,
      notify: (drawn: ISceneDrawn) => void,
    ) => notify({ accent: 0, cost: { behind: 0 }, skipped: false }),
  );
  const idle = jest.fn();
  const dispose = jest.fn();
  return {
    draw,
    idle,
    dispose,
    client: {
      load: jest.fn(() => Promise.resolve({ kind: 'ready', rebuilt: true })),
      canDraw: () => true,
      draw,
      idle,
      holdPicture: jest.fn(),
      probe: jest.fn(),
      rehost: jest.fn(),
      // The picture it replaces stays up through the whole case.
      whenShown: () => mockNeverShown,
      dispose,
    },
  };
};

/** What Auto built ahead (`scenePreload.ts`), by scene. */
const mockTake = jest.fn<IPreparedScene | undefined, [string, string]>();
/** The runner's frame loop, run by hand. */
let mockFrame: ((elapsedMs: number) => boolean) | undefined;
const mockKick = jest.fn();
/** What the window's Ambient layer painted, each frame: its elements' ids. */
const mockPainted: string[][] = [];
const mockPacks: Record<string, IScenePack> = {};

jest.mock('../../../renderer/utils/graphStyle', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    ...jest.requireActual('../../../renderer/utils/graphStyle'),
    useSceneLook: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockChoice.listeners.add(listener);
          return () => mockChoice.listeners.delete(listener);
        },
        () => mockChoice.scene,
      ),
  };
});
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => {
    const started = mockFakeClient();
    mockClients.push(started);
    return started.client;
  },
  warmSceneProgram: () => Promise.resolve(),
}));
jest.mock('../../../renderer/graph/scenePreload', () => ({
  useScenePreload: () => undefined,
  takePreparedScene: (identity: string, version: string) =>
    mockTake(identity, version),
  settlePreparedScene: () => undefined,
  usePreparedSceneIdentity: () => undefined,
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: (onFrame: (elapsedMs: number) => boolean) => {
    mockFrame = onFrame;
    return mockKick;
  },
}));
jest.mock('../../../renderer/ambient/ambientPaint', () => ({
  paintAmbient: ({ elements }: { elements: { id: string }[] }) => {
    mockPainted.push(elements.map((element) => element.id));
  },
}));
// What the hand throws, as the canvas hands it over.
jest.mock('../../../renderer/graph/ScenePointerLayer', () => ({
  __esModule: true,
  default: ({ pointer }: { pointer: { emitters: { element?: string }[] } }) =>
    jest
      .requireActual('react')
      .createElement(
        'div',
        { 'data-testid': 'thrown' },
        pointer.emitters.map((emitter) => emitter.element).join(' '),
      ),
}));
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({ readFrame: () => undefined, isPaused: true }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('../../../renderer/utils/FluidEqContext'),
  useFluidEqShell: () => ({ isEngineUsable: true }),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  ...jest.requireActual('../../../renderer/utils/scenePacks'),
  loadScenePack: (id: string) => Promise.resolve(mockPacks[id]),
  blockScene: jest.fn(),
  reportSceneFailure: () => Promise.resolve(),
}));
jest.mock('../../../renderer/graph/sceneUpdateStore', () => ({
  reportScenePlayed: () => Promise.resolve(),
}));

const sceneOf = (id: string): IUsableScene => ({
  id,
  version: 1,
  lookId: `premium:${id}`,
  names: { en: id },
  swatch: ['#102030', '#a0b0c0'],
});

const element = (id: string, shape: 'star' | 'snow') => ({
  id,
  shape,
  colours: ['#ffffff'],
  count: 6,
  size: [3, 6] as const,
  opacity: 0.7,
  motion: 'drift' as const,
  speed: 0.3,
  area: 'all' as const,
  flap: 0.5,
  turn: 0.3,
  music: 'none' as const,
  react: 0,
});

const emitter = (id: string) => ({
  on: 'move' as const,
  element: id,
  colours: [],
  amount: 4,
  size: [3, 6] as const,
  life: 1,
  speed: 0.5,
  spread: 0.5,
  gravity: 0,
  spin: 0.3,
});

/** A scene with elements of its own in the window, thrown from the hand too. */
const packOf = (id: string, elements: [string, 'star' | 'snow'][]) =>
  ({
    schema: 1,
    id,
    version: 1,
    contract: SCENE_CONTRACT_VERSION,
    names: { en: id },
    fallbackStyle: 'skyline',
    swatch: ['#102030', '#a0b0c0'],
    source: `vec4 sceneColour(vec2 uv) { return vec4(uv, ${id.length}., 1.); }`,
    params: [],
    ambient: {
      elements: elements.map(([elementId, shape]) => element(elementId, shape)),
      params: [],
    },
    pointer: { emitters: elements.map(([elementId]) => emitter(elementId)) },
  }) as unknown as IScenePack;

const ALPINE = sceneOf('alpine');
const AURORA = sceneOf('aurora');
mockPacks.alpine = packOf('alpine', [['glints', 'star']]);
mockPacks.aurora = packOf('aurora', [
  ['snow', 'snow'],
  ['stars', 'star'],
]);

const choose = (scene: IUsableScene | null) =>
  act(() => {
    mockChoice.scene = scene;
    mockChoice.listeners.forEach((listener) => listener());
  });

/** Every promise the change set going, one turn at a time. */
const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 8; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- one turn at a time
      await Promise.resolve();
    }
  });

/** One frame of the graph's scene. */
const drawSceneFrame = () =>
  act(() => {
    mockFrame?.(16);
  });

let windowFrames: FrameRequestCallback[] = [];
let windowClock = 0;

/** The window's Ambient layer as its next frames paint it. */
const windowShows = () => {
  act(() => {
    for (let frame = 0; frame < 3; frame += 1) {
      const due = windowFrames;
      windowFrames = [];
      windowClock += 50;
      const now = windowClock;
      due.forEach((callback) => callback(now));
    }
  });
  return mockPainted[mockPainted.length - 1]?.join(' ');
};

/** What the hand throws over the graph's scene right now. */
const thrown = () => screen.queryByTestId('thrown')?.textContent;

const AMBIENT_CONTEXT = {
  setTransform: jest.fn(),
  clearRect: jest.fn(),
} as unknown as CanvasRenderingContext2D;

let column: HTMLElement;
let slot: HTMLElement;
let panel: HTMLElement;

const plot = (): IScenePlot => ({
  slot,
  panel,
  width: 640,
  height: 320,
  spectrumRect: [0, 1, 0, 1],
  isPartOfWindow: true,
});

/** The graph on an EQ page with its scene on the column, and the window's Ambient. */
const mount = () => {
  act(() => publishScenePlot(plot()));
  return render(
    <>
      <GraphScene />
      <SceneAmbient />
    </>,
  );
};

/** Alpine on screen: chosen, built, and its first frame drawn. */
const playAlpine = async () => {
  choose(ALPINE);
  mount();
  await settle();
  drawSceneFrame();
  await settle();
};

beforeEach(() => {
  mockClients.length = 0;
  mockPainted.length = 0;
  mockTake.mockReset();
  mockFrame = undefined;
  windowFrames = [];
  setSceneTintMode('pulse');
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    windowFrames.push(callback);
    return windowFrames.length;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    windowFrames = [];
  });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function ambientOnly(this: HTMLCanvasElement) {
      return this.classList.contains('scene-ambient') ? AMBIENT_CONTEXT : null;
    } as unknown as HTMLCanvasElement['getContext']);
  // jsdom lays nothing out, and a scene with no box on screen draws nothing.
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 640,
    bottom: 320,
    width: 640,
    height: 320,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  });
  column = document.createElement('div');
  column.dataset.sceneLayer = 'column';
  document.body.appendChild(column);
  const plotBox = document.createElement('div');
  plotBox.className = 'graph-plot';
  slot = document.createElement('div');
  panel = document.createElement('div');
  plotBox.append(panel, slot);
  document.body.appendChild(plotBox);
  act(() => publishSceneColumnHost(column));
});

afterEach(() => {
  act(() => {
    publishScenePlot(undefined);
    publishSceneColumnHost(null);
  });
  mockChoice.scene = null;
  delete (HTMLElement.prototype as Partial<HTMLElement>).checkVisibility;
  document.documentElement.classList.remove('is-amp');
  document.body.innerHTML = '';
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('the next scene’s pieces wait for its first frame', () => {
  it.each([
    ['built ahead by Auto', true],
    ['built as it is chosen', false],
  ])(
    'when it is %s: the last scene’s until then, its own from then on',
    async (_how, isAhead) => {
      await playAlpine();
      expect(windowShows()).toBe('glints');
      expect(thrown()).toBe('glints');

      if (isAhead) {
        const prepared = mockFakeClient();
        mockTake.mockImplementation((identity) =>
          identity === 'aurora'
            ? {
                client: prepared.client as unknown as IPreparedScene['client'],
                pack: mockPacks.aurora,
                result: { kind: 'ready', rebuilt: true },
                bind: jest.fn(),
              }
            : undefined,
        );
      }
      const alpineDrawn = mockClients[0];
      choose(AURORA);
      await settle();
      // The wait: Aurora built and not drawn yet. Ahead, Alpine's picture is
      // still the one on screen, idle under the canvas that takes over;
      // built as chosen, the loading ring stands where it was.
      expect(alpineDrawn.idle).toHaveBeenCalled();
      expect(alpineDrawn.dispose).toHaveBeenCalledTimes(isAhead ? 0 : 1);
      expect(windowShows()).toBe('glints');
      expect(thrown()).toBe('glints');

      // CONTROL: Aurora's first frame, and everything of Aurora's with it.
      drawSceneFrame();
      await settle();
      expect(windowShows()).toBe('snow stars');
      expect(thrown()).toBe('snow stars');
    },
  );

  it('waits after a standard look too, with nothing of a scene meanwhile', async () => {
    choose(null);
    mount();
    await settle();
    expect(windowShows()).toBeUndefined();

    choose(AURORA);
    await settle();
    // The canvas mounted, Aurora built, no frame of it yet.
    expect(mockClients).toHaveLength(1);
    expect(windowShows()).toBeUndefined();
    expect(thrown()).toBeUndefined();

    // CONTROL: its first frame brings its elements.
    drawSceneFrame();
    await settle();
    expect(windowShows()).toBe('snow stars');
    expect(thrown()).toBe('snow stars');
  });
});

describe('with no picture of the graph’s to keep', () => {
  // A launch: nothing was on screen before the scene the window opens with.
  it('shows the chosen scene’s elements at launch, before its first frame', async () => {
    choose(ALPINE);
    mount();
    await settle();
    expect(mockClients[0]?.draw).not.toHaveBeenCalled();
    expect(windowShows()).toBe('glints');
  });

  // The amp, or a page over the graph: its canvas is out of sight and draws
  // nothing, so there is no first frame to wait for.
  it('follows the choice at once while the graph’s canvas is out of sight', async () => {
    await playAlpine();
    expect(windowShows()).toBe('glints');
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value: () => false,
    });
    // Looked at again: the window's mode changing is a class on the root,
    // which every watcher of the canvas hears.
    await act(async () => {
      document.documentElement.classList.add('is-amp');
      await Promise.resolve();
    });

    choose(AURORA);
    await settle();
    expect(windowShows()).toBe('snow stars');
  });
});

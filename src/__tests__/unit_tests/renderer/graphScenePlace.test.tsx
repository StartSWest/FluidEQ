/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One renderer for the graph's Plus visualizer, moved and never made again.
 *
 * The graph used to key its scene on the layer it stood in, so going into
 * full screen or from an EQ page to another page with the graph each built it
 * from nothing — a worker, a context, a compile. Pinned by counting what a
 * reload costs: workers started, programs built, workers let go, and by the
 * canvas's element staying the same node. Two places since the Backdrop went
 * (2026-11-16): the EQ column's layer, or the plot.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import GraphScene from '../../../renderer/graph/GraphScene';
import ScenePlot from '../../../renderer/graph/ScenePlot';
import {
  graphScenePlace,
  isGraphWaveDrawn,
  publishScenePlot,
  type IScenePlot,
} from '../../../renderer/graph/graphScenePlace';
import type { IUsableScene } from '../../../renderer/utils/scenePacks';
import { publishSceneColumnHost } from '../../../renderer/utils/sceneCover';
import {
  setSceneTintMode,
  type TSceneTintChoice,
} from '../../../renderer/utils/sceneTintStore';

const mockCreate = jest.fn();
const mockBuild = jest.fn();
const mockDispose = jest.fn();
const mockPlayed = jest.fn();
// One function, as the real hook's is: a new one every render would restart
// the renderer by itself, and the counts below would be counting the mock.
const mockKick = jest.fn();

const mockScene: IUsableScene = {
  id: 'aurora',
  version: 1,
  lookId: 'scene:aurora',
  names: { en: 'Aurora' },
  swatch: ['#102030', '#a0b0c0'],
};

const mockPack: IScenePack = {
  schema: 1,
  id: 'aurora',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Aurora' },
  fallbackStyle: 'skyline',
  swatch: ['#102030', '#a0b0c0'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.); }',
  params: [],
};

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  // The real one puts a canvas of its own in the host and hands it to a
  // worker; a second call is a second worker and a second GPU context.
  createSceneWorkerClient: (host: HTMLElement) => {
    mockCreate(host);
    host.appendChild(document.createElement('canvas'));
    return {
      load: (...args: unknown[]) => mockBuild(...args),
      canDraw: () => false,
      draw: jest.fn(),
      idle: jest.fn(),
      holdPicture: jest.fn(),
      probe: jest.fn(),
      dispose: mockDispose,
    };
  },
  warmSceneProgram: () => Promise.resolve(),
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
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: () => mockKick,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  ...jest.requireActual('../../../renderer/utils/graphStyle'),
  useSceneLook: () => mockScene,
}));
jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('../../../renderer/utils/FluidEqContext'),
  useFluidEqShell: () => ({ isEngineUsable: true }),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  ...jest.requireActual('../../../renderer/utils/scenePacks'),
  loadScenePack: () => Promise.resolve(mockPack),
  blockScene: jest.fn(),
  reportSceneFailure: () => Promise.resolve(),
}));
jest.mock('../../../renderer/graph/sceneUpdateStore', () => ({
  reportScenePlayed: (...args: unknown[]) => mockPlayed(...args),
}));

/**
 * Settles once the scene's program has been built and drawn from, `times`
 * times over: a renderer built again draws again, and a case that ended
 * before it had let that land outside act.
 */
const built = (times = 1) =>
  act(
    () =>
      new Promise<void>((resolve) => {
        if (mockPlayed.mock.calls.length >= times) {
          resolve();
          return;
        }
        mockPlayed.mockImplementation(() => {
          if (mockPlayed.mock.calls.length >= times) {
            resolve();
          }
          return Promise.resolve();
        });
      }),
  );

const layer = (name: string) => {
  const element = document.createElement('div');
  element.dataset.sceneLayer = name;
  document.body.appendChild(element);
  return element;
};

let column: HTMLElement;
let slot: HTMLElement;
let panel: HTMLElement;

const plotOf = (isPartOfWindow: boolean): IScenePlot => ({
  slot,
  panel,
  width: 640,
  height: 320,
  spectrumRect: [0, 1, 0, 1],
  isPartOfWindow,
});

const canvasHost = () => document.querySelector('.chart-scene-canvas');

const SPECTRUM = [0, 1, 0, 1] as const;

beforeEach(() => {
  mockCreate.mockClear();
  mockBuild.mockReset();
  mockBuild.mockResolvedValue({ kind: 'ready', rebuilt: true });
  mockDispose.mockClear();
  mockPlayed.mockReset();
  mockPlayed.mockResolvedValue(undefined);
  column = layer('column');
  const plotBox = document.createElement('div');
  plotBox.className = 'graph-plot';
  slot = document.createElement('div');
  panel = document.createElement('div');
  plotBox.append(panel, slot);
  document.body.appendChild(plotBox);
  act(() => {
    publishSceneColumnHost(column);
  });
});

afterEach(() => {
  act(() => {
    publishScenePlot(undefined);
    publishSceneColumnHost(null);
  });
  document.body.innerHTML = '';
  window.localStorage.clear();
});

describe('where the graph’s scene is drawn', () => {
  const base = {
    drawsScene: true,
    column: document.createElement('div'),
  };
  const plot = (isPartOfWindow: boolean) => ({
    slot: document.createElement('div'),
    panel: document.createElement('div'),
    width: 1,
    height: 1,
    spectrumRect: [0, 1, 0, 1] as const,
    isPartOfWindow,
  });

  it('puts it on the EQ column’s layer while the plot is one part of the window', () => {
    const onPlot = plot(true);
    expect(graphScenePlace({ ...base, plot: onPlot })).toBe(base.column);
    // A page with no EQ column: the plot itself.
    expect(graphScenePlace({ ...base, column: null, plot: onPlot })).toBe(
      onPlot.slot,
    );
  });

  it('keeps it on the plot while the graph is the window', () => {
    const full = plot(false);
    expect(graphScenePlace({ ...base, plot: full })).toBe(full.slot);
  });

  it('puts it nowhere with no graph on the page', () => {
    expect(graphScenePlace({ ...base, plot: undefined })).toBe(undefined);
  });

  it('draws nothing the graph itself would not draw', () => {
    expect(
      graphScenePlace({ ...base, drawsScene: false, plot: plot(true) }),
    ).toBe(undefined);
    expect(
      isGraphWaveDrawn({
        isClean: false,
        isEngineUsable: true,
        isWaveHidden: false,
      }),
    ).toBe(true);
    expect(
      isGraphWaveDrawn({
        isClean: true,
        isEngineUsable: true,
        isWaveHidden: false,
      }),
    ).toBe(false);
    expect(
      isGraphWaveDrawn({
        isClean: false,
        isEngineUsable: true,
        isWaveHidden: true,
      }),
    ).toBe(false);
    // With nothing to hear, the wave is the graph whatever its switch says.
    expect(
      isGraphWaveDrawn({
        isClean: false,
        isEngineUsable: false,
        isWaveHidden: true,
      }),
    ).toBe(true);
  });
});

describe('the one renderer', () => {
  it('moves between the column, full screen and the window’s colours without being made again', async () => {
    setSceneTintMode('tint');
    act(() => publishScenePlot(plotOf(true)));
    render(<GraphScene />);
    await built();
    const host = canvasHost();
    const canvas = host?.querySelector('canvas');
    expect(host).not.toBeNull();
    expect(column).toContainElement(canvas ?? null);
    // The worker here never draws, and the page takes its over-the-picture
    // faces only from the scene's first drawn frame (2026-11-17).
    expect(document.documentElement).not.toHaveClass('is-scene-column');

    act(() => setSceneTintMode('pulse'));
    expect(column).toContainElement(canvas ?? null);
    // Full screen: the graph is the window, and the scene is on its plot.
    act(() => publishScenePlot(plotOf(false)));
    expect(slot).toContainElement(canvas ?? null);
    act(() => setSceneTintMode('off'));
    expect(slot).toContainElement(canvas ?? null);
    // And back.
    act(() => publishScenePlot(plotOf(true)));
    expect(column).toContainElement(canvas ?? null);

    expect(canvasHost()).toBe(host);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockDispose).not.toHaveBeenCalled();
  });

  // Nothing keeps it behind the other pages since the Backdrop went
  // (2026-11-16): off the graph it is let go in every mode, and its memory.
  it.each<TSceneTintChoice>(['off', 'tint', 'pulse'])(
    'lets it go off the graph in %s, and builds it again on return',
    async (mode) => {
      setSceneTintMode(mode);
      act(() => publishScenePlot(plotOf(true)));
      render(<GraphScene />);
      await built();

      act(() => publishScenePlot(undefined));
      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(canvasHost()).toBeNull();
      // The count moves when a renderer really is made again.
      act(() => publishScenePlot(plotOf(true)));
      expect(mockCreate).toHaveBeenCalledTimes(2);
      // And it draws: the rebuilt scene's program loads and is drawn from.
      await built(2);
    },
  );

  it('makes none on a page without the graph', async () => {
    setSceneTintMode('pulse');
    render(<GraphScene />);
    await act(async () => Promise.resolve());
    expect(canvasHost()).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('the plot', () => {
  it('says where it is, and the scene follows it to full screen and off the page', async () => {
    setSceneTintMode('pulse');
    // The chart's plot, at normal size or full screen.
    const Plot = ({ isPartOfWindow }: { isPartOfWindow: boolean }) => (
      <div className="graph-plot">
        <ScenePlot
          scene={mockScene}
          width={640}
          height={320}
          spectrumRect={SPECTRUM}
          inset={{ right: 0, bottom: 0 }}
          isPartOfWindow={isPartOfWindow}
        />
      </div>
    );
    const graph = render(<Plot isPartOfWindow />);
    const page = render(<GraphScene />);
    await built();
    const canvas = canvasHost()?.querySelector('canvas');
    expect(column).toContainElement(canvas ?? null);

    graph.rerender(<Plot isPartOfWindow={false} />);
    const plotSlot = graph.container.querySelector('.chart-scene-slot');
    expect(plotSlot).toContainElement(canvas ?? null);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // The plot gone, nothing shows the scene, and it is let go.
    graph.unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(canvasHost()).toBeNull();
    page.unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });
});

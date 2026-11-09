import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import type { ISceneDrawn } from '../../../renderer/graph/sceneWorkerClient';
import type { TSceneBuildResult } from '../../../renderer/graph/sceneWorkerMessages';
import StudioStage from '../../../renderer/studio/StudioStage';
import useSceneRunner from '../../../renderer/graph/useSceneRunner';

/**
 * The Studio stage through the real scene runner, with the worker, the frame
 * loop and "can anybody see this" played by the test.
 *
 * The stage once sat black for minutes after a save, with no canvas and no
 * loading: Windows reports FluidEQ hidden whenever the member's AI window
 * covers it, the runner let its worker go as it does for anything unseen, and
 * the stage — which only ever waited for its very first frame — went on saying
 * it was drawing. Nothing was on it until the member came back to the window,
 * and then nothing again for a whole compile.
 */

interface IMockClient {
  loads: {
    pack: IScenePack;
    answer: (result: TSceneBuildResult) => void;
    answered: boolean;
  }[];
  frames: ((drawn: ISceneDrawn) => void)[];
  disposed: boolean;
}

const mockClients: IMockClient[] = [];
const mockKick = jest.fn();
const mockClips: unknown[] = [];
const mockAudio = {
  points: [],
  waveform: [],
  isPaused: false,
  readFrame: () => undefined,
};
let mockVisible = true;
let mockShown: ((shown: boolean) => void) | undefined;
let mockFrame: ((elapsedMs: number) => boolean) | undefined;

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
}));
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => mockAudio,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: (onFrame: (elapsedMs: number) => boolean) => {
    mockFrame = onFrame;
    return mockKick;
  },
}));
// Answers as the real one does: at once when watching starts, then on change.
jest.mock('../../../renderer/utils/observeShown', () => ({
  __esModule: true,
  default: (_element: Element, onChange: (shown: boolean) => void) => {
    mockShown = onChange;
    onChange(mockVisible);
    return () => undefined;
  },
}));
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  warmSceneProgram: jest.fn(),
  createSceneWorkerClient: () => {
    const client: IMockClient = { loads: [], frames: [], disposed: false };
    mockClients.push(client);
    return {
      load: (pack: IScenePack) =>
        new Promise<TSceneBuildResult>((resolve) => {
          client.loads.push({ pack, answer: resolve, answered: false });
        }),
      canDraw: () =>
        !client.disposed &&
        client.frames.length === 0 &&
        client.loads.every((load) => load.answered),
      draw: (
        _frame: unknown,
        _drawn: unknown,
        _output: unknown,
        _finish: unknown,
        clip: unknown,
        _paceMs: number,
        shown: (drawn: ISceneDrawn) => void,
      ) => {
        client.frames.push(shown);
        mockClips.push(clip);
      },
      idle: () => undefined,
      holdPicture: () => undefined,
      // As the real client: a load still running is answered as given up.
      dispose: () => {
        client.disposed = true;
        client.loads
          .filter((load) => !load.answered)
          .forEach((load) => {
            load.answered = true;
            load.answer({ kind: 'cancelled' });
          });
      },
    };
  },
}));

const packOf = (source: string): IScenePack => ({
  schema: 1,
  id: 'chrome',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Chrome' },
  fallbackStyle: 'area',
  swatch: ['#000000', '#ffffff'],
  source,
  params: [],
});
const first = packOf('vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.); }');
const saved = packOf(
  'vec4 sceneColour(vec2 uv) { return vec4(uv.yx, 0., 1.); }',
);

const onTrouble = jest.fn();
const onDrawn = jest.fn();
const stage = (pack: IScenePack, serial: number) => (
  <StudioStage
    identity="chrome"
    pack={pack}
    serial={serial}
    signal="live"
    demo={false}
    size="graph"
    isPlayer={false}
    wave={{ height: 1, position: 0 }}
    isGridShown={false}
    readingRef={{ current: null }}
    onTrouble={onTrouble}
    onDrawn={onDrawn}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={jest.fn()}
  />
);

const busy = () => screen.getByTestId('studio-stage').getAttribute('aria-busy');
const newest = () => mockClients[mockClients.length - 1];

/** Lets the pack's load and the build it starts reach the worker. */
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
const answerLoad = (
  client: IMockClient,
  index: number,
  result: TSceneBuildResult,
) =>
  act(async () => {
    const load = client.loads[index];
    load.answered = true;
    load.answer(result);
    await Promise.resolve();
  });
/** One turn of the frame loop: a frame sent to the newest worker. */
const sendFrame = (elapsedMs = 16) =>
  act(() => {
    mockFrame?.(elapsedMs);
  });
/** The oldest frame `client` has in flight, on the canvas. */
const answerFrame = (client: IMockClient, costMs = 1) =>
  act(() => {
    client.frames.shift()?.({
      accent: 0,
      cost: { costMs, behind: 0 },
      skipped: false,
    });
  });
const drawFrame = (costMs = 1) => {
  sendFrame();
  answerFrame(newest(), costMs);
};
const setVisible = (visible: boolean) =>
  act(() => {
    mockVisible = visible;
    mockShown?.(visible);
  });
const lastScale = () => onDrawn.mock.calls[onDrawn.mock.calls.length - 1][1];

/** Mounted, its first version built and on the canvas. */
const running = async () => {
  const view = render(stage(first, 1));
  await settle();
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  drawFrame();
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClients.length = 0;
  mockClips.length = 0;
  mockVisible = true;
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

it('loads until the first frame with anything in it, then shows the scene', async () => {
  render(stage(first, 1));
  await settle();
  expect(busy()).toBe('true');
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  expect(busy()).toBe('true');
  // A frame drawn with no time gone is drawn at a fade of nothing: black.
  sendFrame(0);
  answerFrame(newest());
  expect(busy()).toBe('true');
  drawFrame();
  expect(busy()).toBe('false');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('records full frames while scrolled away, then retires its worker when recording finishes', async () => {
  mockVisible = false;
  jest.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
    left: 0,
    top: -400,
    right: 480,
    bottom: -130,
    width: 480,
    height: 270,
    x: 0,
    y: -400,
    toJSON: () => ({}),
  });
  const source = {
    identity: 'capture',
    version: '1',
    name: 'Recording fixture',
    load: async () => first,
    block: jest.fn(),
    reportFailure: jest.fn(),
    tooSlow: jest.fn(),
    madeBy: 'listener' as const,
  };
  function Capture({ active }: { active: boolean }) {
    const ref = useSceneRunner({
      source,
      width: 480,
      height: 270,
      spectrumRect: [0, 0, 1, 1],
      captureFrames: active,
    });
    return <div ref={ref} />;
  }
  const { rerender } = render(<Capture active />);
  await settle();
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  drawFrame();
  expect(mockClips[mockClips.length - 1]).toEqual([0, 0, 1, 1]);
  expect(newest().disposed).toBe(false);
  setVisible(false);
  drawFrame();
  expect(mockClips[mockClips.length - 1]).toEqual([0, 0, 1, 1]);
  const worker = newest();
  rerender(<Capture active={false} />);
  expect(worker.disposed).toBe(true);
});

it('still stops a recording renderer when the document itself hides', async () => {
  const source = {
    identity: 'capture-hidden',
    version: '1',
    name: 'Recording fixture',
    load: async () => first,
    block: jest.fn(),
    reportFailure: jest.fn(),
    tooSlow: jest.fn(),
    madeBy: 'listener' as const,
  };
  function Capture() {
    const ref = useSceneRunner({
      source,
      width: 480,
      height: 270,
      spectrumRect: [0, 0, 1, 1],
      captureFrames: true,
    });
    return <div ref={ref} />;
  }
  render(<Capture />);
  await settle();
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  drawFrame();
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  sendFrame();
  expect(newest().frames).toHaveLength(0);
  setVisible(false);
  expect(newest().disposed).toBe(true);
  hidden.mockRestore();
});

it('loads again when the covered window lets its worker go, through the save made meanwhile', async () => {
  const { rerender } = await running();
  expect(busy()).toBe('false');

  // Another window covers FluidEQ: the page is hidden and the worker goes.
  setVisible(false);
  expect(mockClients[0].disposed).toBe(true);
  expect(busy()).toBe('true');
  expect(screen.getByRole('status')).toHaveTextContent('studio.stage.loading');

  // The member's AI saves while FluidEQ is still covered: nothing is built
  // for nobody, and the stage still says it is on its way.
  rerender(stage(saved, 2));
  await settle();
  expect(mockClients).toHaveLength(1);
  expect(busy()).toBe('true');

  // Back to FluidEQ: the save is what gets built, loading until it is drawn.
  setVisible(true);
  await settle();
  expect(mockClients).toHaveLength(2);
  expect(newest().loads.map((load) => load.pack)).toEqual([saved]);
  expect(busy()).toBe('true');
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  expect(busy()).toBe('true');
  drawFrame();
  expect(busy()).toBe('false');
});

/** The plate's word for a save building beside the picture. */
const updating = () => screen.queryByText('studio.stage.updating');

// A save of the scene on the stage builds beside it while it plays on (Ivan,
// 2026-11-07: "can be reload on hot so we see them more smolty"): the stage
// is never covered with the loading card for it, only told on its plate.
it('keeps the picture playing while a save builds beside it, then swaps it in', async () => {
  const { rerender } = await running();
  const worker = mockClients[0];
  sendFrame();

  rerender(stage(saved, 2));
  await settle();
  expect(worker.loads.map((load) => load.pack)).toEqual([first, saved]);
  expect(busy()).toBe('false');
  expect(screen.queryByText('studio.stage.loading')).not.toBeInTheDocument();
  expect(updating()).toBeInTheDocument();

  // The picture being replaced goes on drawing meanwhile.
  answerFrame(worker);
  drawFrame();
  expect(busy()).toBe('false');

  await answerLoad(worker, 1, { kind: 'ready', rebuilt: true });
  expect(updating()).not.toBeInTheDocument();
  drawFrame();
  expect(busy()).toBe('false');
  expect(mockClients).toHaveLength(1);
});

it('keeps the picture for a save that does not compile, and builds the version that did when seen again', async () => {
  // The driver's message goes to the console as well; expected here.
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = await running();
  rerender(stage(saved, 2));
  await settle();
  expect(busy()).toBe('false');
  expect(updating()).toBeInTheDocument();

  await answerLoad(mockClients[0], 1, { kind: 'compile', log: 'ERROR: 0:1' });
  expect(busy()).toBe('false');
  expect(updating()).not.toBeInTheDocument();
  expect(onTrouble).toHaveBeenCalledWith({
    kind: 'compile',
    log: 'ERROR: 0:1',
  });
  expect(logged).toHaveBeenCalled();

  setVisible(false);
  setVisible(true);
  await settle();
  expect(newest().loads.map((load) => load.pack)).toEqual([first]);
});

it('comes back at the size it had climbed to, and a new save starts small again', async () => {
  const { rerender } = await running();
  // A run of smooth frames climbs one rung of the warm-up (`sceneWarmup.ts`).
  for (let frame = 0; frame < 12; frame += 1) {
    drawFrame();
  }
  drawFrame();
  const climbed = lastScale();
  expect(climbed).toBeGreaterThan(onDrawn.mock.calls[0][1]);

  setVisible(false);
  setVisible(true);
  await settle();
  await answerLoad(newest(), 0, { kind: 'ready', rebuilt: true });
  drawFrame();
  expect(lastScale()).toBe(climbed);

  // Positive control: new code is watched from the bottom again.
  rerender(stage(saved, 2));
  await settle();
  await answerLoad(newest(), 1, { kind: 'ready', rebuilt: true });
  drawFrame();
  expect(lastScale()).toBe(onDrawn.mock.calls[0][1]);
});

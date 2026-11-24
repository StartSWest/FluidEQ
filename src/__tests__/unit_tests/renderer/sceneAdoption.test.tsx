/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Plus scene Auto built ahead goes on without the loading screen (Ivan,
 * 2026-11-24: "So the transition is smooth and the user doesn't have to wait
 * on the loading screen between them"). The graph's runner takes the worker
 * as it stands — no second worker, no load, no compile — draws its first
 * frame at once, and keeps the picture it replaces on screen until the new
 * one has faded in over it; the plot shows no loading ring meanwhile. Each
 * held beside the same switch made the ordinary way.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import ScenePlot from '../../../renderer/graph/ScenePlot';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type { IPreparedScene } from '../../../renderer/graph/sceneRunnerTypes';
import type { ISceneDrawn } from '../../../renderer/graph/sceneWorkerClient';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';
import type { IUsableScene } from '../../../renderer/utils/scenePacks';

let mockFrame: ((elapsedMs: number) => boolean) | undefined;
let mockPrepared: string | undefined;

interface IFakeClient {
  load: jest.Mock;
  draw: jest.Mock;
  idle: jest.Mock;
  dispose: jest.Mock;
  rehost: jest.Mock;
  shown: () => void;
}

/** A worker client whose frames are answered at once, as drawn. */
const fakeClient = (): IFakeClient & { client: unknown } => {
  let shown: () => void = () => undefined;
  const whenShown = new Promise<void>((resolve) => {
    shown = resolve;
  });
  const fake = {
    load: jest.fn(() => Promise.resolve({ kind: 'ready', rebuilt: true })),
    draw: jest.fn(
      (
        _frame: ISceneFrame,
        _drawn: unknown,
        _output: unknown,
        _finish: unknown,
        _clip: unknown,
        _pace: number,
        notify: (drawn: ISceneDrawn) => void,
      ) => notify({ accent: 0, cost: { behind: 0 }, skipped: false }),
    ),
    idle: jest.fn(),
    dispose: jest.fn(),
    rehost: jest.fn(),
    shown,
  };
  return {
    ...fake,
    client: {
      load: fake.load,
      canDraw: () => true,
      draw: fake.draw,
      idle: fake.idle,
      holdPicture: jest.fn(),
      probe: jest.fn(),
      rehost: fake.rehost,
      whenShown: () => whenShown,
      dispose: fake.dispose,
    },
  };
};

const mockStarted: ReturnType<typeof fakeClient>[] = [];

jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => {
    const started = fakeClient();
    mockStarted.push(started);
    return started.client;
  },
  warmSceneProgram: () => Promise.resolve(),
}));
jest.mock('../../../renderer/utils/useSmoothFrames', () => ({
  __esModule: true,
  default: (onFrame: (elapsedMs: number) => boolean) => {
    mockFrame = onFrame;
    return jest.fn();
  },
}));
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/graph/scenePreload', () => ({
  usePreparedSceneIdentity: () => mockPrepared,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const packOf = (id: string): IScenePack => ({
  schema: 1,
  id,
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: id },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source: `vec4 sceneColour(vec2 uv) { return vec4(uv, ${id.length}., 1.); }`,
  params: [],
});

const sourceOf = (id: string) => {
  const pack = packOf(id);
  return {
    identity: id,
    surface: 'graph' as const,
    version: '1',
    name: id,
    load: jest.fn(() => Promise.resolve(pack)),
    block: jest.fn(),
    reportFailure: jest.fn(),
    built: jest.fn(),
    tooSlow: jest.fn(),
    madeBy: 'fluideq' as const,
    pack,
  };
};

function Stage({
  source,
  adopt,
}: {
  source: ISceneSource;
  adopt: (identity: string, version: string) => IPreparedScene | undefined;
}) {
  const ref = useSceneRunner({
    source,
    width: 480,
    height: 270,
    spectrumRect: [0, 1, 0, 1],
    adopt,
  });
  return <div ref={ref} />;
}

const flush = () =>
  act(async () => {
    for (let turn = 0; turn < 6; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- one turn at a time
      await Promise.resolve();
    }
  });

/** One frame of the loop, and the frame the scene was drawn with. */
const drawFrame = (client: IFakeClient) => {
  client.draw.mockClear();
  act(() => {
    mockFrame?.(16);
  });
  return client.draw.mock.calls[0]?.[0] as ISceneFrame | undefined;
};

const preparedFor = (id: string) => {
  const fake = fakeClient();
  const source = sourceOf(id);
  const prepared: IPreparedScene = {
    client: fake.client as IPreparedScene['client'],
    pack: source.pack,
    result: { kind: 'ready', rebuilt: true },
    bind: jest.fn(),
  };
  return { fake, source, prepared };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStarted.length = 0;
  mockPrepared = undefined;
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

/** A first scene built the ordinary way and drawing. */
const renderDrawing = async () => {
  const first = sourceOf('aurora');
  const none = () => undefined;
  const view = render(<Stage source={first} adopt={none} />);
  await flush();
  expect(first.built).toHaveBeenCalledTimes(1);
  const [firstClient] = mockStarted;
  expect(drawFrame(firstClient)).toBeDefined();
  return { view, firstClient };
};

describe('a scene taken ready-built', () => {
  it('is drawn at once, without a worker, a load or a compile of its own', async () => {
    const { view, firstClient } = await renderDrawing();
    firstClient.draw.mockClear();
    const next = preparedFor('borealis');
    const adopt = jest.fn(() => next.prepared);
    view.rerender(<Stage source={next.source} adopt={adopt} />);
    await flush();

    expect(adopt).toHaveBeenCalledWith('borealis', '1');
    expect(mockStarted).toHaveLength(1);
    expect(next.fake.load).not.toHaveBeenCalled();
    expect(next.source.load).not.toHaveBeenCalled();
    expect(next.fake.rehost).toHaveBeenCalledTimes(1);
    expect(next.source.built).toHaveBeenCalledTimes(1);
    // Its first frame at full strength: the canvas's own fade is the
    // crossfade, so the picture does not also climb out of black.
    expect(drawFrame(next.fake)?.fade).toBe(1);
    expect(firstClient.draw).not.toHaveBeenCalled();
  });

  it('keeps the picture it replaces up until its own has faded in', async () => {
    const { view, firstClient } = await renderDrawing();
    const next = preparedFor('borealis');
    view.rerender(<Stage source={next.source} adopt={() => next.prepared} />);
    await flush();
    // Idle on screen, never disposed while the new one fades in over it.
    expect(firstClient.idle).toHaveBeenCalled();
    expect(firstClient.dispose).not.toHaveBeenCalled();

    next.fake.shown();
    await flush();
    expect(firstClient.dispose).toHaveBeenCalledTimes(1);
  });

  it('lets the kept picture go when the canvas goes mid-crossfade', async () => {
    const { view, firstClient } = await renderDrawing();
    const next = preparedFor('borealis');
    view.rerender(<Stage source={next.source} adopt={() => next.prepared} />);
    await flush();
    view.unmount();
    expect(firstClient.dispose).toHaveBeenCalledTimes(1);
    expect(next.fake.dispose).toHaveBeenCalledTimes(1);
  });

  it('the control: a scene not built ahead loads and compiles, and the old picture goes at once', async () => {
    const { view, firstClient } = await renderDrawing();
    const next = sourceOf('borealis');
    view.rerender(<Stage source={next} adopt={() => undefined} />);
    expect(firstClient.dispose).toHaveBeenCalledTimes(1);
    await flush();
    expect(mockStarted).toHaveLength(2);
    expect(next.load).toHaveBeenCalledTimes(1);
    expect(mockStarted[1].load).toHaveBeenCalledTimes(1);
    // Faded up from black on its first frame, as every new scene is.
    expect(drawFrame(mockStarted[1])?.fade).toBeLessThan(1);
  });
});

describe('the plot under a scene taken ready-built', () => {
  const scene: IUsableScene = {
    id: 'borealis',
    version: 1,
    lookId: 'premium:borealis',
    names: { en: 'Borealis' },
    swatch: ['#102030', '#a0b0c0'],
  };
  const plot = () => (
    <ScenePlot
      scene={scene}
      width={640}
      height={320}
      spectrumRect={[0, 1, 0, 1]}
      inset={{ right: 0, bottom: 0 }}
      isPartOfWindow={false}
    />
  );

  it('shows no loading ring', () => {
    mockPrepared = 'borealis';
    render(plot());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the control: shows the ring for a scene that was not', () => {
    mockPrepared = 'aurora';
    render(plot());
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

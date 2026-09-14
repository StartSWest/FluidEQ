import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';

const mockDraw = jest.fn();
const mockCompile = jest.fn();
const mockLoad = jest.fn();
const mockDecode = jest.fn();
const mockKick = jest.fn();
const mockProgram = {
  draw: mockDraw,
  dispose: jest.fn(),
  musicAccent: () => 0,
};
const mockGl = { isContextLost: () => false };

// The runner hears the music through the scene audio context, which the
// graph fills from the capture and a desktop background from its own relay.
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
  default: () => mockKick,
}));
jest.mock('../../../renderer/graph/sceneArtwork', () => ({
  decodeSceneArtwork: (...args: unknown[]) => mockDecode(...args),
}));
jest.mock('../../../renderer/graph/sceneGl', () => ({
  createSceneContext: () => mockGl,
  compileScene: (...args: unknown[]) => mockCompile(...args),
}));
// Not `virtual`: the worker client exists now. Declared virtual, this mock
// and sceneDrawTimeFrame's ordinary one of the same module collided inside
// one Jest worker, and whichever file ran second got the wrong client: its
// scene never loaded and every case hung — in full runs only, and in either
// order, while each file passed alone.
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: () => ({
    load: (...args: unknown[]) => mockLoad(...args),
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
  params: [{ id: 'speed', names: { en: 'Speed' }, min: 0, max: 5, value: 1 }],
};
const ladder = jest.fn(() => ({
  frame: jest.fn(),
  scale: () => 1,
  reset: jest.fn(),
}));
const source = (next: IScenePack, version: number): ISceneSource => ({
  identity: 'project',
  version: String(version),
  name: 'Test',
  load: () => Promise.resolve(next),
  block: jest.fn(),
  reportFailure: jest.fn(),
  tooSlow: jest.fn(),
  createLadder: ladder,
});
/**
 * Settles once the runner has made its `count`th pack the drawn one.
 *
 * Waiting on that report rather than polling against a deadline: under the
 * whole suite's load these used `waitFor`'s one-second default and failed
 * while passing on their own every time.
 */
const onLoaded = jest.fn();
const loads = (count: number) =>
  act(
    () =>
      new Promise<void>((resolve) => {
        const settle = () => {
          if (onLoaded.mock.calls.length >= count) {
            resolve();
          }
        };
        onLoaded.mockImplementation(settle);
        settle();
      }),
  );
function Stage({ scene }: { scene: ISceneSource }) {
  const ref = useSceneRunner({
    source: scene,
    width: 480,
    height: 270,
    spectrumRect: [0, 1, 0, 1],
    onLoaded,
  });
  return <div ref={ref} />;
}
const preparations = () =>
  mockCompile.mock.calls.length + mockLoad.mock.calls.length;
beforeEach(() => {
  jest.clearAllMocks();
  mockDecode.mockResolvedValue(undefined);
  mockCompile.mockReturnValue({ ok: true, program: mockProgram });
  mockLoad.mockResolvedValue({ kind: 'ready', rebuilt: true });
});

it('saves response and parameter values without preparing the scene again', async () => {
  const { rerender } = render(<Stage scene={source(pack, 1)} />);
  await loads(1);
  expect(preparations()).toBe(1);
  const next = {
    ...pack,
    version: 2,
    params: [{ ...pack.params[0], value: 3 }],
    response: { sensitivity: 2, threshold: 0.2, attack: 40, release: 80 },
  };
  mockKick.mockClear();
  rerender(<Stage scene={source(next, 2)} />);
  await loads(2);
  expect(mockKick).toHaveBeenCalled();
  expect(preparations()).toBe(1);
  expect(mockProgram.dispose).not.toHaveBeenCalled();
});

it.each(['source', 'artwork', 'declaration'] as const)(
  'reloads changed %s instead of treating it as tuning',
  async (change) => {
    const { rerender } = render(<Stage scene={source(pack, 1)} />);
    await loads(1);
    expect(preparations()).toBe(1);
    const changes: Record<typeof change, Partial<IScenePack>> = {
      source: { source: `${pack.source}\n// changed` },
      artwork: {
        artwork: { mime: 'image/webp', width: 1, height: 1, data: 'abcd' },
      },
      declaration: { params: [{ ...pack.params[0], id: 'brightness' }] },
    };
    rerender(<Stage scene={source({ ...pack, ...changes[change] }, 2)} />);
    await loads(2);
    expect(preparations()).toBe(2);
  },
);

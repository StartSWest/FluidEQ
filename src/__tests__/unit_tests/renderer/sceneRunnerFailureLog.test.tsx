/**
 * Every way a scene ends up not playing is one line in the log, named by its
 * look, version and surface, with the driver's or loader's own words (Ivan,
 * 2026-11-11: "make sure we log scene failures so users can send logs to
 * us"). The scene loop is the one place that sees all of them, whichever
 * surface it draws for; each case stands beside a scene that played and
 * wrote nothing.
 */
import { act, render } from '@testing-library/react';
import type { ISceneFailureEntry } from '../../../common/sceneFailureLog';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';
import { resetSceneFailureLogForTesting } from '../../../renderer/utils/sceneFailureLog';

const mockLoad = jest.fn();
const mockKick = jest.fn();
let mockFailure: ((reason: string, log?: string) => void) | undefined;

jest.mock('../../../renderer/plus/galleryStore', () => ({
  findGalleryScene: () => undefined,
}));
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
jest.mock('../../../renderer/graph/sceneWorkerClient', () => ({
  createSceneWorkerClient: (
    _host: unknown,
    onFailure: (reason: string, log?: string) => void,
  ) => {
    mockFailure = onFailure;
    return {
      load: (...args: unknown[]) => mockLoad(...args),
      canDraw: () => true,
      draw: jest.fn(),
      holdPicture: jest.fn(),
      dispose: jest.fn(),
    };
  },
}));

const LOG = "ERROR: 0:3: 'uPalette_colours' : undeclared identifier";
const LOOK = 'member:4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30:glacier';

const pack = (source: string, version: number): IScenePack => ({
  schema: 1,
  id: 'glacier',
  version,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Glacier' },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source,
  params: [],
});
const GOOD = pack('vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.); }', 1);
const BROKEN = pack('vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.) }', 2);

const settled = (mock: jest.Mock) =>
  new Promise<void>((resolve) => {
    mock.mockImplementationOnce(() => resolve());
  });

/** Settles once the source is told of a line with this reason. */
const loggedAs = (
  source: { logFailure: jest.Mock<void, [ISceneFailureEntry]> },
  reason: ISceneFailureEntry['reason'],
) =>
  new Promise<void>((resolve) => {
    source.logFailure.mockImplementation((entry) => {
      if (entry.reason === reason) {
        resolve();
      }
    });
  });

const sourceOf = (
  load: () => Promise<IScenePack | undefined>,
  version: string,
  kept?: IScenePack,
) => ({
  identity: 'glacier',
  lookId: LOOK,
  surface: 'player' as const,
  version,
  name: 'Glacier',
  load,
  block: jest.fn(),
  reportFailure: jest.fn(),
  lastBuilt: jest.fn(() => Promise.resolve(kept)),
  built: jest.fn(),
  tooSlow: jest.fn(),
  reportWorld: jest.fn(),
  logFailure: jest.fn<void, [ISceneFailureEntry]>(),
  madeBy: 'listener' as const,
});

function Stage({ scene }: { scene: ISceneSource }) {
  const ref = useSceneRunner({
    source: scene,
    width: 480,
    height: 270,
    spectrumRect: [0, 1, 0, 1],
  });
  return <div ref={ref} />;
}

const lines = (source: ReturnType<typeof sourceOf>) =>
  source.logFailure.mock.calls.map(([entry]) => entry);

beforeEach(() => {
  jest.clearAllMocks();
  resetSceneFailureLogForTesting();
  mockFailure = undefined;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockLoad.mockImplementation((loaded: IScenePack) =>
    Promise.resolve(
      loaded.source === BROKEN.source
        ? { kind: 'compile', log: LOG }
        : { kind: 'ready', rebuilt: true },
    ),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('writes nothing for a scene that plays', async () => {
  const source = sourceOf(() => Promise.resolve(GOOD), '1');
  const drawn = settled(source.built);
  render(<Stage scene={source} />);
  await act(() => drawn);
  expect(source.logFailure).not.toHaveBeenCalled();
});

it('writes a version that will not compile, with the driver’s words, once', async () => {
  const source = sourceOf(() => Promise.resolve(BROKEN), '2');
  const failed = settled(source.reportFailure);
  const view = render(<Stage scene={source} />);
  await act(() => failed);
  expect(lines(source)).toEqual([
    {
      lookId: LOOK,
      version: '2',
      surface: 'player',
      reason: 'compile',
      detail: LOG,
    },
  ]);
  // The same scene failing the same way again on this surface is not a
  // second line: the report is for reading, and noise pushes lines out.
  view.unmount();
  const again = sourceOf(() => Promise.resolve(BROKEN), '2');
  const twice = settled(again.reportFailure);
  render(<Stage scene={again} />);
  await act(() => twice);
  expect(again.logFailure).not.toHaveBeenCalled();
});

it('writes that an earlier build stood in for a version that will not compile', async () => {
  const source = sourceOf(() => Promise.resolve(BROKEN), '2', GOOD);
  const stood = loggedAs(source, 'stood-in');
  render(<Stage scene={source} />);
  await act(() => stood);
  expect(lines(source).map(({ reason, detail }) => [reason, detail])).toEqual([
    ['compile', LOG],
    ['stood-in', 'version 1'],
  ]);
});

it('writes a newer version that will not compile while the drawn one plays on', async () => {
  const first = sourceOf(() => Promise.resolve(GOOD), '1');
  const drawn = settled(first.built);
  const view = render(<Stage scene={first} />);
  await act(() => drawn);
  expect(first.logFailure).not.toHaveBeenCalled();

  const next = sourceOf(() => Promise.resolve(BROKEN), '2');
  const logged = settled(next.logFailure);
  view.rerender(<Stage scene={next} />);
  await act(() => logged);
  expect(lines(next)).toEqual([
    {
      lookId: LOOK,
      version: '2',
      surface: 'player',
      reason: 'version-compile',
      detail: LOG,
    },
  ]);
});

it('writes a scene its store no longer hands over, and one whose load threw', async () => {
  const gone = sourceOf(() => Promise.resolve(undefined), '2');
  const blocked = settled(gone.block);
  const view = render(<Stage scene={gone} />);
  await act(() => blocked);
  expect(lines(gone).map(({ reason }) => reason)).toEqual(['not-listed']);
  view.unmount();

  const broken = sourceOf(
    () => Promise.reject(new Error('bridge closed')),
    '3',
  );
  const logged = settled(broken.logFailure);
  render(<Stage scene={broken} />);
  await act(() => logged);
  expect(lines(broken)).toEqual([
    {
      lookId: LOOK,
      version: '3',
      surface: 'player',
      reason: 'load-failed',
      detail: 'Error: bridge closed',
    },
  ]);
});

it('writes a machine that could not give the scene a context', async () => {
  mockLoad.mockResolvedValue({ kind: 'unavailable' });
  const source = sourceOf(() => Promise.resolve(GOOD), '1');
  const logged = settled(source.logFailure);
  render(<Stage scene={source} />);
  await act(() => logged);
  expect(lines(source).map(({ reason }) => reason)).toEqual(['unavailable']);
});

it('writes a context the driver took away, by the driver’s reason', async () => {
  const source = sourceOf(() => Promise.resolve(GOOD), '1');
  const drawn = settled(source.built);
  render(<Stage scene={source} />);
  await act(() => drawn);
  act(() => mockFailure?.('gpu-reset', 'DXGI_ERROR_DEVICE_RESET'));
  expect(lines(source)).toEqual([
    {
      lookId: LOOK,
      version: '1',
      surface: 'player',
      reason: 'gpu-reset',
      detail: 'DXGI_ERROR_DEVICE_RESET',
    },
  ]);
});

it('writes a world drawn as its shader, with the reader’s codes', async () => {
  mockLoad.mockResolvedValue({
    kind: 'ready',
    rebuilt: true,
    world: {
      drawn: false,
      notes: [{ code: 'engine-failed', detail: 'no WebGL2' }],
    },
  });
  const source = sourceOf(() => Promise.resolve(GOOD), '1');
  const drawn = settled(source.built);
  render(<Stage scene={source} />);
  await act(() => drawn);
  expect(lines(source)).toEqual([
    {
      lookId: LOOK,
      version: '1',
      surface: 'player',
      reason: 'world-refused',
      detail: 'shader instead: engine-failed (no WebGL2)',
    },
  ]);
});

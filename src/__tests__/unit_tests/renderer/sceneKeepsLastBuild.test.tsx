/**
 * A version of a scene that will not compile is not a failure of the scene
 * (Ivan, 2026-11-09: "I dont want fallbacks like that"): the version already
 * drawn plays on, or the last one that built here stands in, and only a scene
 * with nothing of it that builds is reported unusable — the report every
 * place but the Studio answers with the plain look.
 */
import { act, render } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import useSceneRunner, {
  type ISceneSource,
} from '../../../renderer/graph/useSceneRunner';

const mockLoad = jest.fn();
const mockDraw = jest.fn();
// One kick for the runner's life, as the real hook gives: a new one every
// render re-runs every effect that depends on it, and no build ever lands.
const mockKick = jest.fn();

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
  createSceneWorkerClient: () => ({
    load: (...args: unknown[]) => mockLoad(...args),
    canDraw: () => true,
    draw: mockDraw,
    holdPicture: jest.fn(),
    dispose: jest.fn(),
  }),
}));

const LOG = "ERROR: 0:3: ';' : syntax error";

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
const EARLIER = pack(
  'vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.); }',
  1,
);
const BROKEN = pack('vec4 sceneColour(vec2 uv) { return vec4(uv, 0., 1.) }', 2);
const FIXED = pack('vec4 sceneColour(vec2 uv) { return vec4(uv, 1., 1.); }', 3);

/** Settles the next time `mock` is called. */
const called = (mock: jest.Mock) =>
  new Promise<void>((resolve) => {
    mock.mockImplementationOnce(() => resolve());
  });

const source = (
  next: IScenePack,
  kept?: IScenePack,
): ISceneSource & {
  reportFailure: jest.Mock;
  versionFailed: jest.Mock;
  built: jest.Mock;
  block: jest.Mock;
  lastBuilt: jest.Mock;
} => ({
  identity: 'member:me:glacier',
  version: String(next.version),
  name: 'Glacier',
  load: () => Promise.resolve(next),
  block: jest.fn(),
  reportFailure: jest.fn(),
  versionFailed: jest.fn(),
  lastBuilt: jest.fn(() => Promise.resolve(kept)),
  built: jest.fn(),
  tooSlow: jest.fn(),
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

// Every version that will not compile is written to the console with the
// driver's words: held here, and asserted where it is the point.
let printed: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  printed = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockLoad.mockImplementation((loaded: IScenePack) =>
    Promise.resolve(
      loaded.source === BROKEN.source
        ? { kind: 'compile', log: LOG }
        : { kind: 'ready', rebuilt: true },
    ),
  );
});

it('plays the version already drawn on through a newer one that will not compile', async () => {
  const first = source(EARLIER);
  const drawn = called(first.built);
  const view = render(<Stage scene={first} />);
  // The control: the first version builds, and is kept as the last build.
  await act(() => drawn);

  const next = source(BROKEN);
  const failed = called(next.versionFailed);
  view.rerender(<Stage scene={next} />);
  await act(() => failed);
  expect(next.versionFailed).toHaveBeenCalledWith(LOG);
  expect(printed).toHaveBeenCalledWith(expect.stringContaining(LOG));
  expect(next.reportFailure).not.toHaveBeenCalled();
  expect(next.block).not.toHaveBeenCalled();
  expect(next.built).not.toHaveBeenCalled();
});

it('puts the last build up in place of a first version that will not compile, and the fix back at once', async () => {
  const broken = source(BROKEN, EARLIER);
  const failed = called(broken.versionFailed);
  const view = render(<Stage scene={broken} />);
  await act(() => failed);
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockLoad).toHaveBeenLastCalledWith(EARLIER, expect.anything());
  expect(broken.reportFailure).not.toHaveBeenCalled();
  // Standing in, it is not the version the source names: not kept as it.
  expect(broken.built).not.toHaveBeenCalled();

  const fixed = source(FIXED, EARLIER);
  const drawn = called(fixed.built);
  view.rerender(<Stage scene={fixed} />);
  await act(() => drawn);
  expect(mockLoad).toHaveBeenLastCalledWith(FIXED, expect.anything());
});

it('reports the scene unusable when nothing of it has ever built here', async () => {
  const broken = source(BROKEN);
  const failed = called(broken.reportFailure);
  render(<Stage scene={broken} />);
  await act(() => failed);
  expect(broken.lastBuilt).toHaveBeenCalled();
  expect(broken.reportFailure).toHaveBeenCalledWith('compile', LOG);
  expect(broken.versionFailed).not.toHaveBeenCalled();
});

it('does not stand the same program in for itself', async () => {
  const broken = source(BROKEN, { ...BROKEN, version: 1 });
  const failed = called(broken.reportFailure);
  render(<Stage scene={broken} />);
  await act(() => failed);
  expect(mockLoad).toHaveBeenCalledTimes(1);
});

it('ends in the report when the last build will not compile either', async () => {
  // A driver update can break what built yesterday: one try, never a loop.
  const stale = { ...EARLIER, version: 1 };
  mockLoad.mockImplementation(() =>
    Promise.resolve({ kind: 'compile', log: LOG }),
  );
  const broken = source(BROKEN, stale);
  const failed = called(broken.reportFailure);
  render(<Stage scene={broken} />);
  await act(() => failed);
  expect(mockLoad.mock.calls.map(([loaded]) => loaded)).toEqual([
    BROKEN,
    stale,
  ]);
});

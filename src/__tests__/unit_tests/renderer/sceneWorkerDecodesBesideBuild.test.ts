/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's scene worker hands its build the picture's decode still under
 * way (`sceneArtworkBesideLink.test.ts` holds what the build does with it),
 * and closes the picture once the build has settled — at once, or whenever a
 * decode the build never waited for comes in.
 */

const mockCompile = jest.fn();
const mockDecode = jest.fn();
jest.mock('../../../renderer/graph/sceneGl', () => ({
  compileScene: (...args: unknown[]) => mockCompile(...args),
  createSceneContext: () => ({ isContextLost: () => false }),
}));
jest.mock('../../../renderer/graph/sceneArtwork', () => ({
  decodeSceneArtwork: (...args: unknown[]) => mockDecode(...args),
}));

type TScope = {
  onmessage: (event: { data: unknown }) => void;
  postMessage: jest.Mock;
};

const deferred = <T>() => {
  const handles = {
    resolve: (_value: T): void => undefined,
    reject: (_error: unknown): void => undefined,
  };
  const promise = new Promise<T>((resolve, reject) => {
    handles.resolve = resolve;
    handles.reject = reject;
  });
  return { promise, ...handles };
};

const settle = async () => {
  for (let step = 0; step < 20; step += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per step is the point
    await Promise.resolve();
  }
};

/** One turn of the event loop: Node reports unheard rejections at its end. */
const turnOver = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

const startWorker = (): TScope => {
  const scope = globalThis as unknown as TScope;
  scope.postMessage = jest.fn();
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- the worker installs itself on load
    require('../../../renderer/graph/sceneRenderer.worker');
  });
  scope.onmessage({
    data: { kind: 'attach', canvas: { addEventListener: jest.fn() } },
  });
  return scope;
};

const PACK = { id: 'scene', source: 'a', params: [], artwork: {} };
const program = () => ({ dispose: jest.fn(), draw: jest.fn() });
const loaded = (scope: TScope) =>
  scope.postMessage.mock.calls
    .map(([reply]) => reply as { kind: string; result?: { kind: string } })
    .filter((reply) => reply.kind === 'loaded');

beforeEach(() => {
  mockCompile.mockReset();
  mockDecode.mockReset();
});

it('starts the build before the picture has decoded, and closes the picture once the build is done', async () => {
  const picture = deferred<ImageBitmap | undefined>();
  mockDecode.mockReturnValue(picture.promise);
  const build = deferred<unknown>();
  mockCompile.mockReturnValue(build.promise);
  const scope = startWorker();

  scope.onmessage({
    data: { kind: 'load', id: 1, pack: PACK, unwatched: false },
  });
  await settle();
  // Building already, with the decode itself handed over, not its result.
  expect(mockCompile).toHaveBeenCalledTimes(1);
  const handed = mockCompile.mock.calls[0][2] as PromiseLike<unknown>;
  expect(typeof handed.then).toBe('function');

  const close = jest.fn();
  picture.resolve({ close } as unknown as ImageBitmap);
  await settle();
  // The build still reads it.
  expect(close).not.toHaveBeenCalled();

  build.resolve({ ok: true, program: program() });
  await settle();
  expect(loaded(scope)).toEqual([
    expect.objectContaining({ result: { kind: 'ready', rebuilt: true } }),
  ]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('closes a picture that arrives after its build has already failed', async () => {
  const picture = deferred<ImageBitmap | undefined>();
  mockDecode.mockReturnValue(picture.promise);
  mockCompile.mockResolvedValue({ ok: false, log: 'ERROR: 0:1: bad' });
  const scope = startWorker();

  scope.onmessage({
    data: { kind: 'load', id: 1, pack: PACK, unwatched: false },
  });
  await settle();
  expect(loaded(scope)).toEqual([
    expect.objectContaining({
      result: { kind: 'compile', log: 'ERROR: 0:1: bad' },
    }),
  ]);
  const close = jest.fn();
  picture.resolve({ close } as unknown as ImageBitmap);
  await settle();
  expect(close).toHaveBeenCalledTimes(1);
});

it('reports a picture that fails to decode as the build failing, and nothing goes unheard', async () => {
  const unheard = jest.fn();
  process.on('unhandledRejection', unheard);
  try {
    const failure = new Error(
      'Scene artwork dimensions differ from its signed header.',
    );
    mockDecode.mockReturnValue(Promise.reject(failure));
    // A build that reads the picture, as the real one does once linked.
    mockCompile.mockImplementation(
      async (_gl: unknown, _pack: unknown, arriving: Promise<unknown>) => {
        await arriving;
        return { ok: true, program: program() };
      },
    );
    const scope = startWorker();
    scope.onmessage({
      data: { kind: 'load', id: 1, pack: PACK, unwatched: false },
    });
    await settle();
    expect(loaded(scope)).toEqual([
      expect.objectContaining({
        result: { kind: 'compile', log: String(failure) },
      }),
    ]);
    // A picture that fails while the build, still linking, has not read it:
    // the event loop turns over before the build is done, which is where an
    // unheard rejection would be reported.
    mockDecode.mockReturnValue(Promise.reject(failure));
    const linking = deferred<unknown>();
    mockCompile.mockReturnValue(linking.promise);
    scope.onmessage({
      data: {
        kind: 'load',
        id: 2,
        pack: { ...PACK, source: 'b' },
        unwatched: false,
      },
    });
    await turnOver();
    linking.resolve({ ok: false, log: 'bad' });
    await turnOver();
    expect(unheard).not.toHaveBeenCalled();
  } finally {
    process.off('unhandledRejection', unheard);
  }
});

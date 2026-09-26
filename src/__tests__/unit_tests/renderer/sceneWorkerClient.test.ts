import { createSceneWorkerClient } from '../../../renderer/graph/sceneWorkerClient';
import type { IScenePack } from '../../../common/scenePacks';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type { TSceneWorkerReply } from '../../../renderer/graph/sceneWorkerMessages';

const worker = {
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: undefined as
    ((event: MessageEvent<TSceneWorkerReply>) => void) | undefined,
  onerror: undefined as ((event: ErrorEvent) => void) | undefined,
};
const offscreen = { kind: 'offscreen' } as unknown as OffscreenCanvas;
const originalWorker = global.Worker;
// jsdom has no OffscreenCanvas; the page's side of the hand-over is all this
// file can see, and all it needs to.
const transfer = jest.fn(() => offscreen);
/**
 * The frames the page paints, run by hand so their order against the worker
 * ending is exact rather than whatever a real clock happens to give.
 */
let frames: FrameRequestCallback[] = [];
const paintFrame = () => {
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(0));
};
let paints: jest.SpyInstance | undefined;
beforeEach(() => {
  jest.clearAllMocks();
  frames = [];
  paints = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  global.Worker = jest.fn(() => worker) as unknown as typeof Worker;
  Object.defineProperty(
    HTMLCanvasElement.prototype,
    'transferControlToOffscreen',
    {
      configurable: true,
      value: transfer,
    },
  );
});
afterEach(() => {
  paints?.mockRestore();
  global.Worker = originalWorker;
  delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>)
    .transferControlToOffscreen;
});
const packOf = (id: string, source = `// ${id}`) =>
  ({ id, params: [], source }) as unknown as IScenePack;
/** A load is sent once any compile of the same program in the window is done. */
const settle = async () => {
  for (let turn = 0; turn < 4; turn += 1) {
    await Promise.resolve();
  }
};
const reply = (data: TSceneWorkerReply) =>
  worker.onmessage?.({ data } as MessageEvent<TSceneWorkerReply>);
const start = () => {
  const host = document.createElement('div');
  const client = createSceneWorkerClient(host, jest.fn(), jest.fn());
  return { host, client, canvas: host.querySelector('canvas') };
};

it('hands the worker a canvas of its own before anything else', () => {
  const { client, canvas } = start();
  expect(client).toBeDefined();
  expect(canvas).not.toBeNull();
  expect(transfer).toHaveBeenCalledTimes(1);
  expect(worker.postMessage).toHaveBeenNthCalledWith(
    1,
    { kind: 'attach', canvas: offscreen },
    [offscreen],
  );
});

it('loads in the worker and keeps one drawing in flight until it is committed', async () => {
  const { client } = start();
  const pack = packOf('scene');
  const loading = client?.load(pack, true);
  await settle();
  expect(worker.postMessage).toHaveBeenLastCalledWith({
    kind: 'load',
    id: 1,
    pack,
    guarded: true,
  });
  expect(client?.canDraw()).toBe(false);
  reply({ kind: 'loaded', id: 1, result: { kind: 'ready', rebuilt: true } });
  await expect(loading).resolves.toEqual({ kind: 'ready', rebuilt: true });
  expect(client?.canDraw()).toBe(true);
  const shown = jest.fn();
  client?.draw(
    {} as ISceneFrame,
    { width: 50, height: 50 },
    { width: 100, height: 100 },
    { fsr: true, fxaa: false },
    [0, 0, 1, 1],
    0,
    shown,
  );
  expect(worker.postMessage).toHaveBeenLastCalledWith({
    kind: 'draw',
    frame: {},
    width: 50,
    height: 50,
    output: { width: 100, height: 100 },
    finish: { fsr: true, fxaa: false },
    clip: [0, 0, 1, 1],
    paceMs: 0,
  });
  expect(client?.canDraw()).toBe(false);
  reply({
    kind: 'drawn',
    accent: 0.5,
    cost: { costMs: 1.5, behind: 1 },
    skipped: false,
  });
  expect(shown).toHaveBeenCalledWith({
    accent: 0.5,
    cost: { costMs: 1.5, behind: 1 },
    skipped: false,
  });
  expect(client?.canDraw()).toBe(true);
});

it('takes its canvas away before the worker goes, so the backdrop shows and never white', () => {
  const { host, client } = start();
  const shown = jest.fn();
  client?.draw(
    {} as ISceneFrame,
    { width: 100, height: 100 },
    { width: 100, height: 100 },
    { fsr: false, fxaa: false },
    [0, 0, 1, 1],
    0,
    shown,
  );
  client?.dispose();
  // The canvas leaves at once. The worker, and the picture it holds, only
  // once a frame without that canvas has been painted: freed in the same
  // moment, the screen still showed the canvas for a frame with nothing in
  // it — the whole stage white, on the monitor, 52ms after leaving a scene.
  expect(host.querySelector('canvas')).toBeNull();
  expect(worker.terminate).not.toHaveBeenCalled();
  paintFrame();
  expect(worker.terminate).not.toHaveBeenCalled();
  paintFrame();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  // A reply already on its way when it was disposed reaches nobody.
  reply({ kind: 'drawn', accent: 0, cost: { behind: 0 }, skipped: false });
  expect(shown).not.toHaveBeenCalled();
});

it('ends it at once in a hidden page, which paints no frame to wait for', () => {
  // And where a frame never comes: waiting on one would have kept an unseen
  // scene's worker, and its GPU memory, alive until the window was looked at.
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => true,
  });
  try {
    const { client } = start();
    client?.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  } finally {
    delete (document as Partial<Document> & { hidden?: boolean }).hidden;
  }
});

it('hides the canvas while its context is lost and shows it once restored', () => {
  const recovered = jest.fn();
  const host = document.createElement('div');
  const client = createSceneWorkerClient(host, jest.fn(), recovered);
  const canvas = host.querySelector('canvas');
  reply({ kind: 'lost', fatal: false, blamed: false });
  expect(canvas?.style.visibility).toBe('hidden');
  expect(client?.canDraw()).toBe(false);
  reply({ kind: 'restored' });
  expect(canvas?.style.visibility).toBe('');
  expect(recovered).toHaveBeenCalledTimes(1);
  expect(client?.canDraw()).toBe(true);
});

it('names a fatal loss after its own long frame a reset, and any other a loss', () => {
  // Sleep and a driver update lose every context too, so only a loss right
  // after the scene held the GPU is reported as the scene's own fault.
  const unblamed = jest.fn();
  createSceneWorkerClient(document.createElement('div'), unblamed, jest.fn());
  reply({ kind: 'lost', fatal: false, blamed: false });
  expect(unblamed).not.toHaveBeenCalled();
  reply({ kind: 'lost', fatal: true, blamed: false });
  expect(unblamed).toHaveBeenCalledWith('context-lost');

  const blamed = jest.fn();
  createSceneWorkerClient(document.createElement('div'), blamed, jest.fn());
  reply({ kind: 'lost', fatal: true, blamed: true });
  expect(blamed).toHaveBeenCalledWith('gpu-reset');
  expect(blamed).not.toHaveBeenCalledWith('context-lost');
});

it('settles pending loads and stops drawing after a worker failure', async () => {
  const failed = jest.fn();
  const host = document.createElement('div');
  const client = createSceneWorkerClient(host, failed, jest.fn());
  const loading = client?.load(packOf('scene'), true);
  await settle();
  worker.onerror?.({ message: 'driver failed' } as ErrorEvent);
  await expect(loading).resolves.toEqual({ kind: 'cancelled' });
  expect(client?.canDraw()).toBe(false);
  expect(failed).toHaveBeenCalledWith('unavailable', 'driver failed');
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(host.querySelector('canvas')).toBeNull();
});

it('declines to start where a canvas cannot be handed to a worker', () => {
  delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>)
    .transferControlToOffscreen;
  const host = document.createElement('div');
  expect(createSceneWorkerClient(host, jest.fn(), jest.fn())).toBeUndefined();
  expect(global.Worker).not.toHaveBeenCalled();
  expect(host.children).toHaveLength(0);
});

it('lets a load still linking finish before its worker goes', async () => {
  const { host, client } = start();
  const loading = client?.load(packOf('alpine'), true);
  await settle();
  client?.dispose();
  await expect(loading).resolves.toEqual({ kind: 'cancelled' });
  // Ended mid-link, the worker's context would stall every scene's GPU work
  // for the rest of the compile.
  expect(worker.postMessage).toHaveBeenLastCalledWith({ kind: 'retire' });
  expect(worker.terminate).not.toHaveBeenCalled();
  expect(host.querySelector('canvas')).toBeNull();
  reply({ kind: 'retired' });
  // A link that finished within a frame of the canvas going is still let
  // go only after that frame is painted.
  paintFrame();
  paintFrame();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('does not wait on a link when nothing it was sent is still linking', async () => {
  const { client } = start();
  const loading = client?.load(packOf('aurora'), true);
  await settle();
  reply({ kind: 'loaded', id: 1, result: { kind: 'ready', rebuilt: true } });
  await loading;
  client?.dispose();
  paintFrame();
  paintFrame();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(worker.postMessage).not.toHaveBeenCalledWith({ kind: 'retire' });
});

it('sends a second compile of the same program only once the first has linked', async () => {
  // Two contexts in the window, each with a worker of its own.
  const made: (typeof worker)[] = [];
  global.Worker = jest.fn(() => {
    const next = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: undefined as typeof worker.onmessage,
      onerror: undefined as typeof worker.onerror,
    };
    made.push(next);
    return next;
  }) as unknown as typeof Worker;
  const first = createSceneWorkerClient(
    document.createElement('div'),
    jest.fn(),
    jest.fn(),
  );
  const second = createSceneWorkerClient(
    document.createElement('div'),
    jest.fn(),
    jest.fn(),
  );
  const loadsSentBy = (index: number) =>
    made[index].postMessage.mock.calls.filter(
      ([request]) => (request as { kind: string }).kind === 'load',
    );

  const firstLoad = first?.load(packOf('bloom', 'same source'), true);
  await settle();
  const secondLoad = second?.load(packOf('bloom', 'same source'), false);
  await settle();
  expect(loadsSentBy(0)).toHaveLength(1);
  expect(loadsSentBy(1)).toHaveLength(0);

  made[0].onmessage?.({
    data: { kind: 'loaded', id: 1, result: { kind: 'ready', rebuilt: true } },
  } as MessageEvent<TSceneWorkerReply>);
  await expect(firstLoad).resolves.toEqual({ kind: 'ready', rebuilt: true });
  await settle();
  expect(loadsSentBy(1)).toHaveLength(1);

  made[1].onmessage?.({
    data: { kind: 'loaded', id: 1, result: { kind: 'ready', rebuilt: false } },
  } as MessageEvent<TSceneWorkerReply>);
  await expect(secondLoad).resolves.toEqual({ kind: 'ready', rebuilt: false });
  first?.dispose();
  second?.dispose();
});

/**
 * A scene on a layer of the window is held off the screen while the graph
 * framing it is on its way out of full screen (`graphArrival.ts`), and comes
 * back only on a frame drawn once it is let go — never on a frame drawn for a
 * layout in between (Ivan, 2026-09-26: "the scene itself kind of compresses
 * when exiting full screen").
 */
it('keeps a held picture off the screen until a frame drawn after it is let go', () => {
  const { client, canvas } = start();
  const drawOnce = () => {
    client?.draw(
      {} as ISceneFrame,
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { fsr: false, fxaa: false },
      [0, 0, 1, 1],
      0,
      jest.fn(),
    );
  };
  const drawn = () =>
    reply({ kind: 'drawn', accent: 0, cost: { behind: 0 }, skipped: false });
  // The control: a frame drawn with nothing held leaves the picture shown.
  drawOnce();
  drawn();
  expect(canvas?.style.opacity).not.toBe('0');

  client?.holdPicture(true);
  expect(canvas?.style.opacity).toBe('0');
  drawOnce();
  drawn();
  expect(canvas?.style.opacity).toBe('0');

  // Let go with a frame already on its way: that frame was drawn for the
  // layout the hold was for, so it does not bring the picture back.
  drawOnce();
  client?.holdPicture(false);
  drawn();
  expect(canvas?.style.opacity).toBe('0');
  drawOnce();
  drawn();
  expect(canvas?.style.opacity).toBe('1');
});

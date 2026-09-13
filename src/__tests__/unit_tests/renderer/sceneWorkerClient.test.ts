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
beforeEach(() => {
  jest.clearAllMocks();
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
  global.Worker = originalWorker;
  delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>)
    .transferControlToOffscreen;
});
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
  const pack = { id: 'scene' } as IScenePack;
  const loading = client?.load(pack, true);
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
  client?.draw({} as ISceneFrame, 100, 100, [0, 0, 1, 1], shown);
  expect(client?.canDraw()).toBe(false);
  reply({ kind: 'drawn', accent: 0.5, costMs: 1.5 });
  expect(shown).toHaveBeenCalledWith(0.5, 1.5);
  expect(client?.canDraw()).toBe(true);
});

it('takes its canvas away with the worker, so the backdrop shows and not white', () => {
  const { host, client } = start();
  const shown = jest.fn();
  client?.draw({} as ISceneFrame, 100, 100, [0, 0, 1, 1], shown);
  client?.dispose();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(host.querySelector('canvas')).toBeNull();
  // A reply already on its way when it was disposed reaches nobody.
  reply({ kind: 'drawn', accent: 0, costMs: 0 });
  expect(shown).not.toHaveBeenCalled();
});

it('hides the canvas while its context is lost and shows it once restored', () => {
  const recovered = jest.fn();
  const host = document.createElement('div');
  const client = createSceneWorkerClient(host, jest.fn(), recovered);
  const canvas = host.querySelector('canvas');
  reply({ kind: 'lost', fatal: false });
  expect(canvas?.style.visibility).toBe('hidden');
  expect(client?.canDraw()).toBe(false);
  reply({ kind: 'restored' });
  expect(canvas?.style.visibility).toBe('');
  expect(recovered).toHaveBeenCalledTimes(1);
  expect(client?.canDraw()).toBe(true);
});

it('settles pending loads and stops drawing after a worker failure', async () => {
  const failed = jest.fn();
  const host = document.createElement('div');
  const client = createSceneWorkerClient(host, failed, jest.fn());
  const loading = client?.load({} as IScenePack, true);
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

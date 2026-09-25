/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The lamps' scene worker, from the window. What is held here: a scene the GPU
 * refused for the lamps — blamed for a reset, or holding it even at the
 * smallest size — is not handed to a worker again this session, however many
 * times the lamps start over; a scene that only failed to compile still is;
 * and a scene whose context was lost for someone else's reason comes back.
 */

import type { IScenePack } from '../../../common/scenePacks';
import type { TLightingWorkerReply } from '../../../renderer/lighting/lightingSceneMessages';

class FakeWorker {
  static made: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<TLightingWorkerReply>) => void) | null =
    null;

  onerror: ((event: ErrorEvent) => void) | null = null;

  sent: { kind: string; id?: number }[] = [];

  constructor() {
    FakeWorker.made.push(this);
  }

  postMessage(request: { kind: string; id?: number }) {
    this.sent.push(request);
  }

  terminate() {
    this.sent.push({ kind: 'terminated' });
  }

  reply(data: TLightingWorkerReply) {
    this.onmessage?.({ data } as MessageEvent<TLightingWorkerReply>);
  }
}

const packOf = (id: string) =>
  ({ id, params: [], source: `// ${id}` }) as unknown as IScenePack;

/** A load goes out after any compile of the same scene already under way. */
const settle = async () => {
  for (let turn = 0; turn < 4; turn += 1) {
    await Promise.resolve();
  }
};

const load = () => {
  let client: typeof import('../../../renderer/lighting/lightingSceneClient');
  jest.isolateModules(() => {
    client = jest.requireActual(
      '../../../renderer/lighting/lightingSceneClient',
    );
  });
  return () => client;
};

/** The number the newest load this worker was sent carries. */
const lastLoadId = (worker: FakeWorker): number =>
  worker.sent.filter((request) => request.kind === 'load').slice(-1)[0]?.id ??
  -1;

const loadsSent = () =>
  FakeWorker.made
    .flatMap((worker) => worker.sent)
    .filter((request) => request.kind === 'load');

beforeEach(() => {
  FakeWorker.made = [];
  Object.defineProperty(window, 'Worker', {
    value: FakeWorker,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'Worker');
});

// A blamed reset used to be written to disk (`sceneRefusals.ts`) so no
// surface ran the scene again even after a relaunch. That record is gone
// entirely: a fresh module load — what every relaunch gives — has never
// heard of the scene, blamed reset or not.
it('forgets a gpu-reset refusal on a fresh module load; nothing is written anywhere for it to read back', async () => {
  const first = load()();
  const lamps = first.createLightingScene(jest.fn(), jest.fn());
  lamps.load(packOf('storm'), true);
  await settle();
  expect(loadsSent()).toHaveLength(1);
  FakeWorker.made[0].reply({
    kind: 'failed',
    packId: 'storm',
    reason: 'gpu-reset',
    id: lastLoadId(FakeWorker.made[0]),
  });
  lamps.close();

  const again = load()();
  const relaunched = again.createLightingScene(jest.fn(), jest.fn());
  relaunched.load(packOf('storm'), true);
  await settle();
  expect(loadsSent()).toHaveLength(2);
  relaunched.close();
});

it('draws a scene again once a lost context it was not blamed for comes back', async () => {
  const { createLightingScene } = load()();
  const failed = jest.fn();
  const ready = jest.fn();
  const lamps = createLightingScene(jest.fn(), failed, ready);
  lamps.load(packOf('alpine'), false);
  await settle();
  const [worker] = FakeWorker.made;
  worker.reply({ kind: 'loaded', packId: 'alpine', id: lastLoadId(worker) });
  worker.reply({ kind: 'lost', packId: 'alpine' });
  // The lamps take the scene's colours while nothing can draw it.
  expect(failed).toHaveBeenCalledWith('alpine');
  lamps.draw({} as never);
  expect(worker.sent.filter((request) => request.kind === 'frame')).toEqual([]);
  // The worker loads it again with the context: frames go out again.
  worker.reply({ kind: 'loaded', packId: 'alpine', id: lastLoadId(worker) });
  // Ready at the first load, and ready again with the context back.
  expect(ready).toHaveBeenCalledTimes(2);
  lamps.draw({} as never);
  expect(
    worker.sent.filter((request) => request.kind === 'frame'),
  ).toHaveLength(1);
  lamps.close();

  // And the scene is not refused the next time the lamps start.
  const again = createLightingScene(jest.fn(), jest.fn());
  again.load(packOf('alpine'), false);
  await settle();
  expect(loadsSent()).toHaveLength(2);
  again.close();
});

it.each(['too-heavy', 'gpu-reset'])(
  'does not hand the lamps a scene the GPU refused as %s again this session',
  async (reason) => {
    const { createLightingScene } = load()();
    const failed = jest.fn();
    const first = createLightingScene(jest.fn(), failed);
    first.load(packOf('storm'), true);
    await settle();
    expect(loadsSent()).toHaveLength(1);
    FakeWorker.made[0].reply({
      kind: 'failed',
      packId: 'storm',
      reason,
      id: lastLoadId(FakeWorker.made[0]),
    });
    expect(failed).toHaveBeenCalledWith('storm');
    first.close();

    // The lamps start over — the switch turned on again — with the same scene.
    const againFailed = jest.fn();
    const again = createLightingScene(jest.fn(), againFailed);
    again.load(packOf('storm'), true);
    await settle();
    expect(againFailed).toHaveBeenCalledWith('storm');
    expect(loadsSent()).toHaveLength(1);

    // The control: another scene still reaches the worker.
    again.load(packOf('aurora'), false);
    await settle();
    expect(loadsSent()).toHaveLength(2);
    again.close();
  },
);

it('tries a scene again that only failed to compile', async () => {
  const { createLightingScene } = load()();
  const first = createLightingScene(jest.fn(), jest.fn());
  first.load(packOf('bloom'), true);
  await settle();
  FakeWorker.made[0].reply({
    kind: 'failed',
    packId: 'bloom',
    reason: 'compile',
    id: lastLoadId(FakeWorker.made[0]),
  });
  first.close();
  const again = createLightingScene(jest.fn(), jest.fn());
  again.load(packOf('bloom'), true);
  await settle();
  expect(loadsSent()).toHaveLength(2);
  again.close();
});

const framesSent = (worker: FakeWorker) =>
  worker.sent.filter((request) => request.kind === 'frame').length;

// A new version of the member's scene, or the next scene chosen, used to put
// the desk out for the whole link. The scene on the desk now carries on.
it('keeps drawing the scene on the desk while the next one links, and takes the next once it is ready', async () => {
  const { createLightingScene } = load()();
  const ready = jest.fn();
  const lamps = createLightingScene(jest.fn(), jest.fn(), ready);
  lamps.load(packOf('alpine'), false);
  await settle();
  const [worker] = FakeWorker.made;
  worker.reply({ kind: 'loaded', packId: 'alpine', id: lastLoadId(worker) });
  expect(ready).toHaveBeenLastCalledWith('alpine');

  lamps.load(packOf('aurora'), false);
  await settle();
  expect(loadsSent()).toHaveLength(2);
  // Linking: frames still go out, drawn with the scene already there.
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(1);
  worker.reply({ kind: 'grid' } as TLightingWorkerReply);
  worker.reply({ kind: 'loaded', packId: 'aurora', id: lastLoadId(worker) });
  expect(ready).toHaveBeenLastCalledWith('aurora');
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(2);
  lamps.close();
});

it('ignores the answer to a load that a newer one replaced', async () => {
  const { createLightingScene } = load()();
  const ready = jest.fn();
  const lamps = createLightingScene(jest.fn(), jest.fn(), ready);
  lamps.load(packOf('alpine'), false);
  await settle();
  const [worker] = FakeWorker.made;
  const first = lastLoadId(worker);
  lamps.load(packOf('aurora'), false);
  await settle();
  worker.reply({ kind: 'loaded', packId: 'alpine', id: first });
  expect(ready).not.toHaveBeenCalled();
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(0);
  worker.reply({ kind: 'loaded', packId: 'aurora', id: lastLoadId(worker) });
  expect(ready).toHaveBeenCalledWith('aurora');
  lamps.close();
});

// A new version of a scene carries its pack id, so the answers are told apart
// by the load's number, never by the id.
it('lets the scene being drawn fail without refusing the one linking', async () => {
  const { createLightingScene } = load()();
  const failed = jest.fn();
  const ready = jest.fn();
  const lamps = createLightingScene(jest.fn(), failed, ready);
  lamps.load(packOf('storm'), false);
  await settle();
  const [worker] = FakeWorker.made;
  worker.reply({ kind: 'loaded', packId: 'storm', id: lastLoadId(worker) });
  lamps.load(packOf('calm'), false);
  await settle();
  // The program on the desk holds the GPU even at its smallest size.
  worker.reply({ kind: 'failed', packId: 'storm', reason: 'too-heavy' });
  expect(failed).toHaveBeenCalledWith('storm');
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(0);
  worker.reply({ kind: 'loaded', packId: 'calm', id: lastLoadId(worker) });
  expect(ready).toHaveBeenLastCalledWith('calm');
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(1);
  lamps.close();

  // The refusal went to the scene that held the GPU, not the one after it.
  const again = createLightingScene(jest.fn(), jest.fn());
  again.load(packOf('calm'), false);
  await settle();
  expect(loadsSent()).toHaveLength(3);
  const refused = jest.fn();
  const third = createLightingScene(jest.fn(), refused);
  third.load(packOf('storm'), false);
  await settle();
  expect(refused).toHaveBeenCalledWith('storm');
  expect(loadsSent()).toHaveLength(3);
  again.close();
  third.close();
});

it('draws nothing once unloaded, whatever answers are still on their way', async () => {
  const { createLightingScene } = load()();
  const ready = jest.fn();
  const lamps = createLightingScene(jest.fn(), jest.fn(), ready);
  lamps.load(packOf('alpine'), false);
  await settle();
  const [worker] = FakeWorker.made;
  const id = lastLoadId(worker);
  lamps.unload();
  expect(worker.sent[worker.sent.length - 1]).toEqual({ kind: 'unload' });
  worker.reply({ kind: 'loaded', packId: 'alpine', id });
  expect(ready).not.toHaveBeenCalled();
  lamps.draw({} as never);
  expect(framesSent(worker)).toBe(0);
  lamps.close();
});

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

  sent: { kind: string }[] = [];

  constructor() {
    FakeWorker.made.push(this);
  }

  postMessage(request: { kind: string }) {
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

it('draws a scene again once a lost context it was not blamed for comes back', async () => {
  const { createLightingScene } = load()();
  const failed = jest.fn();
  const recovered = jest.fn();
  const lamps = createLightingScene(jest.fn(), failed, recovered);
  lamps.load(packOf('alpine'), false);
  await settle();
  const [worker] = FakeWorker.made;
  worker.reply({ kind: 'loaded', packId: 'alpine' });
  worker.reply({ kind: 'lost', packId: 'alpine' });
  // The lamps take the scene's colours while nothing can draw it.
  expect(failed).toHaveBeenCalledWith('alpine');
  lamps.draw({} as never);
  expect(worker.sent.filter((request) => request.kind === 'frame')).toEqual([]);
  // The worker loads it again with the context: frames go out again.
  worker.reply({ kind: 'loaded', packId: 'alpine' });
  expect(recovered).toHaveBeenCalledTimes(1);
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
    FakeWorker.made[0].reply({ kind: 'failed', packId: 'storm', reason });
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
  });
  first.close();
  const again = createLightingScene(jest.fn(), jest.fn());
  again.load(packOf('bloom'), true);
  await settle();
  expect(loadsSent()).toHaveLength(2);
  again.close();
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The page's side of the scene still worker.
 *
 * Pictures and the tint's sky are drawn in a worker so the window never waits
 * on a shader. What the page must guarantee is that a worker that answers
 * gets its answer to the right question, and one that fails — or does not
 * exist — leaves nobody waiting forever: every caller already treats
 * "nothing" as "this machine could not draw the scene".
 */

import type { IScenePack } from '../../../common/scenePacks';
import type {
  TSceneStillReply,
  TSceneStillRequest,
} from '../../../renderer/graph/sceneStillMessages';

const pack = {
  id: 'aurora',
  names: { en: 'Aurora' },
  params: [],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
} as unknown as IScenePack;

/** Requests go out after any compile of the same scene already under way. */
const settle = async () => {
  for (let turn = 0; turn < 4; turn += 1) {
    await Promise.resolve();
  }
};

class FakeWorker {
  static made: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<TSceneStillReply>) => void) | null = null;

  onerror: ((event: ErrorEvent) => void) | null = null;

  onmessageerror: (() => void) | null = null;

  sent: TSceneStillRequest[] = [];

  terminated = false;

  constructor() {
    FakeWorker.made.push(this);
  }

  postMessage(request: TSceneStillRequest) {
    this.sent.push(request);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data: TSceneStillReply) {
    this.onmessage?.({ data } as MessageEvent<TSceneStillReply>);
  }
}

const load = () => {
  let client: typeof import('../../../renderer/graph/sceneStillClient');
  jest.isolateModules(() => {
    client = jest.requireActual('../../../renderer/graph/sceneStillClient');
  });
  return () => client;
};

beforeEach(() => {
  FakeWorker.made = [];
  Object.defineProperty(window, 'Worker', {
    value: FakeWorker,
    configurable: true,
    writable: true,
  });
  document.documentElement.style.setProperty('--accent', '#52e9dc');
});

afterEach(() => {
  Reflect.deleteProperty(window, 'Worker');
});

it('answers each request with its own reply, whatever order they come in', async () => {
  const client = load()();
  const still = client.drawStillInWorker(pack);
  const sample = client.sampleSceneInWorker(pack);
  await settle();
  const [worker] = FakeWorker.made;
  expect(FakeWorker.made).toHaveLength(1);
  const [stillRequest, sampleRequest] = worker.sent;
  expect(stillRequest.kind).toBe('still');
  expect(sampleRequest.kind).toBe('sample');
  const pixels = new Uint8Array([1, 2, 3, 4]);
  const blob = new Blob(['webp'], { type: 'image/webp' });
  worker.reply({ kind: 'sample', id: sampleRequest.id, pixels });
  worker.reply({ kind: 'still', id: stillRequest.id, blob });
  await expect(sample).resolves.toBe(pixels);
  await expect(still).resolves.toBe(blob);
});

it("sends the page's accent, which a worker cannot read", async () => {
  const client = load()();
  client.sampleSceneInWorker(pack);
  await settle();
  const [request] = FakeWorker.made[0].sent;
  expect(request.accent[0]).toBeCloseTo(0x52 / 255);
  expect(request.accent[1]).toBeCloseTo(0xe9 / 255);
});

it('passes a caught moment’s frames for a captured picture', async () => {
  const client = load()();
  const frames = [{ timeSeconds: 1 }] as never;
  client.drawStillInWorker(pack, frames);
  await settle();
  const [request] = FakeWorker.made[0].sent;
  expect(request).toMatchObject({ kind: 'still', frames });
});

it('answers everything waiting with nothing when the worker fails, and starts afresh after', async () => {
  const client = load()();
  const errors = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const first = client.drawStillInWorker(pack);
  const second = client.sampleSceneInWorker(pack);
  await settle();
  const [broken] = FakeWorker.made;
  broken.onerror?.({ message: 'lost' } as ErrorEvent);
  await expect(first).resolves.toBeUndefined();
  await expect(second).resolves.toBeUndefined();
  expect(broken.terminated).toBe(true);
  client.sampleSceneInWorker(pack);
  await settle();
  expect(FakeWorker.made).toHaveLength(2);
  errors.mockRestore();
});

// A refusal used to be written to disk (`sceneRefusals.ts`) so no worker
// drew the scene again even after a relaunch, except a loss nothing was
// blamed for. That record is gone entirely: a fresh module load — what
// every relaunch gives — has never heard of the scene, whatever the reason.
it.each(['too-heavy', 'gpu-reset', 'context-lost'] as const)(
  'forgets a %s refusal on a fresh module load; nothing is written anywhere for it to read back',
  async (reason) => {
    const client = load()();
    const drawing = client.drawStillInWorker(pack);
    await settle();
    const [worker] = FakeWorker.made;
    const [request] = worker.sent;
    worker.reply({ kind: 'still', id: request.id, refused: reason });
    await expect(drawing).resolves.toBeUndefined();

    const again = load()();
    const secondDrawing = again.drawStillInWorker(pack);
    await settle();
    expect(FakeWorker.made).toHaveLength(2);
    const [, relaunchedWorker] = FakeWorker.made;
    const [relaunchedRequest] = relaunchedWorker.sent;
    const blob = new Blob(['webp'], { type: 'image/webp' });
    relaunchedWorker.reply({ kind: 'still', id: relaunchedRequest.id, blob });
    await expect(secondDrawing).resolves.toBe(blob);
  },
);

it('answers nothing at once where there are no workers at all', async () => {
  Reflect.deleteProperty(window, 'Worker');
  const client = load()();
  await expect(client.drawStillInWorker(pack)).resolves.toBeUndefined();
  await expect(client.sampleSceneInWorker(pack)).resolves.toBeUndefined();
});

it('never asks again this session for a scene a worker gave up on, even from a new worker', async () => {
  const client = load()();
  const first = client.drawStillInWorker(pack);
  await settle();
  const [worker] = FakeWorker.made;
  const [request] = worker.sent;
  worker.reply({ kind: 'still', id: request.id, refused: 'too-heavy' });
  await expect(first).resolves.toBeUndefined();

  // The worker is let go, as it is when idle, and forgets what it refused.
  const errors = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  worker.onerror?.({ message: 'gone' } as ErrorEvent);
  await expect(client.sampleSceneInWorker(pack)).resolves.toBeUndefined();
  await expect(client.drawStillInWorker(pack)).resolves.toBeUndefined();
  const asked = FakeWorker.made.flatMap((made) => made.sent).length;
  expect(asked).toBe(1);

  // The control: another scene is still drawn.
  const other = { ...pack, source: `${pack.source}\n// another` };
  client.drawStillInWorker(other as IScenePack);
  await settle();
  expect(FakeWorker.made.flatMap((made) => made.sent)).toHaveLength(2);
  errors.mockRestore();
});

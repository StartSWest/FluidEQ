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

const pack = { id: 'aurora', names: { en: 'Aurora' } } as IScenePack;

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

it("sends the page's accent, which a worker cannot read", () => {
  const client = load()();
  client.sampleSceneInWorker(pack);
  const [request] = FakeWorker.made[0].sent;
  expect(request.accent[0]).toBeCloseTo(0x52 / 255);
  expect(request.accent[1]).toBeCloseTo(0xe9 / 255);
});

it('passes a caught moment’s frames for a captured picture', () => {
  const client = load()();
  const frames = [{ timeSeconds: 1 }] as never;
  client.drawStillInWorker(pack, frames);
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
  const [broken] = FakeWorker.made;
  broken.onerror?.({ message: 'lost' } as ErrorEvent);
  await expect(first).resolves.toBeUndefined();
  await expect(second).resolves.toBeUndefined();
  expect(broken.terminated).toBe(true);
  client.sampleSceneInWorker(pack);
  expect(FakeWorker.made).toHaveLength(2);
  errors.mockRestore();
});

it('answers nothing at once where there are no workers at all', async () => {
  Reflect.deleteProperty(window, 'Worker');
  const client = load()();
  await expect(client.drawStillInWorker(pack)).resolves.toBeUndefined();
  await expect(client.sampleSceneInWorker(pack)).resolves.toBeUndefined();
});

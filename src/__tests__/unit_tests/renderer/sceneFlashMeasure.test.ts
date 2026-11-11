/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The review's flash measurement as the review page calls it (2026-11-11):
 * never a throw, a failure it can name, progress from the first second, and
 * a measurement it can walk away from. The worker and the demo song are
 * played by the test; what the worker measures is `sceneFlashMeter.test.ts`.
 */

import type { IScenePack } from '../../../common/scenePacks';
import {
  createFlashMeasurer,
  type IFlashMeasureParts,
} from '../../../renderer/graph/sceneFlashMeasure';
import { demoSecondsToMeasure } from '../../../renderer/graph/sceneFlashMusic';
import { createFilmstripKeeper } from '../../../renderer/graph/sceneFlashStrip';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import type {
  TSceneStillReply,
  TSceneStillRequest,
} from '../../../renderer/graph/sceneStillMessages';

const pack = { id: 'strobe', version: 1, params: [] } as unknown as IScenePack;
const frames = Array.from({ length: 90 }, () => ({}) as ISceneFrame);

const SUMMARY = {
  flashingShare: 0.5,
  worstAreaShare: 0.9,
  firstAtSeconds: 0.4,
  worstAtSeconds: 1.2,
  framesMeasured: 90,
  seconds: 3,
  verdict: 'fails' as const,
};

class FakeWorker {
  sent: TSceneStillRequest[] = [];

  terminated = false;

  onmessage: ((event: MessageEvent<TSceneStillReply>) => void) | null = null;

  onerror: (() => void) | null = null;

  onmessageerror: (() => void) | null = null;

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

const setup = (over: Partial<IFlashMeasureParts> = {}) => {
  const worker = new FakeWorker();
  const measure = createFlashMeasurer({
    readMusic: async () => new Uint8Array([1, 2, 3]),
    readFrames: async () => ({ ok: true, frames, seconds: 3 }),
    accent: () => [0.3, 0.9, 0.8],
    startWorker: () => worker as unknown as Worker,
    ...over,
  });
  return { worker, measure };
};

/** Until the measurement has asked its worker for something. */
const asked = async (worker: FakeWorker) => {
  while (worker.sent.length === 0) {
    // eslint-disable-next-line no-await-in-loop -- one turn of the queue at a time
    await Promise.resolve();
  }
};

/** A picture as the worker's Blob gives it; jsdom's Blob reads no bytes. */
const png = (byte: number) =>
  ({ arrayBuffer: async () => new Uint8Array([byte]).buffer }) as Blob;

describe('measuring a scene’s flashing for review', () => {
  it('draws the demo’s frames small, tells progress from the first second, and answers the verdict', async () => {
    const { worker, measure } = setup();
    const progress = jest.fn();
    const answer = measure(pack, { onProgress: progress });
    await asked(worker);
    expect(worker.sent[0]).toMatchObject({
      kind: 'flash',
      pack,
      width: 480,
      height: 270,
    });
    expect(progress).toHaveBeenCalledWith({ framesDone: 0, framesTotal: 90 });
    worker.reply({
      kind: 'flash-progress',
      id: 1,
      framesDone: 30,
      framesTotal: 90,
    });
    expect(progress).toHaveBeenLastCalledWith({
      framesDone: 30,
      framesTotal: 90,
    });
    worker.reply({
      kind: 'flash',
      id: 1,
      summary: SUMMARY,
      filmstrip: [png(1), png(2), png(3)],
      worst: 1,
    });
    const result = await answer;
    expect(result).toMatchObject({
      ok: true,
      verdict: 'fails',
      worstAtSeconds: 1.2,
    });
    if (!result.ok) {
      throw new Error('measured');
    }
    expect(result.filmstrip).toHaveLength(3);
    expect(Array.from(result.worstFrame ?? [])).toEqual([2]);
    expect(worker.terminated).toBe(true);
  });

  it('names a scene that will not build, in the driver’s words', async () => {
    const { worker, measure } = setup();
    const answer = measure(pack);
    await asked(worker);
    worker.reply({
      kind: 'flash',
      id: 1,
      log: "ERROR: 'x' : undeclared identifier",
    });
    await expect(answer).resolves.toEqual({
      ok: false,
      reason: 'compile',
      log: "ERROR: 'x' : undeclared identifier",
    });
  });

  it('says unavailable when the machine cannot draw it, or the demo cannot be read', async () => {
    const drawn = setup();
    const answer = drawn.measure(pack);
    await asked(drawn.worker);
    drawn.worker.reply({ kind: 'flash', id: 1, refused: 'too-heavy' });
    await expect(answer).resolves.toEqual({ ok: false, reason: 'unavailable' });

    const noMusic = setup({ readMusic: async () => undefined });
    await expect(noMusic.measure(pack)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(noMusic.worker.sent).toEqual([]);
  });

  it('stops when the page walks away, ending its worker', async () => {
    const { worker, measure } = setup();
    const leave = new AbortController();
    const answer = measure(pack, { signal: leave.signal });
    await asked(worker);
    leave.abort();
    await expect(answer).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(worker.terminated).toBe(true);
    // The control: a late answer changes nothing.
    worker.reply({ kind: 'flash', id: 1, summary: SUMMARY });
    await expect(answer).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('starts nothing for a page that has already gone', async () => {
    const { worker, measure } = setup();
    const gone = new AbortController();
    gone.abort();
    await expect(measure(pack, { signal: gone.signal })).resolves.toEqual({
      ok: false,
      reason: 'aborted',
    });
    expect(worker.sent).toEqual([]);
  });
});

describe('how much of the demo is measured', () => {
  it('plays one pass, a minute at most, and a short loop twice', () => {
    expect(demoSecondsToMeasure(45)).toBe(45);
    expect(demoSecondsToMeasure(90)).toBe(60);
    expect(demoSecondsToMeasure(20)).toBe(40);
    expect(demoSecondsToMeasure(40)).toBe(40);
  });
});

describe('the filmstrip around the worst moment', () => {
  /** A frame whose every byte is its number, so a kept frame says which it was. */
  const frame = (n: number) => new Uint8Array([n, n, n, n]);

  it('keeps two frames before the worst, the worst and two after, oldest first', () => {
    const keeper = createFilmstripKeeper(4);
    [0.1, 0.2, 0.1, 0.1, 0.9, 0.3, 0.2, 0.1, 0.1].forEach((area, n) =>
      keeper.push(frame(n), area),
    );
    const { frames: kept, worst } = keeper.strip();
    expect(kept.map((bytes) => bytes[0])).toEqual([2, 3, 4, 5, 6]);
    expect(worst).toBe(2);
  });

  it('keeps what there is when the worst comes first', () => {
    const keeper = createFilmstripKeeper(4);
    [0.9, 0.1].forEach((area, n) => keeper.push(frame(n), area));
    const { frames: kept, worst } = keeper.strip();
    expect(kept.map((bytes) => bytes[0])).toEqual([0, 1]);
    expect(worst).toBe(0);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { warmSceneProgram } from '../../../renderer/graph/sceneWorkerClient';
import {
  afterLinkTurns,
  sceneProgramKey,
} from '../../../renderer/graph/sceneLinkTurns';
import { memberPack } from '../../utils/memberSceneFixtures';

/**
 * Warming a scene ahead of time holds the program's link turn, which the
 * graph's own worker and every prebuild queue behind. A worker whose reply
 * could not be decoded, or a send that threw, used to leave without handing
 * the turn back: that scene never finished loading again that session.
 */

type TBehaviour = 'throws-on-send' | 'undecodable-reply';

let behaviour: TBehaviour = 'throws-on-send';
const terminated: string[] = [];

class FakeWorker {
  /** What it was asked to do as it was stopped, for the test to read. */
  readonly behaviour = behaviour;

  onerror: (() => void) | null = null;

  onmessage: ((event: MessageEvent) => void) | null = null;

  onmessageerror: (() => void) | null = null;

  postMessage(message: { kind: string }): void {
    if (behaviour === 'throws-on-send') {
      throw new DOMException('cannot clone', 'DataCloneError');
    }
    if (message.kind === 'load') {
      this.onmessageerror?.();
    }
  }

  terminate(): void {
    terminated.push(this.behaviour);
  }
}

/** Whether a promise has settled once the microtasks in hand have run. */
const settledNow = async (promise: Promise<void>): Promise<boolean> => {
  let settled = false;
  promise
    .then(() => {
      settled = true;
      return undefined;
    })
    .catch(() => undefined);
  for (let turn = 0; turn < 10; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn at a time, nothing else to wait on
    await Promise.resolve();
  }
  return settled;
};

beforeAll(() => {
  Object.assign(globalThis, {
    Worker: FakeWorker,
    // A plain one-by-one canvas: the warming worker only hands it on.
    OffscreenCanvas: function OffscreenCanvasStandIn(this: {
      width: number;
      height: number;
    }) {
      this.width = 1;
      this.height = 1;
    },
  });
});

it.each<TBehaviour>(['throws-on-send', 'undecodable-reply'])(
  'gives the program’s turn back when the warming worker %s',
  async (how) => {
    behaviour = how;
    const pack = memberPack({ source: `// ${how}\nvoid main() {}` });

    await warmSceneProgram(pack, false);

    expect(terminated).toContain(how);
    // The next compile of the same program is not left waiting.
    expect(await settledNow(afterLinkTurns(sceneProgramKey(pack)))).toBe(true);
  },
);

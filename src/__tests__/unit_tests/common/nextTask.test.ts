/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The yield the long analyses give the window between chunks: a task, which
 * a minimised window still runs, and which a cancellation ends at once.
 */

import { MessageChannel as NodeMessageChannel } from 'worker_threads';
import nextTask from 'common/nextTask';

/** A channel whose message never arrives, as behind a window that is gone. */
class SilentChannel {
  static closed = 0;

  port1 = {
    onmessage: null as (() => void) | null,
    close: () => {
      SilentChannel.closed += 1;
    },
  };

  port2 = { postMessage: () => undefined };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'MessageChannel');
  SilentChannel.closed = 0;
});

it('comes back as a task, after every microtask already queued', async () => {
  // Chromium has one; Jest's jsdom does not, and Node's behaves the same.
  Object.assign(globalThis, { MessageChannel: NodeMessageChannel });
  const order: string[] = [];
  const waited = nextTask().then(() => order.push('task'));
  Promise.resolve()
    .then(() => undefined)
    .then(() => order.push('microtasks'));
  await waited;
  expect(order).toEqual(['microtasks', 'task']);
});

it('ends the moment the job is cancelled, whether or not the message comes', async () => {
  Object.assign(globalThis, { MessageChannel: SilentChannel });
  const controller = new AbortController();
  let ended = false;
  const waited = (async () => {
    await nextTask(controller.signal);
    ended = true;
  })();
  await Promise.resolve();
  await Promise.resolve();
  // The control: nothing ends it but the abort.
  expect(ended).toBe(false);
  controller.abort();
  await waited;
  expect(ended).toBe(true);
  expect(SilentChannel.closed).toBe(1);
});

it('ends at once for a job already cancelled, and where there is no channel', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(nextTask(controller.signal)).resolves.toBeUndefined();
  await expect(nextTask()).resolves.toBeUndefined();
});

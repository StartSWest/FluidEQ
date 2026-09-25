/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main following the outputs because Windows said they moved, rather than
 * because the window happened to ask. The window asked every three seconds
 * while it was on screen and never while it was hidden, so a headset plugged
 * in with FluidEQ in the tray kept the speakers' profile. `FluidEQ-Outputs.exe`
 * is mocked here as the child process it is: a stream of `outputs` lines, an
 * input to close, and an exit.
 */

import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import type { IAudioDevice } from '../../../common/constants';

jest.mock('electron', () => ({
  app: { on: jest.fn(), removeListener: jest.fn(), getPath: () => '' },
}));
jest.mock('../../../main/audioDevices', () => ({
  discoverAudioDevices: jest.fn(),
}));

// eslint-disable-next-line import/first
import { startOutputWatch } from '../../../main/outputWatch';

class FakeHelper extends EventEmitter {
  stdout = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });

  stdin = Object.assign(new EventEmitter(), { end: jest.fn() });

  say(text: string) {
    this.stdout.emit('data', text);
  }
}

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{aaaa}',
  isDefault: true,
  isActive: true,
};
const headset: IAudioDevice = { ...speakers, id: 'headset', guid: '{bbbb}' };

const platform = Object.getOwnPropertyDescriptor(process, 'platform');

interface IHarness {
  helpers: FakeHelper[];
  reads: Array<(devices: IAudioDevice[]) => void>;
  read: jest.Mock;
  onOutputs: jest.Mock;
  log: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  wake: () => void;
  stop: () => void;
  start: jest.Mock;
}

const harness = (
  locate: () => string | undefined = () => 'C:\\FluidEQ-Outputs.exe',
): IHarness => {
  const helpers: FakeHelper[] = [];
  const reads: Array<(devices: IAudioDevice[]) => void> = [];
  const read = jest.fn(
    () =>
      new Promise<IAudioDevice[]>((resolve) => {
        reads.push(resolve);
      }),
  );
  const onOutputs = jest.fn();
  const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const start = jest.fn(() => {
    const helper = new FakeHelper();
    helpers.push(helper);
    return helper as unknown as ChildProcessWithoutNullStreams;
  });
  let wake: () => void = () => undefined;
  const { stop } = startOutputWatch({
    onOutputs,
    log,
    read,
    locate,
    start,
    onWake: (callback) => {
      wake = callback;
      return () => {
        wake = () => undefined;
      };
    },
  });
  return {
    helpers,
    reads,
    read,
    onOutputs,
    log,
    wake: () => wake(),
    stop,
    start,
  };
};

/** Lets the reading's own continuations run: read → onOutputs → settle. */
const drain = async () => {
  for (let turn = 0; turn < 8; turn += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

beforeAll(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
});

afterAll(() => {
  if (platform) {
    Object.defineProperty(process, 'platform', platform);
  }
});

it('reads the outputs and hands them on when the helper says they moved', async () => {
  const watch = harness();
  expect(watch.start).toHaveBeenCalledTimes(1);
  expect(watch.read).not.toHaveBeenCalled();

  // Console lines from Windows end in a carriage return.
  watch.helpers[0].say('outputs\r\n');
  expect(watch.read).toHaveBeenCalledTimes(1);
  watch.reads[0]([headset]);
  await drain();

  expect(watch.onOutputs).toHaveBeenCalledWith([headset]);
  watch.stop();
});

it('ignores anything else the helper writes', async () => {
  const watch = harness();
  watch.helpers[0].say('something\n\n');
  await drain();
  expect(watch.read).not.toHaveBeenCalled();
  // Positive control: the word itself, split across two chunks, is read.
  watch.helpers[0].say('outp');
  watch.helpers[0].say('uts\n');
  expect(watch.read).toHaveBeenCalledTimes(1);
  watch.stop();
});

/*
 * A headset plugged in is an endpoint added, its state, the default for up
 * to three roles and several properties: a line each, when the helper cannot
 * collapse them. Each reading is a PowerShell run, so the lines share one
 * reading and queue at most one more.
 */
it('reads once for a burst, and once more for lines that arrive during it', async () => {
  const watch = harness();
  const helper = watch.helpers[0];

  helper.say('outputs\noutputs\noutputs\n');
  expect(watch.read).toHaveBeenCalledTimes(1);

  // Later lines, while that reading is out: it may have missed what they
  // describe, so one more reading is owed — one, however many lines.
  await Promise.resolve();
  helper.say('outputs\n');
  helper.say('outputs\n');
  expect(watch.read).toHaveBeenCalledTimes(1);

  watch.reads[0]([speakers]);
  await drain();
  expect(watch.onOutputs).toHaveBeenCalledTimes(1);
  expect(watch.read).toHaveBeenCalledTimes(2);

  watch.reads[1]([headset]);
  await drain();
  expect(watch.onOutputs).toHaveBeenCalledTimes(2);
  expect(watch.onOutputs).toHaveBeenLastCalledWith([headset]);

  // Positive control: once everything has settled, the next line reads.
  helper.say('outputs\n');
  expect(watch.read).toHaveBeenCalledTimes(3);
  watch.stop();
});

it('starts an ended helper again only when woken, and logs the failure once', async () => {
  const watch = harness();
  watch.helpers[0].emit('exit', 1, null);
  expect(watch.log.warn).toHaveBeenCalledTimes(1);
  // Nothing starts it from its own exit: for a helper that cannot run, that
  // would be a loop.
  await drain();
  expect(watch.start).toHaveBeenCalledTimes(1);

  watch.wake();
  expect(watch.start).toHaveBeenCalledTimes(2);
  // Woken again while it runs: still one helper.
  watch.wake();
  expect(watch.start).toHaveBeenCalledTimes(2);

  // Ending again before it ever spoke is the same trouble, not news.
  watch.helpers[1].emit('exit', 1, null);
  expect(watch.log.warn).toHaveBeenCalledTimes(1);

  // A helper that has spoken since has worked, so its ending is news again.
  watch.wake();
  watch.helpers[2].say('outputs\n');
  watch.helpers[2].emit('exit', 1, null);
  expect(watch.log.warn).toHaveBeenCalledTimes(2);
  watch.stop();
});

it('ends the helper by closing its input, and nothing starts it after', async () => {
  const watch = harness();
  const helper = watch.helpers[0];
  helper.say('outputs\n');

  watch.stop();
  expect(helper.stdin.end).toHaveBeenCalledTimes(1);
  helper.emit('exit', 0, null);
  expect(watch.log.warn).not.toHaveBeenCalled();

  // The reading that was out when it stopped is not followed: the engine's
  // config is being put to rest by then.
  watch.reads[0]([headset]);
  await drain();
  expect(watch.onOutputs).not.toHaveBeenCalled();

  watch.wake();
  expect(watch.start).toHaveBeenCalledTimes(1);
});

it('says once that there is no helper, and starts nothing', () => {
  const watch = harness(() => undefined);
  watch.wake();
  watch.wake();
  expect(watch.start).not.toHaveBeenCalled();
  expect(watch.log.warn).toHaveBeenCalledTimes(1);
  watch.stop();
});

it('does nothing off Windows', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  try {
    const watch = harness();
    expect(watch.start).not.toHaveBeenCalled();
    watch.stop();
  } finally {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  }
});

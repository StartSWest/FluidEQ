/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The memory trace's sentinel files are noticed by watching their folder,
 * never by looking in it every second, which is what it used to do.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import watchTraceSentinels, {
  TRACE_START_FILE,
  TRACE_STOP_FILE,
} from '../../../main/traceSentinels';

const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-trace-'));

it('takes a file already there as it starts, and starts no timer', () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  try {
    const logs = folder();
    fs.writeFileSync(path.join(logs, TRACE_START_FILE), '');
    const start = jest.fn(() => Promise.resolve());
    const stop = watchTraceSentinels(logs, {
      start,
      stop: () => Promise.resolve(),
      isBusy: () => false,
      log: () => undefined,
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(logs, TRACE_START_FILE))).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    stop();
  } finally {
    jest.useRealTimers();
  }
});

it('notices a file dropped later, on the folder saying so', async () => {
  const logs = folder();
  const stopped = new Promise<void>((resolve) => {
    const stopWatching = watchTraceSentinels(logs, {
      start: () => Promise.resolve(),
      stop: () => {
        stopWatching();
        resolve();
        return Promise.resolve();
      },
      isBusy: () => false,
      log: () => undefined,
    });
  });
  // Nothing to take yet: the null beside the drop below.
  expect(fs.readdirSync(logs)).toEqual([]);
  fs.writeFileSync(path.join(logs, TRACE_STOP_FILE), '');
  await stopped;
  expect(fs.existsSync(path.join(logs, TRACE_STOP_FILE))).toBe(false);
});

it('leaves a file for later while a start or stop is still in flight', () => {
  const logs = folder();
  fs.writeFileSync(path.join(logs, TRACE_STOP_FILE), '');
  const stop = jest.fn(() => Promise.resolve());
  const stopWatching = watchTraceSentinels(logs, {
    start: () => Promise.resolve(),
    stop,
    isBusy: () => true,
    log: () => undefined,
  });
  expect(stop).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(logs, TRACE_STOP_FILE))).toBe(true);
  stopWatching();
});

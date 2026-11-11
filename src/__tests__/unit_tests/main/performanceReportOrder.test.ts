/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
/** @jest-environment node */

import type { TProcessReading } from '../../../main/performanceLog';

const listeners = new Map<string, (event: unknown, args: unknown) => void>();
const quitHandlers: (() => void)[] = [];
const logged: string[] = [];

jest.mock('electron', () => ({
  app: {
    on: (name: string, handler: () => void) => {
      if (name === 'before-quit') {
        quitHandlers.push(handler);
      }
    },
  },
}));
jest.mock('electron-log', () => ({
  info: (line: string) => logged.push(line),
  warn: jest.fn(),
}));
jest.mock('../../../main/ipc/windowMessages', () => ({
  __esModule: true,
  default: (
    channel: string,
    listener: (event: unknown, args: unknown) => void,
  ) => {
    listeners.set(channel, listener);
    return () => listeners.delete(channel);
  },
}));

// eslint-disable-next-line import/first -- the mocks above come first.
import ChannelEnum from '../../../common/channels';
// eslint-disable-next-line import/first
import {
  registerPerformanceLog,
  writePerformanceReport,
} from '../../../main/ipc/performance';

const window = (cpuSeconds: number): TProcessReading[] => [
  { pid: 2, role: 'window', cpuSeconds, memoryMb: 100 },
];

it('writes a report only after the reading still on its way has been booked', async () => {
  let clock = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  // Each reading waits for the audio service’s answer; these are let go by
  // hand, in the order the test chooses, and the test waits on each request
  // itself rather than on any number of turns.
  const answers: ((processes: TProcessReading[]) => void)[] = [];
  let onAsk: (() => void) | undefined;
  const asked = () =>
    new Promise<void>((resolve) => {
      onAsk = resolve;
    });
  registerPerformanceLog({
    getMainWindow: () => null,
    listProcesses: () =>
      new Promise((resolve) => {
        answers.push(resolve);
        onAsk?.();
      }),
    listProcessesWithoutAsking: () => window(12),
  });
  const screen = listeners.get(ChannelEnum.PERFORMANCE_CONTEXT);
  if (!screen) {
    throw new Error('The performance log listens for the screen');
  }

  let asking = asked();
  screen({}, ['eq look analyzer-auto']);
  await asking;
  asking = asked();
  answers.shift()?.(window(0));
  screen({}, ['dsp look analyzer-auto']); // asked once the EQ is booked
  await asking;

  clock = 60_000;
  asking = asked();
  const report = writePerformanceReport();
  // The report has not asked for anything: it waits its turn.
  expect(answers).toHaveLength(1);
  answers.shift()?.(window(6));
  await asking;
  answers.shift()?.(window(6));
  await report;

  // The minute on the EQ, booked before the report was written.
  expect(logged).toEqual([
    'Performance: eq look analyzer-auto for 1.0 min, 10.0% of one core (window 10.0%), up to 100 MB',
  ]);

  // Quitting waits for nobody: its report is written there and then.
  clock = 120_000;
  quitHandlers.forEach((handler) => handler());
  expect(logged).toHaveLength(2);
  expect(logged[1]).toBe(
    'Performance: dsp look analyzer-auto for 1.0 min, 10.0% of one core (window 10.0%), up to 100 MB',
  );
});

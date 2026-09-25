/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The registry half of the game scan ends when its PowerShell does, never on
 * a clock.
 *
 * It was killed after 20 s, which on a machine whose registry or disk answered
 * slowly threw away every launcher-registered game for that scan. Now the
 * script's input is closed as it starts, so nothing it might read can keep it
 * waiting, and its own exit is what settles the scan.
 */

import type { PassThrough } from 'stream';

interface IRun {
  file: string;
  options: Record<string, unknown>;
  stdin: PassThrough;
  finish: (stdout: string) => void;
}

const mockRuns: IRun[] = [];

jest.mock('child_process', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- inside a hoisted factory
  const { promisify } = require('util') as typeof import('util');
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- inside a hoisted factory
  const stream = require('stream') as typeof import('stream');
  const execFile = Object.assign(jest.fn(), {
    // What `promisify(execFile)` returns in Node: the promise, with the child
    // hung on it.
    [promisify.custom]: (
      file: string,
      _args: string[],
      options: Record<string, unknown>,
    ) => {
      const stdin = new stream.PassThrough();
      let finish: (stdout: string) => void = () => undefined;
      const answered = new Promise((resolve) => {
        finish = (stdout) => resolve({ stdout, stderr: '' });
      });
      mockRuns.push({ file, options, stdin, finish });
      return Object.assign(answered, { child: { stdin } });
    },
  });
  return { execFile };
});

// eslint-disable-next-line import/first -- the process boundary is installed first
import { scanGameLibraries } from '../../../main/gameScan';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

beforeEach(() => {
  mockRuns.length = 0;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
});

afterEach(() => {
  jest.useRealTimers();
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

it('runs the script with no deadline and its input closed, and waits for its answer', async () => {
  let games: unknown;
  const scanning = scanGameLibraries().then((found) => {
    games = found;
    return found;
  });
  await Promise.resolve();
  expect(mockRuns).toHaveLength(1);
  const [run] = mockRuns;
  expect(run.options).not.toHaveProperty('timeout');
  expect(run.stdin.writableEnded).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  // Not answered until the script is.
  await Promise.resolve();
  expect(games).toBeUndefined();
  run.finish(
    'WARNING: noise first\r\n{"games":[{"name":"Quake","path":"D:\\\\Games\\\\Quake","source":"ea"}]}\r\n',
  );
  await scanning;
  expect(games).toEqual([
    { name: 'Quake', path: 'D:\\Games\\Quake', source: 'ea' },
  ]);
});

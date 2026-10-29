/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a sign-in launch may stay in the tray on Linux: only where the
 * desktop runs a StatusNotifierWatcher, the thing that draws Electron's tray
 * icon. Every way of not knowing answers "no", so the window opens — FluidEQ
 * running with no window and no icon would have nothing to open it from.
 */

const mockExecFile = jest.fn();

// The real execFile carries a custom promisify that resolves to
// { stdout, stderr }; the mock has to as well, or promisify hands back the
// bare stdout and the module under test reads no answer at all.
jest.mock('child_process', () => {
  const { promisify } = jest.requireActual<typeof import('util')>('util');
  const execFile = (...args: unknown[]) => mockExecFile(...args);
  Object.defineProperty(execFile, promisify.custom, {
    value: (file: string, args: string[]) =>
      new Promise((resolve, reject) => {
        mockExecFile(
          file,
          args,
          (error: Error | null, stdout: string, stderr: string) =>
            error ? reject(error) : resolve({ stdout, stderr }),
        );
      }),
  });
  return { execFile };
});

/* eslint-disable import/first -- install the mock first */
import linuxTrayIsShown from '../../../main/linux/linuxTrayHost';
/* eslint-enable import/first */

type TCallback = (error: Error | null, stdout: string, stderr: string) => void;

const answers = (error: Error | null, stdout = '') =>
  mockExecFile.mockImplementation(
    (_file: string, _args: string[], callback: TCallback) =>
      callback(error, stdout, ''),
  );

beforeEach(() => {
  mockExecFile.mockReset();
});

describe('whether this desktop draws tray icons', () => {
  it('says yes when the session bus has a StatusNotifierWatcher', async () => {
    answers(null, '(true,)\n');
    await expect(linuxTrayIsShown()).resolves.toBe(true);
    const [file, args] = mockExecFile.mock.calls[0];
    expect(file).toBe('gdbus');
    expect(args).toContain('--session');
    expect(args).toContain('org.kde.StatusNotifierWatcher');
  });

  it('says no on a desktop with no watcher', async () => {
    answers(null, '(false,)\n');
    await expect(linuxTrayIsShown()).resolves.toBe(false);
  });

  it('says no when the bus cannot be asked', async () => {
    answers(new Error('spawn gdbus ENOENT'));
    await expect(linuxTrayIsShown()).resolves.toBe(false);
  });
});

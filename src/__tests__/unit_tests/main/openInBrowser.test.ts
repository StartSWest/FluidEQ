/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A link handed to the system. On Linux every FluidEQ process carries
 * no-new-privileges, under which a snap browser (Ubuntu's Firefox) cannot
 * start, so the opener runs from the user's systemd instead of as the app's
 * child; elsewhere it is Electron's own `shell.openExternal`.
 */

const mockOpenExternal = jest.fn().mockResolvedValue(undefined);
const mockExecFile = jest.fn();

jest.mock('electron', () => ({
  shell: { openExternal: (url: string) => mockOpenExternal(url) },
}));
jest.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

/* eslint-disable import/first -- install the mocks first */
import openInBrowser from '../../../main/openInBrowser';
/* eslint-enable import/first */

type TCallback = (error: Error | null) => void;

const platform = Object.getOwnPropertyDescriptor(process, 'platform');
const onPlatform = (value: NodeJS.Platform) =>
  Object.defineProperty(process, 'platform', { value });

afterEach(() => {
  mockExecFile.mockReset();
  mockOpenExternal.mockClear();
  if (platform) {
    Object.defineProperty(process, 'platform', platform);
  }
});

describe('opening a link', () => {
  it('on Linux, starts the opener from the user’s systemd, never as the app’s child', async () => {
    onPlatform('linux');
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], done: TCallback) => done(null),
    );

    await openInBrowser('https://accounts.google.com/o/oauth2/v2/auth?x=1');

    const [file, args] = mockExecFile.mock.calls[0];
    expect(file).toBe('systemd-run');
    expect(args).toContain('--user');
    expect(args).toContain('--property=ExitType=cgroup');
    expect(args.slice(args.indexOf('--') + 1)).toEqual([
      'xdg-open',
      'https://accounts.google.com/o/oauth2/v2/auth?x=1',
    ]);
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });

  it('on Linux, rejects when the opener could not be started', async () => {
    onPlatform('linux');
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], done: TCallback) =>
        done(new Error('spawn systemd-run ENOENT')),
    );

    await expect(openInBrowser('https://fluideq.com')).rejects.toThrow(
      /ENOENT/,
    );
  });

  it('elsewhere, is Electron’s own', async () => {
    onPlatform('win32');

    await openInBrowser('https://fluideq.com');

    expect(mockOpenExternal).toHaveBeenCalledWith('https://fluideq.com');
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

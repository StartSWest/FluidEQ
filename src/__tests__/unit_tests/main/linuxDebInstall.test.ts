/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A .deb update's dpkg, run outside FluidEQ's processes: every one of them
 * carries no-new-privileges, under which pkexec cannot gain root, so the
 * command goes through the user's systemd, which starts it without the flag.
 */

const mockExecFileSync = jest.fn();

jest.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

/* eslint-disable import/first -- install the mock first */
import installDebsOutsideApp, {
  runOutsideApp,
} from '../../../main/linux/linuxDebInstall';
/* eslint-enable import/first */

beforeEach(() => {
  mockExecFileSync.mockReset();
});

describe('installing a .deb update', () => {
  it('asks for root through the user’s systemd, never as the app’s child', () => {
    mockExecFileSync.mockReturnValue('');

    runOutsideApp(['dpkg', '-i', '/home/me/.cache/x/FluidEQ-2.2.1-amd64.deb']);

    const [file, args] = mockExecFileSync.mock.calls[0];
    expect(file).toBe('systemd-run');
    expect(args.slice(0, 2)).toEqual(['--user', '--wait']);
    const split = args.indexOf('--');
    expect(args.slice(split + 1)).toEqual([
      'pkexec',
      '--disable-internal-agent',
      '/bin/bash',
      '-c',
      'dpkg -i /home/me/.cache/x/FluidEQ-2.2.1-amd64.deb',
    ]);
  });

  it('fails the install when the prompt is refused', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Command failed: systemd-run (exit 126)');
    });

    expect(() => runOutsideApp(['dpkg', '-i', '/x.deb'])).toThrow(/exit 126/);
  });

  it('replaces the updater’s own root runner', () => {
    const own = jest.fn();
    const updater = { runCommandWithSudoIfNeeded: own };
    const run = jest.fn().mockReturnValue('');

    installDebsOutsideApp(updater, run);
    updater.runCommandWithSudoIfNeeded(['dpkg', '-i', '/x.deb']);

    expect(run).toHaveBeenCalledWith([
      'apt-get',
      'install',
      '--assume-yes',
      '--',
      '/x.deb',
    ]);
    expect(own).not.toHaveBeenCalled();
  });

  it('keeps a downgrade/password refusal from becoming a successful dependency repair', () => {
    const updater = { runCommandWithSudoIfNeeded: (_command: string[]) => '' };
    const failure = new Error('apt refused the downgrade');
    const run = jest.fn().mockImplementation(() => {
      throw failure;
    });
    installDebsOutsideApp(updater, run);
    expect(() =>
      updater.runCommandWithSudoIfNeeded(['dpkg', '-i', '/old.deb']),
    ).toThrow(failure);
    expect(() =>
      updater.runCommandWithSudoIfNeeded(['apt-get', 'install', '-f', '-y']),
    ).toThrow(failure);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('removes electron-updater’s apt downgrade and authentication bypass flags', () => {
    const updater = { runCommandWithSudoIfNeeded: (_command: string[]) => '' };
    const run = jest.fn().mockReturnValue('installed');
    installDebsOutsideApp(updater, run);
    expect(
      updater.runCommandWithSudoIfNeeded([
        'apt',
        'install',
        '-y',
        '--allow-downgrades',
        '--allow-unauthenticated',
        '/new.deb',
      ]),
    ).toBe('installed');
    expect(run).toHaveBeenCalledWith([
      'apt-get',
      'install',
      '--assume-yes',
      '--',
      '/new.deb',
    ]);
  });

  it('lets a new install attempt succeed after the previous password was cancelled', () => {
    const updater = { runCommandWithSudoIfNeeded: (_command: string[]) => '' };
    const run = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('cancelled');
      })
      .mockReturnValue('installed');
    installDebsOutsideApp(updater, run);
    expect(() =>
      updater.runCommandWithSudoIfNeeded(['dpkg', '-i', '/new.deb']),
    ).toThrow('cancelled');
    expect(() =>
      updater.runCommandWithSudoIfNeeded(['apt-get', 'install', '-f', '-y']),
    ).toThrow('cancelled');
    expect(updater.runCommandWithSudoIfNeeded(['dpkg', '-i', '/new.deb'])).toBe(
      'installed',
    );
    expect(run).toHaveBeenCalledTimes(2);
  });
});

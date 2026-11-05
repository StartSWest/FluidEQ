/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFileSync } from 'child_process';

type TRunAsRoot = (command: string[]) => string;

/**
 * Runs a .deb update's package manager outside FluidEQ's own processes.
 *
 * electron-updater runs `dpkg -i` through `pkexec`, the desktop's password
 * prompt, as a child of the app — and every FluidEQ process carries the
 * kernel's no-new-privileges flag: the .deb installs an AppArmor profile
 * instead of a setuid `chrome-sandbox`, so Chromium runs its user-namespace
 * sandbox, which sets the flag on the whole app. A setuid program started
 * under that flag does not gain root, so pkexec refused at once ("pkexec must
 * be setuid root", exit 127) and Restart now did nothing (2026-10-29, the
 * first 2.2.0 → 2.2.1 update). The flag is inherited and can never be
 * cleared, so the command goes to the user's own systemd instead, which
 * starts it as a unit of its own, without the flag; `--wait --pipe` keeps the
 * call synchronous with its output and exit status, which is what
 * electron-updater's install expects. polkit finds the password prompt for a
 * process with no login session through the user's graphical session.
 */
export const runOutsideApp: TRunAsRoot = (command) =>
  execFileSync(
    'systemd-run',
    [
      '--user',
      '--wait',
      '--pipe',
      '--quiet',
      '--collect',
      '--',
      'pkexec',
      '--disable-internal-agent',
      '/bin/bash',
      '-c',
      // Each part is already escaped for a shell by electron-updater (its
      // `installerPath`), which is how its own runner hands them to bash.
      command.join(' '),
    ],
    { encoding: 'utf8' },
  );

/**
 * Point a .deb updater's root commands at `runOutsideApp`. The method is
 * electron-updater's own (`LinuxUpdater.runCommandWithSudoIfNeeded`); its
 * dpkg, and the apt-get it falls back to, both go through it.
 */
const installDebsOutsideApp = (
  updater: object,
  run: TRunAsRoot = runOutsideApp,
): void => {
  let installationError: unknown;
  const install = (command: string[]) => {
    // An apt upgrade may have installed a newer release while this running
    // copy downloaded its update. apt's locked transaction refuses a
    // downgrade with --assume-yes unless --allow-downgrades is present.
    // Also let apt resolve the renamed package's Breaks/Replaces together.
    if (command[0] === 'apt-get' && installationError) {
      throw installationError;
    }
    const installer = command[command.length - 1];
    if (
      !['dpkg', 'apt'].includes(command[0]) ||
      !installer?.startsWith('/') ||
      !installer.endsWith('.deb')
    ) {
      throw new Error('The Linux update does not name a Debian installer.');
    }
    // A new user attempt may follow a cancelled password prompt. Only the
    // dependency-repair fallback from the same failed attempt is suppressed.
    installationError = undefined;
    try {
      return run(['apt-get', 'install', '--assume-yes', '--', installer]);
    } catch (error) {
      // DebUpdater catches a failed dpkg call and invokes apt-get -f alone.
      // That repair can succeed without installing this update; keep the
      // original refusal instead of reporting a successful replacement.
      installationError = error;
      throw error;
    }
  };
  Object.assign(updater, { runCommandWithSudoIfNeeded: install });
};

export default installDebsOutsideApp;

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
  Object.assign(updater, { runCommandWithSudoIfNeeded: run });
};

export default installDebsOutsideApp;

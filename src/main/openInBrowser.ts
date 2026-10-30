/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFile } from 'child_process';
import { shell } from 'electron';

/**
 * Hands a URL to the system, the way `shell.openExternal` does — except on
 * Linux, where that cannot work from inside FluidEQ.
 *
 * Every FluidEQ process on Linux carries the kernel's no-new-privileges flag
 * (Chromium's user-namespace sandbox sets it; `linux/linuxDebInstall.ts` says
 * why it is that sandbox), and `shell.openExternal` starts `xdg-open` as the
 * app's child. Ubuntu's Firefox is a snap, and a snap starts through
 * `snap-confine`, which needs privileges the flag forbids: it refused
 * ("snap-confine is packaged without necessary permissions"), xdg-open
 * reported nothing back, and Sign in with Google — and every other link the
 * app opens — did nothing at all (2026-10-29). So on Linux the user's own
 * systemd starts `xdg-open` as a unit of its own, without the flag, the way a
 * click in the desktop would. `ExitType=cgroup` keeps that unit, and a
 * browser it started that does not move itself elsewhere, alive after
 * xdg-open returns, instead of being stopped with it.
 *
 * Resolves once the opener has been handed the URL, and rejects if it could
 * not be started, as `shell.openExternal` does.
 */
const openInBrowser = (url: string): Promise<void> => {
  if (process.platform !== 'linux') {
    return shell.openExternal(url);
  }
  return new Promise((resolve, reject) => {
    execFile(
      'systemd-run',
      [
        '--user',
        '--collect',
        '--quiet',
        '--property=ExitType=cgroup',
        '--',
        'xdg-open',
        url,
      ],
      (error) => (error ? reject(error) : resolve()),
    );
  });
};

export default openInBrowser;

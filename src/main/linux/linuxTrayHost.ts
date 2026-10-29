/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Whether this desktop draws tray icons, asked before a sign-in launch stays
 * in the tray. Started there on a desktop that draws none, FluidEQ would run
 * with no window and nothing to open one from.
 *
 * Electron's tray on Linux is a StatusNotifierItem, which only a desktop
 * running a StatusNotifierWatcher draws: KDE, Cinnamon, Ubuntu's GNOME through
 * its AppIndicator extension, Xfce with its plugin. Plain GNOME runs none.
 * Without one Chromium falls back to an XEmbed icon that a few older panels
 * still draw; those are answered "no" here, and the window opens as it did
 * before the tray's word existed — the safe way to be wrong.
 *
 * `gdbus` ships with GLib, which every desktop Electron runs on has. Not
 * found, or the session bus not answering, is also "no".
 */
const linuxTrayIsShown = async (): Promise<boolean> => {
  try {
    const { stdout } = await execFileAsync('gdbus', [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.DBus',
      '--object-path',
      '/org/freedesktop/DBus',
      '--method',
      'org.freedesktop.DBus.NameHasOwner',
      'org.kde.StatusNotifierWatcher',
    ]);
    return stdout.trim() === '(true,)';
  } catch {
    // No gdbus or no session bus: nothing says a tray icon would be seen.
    return false;
  }
};

export default linuxTrayIsShown;

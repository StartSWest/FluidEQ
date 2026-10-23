/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import { PRODUCT_NAME } from '../common/branding';

/**
 * The name Linux shows for FluidEQ: FluidEQ, never "electron".
 *
 * Linux names a process after the file it was started from. A release's file
 * is FluidEQ (`build.linux.executableName`), so every one of its processes
 * says so. In development the file is `node_modules/electron/dist/electron`
 * and cannot be renamed: Electron decides `app.isPackaged` from its basename
 * (`name-dev-electron.ts`). So here:
 *
 *  - the main process renames itself (`process.title`, which libuv also hands
 *    to `prctl(PR_SET_NAME)`, the name the system monitor reads). Its helper
 *    processes keep the binary's name: Electron starts them from the binary
 *    itself whatever `browser-subprocess-path` says (tried, 2026-10-23);
 *  - the window says it is `fluideq-dev`, a launcher `name-dev-electron.ts`
 *    writes with FluidEQ's name and icon, so GNOME's top bar, dock and
 *    switcher show FluidEQ rather than Electron. A release's window says
 *    `fluideq-app`, from `desktopName`, which its package installs.
 *
 * Before any window exists: the window's id is read when it is created.
 */
export const DEV_DESKTOP_NAME = 'fluideq-dev.desktop';

const applyLinuxIdentity = () => {
  if (process.platform !== 'linux') {
    return;
  }
  process.title = PRODUCT_NAME;
  if (!app.isPackaged) {
    app.setDesktopName(DEV_DESKTOP_NAME);
  }
};

export default applyLinuxIdentity;

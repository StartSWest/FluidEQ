/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import type { IStartWithWindows } from './startWithWindows';

/**
 * Whether macOS opens FluidEQ at login: the Mac's half of the tools menu's
 * startup row (`startWithWindows.ts` is the Windows half).
 *
 * Nothing is stored by the app. On macOS 13 and up Electron registers the app
 * itself as a login item (`SMAppService.mainApp`), and macOS holds the answer.
 * A Mac login item carries no arguments, so the Windows word
 * (`--start-in-tray`) cannot say the launch came from login; macOS says so
 * instead, through `wasOpenedAtLogin` (`wasOpenedAtMacLogin` below).
 *
 * The one thing that can go wrong in macOS's hands rather than ours: a new
 * login item can wait for the person's approval in System Settings → General
 * → Login Items. The row shows that instead of a switch that is on and does
 * nothing (`needsApproval`).
 */

const isMac = () => process.platform === 'darwin';

/**
 * In development the running bundle is Electron's own, and registering it
 * would open an empty Electron at every login: development reads as
 * unavailable, writes nothing, and the row is not shown (as on Windows).
 */
const UNAVAILABLE: IStartWithWindows = {
  on: false,
  blockedByWindows: false,
  unavailable: true,
};

export const readOpenAtLoginMac = (): IStartWithWindows => {
  if (!app.isPackaged) {
    return UNAVAILABLE;
  }
  const { openAtLogin, status } = app.getLoginItemSettings();
  const needsApproval = status === 'requires-approval';
  return {
    on: openAtLogin || needsApproval,
    blockedByWindows: false,
    ...(needsApproval ? { needsApproval } : {}),
  };
};

export const writeOpenAtLoginMac = (
  wanted: boolean,
  logger?: { error(message: string, ...details: unknown[]): void },
): IStartWithWindows => {
  if (!app.isPackaged) {
    return UNAVAILABLE;
  }
  try {
    app.setLoginItemSettings({ openAtLogin: wanted });
  } catch (error) {
    logger?.error('Could not change whether FluidEQ opens at login', error);
    return { ...readOpenAtLoginMac(), failed: true };
  }
  // Read back rather than believing the write, as on Windows.
  const now = readOpenAtLoginMac();
  return now.on === wanted ? now : { ...now, failed: true };
};

let openedAtLogin: boolean | undefined;

/**
 * macOS opened this launch at login: FluidEQ starts hidden, applying its
 * sound, and the menu bar icon or the Dock opens the window. Read once, after
 * the app is ready, and remembered for the rest of the launch.
 */
export const wasOpenedAtMacLogin = (): boolean => {
  if (openedAtLogin === undefined) {
    openedAtLogin =
      isMac() &&
      app.isPackaged &&
      app.getLoginItemSettings().wasOpenedAtLogin === true;
  }
  return openedAtLogin;
};

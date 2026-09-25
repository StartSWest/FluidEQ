/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import type { BrowserWindow } from 'electron';
import log from 'electron-log';

/** `DWMWINDOWATTRIBUTE`: Windows' own window transitions forced off, or not. */
const DWMWA_TRANSITIONS_FORCEDISABLED = 3;

/** `DWMWINDOWATTRIBUTE`: the window taken off the screen, still composed. */
const DWMWA_CLOAK = 13;

type TSetWindowAttribute = (
  window: bigint,
  attribute: number,
  value: Buffer,
  size: number,
) => number;

let setWindowAttribute: TSetWindowAttribute | undefined;

const bindSetWindowAttribute = (): TSetWindowAttribute => {
  if (!setWindowAttribute) {
    // A native dependency, external to webpack and loaded only on Windows.
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi');
    const dwm = koffi.load(
      path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'dwmapi.dll',
      ),
    );
    setWindowAttribute = dwm.func(
      'int32_t __stdcall DwmSetWindowAttribute(void *window, uint32_t attribute, void *value, uint32_t size)',
    ) as TSetWindowAttribute;
  }
  return setWindowAttribute;
};

/**
 * Sets one of the window's DWM switches, a Win32 BOOL. Answers whether it
 * took: everything here is how the window looks, so a failure is logged and
 * the caller carries on as if the switch did not exist.
 */
const setDwmSwitch = (
  win: BrowserWindow,
  attribute: number,
  isOn: boolean,
): boolean => {
  if (
    process.platform !== 'win32' ||
    win.isDestroyed() ||
    typeof win.getNativeWindowHandle !== 'function'
  ) {
    return false;
  }
  const handle = win.getNativeWindowHandle();
  const hwnd =
    handle.length === 8
      ? handle.readBigUInt64LE()
      : BigInt(handle.readUInt32LE());
  const value = Buffer.alloc(4);
  value.writeInt32LE(isOn ? 1 : 0);
  try {
    const result = bindSetWindowAttribute()(
      hwnd,
      attribute,
      value,
      value.length,
    );
    if (result !== 0) {
      log.warn(
        `DWM attribute ${attribute} not set to ${isOn}: DwmSetWindowAttribute returned ${result}`,
      );
    }
    return result === 0;
  } catch (error) {
    log.warn(`DWM attribute ${attribute} could not be set`, error);
    return false;
  }
};

/**
 * Windows' own animation for maximising and restoring the window, off for the
 * length of a switch between the app and the player, and on again after it.
 *
 * The switch restores a maximised app before it shrinks the window to the
 * player, and maximises it again on the way back, and Windows animates both
 * out of a picture of the window taken at that moment — which, halfway through
 * the switch, is the other mode's view. Grown out of that picture, the app
 * came up with the player's dark rectangle standing in its corner (Ivan,
 * 2026-09-22: "I can see the dark app on the left while the full app is
 * growing").
 */
export const setWindowTransitions = (
  win: BrowserWindow,
  isOn: boolean,
): boolean => setDwmSwitch(win, DWMWA_TRANSITIONS_FORCEDISABLED, !isOn);

/**
 * The window off the screen, or back on it. Cloaked, a window is still
 * composed — it keeps drawing, takes a new size, even maximises — and nobody
 * sees any of it: measured on Electron 43, a cloaked window's page kept
 * `visible`, ran its animation frames and heard every resize. Its place in
 * the taskbar and its focus stay as they were.
 */
export const setWindowCloaked = (
  win: BrowserWindow,
  isCloaked: boolean,
): boolean => setDwmSwitch(win, DWMWA_CLOAK, isCloaked);

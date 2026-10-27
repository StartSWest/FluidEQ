/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * "Tint app icon": the taskbar button and the tray icon in the window's
 * colours, or FluidEQ's own icon (Ivan, 2026-10-26: "we need a toggle if user
 * wants to tint the icon with theme or keep the original", "default is off").
 *
 * Off unless somebody switched it on, and off again after Reset all settings,
 * which clears the key (`settingsReset.ts`). One setting wherever its switch
 * stands — the app menu, Window colours, the Compact player's menu — so every
 * copy reads and writes this.
 */
export const APP_ICON_TINT_KEY = 'fluideq.appIconTint';

const listeners = new Set<() => void>();

let isTinted = false;
try {
  isTinted = window.localStorage.getItem(APP_ICON_TINT_KEY) === 'on';
} catch {
  // Storage can be unavailable: the original icon, the default.
}

export const isAppIconTinted = () => isTinted;

export const setAppIconTinted = (next: boolean) => {
  if (next === isTinted) {
    return;
  }
  isTinted = next;
  try {
    window.localStorage.setItem(APP_ICON_TINT_KEY, next ? 'on' : 'off');
  } catch {
    // The current session still follows the choice.
  }
  listeners.forEach((listener) => listener());
};

export const subscribeAppIconTint = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useIsAppIconTinted = () =>
  useSyncExternalStore(subscribeAppIconTint, isAppIconTinted, () => false);

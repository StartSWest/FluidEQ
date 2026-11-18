/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which side of the Brightness the window is on, for the scripts that draw:
 * true on a light window, the one that wears `data-window-ink="dark"`.
 *
 * Told by the attribute's one writer at the moment it writes it
 * (`sceneTintStore.ts`'s `showInk`, and `theme.ts` for the first frame), so a
 * palette or a drawing never reads the side of the window from a paint that
 * has not happened yet, and never asks the document every frame.
 */

import { useSyncExternalStore } from 'react';

let isLight = false;
const listeners = new Set<() => void>();

export const isLightWindow = (): boolean => isLight;

export const setLightWindow = (next: boolean): void => {
  if (next === isLight) {
    return;
  }
  isLight = next;
  listeners.forEach((listener) => listener());
};

export const subscribeWindowSide = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The side, for a component that draws differently on each. */
export const useLightWindow = (): boolean =>
  useSyncExternalStore(subscribeWindowSide, isLightWindow, () => false);

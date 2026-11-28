/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Whether the pet sits on the amp's picture (Ivan, 2026-11-27: "B but add
 * option to show and hide pet in the menu of the amp"). Shown until the
 * listener hides her, and remembered across launches.
 */
const PET_KEY = 'fluideq.player.petShown';

const read = (): boolean => {
  try {
    return window.localStorage.getItem(PET_KEY) !== 'false';
  } catch {
    // Storage can be refused; she is shown, as on a first launch.
    return true;
  }
};

let isShown = read();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePlayerPetShown = () =>
  useSyncExternalStore(subscribe, () => isShown);

export const setPlayerPetShown = (next: boolean) => {
  isShown = next;
  try {
    window.localStorage.setItem(PET_KEY, String(next));
  } catch {
    // Remembered where storage allows; the amp shows what was asked either way.
  }
  listeners.forEach((listener) => listener());
};

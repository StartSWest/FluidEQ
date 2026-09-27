/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStoredFlag, writeStored } from './graphStorage';

/**
 * Whether the sound panel on the right — the output, its profiles, the second
 * output, the driver — is folded to its rail (Ivan, 2026-09-27: "make right
 * side pane collapsible nicely with animation … when studio opens it auto
 * collapses and when studio closes it restores back").
 *
 * Two answers kept apart: what the member chose, remembered across launches,
 * and a hold the Studio puts on it while its bench is on screen. The Studio
 * wants the width for the stage, not the member's preference changed: it
 * folds the panel when it opens and gives back exactly what was there when
 * it closes. Unfolding it by hand while the Studio holds it is the member's
 * say for that visit, and the hold's end still puts back what they had
 * before the Studio opened, which is the only state they chose on purpose.
 */

const STORAGE_KEY = 'fluideq.soundPaneFolded';

let chosen = readStoredFlag(STORAGE_KEY);
/** Set while the Studio holds the panel: the member's choice to go back to. */
let beforeHold: boolean | undefined;
let folded = chosen;

const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  if (next === folded) {
    return;
  }
  folded = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The fold button: remembered, unless the Studio holds the panel. */
export const setSoundPaneFolded = (next: boolean) => {
  if (beforeHold === undefined) {
    chosen = next;
    writeStored(STORAGE_KEY, String(next));
  }
  publish(next);
};

/** The Studio's bench came on screen: fold, remembering what was there. */
export const holdSoundPaneForStudio = () => {
  if (beforeHold !== undefined) {
    return;
  }
  beforeHold = chosen;
  publish(true);
};

/** The Studio's bench went away: put back what the member had. */
export const releaseSoundPaneFromStudio = () => {
  if (beforeHold === undefined) {
    return;
  }
  const back = beforeHold;
  beforeHold = undefined;
  publish(back);
};

export const useSoundPaneFolded = (): boolean =>
  useSyncExternalStore(subscribe, () => folded);

/** For tests: back to the stored choice, with no hold. */
export const resetSoundPaneForTesting = () => {
  chosen = readStoredFlag(STORAGE_KEY);
  beforeHold = undefined;
  folded = chosen;
};

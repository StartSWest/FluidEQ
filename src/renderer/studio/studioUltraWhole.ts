/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Whether the ultra-wide view shows its whole window at full strength
 * (`StudioUltraWideFrame`): one answer for every place the view is drawn -
 * the stage, the publish dialog, a review - so a press in one is what the
 * next one opened shows. Kept for the sitting only: every start goes back
 * to the graph leading, which is the view's point.
 */

let whole = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useUltraWholeShown = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => whole,
    () => false,
  );

export const toggleUltraWhole = () => {
  whole = !whole;
  listeners.forEach((listener) => listener());
};

/** For tests: the graph leading again, as at a start. */
export const resetUltraWholeForTesting = () => {
  whole = false;
  listeners.forEach((listener) => listener());
};

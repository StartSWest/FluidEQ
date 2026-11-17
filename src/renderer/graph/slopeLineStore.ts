/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * WHEN THE ANALYSER'S SLOPE LINE IS SHOWN (`SlopeLine`): played once —
 * shown, held a moment, faded — whenever the slope is changed, or the
 * corner legend is shown or opened; held up for as long as the pointer is
 * on the legend's slope row. How long it holds and fades is its animation's
 * (`_graphThemeChart.scss`), never a clock here.
 */
interface ISlopeLineState {
  /** Bumped for every play, so a play mid-fade starts it over. */
  play: number;
  isHeld: boolean;
}

let state: ISlopeLineState = { play: 0, isHeld: false };
const listeners = new Set<() => void>();

const publish = (next: ISlopeLineState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Show the line once: shown, held a moment, faded. */
export const playSlopeLine = () => publish({ ...state, play: state.play + 1 });

/** Hold it up (the legend's row under the pointer), or let it go. */
export const holdSlopeLine = (isHeld: boolean) => {
  if (state.isHeld !== isHeld) {
    publish({ ...state, isHeld });
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSlopeLine = (): ISlopeLineState =>
  useSyncExternalStore(subscribe, () => state);

/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useSyncExternalStore } from 'react';

/**
 * Whether this install has ever reached the ceiling.
 *
 * Persisted, and deliberately one-way: thirty-six consecutive perfect taps is
 * the price of admission, and it is paid once. Afterwards the mode is a switch
 * on the meter rather than something to be re-earned every session — nobody
 * wants to grind back to a colour scheme they have already proved they can
 * reach.
 */
const REACHED_KEY = 'fluideq-euphoria-reached';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let reached = false;
try {
  reached = window.localStorage.getItem(REACHED_KEY) === 'true';
} catch {
  // Storage can be unavailable. The mode is then simply locked for the
  // session, which is the safe direction to fail in.
}

export const hasReachedEuphoria = () => reached;

/** Called the first time a run genuinely earns the ceiling. */
export const markEuphoriaReached = () => {
  if (reached) {
    return;
  }
  reached = true;
  try {
    window.localStorage.setItem(REACHED_KEY, 'true');
  } catch {
    // Unlocked for this session even if it cannot be remembered.
  }
  emit();
};

/**
 * The manual switch, once unlocked.
 *
 * Held in the module rather than storage on purpose. Reaching the ceiling is an
 * achievement and outlives the app; leaving the rainbow switched on is a mood,
 * and an equaliser that reopens in full spectrum every morning because of one
 * click last week is a worse default than starting quiet.
 *
 * COSMETIC ONLY. This turns the look on and nothing else: no multiplier, no
 * points, no streak. The score exists to measure how accurately somebody
 * played, and a switch that granted x10 would make it measure whether they
 * found the switch. Playing with it on works exactly as playing with it off —
 * the run still climbs on real perfect taps, and a score can still be beaten.
 */
let forced = false;

export const isEuphoriaForced = () => forced;

export const setEuphoriaForced = (next: boolean) => {
  if (forced === next || (next && !reached)) {
    // Never forceable before it has been earned. Guarded here rather than only
    // in the UI, so there is one place that decides.
    return;
  }
  forced = next;
  emit();
};

export const toggleEuphoriaForced = () => setEuphoriaForced(!forced);

// Two hooks returning two booleans, rather than one returning both.
//
// `useSyncExternalStore` compares snapshots by identity, so a getter that
// builds `{ reached, forced }` returns a new object every call and re-renders
// forever. Primitives are stable by definition, and most callers only care
// about one of them anyway.

/** Whether the ceiling has ever been reached on this install. */
export const useHasReachedEuphoria = () =>
  useSyncExternalStore(
    subscribe,
    () => reached,
    () => false,
  );

/** Whether the switch is currently on. */
export const useIsEuphoriaForced = () =>
  useSyncExternalStore(
    subscribe,
    () => forced,
    () => false,
  );

/**
 * Reset, for the development affordance that gives the badge back.
 *
 * The unlock has to go with it or "remove badge" leaves the app still offering
 * a mode the fresh state has not earned.
 */
export const resetEuphoriaMode = () => {
  reached = false;
  forced = false;
  try {
    window.localStorage.removeItem(REACHED_KEY);
  } catch {
    // Nothing to undo if it was never written.
  }
  emit();
};

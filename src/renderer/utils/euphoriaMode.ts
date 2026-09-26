/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

/**
 * Euphoria mode: two flags, and they are not the same question.
 *
 *   ACHIEVED — unlocked through play or contribution? Persisted, one-way.
 *   ENABLED  — is the look switched on right now? Persisted preference.
 *
 * They were previously muddled together, and the muddle was a real bug: the
 * mode combined "the current streak is at the ceiling" with "the switch is on"
 * using OR. A streak does not reset when somebody stops playing, so after a
 * genuine run the first half stayed true forever and the switch could not turn
 * anything off. Whoever had just seen the mode for the first time was stuck in
 * it.
 *
 * Winning is therefore an EVENT, not a state to be read continuously. It flips
 * ACHIEVED on permanently and ENABLED on once. After that, ENABLED is the only
 * thing that decides what is painted, and the player owns it.
 *
 * Contribution confirmation uses the same unlock event without changing the
 * score. Neither flag depends on the development preview shortcut.
 *
 * ALWAYS ON NOW (Ivan, 2026-09-26: "rainbow mode is always on", "just make
 * sure is always on and thats it"). Both flags start true, whatever was
 * stored, and nothing turns them off: `setEuphoriaEnabled` refuses `false`
 * and the reset keeps them. What offered the switch — the pill on the top
 * wave, the tour's slide, the Support dialog's offer — is gone, and the rest
 * of this file stays as it was, because everything that draws asks it.
 */

import { useSyncExternalStore } from 'react';

/**
 * ACHIEVED. Persisted and one-way, whether unlocked through play or contribution.
 * Afterwards the mode is a switch, not something to re-earn every session.
 */
const ACHIEVED_KEY = 'fluideq-euphoria-reached';
const ENABLED_KEY = 'fluideq-euphoria-enabled';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Always on: won and switched on from the first frame, whatever was stored.
let achieved = true;

/**
 * ENABLED. Always on, like ACHIEVED above.
 *
 * COSMETIC ONLY. This turns the look on and nothing else: no multiplier, no
 * points, no streak. The score measures how accurately somebody played, and a
 * switch that granted x10 would make it measure whether they found the switch.
 */
let enabled = true;

export const isEuphoriaAchieved = () => achieved;
export const isEuphoriaEnabled = () => enabled;

export const setEuphoriaEnabled = (next: boolean) => {
  if (enabled === next || !next || !achieved) {
    // Never off: the mode is always on. Guarded here rather than only in the
    // UI, so one place decides — Ctrl+E and the development buttons ask too.
    return;
  }
  enabled = next;
  try {
    window.localStorage.setItem(ENABLED_KEY, String(next));
  } catch {
    // The current session still follows the user's choice.
  }
  emit();
};

export const toggleEuphoriaEnabled = () => setEuphoriaEnabled(!enabled);

/**
 * A run hit the ceiling, or the user confirmed a contribution.
 *
 * Unlocks the mode forever and switches it on now, so the moment of winning
 * shows the thing that was won. Called on the transition, never on the
 * condition — see the note at the top of this file for why that distinction is
 * the whole design.
 */
export const winEuphoria = () => {
  const wasAchieved = achieved;
  achieved = true;
  enabled = true;
  if (!wasAchieved) {
    try {
      window.localStorage.setItem(ACHIEVED_KEY, 'true');
    } catch {
      // Unlocked for this session even if it cannot be remembered.
    }
  }
  try {
    window.localStorage.setItem(ENABLED_KEY, 'true');
  } catch {
    // Enabled for this session even if the preference cannot be remembered.
  }
  emit();
};

// Two hooks returning two booleans, rather than one returning both.
//
// `useSyncExternalStore` compares snapshots by identity, so a getter that
// builds `{ achieved, enabled }` returns a new object every call and re-renders
// forever. Primitives are stable by definition, and most callers only care
// about one of them anyway.

/** Whether this install has unlocked Rainbow through play or contribution. */
export const useIsEuphoriaAchieved = () =>
  useSyncExternalStore(
    subscribe,
    () => achieved,
    () => false,
  );

/** Whether the look is switched on right now. */
export const useIsEuphoriaEnabled = () =>
  useSyncExternalStore(
    subscribe,
    () => enabled,
    () => false,
  );

/**
 * Is the app in euphoria? The one answer, for every part of the app.
 *
 * `isEarned` is whether the CURRENT run is at the ceiling, which only matters
 * before the mode has ever been won — that first arrival is the surprise the
 * whole thing is built around, and it has to light up on its own.
 *
 * Afterwards the switch decides and nothing else does. This is the fix for the
 * mode being impossible to turn off: the old rule was `isEarned || enabled`,
 * and since a streak does not reset when somebody stops playing, `isEarned`
 * stayed true forever and the OR held the rainbow on no matter what the switch
 * said.
 *
 * A hook rather than a plain function because both flags live in a store, and
 * a component reading them directly would never re-render when they changed.
 */
export const useIsEuphoric = (isEarned: boolean): boolean => {
  const isAchieved = useIsEuphoriaAchieved();
  const isEnabled = useIsEuphoriaEnabled();
  return isAchieved ? isEnabled : isEarned;
};

/**
 * Whether the app is drawing in euphoria right now, from the root class.
 *
 * That class is the single source of truth the drawing itself uses, and asking
 * it saves a caller from having to know about rhythm streaks — which is why a
 * panel of look settings reaches for it rather than for the two flags above.
 * Read directly during render, though, it is a DOM read React cannot see: the
 * class changes, nothing re-renders, and controls gated on it stay frozen in
 * whatever state they had when the panel opened.
 *
 * Observing the attribute makes the same answer reactive. The snapshot is a
 * boolean, so `useSyncExternalStore` compares it by value and settles.
 */
const subscribeToRootEuphoria = (onChange: () => void) => {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
};

export const useIsRootEuphoric = () =>
  useSyncExternalStore(
    subscribeToRootEuphoria,
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('is-euphoric'),
    () => false,
  );

/**
 * Reset, for the development affordance that gives the badge back.
 *
 * Clears what was stored and leaves the mode on: it is always on now, and a
 * reset that switched it off would be the one way left to lose it.
 */
export const resetEuphoriaMode = () => {
  try {
    window.localStorage.removeItem(ACHIEVED_KEY);
    window.localStorage.removeItem(ENABLED_KEY);
  } catch {
    // Nothing to undo if it was never written.
  }
};

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
 * NOTHING TO UNLOCK, AND ON UNLESS SWITCHED OFF (Ivan, 2026-09-26). It was
 * made always on ("rainbow mode is always on"), and the pill on the top wave,
 * the tour's slide and the Support dialog's offer went with the unlock; then
 * Normal came back beside it ("let's keep the normal mode and the rainbow
 * mode"), with a Plus visualizer lending its first two colours to Normal and
 * all five to Rainbow. So ACHIEVED is always true, and ENABLED is a plain
 * preference that starts on, switched from the Window colours menu and the
 * app menu (`RainbowSwitch`) — under a key of its own, so a choice somebody
 * made while the mode was a prize does not come back to switch it off.
 */

import { useSyncExternalStore } from 'react';

/**
 * ACHIEVED, as older versions stored it: persisted and one-way, whether
 * unlocked through play or contribution. Only cleared now (the reset).
 */
const ACHIEVED_KEY = 'fluideq-euphoria-reached';
/** What an older version stored the switch under; cleared by the reset. */
const RETIRED_ENABLED_KEY = 'fluideq-euphoria-enabled';
const ENABLED_KEY = 'fluideq-rainbow';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Nothing to unlock: won from the first frame, whatever was stored.
const achieved = true;

/**
 * ENABLED. On unless somebody switched it off.
 *
 * COSMETIC ONLY. This turns the look on and nothing else: no multiplier, no
 * points, no streak. The score measures how accurately somebody played, and a
 * switch that granted x10 would make it measure whether they found the switch.
 */
let enabled = true;
try {
  enabled = window.localStorage.getItem(ENABLED_KEY) !== 'off';
} catch {
  // Storage can be unavailable: the mode is then on, its default.
}

export const isEuphoriaAchieved = () => achieved;
export const isEuphoriaEnabled = () => enabled;

export const setEuphoriaEnabled = (next: boolean) => {
  if (enabled === next || !achieved) {
    return;
  }
  enabled = next;
  try {
    window.localStorage.setItem(ENABLED_KEY, next ? 'on' : 'off');
  } catch {
    // The current session still follows the user's choice.
  }
  emit();
};

export const toggleEuphoriaEnabled = () => setEuphoriaEnabled(!enabled);

/**
 * A run hit the ceiling, or the user confirmed a contribution: the mode on,
 * so the moment of winning shows the thing that was won. Called on the
 * transition, never on the condition — see the note at the top of this file
 * for why that distinction is the whole design.
 */
export const winEuphoria = () => setEuphoriaEnabled(true);

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
 * Reset, for the development affordance that gives the badge back: what was
 * stored, this version's and the older keys alike, and the mode back to its
 * default, on.
 */
export const resetEuphoriaMode = () => {
  try {
    [ACHIEVED_KEY, RETIRED_ENABLED_KEY, ENABLED_KEY].forEach((key) =>
      window.localStorage.removeItem(key),
    );
  } catch {
    // Nothing to undo if it was never written.
  }
  if (!enabled) {
    enabled = true;
    emit();
  }
};

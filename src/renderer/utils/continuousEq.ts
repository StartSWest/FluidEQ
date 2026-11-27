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

import { useSyncExternalStore } from 'react';

/**
 * Whether the correction keeps measuring and adjusting itself, for as long as
 * there is music.
 *
 * Off by default and deliberately so: it is a mode in which the sound changes
 * without anybody touching anything, and that is not a thing to discover by
 * accident. Once switched on it is remembered, because the people who want it
 * want it every day.
 *
 * The switch is only half the feature. What makes it a mode rather than a
 * measurement on repeat is the size of the steps it takes — see
 * `CONTINUOUS_STEP_DB` and `stepSmartEqGains` in `common/smartEq`, and the loop
 * in `SmartEqEngine` that drives them.
 */
const STORAGE_KEY = 'fluideq.continuousEq';

/**
 * Where the way Smart correction measured used to be kept: the one-shot, or
 * one of three running ways. Balance is the only way now
 * (`common/referenceCurve`), so the choice is let go of at the first launch
 * that reads it — and a stored one-shot keeps what it meant, Smart correction
 * not running, which the switch below might still say otherwise: the two were
 * kept apart, and only a running way ever ran.
 */
const RETIRED_MODE_KEY = 'fluideq.smartEqMode';
/** The stored names that were running ways; anything else read as the one-shot. */
const RUNNING_MODES = ['detail', 'balance', 'target', 'continuous'];

let isOn = false;
try {
  isOn = window.localStorage.getItem(STORAGE_KEY) === 'true';
  const retired = window.localStorage.getItem(RETIRED_MODE_KEY);
  if (retired !== null) {
    if (!RUNNING_MODES.includes(retired) && isOn) {
      isOn = false;
      window.localStorage.setItem(STORAGE_KEY, 'false');
    }
    window.localStorage.removeItem(RETIRED_MODE_KEY);
  }
} catch {
  // Storage can be unavailable. Off is the safe direction to fail in for a
  // mode that changes the sound by itself.
}

const listeners = new Set<() => void>();

export const setContinuousEq = (next: boolean) => {
  if (isOn === next) {
    return;
  }
  isOn = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(isOn));
  } catch {
    // Not worth failing a mode change over; it simply will not be remembered.
  }
  listeners.forEach((listener) => listener());
};

export const toggleContinuousEq = () => setContinuousEq(!isOn);

export const useContinuousEq = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => isOn,
    () => false,
  );

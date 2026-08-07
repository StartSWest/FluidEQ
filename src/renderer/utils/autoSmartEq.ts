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
 * Whether Smart EQ re-measures itself when the music changes.
 *
 * Off by default and deliberately so: it is a mode in which the correction
 * moves on its own, and something that quietly retunes the sound is not a thing
 * to discover by accident. Once switched on it is remembered, because the
 * people who want it want it every day.
 *
 * The switch is only half the feature. What makes it work is the two rules in
 * `MainContent`: what counts as the music changing, and what an automatic run
 * measures against — see `TRACK_GAP_MS` and the `fromCurrent` branch of
 * `autoBalance`.
 */
const STORAGE_KEY = 'fluideq.autoSmartEq';

let isOn = false;
try {
  isOn = window.localStorage.getItem(STORAGE_KEY) === 'true';
} catch {
  // Storage can be unavailable. Off is the safe direction to fail in for a
  // mode that changes the sound by itself.
}

const listeners = new Set<() => void>();

export const isAutoSmartEqOn = () => isOn;

export const setAutoSmartEq = (next: boolean) => {
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

export const toggleAutoSmartEq = () => setAutoSmartEq(!isOn);

export const useAutoSmartEq = () =>
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

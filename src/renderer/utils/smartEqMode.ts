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
import { setContinuousEq } from './continuousEq';

/**
 * Which way of measuring the toolbar is offering — one button, not two.
 *
 * They were side by side and that was a worse thing to look at than it sounds:
 * the two do the same job by different means, only one of them can be running,
 * and a row that offers both at once invites pressing both. So the button is
 * whichever one is chosen, and the caret beside it is where the other one
 * lives.
 *
 * Choosing is not running. Picking Continuous makes the button say Continuous;
 * a press then starts it. That keeps the button's meaning constant — it does
 * what it says — where a menu that also started things would make the same
 * gesture mean two different amounts of commitment depending on which control
 * it landed on.
 *
 * Remembered, because it is a way of working rather than a moment's choice.
 */
export type TSmartEqMode = 'smart' | 'continuous';

const STORAGE_KEY = 'fluideq.smartEqMode';

const read = (): TSmartEqMode => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'continuous'
      ? 'continuous'
      : 'smart';
  } catch {
    // Storage can be unavailable. The one-shot measurement is the safe default:
    // it does something once and stops.
    return 'smart';
  }
};

let mode: TSmartEqMode = read();

const listeners = new Set<() => void>();

export const getSmartEqMode = () => mode;

export const setSmartEqMode = (next: TSmartEqMode) => {
  if (mode === next) {
    return;
  }
  mode = next;
  // Leaving Continuous behind switches it off rather than leaving it running
  // out of sight. The button is the only thing that says the mode is on, and a
  // button now showing something else cannot say it.
  if (mode !== 'continuous') {
    setContinuousEq(false);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not worth failing a choice over.
  }
  listeners.forEach((listener) => listener());
};

export const useSmartEqMode = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => mode,
    (): TSmartEqMode => 'smart',
  );

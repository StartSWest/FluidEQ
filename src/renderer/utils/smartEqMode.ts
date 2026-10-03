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
import { setContinuousEq } from './continuousEq';

/**
 * The remembered measurement mode, shared by the toolbar and compact player.
 * Choosing a different mode starts it; stopping retains the choice and the
 * correction. The toolbar offers all modes while idle so the same one can
 * be started again, and becomes Stop while a measurement is active.
 *
 * Remembered, because it is a way of working rather than a moment's choice.
 */
export type TSmartEqMode = 'smart' | 'detail' | 'balance' | 'target';

/** The three that keep running, so callers can ask "is this a continuous one". */
export const CONTINUOUS_MODES: TSmartEqMode[] = ['detail', 'balance', 'target'];

export const isContinuousMode = (mode: TSmartEqMode) => mode !== 'smart';

/** Every mode, in the order the menus list them: the one-off first. */
export const SMART_EQ_MODES: readonly TSmartEqMode[] = [
  'smart',
  ...CONTINUOUS_MODES,
];

/**
 * Each mode's name and the line under it in a menu, in the words the EQ
 * page's button uses — one table for every place a mode is named, so the
 * mini player's key and the EQ page's cannot call one mode two things.
 */
export const SMART_EQ_MODE_NAME = {
  smart: 'eq.smart',
  detail: 'eq.smart.mode.detail',
  balance: 'eq.smart.mode.balance',
  target: 'eq.smart.mode.target',
} as const satisfies Record<TSmartEqMode, string>;

export const SMART_EQ_MODE_NOTE = {
  smart: 'eq.smart.mode.once.note',
  detail: 'eq.smart.mode.detail.note',
  balance: 'eq.smart.mode.balance.note',
  target: 'eq.smart.mode.target.note',
} as const satisfies Record<TSmartEqMode, string>;

const STORAGE_KEY = 'fluideq.smartEqMode';

const read = (): TSmartEqMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // 'continuous' is what the single continuous mode was called before there
    // were three; it is the one that fits a line to the record, which is now
    // 'detail'.
    if (stored === 'continuous') {
      return 'detail';
    }
    return CONTINUOUS_MODES.includes(stored as TSmartEqMode)
      ? (stored as TSmartEqMode)
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
  // Choosing one starts it, and leaving one stops it.
  //
  // Picking a mode from a menu and then having to press the button as well is
  // two gestures for one decision, and the state in between — the mode chosen,
  // nothing happening — looks exactly like the thing being broken. Stopping on
  // the way out is the same rule read backwards: the button is the only thing
  // that says the mode is running, and a button now showing something else
  // cannot say it.
  setContinuousEq(isContinuousMode(mode));
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

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
import { IRhythmScore } from 'common/rhythmGame';

/**
 * The run in progress, for as long as the application is open.
 *
 * Deliberately module state rather than component state or storage. Closing the
 * support dialog must not cost the player their score or their multiplier —
 * thirty-six perfect taps is too much to lose to a stray Escape — but quitting
 * the app should start a fresh run, and a module lives exactly that long. No
 * cleanup, no expiry logic, no key to migrate later.
 *
 * The high score is a different thing and lives in localStorage, because that
 * one is meant to outlast everything.
 */
let run: IRhythmScore = { score: 0, streak: 0 };

const listeners = new Set<() => void>();

export const getRhythmRun = () => run;

export const setRhythmRun = (next: IRhythmScore) => {
  run = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Read the run from anywhere.
 *
 * The shell needs it to know whether to celebrate, and the shell is nowhere
 * near the dialog that produces it.
 */
export const useRhythmRun = () => useSyncExternalStore(subscribe, getRhythmRun);

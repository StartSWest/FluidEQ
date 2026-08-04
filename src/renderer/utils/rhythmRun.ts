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

/**
 * Where the high score lives. It is meant to survive everything.
 *
 * Kept here rather than in the game component because the reset below has to
 * clear it too, and that reset is triggered from the shell — which is nowhere
 * near the game. One module owns everything a run consists of.
 */
export const RHYTHM_HIGH_SCORE_KEY = 'fluideq-rhythm-high-score';

/**
 * The multiplier that was running when the high score was set.
 *
 * Stored beside the score rather than derived, because it cannot be recovered
 * afterwards — the streak that produced it is long gone. It exists so the
 * share card can say what the record actually was: a number on its own does
 * not distinguish a patient run from thirty-six perfect taps in a row, and the
 * multiplier is the part worth bragging about.
 */
export const RHYTHM_BEST_MULTIPLIER_KEY = 'fluideq-rhythm-best-multiplier';

const listeners = new Set<() => void>();

export const getRhythmRun = () => run;

export const setRhythmRun = (next: IRhythmScore) => {
  run = next;
  listeners.forEach((listener) => listener());
};

/**
 * Back to a fresh install, as far as the game is concerned.
 *
 * Everything downstream follows from the run, so this is all it takes: the
 * shell subscribes to it, so zeroing the streak drops the joy to nothing, which
 * removes `.is-euphoric` from the document and takes euphoria mode off the
 * bands, the graph trace and the titlebar meter in the same frame. Nothing here
 * needs to know that any of that exists.
 *
 * The high score goes with it. It is meant to outlive a run, but this is not
 * the end of a run — it is the badge being taken away, and leaving a record
 * behind from a game the user can no longer open is a state no real install
 * would ever be in.
 */
export const resetRhythmRun = () => {
  window.localStorage.removeItem(RHYTHM_HIGH_SCORE_KEY);
  window.localStorage.removeItem(RHYTHM_BEST_MULTIPLIER_KEY);
  setRhythmRun({ score: 0, streak: 0 });
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

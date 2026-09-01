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
import { CONTINUOUS_SETTLE_DB } from 'common/smartEqContinuous';

/**
 * How far each range currently disagrees with where it is being steered, in dB.
 *
 * The coverage bar says how much of a range has been heard. That is half of why
 * a correction has not landed, and on its own it is the misleading half: a range
 * can be fully heard and still sit there doing nothing, because being heard is
 * not the same as having anything to say. A write also needs the disagreement to
 * clear the settle deadband, and then it needs the quiet period to elapse.
 *
 * So this is the other half, published beside the first. It is the largest gap
 * between where a band is and where the last solve wanted it, taken over the
 * bands inside each range.
 *
 * WRITTEN ONCE A CHECKPOINT, not per frame, and that is not a compromise: it is
 * the rate at which the number actually changes. The solve runs once a second
 * and nothing between two solves alters what the last one wanted.
 *
 * Deliberately NOT presented as "time until it corrects". The quiet period, the
 * deadband and the evidence are three independent conditions, and a single
 * countdown would promise an arrival that any of the three can postpone.
 */

/** The gap a range has to clear before a write is worth making. */
export const DISAGREEMENT_DEADBAND_DB = CONTINUOUS_SETTLE_DB;

type TDisagreement = Record<string, number>;

let disagreement: TDisagreement = {};

const listeners = new Set<() => void>();

/**
 * When the quiet window between writes closes, as a wall-clock timestamp.
 *
 * The one condition that IS a clock. Evidence and disagreement are not — they
 * depend on what the music does next, and a countdown against either would be
 * inventing a schedule for something nobody can schedule.
 *
 * Which is why a countdown was refused twice before this and is right now: the
 * objection only holds while the other two are outstanding. Once both are met,
 * time is genuinely the only thing left, and saying so promises nothing that
 * cannot be delivered.
 */
let quietUntilMs = 0;

export const setSmartEqQuietUntil = (atMs: number) => {
  quietUntilMs = atMs;
  listeners.forEach((listener) => listener());
};

export const getSmartEqQuietUntil = () => quietUntilMs;

/**
 * Replaced whole rather than merged.
 *
 * A range missing from a solve has not kept its old disagreement — it was not
 * measured this time, and carrying the previous answer forward would leave a
 * stale bar standing next to a range nobody is listening to any more.
 */
export const setSmartEqDisagreement = (next: TDisagreement) => {
  disagreement = next;
  listeners.forEach((listener) => listener());
};

export const useSmartEqDisagreement = (): TDisagreement =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => disagreement,
    () => disagreement,
  );

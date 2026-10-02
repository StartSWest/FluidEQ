/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Share Audio lane's last readings, one per bar, newest last.
 *
 * As long as the lane is wide, and no longer. It was a fixed 240 readings,
 * which is 1200 pixels of bars: on a wide window the left of the lane never
 * filled and the sound stopped a third of the way across (Ivan, 2026-10-02).
 * The lane asks for room for every bar it can draw, and the history grows to
 * it keeping what it has; it never shrinks, so a window made narrower and
 * wide again still has its past.
 */
export interface ILaneHistory {
  /** Where the next reading goes; the slot before it is the newest. */
  cursor: number;
  level: Float32Array;
}

/** Enough for a narrow lane before it has been measured. */
const FIRST_ROOM = 240;

export const emptyLaneHistory = (): ILaneHistory => ({
  cursor: 0,
  level: new Float32Array(FIRST_ROOM),
});

/** Room for `bars` readings, every one already held kept in order. */
export const fitLaneHistory = (
  history: ILaneHistory,
  bars: number,
): ILaneHistory => {
  const { cursor, level } = history;
  if (bars <= level.length) {
    return history;
  }
  const grown = new Float32Array(bars);
  // Oldest first, at the end of the new ring, so the newest lands in its
  // last slot and the cursor wraps to the start.
  const offset = bars - level.length;
  for (let age = level.length - 1; age >= 0; age -= 1) {
    grown[offset + level.length - 1 - age] =
      level[(cursor - 1 - age + level.length * 2) % level.length];
  }
  return { cursor: 0, level: grown };
};

export const pushLaneReading = (history: ILaneHistory, value: number) => {
  history.level[history.cursor] = value;
  history.cursor = (history.cursor + 1) % history.level.length;
};

/** The reading `age` readings back, 0 the newest; 0 past what is held. */
export const laneReading = (history: ILaneHistory, age: number): number => {
  const { cursor, level } = history;
  return age < level.length
    ? level[(cursor - 1 - age + level.length * 2) % level.length]
    : 0;
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A figure that reads as an average, not as every reading.
 *
 * The incoming lane's delay is how much sound is waiting in the playback
 * buffer, read with every block that arrives — and it swings by a packet's
 * worth each time, so the figure flickered through a dozen values a second
 * (Ivan, 2026-10-02: "glitchy … like an average"). It now shows a running
 * average with a two-second memory, and the text moves only once that
 * average has moved by `MIN_CHANGE` whole units: a delay that is steady
 * reads steady, and one that really changes is followed within seconds.
 *
 * The average weighs each reading by the time since the previous one, from
 * the clock the reading is taken at, so it means the same at any block rate.
 * Until it has two seconds behind it, it is the plain mean of every reading
 * so far — a memory that starts from one reading would walk the figure in
 * from wherever that reading happened to swing, over six seconds.
 */
const MEMORY_MS = 2_000;
const MIN_CHANGE = 3;

export interface ISteadyReadout {
  /** The figure to show after this reading, or undefined to keep it. */
  next(value: number, now: number): number | undefined;
  /** Forget everything: the next reading is shown as it is. */
  reset(): void;
}

export const createSteadyReadout = (): ISteadyReadout => {
  let average = 0;
  let count = 0;
  let lastAt = 0;
  let shown: number | undefined;
  return {
    next: (value, now) => {
      count += 1;
      const memory = 1 - Math.exp(-Math.max(0, now - lastAt) / MEMORY_MS);
      average += Math.max(1 / count, memory) * (value - average);
      lastAt = now;
      const rounded = Math.round(average);
      if (shown !== undefined && Math.abs(rounded - shown) < MIN_CHANGE) {
        return undefined;
      }
      shown = rounded;
      return rounded;
    },
    reset: () => {
      count = 0;
      shown = undefined;
    },
  };
};

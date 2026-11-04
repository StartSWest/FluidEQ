/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

interface IMaximizerReading {
  reductionDb: number;
  peakHoldDb: number;
  outputDb: number;
}

/** Four readable figures per second, driven by the graph's existing frames. */
const WINDOW_MS = 250;

/**
 * Instantaneous block readings rewritten every display frame made the digits
 * flicker. Average the reduction and output power over a reading window; keep
 * the deepest held peak so averaging the labels never hides a transient.
 * Elapsed time weights the samples equally on 60 Hz and 144 Hz displays.
 */
export default function createMaximizerReadout() {
  let previousAt = 0;
  let previous: IMaximizerReading | undefined;
  let elapsed = 0;
  let reductionArea = 0;
  let powerArea = 0;
  let peakHoldDb = 0;

  return {
    reset() {
      previous = undefined;
      elapsed = 0;
      reductionArea = 0;
      powerArea = 0;
      peakHoldDb = 0;
    },
    sample(now: number, reading: IMaximizerReading): IMaximizerReading | null {
      // Do not integrate a suspended window's unobserved past into its return.
      const duration = previous
        ? Math.min(WINDOW_MS, Math.max(0, now - previousAt))
        : 0;
      if (previous) {
        reductionArea += previous.reductionDb * duration;
        powerArea += 10 ** (previous.outputDb / 10) * duration;
      }
      peakHoldDb = Math.max(peakHoldDb, reading.peakHoldDb);
      previous = reading;
      previousAt = now;
      elapsed += duration;
      if (elapsed < WINDOW_MS) {
        return null;
      }
      const result = {
        reductionDb: reductionArea / elapsed,
        peakHoldDb,
        outputDb: 10 * Math.log10(Math.max(1e-12, powerArea / elapsed)),
      };
      elapsed = 0;
      reductionArea = 0;
      powerArea = 0;
      peakHoldDb = reading.peakHoldDb;
      return result;
    },
  };
}

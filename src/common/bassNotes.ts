/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of the long window's low bins belong to a bass note, for the Bass
 * level (`energyLevels.ts`).
 *
 * A bass note, a kick's ringing body and an 808 are peaks of their own at
 * 115 Hz or under. A man's sung note stands from about there up, and the
 * window spreads its skirt down through every bin below it - summed as they
 * were, those bins read a man's voice as bass. So each bin is followed
 * uphill to the peak it lies on, and it is a bass note's only when that
 * peak's note is from BASS_FROM_HZ to BASS_TO_HZ: a skirt climbs to the note
 * higher up, and goes with it.
 */

/** Where a bass note's own peak stands, in Hz: B0 to A2 (110 Hz) with the peak's uncertainty. */
export const BASS_FROM_HZ = 30;
export const BASS_TO_HZ = 115;

/** The peak `bin` of `bins` lies on: uphill from it until neither side is higher. */
const peakOf = (bins: Float32Array, bin: number) => {
  let at = bin;
  for (;;) {
    const left = at > 0 ? bins[at - 1] : Number.NEGATIVE_INFINITY;
    const right =
      at < bins.length - 1 ? bins[at + 1] : Number.NEGATIVE_INFINITY;
    if (right > bins[at] && right >= left) {
      at += 1;
    } else if (left > bins[at]) {
      at -= 1;
    } else {
      return at;
    }
  }
};

/** Where the note under `peak` is, in bins: the parabola through it and its neighbours. */
const noteOf = (bins: Float32Array, peak: number) => {
  if (peak <= 0 || peak >= bins.length - 1) {
    return peak;
  }
  const left = bins[peak - 1];
  const right = bins[peak + 1];
  const curve = left - 2 * bins[peak] + right;
  return curve < 0 ? peak + (0.5 * (left - right)) / curve : peak;
};

/** Whether bin `bin` of `bins` (dB, `binHz` apart) lies on a bass note's peak. */
export const isBassBin = (bins: Float32Array, binHz: number, bin: number) => {
  const hz = noteOf(bins, peakOf(bins, bin)) * binHz;
  return hz >= BASS_FROM_HZ && hz <= BASS_TO_HZ;
};

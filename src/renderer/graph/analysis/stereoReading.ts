/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_RANGE_DB, clamp01 } from './analysisFrame';

/**
 * What one block of two channels says: how loud each is, how tightly they
 * move together, and how wide the picture between them is.
 *
 * Its own file because every number here is a definition somebody can check
 * against a textbook, and a definition buried in a drawing routine is one
 * nobody ever checks. The drawing is in `loudnessView`.
 */

/** A block this quiet says nothing about the image, so nothing is claimed. */
const SILENT_BLOCK = 0.000_001;

export interface IStereoReading {
  /** Peak amplitude, 0 to 1. */
  leftPeak: number;
  rightPeak: number;
  /** Mean square level, which is what the ear weighs. */
  leftRms: number;
  rightRms: number;
  /**
   * How tightly the two move together: +1 the same signal, 0 unrelated,
   * −1 the same signal inverted. Pearson's, about zero.
   */
  correlation: number;
  /**
   * How much of the sound is in the difference between the channels rather
   * than in what they share. 0 is mono, 1 is nothing shared at all.
   */
  width: number;
  /** Where the weight sits: −1 hard left, 0 centred, +1 hard right. */
  balance: number;
}

const QUIET: IStereoReading = {
  leftPeak: 0,
  rightPeak: 0,
  leftRms: 0,
  rightRms: 0,
  correlation: 0,
  width: 0,
  balance: 0,
};

export const readStereoBlock = (
  left: Float32Array,
  right: Float32Array,
): IStereoReading => {
  const count = Math.min(left.length, right.length);
  if (count === 0) {
    return QUIET;
  }
  let leftPeak = 0;
  let rightPeak = 0;
  let leftPower = 0;
  let rightPower = 0;
  let together = 0;
  let sidePower = 0;
  let midPower = 0;
  for (let index = 0; index < count; index += 1) {
    const l = left[index];
    const r = right[index];
    const absLeft = l < 0 ? -l : l;
    const absRight = r < 0 ? -r : r;
    if (absLeft > leftPeak) {
      leftPeak = absLeft;
    }
    if (absRight > rightPeak) {
      rightPeak = absRight;
    }
    leftPower += l * l;
    rightPower += r * r;
    together += l * r;
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;
    midPower += mid * mid;
    sidePower += side * side;
  }
  if (leftPower + rightPower < SILENT_BLOCK * count) {
    return QUIET;
  }
  const spread = Math.sqrt(leftPower * rightPower);
  const leftRms = Math.sqrt(leftPower / count);
  const rightRms = Math.sqrt(rightPower / count);
  return {
    leftPeak,
    rightPeak,
    leftRms,
    rightRms,
    correlation:
      spread > SILENT_BLOCK ? Math.max(-1, Math.min(1, together / spread)) : 0,
    width:
      midPower + sidePower > 0
        ? clamp01(sidePower / (midPower + sidePower)) * 2
        : 0,
    balance:
      leftRms + rightRms > 0 ? (rightRms - leftRms) / (leftRms + rightRms) : 0,
  };
};

/**
 * An amplitude as a share of the plot's depth, on the same eighty-decibel
 * scale every other measuring view answers — so a meter here and a spectrum
 * in the Analyzer are read against one ruler.
 */
export const meterLevel = (amplitude: number): number =>
  amplitude <= 0
    ? 0
    : clamp01(1 + (20 * Math.log10(amplitude)) / ANALYSIS_RANGE_DB);

/** That share back in decibels below full scale, for the scale's own marks. */
export const levelOfDb = (db: number): number =>
  clamp01(1 + db / ANALYSIS_RANGE_DB);

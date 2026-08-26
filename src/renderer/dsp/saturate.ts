/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IOversamplerState,
  createOversampler,
  downsample,
  oversampleFactorForSampleRate,
  upsample,
} from './oversample';

const MAX_OVERSAMPLE = 4;

/**
 * The harmonic colour an analogue equaliser adds and a digital one does not.
 *
 * This is the difference people mean when they say two equalisers with the same
 * curve sound different. A transformer and an op-amp are not linear: they add
 * harmonics that were not in the signal, quietly and everywhere, and that is
 * the character. Filters alone cannot produce it — no arrangement of biquads
 * invents a frequency that was not already there.
 *
 * Asymmetric on purpose. A symmetric curve produces only ODD harmonics, which
 * read as edge or grit; the offset here produces EVEN ones too, which read as
 * warmth and are most of what "analogue" means to a listener. Subtracting the
 * curve's value at the offset keeps DC out, because a non-linearity fed silence
 * must return silence rather than a constant.
 */
/**
 * The asymmetry OPENS with the drive, and that is what keeps this warm.
 *
 * It was a fixed 0.18, and the fixed value is exactly why the dial turned
 * gritty in its top half. The offset is what bends the curve asymmetrically;
 * the drive is what pushes the signal further along it. Hold the offset still
 * and raise the drive, and the signal spends proportionally more of its swing
 * out in the symmetric part of the tanh — so the ODD harmonics catch up, and
 * odd is what the ear reads as grit.
 *
 * Measured on a 400 Hz sine at 0.5, even against odd:
 *
 *     drive   fixed 0.18   opening 0.18 + 0.28d
 *      0.05    11.8 : 1          12.7 : 1
 *      0.25     8.5 : 1          12.8 : 1
 *      0.50     4.6 : 1           9.9 : 1
 *      0.75     3.1 : 1           9.5 : 1
 *      1.00     2.3 : 1          10.3 : 1
 *
 * The left column is the bug written down: by the top of the dial the odd
 * harmonics are within a factor of two of the even ones. Fuzz runs broadband,
 * so the bottom end shows it worst — at 80 Hz and full drive the old curve
 * measured 1.80 : 1, which is not warmth by any reading. This one measures
 * 7.71 : 1 there.
 *
 * 0.28 rather than something steeper on purpose. Larger coefficients score
 * better on paper — 0.45 reaches 62 : 1 — but they take the third harmonic
 * through a NULL partway up the travel, so the timbre changes direction in the
 * middle of the dial instead of opening smoothly. This one is monotonic in
 * both the second and the third across the whole range, which is what makes it
 * a dial rather than a row of positions.
 *
 * The second harmonic now reaches 9.84% at full drive against the old 4.05%,
 * so the dial is stronger as well as cleaner: its old ceiling was set by where
 * grit arrived, and moving the grit moved the ceiling with it. Existing
 * presets that ask for fuzz are consequently warmer than they were — the four
 * of them sit at 0.15 to 0.35, where the change is smallest.
 */
const OFFSET_BASE = 0.18;
const OFFSET_PER_DRIVE = 0.28;

/** The offset for a drive, and what the curve returns at it. */
const offsetFor = (drive: number) => OFFSET_BASE + drive * OFFSET_PER_DRIVE;

export const saturateSample = (sample: number, drive: number): number => {
  const offset = offsetFor(drive);
  return (Math.tanh(sample * drive + offset) - Math.tanh(offset)) / drive;
};

export interface ISaturatorState {
  oversampler: IOversamplerState;
  /** Maximum four-times-rate scratch, sized on first use and reused after. */
  oversampled: Float32Array;
}

export const createSaturator = (blockSize: number): ISaturatorState => ({
  oversampler: createOversampler(),
  oversampled: new Float32Array(blockSize * MAX_OVERSAMPLE),
});

/**
 * Saturate a block in place at a rate-aware resolution.
 *
 * Four times at 44.1/48 moves the folding boundary far enough away for the
 * generated harmonics. A 96 kHz session already supplies one of those octaves,
 * and a 192 kHz session supplies both, so adding another 4x there spends the
 * audio deadline without improving the anti-aliasing target.
 */
export const saturateBlock = (
  state: ISaturatorState,
  target: Float32Array,
  drive: number,
  /**
   * Undefined keeps the raw shaper for measurement and reuse. A number makes
   * this the EQ's parallel colour path: zero is the resampled carrier and one
   * is the level-normalised curve.
   */
  blend?: number,
  sampleRate = 48_000,
): void => {
  const oversample = oversampleFactorForSampleRate(sampleRate);
  const oversampledLength = target.length * oversample;
  const maximumLength = target.length * MAX_OVERSAMPLE;
  if (state.oversampled.length !== maximumLength) {
    state.oversampled = new Float32Array(maximumLength);
  }
  // The offset and its output are hoisted rather than read from
  // `saturateSample`, which recomputes both. They depend only on the drive,
  // which is fixed for the block, and this loop runs at twice the sample rate
  // inside an audio callback — two transcendentals per sample to re-derive a
  // constant is the kind of thing that only shows up as a dropout on somebody
  // else's slower machine.
  const offset = offsetFor(drive);
  const offsetOutput = Math.tanh(offset);
  const smallSignalGain = 1 - offsetOutput * offsetOutput;
  upsample(state.oversampler, target, state.oversampled, oversample);
  for (let i = 0; i < oversampledLength; i += 1) {
    const carrier = state.oversampled[i];
    const shaped =
      (Math.tanh(state.oversampled[i] * drive + offset) - offsetOutput) / drive;
    // The raw curve compresses the fundamental as it adds colour. That made
    // the control replace the waveform rather than enrich it, and on a full
    // mix the dense difference was heard as grain. Restore the tangent at
    // silence to unity, then blend in parallel at the oversampled rate so the
    // carrier and the harmonics are sample-aligned before decimation.
    state.oversampled[i] =
      blend === undefined
        ? shaped
        : carrier + (shaped / smallSignalGain - carrier) * blend;
  }
  downsample(state.oversampler, state.oversampled, target, oversample);
};

/**
 * The dial's position, mapped to a drive that stays colour rather than becoming
 * distortion.
 *
 * Measured on a 0.5-amplitude sine, harmonics as a percentage of the
 * fundamental:
 *
 *     drive 0.05   2nd 0.22%   3rd 0.005%
 *     drive 0.50   2nd 2.17%   3rd 0.47%
 *     drive 1.00   2nd 4.04%   3rd 1.79%
 *     drive 1.50   2nd 5.42%   3rd 3.81%
 *     drive 4.00   2nd 6.52%   3rd 16.38%
 *
 * The last row is why the first attempt sounded like distortion rather than
 * warmth, and the reason is the RATIO rather than the amount: by drive 4 the
 * ODD harmonics have overtaken the even ones, and odd is what the ear reads as
 * grit.
 *
 * The raw ceiling is 0.72. At 1 the curve was still even-dominant on a sine,
 * but a sine does not expose intermodulation: broadband music made every
 * partial bend every other partial and the top of the control sounded grainy.
 * 0.72 keeps enough second harmonic to hear while reducing that dense product
 * before the parallel blend below reduces it once more.
 *
 * The 1.6 power keeps the bottom of the travel fine — a quarter turn measures
 * half a percent — without leaving the whole middle of the dial inaudible,
 * which is what squaring it did.
 */
export const fuzzDrive = (amount: number): number => 0.72 * amount ** 1.6;

/**
 * Preserve most of the carrier even at the top of the dial.
 *
 * Drive already controls how nonlinear the curve is, so this is deliberately
 * narrow: 45% at the bottom to 60% at the top. Full replacement is what made a
 * broadband EQ colour stage read as fuzz rather than warmth.
 */
export const fuzzBlend = (amount: number): number => 0.45 + amount * 0.15;

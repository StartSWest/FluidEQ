/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IOversamplerState,
  createOversampler,
  downsample,
  upsample,
} from './oversample';

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
  /** Doubled-rate scratch, sized on first use and reused after. */
  doubled: Float32Array;
}

export const createSaturator = (blockSize: number): ISaturatorState => ({
  oversampler: createOversampler(),
  doubled: new Float32Array(blockSize * 2),
});

/**
 * Saturate a block in place, at twice the rate.
 *
 * The oversampling is not optional and not a refinement. A non-linearity run at
 * the session rate folds every harmonic above Nyquist back down as inharmonic
 * content that does not move with the music — which is the sound this feature
 * is supposed to be an alternative to, not an example of.
 */
export const saturateBlock = (
  state: ISaturatorState,
  target: Float32Array,
  drive: number,
): void => {
  const doubled = target.length * 2;
  if (state.doubled.length !== doubled) {
    state.doubled = new Float32Array(doubled);
  }
  // The offset and its output are hoisted rather than read from
  // `saturateSample`, which recomputes both. They depend only on the drive,
  // which is fixed for the block, and this loop runs at twice the sample rate
  // inside an audio callback — two transcendentals per sample to re-derive a
  // constant is the kind of thing that only shows up as a dropout on somebody
  // else's slower machine.
  const offset = offsetFor(drive);
  const offsetOutput = Math.tanh(offset);
  upsample(state.oversampler, target, state.doubled, 2);
  for (let i = 0; i < doubled; i += 1) {
    state.doubled[i] =
      (Math.tanh(state.doubled[i] * drive + offset) - offsetOutput) / drive;
  }
  downsample(state.oversampler, state.doubled, target, 2);
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
 * The ceiling is 1.0. A previous attempt stopped at 0.5 and that was
 * over-corrected the other way — 2.17% second harmonic is about -33 dB, which
 * sits at the edge of audibility on music and reads as a dial that does
 * nothing. At 1.0 the second harmonic is 4.04% and the balance is still 2.2 to
 * 1 in favour of the even ones, so it is heard without becoming grit.
 *
 * The 1.6 power keeps the bottom of the travel fine — a quarter turn measures
 * half a percent — without leaving the whole middle of the dial inaudible,
 * which is what squaring it did.
 */
export const fuzzDrive = (amount: number): number => amount ** 1.6;

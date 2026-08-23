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
 * Density in the midrange, which is the one thing an equaliser cannot give you.
 *
 * THE PROBLEM THIS EXISTS FOR. A stiff metal driver — titanium, beryllium,
 * aluminium — is fast and detailed and reads as "metallic": plenty of top,
 * plenty of bottom, and a middle that sounds thin however you set the curve.
 * Reaching for an EQ makes it worse, and the reason is not taste. The middle is
 * not too QUIET, it is too EMPTY: there is not enough correlated material in
 * roughly 300 Hz - 3 kHz for the ear to read as body. A filter can only scale
 * what is already there, so boosting thin mids produces loud thin mids, which
 * is heard as honk. `saturate.ts` states the same law from the other side: no
 * arrangement of biquads invents a frequency that was not in the input.
 *
 * So this generates the material instead, and it does it three ways at once.
 * Any one of them alone is a saturator, and saturators are exactly what this
 * was asked not to be.
 *
 *  1. EVEN harmonics, from the mids. The second harmonic of 400 Hz lands at
 *     800 Hz — energy an octave up, locked to the fundamental, which is what
 *     "body" physically is. Asymmetry is what produces even orders; a symmetric
 *     curve gives odd ones only, and odd reads as edge. That is the whole
 *     difference between this and the exciter's shaper, which is symmetric on
 *     purpose because it works on the top octaves.
 *
 *  2. An amount that FOLLOWS the programme, so it breathes with the music
 *     rather than sitting on it. Real valve and transformer stages saturate
 *     harder when driven harder; a fixed amount is the giveaway that something
 *     is a plug-in.
 *
 *  3. DRIFT — a slow, arrhythmic wander on the drive, independent per channel.
 *     This is the ingredient nobody exposes and the reason the other two still
 *     sound synthetic without it. A constant non-linearity adds a constant ring
 *     to every sustained note; ears find constants and stop hearing them as
 *     part of the music. Wandering keeps it alive, and per-channel wandering
 *     decorrelates the two sides slightly, which is heard as space rather than
 *     as width.
 *
 * NOT a loudness effect and not a substitute for the driver being better. What
 * it produces is plausible, not true — the same honest caveat the exciter
 * carries.
 */

/**
 * How far the drift moves the drive, as a fraction of it.
 *
 * 0.22 was chosen by ear against the failure at each end. Below about 0.1 the
 * wander is inaudible and the stage is a saturator again. Above about 0.35 a
 * sustained piano note audibly swells, which is a chorus, not an amplifier.
 */
const DRIFT_DEPTH = 0.22;

/**
 * Roughly how often the drift picks somewhere new to head, in Hz.
 *
 * Deliberately not a rate and deliberately not periodic. An LFO at any fixed
 * speed becomes a rhythm, and once the ear has the rhythm the effect is a
 * tremolo it is waiting for. Each target is held for a randomised span around
 * this figure and approached smoothly, so there is nothing to lock onto — the
 * same conclusion the analogue-drift literature reaches by the same route.
 */
const DRIFT_HZ = 0.28;

/** Attack of the follower that makes the amount track the music, ms. */
const ENV_ATTACK_MS = 12;

/**
 * Release of that follower, ms.
 *
 * Long, and that is the point. A fast release makes the harmonics pump in and
 * out between notes, which is a compressor artefact wearing a different name.
 * 260ms is slower than a note and faster than a phrase, so it follows how hard
 * the passage is playing rather than each hit inside it.
 */
const ENV_RELEASE_MS = 260;

/**
 * What the follower is allowed to scale the drive between.
 *
 * Never to zero: a stage that vanishes in quiet passages announces itself every
 * time the music drops, and the whole aim is to be noticed only by absence.
 */
const ENV_FLOOR = 0.45;

/** Below this the follower is treated as silence, so noise cannot drive it. */
const SILENCE = 1e-5;

export interface IOrganicState {
  /** The programme follower, per channel. */
  envelope: number;
  /** Where the wander is now, and where it is heading. */
  drift: number;
  driftFrom: number;
  driftTo: number;
  /** Samples until a new target is chosen, and the span of the current leg. */
  driftLeft: number;
  driftSpan: number;
  oversampler: IOversamplerState;
  /** Doubled-rate scratch, sized on first use and reused after. */
  doubled: Float32Array;
  /**
   * The doubled-rate signal before shaping, so the difference can be taken
   * where the two are still aligned.
   *
   * @see organicBlock — subtracting across the resampler is a comb filter.
   */
  doubledDry: Float32Array;
}

export const createOrganicState = (blockSize: number): IOrganicState => ({
  envelope: 0,
  drift: 0,
  driftFrom: 0,
  driftTo: 0,
  driftLeft: 0,
  driftSpan: 1,
  oversampler: createOversampler(),
  doubled: new Float32Array(blockSize * 2),
  doubledDry: new Float32Array(blockSize * 2),
});

/**
 * The transfer curve: asymmetric, so the harmonics it adds are mostly even.
 *
 * The same shape `saturate.ts` uses for fuzz, with the asymmetry opened up.
 * Fuzz sits at a fixed 0.18 because it runs broadband and has to stay out of
 * the way; this runs on one band and is asked for warmth specifically, so it
 * pushes the second harmonic much harder relative to the third.
 *
 * Subtracting the curve's value at the offset is what keeps DC out. A
 * non-linearity handed silence must return silence, and an offset curve does
 * not do that on its own — it returns the offset, which is a battery in the
 * signal path.
 */
export const organicSample = (
  sample: number,
  drive: number,
  asymmetry: number,
): number =>
  (Math.tanh(sample * drive + asymmetry) - Math.tanh(asymmetry)) / drive;

/**
 * The dial's position, mapped to drive and asymmetry together.
 *
 * One knob moves both because they are not independently useful: asymmetry
 * with no drive is a curve nothing reaches the bend of, and drive with no
 * asymmetry is the exciter. What the user is choosing is how much body, and
 * body is the pair.
 *
 * Measured on a 400 Hz sine at 0.5 — a real midrange fundamental, since that
 * is what this stage is for — as a percentage of the fundamental:
 *
 *     amount  drive  asym    2nd     3rd     4th    even:odd
 *      0.15    0.52  0.27   3.31%   0.45%   0.04%    7.3 : 1
 *      0.25    0.69  0.31   5.02%   0.73%   0.09%    6.9 : 1
 *      0.50    1.26  0.43  10.98%   1.77%   0.54%    6.4 : 1
 *      0.75    1.95  0.54  17.77%   3.08%   1.78%    6.3 : 1
 *      1.00    2.75  0.65  23.50%   4.61%   3.94%    5.6 : 1
 *
 * The RATIO is the number that matters, and it is why this is a different
 * stage rather than fuzz with a bigger number. Fuzz at its own ceiling manages
 * 4.05% second against 1.80% third — 2.3 to 1. This holds better than 5.6 to 1
 * everywhere on its travel, so it goes on getting thicker where fuzz would
 * have started getting gritty. That is the entire design goal expressed as a
 * measurement.
 *
 * The travel is meant to be used end to end: a quarter turn is subtle, half is
 * the sweet spot, and the top is deliberately heavy rather than reserved.
 *
 * A symmetric curve measured the same way returns 0.01% second and 6.69%
 * third. That is the positive control for this whole table — without it, a
 * bug that produced no even harmonics at all would look exactly like a stage
 * that was working.
 */
export const organicDrive = (amount: number): number =>
  0.35 + amount ** 1.4 * 2.4;

export const organicAsymmetry = (amount: number): number => 0.2 + amount * 0.45;

/**
 * Advance the wander by one block and return the multiplier for it.
 *
 * A sample-and-hold random walk rather than an oscillator: pick a target, take
 * a smooth ride to it over a randomised span, pick another. `smoothstep` on the
 * way, so there is no corner at either end for the ear to hear as a click.
 */
const advanceDrift = (
  state: IOrganicState,
  frames: number,
  sampleRate: number,
): number => {
  if (state.driftLeft <= 0) {
    // Half to one and a half times the nominal span, so successive legs are
    // never the same length and the wander never becomes a period.
    const nominal = sampleRate / DRIFT_HZ;
    state.driftSpan = Math.max(1, nominal * (0.5 + Math.random()));
    state.driftLeft = state.driftSpan;
    state.driftFrom = state.drift;
    state.driftTo = Math.random() * 2 - 1;
  }
  state.driftLeft -= frames;
  const done = 1 - Math.max(0, state.driftLeft) / state.driftSpan;
  const eased = done * done * (3 - 2 * done);
  state.drift = state.driftFrom + (state.driftTo - state.driftFrom) * eased;
  return 1 + state.drift * DRIFT_DEPTH;
};

/**
 * Replace a block with the HARMONICS it generates, at twice the rate.
 *
 * The buffer comes back holding what this stage ADDED, not the shaped signal —
 * so the caller adds it on top of the dry rather than differencing against it.
 * That is not a convenience, it is the only correct place for the subtraction:
 * the resampler is a 63-tap linear-phase FIR run twice in each direction, so a
 * shaped block comes back tens of samples later than the block it was made
 * from. Subtracting one from the other outside this function is subtracting a
 * DELAYED copy of the fundamental from the original, which is a comb filter —
 * measured, it took a 400 Hz tone from 0.354 RMS to 0.090 and read as the
 * effect gutting the sound. Taken here, before the downsampling, both signals
 * are sample-aligned and what is left is harmonics.
 *
 * The energy is matched first, for the reason `matchLevel` in `exciterStage`
 * gives at length: these curves are normalised for small signals, so a real
 * level comes back quieter, and an unmatched difference is mostly an inverted
 * fundamental with the harmonics riding on it.
 *
 * The oversampling is not a refinement here any more than it is for fuzz. A
 * non-linearity at the session rate folds everything above Nyquist back down as
 * content that does not move with the music, and inharmonic rubbish in the
 * midrange is far more audible than the same rubbish up where the exciter
 * works.
 *
 * Returns the drive it actually used, which is what the display draws — the
 * stage's whole claim is that the number moves, so a meter reading a setting
 * rather than the truth would be worse than no meter.
 */
export const organicBlock = (
  state: IOrganicState,
  target: Float32Array,
  amount: number,
  sampleRate: number,
): number => {
  const frames = target.length;
  const doubled = frames * 2;
  if (state.doubled.length !== doubled) {
    state.doubled = new Float32Array(doubled);
    state.doubledDry = new Float32Array(doubled);
  }

  // Peak of the block, which is what the follower chases. Cheaper than an RMS
  // and, for deciding how hard a passage is playing, no less honest.
  let peak = 0;
  for (let i = 0; i < frames; i += 1) {
    const magnitude = Math.abs(target[i]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }

  const attack = Math.exp(-frames / ((ENV_ATTACK_MS / 1000) * sampleRate));
  const release = Math.exp(-frames / ((ENV_RELEASE_MS / 1000) * sampleRate));
  const coefficient = peak > state.envelope ? attack : release;
  state.envelope =
    peak < SILENCE && state.envelope < SILENCE
      ? 0
      : peak + (state.envelope - peak) * coefficient;

  const tracked = ENV_FLOOR + (1 - ENV_FLOOR) * Math.sqrt(state.envelope);
  const drive =
    organicDrive(amount) * tracked * advanceDrift(state, frames, sampleRate);
  const asymmetry = organicAsymmetry(amount);

  // `organicSample` re-derives `tanh(asymmetry)` on every call and both are
  // constant for the block. This loop runs at twice the sample rate inside an
  // audio callback, so the constant is hoisted; the exported function keeps
  // the readable form for tests and for anyone reading the curve.
  const asymmetryOutput = Math.tanh(asymmetry);
  upsample(state.oversampler, target, state.doubledDry, 2);

  let shapedEnergy = 0;
  let dryEnergy = 0;
  for (let i = 0; i < doubled; i += 1) {
    const dry = state.doubledDry[i];
    const shaped =
      (Math.tanh(dry * drive + asymmetry) - asymmetryOutput) / drive;
    state.doubled[i] = shaped;
    shapedEnergy += shaped * shaped;
    dryEnergy += dry * dry;
  }

  // Energy-matched, then differenced, both while the two are still aligned.
  const gain =
    shapedEnergy > 1e-20 && dryEnergy > 1e-20
      ? Math.sqrt(dryEnergy / shapedEnergy)
      : 1;
  for (let i = 0; i < doubled; i += 1) {
    state.doubled[i] = state.doubled[i] * gain - state.doubledDry[i];
  }

  downsample(state.oversampler, state.doubled, target, 2);

  return drive;
};

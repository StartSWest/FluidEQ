/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import { IExciterSettings } from '../../common/dsp/chain';
import {
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from './biquad';
import { ICrossoverState, createCrossoverState, splitBands } from './crossover';
import {
  IOrganicState,
  createOrganicState,
  organicAsymmetry,
  organicBlock,
} from './organic';
import {
  IOversamplerState,
  createOversampler,
  downsample,
  upsample,
} from './oversample';

/**
 * The exciter, as three bands that each choose their own harmonics.
 *
 * WHY THIS LEFT THE AUDIO GRAPH. It was a `WaveShaperNode` — a highpass, a
 * curve and a mix, in parallel with the dry signal — and as a single band of
 * odd harmonics that was the right shape for it. None of what it grew into
 * fits in a shaper: a shaper cannot be told to wait for a level, cannot have
 * its drive wander, and cannot be three of itself with different characters.
 * Each of those would have been another node and another parallel path, and
 * parallel paths through native nodes is precisely the class of bug the
 * worklet's own header warns about — any difference in latency between them
 * misaligns the bands when they are summed.
 *
 * The topology it had is kept exactly: PARALLEL, not serial. The dry signal
 * passes at unity and the shaped bands are added on top, scaled by each band's
 * mix. Running a non-linearity in series would distort everything including
 * the bass, which is where distortion is most audible and least wanted.
 *
 * Anti-aliasing is now ours rather than Chromium's. The old node set
 * `oversample = '4x'` and got it in C++; this does the same 4x by hand for the
 * same reason, and the reason has not softened — a 7 kHz tone through this
 * curve makes 21 kHz, 35 kHz and 49 kHz, and at a 48 kHz session everything
 * past 24 kHz folds back down as tones that were never in the music and do not
 * move with it. 4x rather than the 2x the fuzz stage uses, because fuzz runs
 * on a whole-band signal dominated by low frequencies and this one deliberately
 * works where the harmonics have furthest to travel.
 */

/** What Chromium's shaper used, and what the high band needs. @see above */
const OVERSAMPLE = 4;

/**
 * Texture, as one number on one curve.
 *
 * Even and odd are not two curves to crossfade between — they are the same
 * tanh at two asymmetries, which is a far better control because everything in
 * between is a real filter rather than a blend of two. At texture 1 the
 * asymmetry is zero, the curve is symmetric, and a symmetric curve produces
 * odd harmonics ONLY: measured 0.01% second against 6.69% third. At texture 0
 * it is fully asymmetric and even-dominant by better than five to one.
 *
 * That is the axis the old exciter did not have. Its curve was symmetric and
 * therefore odd-only everywhere, which is right for a high band and wrong for
 * any band below it — odd harmonics in the bass are the definition of mud.
 */
const MAX_ASYMMETRY = 0.65;

/** Attack and release of the gate that makes a band wait for a level, ms. */
const GATE_ATTACK_MS = 8;
const GATE_RELEASE_MS = 140;

/** Below this a band is treated as silent, so noise cannot open its gate. */
const SILENCE = 1e-5;

export interface IExciterChannelState {
  crossover: ICrossoverState;
  /** The three split bands, and a scratch copy to shape without losing them. */
  bands: Float32Array[];
  shaped: Float32Array;
  oversamplers: IOversamplerState[];
  /** Oversampled scratch, one shared buffer since bands are done in turn. */
  wide: Float32Array;
  /** One follower per band, for the dynamic gate. */
  gates: number[];
  organic: IOrganicState;
  organicBand: Float32Array;
  /**
   * The focus band before it was shaped, so the difference can be taken.
   *
   * Preallocated like every other buffer here, and not because it is tidier: a
   * `new Float32Array` per block runs inside the audio callback, and the
   * garbage it makes is collected on a thread that has 2.7ms to finish. That
   * shows up as a dropout on somebody else's machine, months later, and looks
   * like anything but an allocation.
   */
  organicBefore: Float32Array;
  /** Two cascaded bandpass stages, so the focus has skirts worth the name. */
  focusStages: IBiquadState[];
}

export const createExciterChannel = (
  blockSize: number,
): IExciterChannelState => ({
  crossover: createCrossoverState(),
  bands: [
    new Float32Array(blockSize),
    new Float32Array(blockSize),
    new Float32Array(blockSize),
  ],
  shaped: new Float32Array(blockSize),
  oversamplers: [createOversampler(), createOversampler(), createOversampler()],
  wide: new Float32Array(blockSize * OVERSAMPLE),
  gates: [0, 0, 0],
  organic: createOrganicState(blockSize),
  organicBand: new Float32Array(blockSize),
  organicBefore: new Float32Array(blockSize),
  focusStages: [createBiquadState(), createBiquadState()],
});

const resize = (state: IExciterChannelState, frames: number): void => {
  if (state.shaped.length === frames) {
    return;
  }
  state.bands = [
    new Float32Array(frames),
    new Float32Array(frames),
    new Float32Array(frames),
  ];
  state.shaped = new Float32Array(frames);
  state.wide = new Float32Array(frames * OVERSAMPLE);
  state.organicBand = new Float32Array(frames);
  state.organicBefore = new Float32Array(frames);
};

/** Peak of a block, which is what both the gate and the follower chase. */
const peakOf = (buffer: Float32Array): number => {
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const magnitude = Math.abs(buffer[i]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
};

/**
 * How much of this band's harmonics to let through, 0-1.
 *
 * The EQ's dynamic bands, in the form this stage needs. A hard gate on a
 * harmonic generator chatters — the harmonics appear and vanish with the
 * threshold crossing and each transition is heard as a click — so the follower
 * is smoothed and the result is a continuous amount rather than a switch.
 */
const gateAmount = (
  state: IExciterChannelState,
  band: number,
  level: number,
  thresholdDb: number,
  frames: number,
  sampleRate: number,
): number => {
  const attack = Math.exp(-frames / ((GATE_ATTACK_MS / 1000) * sampleRate));
  const release = Math.exp(-frames / ((GATE_RELEASE_MS / 1000) * sampleRate));
  const coefficient = level > state.gates[band] ? attack : release;
  state.gates[band] =
    level < SILENCE && state.gates[band] < SILENCE
      ? 0
      : level + (state.gates[band] - level) * coefficient;

  const threshold = 10 ** (thresholdDb / 20);
  if (state.gates[band] <= threshold) {
    return 0;
  }
  // Fully open a factor of two above the threshold rather than the instant it
  // is crossed, so a passage hovering around it fades in instead of flickering.
  return Math.min(1, (state.gates[band] / threshold - 1) / 1);
};

/**
 * Run one channel, in place, adding the wet bands onto the dry signal.
 *
 * Returns what each band and the organic stage actually contributed, which is
 * what the card draws. A display fed the SETTINGS would be drawing what was
 * asked for; the whole claim of this stage is that the amounts move on their
 * own, so anything short of the truth would be worse than no display at all.
 */
export const runExciterChannel = (
  state: IExciterChannelState,
  target: Float32Array,
  settings: IExciterSettings,
  sampleRate: number,
): { bands: number[]; organic: number } => {
  const frames = target.length;
  resize(state, frames);
  const contributed = [0, 0, 0];

  const [low, mid, high] = state.bands;
  splitBands(
    state.crossover,
    target,
    low,
    mid,
    high,
    settings.crossoverHz,
    sampleRate,
  );

  for (let band = 0; band < 3; band += 1) {
    const setup = settings.bands[band];
    if (!setup?.enabled || setup.mix <= 0) {
      // Reset rather than leave running: a band switched back on should start
      // from silence, not from whatever its follower held when it went away.
      state.gates[band] = 0;
    } else {
      const source = state.bands[band];
      const open = setup.dynamic
        ? gateAmount(
            state,
            band,
            peakOf(source),
            setup.thresholdDb,
            frames,
            sampleRate,
          )
        : 1;

      if (open > 0) {
        state.shaped.set(source);
        const asymmetry = (1 - setup.texture) * MAX_ASYMMETRY;
        const asymmetryOutput = Math.tanh(asymmetry);
        const { drive } = setup;

        upsample(
          state.oversamplers[band],
          state.shaped,
          state.wide,
          OVERSAMPLE,
        );
        const wide = frames * OVERSAMPLE;
        for (let i = 0; i < wide; i += 1) {
          state.wide[i] =
            (Math.tanh(state.wide[i] * drive + asymmetry) - asymmetryOutput) /
            drive;
        }
        downsample(
          state.oversamplers[band],
          state.wide,
          state.shaped,
          OVERSAMPLE,
        );

        // The DIFFERENCE is what gets added, not the shaped band itself.
        // Adding the shaped band would add the band's own fundamental a second
        // time, which is a level change wearing an exciter's name — turning
        // the mix up would make it louder rather than richer, and that is the
        // single most common way this kind of stage is got wrong.
        const amount = setup.mix * open;
        for (let i = 0; i < frames; i += 1) {
          target[i] += (state.shaped[i] - source[i]) * amount;
        }
        contributed[band] = amount;
      }
    }
  }

  let organicAmount = 0;
  const { organic } = settings;
  if (organic.enabled && organic.amount > 0) {
    // Its own bandpass rather than one of the three bands above. The stage is
    // about a specific region of the midrange being thin, and which region
    // that is depends on the driver — so it is a frequency the user moves,
    // not whichever slice the exciter's crossovers happen to leave.
    const coefficients = biquadCoefficients(
      {
        type: FilterTypeEnum.BP,
        frequency: organic.focusHz,
        gainDb: 0,
        // Broad on purpose. Body is not a resonance, and a narrow band here
        // adds a note rather than a texture.
        quality: 0.7,
      },
      sampleRate,
    );
    state.organicBand.set(target);
    processBiquad(state.focusStages[0], state.organicBand, coefficients);
    processBiquad(state.focusStages[1], state.organicBand, coefficients);

    state.organicBefore.set(state.organicBand);
    organicBlock(state.organic, state.organicBand, organic.amount, sampleRate);
    // Again the DIFFERENCE, for the same reason the bands take theirs: what
    // this stage is adding is the harmonics it made, not a second copy of the
    // midrange it made them from.
    for (let i = 0; i < frames; i += 1) {
      target[i] +=
        (state.organicBand[i] - state.organicBefore[i]) * organic.amount;
    }
    organicAmount = organicAsymmetry(organic.amount);
  }

  return { bands: contributed, organic: organicAmount };
};

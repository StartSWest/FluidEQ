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

/** One Butterworth stage; two cascaded make 24 dB/octave. */
const BUTTERWORTH_Q = Math.SQRT1_2;

/** Edges at or past these are not filtered at all. @see runExciterChannel */
const BAND_EDGE_MIN_HZ = 21;
const BAND_EDGE_MAX_HZ = 19_900;

/** Below this a band is treated as silent, so noise cannot open its gate. */
const SILENCE = 1e-5;

export interface IExciterChannelState {
  /**
   * Two cascaded stages of highpass and of lowpass, per band.
   *
   * A crossover used to do this in one pass and could not any more. A
   * crossover's whole nature is that its outputs are adjacent and sum back to
   * the input, so the bands could not be widened independently and could never
   * overlap. These bands are not a decomposition — the dry signal passes
   * through untouched and each band only ADDS what it made — so nothing is
   * owed to reconstruction, and a plain bandpass per band is both simpler and
   * strictly more capable.
   */
  bandFilters: IBiquadState[][];
  /** The three extracted bands, and a scratch copy to shape without losing them. */
  bands: Float32Array[];
  shaped: Float32Array;
  oversamplers: IOversamplerState[];
  /** Oversampled scratch, one shared buffer since bands are done in turn. */
  wide: Float32Array;
  /**
   * The same block before shaping, so the difference stays aligned.
   *
   * Preallocated like every buffer here, and not for tidiness: a
   * `new Float32Array` per block runs inside the audio callback, and the
   * garbage it makes is collected on a thread that has 2.7ms to finish. That
   * surfaces as a dropout on somebody else's machine, months later, looking
   * like anything but an allocation.
   */
  wideDry: Float32Array;
  /** One follower per band, for the dynamic gate. */
  gates: number[];
  /** The block as it arrived, before any stage added to it. @see runExciterChannel */
  dry: Float32Array;
  organic: IOrganicState;
  organicBand: Float32Array;
  /** Two cascaded bandpass stages, so the focus has skirts worth the name. */
  focusStages: IBiquadState[];
}

export const createExciterChannel = (
  blockSize: number,
): IExciterChannelState => ({
  bandFilters: [0, 1, 2].map(() => [
    createBiquadState(),
    createBiquadState(),
    createBiquadState(),
    createBiquadState(),
  ]),
  bands: [
    new Float32Array(blockSize),
    new Float32Array(blockSize),
    new Float32Array(blockSize),
  ],
  shaped: new Float32Array(blockSize),
  oversamplers: [createOversampler(), createOversampler(), createOversampler()],
  wide: new Float32Array(blockSize * OVERSAMPLE),
  wideDry: new Float32Array(blockSize * OVERSAMPLE),
  gates: [0, 0, 0],
  dry: new Float32Array(blockSize),
  organic: createOrganicState(blockSize),
  organicBand: new Float32Array(blockSize),
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
  state.wideDry = new Float32Array(frames * OVERSAMPLE);
  state.dry = new Float32Array(frames);
  state.organicBand = new Float32Array(frames);
};

/**
 * WHY BOTH LOOPS BELOW MATCH ENERGY BEFORE SUBTRACTING.
 *
 * Every curve here is normalised for small signals — `tanh(x*d + a) / d` is
 * very close to `x` when `x` is tiny, which is what keeps a gentle setting
 * gentle. At a real level it is not: a 0.5 sine through drive 2.5 comes back at
 * 0.34, so the band is 32% quieter than it went in.
 *
 * That matters here and nowhere else in the app, because this stage adds the
 * DIFFERENCE between shaped and dry. A shaped copy that is quieter makes that
 * difference a large inverted copy of the fundamental with the harmonics riding
 * on top — so turning the mix up cancels the band instead of exciting it, and
 * isolate plays back the fundamental rather than the harmonics.
 *
 * It is the same conclusion the old single-band shaper reached by another
 * route: it normalised its curve by `tanh(drive)` so the output spanned full
 * scale at every drive, and its comment says why — an un-normalised curve gets
 * quieter as it is driven, and the user hears the effect doing nothing.
 */

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
 *
 * ISOLATE drops the dry signal and leaves only what this stage made. It costs
 * one `fill(0)` and no separate code path, which is not a coincidence — every
 * stage here adds a DIFFERENCE rather than a processed copy, so what it
 * contributed is already a signal in its own right. Anything else would need
 * the whole chain run twice and subtracted.
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

  /**
   * The input, kept because two things need it after `target` stops being it.
   *
   * The organic stage reads from here rather than from `target`, so it and the
   * three bands are genuinely parallel — all four fed the same signal. Reading
   * `target` meant its focus bandpass saw whatever the bands had already added,
   * which made the two stages serial by accident of the order they happen to be
   * written in.
   *
   * And under isolate `target` is about to be zeroed, so without a copy the
   * organic stage would be handed silence and the mode would appear to switch
   * it off.
   */
  state.dry.set(target);
  if (settings.isolate) {
    target.fill(0);
  }

  for (let band = 0; band < 3; band += 1) {
    const setup = settings.bands[band];
    if (!setup?.enabled || setup.mix <= 0) {
      // Reset rather than leave running: a band switched back on should start
      // from silence, not from whatever its follower held when it went away.
      state.gates[band] = 0;
    } else {
      /**
       * The band, taken with its own pair of filters from the dry signal.
       *
       * Butterworth Q on each of two cascaded stages, which is 24 dB/octave
       * either side — steep enough that a narrow band is genuinely narrow, and
       * gentle enough that a wide one does not ring. The edges are skipped
       * when they are at the ends of the range, because a highpass at 20 Hz
       * and a lowpass at 20 kHz are two filters' worth of phase shift in
       * exchange for nothing.
       */
      const source = state.bands[band];
      source.set(state.dry);
      const filters = state.bandFilters[band];
      if (setup.lowHz > BAND_EDGE_MIN_HZ) {
        const highpass = biquadCoefficients(
          {
            type: FilterTypeEnum.HPQ,
            frequency: setup.lowHz,
            gainDb: 0,
            quality: BUTTERWORTH_Q,
          },
          sampleRate,
        );
        processBiquad(filters[0], source, highpass);
        processBiquad(filters[1], source, highpass);
      }
      if (setup.highHz < BAND_EDGE_MAX_HZ) {
        const lowpass = biquadCoefficients(
          {
            type: FilterTypeEnum.LPQ,
            frequency: setup.highHz,
            gainDb: 0,
            quality: BUTTERWORTH_Q,
          },
          sampleRate,
        );
        processBiquad(filters[2], source, lowpass);
        processBiquad(filters[3], source, lowpass);
      }

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
          state.wideDry,
          OVERSAMPLE,
        );
        const wide = frames * OVERSAMPLE;
        let shapedEnergy = 0;
        let dryEnergy = 0;
        for (let i = 0; i < wide; i += 1) {
          const dry = state.wideDry[i];
          const value =
            (Math.tanh(dry * drive + asymmetry) - asymmetryOutput) / drive;
          state.wide[i] = value;
          shapedEnergy += value * value;
          dryEnergy += dry * dry;
        }

        // Energy-matched and then differenced, both INSIDE the oversampled
        // domain where the two are still sample-aligned. The comment above
        // `peakOf` says why the match; the alignment is because the
        // resampler is a 63-tap linear-phase FIR run twice each way, so
        // subtracting after the round trip is subtracting a delayed copy of
        // the fundamental, which is a comb filter rather than a harmonic.
        // Measured before the fix: one band at mix 0.4 took a 400 Hz tone
        // from 0.354 RMS to 0.090.
        const gain =
          shapedEnergy > 1e-20 && dryEnergy > 1e-20
            ? Math.sqrt(dryEnergy / shapedEnergy)
            : 1;
        for (let i = 0; i < wide; i += 1) {
          state.wide[i] = state.wide[i] * gain - state.wideDry[i];
        }

        // `shaped` now holds the harmonics themselves, so this is a plain add
        // rather than a difference. Adding the shaped BAND would have added
        // its fundamental a second time, which is a level change wearing an
        // exciter's name — turning the mix up would make it louder rather than
        // richer, and that is the commonest way this kind of stage is wrong.
        downsample(
          state.oversamplers[band],
          state.wide,
          state.shaped,
          OVERSAMPLE,
        );

        const amount = setup.mix * open;
        for (let i = 0; i < frames; i += 1) {
          target[i] += state.shaped[i] * amount;
        }
        contributed[band] = amount;
      }
    }
  }

  let organicAmount = 0;
  const { organic } = settings;
  if (organic.enabled && organic.amount > 0) {
    // Its own bandpass rather than one of the three bands above. The stage is
    // about a specific region being thin, and which region that is depends on
    // the driver — so it is a frequency the user moves, not whichever slice
    // the exciter's crossovers happen to leave.
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
    // Read from the input, not from `target`. The bands above have already
    // added to `target`, so taking the source from there made this stage feed
    // on their harmonics — serial by accident of the order the two are written
    // in, when they are meant to be parallel. It is also what makes isolate
    // work, since `target` is zeroed there.
    state.organicBand.set(state.dry);
    processBiquad(state.focusStages[0], state.organicBand, coefficients);
    processBiquad(state.focusStages[1], state.organicBand, coefficients);

    /**
     * How much of the spectrum this works on, from the focus band to all of it.
     *
     * A bandpass alone could never reach "everything": drop its Q far enough to
     * span the audible range and it stops being a filter long before it stops
     * rolling off at the edges. So range LERPS towards the unfiltered signal
     * instead. At 0 the stage sees only its focus band; at 1 it sees the whole
     * signal and the focus dial no longer means anything; in between the focus
     * is emphasised without being exclusive, which is the useful middle and the
     * reason this is a dial rather than a switch.
     */
    if (organic.range > 0) {
      for (let i = 0; i < frames; i += 1) {
        state.organicBand[i] +=
          (state.dry[i] - state.organicBand[i]) * organic.range;
      }
    }

    // Comes back holding the harmonics rather than the shaped band — the
    // difference is taken inside `organicBlock`, where the signals are still
    // aligned. So this is a plain add.
    organicBlock(state.organic, state.organicBand, organic.amount, sampleRate);
    for (let i = 0; i < frames; i += 1) {
      target[i] += state.organicBand[i] * organic.amount;
    }
    organicAmount = organicAsymmetry(organic.amount);
  }

  return { bands: contributed, organic: organicAmount };
};

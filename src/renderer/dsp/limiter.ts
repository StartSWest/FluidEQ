/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ITruePeakState,
  TRUE_PEAK_LATENCY_SAMPLES,
  createTruePeakState,
  truePeakOfSample,
} from './truePeak';
import { TOversampleFactor } from './oversample';

export interface ILimiterState {
  /** The inter-sample detector's own filter history. */
  truePeak: ITruePeakState;
  /** Circular audio delay line, `lookAhead + 1` long. See `processLimiter`. */
  delay: Float32Array;
  /** |sample| for each slot of `delay`, indexed the same way. */
  magnitude: Float32Array;
  /**
   * Absolute sample positions whose magnitudes are strictly decreasing.
   *
   * The front is the loudest sample in the current window, which is what the
   * gain must answer to. A monotonic deque keeps that answer O(1) amortised;
   * rescanning the window per sample would be up to 960 comparisons each at
   * the 20ms maximum look-ahead, inside the audio thread.
   */
  window: Int32Array;
  head: number;
  tail: number;
  /** Absolute index of the next incoming sample. */
  position: number;
  /** Current gain reduction, 0-1. Held across process blocks. */
  gain: number;
}

export interface ILimiterOptions {
  /** Linear amplitude, not dB. */
  ceiling: number;
  /** Stay at unity below this pathological input level. Defaults to ceiling. */
  activationThreshold?: number;
  /** Per-sample gain recovery, 0-1. Closer to 1 releases more slowly. */
  releaseCoefficient: number;
  /** Optional faster recovery while the signal still needs some reduction. */
  limitingReleaseCoefficient?: number;
  /** Width of the continuous transition into limiting, in dB. */
  kneeDb?: number;
  /** Samples to keep a linked envelope down before release may recover. */
  releaseHoldSamples?: number;
  /** Optional maximum downward movement, expressed as dB per second. */
  attackSlewDbPerSecond?: number;
  /** Explicit processing rate for reusable controllers outside the worklet. */
  sampleRate?: number;
  /**
   * Finish an exponential recovery once its remaining linear gap is this
   * fraction of the target. The final fraction is inaudible, while leaving it
   * asymptotic can strand a deep reduction for many seconds.
   */
  releaseSnapRatio?: number;
}

/**
 * Continuous limiting curve: unity below the knee, exact ceiling above it.
 *
 * The quadratic is the infinite-ratio form of a conventional soft knee. It is
 * value- and slope-continuous at both edges, so a peak approaching the ceiling
 * does not make the gain law snap from unity to reduction. The upper branch is
 * still an exact ceiling; smoothness must never be bought with overshoot.
 */
const requiredLimiterGain = (
  peak: number,
  ceiling: number,
  kneeDb = 0,
): number => {
  if (!(peak > 0) || !(ceiling > 0) || !Number.isFinite(ceiling)) {
    return 1;
  }
  const knee = Math.max(0, kneeDb);
  if (knee === 0) {
    return peak > ceiling ? ceiling / peak : 1;
  }
  const halfKnee = knee * 0.5;
  const lower = ceiling * 10 ** (-halfKnee / 20);
  if (peak <= lower) {
    return 1;
  }
  const upper = ceiling * 10 ** (halfKnee / 20);
  if (peak >= upper) {
    return ceiling / peak;
  }
  const relativeDb = 20 * Math.log10(peak / ceiling);
  const kneePosition = relativeDb + halfKnee;
  const reductionDb = -(kneePosition * kneePosition) / (2 * knee);
  return 10 ** (reductionDb / 20);
};

/**
 * One detector and gain law shared by every output channel.
 *
 * Independent final limiters can turn the left side down without the right and
 * move the stereo image on every peak. The linked form delays channels
 * separately but makes one decision from the loudest reconstructed peak.
 */
export interface ILinkedLimiterState {
  truePeak: ITruePeakState[];
  delay: Float32Array[];
  /** Smoothed reduction in dB, delayed in lockstep with the audio. */
  gainReductionDb: Float32Array;
  position: number;
  /** Fast detector with instantaneous attack and held exponential release. */
  detectorGain: number;
  /** Gain applied to the most recently emitted frame, for telemetry. */
  gain: number;
  /** Prevents recovery between closely spaced peaks from becoming tremolo. */
  releaseHoldRemaining: number;
  /** Loudest reconstructed input peak seen in the most recent block. */
  blockPeak: number;
}

export const createLimiterState = (
  lookAheadSamples: number,
  truePeakFactor: TOversampleFactor = 4,
): ILimiterState => {
  const capacity = Math.max(1, Math.floor(lookAheadSamples)) + 1;
  return {
    delay: new Float32Array(capacity),
    magnitude: new Float32Array(capacity),
    window: new Int32Array(capacity),
    truePeak: createTruePeakState(truePeakFactor),
    head: 0,
    tail: 0,
    position: 0,
    gain: 1,
  };
};

export const createLinkedLimiterState = (
  channels: number,
  lookAheadSamples: number,
  truePeakFactor: TOversampleFactor = 4,
): ILinkedLimiterState => {
  const capacity = Math.max(1, Math.floor(lookAheadSamples)) + 1;
  return {
    truePeak: Array.from({ length: channels }, () =>
      createTruePeakState(truePeakFactor),
    ),
    delay: Array.from({ length: channels }, () => new Float32Array(capacity)),
    gainReductionDb: new Float32Array(capacity),
    position: 0,
    detectorGain: 1,
    gain: 1,
    releaseHoldRemaining: 0,
    blockPeak: 0,
  };
};

/** Clear gain control without emptying the continuously running audio delay. */
export const resetLinkedLimiterControl = (state: ILinkedLimiterState): void => {
  state.detectorGain = 1;
  state.gain = 1;
  state.releaseHoldRemaining = 0;
  state.gainReductionDb.fill(0);
};

/** Clear both control and delayed programme when the source itself changes. */
export const resetLinkedLimiterState = (state: ILinkedLimiterState): void => {
  resetLinkedLimiterControl(state);
  state.position = 0;
  state.blockPeak = 0;
  state.delay.forEach((channel) => channel.fill(0));
  state.truePeak.forEach((detector) => {
    detector.history.fill(0);
    detector.position = 0;
  });
};

/**
 * Limit `input` into `output`, delayed by the look-ahead.
 *
 * The delay is the entire point and it is not an implementation detail: the
 * gain has to be down BEFORE the peak is heard, and the only way to know a
 * peak is coming is to be listening ahead of what you are emitting.
 *
 * Two things this gets wrong if written the obvious way, both of which cost a
 * measured overshoot rather than an error:
 *
 *  - **The gain must answer to the loudest sample in the whole window, not to
 *    the newest one.** Computing it from the incoming sample alone lets the
 *    release start the moment the peak is past the input, so by the time that
 *    peak reaches the OUTPUT the gain has already recovered. Measured on an
 *    isolated full-scale spike with a 64-sample look-ahead and a 20ms release:
 *    0.531 against a 0.5 ceiling, a 6.2% overshoot from exactly that recovery.
 *  - **Release must not run while the required gain is unchanged.** With
 *    `required < gain` a steady tone alternates between reducing and
 *    releasing every other sample, because equality falls through to release.
 *    Measured: 0.5004 against a 0.5 ceiling. `<=` is the fix and it is not a
 *    rounding tweak — it is the difference between holding a gain and
 *    dithering around it.
 *
 * The window spans `lookAhead + 1` samples so that the sample being emitted is
 * still inside it. A window of exactly `lookAhead` would exclude the very
 * sample whose level it is meant to be controlling.
 *
 * `input` and `output` may be the same array.
 */
export const processLimiter = (
  state: ILimiterState,
  input: Float32Array,
  output: Float32Array,
  {
    ceiling,
    activationThreshold = ceiling,
    releaseCoefficient,
    limitingReleaseCoefficient = releaseCoefficient,
    kneeDb,
  }: ILimiterOptions,
): void => {
  const { delay, magnitude, window } = state;
  const capacity = delay.length;
  const lookAhead = capacity - 1;

  for (let i = 0; i < input.length; i += 1) {
    const { position } = state;
    const incoming = input[i];
    /**
     * The inter-sample magnitude, not `Math.abs(incoming)`.
     *
     * A signal can sit below the ceiling in every sample it has and still
     * reconstruct above it in the gaps between them — and the gaps are what a
     * converter, a resampler and every streaming service's meter actually see.
     * A limiter that answers only to the samples it was handed will let that
     * through and report a ceiling it is not holding.
     */
    const incomingMagnitude = truePeakOfSample(state.truePeak, incoming);

    // The sample that has just fallen out of the window, if it was the peak.
    if (
      state.head < state.tail &&
      window[state.head % capacity] === position - capacity
    ) {
      state.head += 1;
    }

    // Anything quieter than the incoming sample can never be the window's
    // maximum again, because it also leaves the window earlier.
    while (
      state.tail > state.head &&
      magnitude[window[(state.tail - 1) % capacity] % capacity] <=
        incomingMagnitude
    ) {
      state.tail -= 1;
    }
    window[state.tail % capacity] = position;
    state.tail += 1;

    // Read the outgoing sample before its slot is reused. It sits one step
    // ahead of the write cursor, which is `position - lookAhead`.
    const emitted =
      lookAhead === 0 ? incoming : delay[(position + 1) % capacity];
    delay[position % capacity] = incoming;
    magnitude[position % capacity] = incomingMagnitude;
    state.position = position + 1;

    const peak = magnitude[window[state.head % capacity] % capacity];
    const required =
      peak >= activationThreshold
        ? requiredLimiterGain(peak, ceiling, kneeDb)
        : 1;
    state.gain =
      required <= state.gain
        ? required
        : state.gain +
          (required - state.gain) *
            (1 -
              (required < 1 ? limitingReleaseCoefficient : releaseCoefficient));

    output[i] = emitted * state.gain;
  }
};

/**
 * Limit an interleaved moment across separate channel buffers in place.
 *
 * All channels must have the same frame count, as AudioWorklet outputs do.
 * The detector is true-peak rather than sample-peak, and the common gain keeps
 * stereo and mid/side relationships unchanged while the safety ceiling works.
 */
export const processLinkedLimiter = (
  state: ILinkedLimiterState,
  channels: Float32Array[],
  {
    ceiling,
    activationThreshold = ceiling,
    releaseCoefficient,
    limitingReleaseCoefficient = releaseCoefficient,
    kneeDb,
    releaseHoldSamples = 0,
    attackSlewDbPerSecond,
    releaseSnapRatio = 0,
    sampleRate: optionSampleRate,
  }: ILimiterOptions,
): void => {
  const frames = channels[0]?.length ?? 0;
  if (frames === 0) {
    return;
  }
  const { delay, gainReductionDb } = state;
  const capacity = gainReductionDb.length;
  const lookAhead = capacity - 1;
  const detectorLatency =
    state.truePeak[0]?.factor === 1 ? 0 : TRUE_PEAK_LATENCY_SAMPLES;
  const attackSamples = Math.max(0, lookAhead - detectorLatency);
  state.blockPeak = 0;

  const usesSlowAttack =
    attackSlewDbPerSecond !== undefined && attackSlewDbPerSecond > 0;
  let processingSampleRate = 48_000;
  if (optionSampleRate !== undefined && optionSampleRate > 0) {
    processingSampleRate = optionSampleRate;
  } else if (typeof sampleRate === 'number') {
    processingSampleRate = sampleRate;
  }
  const attackStepDb = usesSlowAttack
    ? attackSlewDbPerSecond / processingSampleRate
    : Number.POSITIVE_INFINITY;

  for (let i = 0; i < frames; i += 1) {
    const { position } = state;
    let incomingMagnitude = 0;
    for (let channel = 0; channel < channels.length; channel += 1) {
      const detected = truePeakOfSample(
        state.truePeak[channel],
        channels[channel][i],
      );
      if (detected > incomingMagnitude) {
        incomingMagnitude = detected;
      }
    }
    if (incomingMagnitude > state.blockPeak) {
      state.blockPeak = incomingMagnitude;
    }

    const required =
      incomingMagnitude >= activationThreshold
        ? requiredLimiterGain(incomingMagnitude, ceiling, kneeDb)
        : 1;
    if (usesSlowAttack) {
      // Detection is immediate, but a large gain move is not. The fixed dB/s
      // slew means a 1 dB correction completes sooner than a 5 dB correction
      // instead of every peak causing the same abrupt volume dip. Keep the
      // target through the look-ahead interval so it is still in force when
      // the peak that selected it reaches the output.
      if (required < state.detectorGain) {
        state.detectorGain = required;
        state.releaseHoldRemaining =
          lookAhead + Math.max(0, Math.floor(releaseHoldSamples));
      } else if (state.releaseHoldRemaining > 0) {
        state.releaseHoldRemaining -= 1;
      } else {
        state.detectorGain = required;
      }

      const currentDb = state.gain > 0 ? 20 * Math.log10(state.gain) : -120;
      const targetDb =
        state.detectorGain > 0 ? 20 * Math.log10(state.detectorGain) : -120;
      if (targetDb < currentDb) {
        state.gain = 10 ** (Math.max(targetDb, currentDb - attackStepDb) / 20);
      } else {
        const recoveryCoefficient =
          state.detectorGain < 1
            ? limitingReleaseCoefficient
            : releaseCoefficient;
        state.gain +=
          (state.detectorGain - state.gain) * (1 - recoveryCoefficient);
        if (
          state.detectorGain > state.gain &&
          state.detectorGain - state.gain <=
            state.detectorGain * Math.max(0, releaseSnapRatio)
        ) {
          state.gain = state.detectorGain;
        }
      }

      const writeAt = position % capacity;
      const readAt = lookAhead === 0 ? writeAt : (position + 1) % capacity;
      for (let channel = 0; channel < channels.length; channel += 1) {
        const line = delay[channel];
        const emitted = lookAhead === 0 ? channels[channel][i] : line[readAt];
        line[writeAt] = channels[channel][i];
        channels[channel][i] = emitted * state.gain;
      }
      state.position = position + 1;
    } else {
      if (required <= state.detectorGain) {
        state.detectorGain = required;
        state.releaseHoldRemaining = Math.max(
          0,
          Math.floor(releaseHoldSamples),
        );
      } else if (state.releaseHoldRemaining > 0) {
        state.releaseHoldRemaining -= 1;
      } else {
        // Follow the gain the current peak actually needs. A controller reduced
        // to -10 dB therefore rises toward -5 dB while +5 dB peaks remain, then
        // continues toward unity only once no peak asks for reduction. Releasing
        // blindly toward one creates a sawtooth: overshoot the needed gain, snap
        // down again on the next peak, repeat.
        const recoveryCoefficient =
          required < 1 ? limitingReleaseCoefficient : releaseCoefficient;
        state.detectorGain +=
          (required - state.detectorGain) * (1 - recoveryCoefficient);
        if (
          required > state.detectorGain &&
          required - state.detectorGain <=
            required * Math.max(0, releaseSnapRatio)
        ) {
          state.detectorGain = required;
        }
      }

      const reductionDb =
        state.detectorGain > 0 ? 20 * Math.log10(state.detectorGain) : -120;
      const controlPosition = position - detectorLatency;
      const controlAt = ((controlPosition % capacity) + capacity) % capacity;
      gainReductionDb[controlAt] = reductionDb;

      // Delaying audio while stepping its gain instantly is not look-ahead; it
      // merely chops the waveform earlier. Back-fill the buffered control signal
      // with a linear-in-dB fade that reaches the exact reduction at the peak.
      // An existing deeper ramp wins, so overlapping peaks stay protected.
      if (attackSamples > 0 && reductionDb < 0) {
        const stepDb = -reductionDb / attackSamples;
        let rampDb = reductionDb + stepDb;
        for (let back = 1; back <= attackSamples; back += 1) {
          const at =
            (((controlPosition - back) % capacity) + capacity) % capacity;
          if (gainReductionDb[at] <= rampDb) {
            break;
          }
          gainReductionDb[at] = rampDb;
          rampDb += stepDb;
        }
      }

      const writeAt = position % capacity;
      const readAt = lookAhead === 0 ? writeAt : (position + 1) % capacity;
      state.gain = 10 ** (gainReductionDb[readAt] / 20);
      for (let channel = 0; channel < channels.length; channel += 1) {
        const line = delay[channel];
        const emitted = lookAhead === 0 ? channels[channel][i] : line[readAt];
        line[writeAt] = channels[channel][i];
        channels[channel][i] = emitted * state.gain;
      }
      state.position = position + 1;
    }
  }
};

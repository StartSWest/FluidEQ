/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ILinkedLimiterState,
  createLinkedLimiterState,
  processLinkedLimiter,
  resetLinkedLimiterControl,
} from './limiter';
import { TOversampleFactor, oversampleFactorForSampleRate } from './oversample';

/** Fallback for direct limiter callers; Master supplies its selected ceiling. */
export const OUTPUT_SAFETY_CEILING_DB = -0.1;
/** Ordinary overload belongs to Master; Safety intervenes only pathologically. */
export const OUTPUT_SAFETY_EXTREME_DBTP = 10;

export const OUTPUT_SAFETY_LOOK_AHEAD_MS = 2;
/** Safety gain is peak-held; it never follows the music back toward unity. */
export const OUTPUT_SAFETY_RELEASE_MS = Number.POSITIVE_INFINITY;
/** An emergency boundary begins only at the actual ceiling. */
export const OUTPUT_SAFETY_SOFT_KNEE_DB = 0;
export const OUTPUT_SAFETY_DC_CUTOFF_HZ = 3;
/** Slow enough to reject musical bass while retaining a real DC baseline. */
export const OUTPUT_SAFETY_DC_METER_CUTOFF_HZ = 0.1;

interface IDcBlockState {
  input: number;
  output: number;
  estimate: number;
}

export interface IOutputSafetyState {
  dc: IDcBlockState[];
  dcPole: number;
  dcGain: number;
  dcMeterPole: number;
  limiter: ILinkedLimiterState;
  truePeakFactor: TOversampleFactor;
  ceiling: number;
  releaseCoefficient: number;
  minimumLimiterGain: number;
  inputTruePeak: number;
  dcOffsetPeak: number;
  repairedSamples: number;
}

export interface IOutputSafetyTelemetry {
  truePeakFactor: TOversampleFactor;
  gainReductionDb: number;
  inputTruePeakDb: number;
  dcCorrectionDb: number;
  repairedSamples: number;
}

export interface IOutputSafetyOptions {
  /** Master owns peak reduction; ordinary safeguards do not. */
  limiterEnabled?: boolean;
  /** Linear true-peak ceiling while the limiter is enabled. */
  ceiling?: number;
  /** Linear input level that activates the emergency correction. */
  activationThreshold?: number;
  /** Per-sample recovery coefficient while the emergency guard is enabled. */
  releaseCoefficient?: number;
  /** Smooth transition into the selected ceiling, in dB. */
  kneeDb?: number;
  /** Samples to hold emergency reduction before recovery. */
  releaseHoldSamples?: number;
}

/**
 * Build the final, always-on guard once; processing performs no allocations.
 *
 * Three hertz removes DC and pathological subsonic drift without placing a
 * user-visible cutoff in the musical bass range. The low-frequency cleanup is
 * deliberately before the limiter because any filter can create overshoot.
 */
export const createOutputSafety = (
  channels: number,
  sampleRate: number,
): IOutputSafetyState => {
  const dcPole = Math.exp(
    (-2 * Math.PI * OUTPUT_SAFETY_DC_CUTOFF_HZ) / sampleRate,
  );
  const truePeakFactor = oversampleFactorForSampleRate(sampleRate);
  return {
    dc: Array.from({ length: channels }, () => ({
      input: 0,
      output: 0,
      estimate: 0,
    })),
    dcPole,
    // Unity at Nyquist for H(z) = g(1-z^-1)/(1-pz^-1).
    dcGain: (1 + dcPole) * 0.5,
    dcMeterPole: Math.exp(
      (-2 * Math.PI * OUTPUT_SAFETY_DC_METER_CUTOFF_HZ) / sampleRate,
    ),
    limiter: createLinkedLimiterState(
      channels,
      Math.max(
        1,
        Math.round((OUTPUT_SAFETY_LOOK_AHEAD_MS / 1_000) * sampleRate),
      ),
      truePeakFactor,
    ),
    truePeakFactor,
    ceiling: 10 ** (OUTPUT_SAFETY_CEILING_DB / 20),
    releaseCoefficient: Math.exp(
      -1 / ((OUTPUT_SAFETY_RELEASE_MS / 1_000) * sampleRate),
    ),
    minimumLimiterGain: 1,
    inputTruePeak: 0,
    dcOffsetPeak: 0,
    repairedSamples: 0,
  };
};

/**
 * Sanitize and protect the final decoded output in place.
 *
 * NaN and infinity have undefined audio rendering behaviour and can poison an
 * IIR's history forever, so an invalid sample also clears that channel's DC
 * state. Every finite value remains floating-point all the way into the
 * look-ahead limiter. In particular, an intentionally hot EQ/Exciter chain
 * must not be hard-clipped by a fault boundary before Master Auto Headroom has
 * the opportunity to turn the intact waveform down.
 */
export const processOutputSafety = (
  state: IOutputSafetyState,
  channels: Float32Array[],
  options: IOutputSafetyOptions = {},
): void => {
  for (let channel = 0; channel < channels.length; channel += 1) {
    const target = channels[channel];
    const dc = state.dc[channel];
    for (let i = 0; i < target.length; i += 1) {
      if (!Number.isFinite(target[i])) {
        state.repairedSamples += 1;
        target[i] = 0;
        dc.input = 0;
        dc.output = 0;
        dc.estimate = 0;
      } else {
        const input = target[i];
        // The old meter reported `output - input`, which is the ordinary phase
        // response of a 3 Hz high-pass and therefore lit up on healthy music.
        // This much slower low-pass estimates only the baseline the blocker is
        // protecting against; its state survives reports so real DC can settle.
        dc.estimate = input + state.dcMeterPole * (dc.estimate - input);
        state.dcOffsetPeak = Math.max(
          state.dcOffsetPeak,
          Math.abs(dc.estimate),
        );
        const output =
          state.dcGain * (input - dc.input) + state.dcPole * dc.output;
        dc.input = input;
        dc.output = Number.isFinite(output) ? output : 0;
        target[i] = dc.output;
      }
    }
  }

  const limiterEnabled = options.limiterEnabled ?? false;
  if (!limiterEnabled) {
    // Keep the detector and two-millisecond delay line current so toggling
    // Safety cannot change latency or replay stale audio. Unity gain makes a
    // bypassed guard literal while the same path continues measuring peaks.
    resetLinkedLimiterControl(state.limiter);
  }
  processLinkedLimiter(state.limiter, channels, {
    ceiling: limiterEnabled
      ? (options.ceiling ?? state.ceiling)
      : Number.POSITIVE_INFINITY,
    activationThreshold: limiterEnabled
      ? options.activationThreshold
      : Number.POSITIVE_INFINITY,
    releaseCoefficient: limiterEnabled
      ? (options.releaseCoefficient ?? state.releaseCoefficient)
      : 0,
    kneeDb: limiterEnabled ? options.kneeDb : 0,
    releaseHoldSamples: limiterEnabled ? options.releaseHoldSamples : 0,
  });
  if (limiterEnabled) {
    state.minimumLimiterGain = Math.min(
      state.minimumLimiterGain,
      state.limiter.gain,
    );
  }
  state.inputTruePeak = Math.max(state.inputTruePeak, state.limiter.blockPeak);
};

const amplitudeDb = (amplitude: number): number =>
  amplitude > 1e-6 ? 20 * Math.log10(amplitude) : -120;

/** Read one meter interval and clear it without touching the audio histories. */
export const takeOutputSafetyTelemetry = (
  state: IOutputSafetyState,
): IOutputSafetyTelemetry => {
  const report = {
    truePeakFactor: state.truePeakFactor,
    gainReductionDb: amplitudeDb(state.minimumLimiterGain),
    inputTruePeakDb: amplitudeDb(state.inputTruePeak),
    // Magnitude of the estimated baseline before the 3 Hz blocker, not the
    // blocker filter's ordinary sample-by-sample phase difference.
    dcCorrectionDb: amplitudeDb(state.dcOffsetPeak),
    repairedSamples: state.repairedSamples,
  };
  state.minimumLimiterGain = 1;
  state.inputTruePeak = 0;
  state.dcOffsetPeak = 0;
  state.repairedSamples = 0;
  return report;
};

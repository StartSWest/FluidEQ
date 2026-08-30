/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TOversampleFactor } from './oversample';
import {
  ILinkedLimiterState,
  createLinkedLimiterState,
  processLinkedLimiter,
  resetLinkedLimiterControl,
  resetLinkedLimiterState,
} from './limiter';

/**
 * The same two milliseconds the safety stage already spends.
 *
 * It has to clear the true-peak detector's six samples of lag with enough left
 * over to be an attack ramp: 96 samples at 48 kHz leaves 90, which is the
 * ramp. Matching the safety stage keeps one number to reason about for the
 * whole Master tail.
 */
export const POST_FILTER_NORMALIZER_LOOK_AHEAD_MS = 2;
/** Long enough that two peaks a phrase apart do not each get their own dip. */
export const POST_FILTER_NORMALIZER_RELEASE_HOLD_MS = 10;
/**
 * Hard bound on the release, whatever a stored chain says.
 *
 * Nothing clamps `master.releaseMs` between storage and here, and a release
 * measured in seconds is what turned this stage into a level rider.
 */
export const POST_FILTER_NORMALIZER_MAX_RELEASE_MS = 400;
/** The final 2% linear gap is below 0.18 dB and is landed exactly at unity. */
export const POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO = 0.02;
/**
 * The Maximizer's knee, for the reason the Maximizer has one.
 *
 * A peak arriving at the ceiling must not make the gain law step from unity to
 * reduction. The upper branch is still an exact ceiling; smoothness is never
 * bought with overshoot.
 */
export const POST_FILTER_NORMALIZER_KNEE_DB = 1.5;
/** Click-free return to unity when Auto Headroom is switched off. */
export const POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS = 1_000;
/** Keeps the emergency boundary idle after reconstruction and the DC blocker. */
export const POST_FILTER_NORMALIZER_MARGIN_DB = 0.2;

export interface IPostFilterNormalizerState {
  limiter: ILinkedLimiterState;
  minimumGain: number;
  inputTruePeak: number;
}

export interface IPostFilterNormalizerTelemetry {
  gainReductionDb: number;
  inputTruePeakDb: number;
}

export interface IPostFilterNormalizerOptions {
  enabled: boolean;
  outputCeilingDb: number;
  followingGainDb: number;
  releaseMs: number;
  sampleRate: number;
}

export const resetPostFilterNormalizer = (
  state: IPostFilterNormalizerState,
): void => {
  resetLinkedLimiterState(state.limiter);
  state.minimumGain = 1;
  state.inputTruePeak = 0;
};

/**
 * Forget headroom learned before whole-track normalization became available.
 *
 * The audio delay remains continuous, unlike a source-boundary reset, so a
 * background analysis result cannot manufacture a one-sample hole or pop.
 */
export const rebasePostFilterNormalizer = (
  state: IPostFilterNormalizerState,
): void => {
  resetLinkedLimiterControl(state.limiter);
  state.minimumGain = 1;
  state.inputTruePeak = 0;
};

export const createPostFilterNormalizer = (
  channels: number,
  sampleRate: number,
  truePeakFactor: TOversampleFactor,
): IPostFilterNormalizerState => ({
  limiter: createLinkedLimiterState(
    channels,
    Math.max(
      1,
      Math.round((POST_FILTER_NORMALIZER_LOOK_AHEAD_MS / 1_000) * sampleRate),
    ),
    truePeakFactor,
  ),
  minimumGain: 1,
  inputTruePeak: 0,
});

/**
 * Establish clean, linked headroom after every creative filter and before gain.
 *
 * The target already reserves any positive Master gain. Consequently Output
 * trim at 0 dB is literal unity and positive trim cannot force the emergency
 * guard to reshape a hot waveform.
 *
 * It catches the peak, and that is the whole difference from what it was.
 * Look-ahead here was zero — one sample of delay — while the true-peak
 * detector describes the middle of its own window and so lags six. The stage
 * was five samples BEHIND every peak it answered to and could not attenuate
 * one. What it did instead was duck the programme at 5 dB/s, hold it down a
 * full second and release over another: one transient pulled the record down
 * for two seconds, which is the fluctuation heard on dense material, and the
 * slew in from unity at the start of a track was distortion until it arrived.
 * No cached measurement could help, because the stage learned by listening
 * rather than by looking ahead.
 *
 * The mechanism is the Maximizer's now, which is transparent: real look-ahead,
 * the reduction back-filled as a linear-in-dB ramp that reaches exactly what
 * the peak needs at the sample the peak lands on, a soft knee so the gain law
 * does not snap into limiting, and a hold measured in milliseconds rather than
 * in phrases.
 */
export const processPostFilterNormalizer = (
  state: IPostFilterNormalizerState,
  channels: Float32Array[],
  {
    enabled,
    outputCeilingDb,
    followingGainDb,
    releaseMs,
    sampleRate,
  }: IPostFilterNormalizerOptions,
): void => {
  const { limiter } = state;
  if (!enabled) {
    // Preserve the current gain and remove only the hold. The continuously
    // running look-ahead path can then return to unity without a level step.
    limiter.releaseHoldRemaining = 0;
  }

  // Judge the peak at the final output, not at this earlier tap. Positive
  // Master gain needs room reserved; negative gain already creates real room
  // and must be credited or Auto Headroom would attenuate twice.
  const reservedGainDb = Number.isFinite(followingGainDb) ? followingGainDb : 0;
  const normalizedCeilingDb =
    outputCeilingDb - reservedGainDb - POST_FILTER_NORMALIZER_MARGIN_DB;
  const selectedReleaseMs = Number.isFinite(releaseMs)
    ? Math.max(1, releaseMs)
    : POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS;
  const effectiveReleaseMs = enabled
    ? Math.min(selectedReleaseMs, POST_FILTER_NORMALIZER_MAX_RELEASE_MS)
    : POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS;
  const releaseCoefficient = Math.exp(
    -1 / ((effectiveReleaseMs / 1_000) * sampleRate),
  );
  processLinkedLimiter(limiter, channels, {
    ceiling: enabled
      ? 10 ** (normalizedCeilingDb / 20)
      : Number.POSITIVE_INFINITY,
    releaseCoefficient,
    limitingReleaseCoefficient: releaseCoefficient,
    // Zero selects the look-ahead path rather than the dB-per-second one. A
    // slew rate is how a stage with no look-ahead approximates an attack, and
    // it cannot reduce the peak that asked for it — only the seconds of
    // programme that follow.
    attackSlewDbPerSecond: 0,
    releaseSnapRatio: POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO,
    sampleRate,
    kneeDb: enabled ? POST_FILTER_NORMALIZER_KNEE_DB : 0,
    releaseHoldSamples: enabled
      ? Math.round(
          (POST_FILTER_NORMALIZER_RELEASE_HOLD_MS / 1_000) * sampleRate,
        )
      : 0,
  });

  state.inputTruePeak = Math.max(state.inputTruePeak, limiter.blockPeak);
  state.minimumGain = Math.min(state.minimumGain, limiter.gain);
};

const amplitudeDb = (amplitude: number): number =>
  amplitude > 1e-6 ? 20 * Math.log10(amplitude) : -120;

export const takePostFilterNormalizerTelemetry = (
  state: IPostFilterNormalizerState,
): IPostFilterNormalizerTelemetry => {
  const telemetry = {
    gainReductionDb: amplitudeDb(state.minimumGain),
    inputTruePeakDb: amplitudeDb(state.inputTruePeak),
  };
  state.minimumGain = 1;
  state.inputTruePeak = 0;
  return telemetry;
};

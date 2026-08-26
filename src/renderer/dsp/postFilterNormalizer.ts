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

/** No programme delay: seeking and Next must remain sample-immediate. */
export const POST_FILTER_NORMALIZER_LOOK_AHEAD_MS = 0;
/** Do not recover between peaks belonging to the same musical phrase. */
export const POST_FILTER_NORMALIZER_RELEASE_HOLD_MS = 1_000;
/** A deep correction must never leave the finished chain quiet indefinitely. */
export const POST_FILTER_NORMALIZER_MAX_RECOVERY_MS = 4_000;
/** The final 2% linear gap is below 0.18 dB and is landed exactly at unity. */
export const POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO = 0.02;
/** 1 dB in 200 ms, 5 dB in one second: bigger moves take longer. */
export const POST_FILTER_NORMALIZER_ATTACK_DB_PER_SECOND = 5;
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
 * guard to reshape a hot waveform. The detector sees a new peak immediately,
 * but gain moves at a bounded dB-per-second rate and adds no playback delay.
 * Recovery holds through one phrase, then follows the selected release. A
 * bounded time constant plus an inaudible final snap guarantees that even a
 * 26 dB correction reaches its new target within four seconds rather than
 * leaving the chain pinned at the bottom after the signal changes.
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
  const recoveryWindowMs = Math.max(
    1,
    POST_FILTER_NORMALIZER_MAX_RECOVERY_MS -
      POST_FILTER_NORMALIZER_RELEASE_HOLD_MS,
  );
  const maximumReleaseTimeConstantMs =
    recoveryWindowMs / Math.log(1 / POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO);
  const selectedReleaseMs = Number.isFinite(releaseMs)
    ? Math.max(1, releaseMs)
    : POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS;
  const effectiveReleaseMs = enabled
    ? Math.min(selectedReleaseMs, maximumReleaseTimeConstantMs)
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
    attackSlewDbPerSecond: POST_FILTER_NORMALIZER_ATTACK_DB_PER_SECOND,
    releaseSnapRatio: POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO,
    sampleRate,
    kneeDb: 0,
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

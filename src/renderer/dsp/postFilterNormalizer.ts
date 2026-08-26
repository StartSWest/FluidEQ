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
} from './limiter';

/** Give attenuation enough future audio to arrive as a slow level movement. */
export const POST_FILTER_NORMALIZER_LOOK_AHEAD_MS = 180;
/** Do not recover between peaks belonging to the same musical phrase. */
export const POST_FILTER_NORMALIZER_RELEASE_HOLD_MS = 1_000;
/** Auto Headroom must never chase individual hits in either direction. */
export const POST_FILTER_NORMALIZER_MIN_RELEASE_MS = 4_000;
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
 * guard to reshape a hot waveform. A 180-millisecond look-ahead makes new
 * attenuation a deliberate level move. After a one-second hold, recovery
 * follows newer peaks with the same slow envelope used on the path to unity.
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
  const effectiveReleaseMs = enabled
    ? Math.max(POST_FILTER_NORMALIZER_MIN_RELEASE_MS, releaseMs)
    : POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS;
  const releaseCoefficient = Math.exp(
    -1 / ((effectiveReleaseMs / 1_000) * sampleRate),
  );
  processLinkedLimiter(limiter, channels, {
    ceiling: enabled
      ? 10 ** (normalizedCeilingDb / 20)
      : Number.POSITIVE_INFINITY,
    releaseCoefficient,
    // There is deliberately no faster "while limiting" recovery. That was
    // inverse pumping: gain rose between successive peaks and fell on the next.
    // Both upward paths now use the same slow envelope.
    limitingReleaseCoefficient: releaseCoefficient,
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

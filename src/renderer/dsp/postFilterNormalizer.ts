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
/**
 * How long sustained reduction takes to reach the slow release, in ms.
 *
 * This stage went from catching the occasional transient to holding the
 * programme down for whole choruses the moment the loudness target was allowed
 * to ask for gain the track's peak room could not supply. One release time
 * cannot serve both: fast enough for an isolated peak not to duck the phrase
 * after it, and slow enough that a dense chorus does not have its level
 * modulated at the rate of its own snare. That modulation is what pumping IS.
 *
 * So the release stretches with how long reduction has already persisted. A
 * transient releases at the dialled time because the stage has not been down
 * long enough to stretch; a passage that has been under reduction for a third
 * of a second releases three times slower, and the level between its peaks
 * stops moving.
 */
export const POST_FILTER_NORMALIZER_SUSTAIN_MS = 300;
/** What the release is multiplied by once reduction is fully sustained. */
export const POST_FILTER_NORMALIZER_SUSTAIN_STRETCH = 3;

export interface IPostFilterNormalizerState {
  limiter: ILinkedLimiterState;
  minimumGain: number;
  inputTruePeak: number;
  /**
   * How long the programme has been over the ceiling, in samples.
   *
   * How long the stage has been ASKED for reduction, and deliberately not how
   * long it has been giving it: see the note at the update site, where
   * measuring the latter turned the release into a feedback loop on itself.
   *
   * Per block rather than per sample: a block is about ten milliseconds and the
   * release times this scales are forty to four hundred, so sampling once a
   * block is well inside the quantity it controls — and it keeps every
   * per-sample path in `limiter.ts` untouched.
   */
  sustainSamples: number;
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
  state.sustainSamples = 0;
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
  state.sustainSamples = 0;
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
  sustainSamples: 0,
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
  const boundedReleaseMs = enabled
    ? Math.min(selectedReleaseMs, POST_FILTER_NORMALIZER_MAX_RELEASE_MS)
    : POST_FILTER_NORMALIZER_BYPASS_RELEASE_MS;
  /**
   * Program-dependent: the dialled release for a transient, slower for a
   * passage that has been held down.
   *
   * `sustainSamples` is how long the stage has already been reducing, measured
   * against the block that just went past, so this block's release reflects
   * what the music has been doing rather than what one sample did. A single
   * peak leaves it near zero and releases at the time on the dial. Sustained
   * limiting stretches it toward three times that, which is what stops the
   * level between peaks moving at the rate of the peaks themselves.
   *
   * Only while enabled. The bypass release is a fixed slow walk back to unity
   * and has nothing to be program-dependent about.
   */
  const sustainSpan = (POST_FILTER_NORMALIZER_SUSTAIN_MS / 1_000) * sampleRate;
  const sustained =
    enabled && sustainSpan > 0
      ? Math.min(1, state.sustainSamples / sustainSpan)
      : 0;
  const effectiveReleaseMs =
    boundedReleaseMs *
    (1 + sustained * (POST_FILTER_NORMALIZER_SUSTAIN_STRETCH - 1));
  const releaseCoefficient = Math.exp(
    -1 / ((effectiveReleaseMs / 1_000) * sampleRate),
  );
  const ceiling = enabled
    ? 10 ** (normalizedCeilingDb / 20)
    : Number.POSITIVE_INFINITY;
  processLinkedLimiter(limiter, channels, {
    ceiling,
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

  /**
   * Counted from whether the PROGRAMME is over the ceiling this block.
   *
   * Counting the blocks where the gain sat below unity looked equivalent and
   * was circular. An exponential release stays a tenth of a decibel down for
   * most of its run, so recovery itself kept feeding the counter, the counter
   * stretched the release, and the longer release lengthened the recovery:
   * after one 15 ms transient the bed was still 0.42 dB down half a second
   * later. That is a milder form of the level-riding this whole stage was
   * rebuilt to stop, and the transient test caught it.
   *
   * The incoming peak against the ceiling is the programme asking for
   * reduction rather than the stage still giving it back. A snare asks for two
   * blocks; a dense chorus asks for a thousand, and only the second is what a
   * slow release is for.
   *
   * Down at the same rate it goes up, so a passage broken by a bar of space
   * does not arrive back at the fast release the instant one peak relents.
   */
  const moved = channels[0]?.length ?? 0;
  state.sustainSamples =
    enabled && limiter.blockPeak > ceiling
      ? Math.min(sustainSpan, state.sustainSamples + moved)
      : Math.max(0, state.sustainSamples - moved);
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

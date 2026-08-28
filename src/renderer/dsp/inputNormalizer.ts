/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IMasterSettings,
  IInputNormalizerSettings,
  MASTER_LOUDNESS_GAIN_MAX_DB,
  MASTER_LOUDNESS_GAIN_MIN_DB,
} from '../../common/dsp/chain';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { ABSOLUTE_GATE_LUFS, createLoudnessAnalyzer } from './loudnessAnalysis';

/**
 * Bumped to 2 when the K-weighting stopped being the RBJ cookbook.
 *
 * The old filter under-weighted the presence region by up to a third of a dB,
 * so every cached number was slightly optimistic. The guards on both sides of
 * the IPC reject version 1, which re-measures a library rather than mixing two
 * meters' readings in one normalized playlist.
 */
const ANALYSIS_VERSION = 2;
const MAX_LOUDNESS_GAIN_DB = 12;
const MIN_NORMALIZER_GAIN_DB = -48;

export interface IInputAnalysisProgress {
  fraction: number;
}

export interface IAnalyzeInputOptions {
  sampleRateHint?: number;
  signal: AbortSignal;
  isCancelled: () => boolean;
  onProgress: (progress: IInputAnalysisProgress) => void;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/**
 * Decode and measure one complete file before its constant gain is chosen.
 *
 * The measurement itself is `loudnessAnalysis.ts` — BS.1770 blocks and gates,
 * with the true peak taken in the same pass. What stays here is the part that
 * needs a renderer: decoding, and yielding once per second of programme so a
 * large lossless file does not freeze the window. Cancellation is checked at
 * that same boundary when the queue moves on.
 */
export const analyzeInputTrack = async (
  bytes: ArrayBuffer,
  options: IAnalyzeInputOptions,
): Promise<ILibraryNormalizationAnalysis | undefined> => {
  const hinted = options.sampleRateHint;
  const analysisRate =
    typeof hinted === 'number' && Number.isFinite(hinted) && hinted >= 8_000
      ? Math.min(192_000, hinted)
      : 48_000;
  const context = new AudioContext({ sampleRate: analysisRate });
  let decoded: AudioBuffer | undefined;
  let resolveAbort: (() => void) | undefined;
  const aborted = new Promise<undefined>((resolve) => {
    if (options.signal.aborted) {
      resolve(undefined);
      return;
    }
    resolveAbort = () => resolve(undefined);
    options.signal.addEventListener('abort', resolveAbort, { once: true });
  });
  try {
    // Chromium may detach the buffer it decodes. The caller retains the
    // original for the player's blob, so analysis gets its own copy.
    decoded = await Promise.race([
      context.decodeAudioData(bytes.slice(0)).catch(() => undefined),
      aborted,
    ]);
  } catch {
    return undefined;
  } finally {
    if (resolveAbort) {
      options.signal.removeEventListener('abort', resolveAbort);
    }
    await context.close().catch(() => undefined);
  }
  if (!decoded || options.signal.aborted || options.isCancelled()) {
    return undefined;
  }

  const source = decoded;
  const channelCount = Math.min(2, source.numberOfChannels);
  if (channelCount === 0 || source.length === 0) {
    return undefined;
  }
  const channels = Array.from({ length: channelCount }, (_unused, channel) =>
    source.getChannelData(channel),
  );
  const analyzer = createLoudnessAnalyzer(source.sampleRate, channelCount);
  const yieldFrames = Math.max(1, Math.round(source.sampleRate));

  for (let from = 0; from < source.length; from += yieldFrames) {
    const to = Math.min(source.length, from + yieldFrames);
    analyzer.feed(channels, from, to);
    options.onProgress({ fraction: to / source.length });
    // eslint-disable-next-line no-await-in-loop -- deliberate renderer yield; see function comment.
    await nextFrame();
    if (options.signal.aborted || options.isCancelled()) {
      return undefined;
    }
  }

  const measurement = analyzer.finish();
  options.onProgress({ fraction: 1 });
  return {
    version: ANALYSIS_VERSION,
    truePeakDbtp: measurement.truePeakDbtp,
    integratedLufs: measurement.integratedLufs,
  };
};

/**
 * Which term produced the gain, when it was not the one the user set.
 *
 * `ceiling` is the common and the confusing one: a loudness target asks for a
 * boost, the track already peaks near or above full scale, and the true-peak
 * ceiling spends that room first. Reported so the panel can say which control
 * won instead of showing a number that contradicts the dial beside it.
 */
export type TNormalizerLimit =
  'none' | 'ceiling' | 'maxGain' | 'minGain' | 'gate';

export interface INormalizerGainBreakdown {
  /** What the selected mode asked for, before any limit was applied. */
  requestedDb: number;
  /** Ceiling minus measured true peak: what is left before clipping. */
  peakRoomDb: number;
  appliedDb: number;
  limitedBy: TNormalizerLimit;
}

/**
 * The gain and the reason for it, derived together.
 *
 * One function rather than a readout that recomputes the explanation beside an
 * engine that computes the value. Two derivations of the same number drift,
 * and a meter that disagrees with what is being applied is worse than no meter
 * at all — it is the audio lying with a straight face.
 *
 * This deliberately stays in TypeScript while the measurement goes native. The
 * panel and the engine have to agree on which control won, and that agreement
 * only holds while one function answers both.
 */
export const normalizerGainBreakdown = (
  settings: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): INormalizerGainBreakdown => {
  if (settings.mode === 'off' || !analysis) {
    return {
      requestedDb: 0,
      peakRoomDb: 0,
      appliedDb: 0,
      limitedBy: 'none',
    };
  }
  const peakRoomDb = settings.truePeakDbtp - analysis.truePeakDbtp;

  if (settings.mode === 'truePeak') {
    // The ceiling IS the target here, and the mode only ever comes down: a
    // track already under it is left alone rather than lifted to meet it.
    const requestedDb = Math.min(0, peakRoomDb);
    const appliedDb = Math.max(MIN_NORMALIZER_GAIN_DB, requestedDb);
    return {
      requestedDb,
      peakRoomDb,
      appliedDb,
      limitedBy: appliedDb > requestedDb ? 'minGain' : 'none',
    };
  }

  if (analysis.integratedLufs <= ABSOLUTE_GATE_LUFS) {
    return {
      requestedDb: 0,
      peakRoomDb,
      appliedDb: 0,
      limitedBy: 'gate',
    };
  }

  const requestedDb = settings.targetLufs - analysis.integratedLufs;
  const bounded = Math.min(MAX_LOUDNESS_GAIN_DB, requestedDb, peakRoomDb);
  const appliedDb = Math.max(MIN_NORMALIZER_GAIN_DB, bounded);

  let limitedBy: TNormalizerLimit = 'none';
  if (appliedDb > bounded) {
    limitedBy = 'minGain';
  } else if (peakRoomDb < requestedDb && peakRoomDb <= MAX_LOUDNESS_GAIN_DB) {
    limitedBy = 'ceiling';
  } else if (MAX_LOUDNESS_GAIN_DB < requestedDb) {
    limitedBy = 'maxGain';
  }

  return { requestedDb, peakRoomDb, appliedDb, limitedBy };
};

/** The one linked gain used from the first sample to the last. */
export const normalizerGainDb = (
  settings: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): number => normalizerGainBreakdown(settings, analysis).appliedDb;

/**
 * Constant LUFS-referenced makeup for Master.
 *
 * This deliberately never turns quiet passages into a moving target. It uses
 * the whole-track source measurement after input normalization, applies the
 * signed correction needed to reach the chosen programme target, and leaves
 * the final linked true-peak limiter to catch peaks introduced by creative
 * processors.
 */
export const masterLoudnessGainDb = (
  master: IMasterSettings,
  normalizer: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): number => {
  if (!master.enabled || !master.loudnessMaximize || !analysis) {
    return 0;
  }
  const normalizedLufs =
    analysis.integratedLufs + normalizerGainDb(normalizer, analysis);
  const normalizedPeak =
    analysis.truePeakDbtp + normalizerGainDb(normalizer, analysis);
  if (normalizedLufs <= ABSOLUTE_GATE_LUFS) {
    return 0;
  }
  const loudnessGain = master.loudnessTargetLufs - normalizedLufs;
  if (loudnessGain <= 0) {
    // A target is not merely a boost cap. A track louder than the selected
    // programme level must receive constant attenuation for the dial to mean
    // LUFS target rather than "maximum boost target".
    return Math.max(MASTER_LOUDNESS_GAIN_MIN_DB, loudnessGain);
  }
  // The cached whole-file true peak is known before playback. Spend only its
  // real remaining room instead of asking a live envelope to discover the
  // answer during a chorus and then undo it during a quiet passage.
  const peakRoom =
    master.ceilingDb - normalizedPeak - Math.max(0, master.outputTrimDb);
  return Math.max(
    0,
    Math.min(MASTER_LOUDNESS_GAIN_MAX_DB, loudnessGain, peakRoom),
  );
};

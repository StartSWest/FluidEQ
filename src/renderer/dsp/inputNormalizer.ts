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
import nextTask from '../../common/nextTask';
import {
  ABSOLUTE_GATE_LUFS,
  SILENCE_DB,
  createLoudnessAnalyzer,
} from './loudnessAnalysis';
import { createNoiseProfileAnalyzer } from './noiseAnalysis';
import { createProgrammeEdgeAnalyzer } from './programmeEdges';

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
  /**
   * Whether to measure the noise floor in the same pass.
   *
   * Off by default because it costs a second transform over every sample, and
   * a library whose owner never opens Denoise should not pay for it. The
   * caller turns it on only for an explicit noise-floor scan. Scanned profiles
   * must not appear halfway through playback merely because the stage is on.
   */
  measureNoise?: boolean;
}

/**
 * Frames measured between two yields to the window.
 *
 * The meters cost about a microsecond a frame at 44.1 kHz — 41 ms of
 * arithmetic per second of stereo, 57 ms with the noise floor, measured under
 * Node — so the one-second chunk this loop used while it waited a frame per
 * chunk held the thread for 41 to 57 ms at a time. It no longer waits for
 * frames (`nextTask`), so a chunk only has to be short: 4096 frames is 4 to
 * 5 ms at 44.1 kHz, and less at 96 and 192 kHz, where the true-peak meter
 * oversamples less.
 */
const CHUNK_FRAMES = 4096;

/**
 * Decode and measure one complete file before its constant gain is chosen.
 *
 * The measurement itself is `loudnessAnalysis.ts` — BS.1770 blocks and gates,
 * with the true peak taken in the same pass. What stays here is the part that
 * needs a renderer: decoding, and giving the thread back between short chunks
 * so a large lossless file does not freeze the window. Cancellation is checked
 * at that same boundary when the queue moves on.
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
  // The decode is the expensive half and it has already happened. Running the
  // edge detector over the same samples in the same loop is what keeps the
  // crossfade's measurement free rather than a second pass over the file.
  const edgeAnalyzer = createProgrammeEdgeAnalyzer(
    source.sampleRate,
    channelCount,
  );
  // Same reasoning as the edge detector above: the decode is the expensive
  // half and it has already happened, so measuring the floor in this loop is
  // what keeps it from being a second pass over the whole file.
  const noiseAnalyzer = options.measureNoise
    ? createNoiseProfileAnalyzer(source.sampleRate, channelCount)
    : undefined;

  /**
   * Progress, handed on at most once per painted frame.
   *
   * The loop runs a chunk every few milliseconds now, and each report
   * re-renders the player's provider and the DSP panel through the store;
   * nothing can show a fraction between two paints. A hidden window paints
   * nothing, so it hears nothing until the end.
   */
  let fraction = 0;
  let progressFrame = 0;
  const reportProgress = () => {
    progressFrame = 0;
    options.onProgress({ fraction });
  };
  try {
    for (let from = 0; from < source.length; from += CHUNK_FRAMES) {
      const to = Math.min(source.length, from + CHUNK_FRAMES);
      analyzer.feed(channels, from, to);
      edgeAnalyzer.feed(channels, from, to);
      noiseAnalyzer?.feed(channels, from, to);
      fraction = to / source.length;
      if (progressFrame === 0) {
        progressFrame = requestAnimationFrame(reportProgress);
      }
      // A task, never an animation frame: a minimised or covered window runs
      // no frames, and waiting for one parked the job after its first chunk
      // holding the whole decoded file, deaf to the abort that replaced it.
      // eslint-disable-next-line no-await-in-loop -- deliberate renderer yield; see function comment.
      await nextTask(options.signal);
      if (options.signal.aborted || options.isCancelled()) {
        return undefined;
      }
    }
  } finally {
    // A frame still pending would report after the final fraction, or after
    // the job was dropped: the panel back on "analysing" over a finished or
    // abandoned measurement.
    cancelAnimationFrame(progressFrame);
  }

  const measurement = analyzer.finish();
  options.onProgress({ fraction: 1 });
  return {
    version: ANALYSIS_VERSION,
    truePeakDbtp: measurement.truePeakDbtp,
    integratedLufs: measurement.integratedLufs,
    edges: edgeAnalyzer.finish(),
    noise: noiseAnalyzer?.finish(),
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

/** Which term produced the Master makeup, when it was not the target. */
/**
 * `noTrack` is its own answer rather than `none`, because the two look
 * identical on the card and mean opposite things: `none` is "the target was
 * reached and cost nothing", `noTrack` is "there was nothing to measure".
 * The makeup is one constant read from a whole track, so it exists only while
 * the Library is the source; on system audio the dial read -9 LUFS and the
 * line under it read +0.0 dB for ever, with nothing saying why.
 */
export type TMasterLoudnessLimit =
  'none' | 'limiting' | 'maxGain' | 'gate' | 'noTrack';

export interface IMasterLoudnessBreakdown {
  /** The whole-track level the target is measured against, after Normalizer. */
  normalizedLufs: number;
  /** Target minus that: what reaching the target costs, before any limit. */
  requestedDb: number;
  /** Ceiling minus the normalized true peak: makeup that needs no limiting. */
  peakRoomDb: number;
  /** Makeup beyond the peak room, which Auto Headroom will hold down. */
  limitingDb: number;
  appliedDb: number;
  limitedBy: TMasterLoudnessLimit;
}

/**
 * Constant LUFS-referenced makeup for Master, and the reason for it.
 *
 * One function rather than a readout that recomputes the explanation beside an
 * engine that computes the value, for the same reason `normalizerGainBreakdown`
 * is one function: two derivations of the same number drift, and a meter that
 * disagrees with what is being applied is the audio lying with a straight face.
 *
 * This deliberately never turns quiet passages into a moving target. It uses
 * the whole-track source measurement after input normalization and applies one
 * signed constant correction from the first sample to the last.
 *
 * ## Why the makeup is allowed past the track's remaining peak room
 *
 * It used to be capped at `ceiling - normalizedPeak`, which sounds prudent and
 * is not: with the shipped defaults the Normalizer holds every track's peak at
 * -1 dBTP and this stage's ceiling is also -1 dBTP, so that room is exactly
 * zero and the makeup was exactly 0.0 dB on every commercially mastered record
 * ever made. On quiet material the cap bit at a different place for every
 * track — a -20 LUFS record asking for +11 dB received +5 because its peaks
 * happened to sit lower — so the stage reached its target on nothing and left
 * the loudness moving between tracks, which is the complaint it exists to fix.
 *
 * Auto Headroom is the look-ahead, soft-knee, true-peak limiter that runs
 * immediately before the master gain and ONLY while this is enabled, and it
 * already reserves the gain still to come. So makeup beyond the peak room does
 * not clip; it costs limiting. `peakLimitingDb` is how much of that cost the
 * user has agreed to, and at 0 the old peak-safe behaviour returns exactly.
 */
export const masterLoudnessBreakdown = (
  master: IMasterSettings,
  normalizer: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): IMasterLoudnessBreakdown => {
  const idle: IMasterLoudnessBreakdown = {
    normalizedLufs: SILENCE_DB,
    requestedDb: 0,
    peakRoomDb: 0,
    limitingDb: 0,
    appliedDb: 0,
    limitedBy: 'none',
  };
  if (!master.enabled || !master.loudnessMaximize) {
    return idle;
  }
  if (!analysis) {
    return { ...idle, limitedBy: 'noTrack' };
  }
  const normalizerDb = normalizerGainDb(normalizer, analysis);
  const normalizedLufs = analysis.integratedLufs + normalizerDb;
  const normalizedPeak = analysis.truePeakDbtp + normalizerDb;
  if (normalizedLufs <= ABSOLUTE_GATE_LUFS) {
    return { ...idle, normalizedLufs, limitedBy: 'gate' };
  }
  const peakRoomDb =
    master.ceilingDb - normalizedPeak - Math.max(0, master.outputTrimDb);
  const requestedDb = master.loudnessTargetLufs - normalizedLufs;
  if (requestedDb <= 0) {
    // A target is not merely a boost cap. A track louder than the selected
    // programme level must receive constant attenuation for the dial to mean
    // LUFS target rather than "maximum boost target".
    const appliedDb = Math.max(MASTER_LOUDNESS_GAIN_MIN_DB, requestedDb);
    return {
      normalizedLufs,
      requestedDb,
      peakRoomDb,
      limitingDb: 0,
      appliedDb,
      limitedBy: appliedDb > requestedDb ? 'maxGain' : 'none',
    };
  }

  const allowed = peakRoomDb + master.peakLimitingDb;
  const appliedDb = Math.max(
    0,
    Math.min(MASTER_LOUDNESS_GAIN_MAX_DB, requestedDb, allowed),
  );
  let limitedBy: TMasterLoudnessLimit = 'none';
  if (allowed < requestedDb && allowed <= MASTER_LOUDNESS_GAIN_MAX_DB) {
    limitedBy = 'limiting';
  } else if (MASTER_LOUDNESS_GAIN_MAX_DB < requestedDb) {
    limitedBy = 'maxGain';
  }
  return {
    normalizedLufs,
    requestedDb,
    peakRoomDb,
    // What Auto Headroom is being asked to absorb, which is the number that
    // decides whether this sounds like level or like a limiter working.
    limitingDb: Math.max(0, appliedDb - peakRoomDb),
    appliedDb,
    limitedBy,
  };
};

/** The one linked makeup used from the first sample to the last. */
export const masterLoudnessGainDb = (
  master: IMasterSettings,
  normalizer: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): number => masterLoudnessBreakdown(master, normalizer, analysis).appliedDb;

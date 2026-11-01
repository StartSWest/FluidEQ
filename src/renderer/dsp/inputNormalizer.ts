/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import nextTask from '../../common/nextTask';
import { createLoudnessAnalyzer } from './loudnessAnalysis';
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

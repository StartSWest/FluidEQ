/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ILibraryProgrammeEdges } from '../../common/library/types';
import { dbFromMagnitude } from './loudnessAnalysis';

/**
 * Where the music starts and stops inside a file, which is not where the file
 * starts and stops.
 *
 * A crossfade scheduled against the container's duration is scheduled against
 * padding. Five seconds of digital silence at the end of a track and a
 * two-second overlap means the fade begins three seconds INTO the silence:
 * both decks inaudible for the whole of it, and the next song arriving only
 * when the padding runs out. The same at the head, from the other side — the
 * incoming deck spends its fade-in playing nothing.
 *
 * Streaming, and deliberately the same `feed`/`finish` shape as
 * `createLoudnessAnalyzer`, so one decode pass in `analyzeInputTrack` can run
 * both meters over the same samples at the same yield boundary.
 */

/**
 * The level below which a window counts as padding.
 *
 * -60 dBFS RMS, not peak: a lone sample of encoder noise or a click at the
 * very end of a file does not reach it, and a genuine fade-out is already
 * inaudible by the time it crosses. Absolute rather than relative to the
 * track's own peak, because what is being detected is an absence of programme,
 * not a quiet passage of one.
 */
const THRESHOLD_DBFS = -60;
/** Fine enough to place an edge inside a syllable, coarse enough to average. */
const WINDOW_MS = 20;
/**
 * How much continuous signal makes programme rather than an artefact.
 *
 * One window over the threshold is a pop; three in a row is 60ms of sound,
 * which is a note. Without the run, a single click in a track's trailing
 * silence would put the programme end back where the padding ends and undo
 * the whole measurement.
 */
const RUN_WINDOWS = 3;

export interface IProgrammeEdgeAnalyzer {
  /** Planar, one array per channel. `from`/`to` are frame indices into them. */
  feed: (channels: readonly Float32Array[], from: number, to: number) => void;
  finish: () => ILibraryProgrammeEdges;
}

export const createProgrammeEdgeAnalyzer = (
  sampleRate: number,
  channelCount: number,
): IProgrammeEdgeAnalyzer => {
  const channels = Math.max(1, Math.min(2, channelCount));
  const windowFrames = Math.max(
    1,
    Math.round((sampleRate * WINDOW_MS) / 1_000),
  );
  const msPerFrame = 1_000 / sampleRate;
  let energy = 0;
  let framesInWindow = 0;
  let windowsClosed = 0;
  let run = 0;
  let firstAudibleFrame: number | undefined;
  let lastAudibleFrame = 0;
  let totalFrames = 0;

  /**
   * Judge one closed window. `frames` is what it actually holds, which is
   * `windowFrames` except for the partial one flushed at end of file.
   */
  const closeWindow = (frames: number) => {
    const rms = Math.sqrt(energy / Math.max(1, frames * channels));
    const windowStart = windowsClosed * windowFrames;
    windowsClosed += 1;
    energy = 0;
    framesInWindow = 0;
    if (dbFromMagnitude(rms) < THRESHOLD_DBFS) {
      run = 0;
      return;
    }
    run += 1;
    if (run < RUN_WINDOWS) {
      return;
    }
    if (firstAudibleFrame === undefined) {
      // The run qualifies on its last window, but the programme began on its
      // first: back up over the windows that were held pending.
      firstAudibleFrame = windowStart - (RUN_WINDOWS - 1) * windowFrames;
    }
    lastAudibleFrame = windowStart + frames;
  };

  return {
    feed: (input, from, to) => {
      for (let frame = from; frame < to; frame += 1) {
        for (let channel = 0; channel < channels; channel += 1) {
          const sample = input[channel][frame];
          energy += sample * sample;
        }
        framesInWindow += 1;
        totalFrames += 1;
        if (framesInWindow === windowFrames) {
          closeWindow(windowFrames);
        }
      }
    },
    finish: () => {
      if (framesInWindow > 0) {
        closeWindow(framesInWindow);
      }
      const totalMs = totalFrames * msPerFrame;
      if (firstAudibleFrame === undefined) {
        // Nothing in the file reached the threshold. Reporting an empty
        // programme would make every transition instant; a file this quiet is
        // played exactly as it is instead.
        return { leadInMs: 0, endMs: Math.round(totalMs) };
      }
      return {
        leadInMs: Math.round(Math.max(0, firstAudibleFrame) * msPerFrame),
        endMs: Math.round(Math.min(totalFrames, lastAudibleFrame) * msPerFrame),
      };
    },
  };
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerMaximumAutomaticWordDurationMs,
} from '../../../common/karaoke/makerProject';

export interface IKaraokeMakerAnalysisWindow {
  startMs: number;
  endMs: number;
}

/**
 * Where a word is waiting without a timing, bounded by the timed words around
 * it.
 *
 * The melody repair can only place a word onto a note that exists, and notes
 * only existed where words were already timed — so the detector was never
 * asked to look at precisely the stretches where words were missing. Measured
 * on one song: 50 words had no timing, the repair reached 1 of them, and the
 * 81-second hole they sat in had never been analysed.
 *
 * The bounds are the ones the repair itself uses to accept an answer, so this
 * asks about exactly the span a repaired word is allowed to land in.
 */
const untimedLyricWindows = (
  project: IKaraokeMakerProject,
  durationMs: number,
): IKaraokeMakerAnalysisWindow[] => {
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  const windows: IKaraokeMakerAnalysisWindow[] = [];
  let runStart: number | undefined;
  tokens.forEach((token, index) => {
    const isTimed = token.startMs !== undefined && token.endMs !== undefined;
    if (!isTimed) {
      if (runStart === undefined) {
        runStart = index;
      }
      if (index < tokens.length - 1) {
        return;
      }
    }
    if (runStart === undefined) {
      return;
    }
    const before = tokens
      .slice(0, runStart)
      .reverse()
      .find((candidate) => candidate.endMs !== undefined);
    const after = tokens
      .slice(index + (isTimed ? 0 : 1))
      .find((candidate) => candidate.startMs !== undefined);
    const startMs = Math.max(0, before?.endMs ?? 0);
    // The whole bounded gap, deliberately. Capping it to what the waiting
    // words could plausibly occupy would anchor the window at the start of the
    // gap, which is the same error as trimming an over-long word span from its
    // start: the words are somewhere in here and nothing says where. This span
    // is exactly the range the repair is allowed to place them into, so asking
    // about less than all of it can only hide the answer.
    const endMs = Math.min(
      durationMs,
      after?.startMs ?? (Number.isFinite(durationMs) ? durationMs : 0),
    );
    if (endMs > startMs) {
      windows.push({ startMs, endMs });
    }
    runStart = undefined;
  });
  return windows;
};

/** Merge timed lyric words into padded vocal phrases for pitch analysis. */
export const karaokeMakerVocalAnalysisWindows = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAnalysisWindow[] => {
  const durationMs = project.audio.durationMs ?? Number.POSITIVE_INFINITY;
  const raw = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => {
      const timed = line.tokens.filter(
        (token) =>
          token.startMs !== undefined &&
          token.endMs !== undefined &&
          token.endMs > token.startMs,
      );
      if (!timed.length) {
        return [];
      }
      return [
        {
          startMs: Math.max(
            0,
            Math.min(...timed.map((token) => token.startMs as number)) - 220,
          ),
          endMs: Math.min(
            durationMs,
            Math.max(...timed.map((token) => token.endMs as number)) + 220,
          ),
        },
      ];
    })
    .concat(untimedLyricWindows(project, durationMs))
    .sort((left, right) => left.startMs - right.startMs);
  const merged: IKaraokeMakerAnalysisWindow[] = [];
  raw.forEach((window) => {
    const previous = merged[merged.length - 1];
    if (previous && window.startMs - previous.endMs <= 500) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
    } else {
      merged.push({ ...window });
    }
  });
  return merged;
};

export const maximumAutomaticWordDurationMs = (text: string): number => {
  // Corpus calibration: 99% of one-letter words are below 500 ms and 99% of
  // ordinary words below roughly 2.5 s. This generous ceiling still permits a
  // held note but rejects a chunk-sized 20–30 second "word" timestamp.
  return karaokeMakerMaximumAutomaticWordDurationMs(text);
};

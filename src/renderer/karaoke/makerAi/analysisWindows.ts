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

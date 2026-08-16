/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerAnalysisNote,
  karaokeMakerAnalysisOffsetMs,
} from '../makerAnalysis';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerId,
  karaokeMakerLineIsSection,
} from '../../../common/karaoke/makerProject';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import {
  absorbPitchRun,
  IKaraokeMakerPitchRun,
  KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN,
  KARAOKE_GUIDE_MIN_NOTE_MS,
  KARAOKE_GUIDE_STABLE_CHANGE_MS,
  mergePitchRuns,
  splitLongestPitchRun,
  splitPitchRunAt,
  traceVocalPitchFrames,
} from './pitchRuns';

const syllableBoundariesForToken = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  language: string,
  desiredCount: number,
): number[] => {
  const syllables = splitKaraokeWordSyllables(token.text, language);
  if (desiredCount <= 1 || syllables.length <= 1) {
    return [];
  }
  const weights = syllables.map((syllable) =>
    Math.max(
      1,
      Array.from(syllable).filter((character) =>
        /[\p{L}\p{N}]/u.test(character),
      ).length,
    ),
  );
  const cumulative = weights.reduce<number[]>((values, weight) => {
    values.push((values[values.length - 1] ?? 0) + weight);
    return values;
  }, []);
  const totalWeight = cumulative[cumulative.length - 1] ?? 1;
  const durationMs = token.endMs - token.startMs;
  return Array.from({ length: desiredCount - 1 }, (_value, index) => {
    const targetWeight = (totalWeight * (index + 1)) / desiredCount;
    const syllableIndex = Math.min(
      cumulative.length - 2,
      Math.max(
        0,
        cumulative.findIndex((value) => value >= targetWeight),
      ),
    );
    return Math.round(
      token.startMs + (durationMs * cumulative[syllableIndex]) / totalWeight,
    );
  });
};

const pitchRunsForToken = (
  token: IKaraokeMakerToken & { startMs: number; endMs: number },
  candidates: readonly IKaraokeMakerAnalysisNote[],
  language: string,
  previousMidi?: number,
): IKaraokeMakerPitchRun[] => {
  const frames = traceVocalPitchFrames(token, candidates, previousMidi);
  let runs = mergePitchRuns(frames);
  // Short pitch flickers are normally vibrato, consonant transitions or an
  // accompaniment candidate—not a new singable target.
  let shortIndex = runs.findIndex(
    (run) => run.endMs - run.startMs < KARAOKE_GUIDE_STABLE_CHANGE_MS,
  );
  while (shortIndex >= 0 && runs.length > 1) {
    absorbPitchRun(runs, shortIndex);
    runs = mergePitchRuns(runs);
    shortIndex = runs.findIndex(
      (run) => run.endMs - run.startMs < KARAOKE_GUIDE_STABLE_CHANGE_MS,
    );
  }
  if (!runs.length) {
    return [];
  }
  while (runs.length > KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN) {
    let weakestIndex = 0;
    let weakestWeight = runs[0].confidence * (runs[0].endMs - runs[0].startMs);
    for (let runIndex = 1; runIndex < runs.length; runIndex += 1) {
      const run = runs[runIndex];
      const weight = run.confidence * (run.endMs - run.startMs);
      if (weight < weakestWeight) {
        weakestWeight = weight;
        weakestIndex = runIndex;
      }
    }
    absorbPitchRun(runs, weakestIndex);
    runs = mergePitchRuns(runs);
  }
  const syllableCount = splitKaraokeWordSyllables(token.text, language).length;
  const desiredCount = Math.min(
    KARAOKE_GUIDE_MAX_NOTES_PER_TOKEN,
    Math.max(
      1,
      Math.min(
        syllableCount,
        Math.floor((token.endMs - token.startMs) / KARAOKE_GUIDE_MIN_NOTE_MS),
      ),
      runs.length,
    ),
  );
  // A held pitch still needs readable syllable-sized guide blocks. Split a
  // flat run at language-aware syllable boundaries before falling back to a
  // geometric midpoint. Real stable pitch changes retain their measured time.
  syllableBoundariesForToken(token, language, desiredCount).forEach(
    (boundaryMs) => {
      if (runs.length < desiredCount) {
        splitPitchRunAt(runs, boundaryMs);
      }
    },
  );
  while (runs.length < desiredCount) {
    splitLongestPitchRun(runs);
  }
  // Whisper's word window is the timing authority. Make the guide cover that
  // exact sung interval and share every internal boundary without overlap.
  runs[0].startMs = token.startMs;
  runs[runs.length - 1].endMs = token.endMs;
  for (let index = 0; index < runs.length - 1; index += 1) {
    const boundary = Math.round(
      (runs[index].endMs + runs[index + 1].startMs) / 2,
    );
    runs[index].endMs = boundary;
    runs[index + 1].startMs = boundary;
  }
  return runs;
};

/**
 * Basic Pitch intentionally returns polyphonic candidates. Whisper supplies
 * the sung word windows; trace one stable vocal pitch path inside each window,
 * suppress vibrato flicker, and add boundaries for inferred syllables. A pitch
 * change may add another note, but the authored guide stays at three or fewer
 * targets per lyric token—the distribution observed in the calibration set.
 */
export const karaokeMakerMelodyNotesForLyrics = (
  project: IKaraokeMakerProject,
  candidates: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerAnalysisNote[] => {
  const timedTokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens)
    .filter(
      (
        token,
      ): token is IKaraokeMakerToken & { startMs: number; endMs: number } =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        token.endMs > token.startMs,
    )
    .sort((left, right) => left.startMs - right.startMs);
  if (!timedTokens.length) {
    return [];
  }
  const timingOffsetMs = candidates.length
    ? karaokeMakerAnalysisOffsetMs(
        project,
        Math.min(...candidates.map((note) => note.startMs)),
      )
    : 0;
  const usableCandidates = candidates
    .filter(
      (note) =>
        Number.isFinite(note.targetMidi) &&
        note.targetMidi >= 38 &&
        note.targetMidi <= 88 &&
        note.endMs - note.startMs >= 55 &&
        note.endMs - note.startMs <= 8_000 &&
        note.confidence >= 0.12,
    )
    .map((note) => ({
      ...note,
      startMs: note.startMs + timingOffsetMs,
      endMs: note.endMs + timingOffsetMs,
    }))
    .sort((left, right) => left.startMs - right.startMs);
  const melody: IKaraokeMakerAnalysisNote[] = [];
  let previousMidi: number | undefined;
  let candidateCursor = 0;
  timedTokens.forEach((token) => {
    while (
      candidateCursor < usableCandidates.length &&
      usableCandidates[candidateCursor].endMs <= token.startMs
    ) {
      candidateCursor += 1;
    }
    let candidateEnd = candidateCursor;
    while (
      candidateEnd < usableCandidates.length &&
      usableCandidates[candidateEnd].startMs < token.endMs
    ) {
      candidateEnd += 1;
    }
    const runs = pitchRunsForToken(
      token,
      usableCandidates.slice(candidateCursor, candidateEnd),
      project.lyrics.language ?? 'en',
      previousMidi,
    );
    if (runs.length) {
      previousMidi = runs[runs.length - 1].targetMidi;
      melody.push(
        ...runs.map((run) => ({
          startMs: Math.round(run.startMs),
          endMs: Math.round(run.endMs),
          targetMidi: run.targetMidi,
          confidence: run.confidence,
        })),
      );
    }
  });
  return melody;
};

export const autoAlignNotesOnly = (
  project: IKaraokeMakerProject,
  notes: readonly IKaraokeMakerAnalysisNote[],
  source: 'basic-pitch' | 'pitch-analysis',
): IKaraokeMakerProject => {
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  return {
    ...project,
    melody: {
      ...project.melody,
      source,
      notes: [
        ...project.melody.notes.filter((note) => note.source === 'manual'),
        ...notes
          .filter(
            (note) =>
              !project.melody.notes.some(
                (existing) =>
                  existing.source === 'manual' &&
                  existing.startMs < note.endMs &&
                  note.startMs < existing.endMs,
              ),
          )
          .map((note) => {
            const { startMs, endMs } = note;
            const midpoint = (startMs + endMs) / 2;
            const containing = tokens.find(
              (token) =>
                token.startMs !== undefined &&
                token.endMs !== undefined &&
                midpoint >= token.startMs &&
                midpoint <= token.endMs,
            );
            return {
              id: karaokeMakerId('note'),
              tokenId: containing?.id,
              startMs,
              endMs,
              targetMidi: note.targetMidi,
              confidence: note.confidence,
              kind: 'normal' as const,
              source,
            };
          }),
      ].sort((left, right) => left.startMs - right.startMs),
    },
  };
};

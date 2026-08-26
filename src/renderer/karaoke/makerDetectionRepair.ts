/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  synchronizeKaraokeMakerSections,
} from '../../common/karaoke/makerProject';

const tokenHasTiming = (
  token: IKaraokeMakerToken,
): token is IKaraokeMakerToken & { startMs: number; endMs: number } =>
  token.startMs !== undefined &&
  token.endMs !== undefined &&
  token.endMs > token.startMs;

const withTokenRange = (
  line: IKaraokeMakerLine,
  baseline?: IKaraokeMakerLine,
): IKaraokeMakerLine => {
  const timed = line.tokens.filter(tokenHasTiming);
  if (!timed.length) {
    return {
      ...line,
      startMs: baseline?.startMs ?? line.startMs,
      endMs: baseline?.endMs ?? line.endMs,
    };
  }
  const tokenStartMs = Math.min(...timed.map((token) => token.startMs));
  const tokenEndMs = Math.max(...timed.map((token) => token.endMs));
  return {
    ...line,
    startMs:
      baseline?.startMs === undefined
        ? tokenStartMs
        : Math.min(baseline.startMs, tokenStartMs),
    endMs:
      baseline?.endMs === undefined
        ? tokenEndMs
        : Math.max(baseline.endMs, tokenEndMs),
  };
};

/**
 * Turn every valid existing word into an alignment anchor for one detector run.
 * This copy is never published: the original manual/automatic ownership flags
 * are restored by `mergeKaraokeMakerDetectionRepair` after detection.
 */
export const protectKaraokeMakerTimedWordsForDetection = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => ({
  ...project,
  lyrics: {
    ...project.lyrics,
    lines: project.lyrics.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) =>
        tokenHasTiming(token) ? { ...token, timingLocked: true } : token,
      ),
    })),
  },
});

/**
 * Publish only repairs for words that were missing timing at the start.
 *
 * Whisper and the melody detector still see the whole recording for context,
 * but every pre-existing timed word is restored byte-for-byte in timing and
 * ownership. Notes linked to those protected words are restored too; detected
 * notes remain available for words that were previously untimed.
 */
export const mergeKaraokeMakerDetectionRepair = (
  baseline: IKaraokeMakerProject,
  detected: IKaraokeMakerProject,
): IKaraokeMakerProject => {
  const protectedTokens = new Map(
    baseline.lyrics.lines.flatMap((line) =>
      line.tokens
        .filter(tokenHasTiming)
        .map((token) => [token.id, token] as const),
    ),
  );
  const protectedTokenIds = new Set(protectedTokens.keys());
  const baselineLines = new Map(
    baseline.lyrics.lines.map((line) => [line.id, line] as const),
  );
  const lines = detected.lyrics.lines.map((line) =>
    withTokenRange(
      {
        ...line,
        tokens: line.tokens.map((token) => {
          const original = protectedTokens.get(token.id);
          return original
            ? {
                ...token,
                startMs: original.startMs,
                endMs: original.endMs,
                confidence: original.confidence,
                source: original.source,
                timingLocked: original.timingLocked,
              }
            : token;
        }),
      },
      baselineLines.get(line.id),
    ),
  );
  const preservedNotes = baseline.melody.notes.filter(
    (note) =>
      note.source === 'manual' ||
      (note.tokenId !== undefined && protectedTokenIds.has(note.tokenId)),
  );
  const preservedNoteIds = new Set(preservedNotes.map((note) => note.id));
  const detectedNotes = detected.melody.notes.filter(
    (note) =>
      !preservedNoteIds.has(note.id) &&
      (note.tokenId === undefined || !protectedTokenIds.has(note.tokenId)),
  );
  return synchronizeKaraokeMakerSections({
    ...detected,
    lyrics: { ...detected.lyrics, lines },
    melody: {
      ...detected.melody,
      notes: [...preservedNotes, ...detectedNotes].sort(
        (left, right) =>
          left.startMs - right.startMs ||
          left.endMs - right.endMs ||
          left.id.localeCompare(right.id),
      ),
    },
  });
};

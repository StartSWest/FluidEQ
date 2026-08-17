/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Moving a performance in time without breaking what it is linked to.
 *
 * The whole timeline at once, or one line's tail from a chosen token. Both are
 * bulk moves: they preserve the relationships between lyrics and melody notes
 * rather than asking about any single edge, which is what separates them from
 * `boundaries`.
 */
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerRecordedLineRange,
} from './model';
/**
 * Moves the complete authored performance on the audio timeline. Timed lyrics
 * and melody notes are shifted as one unit so their links cannot drift apart.
 * The effective shift is clamped at the beginning of the audio timeline.
 */
export const shiftKaraokeMakerTimeline = (
  project: IKaraokeMakerProject,
  requestedDeltaMs: number,
): IKaraokeMakerProject => {
  if (!Number.isFinite(requestedDeltaMs) || requestedDeltaMs === 0) {
    return project;
  }

  const timedStarts = [
    ...project.lyrics.lines.flatMap((line) => [
      ...(line.startMs === undefined ? [] : [line.startMs]),
      ...line.tokens.flatMap((token) =>
        token.startMs === undefined ? [] : [token.startMs],
      ),
    ]),
    ...project.melody.notes.map((note) => note.startMs),
  ];
  const earliest = timedStarts.length > 0 ? Math.min(...timedStarts) : 0;
  const deltaMs = Math.round(Math.max(requestedDeltaMs, -earliest));
  if (deltaMs === 0) {
    return project;
  }

  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      lines: project.lyrics.lines.map((line) => ({
        ...line,
        startMs:
          line.startMs === undefined ? undefined : line.startMs + deltaMs,
        endMs: line.endMs === undefined ? undefined : line.endMs + deltaMs,
        tokens: line.tokens.map((token) => ({
          ...token,
          startMs:
            token.startMs === undefined ? undefined : token.startMs + deltaMs,
          endMs: token.endMs === undefined ? undefined : token.endMs + deltaMs,
        })),
      })),
    },
    melody: {
      ...project.melody,
      notes: project.melody.notes.map((note) => ({
        ...note,
        startMs: note.startMs + deltaMs,
        endMs: note.endMs + deltaMs,
      })),
    },
    meta: {
      ...project.meta,
      gapMs: project.meta.gapMs + deltaMs,
    },
  };
};

/**
 * Move one word and every following word in the same lyric line as a single
 * ordered block. Prefix words and neighbouring lines remain fixed, while
 * linked melody notes follow their owning words.
 */
export const shiftKaraokeMakerLineTailFromToken = (
  project: IKaraokeMakerProject,
  tokenId: string,
  requestedDeltaMs: number,
): IKaraokeMakerProject => {
  if (!Number.isFinite(requestedDeltaMs) || requestedDeltaMs === 0) {
    return project;
  }
  const lineIndex = project.lyrics.lines.findIndex(
    (line) =>
      !karaokeMakerLineIsSection(line) &&
      line.tokens.some((token) => token.id === tokenId),
  );
  if (lineIndex < 0) {
    return project;
  }
  const line = project.lyrics.lines[lineIndex];
  const selectedIndex = line.tokens.findIndex((token) => token.id === tokenId);
  let anchorIndex = selectedIndex;
  while (anchorIndex > 0 && line.tokens[anchorIndex].startsWord === false) {
    anchorIndex -= 1;
  }
  const affectedTokens = line.tokens.slice(anchorIndex);
  const affectedTokenIds = new Set(affectedTokens.map((token) => token.id));
  const linkedNotes = project.melody.notes.filter(
    (note) => note.tokenId && affectedTokenIds.has(note.tokenId),
  );
  const affectedStarts = [
    ...affectedTokens.flatMap((token) =>
      token.startMs === undefined ? [] : [token.startMs],
    ),
    ...linkedNotes.map((note) => note.startMs),
  ];
  const affectedEnds = [
    ...affectedTokens.flatMap((token) =>
      token.endMs === undefined ? [] : [token.endMs],
    ),
    ...linkedNotes.map((note) => note.endMs),
  ];
  if (!affectedStarts.length || !affectedEnds.length) {
    return project;
  }
  const previousEndMs = line.tokens
    .slice(0, anchorIndex)
    .reduce(
      (latest, token) => Math.max(latest, token.endMs ?? token.startMs ?? 0),
      0,
    );
  const fixedLineRange = karaokeMakerRecordedLineRange(line);
  const nextLineStartMs = project.lyrics.lines
    .slice(lineIndex + 1)
    .filter((candidate) => !karaokeMakerLineIsSection(candidate))
    .flatMap((candidate) => candidate.tokens)
    .reduce(
      (earliest, token) =>
        token.startMs === undefined
          ? earliest
          : Math.min(earliest, token.startMs),
      Number.POSITIVE_INFINITY,
    );
  const earliestAffectedMs = Math.min(...affectedStarts);
  const latestAffectedMs = Math.max(...affectedEnds);
  const minimumBoundaryMs = Math.max(
    previousEndMs,
    fixedLineRange?.startMs ?? 0,
  );
  const minimumDeltaMs = minimumBoundaryMs - earliestAffectedMs;
  let maximumBoundaryMs = project.audio.durationMs ?? Number.POSITIVE_INFINITY;
  if (fixedLineRange) {
    maximumBoundaryMs = fixedLineRange.endMs;
  } else if (Number.isFinite(nextLineStartMs)) {
    maximumBoundaryMs = nextLineStartMs;
  }
  const maximumDeltaMs = maximumBoundaryMs - latestAffectedMs;
  if (minimumDeltaMs > maximumDeltaMs) {
    return project;
  }
  const requested = Math.round(requestedDeltaMs);
  const deltaMs = Math.max(minimumDeltaMs, Math.min(maximumDeltaMs, requested));
  if (!Number.isFinite(deltaMs) || deltaMs === 0) {
    return project;
  }
  const linkedNoteIds = new Set(linkedNotes.map((note) => note.id));
  const shiftedTokens = line.tokens.map((token) =>
    affectedTokenIds.has(token.id)
      ? {
          ...token,
          startMs:
            token.startMs === undefined ? undefined : token.startMs + deltaMs,
          endMs: token.endMs === undefined ? undefined : token.endMs + deltaMs,
          source: 'manual' as const,
          timingLocked:
            token.startMs !== undefined && token.endMs !== undefined
              ? true
              : token.timingLocked,
        }
      : token,
  );
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      source: 'manual',
      lines: project.lyrics.lines.map((candidate, candidateIndex) =>
        candidateIndex === lineIndex
          ? {
              ...candidate,
              startMs:
                fixedLineRange?.startMs ??
                shiftedTokens.reduce(
                  (earliest, token) =>
                    token.startMs === undefined
                      ? earliest
                      : Math.min(earliest, token.startMs),
                  Number.POSITIVE_INFINITY,
                ),
              endMs:
                fixedLineRange?.endMs ??
                shiftedTokens.reduce(
                  (latest, token) => Math.max(latest, token.endMs ?? 0),
                  0,
                ),
              tokens: shiftedTokens,
            }
          : candidate,
      ),
    },
    melody: {
      ...project.melody,
      source: linkedNoteIds.size ? 'manual' : project.melody.source,
      notes: project.melody.notes.map((note) =>
        linkedNoteIds.has(note.id)
          ? {
              ...note,
              startMs: note.startMs + deltaMs,
              endMs: note.endMs + deltaMs,
              source: 'manual',
            }
          : note,
      ),
    },
  };
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerLine,
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  KARAOKE_MAKER_LINE_SAFE_GAP_MS,
  karaokeMakerLineIsSection,
  synchronizeKaraokeMakerSections,
} from '../../common/karaoke/makerProject';

/** Rebuild a line's explicit range after words cross its boundary. */
const withTokenRange = (line: IKaraokeMakerLine): IKaraokeMakerLine => {
  const timed = line.tokens.filter(
    (token) => token.startMs !== undefined && token.endMs !== undefined,
  );
  return {
    ...line,
    startMs: timed.length
      ? Math.min(...timed.map((token) => token.startMs as number))
      : undefined,
    endMs: timed.length
      ? Math.max(...timed.map((token) => token.endMs as number))
      : undefined,
  };
};

type TTimedMakerToken = IKaraokeMakerToken & {
  startMs: number;
  endMs: number;
};

interface ITokenTimingChange {
  oldStartMs: number;
  oldEndMs: number;
  startMs: number;
  endMs: number;
}

const tokenIsTimed = (
  token: IKaraokeMakerToken | undefined,
): token is TTimedMakerToken =>
  token?.startMs !== undefined &&
  token.endMs !== undefined &&
  token.endMs > token.startMs;

const distributeTimingAcrossMovedWord = (
  moved: readonly IKaraokeMakerToken[],
  slotStartMs: number,
  slotEndMs: number,
): IKaraokeMakerToken[] => {
  const weights = moved.map((token) =>
    Math.max(
      1,
      Array.from(token.text).filter((character) =>
        /[\p{L}\p{N}]/u.test(character),
      ).length,
    ),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const durationMs = slotEndMs - slotStartMs;
  let consumedWeight = 0;
  let startMs = slotStartMs;
  return moved.map((token, index) => {
    consumedWeight += weights[index];
    const remainingTokens = moved.length - index - 1;
    const idealEndMs = Math.round(
      slotStartMs + (durationMs * consumedWeight) / totalWeight,
    );
    const endMs =
      index === moved.length - 1
        ? slotEndMs
        : Math.max(
            startMs + 20,
            Math.min(slotEndMs - remainingTokens * 20, idealEndMs),
          );
    const timed = {
      ...token,
      startMs,
      endMs,
      source: 'manual' as const,
      timingLocked: true,
    };
    startMs = endMs;
    return timed;
  });
};

/**
 * Give a dropped untimed word a real slot in the target line.
 *
 * A real gap wins. At a shared boundary the nearest timed word gives up only
 * the small piece needed for the insertion. That makes dropping "We" before
 * "all" create `We.start/end` immediately instead of merely changing which
 * line owns an untimed token.
 */
const timeMovedWordInsideLine = (
  project: IKaraokeMakerProject,
  lines: readonly IKaraokeMakerLine[],
  targetLineIndex: number,
  targetTokens: readonly IKaraokeMakerToken[],
  insertionIndex: number,
  moved: readonly IKaraokeMakerToken[],
): {
  moved: IKaraokeMakerToken[];
  targetTokens: IKaraokeMakerToken[];
  timingChanges: Map<string, ITokenTimingChange>;
} => {
  if (moved.every(tokenIsTimed)) {
    return {
      moved: [...moved],
      targetTokens: [...targetTokens],
      timingChanges: new Map(),
    };
  }
  if (!targetTokens.some(tokenIsTimed)) {
    return {
      moved: [...moved],
      targetTokens: [...targetTokens],
      timingChanges: new Map(),
    };
  }

  const minimumSlotMs = moved.length * 20;
  const lexicalLength = moved.reduce(
    (length, token) =>
      length +
      Array.from(token.text).filter((character) =>
        /[\p{L}\p{N}]/u.test(character),
      ).length,
    0,
  );
  const preferredSlotMs = Math.max(
    minimumSlotMs,
    Math.min(500, Math.max(120, lexicalLength * 70)),
  );
  const target = [...targetTokens];
  const timingChanges = new Map<string, ITokenTimingChange>();
  let previousIndex = insertionIndex - 1;
  while (previousIndex >= 0 && !tokenIsTimed(target[previousIndex])) {
    previousIndex -= 1;
  }
  let nextIndex = insertionIndex;
  while (nextIndex < target.length && !tokenIsTimed(target[nextIndex])) {
    nextIndex += 1;
  }
  const previous = target[previousIndex];
  const next = target[nextIndex];

  const previousLineEndMs = lines
    .slice(0, targetLineIndex)
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens)
    .reduce(
      (latest, token) => Math.max(latest, token.endMs ?? token.startMs ?? 0),
      0,
    );
  const nextLineStartMs = lines
    .slice(targetLineIndex + 1)
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens)
    .reduce(
      (earliest, token) =>
        token.startMs === undefined
          ? earliest
          : Math.min(earliest, token.startMs),
      Number.POSITIVE_INFINITY,
    );
  const gapStartMs = tokenIsTimed(previous)
    ? previous.endMs
    : previousLineEndMs +
      (previousLineEndMs > 0 ? KARAOKE_MAKER_LINE_SAFE_GAP_MS : 0);
  const gapEndMs = tokenIsTimed(next)
    ? next.startMs
    : Math.min(
        Number.isFinite(nextLineStartMs)
          ? nextLineStartMs - KARAOKE_MAKER_LINE_SAFE_GAP_MS
          : Number.POSITIVE_INFINITY,
        project.audio.durationMs ?? Number.POSITIVE_INFINITY,
      );
  const availableGapMs = gapEndMs - gapStartMs;
  if (availableGapMs >= minimumSlotMs) {
    const slotDurationMs = Math.min(preferredSlotMs, availableGapMs);
    const slotStartMs = tokenIsTimed(next)
      ? gapEndMs - slotDurationMs
      : gapStartMs;
    return {
      moved: distributeTimingAcrossMovedWord(
        moved,
        Math.round(slotStartMs),
        Math.round(slotStartMs + slotDurationMs),
      ),
      targetTokens: target,
      timingChanges,
    };
  }

  if (tokenIsTimed(next)) {
    const availableMs = next.endMs - next.startMs - 20;
    if (availableMs >= minimumSlotMs) {
      const slotDurationMs = Math.min(preferredSlotMs, availableMs);
      const nextStartMs = next.startMs + slotDurationMs;
      timingChanges.set(next.id, {
        oldStartMs: next.startMs,
        oldEndMs: next.endMs,
        startMs: nextStartMs,
        endMs: next.endMs,
      });
      target[nextIndex] = {
        ...next,
        startMs: nextStartMs,
        source: 'manual',
        timingLocked: true,
      };
      return {
        moved: distributeTimingAcrossMovedWord(
          moved,
          next.startMs,
          nextStartMs,
        ),
        targetTokens: target,
        timingChanges,
      };
    }
  }

  if (tokenIsTimed(previous)) {
    const availableMs = previous.endMs - previous.startMs - 20;
    if (availableMs >= minimumSlotMs) {
      const slotDurationMs = Math.min(preferredSlotMs, availableMs);
      const previousEndMs = previous.endMs - slotDurationMs;
      timingChanges.set(previous.id, {
        oldStartMs: previous.startMs,
        oldEndMs: previous.endMs,
        startMs: previous.startMs,
        endMs: previousEndMs,
      });
      target[previousIndex] = {
        ...previous,
        endMs: previousEndMs,
        source: 'manual',
        timingLocked: true,
      };
      return {
        moved: distributeTimingAcrossMovedWord(
          moved,
          previousEndMs,
          previous.endMs,
        ),
        targetTokens: target,
        timingChanges,
      };
    }
  }

  return { moved: [...moved], targetTokens: target, timingChanges };
};

const scaleNotesForTimingChanges = (
  notes: readonly IKaraokeMakerNote[],
  changes: ReadonlyMap<string, ITokenTimingChange>,
): IKaraokeMakerNote[] =>
  notes.map((note) => {
    const timing = note.tokenId ? changes.get(note.tokenId) : undefined;
    if (!timing) {
      return note;
    }
    const oldDurationMs = Math.max(1, timing.oldEndMs - timing.oldStartMs);
    const scale = (valueMs: number) =>
      timing.startMs +
      ((valueMs - timing.oldStartMs) / oldDurationMs) *
        (timing.endMs - timing.startMs);
    const startMs = Math.max(
      timing.startMs,
      Math.min(timing.endMs - 1, Math.round(scale(note.startMs))),
    );
    const endMs = Math.min(
      timing.endMs,
      Math.max(startMs + 1, Math.round(scale(note.endMs))),
    );
    return { ...note, startMs, endMs, source: 'manual' };
  });

/**
 * The three edits every part of the Maker makes, in one place.
 *
 * Each is "replace one thing and mark the result manual" — the pattern behind
 * almost every change the editor makes to a project, and the reason it is
 * written once: `source: 'manual'` is what stops the next automatic pass
 * overwriting the user's own timing, and a copy that forgot it would lose work
 * silently, one note at a time.
 *
 * Shared out of the component because the pointer handlers need them too, and
 * a hook importing them from the component that imports the hook is a cycle.
 */
export const flattenTokens = (project: IKaraokeMakerProject) =>
  project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);

export const replaceNote = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (note: IKaraokeMakerNote) => IKaraokeMakerNote,
): IKaraokeMakerProject => ({
  ...project,
  melody: {
    ...project.melody,
    source: 'manual',
    notes: project.melody.notes.map((note) =>
      note.id === id ? { ...edit(note), source: 'manual' } : note,
    ),
  },
});

export const replaceToken = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (token: IKaraokeMakerToken) => IKaraokeMakerToken,
): IKaraokeMakerProject => ({
  ...project,
  lyrics: {
    ...project.lyrics,
    source: 'manual',
    lines: project.lyrics.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) =>
        token.id === id
          ? { ...edit(token), source: 'manual', timingLocked: true }
          : token,
      ),
    })),
  },
});

/**
 * Move one whole word without rebuilding the lyric sheet.
 *
 * A word may be several syllable tokens (`startsWord === false`), and moving
 * only the clicked syllable would split both its text and its note links. The
 * complete token run moves as-is, preserving ids and timing; only ownership by
 * the lyric line changes. `beforeTokenId` is an exact drop position, `null` is
 * the end of the line, and `undefined` inserts by the word's existing time.
 */
export const moveKaraokeMakerWord = (
  project: IKaraokeMakerProject,
  tokenId: string,
  targetLineId: string,
  beforeTokenId?: string | null,
): IKaraokeMakerProject => {
  const sourceLineIndex = project.lyrics.lines.findIndex((line) =>
    line.tokens.some((token) => token.id === tokenId),
  );
  const targetLineIndex = project.lyrics.lines.findIndex(
    (line) => line.id === targetLineId && !karaokeMakerLineIsSection(line),
  );
  if (sourceLineIndex < 0 || targetLineIndex < 0) {
    return project;
  }

  const sourceLine = project.lyrics.lines[sourceLineIndex];
  const selectedIndex = sourceLine.tokens.findIndex(
    (token) => token.id === tokenId,
  );
  let wordStart = selectedIndex;
  while (wordStart > 0 && sourceLine.tokens[wordStart].startsWord === false) {
    wordStart -= 1;
  }
  let wordEnd = wordStart + 1;
  while (
    wordEnd < sourceLine.tokens.length &&
    sourceLine.tokens[wordEnd].startsWord === false
  ) {
    wordEnd += 1;
  }
  const movedIds = new Set(
    sourceLine.tokens.slice(wordStart, wordEnd).map((token) => token.id),
  );
  if (beforeTokenId && movedIds.has(beforeTokenId)) {
    return project;
  }
  const moved = sourceLine.tokens.slice(wordStart, wordEnd).map((token) => ({
    ...token,
    source: 'manual' as const,
    timingLocked: true,
  }));
  if (!moved.length) {
    return project;
  }

  const withoutMoved = project.lyrics.lines.map((line, lineIndex) =>
    lineIndex === sourceLineIndex
      ? {
          ...line,
          tokens: line.tokens.filter((token) => !movedIds.has(token.id)),
        }
      : line,
  );
  const targetLine = withoutMoved[targetLineIndex];
  let insertionIndex = targetLine.tokens.length;
  if (beforeTokenId) {
    const exactIndex = targetLine.tokens.findIndex(
      (token) => token.id === beforeTokenId,
    );
    if (exactIndex >= 0) {
      insertionIndex = exactIndex;
      while (
        insertionIndex > 0 &&
        targetLine.tokens[insertionIndex].startsWord === false
      ) {
        insertionIndex -= 1;
      }
    }
  } else if (beforeTokenId === undefined) {
    const movedStart = moved.find(
      (token) => token.startMs !== undefined,
    )?.startMs;
    if (movedStart !== undefined) {
      const laterIndex = targetLine.tokens.findIndex(
        (token) =>
          token.startMs !== undefined && (token.startMs as number) > movedStart,
      );
      if (laterIndex >= 0) {
        insertionIndex = laterIndex;
        while (
          insertionIndex > 0 &&
          targetLine.tokens[insertionIndex].startsWord === false
        ) {
          insertionIndex -= 1;
        }
      }
    }
  }

  const timedMove = timeMovedWordInsideLine(
    project,
    withoutMoved,
    targetLineIndex,
    targetLine.tokens,
    insertionIndex,
    moved,
  );

  const nextLines = withoutMoved.map((line, lineIndex) => {
    if (lineIndex !== targetLineIndex) {
      return lineIndex === sourceLineIndex ? withTokenRange(line) : line;
    }
    return withTokenRange({
      ...line,
      tokens: [
        ...timedMove.targetTokens.slice(0, insertionIndex),
        ...timedMove.moved,
        ...timedMove.targetTokens.slice(insertionIndex),
      ],
    });
  });
  return synchronizeKaraokeMakerSections({
    ...project,
    lyrics: { ...project.lyrics, source: 'manual', lines: nextLines },
    melody: {
      ...project.melody,
      source: timedMove.timingChanges.size ? 'manual' : project.melody.source,
      notes: scaleNotesForTimingChanges(
        project.melody.notes,
        timedMove.timingChanges,
      ),
    },
  });
};

export const karaokeMakerWordTokensFor = (
  project: IKaraokeMakerProject,
  tokenId: string,
): IKaraokeMakerToken[] => {
  const line = project.lyrics.lines.find((candidate) =>
    candidate.tokens.some((token) => token.id === tokenId),
  );
  if (!line) {
    return [];
  }
  const selectedIndex = line.tokens.findIndex((token) => token.id === tokenId);
  const precedingWordOffset = line.tokens
    .slice(0, selectedIndex + 1)
    .reverse()
    .findIndex((token) => token.startsWord !== false);
  const firstIndex =
    precedingWordOffset < 0
      ? 0
      : Math.max(0, selectedIndex - precedingWordOffset);
  const followingWordOffset = line.tokens
    .slice(firstIndex + 1)
    .findIndex((token) => token.startsWord !== false);
  const lastIndex =
    followingWordOffset < 0
      ? line.tokens.length
      : firstIndex + followingWordOffset + 1;
  return line.tokens.slice(firstIndex, lastIndex);
};

export const syllablesAtCutPoints = (
  word: string,
  cutPoints: readonly number[],
): string[] => {
  const characters = Array.from(word);
  const boundaries = [
    0,
    ...[...new Set(cutPoints)]
      .filter((point) => point > 0 && point < characters.length)
      .sort((left, right) => left - right),
    characters.length,
  ];
  return boundaries
    .slice(0, -1)
    .map((start, index) =>
      characters.slice(start, boundaries[index + 1]).join(''),
    )
    .filter(Boolean);
};

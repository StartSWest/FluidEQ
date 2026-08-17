/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Timing lines by ear, against playback.
 *
 * The playhead is authoritative: where the user tapped is where the line goes,
 * and any prior line that now overlaps is pulled back rather than the new one
 * being nudged to fit. Anything else would make tapping along feel like it was
 * arguing with you.
 */
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  KARAOKE_MAKER_LINE_SAFE_GAP_MS,
  karaokeMakerLineIsSection,
  karaokeMakerMaximumAutomaticWordDurationMs,
  synchronizeKaraokeMakerSections,
} from './model';
import {
  cascadeKaraokeMakerLinesForward,
  trimKaraokeMakerLineEnd,
} from './boundaries';
/**
 * Record one lyric line's entrance while the song is playing. The requested
 * playhead position is authoritative. When it overlaps the prior lyric, only
 * that prior lyric's end is pulled back to leave the safe boundary.
 */
export const recordKaraokeMakerLineEntry = (
  project: IKaraokeMakerProject,
  lineId: string,
  requestedEntryMs: number,
  previousLineId?: string,
  cascadeFollowing = true,
): IKaraokeMakerProject => {
  const lineIndex = project.lyrics.lines.findIndex(
    (line) => line.id === lineId && !karaokeMakerLineIsSection(line),
  );
  if (lineIndex < 0 || !Number.isFinite(requestedEntryMs)) {
    return project;
  }
  let line = project.lyrics.lines[lineIndex];
  if (!line.tokens.length) {
    return project;
  }
  const durationMs = Math.max(
    20,
    project.audio.durationMs ?? Number.POSITIVE_INFINITY,
  );
  const requested = Math.max(0, Math.min(durationMs - 20, requestedEntryMs));
  const previousLine = previousLineId
    ? project.lyrics.lines.find(
        (candidate) =>
          candidate.id === previousLineId &&
          !karaokeMakerLineIsSection(candidate),
      )
    : undefined;
  const previousTimed = previousLine?.tokens.filter(
    (token) => token.startMs !== undefined && token.endMs !== undefined,
  );
  const previousEndMs = previousTimed?.length
    ? Math.max(...previousTimed.map((token) => token.endMs as number))
    : undefined;
  let workingProject = project;
  if (
    previousLine &&
    previousEndMs !== undefined &&
    previousEndMs + KARAOKE_MAKER_LINE_SAFE_GAP_MS > requested
  ) {
    workingProject = trimKaraokeMakerLineEnd(
      project,
      previousLine.id,
      requested - KARAOKE_MAKER_LINE_SAFE_GAP_MS,
    );
    line = workingProject.lyrics.lines[lineIndex];
  }
  const entryMs = requested;
  const currentTimed = line.tokens.filter(
    (token) => token.startMs !== undefined && token.endMs !== undefined,
  );
  const currentStartMs = currentTimed.length
    ? Math.min(...currentTimed.map((token) => token.startMs as number))
    : undefined;
  const currentEndMs = currentTimed.length
    ? Math.max(...currentTimed.map((token) => token.endMs as number))
    : undefined;
  const currentSpanMs =
    currentStartMs !== undefined && currentEndMs !== undefined
      ? Math.max(40, currentEndMs - currentStartMs)
      : Math.min(6_000, Math.max(1_200, line.tokens.length * 360));
  const availableSpanMs = Math.max(40, durationMs - entryMs);
  const currentScale = Math.min(1, availableSpanMs / currentSpanMs);
  const currentTokenIds = new Set(line.tokens.map((token) => token.id));

  const retimeCurrentToken = (
    token: IKaraokeMakerToken,
    tokenIndex: number,
  ): IKaraokeMakerToken => {
    let startMs: number;
    let endMs: number;
    if (
      currentStartMs !== undefined &&
      token.startMs !== undefined &&
      token.endMs !== undefined
    ) {
      startMs = entryMs + (token.startMs - currentStartMs) * currentScale;
      endMs = entryMs + (token.endMs - currentStartMs) * currentScale;
    } else {
      const weights = line.tokens.map((candidate) =>
        Math.max(
          1,
          Array.from(candidate.text).filter((character) =>
            /[\p{L}\p{N}]/u.test(character),
          ).length,
        ),
      );
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const precedingWeight = weights
        .slice(0, tokenIndex)
        .reduce((sum, weight) => sum + weight, 0);
      startMs = entryMs + (precedingWeight / totalWeight) * currentSpanMs;
      endMs =
        entryMs +
        ((precedingWeight + weights[tokenIndex]) / totalWeight) * currentSpanMs;
    }
    return {
      ...token,
      startMs: Math.round(Math.max(entryMs, startMs)),
      endMs: Math.round(Math.min(durationMs, Math.max(startMs + 20, endMs))),
      source: 'manual',
      timingLocked: true,
    };
  };

  const next: IKaraokeMakerProject = {
    ...workingProject,
    lyrics: {
      ...workingProject.lyrics,
      source: 'manual',
      lines: workingProject.lyrics.lines.map((candidate) => {
        if (candidate.id === lineId) {
          const tokens = candidate.tokens.map(retimeCurrentToken);
          return {
            ...candidate,
            startMs: tokens[0]?.startMs ?? entryMs,
            endMs: tokens.reduce(
              (latest, token) => Math.max(latest, token.endMs ?? entryMs),
              entryMs,
            ),
            tokens,
          };
        }
        return candidate;
      }),
    },
    melody: {
      ...workingProject.melody,
      source: 'manual',
      notes: workingProject.melody.notes.map((note) => {
        if (note.tokenId && currentTokenIds.has(note.tokenId)) {
          const relativeStart =
            currentStartMs === undefined ? 0 : note.startMs - currentStartMs;
          const relativeEnd =
            currentStartMs === undefined ? 200 : note.endMs - currentStartMs;
          return {
            ...note,
            startMs: Math.round(entryMs + relativeStart * currentScale),
            endMs: Math.round(
              Math.min(
                durationMs,
                Math.max(
                  entryMs + relativeStart * currentScale + 20,
                  entryMs + relativeEnd * currentScale,
                ),
              ),
            ),
            source: 'manual',
          };
        }
        return note;
      }),
    },
  };
  const synchronized = synchronizeKaraokeMakerSections(next);
  return cascadeFollowing
    ? synchronizeKaraokeMakerSections(
        cascadeKaraokeMakerLinesForward(synchronized, lineId),
      )
    : synchronized;
};

/**
 * Finish a guided line capture using the exact range heard by the user. The
 * line's existing internal word and syllable rhythm is scaled into that range,
 * together with every linked melody note.
 */
export const recordKaraokeMakerLineRange = (
  project: IKaraokeMakerProject,
  lineId: string,
  requestedEntryMs: number,
  requestedEndMs: number,
  previousLineId?: string,
  requestedWordBoundariesMs: readonly number[] = [],
): IKaraokeMakerProject => {
  const entered = recordKaraokeMakerLineEntry(
    project,
    lineId,
    requestedEntryMs,
    previousLineId,
    false,
  );
  const line = entered.lyrics.lines.find(
    (candidate) =>
      candidate.id === lineId && !karaokeMakerLineIsSection(candidate),
  );
  if (!line?.tokens.length || !Number.isFinite(requestedEndMs)) {
    return entered;
  }
  const timedTokens = line.tokens.filter(
    (token) => token.startMs !== undefined && token.endMs !== undefined,
  );
  if (!timedTokens.length) {
    return entered;
  }
  const startMs = Math.min(
    ...timedTokens.map((token) => token.startMs as number),
  );
  const durationMs = Math.max(
    startMs + 20,
    entered.audio.durationMs ?? Number.POSITIVE_INFINITY,
  );
  const minimumEndMs = startMs + Math.max(80, line.tokens.length * 20);
  const endMs = Math.min(durationMs, Math.max(minimumEndMs, requestedEndMs));
  const tokenIds = new Set(line.tokens.map((token) => token.id));
  const oldTokenTiming = new Map(
    line.tokens.map((token) => [
      token.id,
      { startMs: token.startMs, endMs: token.endMs },
    ]),
  );
  const minimumTokenMs = 20;
  const tokenWeights = line.tokens.map((token) => {
    const letterCount = Math.max(
      1,
      Array.from(token.text).filter((character) =>
        /[\p{L}\p{N}]/u.test(character),
      ).length,
    );
    const lexicalDurationMs = 120 + letterCount * 75;
    const detectedDurationMs =
      token.startMs !== undefined && token.endMs !== undefined
        ? Math.max(20, token.endMs - token.startMs)
        : lexicalDurationMs;
    return Math.sqrt(
      lexicalDurationMs *
        Math.min(
          karaokeMakerMaximumAutomaticWordDurationMs(token.text),
          detectedDurationMs,
        ),
    );
  });
  const wordBoundariesMs: number[] = [];
  requestedWordBoundariesMs
    .filter(Number.isFinite)
    .slice(0, Math.max(0, line.tokens.length - 1))
    .forEach((requestedBoundaryMs, boundaryIndex) => {
      const previousBoundaryMs =
        wordBoundariesMs[wordBoundariesMs.length - 1] ?? startMs;
      const remainingTokens = line.tokens.length - boundaryIndex - 1;
      const latestBoundaryMs = endMs - minimumTokenMs * remainingTokens;
      wordBoundariesMs.push(
        Math.round(
          Math.max(
            previousBoundaryMs + minimumTokenMs,
            Math.min(latestBoundaryMs, requestedBoundaryMs),
          ),
        ),
      );
    });
  const exactTokenCount = wordBoundariesMs.length;
  const suffixWeights = tokenWeights.slice(exactTokenCount);
  const totalSuffixWeight = suffixWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  );
  let cursorMs = startMs;
  const orderedTokens = line.tokens.map((token, tokenIndex) => {
    const tokenStartMs = cursorMs;
    let tokenEndMs: number;
    if (tokenIndex < exactTokenCount) {
      tokenEndMs = wordBoundariesMs[tokenIndex];
    } else if (tokenIndex === line.tokens.length - 1) {
      tokenEndMs = endMs;
    } else {
      const suffixStartMs = wordBoundariesMs[exactTokenCount - 1] ?? startMs;
      const suffixTokenCount = line.tokens.length - exactTokenCount;
      const suffixDistributableMs = Math.max(
        0,
        endMs - suffixStartMs - minimumTokenMs * suffixTokenCount,
      );
      const weightedDurationMs =
        minimumTokenMs +
        (suffixDistributableMs * tokenWeights[tokenIndex]) /
          Math.max(1, totalSuffixWeight);
      tokenEndMs = Math.min(
        endMs,
        Math.round(tokenStartMs + weightedDurationMs),
      );
    }
    cursorMs = tokenEndMs;
    return {
      ...token,
      startMs: tokenStartMs,
      endMs: tokenEndMs,
      source: 'manual' as const,
      timingLocked: true,
    };
  });
  const orderedTokenTiming = new Map(
    orderedTokens.map((token) => [
      token.id,
      { startMs: token.startMs, endMs: token.endMs },
    ]),
  );
  const next: IKaraokeMakerProject = {
    ...entered,
    lyrics: {
      ...entered.lyrics,
      source: 'manual',
      lines: entered.lyrics.lines.map((candidate) => {
        if (candidate.id !== lineId) {
          return candidate;
        }
        return { ...candidate, startMs, endMs, tokens: orderedTokens };
      }),
    },
    melody: {
      ...entered.melody,
      source: tokenIds.size ? 'manual' : entered.melody.source,
      notes: entered.melody.notes.map((note) =>
        note.tokenId && tokenIds.has(note.tokenId)
          ? (() => {
              const oldTiming = oldTokenTiming.get(note.tokenId as string);
              const newTiming = orderedTokenTiming.get(note.tokenId as string);
              if (!newTiming) {
                return note;
              }
              const oldStartMs = oldTiming?.startMs;
              const oldEndMs = oldTiming?.endMs;
              const oldSpanMs =
                oldStartMs !== undefined && oldEndMs !== undefined
                  ? Math.max(1, oldEndMs - oldStartMs)
                  : 1;
              const startProgress =
                oldStartMs === undefined
                  ? 0
                  : Math.max(
                      0,
                      Math.min(1, (note.startMs - oldStartMs) / oldSpanMs),
                    );
              const endProgress =
                oldStartMs === undefined
                  ? 1
                  : Math.max(
                      startProgress,
                      Math.min(1, (note.endMs - oldStartMs) / oldSpanMs),
                    );
              const newSpanMs = newTiming.endMs - newTiming.startMs;
              const noteStartMs = Math.round(
                newTiming.startMs + newSpanMs * startProgress,
              );
              return {
                ...note,
                startMs: noteStartMs,
                endMs: Math.min(
                  newTiming.endMs,
                  Math.max(
                    noteStartMs + 20,
                    Math.round(newTiming.startMs + newSpanMs * endProgress),
                  ),
                ),
                source: 'manual',
              };
            })()
          : note,
      ),
    },
  };
  return synchronizeKaraokeMakerSections(
    cascadeKaraokeMakerLinesForward(next, lineId),
  );
};

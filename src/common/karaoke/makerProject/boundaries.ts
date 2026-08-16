/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Dragging one token edge, and everything that has to move out of its way.
 *
 * The largest module here and the one with the most to say, because a boundary
 * cannot move alone: pushing one syllable's end into the next line has to
 * cascade forward through every line it now overlaps, and stop before it eats a
 * section heading.
 *
 * `cascadeKaraokeMakerLinesForward` and `trimKaraokeMakerLineEnd` are exported
 * for `recording`, which lands a line by ear and then has exactly the same
 * overlap to resolve.
 */
import {
  IKaraokeMakerProject,
  KARAOKE_MAKER_LINE_SAFE_GAP_MS,
  karaokeMakerLineIsSection,
  karaokeMakerTimedLineRange,
  TKaraokeMakerTokenBoundary,
} from './model';

export interface IKaraokeMakerTokenBoundaryLimits {
  minimumMs: number;
  maximumMs: number;
  currentMs: number;
  outerBoundary: boolean;
}

export const karaokeMakerTokenBoundaryLimits = (
  project: IKaraokeMakerProject,
  tokenId: string,
  boundary: TKaraokeMakerTokenBoundary,
  minimumTokenDurationMs = 20,
): IKaraokeMakerTokenBoundaryLimits | undefined => {
  const lineIndex = project.lyrics.lines.findIndex(
    (line) =>
      !karaokeMakerLineIsSection(line) &&
      line.tokens.some((token) => token.id === tokenId),
  );
  if (lineIndex < 0) {
    return undefined;
  }
  const line = project.lyrics.lines[lineIndex];
  const selectedIndex = line.tokens.findIndex((token) => token.id === tokenId);
  const selectedToken = line.tokens[selectedIndex];
  if (
    !selectedToken ||
    selectedToken.startMs === undefined ||
    selectedToken.endMs === undefined
  ) {
    return undefined;
  }
  const minimumDurationMs = Math.max(1, Math.round(minimumTokenDurationMs));
  if (boundary === 'start') {
    const previousToken = line.tokens[selectedIndex - 1];
    if (
      previousToken?.startMs !== undefined &&
      previousToken.endMs !== undefined
    ) {
      return {
        minimumMs: previousToken.startMs + minimumDurationMs,
        maximumMs: selectedToken.endMs - minimumDurationMs,
        currentMs: selectedToken.startMs,
        outerBoundary: false,
      };
    }
    const previousLineEndMs = project.lyrics.lines
      .slice(0, lineIndex)
      .filter((candidate) => !karaokeMakerLineIsSection(candidate))
      .map(karaokeMakerTimedLineRange)
      .filter(
        (range): range is { startMs: number; endMs: number } =>
          range !== undefined,
      )
      .reduce(
        (latest, range) => Math.max(latest, range.endMs),
        Number.NEGATIVE_INFINITY,
      );
    return {
      minimumMs: Number.isFinite(previousLineEndMs)
        ? previousLineEndMs + KARAOKE_MAKER_LINE_SAFE_GAP_MS
        : 0,
      maximumMs: selectedToken.endMs - minimumDurationMs,
      currentMs: selectedToken.startMs,
      outerBoundary: true,
    };
  }

  const nextToken = line.tokens[selectedIndex + 1];
  if (nextToken?.startMs !== undefined && nextToken.endMs !== undefined) {
    return {
      minimumMs: selectedToken.startMs + minimumDurationMs,
      maximumMs: nextToken.endMs - minimumDurationMs,
      currentMs: selectedToken.endMs,
      outerBoundary: false,
    };
  }
  const nextLineStartMs = project.lyrics.lines
    .slice(lineIndex + 1)
    .filter((candidate) => !karaokeMakerLineIsSection(candidate))
    .map(karaokeMakerTimedLineRange)
    .filter(
      (range): range is { startMs: number; endMs: number } =>
        range !== undefined,
    )
    .reduce(
      (earliest, range) => Math.min(earliest, range.startMs),
      Number.POSITIVE_INFINITY,
    );
  return {
    minimumMs: selectedToken.startMs + minimumDurationMs,
    maximumMs: Number.isFinite(nextLineStartMs)
      ? nextLineStartMs - KARAOKE_MAKER_LINE_SAFE_GAP_MS
      : (project.audio.durationMs ?? selectedToken.endMs),
    currentMs: selectedToken.endMs,
    outerBoundary: true,
  };
};

/**
 * Resize a lyric-token edge. Internal edges are shared, so one token gains
 * exactly the time its neighbour gives up. The first/last outer edge adjusts
 * the sentence range, clamped safely against surrounding lines and audio.
 * Linked melody notes scale with their token.
 */
export const resizeKaraokeMakerTokenBoundary = (
  project: IKaraokeMakerProject,
  tokenId: string,
  boundary: TKaraokeMakerTokenBoundary,
  requestedBoundaryMs: number,
  minimumTokenDurationMs = 20,
): IKaraokeMakerProject => {
  if (!Number.isFinite(requestedBoundaryMs)) {
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
  const selectedToken = line.tokens[selectedIndex];
  const limits = karaokeMakerTokenBoundaryLimits(
    project,
    tokenId,
    boundary,
    minimumTokenDurationMs,
  );
  if (!limits || limits.minimumMs > limits.maximumMs) {
    return project;
  }
  const boundaryMs = Math.max(
    limits.minimumMs,
    Math.min(limits.maximumMs, Math.round(requestedBoundaryMs)),
  );
  const neighbourBoundaryMs =
    boundary === 'start'
      ? line.tokens[selectedIndex - 1]?.endMs
      : line.tokens[selectedIndex + 1]?.startMs;
  if (
    limits.currentMs === boundaryMs &&
    (limits.outerBoundary || neighbourBoundaryMs === boundaryMs)
  ) {
    return project;
  }

  const nextTokenTiming = new Map<
    string,
    { oldStartMs: number; oldEndMs: number; startMs: number; endMs: number }
  >();
  if (boundary === 'start') {
    const previousToken = line.tokens[selectedIndex - 1];
    if (
      previousToken?.startMs !== undefined &&
      previousToken.endMs !== undefined
    ) {
      nextTokenTiming.set(previousToken.id, {
        oldStartMs: previousToken.startMs,
        oldEndMs: previousToken.endMs,
        startMs: previousToken.startMs,
        endMs: boundaryMs,
      });
    }
    nextTokenTiming.set(selectedToken.id, {
      oldStartMs: selectedToken.startMs as number,
      oldEndMs: selectedToken.endMs as number,
      startMs: boundaryMs,
      endMs: selectedToken.endMs as number,
    });
  } else {
    nextTokenTiming.set(selectedToken.id, {
      oldStartMs: selectedToken.startMs as number,
      oldEndMs: selectedToken.endMs as number,
      startMs: selectedToken.startMs as number,
      endMs: boundaryMs,
    });
    const nextToken = line.tokens[selectedIndex + 1];
    if (nextToken?.startMs !== undefined && nextToken.endMs !== undefined) {
      nextTokenTiming.set(nextToken.id, {
        oldStartMs: nextToken.startMs,
        oldEndMs: nextToken.endMs,
        startMs: boundaryMs,
        endMs: nextToken.endMs,
      });
    }
  }
  const scaleIntoToken = (
    valueMs: number,
    timing: {
      oldStartMs: number;
      oldEndMs: number;
      startMs: number;
      endMs: number;
    },
  ): number => {
    const oldDurationMs = Math.max(1, timing.oldEndMs - timing.oldStartMs);
    const progress = Math.max(
      0,
      Math.min(1, (valueMs - timing.oldStartMs) / oldDurationMs),
    );
    return timing.startMs + progress * (timing.endMs - timing.startMs);
  };
  const affectedNoteIds = new Set(
    project.melody.notes
      .filter((note) => note.tokenId && nextTokenTiming.has(note.tokenId))
      .map((note) => note.id),
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
                limits.outerBoundary && boundary === 'start'
                  ? boundaryMs
                  : candidate.startMs,
              endMs:
                limits.outerBoundary && boundary === 'end'
                  ? boundaryMs
                  : candidate.endMs,
              tokens: candidate.tokens.map((token) => {
                const timing = nextTokenTiming.get(token.id);
                return timing
                  ? {
                      ...token,
                      startMs: timing.startMs,
                      endMs: timing.endMs,
                      source: 'manual' as const,
                      timingLocked: true,
                    }
                  : token;
              }),
            }
          : candidate,
      ),
    },
    melody: {
      ...project.melody,
      source: affectedNoteIds.size ? 'manual' : project.melody.source,
      notes: project.melody.notes.map((note) => {
        const timing = note.tokenId
          ? nextTokenTiming.get(note.tokenId)
          : undefined;
        if (!timing) {
          return note;
        }
        const scaledStartMs = scaleIntoToken(note.startMs, timing);
        const scaledEndMs = scaleIntoToken(note.endMs, timing);
        const startMs = Math.max(
          timing.startMs,
          Math.min(timing.endMs - 1, Math.round(scaledStartMs)),
        );
        const endMs = Math.min(
          timing.endMs,
          Math.max(startMs + 1, Math.round(scaledEndMs)),
        );
        return {
          ...note,
          startMs,
          endMs,
          source: 'manual' as const,
        };
      }),
    },
  };
};

/**
 * Preserve every recorded line while pushing only the overlapping suffix
 * forward. This gives manual START/END corrections a deterministic ripple
 * rather than shortening or overwriting neighbouring work.
 */
export const cascadeKaraokeMakerLinesForward = (
  project: IKaraokeMakerProject,
  anchorLineId: string,
): IKaraokeMakerProject => {
  const anchorIndex = project.lyrics.lines.findIndex(
    (line) => line.id === anchorLineId && !karaokeMakerLineIsSection(line),
  );
  const anchorRange =
    anchorIndex >= 0
      ? karaokeMakerTimedLineRange(project.lyrics.lines[anchorIndex])
      : undefined;
  if (anchorIndex < 0 || !anchorRange) {
    return project;
  }

  let boundaryMs = anchorRange.endMs + KARAOKE_MAKER_LINE_SAFE_GAP_MS;
  const shiftedTokenDeltas = new Map<string, number>();
  let changed = false;
  const lines = project.lyrics.lines.map((line, index) => {
    if (index <= anchorIndex || karaokeMakerLineIsSection(line)) {
      return line;
    }
    const range = karaokeMakerTimedLineRange(line);
    if (!range) {
      return line;
    }
    const deltaMs = Math.max(0, Math.round(boundaryMs - range.startMs));
    boundaryMs = range.endMs + deltaMs + KARAOKE_MAKER_LINE_SAFE_GAP_MS;
    if (!deltaMs) {
      return line;
    }
    changed = true;
    const tokens = line.tokens.map((token) => {
      shiftedTokenDeltas.set(token.id, deltaMs);
      return {
        ...token,
        startMs:
          token.startMs === undefined ? undefined : token.startMs + deltaMs,
        endMs: token.endMs === undefined ? undefined : token.endMs + deltaMs,
        source: 'manual' as const,
        timingLocked:
          token.startMs !== undefined && token.endMs !== undefined
            ? true
            : token.timingLocked,
      };
    });
    return {
      ...line,
      startMs:
        line.startMs === undefined
          ? range.startMs + deltaMs
          : line.startMs + deltaMs,
      endMs:
        line.endMs === undefined ? range.endMs + deltaMs : line.endMs + deltaMs,
      tokens,
    };
  });
  if (!changed) {
    return project;
  }
  return {
    ...project,
    lyrics: { ...project.lyrics, source: 'manual', lines },
    melody: {
      ...project.melody,
      source: 'manual',
      notes: project.melody.notes.map((note) => {
        const deltaMs = note.tokenId
          ? shiftedTokenDeltas.get(note.tokenId)
          : undefined;
        return deltaMs === undefined
          ? note
          : {
              ...note,
              startMs: note.startMs + deltaMs,
              endMs: note.endMs + deltaMs,
              source: 'manual',
            };
      }),
    },
  };
};

/**
 * Make room for an explicitly recorded START by shortening only the previous
 * lyric. The new START is authoritative: silence between phrases is retained
 * and is never collapsed to the previous line's boundary.
 */
export const trimKaraokeMakerLineEnd = (
  project: IKaraokeMakerProject,
  lineId: string,
  requestedEndMs: number,
): IKaraokeMakerProject => {
  const line = project.lyrics.lines.find(
    (candidate) =>
      candidate.id === lineId && !karaokeMakerLineIsSection(candidate),
  );
  const range = line ? karaokeMakerTimedLineRange(line) : undefined;
  if (
    !line?.tokens.length ||
    !range ||
    !Number.isFinite(requestedEndMs) ||
    requestedEndMs >= range.endMs
  ) {
    return project;
  }

  const endMs = Math.max(1, Math.round(requestedEndMs));
  const minimumSpanMs = Math.max(20, line.tokens.length * 20);
  // The fallback only matters for a pathological START at/before the previous
  // line's own beginning. It still preserves the requested START and overlap
  // guarantee instead of silently moving the user's new marker.
  const startMs = Math.min(range.startMs, Math.max(0, endMs - minimumSpanMs));
  const oldSpanMs = Math.max(1, range.endMs - range.startMs);
  const newSpanMs = Math.max(1, endMs - startMs);
  const tokenIds = new Set(line.tokens.map((token) => token.id));
  const projectTime = (timeMs: number | undefined, fallback: number) => {
    const progress =
      timeMs === undefined
        ? fallback
        : Math.max(0, Math.min(1, (timeMs - range.startMs) / oldSpanMs));
    return Math.round(startMs + progress * newSpanMs);
  };
  let cursorMs = startMs;
  const tokens = line.tokens.map((token, index) => {
    const tokenStartMs = Math.max(
      cursorMs,
      projectTime(token.startMs, index / line.tokens.length),
    );
    const tokenEndMs =
      index === line.tokens.length - 1
        ? endMs
        : Math.min(
            endMs,
            Math.max(
              tokenStartMs + 1,
              projectTime(token.endMs, (index + 1) / line.tokens.length),
            ),
          );
    cursorMs = tokenEndMs;
    return {
      ...token,
      startMs: tokenStartMs,
      endMs: tokenEndMs,
      source: 'manual' as const,
      timingLocked: true,
    };
  });

  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      source: 'manual',
      lines: project.lyrics.lines.map((candidate) =>
        candidate.id === lineId
          ? { ...candidate, startMs, endMs, tokens }
          : candidate,
      ),
    },
    melody: {
      ...project.melody,
      source: tokenIds.size ? 'manual' : project.melody.source,
      notes: project.melody.notes.map((note) => {
        if (!note.tokenId || !tokenIds.has(note.tokenId)) {
          return note;
        }
        const noteStartMs = projectTime(note.startMs, 0);
        return {
          ...note,
          startMs: noteStartMs,
          endMs: Math.min(
            endMs,
            Math.max(noteStartMs + 1, projectTime(note.endMs, 1)),
          ),
          source: 'manual',
        };
      }),
    },
  };
};

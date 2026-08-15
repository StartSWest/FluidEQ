/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { karaokeFileRelativePath } from './files';
import {
  IKaraokeAsset,
  IKaraokeLine,
  IKaraokeParsedLyrics,
  IKaraokeSong,
  IKaraokeToken,
} from './types';
import { splitKaraokeWordSyllables } from './syllables';

export const KARAOKE_MAKER_PROJECT_VERSION = 1 as const;
export const KARAOKE_MAKER_EXTENSION = 'fluideq-karaoke.json';
/**
 * Incremented when automatic Whisper timing semantics change. This is kept
 * separate from the file-format version so an old draft can be repaired in
 * place without making the whole project unreadable.
 */
export const KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION = 5 as const;

export type TKaraokeMakerSource =
  | 'manual'
  | 'imported'
  | 'pitch-analysis'
  | 'basic-pitch'
  | 'whisper'
  | 'auto-align';

export interface IKaraokeMakerToken {
  id: string;
  text: string;
  startsWord: boolean;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  source: TKaraokeMakerSource;
  /** User-authored timing that automatic alignment must never replace. */
  timingLocked?: boolean;
}

/** Automatic/imported timing is still pending until the user edits it. */
export const karaokeMakerTokenWasUserTouched = (
  token: Pick<IKaraokeMakerToken, 'timingLocked'>,
): boolean => token.timingLocked === true;

export interface IKaraokeMakerLine {
  id: string;
  kind?: 'lyrics' | 'section';
  startMs?: number;
  endMs?: number;
  tokens: IKaraokeMakerToken[];
}

export type TKaraokeMakerLineCaptureIntent = 'start' | 'end';
export type TKaraokeMakerTokenBoundary = 'start' | 'end';

/** A small audible/visual separation that prevents adjacent lines overlapping. */
export const KARAOKE_MAKER_LINE_SAFE_GAP_MS = 40;

export const karaokeMakerTimedLineRange = (
  line: IKaraokeMakerLine,
): { startMs: number; endMs: number } | undefined => {
  const hasExplicitRange =
    Number.isFinite(line.startMs) &&
    Number.isFinite(line.endMs) &&
    (line.endMs as number) > (line.startMs as number);
  if (hasExplicitRange) {
    return { startMs: line.startMs as number, endMs: line.endMs as number };
  }
  const isFullyTimed =
    line.tokens.length > 0 &&
    line.tokens.every(
      (token) => token.startMs !== undefined && token.endMs !== undefined,
    );
  if (!isFullyTimed) {
    return undefined;
  }
  return {
    startMs: Math.min(...line.tokens.map((token) => token.startMs as number)),
    endMs: Math.max(...line.tokens.map((token) => token.endMs as number)),
  };
};

export const karaokeMakerRecordedLineRange = (
  line: IKaraokeMakerLine,
): { startMs: number; endMs: number } | undefined => {
  const isFullyRecorded =
    line.tokens.length > 0 &&
    line.tokens.every(
      (token) =>
        token.timingLocked === true &&
        token.startMs !== undefined &&
        token.endMs !== undefined,
    );
  if (!isFullyRecorded) {
    return undefined;
  }
  return karaokeMakerTimedLineRange(line);
};

export const karaokeMakerRecordedLineContainsTime = (
  line: IKaraokeMakerLine,
  playheadMs: number,
): boolean => {
  const range = karaokeMakerRecordedLineRange(line);
  return (
    range !== undefined &&
    Number.isFinite(playheadMs) &&
    playheadMs >= range.startMs &&
    playheadMs <= range.endMs
  );
};

export const karaokeMakerInheritedLineStart = (
  lines: IKaraokeMakerLine[],
  lineIndex: number,
): number | undefined => {
  if (lineIndex <= 0 || karaokeMakerRecordedLineRange(lines[lineIndex])) {
    return undefined;
  }
  const previousRange = karaokeMakerRecordedLineRange(lines[lineIndex - 1]);
  return previousRange
    ? previousRange.endMs + KARAOKE_MAKER_LINE_SAFE_GAP_MS
    : undefined;
};

/**
 * Choose the lyric line the macro preview should show as playback advances.
 * Recorded lines follow their exact ranges. After crossing the last recorded
 * range, one untimed line is revealed so the user can capture its entrance.
 */
export const karaokeMakerLinePlaybackTarget = (
  lines: IKaraokeMakerLine[],
  currentIndex: number,
  previousPlayheadMs: number,
  playheadMs: number,
): number | undefined => {
  const currentLine = lines[currentIndex];
  const currentRange = currentLine
    ? karaokeMakerRecordedLineRange(currentLine)
    : undefined;
  if (!currentRange) {
    return undefined;
  }

  const playbackMovesForward = playheadMs >= previousPlayheadMs;
  let recordedAtPlayhead = -1;
  if (playbackMovesForward) {
    recordedAtPlayhead = lines.findIndex(
      (line, index) =>
        index >= currentIndex &&
        karaokeMakerRecordedLineContainsTime(line, playheadMs),
    );
  } else {
    for (let index = currentIndex; index >= 0; index -= 1) {
      if (karaokeMakerRecordedLineContainsTime(lines[index], playheadMs)) {
        recordedAtPlayhead = index;
        break;
      }
    }
  }
  if (recordedAtPlayhead >= 0) {
    return recordedAtPlayhead === currentIndex ? undefined : recordedAtPlayhead;
  }

  const crossedCurrentEnd =
    previousPlayheadMs <= currentRange.endMs && playheadMs > currentRange.endMs;
  if (!crossedCurrentEnd) {
    return undefined;
  }
  const nextIndex = currentIndex + 1;
  const nextLine = lines[nextIndex];
  if (nextLine && !karaokeMakerRecordedLineRange(nextLine)) {
    return nextIndex;
  }
  return undefined;
};

/**
 * Decide whether an Enter press should begin a fresh line capture or repair
 * the end of a line the user already recorded. Automatic/imported timing is
 * deliberately excluded: only a fully manual line is safe to treat this way.
 */
export const karaokeMakerLineCaptureIntent = (
  line: IKaraokeMakerLine,
  playheadMs: number,
): TKaraokeMakerLineCaptureIntent => {
  if (!Number.isFinite(playheadMs) || !line.tokens.length) {
    return 'start';
  }
  const range = karaokeMakerRecordedLineRange(line);
  if (!range) {
    return 'start';
  }
  const spanMs = Math.max(20, range.endMs - range.startMs);
  const startGuardMs = Math.max(180, Math.min(800, spanMs * 0.08));
  return playheadMs >= range.startMs + startGuardMs &&
    playheadMs <= range.endMs + 1_000
    ? 'end'
    : 'start';
};

const SECTION_MARKER =
  /^\[\s*(intro|verse(?:\s+\d+)?|pre[\s-]?chorus|post[\s-]?chorus|chorus(?:\s+\d+)?|bridge|break|instrumental|interlude|solo|outro|hook|refrain|ending)\s*\]$/iu;

export const karaokeMakerMaximumAutomaticWordDurationMs = (
  text: string,
): number => {
  const letterCount = Math.max(
    1,
    Array.from(text.normalize('NFKD')).filter((character) =>
      /[\p{L}\p{N}]/u.test(character),
    ).length,
  );
  if (letterCount === 1) {
    return 1_200;
  }
  if (letterCount === 2) {
    return 1_800;
  }
  return Math.min(6_000, 1_700 + Math.min(16, letterCount) * 240);
};

const karaokeMakerSourceIsAutomatic = (source: TKaraokeMakerSource): boolean =>
  ['whisper', 'auto-align', 'pitch-analysis', 'basic-pitch'].includes(source);

export const karaokeMakerWordDurationIsPlausible = (
  text: string,
  durationMs: number,
  source: TKaraokeMakerSource,
): boolean =>
  durationMs > 0 &&
  durationMs <=
    (karaokeMakerSourceIsAutomatic(source)
      ? karaokeMakerMaximumAutomaticWordDurationMs(text)
      : 15_000);

const lyricsWithoutRecommendationBlocks = (text: string): string[] => {
  const rows = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const cleaned: string[] = [];
  let skippingRecommendations = false;
  rows.forEach((line) => {
    if (/^you might also like:?$/iu.test(line)) {
      skippingRecommendations = true;
      return;
    }
    if (skippingRecommendations && SECTION_MARKER.test(line)) {
      skippingRecommendations = false;
    }
    if (!skippingRecommendations && !/^\d*\s*embed$/iu.test(line)) {
      cleaned.push(line);
    }
  });
  return cleaned;
};

export const karaokeMakerLineIsSection = (
  line: Pick<IKaraokeMakerLine, 'kind' | 'tokens'>,
): boolean =>
  line.kind === 'section' ||
  SECTION_MARKER.test(
    line.tokens
      .map((token) => token.text)
      .join(' ')
      .trim(),
  );

const lineTiming = (
  line: IKaraokeMakerLine,
): { startMs?: number; endMs?: number } => {
  const timed = line.tokens.filter((token) => token.startMs !== undefined);
  return {
    startMs: timed.length
      ? Math.min(...timed.map((token) => token.startMs as number))
      : line.startMs,
    endMs: timed.length
      ? Math.max(...timed.map((token) => token.endMs ?? token.startMs ?? 0))
      : line.endMs,
  };
};

/**
 * Place section markers immediately before the following phrase without
 * treating them as vocals. Their timing is derived again after every edit so
 * an old marker can never remain stranded when a recorded line moves.
 */
export const synchronizeKaraokeMakerSections = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => {
  const lines = project.lyrics.lines.map((line, index) => {
    if (!karaokeMakerLineIsSection(line)) {
      return line;
    }
    const previous = [...project.lyrics.lines.slice(0, index)]
      .reverse()
      .find((candidate) => !karaokeMakerLineIsSection(candidate));
    const next = project.lyrics.lines
      .slice(index + 1)
      .find((candidate) => !karaokeMakerLineIsSection(candidate));
    const previousTiming = previous ? lineTiming(previous) : undefined;
    const nextTiming = next ? lineTiming(next) : undefined;
    const nextStartMs = nextTiming?.startMs;
    const preferredStartMs =
      nextStartMs !== undefined
        ? Math.max(previousTiming?.endMs ?? 0, nextStartMs - 2_000)
        : (previousTiming?.endMs ?? line.startMs);
    if (preferredStartMs === undefined) {
      return { ...line, kind: 'section' as const };
    }
    const startMs = Math.max(0, preferredStartMs);
    const endMs = Math.max(
      startMs + 200,
      Math.min(line.endMs ?? startMs + 1_200, nextStartMs ?? startMs + 1_200),
    );
    return { ...line, kind: 'section' as const, startMs, endMs };
  });
  return { ...project, lyrics: { ...project.lyrics, lines } };
};

export interface IKaraokeMakerNote {
  id: string;
  tokenId?: string;
  startMs: number;
  endMs: number;
  targetMidi: number;
  kind: 'normal' | 'golden' | 'free';
  confidence?: number;
  source: TKaraokeMakerSource;
}

export interface IKaraokeMakerLicenseRecord {
  component: string;
  version: string;
  license: string;
  sourceUrl: string;
  modelSha256?: string;
}

export interface IKaraokeMakerProject {
  version: typeof KARAOKE_MAKER_PROJECT_VERSION;
  id: string;
  title: string;
  artist?: string;
  createdAt: string;
  updatedAt: string;
  audio: {
    name: string;
    relativePath: string;
    size: number;
    lastModified: number;
    durationMs?: number;
  };
  lyrics: {
    language?: string;
    source: TKaraokeMakerSource;
    lines: IKaraokeMakerLine[];
  };
  melody: {
    source: TKaraokeMakerSource;
    octavePolicy: 'absolute' | 'nearest-target';
    notes: IKaraokeMakerNote[];
  };
  meta: {
    bpm?: number;
    gapMs: number;
    rightsConfirmed: boolean;
  };
  analysis: {
    waveform?: number[];
    lastRunAt?: string;
    vocalFocus: boolean;
    whisperPasses?: number;
    whisperAlignmentVersion?: number;
  };
  provenance: IKaraokeMakerLicenseRecord[];
}

export interface IKaraokeMakerValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'empty-lyrics'
    | 'untimed-word'
    | 'invalid-word-time'
    | 'invalid-note-time'
    | 'overlapping-notes'
    | 'orphan-note';
  targetId?: string;
  message: string;
}

const finiteOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const confidenceOrUndefined = (value: unknown): number | undefined => {
  const finite = finiteOrUndefined(value);
  return finite === undefined ? undefined : Math.min(1, Math.max(0, finite));
};

const safeDate = (value: unknown, fallback: string): string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : fallback;

const safeSource = (value: unknown): TKaraokeMakerSource =>
  [
    'manual',
    'imported',
    'pitch-analysis',
    'basic-pitch',
    'whisper',
    'auto-align',
  ].includes(String(value))
    ? (value as TKaraokeMakerSource)
    : 'manual';

export const karaokeMakerId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

export const makerLinesFromPlainText = (
  text: string,
  source: TKaraokeMakerSource = 'manual',
): IKaraokeMakerLine[] =>
  lyricsWithoutRecommendationBlocks(text)
    .slice(0, 5_000)
    .map((line) => {
      const isSection = SECTION_MARKER.test(line);
      return {
        id: karaokeMakerId('line'),
        kind: isSection ? ('section' as const) : ('lyrics' as const),
        tokens: (isSection ? [line] : line.split(/\s+/u))
          .filter(Boolean)
          .slice(0, 2_000)
          .map((word) => ({
            id: karaokeMakerId('word'),
            text: word,
            startsWord: true,
            source,
          })),
      };
    });

const karaokeMakerTextWeight = (text: string): number =>
  Math.max(1, Array.from(text).filter((character) => character.trim()).length);

/**
 * Turn one readable word into editable sung syllables. The first token keeps
 * its identity so selections and imported references remain stable. Melody
 * notes linked to the word are cut at the same boundaries and linked to the
 * resulting syllable token, so no note can silently span two syllables.
 */
export const splitKaraokeMakerWordIntoSyllables = (
  project: IKaraokeMakerProject,
  tokenId: string,
  language: string | undefined,
  requestedSyllables?: readonly string[],
): IKaraokeMakerProject => {
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
  let wordStartIndex = selectedIndex;
  while (
    wordStartIndex > 0 &&
    line.tokens[wordStartIndex].startsWord === false
  ) {
    wordStartIndex -= 1;
  }
  let wordEndIndex = wordStartIndex + 1;
  while (
    wordEndIndex < line.tokens.length &&
    line.tokens[wordEndIndex].startsWord === false
  ) {
    wordEndIndex += 1;
  }
  const oldTokens = line.tokens.slice(wordStartIndex, wordEndIndex);
  const wordText = oldTokens.map((token) => token.text).join('');
  const manualSyllables =
    requestedSyllables &&
    requestedSyllables.length > 1 &&
    requestedSyllables.every((syllable) => syllable.length > 0) &&
    requestedSyllables.join('') === wordText
      ? [...requestedSyllables]
      : undefined;
  const syllables =
    manualSyllables ??
    splitKaraokeWordSyllables(
      wordText,
      language ?? project.lyrics.language ?? 'en',
    );
  if (syllables.length <= 1) {
    return project;
  }
  if (
    oldTokens.length === syllables.length &&
    oldTokens.every((token, index) => token.text === syllables[index])
  ) {
    return project;
  }

  const timedStarts = oldTokens.flatMap((token) =>
    token.startMs === undefined ? [] : [token.startMs],
  );
  const timedEnds = oldTokens.flatMap((token) =>
    token.endMs === undefined ? [] : [token.endMs],
  );
  const wordStartMs = timedStarts.length ? Math.min(...timedStarts) : undefined;
  const wordEndMs = timedEnds.length ? Math.max(...timedEnds) : undefined;
  const hasTiming =
    wordStartMs !== undefined &&
    wordEndMs !== undefined &&
    wordEndMs > wordStartMs;
  const totalWeight = syllables.reduce(
    (sum, syllable) => sum + karaokeMakerTextWeight(syllable),
    0,
  );
  let consumedWeight = 0;
  const newTokens = syllables.map((syllable, index): IKaraokeMakerToken => {
    const startProgress = consumedWeight / totalWeight;
    consumedWeight += karaokeMakerTextWeight(syllable);
    const endProgress = consumedWeight / totalWeight;
    const startMs = hasTiming
      ? Math.round(
          (wordStartMs as number) +
            ((wordEndMs as number) - (wordStartMs as number)) * startProgress,
        )
      : undefined;
    let endMs: number | undefined;
    if (hasTiming) {
      endMs =
        index === syllables.length - 1
          ? wordEndMs
          : Math.round(
              (wordStartMs as number) +
                ((wordEndMs as number) - (wordStartMs as number)) * endProgress,
            );
    }
    return {
      ...oldTokens[Math.min(index, oldTokens.length - 1)],
      id: index === 0 ? oldTokens[0].id : karaokeMakerId('word'),
      text: syllable,
      startsWord: index === 0,
      startMs,
      endMs,
      source: 'manual',
      timingLocked: hasTiming ? true : oldTokens[0].timingLocked,
    };
  });
  const oldTokenIds = new Set(oldTokens.map((token) => token.id));
  const linkedNotes = project.melody.notes.filter(
    (note) => note.tokenId && oldTokenIds.has(note.tokenId),
  );
  const linkedNoteIds = new Set(linkedNotes.map((note) => note.id));
  const splitLinkedNotes = linkedNotes.flatMap((note): IKaraokeMakerNote[] => {
    if (!hasTiming) {
      const tokenIndex = Math.max(
        0,
        Math.min(
          newTokens.length - 1,
          Math.floor(
            (linkedNotes.indexOf(note) / Math.max(1, linkedNotes.length)) *
              newTokens.length,
          ),
        ),
      );
      return [{ ...note, tokenId: newTokens[tokenIndex].id, source: 'manual' }];
    }
    const intersections = newTokens.flatMap((token) => {
      const startMs = Math.max(note.startMs, token.startMs as number);
      const endMs = Math.min(note.endMs, token.endMs as number);
      return endMs > startMs ? [{ token, startMs, endMs }] : [];
    });
    if (!intersections.length) {
      const midpoint = (note.startMs + note.endMs) / 2;
      const closest = newTokens.reduce((best, token) => {
        const center =
          ((token.startMs as number) + (token.endMs as number)) / 2;
        const bestCenter =
          ((best.startMs as number) + (best.endMs as number)) / 2;
        return Math.abs(center - midpoint) < Math.abs(bestCenter - midpoint)
          ? token
          : best;
      });
      return [{ ...note, tokenId: closest.id, source: 'manual' }];
    }
    return intersections.map(({ token, startMs, endMs }, index) => ({
      ...note,
      id: index === 0 ? note.id : karaokeMakerId('note'),
      tokenId: token.id,
      startMs,
      endMs,
      source: 'manual' as const,
    }));
  });

  const nextLine = {
    ...line,
    tokens: [
      ...line.tokens.slice(0, wordStartIndex),
      ...newTokens,
      ...line.tokens.slice(wordEndIndex),
    ],
  };
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      source: 'manual',
      lines: project.lyrics.lines.map((candidate, index) =>
        index === lineIndex ? nextLine : candidate,
      ),
    },
    melody: {
      ...project.melody,
      source: linkedNotes.length ? 'manual' : project.melody.source,
      notes: [
        ...project.melody.notes.filter((note) => !linkedNoteIds.has(note.id)),
        ...splitLinkedNotes,
      ].sort((left, right) => left.startMs - right.startMs),
    },
  };
};

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
const cascadeKaraokeMakerLinesForward = (
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
const trimKaraokeMakerLineEnd = (
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

const makerLinesFromSong = (song: IKaraokeSong): IKaraokeMakerLine[] =>
  song.lines.map((line) => {
    const isSection =
      line.kind === 'section' ||
      SECTION_MARKER.test(
        line.tokens
          .map((token) => token.text)
          .join(' ')
          .trim(),
      );
    return {
      id: line.id || karaokeMakerId('line'),
      kind: isSection ? ('section' as const) : ('lyrics' as const),
      startMs: line.startMs,
      endMs: line.endMs,
      tokens: line.tokens
        .filter((token) => token.text.trim())
        .map((token) => ({
          id: karaokeMakerId('word'),
          text: token.text.trim(),
          startsWord: token.startsWord ?? true,
          startMs: isSection ? undefined : token.startMs,
          endMs: isSection ? undefined : token.endMs,
          source: 'imported' as const,
        })),
    };
  });

const closestTokenId = (
  lines: readonly IKaraokeMakerLine[],
  note: IKaraokeToken,
): string | undefined => {
  const midpoint = ((note.startMs ?? 0) + (note.endMs ?? 0)) / 2;
  let best: { id: string; distance: number } | undefined;
  lines.forEach((line) =>
    line.tokens.forEach((token) => {
      if (token.startMs === undefined || token.endMs === undefined) {
        return;
      }
      let distance = 0;
      if (midpoint < token.startMs) {
        distance = token.startMs - midpoint;
      } else if (midpoint > token.endMs) {
        distance = midpoint - token.endMs;
      }
      if (!best || distance < best.distance) {
        best = { id: token.id, distance };
      }
    }),
  );
  return best?.id;
};

export const createKaraokeMakerProject = (
  song: IKaraokeSong,
): IKaraokeMakerProject => {
  const now = new Date().toISOString();
  const audio = song.assets.find((asset) => asset.role === 'audio')?.file;
  const lines = makerLinesFromSong(song);
  const notes =
    song.pitch.kind === 'notes'
      ? song.pitch.notes.flatMap((note): IKaraokeMakerNote[] => {
          if (
            note.startMs === undefined ||
            note.endMs === undefined ||
            note.targetMidi === undefined
          ) {
            return [];
          }
          return [
            {
              id: karaokeMakerId('note'),
              tokenId: closestTokenId(lines, note),
              startMs: note.startMs,
              endMs: note.endMs,
              targetMidi: note.targetMidi,
              kind: note.kind ?? 'normal',
              source: 'imported',
            },
          ];
        })
      : [];
  return {
    version: KARAOKE_MAKER_PROJECT_VERSION,
    id:
      song.meta.sourceFormat === 'fluideq-maker' ? song.id : `maker-${song.id}`,
    title: song.title,
    artist: song.artist,
    createdAt: now,
    updatedAt: now,
    audio: {
      name: audio?.name ?? song.title,
      relativePath: audio ? karaokeFileRelativePath(audio) : song.title,
      size: audio?.size ?? 0,
      lastModified: audio?.lastModified ?? 0,
      durationMs: song.durationMs,
    },
    lyrics: {
      language: song.meta.language,
      source: song.lines.length ? 'imported' : 'manual',
      lines,
    },
    melody: {
      source: notes.length ? 'imported' : 'manual',
      octavePolicy:
        song.pitch.kind === 'notes'
          ? song.pitch.octavePolicy
          : 'nearest-target',
      notes,
    },
    meta: {
      bpm: song.meta.bpm,
      gapMs: song.meta.gapMs,
      rightsConfirmed: false,
    },
    analysis: { vocalFocus: true },
    provenance: [],
  };
};

/** Replace the editable lyrics and melody with any normalized import adapter. */
export const importLyricsIntoKaraokeMakerProject = (
  current: IKaraokeMakerProject,
  parsed: IKaraokeParsedLyrics,
): IKaraokeMakerProject => {
  const imported = createKaraokeMakerProject({
    id: current.id,
    title: parsed.title || current.title,
    artist: parsed.artist ?? current.artist,
    durationMs: current.audio.durationMs,
    assets: [],
    timingPrecision: parsed.timingPrecision,
    lines: parsed.lines,
    pitch: parsed.pitch,
    meta: {
      sourceFormat: parsed.sourceFormat,
      gapMs: parsed.gapMs,
      bpm: parsed.bpm,
    },
  });
  return touchKaraokeMakerProject({
    ...imported,
    id: current.id,
    createdAt: current.createdAt,
    audio: current.audio,
    lyrics: {
      ...imported.lyrics,
      language: parsed.language ?? current.lyrics.language,
    },
    meta: {
      ...imported.meta,
      rightsConfirmed: current.meta.rightsConfirmed,
    },
    analysis: current.analysis,
    provenance: current.provenance,
  });
};

export const touchKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): IKaraokeMakerProject => ({
  ...project,
  updatedAt: new Date().toISOString(),
});

export const serializeKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): string => `${JSON.stringify(touchKaraokeMakerProject(project), null, 2)}\n`;

/** Parse an untrusted project without allowing unbounded arrays into the UI. */
export const parseKaraokeMakerProject = (
  contents: string,
): IKaraokeMakerProject => {
  const value = JSON.parse(contents) as Partial<IKaraokeMakerProject>;
  if (value.version !== KARAOKE_MAKER_PROJECT_VERSION) {
    throw new Error('Unsupported FluidEQ Karaoke Maker project version.');
  }
  const now = new Date().toISOString();
  const rawLinesUnfiltered = Array.isArray(value.lyrics?.lines)
    ? value.lyrics.lines.slice(0, 5_000)
    : [];
  const legacyWhisperAlignment =
    value.analysis?.whisperAlignmentVersion !==
    KARAOKE_MAKER_WHISPER_ALIGNMENT_VERSION;
  let skippingRecommendations = false;
  const rawLines = rawLinesUnfiltered.filter((line) => {
    const text = (Array.isArray(line?.tokens) ? line.tokens : [])
      .map((token) => String(token?.text ?? ''))
      .join(' ')
      .trim();
    if (/^you might also like:?$/iu.test(text)) {
      skippingRecommendations = true;
      return false;
    }
    if (skippingRecommendations && SECTION_MARKER.test(text)) {
      skippingRecommendations = false;
    }
    return !skippingRecommendations && !/^\d*\s*embed$/iu.test(text);
  });
  const clearedAutomaticTokenIds = new Set<string>();
  const lines: IKaraokeMakerLine[] = rawLines.map((line, lineIndex) => ({
    id:
      typeof line?.id === 'string' && line.id
        ? line.id.slice(0, 256)
        : `line-${lineIndex}`,
    kind:
      line?.kind === 'section' ||
      SECTION_MARKER.test(
        (Array.isArray(line?.tokens) ? line.tokens : [])
          .map((token) => String(token?.text ?? ''))
          .join(' ')
          .trim(),
      )
        ? 'section'
        : 'lyrics',
    startMs: finiteOrUndefined(line?.startMs),
    endMs: finiteOrUndefined(line?.endMs),
    tokens: (Array.isArray(line?.tokens) ? line.tokens : [])
      .slice(0, 2_000)
      .map((token, tokenIndex) => {
        const id =
          typeof token?.id === 'string' && token.id
            ? token.id.slice(0, 256)
            : `word-${lineIndex}-${tokenIndex}`;
        const text =
          typeof token?.text === 'string' ? token.text.slice(0, 2_000) : '';
        const source = safeSource(token?.source);
        let startMs = finiteOrUndefined(token?.startMs);
        let endMs = finiteOrUndefined(token?.endMs);
        const confidence = confidenceOrUndefined(token?.confidence);
        const inheritedUnsafeEstimate =
          legacyWhisperAlignment &&
          source === 'whisper' &&
          token?.timingLocked !== true;
        if (
          inheritedUnsafeEstimate ||
          (startMs !== undefined &&
            endMs !== undefined &&
            !karaokeMakerWordDurationIsPlausible(text, endMs - startMs, source))
        ) {
          startMs = undefined;
          endMs = undefined;
          clearedAutomaticTokenIds.add(id);
        }
        return {
          id,
          text,
          startsWord: token?.startsWord !== false,
          startMs,
          endMs,
          confidence: startMs === undefined ? undefined : confidence,
          source,
          timingLocked:
            startMs === undefined
              ? undefined
              : token?.timingLocked === true || undefined,
        };
      })
      .filter((token) => token.text.trim()),
  }));
  const notes: IKaraokeMakerNote[] = (
    Array.isArray(value.melody?.notes) ? value.melody.notes : []
  )
    .slice(0, 100_000)
    .flatMap((note, noteIndex): IKaraokeMakerNote[] => {
      const startMs = finiteOrUndefined(note?.startMs);
      const endMs = finiteOrUndefined(note?.endMs);
      const targetMidi = finiteOrUndefined(note?.targetMidi);
      if (
        startMs === undefined ||
        endMs === undefined ||
        targetMidi === undefined ||
        (typeof note?.tokenId === 'string' &&
          clearedAutomaticTokenIds.has(note.tokenId) &&
          karaokeMakerSourceIsAutomatic(safeSource(note?.source)))
      ) {
        return [];
      }
      return [
        {
          id:
            typeof note?.id === 'string' && note.id
              ? note.id.slice(0, 256)
              : `note-${noteIndex}`,
          tokenId:
            typeof note?.tokenId === 'string'
              ? note.tokenId.slice(0, 256)
              : undefined,
          startMs,
          endMs,
          targetMidi,
          kind: ['normal', 'golden', 'free'].includes(String(note?.kind))
            ? note.kind
            : 'normal',
          confidence: confidenceOrUndefined(note?.confidence),
          source: safeSource(note?.source),
        },
      ];
    });
  return {
    version: KARAOKE_MAKER_PROJECT_VERSION,
    id:
      typeof value.id === 'string'
        ? value.id.slice(0, 512)
        : karaokeMakerId('project'),
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title.slice(0, 2_000)
        : 'Untitled karaoke',
    artist:
      typeof value.artist === 'string'
        ? value.artist.slice(0, 2_000)
        : undefined,
    createdAt: safeDate(value.createdAt, now),
    updatedAt: safeDate(value.updatedAt, now),
    audio: {
      name:
        typeof value.audio?.name === 'string'
          ? value.audio.name.slice(0, 2_000)
          : '',
      relativePath:
        typeof value.audio?.relativePath === 'string'
          ? value.audio.relativePath.slice(0, 4_096)
          : '',
      size: Math.max(0, finiteOrUndefined(value.audio?.size) ?? 0),
      lastModified: Math.max(
        0,
        finiteOrUndefined(value.audio?.lastModified) ?? 0,
      ),
      durationMs: finiteOrUndefined(value.audio?.durationMs),
    },
    lyrics: {
      language:
        typeof value.lyrics?.language === 'string'
          ? value.lyrics.language.slice(0, 64)
          : undefined,
      source: safeSource(value.lyrics?.source),
      lines,
    },
    melody: {
      source: safeSource(value.melody?.source),
      octavePolicy:
        value.melody?.octavePolicy === 'absolute'
          ? 'absolute'
          : 'nearest-target',
      notes,
    },
    meta: {
      bpm: finiteOrUndefined(value.meta?.bpm),
      gapMs: finiteOrUndefined(value.meta?.gapMs) ?? 0,
      rightsConfirmed: value.meta?.rightsConfirmed === true,
    },
    analysis: {
      waveform: Array.isArray(value.analysis?.waveform)
        ? value.analysis.waveform
            .slice(0, 8_192)
            .map((peak) => Math.min(1, Math.max(0, Number(peak) || 0)))
        : undefined,
      lastRunAt:
        typeof value.analysis?.lastRunAt === 'string'
          ? value.analysis.lastRunAt
          : undefined,
      vocalFocus: value.analysis?.vocalFocus !== false,
      whisperPasses:
        typeof value.analysis?.whisperPasses === 'number'
          ? Math.max(0, Math.min(100, Math.floor(value.analysis.whisperPasses)))
          : undefined,
      whisperAlignmentVersion:
        typeof value.analysis?.whisperAlignmentVersion === 'number'
          ? Math.max(0, Math.floor(value.analysis.whisperAlignmentVersion))
          : undefined,
    },
    provenance: (Array.isArray(value.provenance) ? value.provenance : [])
      .slice(0, 100)
      .flatMap((record): IKaraokeMakerLicenseRecord[] =>
        record &&
        typeof record.component === 'string' &&
        typeof record.version === 'string' &&
        typeof record.license === 'string' &&
        typeof record.sourceUrl === 'string'
          ? [
              {
                component: record.component.slice(0, 256),
                version: record.version.slice(0, 128),
                license: record.license.slice(0, 128),
                sourceUrl: record.sourceUrl.slice(0, 2_048),
                modelSha256:
                  typeof record.modelSha256 === 'string'
                    ? record.modelSha256.slice(0, 128)
                    : undefined,
              },
            ]
          : [],
      ),
  };
};

const playableWordWeight = (word: string): number =>
  Math.max(
    1,
    Array.from(word).filter((character) => /[\p{L}\p{N}]/u.test(character))
      .length,
  );

/**
 * Close only bounded detector holes for playback. A complete unmatched line
 * remains untimed, but a dropped short word between two real Whisper anchors
 * receives its share of that same vocal window. This keeps preview progress
 * continuous without painting supplied lyrics over instrumental sections.
 */
const makePlayableLyricTokens = (line: IKaraokeMakerLine): IKaraokeToken[] => {
  const tokens: IKaraokeToken[] = line.tokens.map((word) => ({
    text: word.text,
    startsWord: word.startsWord,
    startMs: word.startMs,
    endMs: word.endMs,
  }));
  if (karaokeMakerLineIsSection(line)) {
    return tokens;
  }
  const timedWordCount = tokens.filter(
    (token) =>
      token.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs,
  ).length;
  const hasStrongLineEvidence =
    timedWordCount >= Math.max(2, Math.ceil(tokens.length * 0.55));

  let missingStart = -1;
  for (let index = 0; index <= tokens.length; index += 1) {
    const token = tokens[index];
    const isTimed =
      token?.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs;
    if (!isTimed && index < tokens.length) {
      missingStart = missingStart < 0 ? index : missingStart;
    } else if (missingStart >= 0) {
      const missingEnd = index;
      const left = tokens[missingStart - 1];
      const right = tokens[missingEnd];
      if (
        hasStrongLineEvidence &&
        left?.endMs !== undefined &&
        right?.startMs !== undefined &&
        right.startMs > left.endMs
      ) {
        const missing = tokens.slice(missingStart, missingEnd);
        const availableMs = right.startMs - left.endMs;
        const maximumSafeMs = Math.max(2_500, missing.length * 1_200);
        if (
          availableMs >= missing.length * 20 &&
          availableMs <= maximumSafeMs
        ) {
          const weights = missing.map((word) => playableWordWeight(word.text));
          const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
          let consumedWeight = 0;
          missing.forEach((word, missingIndex) => {
            const startMs =
              (left.endMs as number) +
              (availableMs * consumedWeight) / totalWeight;
            consumedWeight += weights[missingIndex];
            const endMs =
              (left.endMs as number) +
              (availableMs * consumedWeight) / totalWeight;
            Object.assign(word, {
              startMs: Math.round(startMs),
              endMs: Math.max(Math.round(startMs) + 1, Math.round(endMs)),
            });
          });
        }
      }
      missingStart = -1;
    }
  }

  // The detector already rejects crossed evidence. Keep the preview robust to
  // an older draft by trimming only automatic-looking overlap in this copy.
  let previousEndMs: number | undefined;
  tokens.forEach((token) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      return;
    }
    const startMs = Math.max(previousEndMs ?? 0, token.startMs);
    if (token.endMs <= startMs) {
      token.startMs = undefined;
      token.endMs = undefined;
      return;
    }
    token.startMs = startMs;
    previousEndMs = token.endMs;
  });
  return tokens;
};

const makePlayableLines = (project: IKaraokeMakerProject): IKaraokeLine[] =>
  project.lyrics.lines.flatMap((line): IKaraokeLine[] => {
    // Lyric progress must always use the repaired word timestamps. Melody
    // notes have their own pitch track and may cover only part of a word.
    // Replacing lyric tokens with those notes made the editor and preview show
    // different starts, endings and gaps for the exact same project.
    const tokens = makePlayableLyricTokens(line);
    if (!tokens.length) {
      return [];
    }
    const timed = tokens.filter((token) => token.startMs !== undefined);
    return [
      {
        id: line.id,
        kind: karaokeMakerLineIsSection(line) ? 'section' : 'lyrics',
        startMs: timed.length
          ? Math.min(...timed.map((token) => token.startMs as number))
          : line.startMs,
        endMs: timed.length
          ? Math.max(...timed.map((token) => token.endMs ?? token.startMs ?? 0))
          : line.endMs,
        tokens,
      },
    ];
  });

const makePlayablePitchNotes = (
  project: IKaraokeMakerProject,
): IKaraokeToken[] => {
  const wordsById = new Map(
    project.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.id, token] as const),
    ),
  );
  const seenTokenIds = new Set<string>();
  return [...project.melody.notes]
    .filter((note) => note.tokenId && wordsById.has(note.tokenId))
    .sort((left, right) => left.startMs - right.startMs)
    .map((note) => {
      const word = note.tokenId ? wordsById.get(note.tokenId) : undefined;
      const beginsWord = Boolean(
        word && note.tokenId && !seenTokenIds.has(note.tokenId),
      );
      if (note.tokenId) {
        seenTokenIds.add(note.tokenId);
      }
      return {
        text: beginsWord ? (word?.text ?? '') : '',
        startsWord: beginsWord ? word?.startsWord : false,
        startMs: note.startMs,
        endMs: note.endMs,
        targetMidi: note.targetMidi,
        kind: note.kind,
      };
    });
};

export const karaokeMakerProjectToSong = (
  project: IKaraokeMakerProject,
  audioAsset: IKaraokeAsset,
  sourceAssets: readonly IKaraokeAsset[] = [audioAsset],
): IKaraokeSong => {
  const lines = makePlayableLines(project);
  const notes = makePlayablePitchNotes(project);
  const assets = sourceAssets.some((asset) => asset.role === 'audio')
    ? Array.from(sourceAssets)
    : [audioAsset, ...sourceAssets];
  return {
    id: project.id,
    title: project.title,
    artist: project.artist,
    durationMs: project.audio.durationMs,
    // Applying a draft changes only the normalized in-memory timing. Keep the
    // original lyrics/CDG/MIDI assets attached so the source remains available
    // for re-import, session restore, and explicit export. No source file is
    // written by this operation.
    assets,
    timingPrecision: notes.length ? 'syllable' : 'word',
    lines,
    pitch: notes.length
      ? {
          kind: 'notes',
          source: 'fluideq-maker',
          coordinateSystem: 'midi-semitones',
          octavePolicy: project.melody.octavePolicy,
          notes,
        }
      : { kind: 'none', reason: 'missing' },
    meta: {
      sourceFormat: 'fluideq-maker',
      gapMs: project.meta.gapMs,
      bpm: project.meta.bpm,
      language: project.lyrics.language,
    },
  };
};

export const validateKaraokeMakerProject = (
  project: IKaraokeMakerProject,
): IKaraokeMakerValidationIssue[] => {
  const issues: IKaraokeMakerValidationIssue[] = [];
  const tokens = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);
  if (!tokens.length) {
    issues.push({
      severity: 'error',
      code: 'empty-lyrics',
      message: 'Add or import lyrics before exporting.',
    });
  }
  tokens.forEach((token) => {
    if (token.startMs === undefined || token.endMs === undefined) {
      issues.push({
        severity: 'warning',
        code: 'untimed-word',
        targetId: token.id,
        message: `“${token.text}” has no timing yet.`,
      });
    } else if (token.startMs < 0 || token.endMs <= token.startMs) {
      issues.push({
        severity: 'error',
        code: 'invalid-word-time',
        targetId: token.id,
        message: `“${token.text}” has an invalid time range.`,
      });
    } else if (
      !karaokeMakerWordDurationIsPlausible(
        token.text,
        token.endMs - token.startMs,
        token.source,
      )
    ) {
      issues.push({
        severity: 'error',
        code: 'invalid-word-time',
        targetId: token.id,
        message: `“${token.text}” lasts implausibly long and must be realigned.`,
      });
    }
  });
  const tokenIds = new Set(tokens.map((token) => token.id));
  const notes = [...project.melody.notes].sort(
    (left, right) => left.startMs - right.startMs,
  );
  notes.forEach((note, index) => {
    if (
      note.startMs < 0 ||
      note.endMs <= note.startMs ||
      !Number.isFinite(note.targetMidi)
    ) {
      issues.push({
        severity: 'error',
        code: 'invalid-note-time',
        targetId: note.id,
        message: 'A melody note has an invalid pitch or time range.',
      });
    }
    if (note.tokenId && !tokenIds.has(note.tokenId)) {
      issues.push({
        severity: 'warning',
        code: 'orphan-note',
        targetId: note.id,
        message: 'A melody note is not connected to a lyric.',
      });
    }
    const previous = notes[index - 1];
    if (previous && note.startMs < previous.endMs) {
      issues.push({
        severity: 'warning',
        code: 'overlapping-notes',
        targetId: note.id,
        message: 'Two melody notes overlap.',
      });
    }
  });
  return issues;
};

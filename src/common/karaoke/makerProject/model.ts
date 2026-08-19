/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { karaokeMakerLineTokens } from './lineTokens';
import { splitKaraokeWordSyllables } from '../syllables';

/**
 * What a Maker project is made of, and the arithmetic everything else asks.
 *
 * Types, constants and the line-range questions — where a line starts, whether
 * it is a section heading, how long a word may plausibly be. Every other module
 * here imports this one and none of them import each other's internals, which is
 * what keeps the rest of the directory a layer rather than a pile.
 *
 * The parse helpers at the end (safeDate, finiteOrUndefined and friends) are
 * exported for `project`, not for callers: reading a number off untrusted JSON
 * is the same job wherever it happens, and duplicating it is how two readers of
 * the same file end up disagreeing about what a missing field means.
 */
import { isKaraokeSectionText } from '../sections';

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

/**
 * The longest a sung word may plausibly last.
 *
 * This counted letters, which is a fact about spelling rather than about
 * singing, and it punished exactly the voices worth detecting: a phrase-final
 * "Ohhh" held six seconds was capped at 1.8 s, "I" at 1.2 s, and because one
 * Han or Kana character is one word, *every* sustained CJK syllable was capped
 * at 1.2 s as well. Depending on the path that either truncated the highlight
 * — leaving the line dead for the rest of the note — or discarded the word's
 * timing outright.
 *
 * Syllables are what a singer holds, so they set the ceiling. The number this
 * exists to reject is a chunk-sized timestamp of twenty to thirty seconds, and
 * nine seconds still refuses those while leaving room for a real held note.
 *
 * The 2 500 ms floor truncates a phrase-final "Ohhh" and that is a real cost,
 * knowingly paid. Raising it to six seconds was tried and reverted: this same
 * number decides whether a span is a held note or a fabricated one, and at six
 * seconds the guard that keeps a word out of an instrumental gap stops firing
 * — measured, three words on one song sat exactly at this cap, each of them
 * Whisper reporting a position it did not have. A held note truncated is
 * visible and fixable; a word parked in silence looks detected.
 *
 * The way out is not a different constant. It is to allow the long span only
 * when nothing competes for that time — when the next word is further away
 * than the cap — so the two cases stop sharing one number.
 */
export const karaokeMakerMaximumAutomaticWordDurationMs = (
  text: string,
): number => {
  const syllableCount = Math.max(1, splitKaraokeWordSyllables(text).length);
  return Math.min(9_000, Math.max(2_500, syllableCount * 1_800));
};

export const karaokeMakerSourceIsAutomatic = (
  source: TKaraokeMakerSource,
): boolean =>
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
    if (skippingRecommendations && isKaraokeSectionText(line)) {
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
  isKaraokeSectionText(
    line.tokens
      .map((token) => token.text)
      .join(' ')
      .trim(),
  );

/**
 * Whether this project is already a finished karaoke.
 *
 * The question the Maker asks when a song is opened: is there anything here to
 * detect, or has the work already been done? "Finished" means every sung word
 * has a start and an end — lyrics with no timings are a lyric sheet, and
 * lyrics where only some lines are timed are a job someone abandoned halfway,
 * which is exactly the case worth offering to finish.
 *
 * Section markers are excluded because they are labels rather than singing, and
 * they never carry timings. Counting them would make every project look
 * unfinished and re-run detection over work the user had already done.
 */
export const karaokeMakerHasCompleteTiming = (
  lines: readonly IKaraokeMakerLine[],
): boolean => {
  const sung = lines.filter((line) => !karaokeMakerLineIsSection(line));
  const tokens = sung.flatMap((line) => line.tokens);
  if (!tokens.length) {
    return false;
  }
  return tokens.every(
    (token) =>
      token.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs,
  );
};

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
  // Where each heading sits inside its own run of consecutive headings.
  //
  // Every heading looks past its neighbouring headings for the sung lines
  // either side of it, so two written together — "[Bridge]" then "[Chorus]",
  // which is how a sheet marks a bridge that runs straight into one — found
  // the same previous line and the same next line and were handed byte
  // identical ranges. Two labels on one instant: the second is drawn on top of
  // the first, and the run reads as a single heading with the wrong name.
  const runs = new Map<number, { length: number; position: number }>();
  project.lyrics.lines.forEach((line, index) => {
    if (!karaokeMakerLineIsSection(line)) {
      return;
    }
    const previous = runs.get(index - 1);
    const position = previous ? previous.position + 1 : 0;
    runs.set(index, { length: position + 1, position });
    // The run's length is only known at its end, so every member is corrected
    // backwards once the last one is seen.
    for (let at = index - position; at <= index; at += 1) {
      const member = runs.get(at);
      if (member) {
        runs.set(at, { ...member, length: position + 1 });
      }
    }
  });
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
    const run = runs.get(index);
    if (run && run.length > 1) {
      // The window the whole run has to share, cut into equal slices in the
      // order the headings are written. 200 ms is the floor a single heading
      // already had; below it a run simply runs on past the next sung line,
      // which is visible and in order rather than invisible and stacked.
      const windowEndMs = nextStartMs ?? startMs + 1_200 * run.length;
      const sliceMs = Math.max(200, (windowEndMs - startMs) / run.length);
      const slotStartMs = startMs + run.position * sliceMs;
      return {
        ...line,
        kind: 'section' as const,
        startMs: slotStartMs,
        endMs: slotStartMs + sliceMs,
      };
    }
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

export const finiteOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const confidenceOrUndefined = (value: unknown): number | undefined => {
  const finite = finiteOrUndefined(value);
  return finite === undefined ? undefined : Math.min(1, Math.max(0, finite));
};

export const safeDate = (value: unknown, fallback: string): string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : fallback;

export const safeSource = (value: unknown): TKaraokeMakerSource =>
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
      const isSection = isKaraokeSectionText(line);
      return {
        id: karaokeMakerId('line'),
        kind: isSection ? ('section' as const) : ('lyrics' as const),
        tokens: (isSection ? [line] : karaokeMakerLineTokens(line))
          .filter(Boolean)
          // A Japanese line is one token per character, so a cap sized for
          // spaced words truncates real lyrics. Raised to sit above any sung
          // line while still refusing a pasted document.
          .slice(0, 4_000)
          .map((word) => ({
            id: karaokeMakerId('word'),
            text: word,
            startsWord: true,
            source,
          })),
      };
    });

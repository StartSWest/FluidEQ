/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createKaraokeNoteTally,
  type IKaraokeNoteResult,
  type IKaraokeNoteTally,
  type IKaraokeScoreLine,
  type IKaraokeScoreSheet,
  isKaraokeHit,
  judgeKaraokeNote,
  tallyKaraokeNote,
} from './scoring';

/**
 * One pass through a song: what has been heard in every note and the verdict
 * on every note that has ended. Advanced by song time, so it follows the
 * transport rather than the wall clock — a rewind is a fresh run and a jump
 * forward leaves the notes it passed unjudged.
 */
export interface IKaraokeScoreRun {
  sheet: IKaraokeScoreSheet;
  tallies: IKaraokeNoteTally[];
  results: (IKaraokeNoteResult | undefined)[];
  /** The song time the run has heard up to; undefined before the first. */
  cursorMs: number | undefined;
  /** The first note with no verdict yet: the one being sung or coming. */
  firstOpen: number;
}

export const createKaraokeScoreRun = (
  sheet: IKaraokeScoreSheet,
): IKaraokeScoreRun => ({
  sheet,
  tallies: sheet.notes.map(createKaraokeNoteTally),
  results: sheet.notes.map(() => undefined),
  cursorMs: undefined,
  firstOpen: 0,
});

const judge = (run: IKaraokeScoreRun, index: number): void => {
  const { sheet } = run;
  run.results[index] = judgeKaraokeNote(
    run.tallies[index],
    sheet.notes[index],
    sheet.totalWeight,
    sheet.octavePolicy,
  );
};

const advanceFirstOpen = (run: IKaraokeScoreRun): void => {
  while (
    run.firstOpen < run.results.length &&
    run.results[run.firstOpen] !== undefined
  ) {
    run.firstOpen += 1;
  }
};

/** Judge every open note that has ended by `atMs`; their indexes, in order. */
const judgeEnded = (run: IKaraokeScoreRun, atMs: number): number[] => {
  const judged: number[] = [];
  const { notes } = run.sheet;
  for (
    let index = run.firstOpen;
    index < notes.length && notes[index].startMs < atMs;
    index += 1
  ) {
    if (run.results[index] === undefined && notes[index].endMs <= atMs) {
      judge(run, index);
      judged.push(index);
    }
  }
  advanceFirstOpen(run);
  return judged;
};

/**
 * Hear `[fromMs, toMs)` of the song sung at `sungMidi` (silent when
 * undefined). Mutates the run; returns the notes that ended in it.
 */
export const stepKaraokeScore = (
  run: IKaraokeScoreRun,
  fromMs: number,
  toMs: number,
  sungMidi: number | undefined,
): number[] => {
  const { notes } = run.sheet;
  for (
    let index = run.firstOpen;
    index < notes.length && notes[index].startMs < toMs;
    index += 1
  ) {
    if (run.results[index] === undefined) {
      tallyKaraokeNote(
        run.tallies[index],
        notes[index],
        fromMs,
        toMs,
        sungMidi,
      );
    }
  }
  run.cursorMs = toMs;
  return judgeEnded(run, toMs);
};

/**
 * The transport jumped to `toMs`. Backwards starts a fresh run; either way
 * the notes that ended before `toMs` are judged on what was heard of them,
 * which for a note jumped over is nothing, and so `skipped` — not scored,
 * rather than missed. Returns the run to keep, which is new after a rewind.
 */
export const seekKaraokeScore = (
  run: IKaraokeScoreRun,
  toMs: number,
): IKaraokeScoreRun => {
  const next =
    run.cursorMs !== undefined && toMs < run.cursorMs
      ? createKaraokeScoreRun(run.sheet)
      : run;
  judgeEnded(next, toMs);
  next.cursorMs = toMs;
  return next;
};

/** The song is over: every note still open is judged on what was heard. */
export const finishKaraokeScore = (run: IKaraokeScoreRun): number[] => {
  const judged: number[] = [];
  run.results.forEach((result, index) => {
    if (result === undefined) {
      judge(run, index);
      judged.push(index);
    }
  });
  advanceFirstOpen(run);
  return judged;
};

/** Points so far, out of 10 000 for the whole song. */
export const karaokeScoreTotal = (
  results: readonly (IKaraokeNoteResult | undefined)[],
): number => results.reduce((sum, result) => sum + (result?.points ?? 0), 0);

/**
 * Good notes in a row, counted back from the latest verdict. A skipped note
 * neither adds nor breaks: it was not sung against.
 */
export const karaokeStreak = (
  results: readonly (IKaraokeNoteResult | undefined)[],
): number => {
  let streak = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const verdict = results[index]?.verdict;
    if (verdict !== undefined && verdict !== 'skipped') {
      if (!isKaraokeHit(verdict)) {
        return streak;
      }
      streak += 1;
    }
  }
  return streak;
};

export type TKaraokeRating =
  'excellent' | 'great' | 'good' | 'fair' | 'practice';

/** A 0-1 share of the credit in words, for a line or the whole song. */
export const karaokeRating = (share: number): TKaraokeRating => {
  if (share >= 0.9) {
    return 'excellent';
  }
  if (share >= 0.75) {
    return 'great';
  }
  if (share >= 0.6) {
    return 'good';
  }
  if (share >= 0.4) {
    return 'fair';
  }
  return 'practice';
};

export interface IKaraokeLineResult {
  /** Every note of the line has its verdict. */
  closed: boolean;
  /** 0-1, weighted by length; undefined while nothing in it was judged. */
  share: number | undefined;
}

/** How a lyric line went, from its notes' verdicts. */
export const karaokeLineResult = (
  line: IKaraokeScoreLine,
  sheet: IKaraokeScoreSheet,
  results: readonly (IKaraokeNoteResult | undefined)[],
): IKaraokeLineResult => {
  let weight = 0;
  let earned = 0;
  let closed = true;
  line.noteIndexes.forEach((index) => {
    const result = results[index];
    if (result === undefined) {
      closed = false;
      return;
    }
    if (result.verdict !== 'skipped') {
      weight += sheet.notes[index].weight;
      earned += sheet.notes[index].weight * result.credit;
    }
  });
  return { closed, share: weight > 0 ? earned / weight : undefined };
};

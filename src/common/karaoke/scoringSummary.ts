/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IKaraokeNoteResult,
  type IKaraokeScoreSheet,
  isKaraokeHit,
  KARAOKE_SCORE_MAX,
  type TKaraokeVerdict,
} from './scoring';
import {
  karaokeLineResult,
  karaokeRating,
  karaokeScoreTotal,
  type TKaraokeRating,
} from './scoringRun';

type TResults = readonly (IKaraokeNoteResult | undefined)[];

const judgedResults = (results: TResults): IKaraokeNoteResult[] =>
  results.filter(
    (result): result is IKaraokeNoteResult =>
      result !== undefined && result.verdict !== 'skipped',
  );

/**
 * Of the time sung inside the judged notes, the share that was in tune.
 * Silence is not counted against it: "notes hit" and "on time" already say
 * what was not sung, and this says how well what was sung sat on the note.
 */
export const karaokeInTuneShare = (results: TResults): number | undefined => {
  const judged = judgedResults(results);
  const voicedMs = judged.reduce((sum, result) => sum + result.voicedMs, 0);
  return voicedMs > 0
    ? judged.reduce((sum, result) => sum + result.inTuneMs, 0) / voicedMs
    : undefined;
};

/** Of the notes sung at all, the share that came in on time. */
export const karaokeOnTimeShare = (results: TResults): number | undefined => {
  const sung = judgedResults(results).filter(
    (result) => result.verdict !== 'missed',
  );
  return sung.length
    ? sung.filter((result) => result.onTime).length / sung.length
    : undefined;
};

export type TKaraokeProblem = 'low' | 'high' | 'late' | 'missed';

export type TKaraokeTip = TKaraokeProblem | 'octave' | 'clean';

export interface IKaraokeHardestLine {
  index: number;
  share: number;
  problem: TKaraokeProblem | undefined;
  /** The mean error of its low or high notes, in whole cents. */
  cents: number;
}

export interface IKaraokeRunSummary {
  score: number;
  rating: TKaraokeRating;
  inTuneShare: number | undefined;
  onTimeShare: number | undefined;
  hits: number;
  judged: number;
  counts: Record<Exclude<TKaraokeVerdict, 'skipped'>, number>;
  /** The share of the song's weight that was judged at all. */
  coverage: number;
  /** Each line's 0-100, undefined for a line nothing of was judged. */
  linePercents: (number | undefined)[];
  hardestLine: IKaraokeHardestLine | undefined;
  tip: TKaraokeTip;
}

const PROBLEMS: readonly TKaraokeProblem[] = ['low', 'high', 'late', 'missed'];

/** The problem that took the most note length among `indexes`. */
const dominantProblem = (
  indexes: readonly number[],
  sheet: IKaraokeScoreSheet,
  results: TResults,
): TKaraokeProblem | undefined => {
  const lengthOf = new Map<TKaraokeProblem, number>();
  indexes.forEach((index) => {
    const verdict = results[index]?.verdict;
    const problem = PROBLEMS.find((candidate) => candidate === verdict);
    if (problem) {
      lengthOf.set(
        problem,
        (lengthOf.get(problem) ?? 0) + sheet.notes[index].weight,
      );
    }
  });
  let found: TKaraokeProblem | undefined;
  let longest = 0;
  lengthOf.forEach((length, problem) => {
    if (length > longest) {
      longest = length;
      found = problem;
    }
  });
  return found;
};

const meanOffCents = (
  indexes: readonly number[],
  results: TResults,
): number => {
  const off = indexes
    .map((index) => results[index])
    .filter(
      (result): result is IKaraokeNoteResult =>
        result?.verdict === 'low' || result?.verdict === 'high',
    );
  return off.length
    ? Math.round(
        Math.abs(
          off.reduce((sum, result) => sum + result.meanCents, 0) / off.length,
        ),
      )
    : 0;
};

/** Everything the end-of-song card says about a run. */
export const summarizeKaraokeRun = (
  sheet: IKaraokeScoreSheet,
  results: TResults,
): IKaraokeRunSummary => {
  const judged = judgedResults(results);
  const counts: IKaraokeRunSummary['counts'] = {
    perfect: 0,
    good: 0,
    late: 0,
    low: 0,
    high: 0,
    missed: 0,
  };
  judged.forEach((result) => {
    if (result.verdict !== 'skipped') {
      counts[result.verdict] += 1;
    }
  });
  const judgedWeight = sheet.notes.reduce((sum, note) => {
    const verdict = results[note.index]?.verdict;
    return verdict !== undefined && verdict !== 'skipped'
      ? sum + note.weight
      : sum;
  }, 0);
  const lineShares = sheet.lines.map(
    (line) => karaokeLineResult(line, sheet, results).share,
  );
  let hardestLine: IKaraokeHardestLine | undefined;
  lineShares.forEach((share, index) => {
    if (share !== undefined && (!hardestLine || share < hardestLine.share)) {
      const { noteIndexes } = sheet.lines[index];
      hardestLine = {
        index,
        share,
        problem: dominantProblem(noteIndexes, sheet, results),
        cents: meanOffCents(noteIndexes, results),
      };
    }
  });
  const score = karaokeScoreTotal(results);
  const hits = counts.perfect + counts.good;
  const octaveHits = judged.filter(
    (result) => result.octave && isKaraokeHit(result.verdict),
  ).length;
  let tip: TKaraokeTip =
    dominantProblem(
      sheet.notes.map((note) => note.index),
      sheet,
      results,
    ) ?? 'clean';
  // Mostly good, a third of it an octave away: the most useful thing to say
  // is that it counted, and how to meet the record's own octave. Mostly
  // clean otherwise: there is no problem worth naming.
  if (hits > 0 && octaveHits * 3 >= hits && hits >= judged.length * 0.6) {
    tip = 'octave';
  } else if (hits >= judged.length * 0.85) {
    tip = 'clean';
  }
  return {
    score,
    rating: karaokeRating(score / KARAOKE_SCORE_MAX),
    inTuneShare: karaokeInTuneShare(results),
    onTimeShare: karaokeOnTimeShare(results),
    hits,
    judged: judged.length,
    counts,
    coverage: sheet.totalWeight > 0 ? judgedWeight / sheet.totalWeight : 0,
    linePercents: lineShares.map((share) =>
      share === undefined ? undefined : Math.round(share * 100),
    ),
    hardestLine,
    tip,
  };
};

/**
 * Whether the run is worth a card at the end: something was sung, and at
 * least half the song was heard. A practised passage that runs on to the end
 * is not a performance of the song, and its card would read as a bad one.
 */
export const karaokeRunDeservesSummary = (
  summary: IKaraokeRunSummary,
): boolean => summary.coverage >= 0.5 && summary.judged > summary.counts.missed;

/** Each line's change against the best attempt's, in percentage points. */
export const karaokeLineDeltas = (
  current: readonly (number | undefined)[],
  best: readonly (number | null)[] | undefined,
): (number | undefined)[] =>
  current.map((percent, index) => {
    const before = best?.[index];
    return percent === undefined ||
      before === undefined ||
      before === null ||
      best?.length !== current.length
      ? undefined
      : percent - before;
  });

export type TKaraokeProgress =
  | { kind: 'first' }
  | { kind: 'same' }
  | { kind: 'up'; line: number; delta: number }
  | { kind: 'down'; line: number; delta: number }
  | { kind: 'upDown'; up: number; delta: number; down: number };

/** The one-line progress note under the map, from the line deltas. */
export const karaokeProgress = (
  deltas: readonly (number | undefined)[],
  hasHistory: boolean,
): TKaraokeProgress => {
  if (!hasHistory) {
    return { kind: 'first' };
  }
  let up: { line: number; delta: number } | undefined;
  let down: { line: number; delta: number } | undefined;
  deltas.forEach((delta, line) => {
    if (delta === undefined) {
      return;
    }
    if (delta > 0 && (!up || delta > up.delta)) {
      up = { line, delta };
    }
    if (delta < 0 && (!down || delta < down.delta)) {
      down = { line, delta };
    }
  });
  if (up && down) {
    return { kind: 'upDown', up: up.line, delta: up.delta, down: down.line };
  }
  if (up) {
    return { kind: 'up', ...up };
  }
  if (down) {
    return { kind: 'down', ...down };
  }
  return { kind: 'same' };
};

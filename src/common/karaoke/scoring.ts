/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TKaraokePitchOctavePolicy } from './pitch';
import {
  type IKaraokeLine,
  type IKaraokeToken,
  type TKaraokePitchTarget,
} from './types';

/**
 * How a sung note is judged, note by note, the moment it ends (Ivan,
 * 2026-11-16, "E · Veredicto por nota").
 *
 * Every threshold is in cents against the target folded to the singer's
 * nearest octave: a note sung an octave down or up counts, and is marked so.
 * Half a semitone either way is "in tune" because that is where the pitch
 * lane already lights a note (`MATCH_TOLERANCE_SEMITONES`), so the colour on
 * the strip and the verdict over it can never disagree.
 */
export const IN_TUNE_CENTS = 50;
/** Full credit inside a quarter of a semitone: what a trained ear calls clean. */
export const CLEAN_CENTS = 25;
/** Credit at the edge of in tune, falling to nothing a semitone out. */
const EDGE_CREDIT = 0.7;
const NO_CREDIT_CENTS = 100;
/**
 * Perfect: in tune for 85% of the voiced time, and centred within 20 cents on
 * average. The average is signed, so a vibrato swinging 40 cents either side
 * of the note stays perfect while a voice parked 30 cents flat does not.
 */
export const PERFECT_IN_TUNE_SHARE = 0.85;
export const PERFECT_MEAN_CENTS = 20;
/** Good: in tune for 60% of the voiced time. */
export const GOOD_IN_TUNE_SHARE = 0.6;
/**
 * Late: first in tune more than 180 ms after the note began (or a fifth of
 * a long note), then in tune for 60% of what followed. The pitch is read
 * against the playhead with no allowance for the detector's own delay (its
 * median over the last five frames) or the sound card's, the same reading
 * the strip lights its notes by, so the threshold has to hold both on top of
 * a human onset. Not yet measured against a real singer.
 */
export const LATE_ONSET_MS = 180;
export const LATE_ONSET_SHARE = 0.2;
/** Missed: voiced for under a quarter of the time the note was heard. */
export const MISSED_VOICED_SHARE = 0.25;
/**
 * A note heard for under 60% of its length is not judged at all: a seek
 * forward or a microphone turned on mid-note leaves too little to judge, and
 * calling that "missed" would blame the singer for the transport.
 */
export const JUDGED_COVERAGE = 0.6;
/**
 * Credit saturates at 85% of a note's length. The detector answers late
 * (above) and a singer lets a syllable go on its consonant, so a note sung
 * all the way through could never reach full marks against its whole length.
 */
const FULL_CREDIT_SHARE = 0.85;
/** UltraStar's golden notes count double, as every UltraStar game scores them. */
const GOLDEN_WEIGHT = 2;
/** The song's whole score, a perfect run. */
export const KARAOKE_SCORE_MAX = 10_000;
/** Notes further apart than this start a new line when a song has no lyric lines. */
const FALLBACK_LINE_GAP_MS = 1_200;

export type TKaraokeVerdict =
  'perfect' | 'good' | 'late' | 'low' | 'high' | 'missed' | 'skipped';

export interface IKaraokeScoreNote {
  index: number;
  token: IKaraokeToken;
  startMs: number;
  endMs: number;
  targetMidi: number;
  /** Its length in ms, doubled for a golden note. */
  weight: number;
  lineIndex: number;
}

export interface IKaraokeScoreLine {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  noteIndexes: number[];
}

export interface IKaraokeScoreSheet {
  notes: IKaraokeScoreNote[];
  lines: IKaraokeScoreLine[];
  totalWeight: number;
  octavePolicy: TKaraokePitchOctavePolicy;
}

/** What was heard inside one note so far. Mutated as it is heard. */
export interface IKaraokeNoteTally {
  observedMs: number;
  voicedMs: number;
  inTuneMs: number;
  /** In tune at another octave than the target's. */
  octaveInTuneMs: number;
  creditMs: number;
  signedCentsMs: number;
  /** Ms from the note's start to its first in-tune moment. */
  onsetMs: number | undefined;
  voicedSinceOnsetMs: number;
}

export interface IKaraokeNoteResult {
  verdict: TKaraokeVerdict;
  /** 0-1 of the note's credit. */
  credit: number;
  /** Its share of the song's 10 000. */
  points: number;
  octave: boolean;
  onTime: boolean;
  meanCents: number;
  voicedMs: number;
  inTuneMs: number;
}

export const createKaraokeNoteTally = (): IKaraokeNoteTally => ({
  observedMs: 0,
  voicedMs: 0,
  inTuneMs: 0,
  octaveInTuneMs: 0,
  creditMs: 0,
  signedCentsMs: 0,
  onsetMs: undefined,
  voicedSinceOnsetMs: 0,
});

const isScorable = (
  token: IKaraokeToken,
): token is IKaraokeToken & {
  startMs: number;
  endMs: number;
  targetMidi: number;
} =>
  token.kind !== 'free' &&
  token.startMs !== undefined &&
  token.endMs !== undefined &&
  token.targetMidi !== undefined &&
  Number.isFinite(token.targetMidi) &&
  token.endMs > token.startMs;

interface ILyricSpan {
  startMs: number;
  endMs: number;
  text: string;
}

const lyricSpans = (lines: readonly IKaraokeLine[]): ILyricSpan[] =>
  lines
    .filter((line) => line.kind !== 'section')
    .map((line) => {
      const times = line.tokens.flatMap((token) =>
        token.startMs !== undefined && token.endMs !== undefined
          ? [token.startMs, token.endMs]
          : [],
      );
      return {
        startMs: line.startMs ?? (times.length ? Math.min(...times) : NaN),
        endMs: line.endMs ?? (times.length ? Math.max(...times) : NaN),
        text: line.tokens
          .map((token) => token.text)
          .join('')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    })
    .filter((span) => Number.isFinite(span.startMs))
    .sort((left, right) => left.startMs - right.startMs);

/**
 * The notes to judge and the lines they belong to, from a song's pitch track
 * and its lyric lines. Free notes are left out: UltraStar's `F` marks a
 * passage with no pitch requirement. Undefined when there is nothing to judge.
 */
export const buildKaraokeScoreSheet = (
  pitch: TKaraokePitchTarget,
  lines: readonly IKaraokeLine[],
): IKaraokeScoreSheet | undefined => {
  if (pitch.kind !== 'notes') {
    return undefined;
  }
  const timed = pitch.notes
    .filter(isScorable)
    .sort((left, right) => left.startMs - right.startMs);
  if (!timed.length) {
    return undefined;
  }
  const spans = lyricSpans(lines);
  // Each note joins the last lyric line that began by its start (50 ms of
  // grace for a note written a hair before its line); a song with no timed
  // lines is cut into lines at its silences instead.
  let spanCursor = 0;
  const spanOf = (startMs: number, fallback: number): number => {
    if (!spans.length) {
      return fallback;
    }
    // The notes come in order, so the line only ever moves forward.
    while (
      spanCursor + 1 < spans.length &&
      spans[spanCursor + 1].startMs <= startMs + 50
    ) {
      spanCursor += 1;
    }
    return spanCursor;
  };
  const groups = new Map<number, number[]>();
  let fallbackLine = 0;
  const notes: IKaraokeScoreNote[] = timed.map((token, index) => {
    const previous = timed[index - 1];
    if (
      !spans.length &&
      previous &&
      token.startMs - previous.endMs >= FALLBACK_LINE_GAP_MS
    ) {
      fallbackLine += 1;
    }
    const group = spanOf(token.startMs, fallbackLine);
    const members = groups.get(group);
    if (members) {
      members.push(index);
    } else {
      groups.set(group, [index]);
    }
    return {
      index,
      token,
      startMs: token.startMs,
      endMs: token.endMs,
      targetMidi: token.targetMidi,
      weight:
        (token.endMs - token.startMs) *
        (token.kind === 'golden' ? GOLDEN_WEIGHT : 1),
      lineIndex: -1,
    };
  });
  // Lines with no note to sing are not lines of the score.
  const scoreLines: IKaraokeScoreLine[] = Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([group, noteIndexes], index) => {
      noteIndexes.forEach((noteIndex) => {
        notes[noteIndex].lineIndex = index;
      });
      const first = notes[noteIndexes[0]];
      return {
        index,
        startMs: first.startMs,
        endMs: Math.max(...noteIndexes.map((at) => notes[at].endMs)),
        text: spans[group]?.text ?? '',
        noteIndexes,
      };
    });
  return {
    notes,
    lines: scoreLines,
    totalWeight: notes.reduce((sum, note) => sum + note.weight, 0),
    octavePolicy: pitch.octavePolicy,
  };
};

/** The singer's error in cents, folded to the octave nearest the target. */
export const foldedCents = (
  sungMidi: number,
  targetMidi: number,
): { cents: number; octaves: number } => {
  const octaves = Math.round((sungMidi - targetMidi) / 12);
  return { cents: (sungMidi - octaves * 12 - targetMidi) * 100, octaves };
};

/** How much of a moment's credit an error of `cents` earns, 0-1. */
export const centsCredit = (cents: number): number => {
  const error = Math.abs(cents);
  if (error <= CLEAN_CENTS) {
    return 1;
  }
  if (error <= IN_TUNE_CENTS) {
    return (
      1 -
      ((1 - EDGE_CREDIT) * (error - CLEAN_CENTS)) /
        (IN_TUNE_CENTS - CLEAN_CENTS)
    );
  }
  if (error < NO_CREDIT_CENTS) {
    return (
      (EDGE_CREDIT * (NO_CREDIT_CENTS - error)) /
      (NO_CREDIT_CENTS - IN_TUNE_CENTS)
    );
  }
  return 0;
};

/**
 * Add `[fromMs, toMs)` of song time to a note's tally, sung at `sungMidi`
 * (or silent when undefined). Only the part inside the note counts.
 */
export const tallyKaraokeNote = (
  tally: IKaraokeNoteTally,
  note: Pick<IKaraokeScoreNote, 'startMs' | 'endMs' | 'targetMidi'>,
  fromMs: number,
  toMs: number,
  sungMidi: number | undefined,
): void => {
  const from = Math.max(fromMs, note.startMs);
  const overlapMs = Math.min(toMs, note.endMs) - from;
  if (!(overlapMs > 0)) {
    return;
  }
  tally.observedMs += overlapMs;
  if (sungMidi === undefined || !Number.isFinite(sungMidi)) {
    return;
  }
  const { cents, octaves } = foldedCents(sungMidi, note.targetMidi);
  tally.voicedMs += overlapMs;
  tally.creditMs += overlapMs * centsCredit(cents);
  tally.signedCentsMs += overlapMs * cents;
  if (Math.abs(cents) <= IN_TUNE_CENTS) {
    tally.inTuneMs += overlapMs;
    if (octaves !== 0) {
      tally.octaveInTuneMs += overlapMs;
    }
    if (tally.onsetMs === undefined) {
      tally.onsetMs = from - note.startMs;
    }
  }
  if (tally.onsetMs !== undefined) {
    tally.voicedSinceOnsetMs += overlapMs;
  }
};

/** The verdict on a note that has ended, from what was heard inside it. */
export const judgeKaraokeNote = (
  tally: IKaraokeNoteTally,
  note: Pick<IKaraokeScoreNote, 'startMs' | 'endMs' | 'weight'>,
  totalWeight: number,
  octavePolicy: TKaraokePitchOctavePolicy,
): IKaraokeNoteResult => {
  const durationMs = note.endMs - note.startMs;
  const lateLimitMs = Math.max(LATE_ONSET_MS, durationMs * LATE_ONSET_SHARE);
  const onTime = tally.onsetMs !== undefined && tally.onsetMs <= lateLimitMs;
  const meanCents =
    tally.voicedMs > 0 ? tally.signedCentsMs / tally.voicedMs : 0;
  const base = {
    meanCents,
    voicedMs: tally.voicedMs,
    inTuneMs: tally.inTuneMs,
    onTime,
  };
  if (tally.observedMs < durationMs * JUDGED_COVERAGE) {
    return { ...base, verdict: 'skipped', credit: 0, points: 0, octave: false };
  }
  const credit = Math.min(1, tally.creditMs / (durationMs * FULL_CREDIT_SHARE));
  const points =
    totalWeight > 0
      ? (credit * note.weight * KARAOKE_SCORE_MAX) / totalWeight
      : 0;
  // With absolute octaves the chart says which one; with pitch classes only
  // every octave is the right one and there is nothing to mark.
  const octave =
    octavePolicy === 'absolute' && tally.octaveInTuneMs * 2 > tally.inTuneMs;
  const inTuneShare = tally.voicedMs > 0 ? tally.inTuneMs / tally.voicedMs : 0;
  let verdict: TKaraokeVerdict;
  if (tally.voicedMs < tally.observedMs * MISSED_VOICED_SHARE) {
    verdict = 'missed';
  } else if (
    tally.onsetMs !== undefined &&
    !onTime &&
    tally.inTuneMs >= tally.voicedSinceOnsetMs * GOOD_IN_TUNE_SHARE
  ) {
    verdict = 'late';
  } else if (
    inTuneShare >= PERFECT_IN_TUNE_SHARE &&
    Math.abs(meanCents) <= PERFECT_MEAN_CENTS
  ) {
    verdict = 'perfect';
  } else if (inTuneShare >= GOOD_IN_TUNE_SHARE) {
    verdict = 'good';
  } else {
    verdict = meanCents < 0 ? 'low' : 'high';
  }
  return {
    ...base,
    verdict,
    credit,
    points,
    octave: octave && verdict !== 'missed',
  };
};

/** A note that counts toward the streak and toward "notes hit". */
export const isKaraokeHit = (verdict: TKaraokeVerdict | undefined): boolean =>
  verdict === 'perfect' || verdict === 'good';

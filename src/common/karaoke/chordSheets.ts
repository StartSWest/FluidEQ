/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type IKaraokeChordSegment } from './chords';
import { type IKaraokeLine } from './types';

// CHORDS A SONG'S OWN FILES CARRY (Ivan, 2026-11-16: "if the karaoke already
// brings the song's chords we need to use those; support all file types").
// What exists, from the formats' own documentation:
//
// - No karaoke lyric format has a chord field. LRC (simple and enhanced) and
//   UltraStar define none; what chord-carrying LRC files do in practice is
//   write ChordPro's bracketed chords inside the line, "[00:12.30]I [G]walk
//   the [Em]line", which a plain LRC player shows as text.
// - ChordPro (.cho .chopro .chordpro .crd) is the chord sheet standard:
//   chords in brackets right before the syllable they fall on, directives in
//   braces, no times. Its chords are timed here by the song's timed lyrics.
// - The .lab chord annotation (Isophonics, MIREX; Audacity's label export
//   has the same three columns) is the one timed chord format: "start end
//   label" in seconds, labels like "C:maj", "A:min7", "N".
// - MIDI karaoke (.kar) carries chords as text events when it carries them,
//   but this player reads no MIDI at all; that format is not opened here.

const ROOT = '[A-G](?:#|b|♯|♭)?';
// What follows a root on a chart: quality, extensions, alterations, a
// slash bass. Generous on purpose - anything that is a chord to a guitarist.
const CHORD_TAIL =
  '(?:maj|min|mi|ma|dim|aug|sus|add|m|M|\\+|°|ø|Δ|-)?(?:[0-9]{1,2})?(?:(?:sus|add|maj|no|b|#|♭|♯|\\+|-)[0-9]{1,2})*';
const CHORD_NAME = new RegExp(`^${ROOT}${CHORD_TAIL}(?:/${ROOT})?$`);
/** A chord in brackets inside a lyric line: "[G]", "[F#m7]", "[D/F#]". */
const INLINE_CHORD = new RegExp(
  `\\[(${ROOT}${CHORD_TAIL}(?:/${ROOT})?)\\]`,
  'g',
);

/** Whether a word reads as a chord name ("Am7", "D/F#"), never a lyric. */
export const isChordName = (text: string): boolean =>
  CHORD_NAME.test(text.trim());

/**
 * A chord as the stage prints it: as written, with the sharps and flats of
 * its root and bass set as ♯ and ♭, the signs the heard chords use.
 */
export const displayChordName = (text: string): string =>
  text
    .trim()
    .replace(/^([A-G])#/, '$1♯')
    .replace(/^([A-G])b/, '$1♭')
    .replace(/\/([A-G])#/, '/$1♯')
    .replace(/\/([A-G])b/, '/$1♭');

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const SHARP_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

const pitchClassOf = (root: string): number | undefined => {
  const base = NOTE_INDEX[root[0]];
  if (base === undefined) {
    return undefined;
  }
  const accidental = root.slice(1);
  let shift = 0;
  if (accidental === '#' || accidental === '♯') {
    shift = 1;
  } else if (accidental === 'b' || accidental === '♭') {
    shift = -1;
  }
  return (base + shift + 12) % 12;
};

// MIREX / Harte shorthands, as a chart writes them.
const LAB_QUALITIES: Record<string, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  min7: 'm7',
  '7': '7',
  dim7: 'dim7',
  hdim7: 'm7♭5',
  minmaj7: 'm(maj7)',
  maj6: '6',
  min6: 'm6',
  '9': '9',
  maj9: 'maj9',
  min9: 'm9',
  sus2: 'sus2',
  sus4: 'sus4',
  '1': '5',
  '5': '5',
};
// Scale degrees a Harte label puts after its slash.
const DEGREE_SEMITONES: Record<string, number> = {
  '1': 0,
  b2: 1,
  '2': 2,
  b3: 3,
  '3': 4,
  '4': 5,
  b5: 6,
  '5': 7,
  '#5': 8,
  b6: 8,
  '6': 9,
  bb7: 9,
  b7: 10,
  '7': 11,
};

/**
 * One .lab label as a chart name: "C:maj" is C, "A:min7" Am7, "D:maj/3"
 * D/F♯. A plain chart name ("Am7"), as an Audacity label holds, is taken as
 * it is. "N" and "X" (no chord, unknown) are no chord.
 */
export const chordNameFromLabel = (label: string): string | undefined => {
  const text = label.trim();
  if (!text || text === 'N' || text === 'X') {
    return undefined;
  }
  if (isChordName(text)) {
    return displayChordName(text);
  }
  const match = /^([A-G](?:#|b)?)(?::([^/]+))?(?:\/(.+))?$/.exec(text);
  if (!match) {
    return undefined;
  }
  const [, root, quality = 'maj', bass] = match;
  const name = LAB_QUALITIES[quality.replace(/[()]/g, '')];
  if (name === undefined) {
    return undefined;
  }
  let slash = '';
  const rootClass = pitchClassOf(root);
  if (bass && rootClass !== undefined) {
    const semitones = DEGREE_SEMITONES[bass];
    if (semitones !== undefined && semitones !== 0) {
      slash = `/${SHARP_NAMES[(rootClass + semitones) % 12]}`;
    }
  }
  return `${displayChordName(root)}${name}${slash}`;
};

/** A file's chord, timed. */
const segment = (
  startMs: number,
  endMs: number,
  label: string,
): IKaraokeChordSegment => ({ startMs, endMs, label, confidence: 1 });

/**
 * A .lab chord annotation: "start end label" per line, seconds, separated by
 * spaces or tabs. Lines that are not three such fields are skipped.
 */
export const parseChordLab = (text: string): IKaraokeChordSegment[] =>
  text.split(/\r?\n/).flatMap((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 3) {
      return [];
    }
    const start = Number(fields[0]);
    const end = Number(fields[1]);
    const name = chordNameFromLabel(fields.slice(2).join(' '));
    return Number.isFinite(start) && Number.isFinite(end) && end > start && name
      ? [segment(start * 1_000, end * 1_000, name)]
      : [];
  });

/** A lyric line with its chords taken out, and where each one stood. */
export interface IChordedLine {
  text: string;
  chords: { label: string; at: number }[];
}

/**
 * The bracketed chords taken out of a line of words: the words as they
 * read without them, and each chord's position in those words.
 */
export const takeInlineChords = (line: string): IChordedLine => {
  const chords: IChordedLine['chords'] = [];
  let text = '';
  let last = 0;
  INLINE_CHORD.lastIndex = 0;
  for (
    let match = INLINE_CHORD.exec(line);
    match;
    match = INLINE_CHORD.exec(line)
  ) {
    text += line.slice(last, match.index);
    chords.push({ label: displayChordName(match[1]), at: text.length });
    last = match.index + match[0].length;
  }
  text += line.slice(last);
  INLINE_CHORD.lastIndex = 0;
  return { text, chords };
};

/**
 * A ChordPro sheet's lines: directives ("{title: ...}", "{start_of_chorus}")
 * and comments ("# ...") out, every other line with its chords taken out.
 * A line of chords alone stays, with no words, so an instrumental bar keeps
 * its place between the sung lines.
 */
export const parseChordPro = (text: string): IChordedLine[] =>
  text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /^\{.*\}$/.test(line)) {
      return [];
    }
    const chorded = takeInlineChords(line);
    return chorded.chords.length || chorded.text.trim() ? [chorded] : [];
  });

/** A sheet is ChordPro when it has a directive or a bracketed chord. */
export const looksLikeChordPro = (text: string): boolean =>
  /^\s*\{[a-z_]+(?::[^}]*)?\}\s*$/im.test(text) ||
  new RegExp(INLINE_CHORD.source).test(text);

const comparable = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const lineText = (line: IKaraokeLine) =>
  line.tokens.map((token) => token.text).join('');

/** How alike two lines read, 0 to 1, by the letters they share in order. */
const likeness = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }
  // Longest common subsequence over the letters, as a share of the longer.
  const previous = new Uint16Array(right.length + 1);
  const current = new Uint16Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    previous.set(current);
  }
  return previous[right.length] / Math.max(left.length, right.length);
};

/** The time a position in a timed line is sung at. */
export const timeInLine = (
  line: IKaraokeLine,
  at: number,
  nextStartMs: number,
) => {
  const startMs = line.startMs ?? line.tokens[0]?.startMs ?? 0;
  let position = 0;
  const timed = line.tokens.find((token) => {
    const ends = position + token.text.length;
    const holds = at < ends && token.startMs !== undefined;
    position = ends;
    return holds;
  });
  if (timed?.startMs !== undefined) {
    return timed.startMs;
  }
  // A line timed only at its start: spread across the line by position.
  const endMs = line.endMs ?? nextStartMs;
  const length = Math.max(1, lineText(line).length);
  return startMs + ((endMs - startMs) * Math.min(at, length)) / length;
};

const MATCHING_LIKENESS = 0.6;

/**
 * A ChordPro sheet's chords on the song's clock, through its timed lyrics:
 * each sheet line is matched, in order, to the song line it reads like, and
 * each chord takes the time of the word it stands over. A chord-only line
 * between two sung lines spreads over the gap between them. Nothing comes
 * back unless the lyrics are timed and most of the sheet's sung lines are
 * found among them.
 */
export const timeChordSheet = (
  sheet: readonly IChordedLine[],
  lines: readonly IKaraokeLine[],
  durationMs: number,
): IKaraokeChordSegment[] => {
  const sung = lines.filter(
    (line) => line.kind !== 'section' && line.startMs !== undefined,
  );
  if (!sung.length) {
    return [];
  }
  const sungText = sung.map((line) => comparable(lineText(line)));
  const starts: { label: string; ms: number }[] = [];
  let cursor = 0;
  let matched = 0;
  let wordedLines = 0;
  let waiting: IChordedLine[] = [];
  let lastEndMs = 0;
  const placeWaiting = (untilMs: number) => {
    const chords = waiting.flatMap((line) => line.chords);
    const span = Math.max(0, untilMs - lastEndMs);
    chords.forEach((chord, index) => {
      starts.push({
        label: chord.label,
        ms: lastEndMs + (span * index) / Math.max(1, chords.length),
      });
    });
    waiting = [];
  };
  sheet.forEach((sheetLine) => {
    const words = comparable(sheetLine.text);
    if (!words) {
      waiting.push(sheetLine);
      return;
    }
    wordedLines += 1;
    // The next few song lines are candidates: a sheet skips a repeat now
    // and then, and a song repeats a chorus the sheet wrote once.
    let best = -1;
    let bestLikeness = MATCHING_LIKENESS;
    for (let k = cursor; k < Math.min(sung.length, cursor + 6); k += 1) {
      const score = likeness(words, sungText[k]);
      if (score > bestLikeness) {
        best = k;
        bestLikeness = score;
      }
    }
    if (best < 0) {
      return;
    }
    matched += 1;
    const line = sung[best];
    const nextStartMs = sung[best + 1]?.startMs ?? durationMs;
    placeWaiting(line.startMs ?? 0);
    // Positions in the sheet's words are carried onto the song line by
    // their share of the line, the two spellings rarely being the same.
    const sheetLength = Math.max(1, sheetLine.text.length);
    const songLength = lineText(line).length;
    sheetLine.chords.forEach((chord) => {
      starts.push({
        label: chord.label,
        ms: timeInLine(
          line,
          Math.round((chord.at / sheetLength) * songLength),
          nextStartMs,
        ),
      });
    });
    lastEndMs = line.endMs ?? nextStartMs;
    cursor = best + 1;
  });
  placeWaiting(durationMs);
  if (!wordedLines || matched / wordedLines < 0.5) {
    return [];
  }
  return chordsFromStarts(starts, durationMs);
};

/** Chord starts as segments, each lasting until the next one starts. */
export const chordsFromStarts = (
  starts: readonly { label: string; ms: number }[],
  durationMs: number,
): IKaraokeChordSegment[] => {
  const ordered = [...starts]
    .filter((start) => Number.isFinite(start.ms))
    .sort((left, right) => left.ms - right.ms);
  return ordered.flatMap((start, index) => {
    const endMs = ordered[index + 1]?.ms ?? durationMs;
    return endMs > start.ms ? [segment(start.ms, endMs, start.label)] : [];
  });
};

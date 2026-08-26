/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Laying a second language's words over the timing the first one already has.
 *
 * The melody is not here and never will be: notes live in `project.melody` and
 * are shared by every language, because a translation changes the words and
 * not the tune. What a sheet has to invent is only where the word boundaries
 * fall inside a line whose start and end are already known.
 *
 * The division is proportional to syllable count, which assumes every syllable
 * takes equal time — something no singer has ever done. It is a starting point
 * that puts the words near their notes so the user is correcting rather than
 * typing timings from nothing.
 */
import {
  IKaraokeMakerLine,
  IKaraokeMakerLyricSheet,
  IKaraokeMakerNote,
  karaokeMakerId,
  karaokeMakerLineIsSection,
  karaokeMakerTimedLineRange,
  makerLinesFromPlainText,
} from './model';
import { splitKaraokeWordSyllables } from '../syllables';

export interface IKaraokeTranslationSeedResult {
  sheet?: IKaraokeMakerLyricSheet;
  /** Lyric lines the original has, against lyric lines the paste supplied. */
  mismatch?: { expected: number; received: number };
}

const syllableWeight = (text: string, language: string): number =>
  Math.max(1, splitKaraokeWordSyllables(text, language).length);

const timedTranslatedLine = (
  original: IKaraokeMakerLine,
  translated: IKaraokeMakerLine,
  language: string,
): IKaraokeMakerLine => {
  const range = karaokeMakerTimedLineRange(original);
  if (!range) {
    return { ...translated, startMs: undefined, endMs: undefined };
  }
  const weights = translated.tokens.map((token) =>
    syllableWeight(token.text, language),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = range.endMs - range.startMs;
  let consumed = 0;
  const tokens = translated.tokens.map((token, index) => {
    const startMs = range.startMs + (span * consumed) / total;
    consumed += weights[index];
    return {
      ...token,
      startMs: Math.round(startMs),
      endMs: Math.round(range.startMs + (span * consumed) / total),
    };
  });
  return { ...translated, startMs: range.startMs, endMs: range.endMs, tokens };
};

/**
 * Build a sheet for `language` from pasted `text`, over `original`'s timing.
 *
 * Matching is by index over lyric lines only. Section headings are structure
 * rather than words: they copy through and consume no pasted line, which is
 * why a paste that omits them still lines up.
 */
export const seedKaraokeTranslation = (
  original: readonly IKaraokeMakerLine[],
  text: string,
  language: string,
): IKaraokeTranslationSeedResult => {
  const pasted = makerLinesFromPlainText(text, 'translation-seed').filter(
    (line) => !karaokeMakerLineIsSection(line),
  );
  const originalLyrics = original.filter(
    (line) => !karaokeMakerLineIsSection(line),
  );
  if (pasted.length !== originalLyrics.length) {
    return {
      mismatch: { expected: originalLyrics.length, received: pasted.length },
    };
  }
  let next = 0;
  const lines = original.map((line): IKaraokeMakerLine => {
    if (karaokeMakerLineIsSection(line)) {
      return {
        ...line,
        id: karaokeMakerId('line'),
        tokens: line.tokens.map((token) => ({
          ...token,
          id: karaokeMakerId('word'),
        })),
      };
    }
    const translated = pasted[next];
    next += 1;
    return timedTranslatedLine(line, translated, language);
  });
  return { sheet: { language, source: 'translation-seed', lines } };
};

export interface IKaraokeTranslationFit {
  lineId: string;
  syllables: number;
  notes: number;
}

/**
 * How a translated line sits against the melody it has to be sung to.
 *
 * Not stored. Recomputed as the user types, because it is the only feedback
 * available before anything is synthesised — and the mismatch is fixable from
 * either side: change the words, or split a held note in two.
 */
export const karaokeTranslationFit = (
  sheet: IKaraokeMakerLyricSheet,
  notes: readonly IKaraokeMakerNote[],
): IKaraokeTranslationFit[] =>
  sheet.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .map((line) => {
      const range = karaokeMakerTimedLineRange(line);
      return {
        lineId: line.id,
        syllables: line.tokens.reduce(
          (sum, token) => sum + syllableWeight(token.text, sheet.language),
          0,
        ),
        notes: range
          ? notes.filter(
              (note) =>
                note.startMs < range.endMs && note.endMs > range.startMs,
            ).length
          : 0,
      };
    });

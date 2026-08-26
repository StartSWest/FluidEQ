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
  IKaraokeMakerProject,
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
    return {
      ...translated,
      sourceLineId: original.id,
      startMs: undefined,
      endMs: undefined,
    };
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
  return {
    ...translated,
    sourceLineId: original.id,
    startMs: range.startMs,
    endMs: range.endMs,
    tokens,
  };
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
        sourceLineId: line.id,
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

/**
 * Which translated line belongs under which original line, keyed by the
 * original's own id.
 *
 * The one place that answer is decided, because it used to be decided twice —
 * `song.ts` for the player and `useMakerCanvasModel.ts` for the Maker canvas —
 * and both decided it by array position. Position is not identity: nothing
 * stops `lyrics.lines` being replaced under a sheet that survives the
 * replacement, so one line inserted into the original re-pointed every later
 * translated line at a different partner without a word to the user.
 *
 * A sheet seeded before `sourceLineId` existed declares none, and joins by
 * position exactly as it does today — the fallback is the old behaviour, so
 * an existing draft cannot regress. A sheet that declares any is joined by id
 * alone: a translated line whose source has been deleted pairs with nothing
 * and simply does not paint, and an original line that gained no translation
 * pairs with nothing and paints alone.
 */
export const karaokeTranslationLineBySource = (
  original: readonly IKaraokeMakerLine[],
  sheet: readonly IKaraokeMakerLine[],
): Map<string, IKaraokeMakerLine> => {
  const bySourceId = new Map<string, IKaraokeMakerLine>();
  const identified = sheet.filter((line) => line.sourceLineId !== undefined);
  if (!identified.length) {
    original.forEach((line, index) => {
      const paired = sheet[index];
      if (paired) {
        bySourceId.set(line.id, paired);
      }
    });
    return bySourceId;
  }
  // Only sources that are still there, so the map is the pairing itself
  // rather than the pairing plus whatever the sheet remembers about lines
  // the original no longer has.
  const originalIds = new Set(original.map((line) => line.id));
  identified.forEach((line) => {
    const sourceId = line.sourceLineId;
    // First writer wins, so a duplicated source id in a hand-edited file
    // cannot make the later copy silently replace the earlier one.
    if (
      sourceId !== undefined &&
      originalIds.has(sourceId) &&
      !bySourceId.has(sourceId)
    ) {
      bySourceId.set(sourceId, line);
    }
  });
  return bySourceId;
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

/**
 * The languages this project can be shown in, original first.
 *
 * The original has no sheet of its own — it is `lyrics.lines` — so it is named
 * here rather than found, and a project whose original language was never
 * declared answers with the tag the UI uses for "as recorded".
 */
export const KARAOKE_ORIGINAL_LANGUAGE = 'original';

/** The name a tag answers to in one locale, or nothing for a tag Intl refuses. */
const languageDisplayName = (
  tag: string,
  locale: string,
): string | undefined => {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag);
  } catch {
    // A structurally invalid tag — "Español" reaches here — has no display
    // name to offer. The raw string is already in the alias set.
    return undefined;
  }
};

/**
 * Every string a language tag answers to: itself, its base subtag, and the
 * names that subtag is written with.
 *
 * `#LANGUAGE` in an UltraStar file is a display name, not a code — "Spanish"
 * in one file and "Español" in the next, because those files come from every
 * locale there is — while the picker only ever offers BCP-47 codes. English
 * because that is what the format conventionally carries; the language's own
 * because a sheet written where it is spoken carries the endonym.
 */
const languageAliases = (value: string): Set<string> => {
  const normalised = value.trim().toLowerCase();
  const [base] = normalised.split(/[-_]/);
  const aliases = new Set([normalised, base]);
  ['en', base].forEach((locale) => {
    const name = languageDisplayName(base, locale);
    if (name) {
      aliases.add(name.toLowerCase());
    }
  });
  return aliases;
};

/**
 * Whether two language tags name the same language.
 *
 * A raw `===` let a Spanish translation be added to a song whose `#LANGUAGE`
 * header said "Spanish", because the picker had offered `es` — a rejection
 * §14 of the spec requires, defeated by the app's own primary import format.
 */
export const karaokeLanguageTagsMatch = (
  left: string | undefined,
  right: string | undefined,
): boolean => {
  if (!left?.trim() || !right?.trim()) {
    return false;
  }
  const rightAliases = languageAliases(right);
  return [...languageAliases(left)].some((alias) => rightAliases.has(alias));
};

export const karaokeTranslationLanguages = (
  project: IKaraokeMakerProject,
): string[] => [
  project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE,
  ...(project.lyrics.translations ?? []).map((sheet) => sheet.language),
];

export const addKaraokeTranslation = (
  project: IKaraokeMakerProject,
  text: string,
  language: string,
): {
  project: IKaraokeMakerProject;
  mismatch?: { expected: number; received: number };
} => {
  const target = language.trim();
  if (!target || karaokeLanguageTagsMatch(target, project.lyrics.language)) {
    return { project };
  }
  const seeded = seedKaraokeTranslation(project.lyrics.lines, text, target);
  if (!seeded.sheet) {
    return { project, mismatch: seeded.mismatch };
  }
  const { sheet } = seeded;
  const existing = project.lyrics.translations ?? [];
  const replaced = existing.some((entry) => entry.language === target);
  return {
    project: {
      ...project,
      lyrics: {
        ...project.lyrics,
        translations: replaced
          ? existing.map((entry) => (entry.language === target ? sheet : entry))
          : [...existing, sheet],
      },
    },
  };
};

export const removeKaraokeTranslation = (
  project: IKaraokeMakerProject,
  language: string,
): IKaraokeMakerProject => {
  const remaining = (project.lyrics.translations ?? []).filter(
    (sheet) => sheet.language !== language,
  );
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      // Undefined rather than [], so a project that has had its last
      // translation removed parses identically to one that never had any.
      translations: remaining.length ? remaining : undefined,
    },
  };
};

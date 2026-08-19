/* FluidEQ language-aware karaoke syllable segmentation. GPL-3.0-or-later. */

const LATIN_VOWEL = /[aeiouà-åè-ïò-öù-üýÿāăąēĕėęěīĭįıōŏőūŭůűų]/iu;
const CYRILLIC_VOWEL = /[аеёиоуыэюяіїє]/iu;
// Script_Extensions, so the long-vowel mark `ー` (U+30FC) counts as kana. It
// is Script=Common, and under `\p{Script=Katakana}` a word containing one was
// not recognised as CJK at all.
const CJK_OR_HANGUL =
  /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const ENGLISH_ONSET_CLUSTERS = new Set([
  'bl',
  'br',
  'ch',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gr',
  'ph',
  'pl',
  'pr',
  'sh',
  'sl',
  'th',
  'tr',
  'wh',
]);

type TIntlSegmenterConstructor = new (
  locales?: string | readonly string[],
  options?: { granularity: 'grapheme' },
) => {
  segment(value: string): Iterable<{ segment: string }>;
};

const graphemes = (text: string): string[] => {
  const { Segmenter } = Intl as unknown as {
    Segmenter?: TIntlSegmenterConstructor;
  };
  if (Segmenter) {
    return Array.from(
      new Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
};

const normalizedLetter = (grapheme: string): string =>
  grapheme
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase();

const isVowelAt = (
  units: readonly string[],
  index: number,
  language: string,
): boolean => {
  const normalized = normalizedLetter(units[index]);
  if (CYRILLIC_VOWEL.test(normalized)) {
    return true;
  }
  if (normalized === 'y') {
    const prefix = language.toLocaleLowerCase();
    if (prefix.startsWith('es')) {
      return false;
    }
    const previous = normalizedLetter(units[index - 1] ?? '');
    const next = normalizedLetter(units[index + 1] ?? '');
    return index > 0 && !LATIN_VOWEL.test(previous) && !LATIN_VOWEL.test(next);
  }
  return LATIN_VOWEL.test(normalized);
};

const vowelNuclei = (
  units: readonly string[],
  language: string,
): Array<{ start: number; end: number }> => {
  const nuclei: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < units.length; index += 1) {
    if (isVowelAt(units, index, language)) {
      const previous = nuclei[nuclei.length - 1];
      if (previous && previous.end === index - 1) {
        previous.end = index;
      } else {
        nuclei.push({ start: index, end: index });
      }
    }
  }
  const prefix = language.toLocaleLowerCase();
  const last = units.length - 1;
  const final = nuclei[nuclei.length - 1];
  const finalLetter = normalizedLetter(units[last] ?? '');
  if (
    prefix.startsWith('en') &&
    final?.start === last &&
    finalLetter === 'e' &&
    nuclei.length > 1
  ) {
    const beforeE = normalizedLetter(units[last - 1] ?? '');
    const beforeBeforeE = normalizedLetter(units[last - 2] ?? '');
    const consonantLe = beforeE === 'l' && !LATIN_VOWEL.test(beforeBeforeE);
    if (!consonantLe) {
      nuclei.pop();
    }
  }
  return nuclei;
};

/**
 * Split a displayed lyric word without changing, normalizing or losing any of
 * its original characters. CJK/Hangul graphemes are already syllabic units;
 * alphabetic scripts use vowel nuclei with conservative onset boundaries.
 */
// This focused utility intentionally exposes one named API used by both the
// canonical melody mapper and its language regression tests.
// eslint-disable-next-line import/prefer-default-export
export const splitKaraokeWordSyllables = (
  text: string,
  language = 'en',
): string[] => {
  const units = graphemes(text);
  if (!units.length) {
    return [];
  }
  const lexicalIndexes = units.flatMap((unit, index) =>
    LETTER_OR_NUMBER.test(unit) ? [index] : [],
  );
  if (
    lexicalIndexes.length > 1 &&
    lexicalIndexes.every((index) => CJK_OR_HANGUL.test(units[index]))
  ) {
    return units.filter((unit) => unit.trim());
  }
  const nuclei = vowelNuclei(units, language);
  if (nuclei.length <= 1) {
    return [text];
  }
  const boundaries: number[] = [];
  nuclei.slice(0, -1).forEach((nucleus, nucleusIndex) => {
    const next = nuclei[nucleusIndex + 1];
    const consonants = new Array(Math.max(0, next.start - nucleus.end - 1))
      .fill(undefined)
      .map((_value, offset) => nucleus.end + 1 + offset)
      .filter((index) => LETTER_OR_NUMBER.test(units[index]));
    let boundary = next.start;
    if (consonants.length) {
      boundary = consonants[consonants.length - 1];
      const lastTwo = consonants
        .slice(-2)
        .map((index) => normalizedLetter(units[index]))
        .join('');
      if (ENGLISH_ONSET_CLUSTERS.has(lastTwo)) {
        boundary = consonants[consonants.length - 2];
      }
    }
    boundaries.push(Math.max(nucleus.end + 1, boundary));
  });
  const syllables: string[] = [];
  let start = 0;
  boundaries.forEach((boundary) => {
    if (boundary > start) {
      syllables.push(units.slice(start, boundary).join(''));
      start = boundary;
    }
  });
  syllables.push(units.slice(start).join(''));
  return syllables.filter(Boolean);
};

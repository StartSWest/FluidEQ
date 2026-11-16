/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The tag editor's text tools, offline and the same everywhere: capitals
 * fixed with Spanish and English in mind, a title read out of a file name,
 * and the values a set of songs disagree on, counted.
 */

/**
 * Words that stay lower-case inside a title. Spanish and English, the two
 * this Library's music is mostly in; the first and last word of a title, and
 * the first after a bracket, are capitalised whatever they are.
 */
const MINOR_WORDS = new Set([
  // Spanish
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'sin',
  'u',
  'un',
  'una',
  'y',
  // English
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'or',
  'over',
  'the',
  'to',
  'vs',
  'vs.',
  'with',
  // Credits
  'feat.',
  'ft.',
]);

/**
 * Roman numerals a title carries ("Rocky II", "Part IV"), written out rather
 * than matched by pattern: "mi", "di" and "mix" are numerals by the rules and
 * words in a song title, and "Tu MI Poesía" is the bug a pattern makes. A lone
 * I, V or X is left to the ordinary capital.
 */
const ROMAN_NUMERALS = new Set([
  'ii',
  'iii',
  'iv',
  'vi',
  'vii',
  'viii',
  'ix',
  'xi',
  'xii',
  'xiii',
  'xiv',
  'xv',
  'xvi',
  'xx',
]);

/** Punctuation a word may start with and still be capitalised after it. */
const LEADING = /^([¡¿"'“‘([«]*)(.*)$/u;

const capitalise = (word: string): string => {
  const [, lead = '', rest = ''] = LEADING.exec(word) ?? [];
  if (rest === '') {
    return word;
  }
  return lead + rest.charAt(0).toLocaleUpperCase() + rest.slice(1);
};

const hasLetters = (text: string): boolean => /\p{L}/u.test(text);

/** All of its letters are lower-case, or all are upper-case. */
export const isOneCase = (text: string): boolean =>
  hasLetters(text) &&
  (text === text.toLocaleLowerCase() || text === text.toLocaleUpperCase());

/**
 * Title case as a record sleeve sets it: every word capitalised but the
 * small ones inside the title. Roman numerals keep their capitals.
 */
export const titleCase = (text: string): string => {
  const words = text.split(/(\s+)/);
  const real = words.filter((part) => part.trim() !== '');
  let seen = 0;
  let afterBracket = true;
  return words
    .map((part) => {
      if (part.trim() === '') {
        return part;
      }
      seen += 1;
      // The first word, the last, the one a bracket opens on ("(The Warner
      // Sound)") and the one after a dash or colon start with a capital.
      const isEdge =
        seen === 1 ||
        seen === real.length ||
        afterBracket ||
        /^[([]/.test(part);
      afterBracket = /[([\-–—:]$/.test(part);
      const lower = part.toLocaleLowerCase();
      const numeral = /^([¡¿"'“‘([«]*)(\p{L}+)([),.!?:;]*)$/u.exec(lower);
      if (numeral && ROMAN_NUMERALS.has(numeral[2])) {
        return numeral[1] + numeral[2].toLocaleUpperCase() + numeral[3];
      }
      const lowerBare = lower.replace(/^[¡¿"'“‘([«]+/u, '');
      if (!isEdge && MINOR_WORDS.has(lowerBare)) {
        return lower;
      }
      if (/^\(?(feat\.|ft\.)/.test(lowerBare)) {
        return lower;
      }
      return capitalise(lower);
    })
    .join('');
};

/** First letter up, the rest as they are lowered. */
export const sentenceCase = (text: string): string =>
  capitalise(text.toLocaleLowerCase());

/** Junk a download leaves in a file name or a title. */
const JUNK = [
  /\s*[([]\s*www\.[^)\]]*[)\]]/giu,
  /\s*\bwww\.\S+/giu,
  /\s*[([]\s*(official\s+)?(music\s+)?(video|audio|lyric(s)?(\s+video)?)\s*[)\]]/giu,
  /\s*[([]\s*\d{2,3}\s*kbps\s*[)\]]/giu,
  /\s*\b\d{2,3}\s*kbps\b/giu,
  /\s*[([]\s*(hq|hd)\s*[)\]]/giu,
];

export const stripJunk = (text: string): string =>
  JUNK.reduce((acc, pattern) => acc.replace(pattern, ''), text).trim();

/** A file name without its folder and extension. */
export const baseNameOf = (fileName: string): string => {
  const name = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

export interface IFileNameTitle {
  title: string;
  trackNo?: string;
}

/**
 * A title read out of a file name: a leading track number taken off ("02 -",
 * "02.", "02 "), download junk removed, and the capitals fixed when the name
 * was all one case. `undefined` when nothing is left that reads as a title.
 */
export const titleFromFileName = (
  fileName: string,
): IFileNameTitle | undefined => {
  let rest = baseNameOf(fileName).replace(/_/g, ' ').trim();
  let trackNo: string | undefined;
  const numbered = /^(\d{1,3})(?:\s*[-.)]\s*|\s+)(.+)$/.exec(rest);
  if (numbered) {
    const [, number, remainder] = numbered;
    trackNo = String(Number(number));
    rest = remainder;
  }
  rest = stripJunk(rest).replace(/\s+/g, ' ').trim();
  if (!hasLetters(rest) || /^track\s*\d*$/i.test(rest)) {
    return trackNo === undefined ? undefined : { title: '', trackNo };
  }
  return { title: isOneCase(rest) ? titleCase(rest) : rest, trackNo };
};

/**
 * Whether a title is really the file name it came from, or carries junk: the
 * tip the panel offers to clean it.
 */
export const isFileNameTitle = (title: string, fileName: string): boolean => {
  if (title.trim() === '') {
    return false;
  }
  const base = baseNameOf(fileName).trim().toLocaleLowerCase();
  return (
    title.trim().toLocaleLowerCase() === base ||
    /^\d{1,3}\s*[-.]\s+/.test(title) ||
    stripJunk(title) !== title.trim()
  );
};

export interface IValueCount {
  value: string;
  count: number;
}

/** Each distinct value and how many songs have it, the most common first;
 * ties keep the order they were met in. */
export const countValues = (values: readonly string[]): IValueCount[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count);
};

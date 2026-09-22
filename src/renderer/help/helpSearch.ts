/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { HelpChapterId, IHelpChapter } from 'common/helpGuide';
import { translate, type LocaleCode, type TranslationKey } from 'common/i18n';
import { helpSearchTerms } from './helpSearchTerms';

/**
 * The guide's search.
 *
 * It used to keep the chapters that held every typed word somewhere inside
 * them, in the guide's own order, and show them whole. "Compressor" found
 * nothing because the guide never spells the stage's name; "no sound" found
 * eleven chapters with the right one last, because "no" is inside "not" and
 * "now"; one wrong letter found nothing; and what did match was somewhere in
 * a chapter the reader then had to read from the top.
 *
 * Now each chapter is read word by word, piece by piece — its title, intro,
 * steps, tip, captions and every control's name and line — together with the
 * app's own names for what it covers (`helpSearchTerms.ts`) and the words
 * people search with that the guide does not use (`help.<id>.keywords`).
 * Outside English the English guide is searched too, at a discount, because
 * people type "limiter" and "EQ" in every language.
 *
 * A typed word matches a word that is the same, that it starts or grows out
 * of, that is the same word with another ending, or that holds it — German
 * writes one word where English writes three — in that order of worth; and
 * when it matches nothing at all it is taken as a typo and matched one or two
 * letters off. Question words are dropped, in every language. Words most
 * chapters share are worth little, a title outweighs a tip, and the words
 * typed next to each other count most where they stand next to each other.
 * Chapters come out best first, each with the passage that matched best: what
 * the contents quote and the article scrolls to.
 */

/** A piece of a chapter the search reads. */
export type THelpPassageKind =
  | 'title'
  | 'intro'
  | 'step'
  | 'tip'
  | 'caption'
  | 'controlName'
  | 'controlText'
  | 'term'
  | 'keyword';

/** [start, end) in a text, in UTF-16 units. */
export type THelpRange = readonly [number, number];

/** A text and the words in it to mark. */
export interface IHelpMarkedText {
  readonly text: string;
  readonly marks: readonly THelpRange[];
}

export interface IHelpHit {
  readonly chapterId: HelpChapterId;
  readonly score: number;
  /**
   * Where the passage that matched best is drawn (`data-help-anchor`): what
   * the article scrolls to. The chapter's title when nothing shown matched.
   */
  readonly anchor: string;
  /** That passage, or the chapter's intro, to quote under its title. */
  readonly snippet: readonly IHelpMarkedText[];
}

export interface IHelpSearch {
  /** Best first. */
  readonly hits: readonly IHelpHit[];
  /** The words to mark in each shown passage, by `helpMarkKey`. */
  readonly marks: ReadonlyMap<string, readonly THelpRange[]>;
}

interface IWord {
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

interface IPassage {
  readonly chapter: number;
  readonly kind: THelpPassageKind;
  readonly anchor: string;
  /** In the reader's language; empty for an English-only keyword. */
  readonly text: string;
  readonly words: readonly IWord[];
  /** The same passage in English, outside English. */
  readonly english: readonly IWord[];
}

interface IOccurrence {
  readonly passage: number;
  readonly english: boolean;
}

export interface IHelpIndex {
  readonly locale: LocaleCode;
  readonly chapters: readonly HelpChapterId[];
  readonly passages: readonly IPassage[];
  /** Each chapter's passages, by their place in `passages`. */
  readonly byChapter: readonly (readonly number[])[];
  /** Every distinct word, and every passage it is in. */
  readonly vocabulary: ReadonlyMap<string, readonly IOccurrence[]>;
}

/** Where on the page a passage is drawn, as `data-help-anchor` says it. */
export const helpAnchor = {
  title: (id: string) => `${id}/title`,
  intro: (id: string) => `${id}/intro`,
  step: (id: string, index: number) => `${id}/step/${index}`,
  tip: (id: string) => `${id}/tip`,
  caption: (figure: string) => `${figure}/caption`,
  control: (figure: string, index: number) => `${figure}/control/${index}`,
  figure: (id: string, index: number) => `${id}/figure/${index}`,
};

/** A shown passage's key in `IHelpSearch.marks`. */
export const helpMarkKey = (anchor: string, kind: THelpPassageKind) =>
  `${anchor}#${kind}`;

// What each piece is worth when a word is found in it. A title says what the
// chapter is about, and so do its search words, which were written to say
// exactly that; a caption or a control's name says where; a tip is an aside.
// The app's labels count for least: a style called "Stems" must not pull a
// search for vocal stems away from the Karaoke Maker, whose own search words
// name it.
const WORTH: Record<THelpPassageKind, number> = {
  title: 3,
  keyword: 2.6,
  controlName: 2.2,
  caption: 1.8,
  intro: 1.2,
  step: 1,
  controlText: 1,
  term: 1,
  tip: 0.9,
};

/** A match found only in the English guide, outside English. */
const ENGLISH_WORTH = 0.7;

/** How much more a passage is worth when the words typed stand together in it. */
const PHRASE_WORTH = 1.5;

/**
 * A chapter is shown while its score is at least this share of the best
 * one's: enough to keep every chapter that is really about the words, and to
 * drop the one that only mentions one of them in passing.
 */
const KEEP_SHARE = 0.25;

/**
 * A word most chapters share cannot choose between them. Once any typed word
 * is rarer than this, only chapters holding one of the rarer ones are shown.
 */
const COMMON_SHARE = 0.5;

// Words that carry a question, not its subject: "how do I add a band" is a
// search for "add" and "band", and "почему нет звука" for "нет" and "звука".
// Dropped unless they are all that was typed. Folded like everything else
// before use (`stopWordsOf`), so they are written here as people write them.
const STOP_WORDS: Record<LocaleCode, string> = {
  en: 'a an the and or of to in on for with at by from is are be it its this that how what why where when which do does did can could i my me you your we',
  es: 'el la los las un una unos unas de del al a en y o que qué como cómo para por porqué porque con se es mi mis tu su lo le me donde dónde cuando cuál cual hay puedo',
  pt: 'o a os as um uma de do da dos das em no na nos nas e ou que como para por porque com se meu minha onde qual posso',
  fr: 'le la les l un une des de du d à a au aux en et ou où que qu qui comment pourquoi pour par avec sur dans est mon ma mes je j se ce quel quelle',
  de: 'der die das den dem des ein eine einen einem einer und oder zu im in am an auf mit für von ist wie was wo warum wieso ich mein meine kann man sich',
  it: 'il lo la i gli le un uno una di del della dei delle a al alla in nel nella e o che come perché per con su mio mia dove quale posso si',
  ru: 'и в во на с со к по для как какой что это я мой моя где почему зачем или а о у из от до ли можно',
  zh: '的 了 是 在 吗 呢 和 与 我 怎么 如何 怎样 什么 哪里 为什么 这 那 一个',
  ja: 'の は が を に で と も へ や か する して です ます どう どこ 何 なに なぜ どうして どうやって',
  hi: 'का की के है हैं में से को और या कैसे क्या क्यों मेरा मेरी यह वह पर एक कहाँ',
};

/** Scripts written without spaces: a typed term is found anywhere in the text. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Accents on Latin letters only: in Devanagari or kana a mark is a letter. */
const LATIN_MARKS = /(\p{Script=Latin})\p{Mn}+/gu;

// The dot many Hindi typists leave off (ज़ typed as ज), and the two nasal
// marks typed for each other. Decomposed, a letter with a nukta is the
// letter and the dot.
const DEVANAGARI_NUKTA = /\u093c/g;
const DEVANAGARI_CHANDRABINDU = /\u0901/g;
const DEVANAGARI_ANUSVARA = '\u0902';

/**
 * A word as the search compares it: lower case, Latin accents off, and the
 * spellings people type interchangeably made one — the full-width ＥＱ and
 * digits a Japanese keyboard types and the plain ones, ß and ss, ё and е, a
 * Hindi letter with its nukta and without, and the curly apostrophe the
 * dictionaries use and the straight one keyboards type.
 */
export const foldHelpWord = (word: string, locale: LocaleCode): string =>
  word
    .normalize('NFKD')
    .replace(LATIN_MARKS, '$1')
    .replace(DEVANAGARI_NUKTA, '')
    .replace(DEVANAGARI_CHANDRABINDU, DEVANAGARI_ANUSVARA)
    .normalize('NFC')
    .toLocaleLowerCase(locale)
    .replace(/ß/g, 'ss')
    .replace(/ё/g, 'е')
    .replace(/[’‘`´]/g, "'");

const stopWords = new Map<LocaleCode, ReadonlySet<string>>();

const stopWordsOf = (locale: LocaleCode): ReadonlySet<string> => {
  let words = stopWords.get(locale);
  if (!words) {
    words = new Set(
      STOP_WORDS[locale].split(' ').map((word) => foldHelpWord(word, locale)),
    );
    stopWords.set(locale, words);
  }
  return words;
};

const segmenters = new Map<LocaleCode, Intl.Segmenter>();

/**
 * French and Italian fuse an article onto the word after it — l'égaliseur,
 * dell'uscita — and the word breaker keeps them as one, so "égaliseur" would
 * only ever be found inside it. The article is not part of what is searched.
 */
const ELIDED = /^\p{L}{1,5}'(?=\p{L}{2})/u;
const ELIDING: ReadonlySet<LocaleCode> = new Set(['fr', 'it']);

const wordsOf = (text: string, locale: LocaleCode): IWord[] => {
  let segmenter = segmenters.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    segmenters.set(locale, segmenter);
  }
  const elides = ELIDING.has(locale);
  return Array.from(segmenter.segment(text))
    .filter(({ isWordLike }) => isWordLike)
    .map(({ segment, index }) => {
      const key = foldHelpWord(segment, locale);
      return {
        key: elides ? key.replace(ELIDED, '') : key,
        start: index,
        end: index + segment.length,
      };
    });
};

/** The words of a query the search looks for. */
export const helpQueryTerms = (query: string, locale: LocaleCode): string[] => {
  const all = [...new Set(wordsOf(query, locale).map((word) => word.key))];
  const meaningful = all.filter((term) => !stopWordsOf(locale).has(term));
  return meaningful.length > 0 ? meaningful : all;
};

/**
 * The optimal-string-alignment distance between two words, or `limit + 1`
 * once it is certain to be more than `limit`.
 */
const distance = (a: string, b: string, limit: number): number => {
  if (Math.abs(a.length - b.length) > limit) {
    return limit + 1;
  }
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) {
      return limit + 1;
    }
    before = previous;
    previous = current;
  }
  return previous[b.length];
};

/**
 * The same word with another ending: Portuguese "configuração" and
 * "configurações", Italian "equalizzatore" and "equalizzatori", a Russian
 * case. Neither starts the other, and they are three letters apart, so
 * neither rule above nor a typo finds one from the other. A long shared start
 * with short endings does: a quarter of the shorter word at most may differ,
 * and three letters on either side, so "band" and "hand" stay two words.
 */
const sameWordAnotherForm = (term: string, word: string) => {
  const shorter = Math.min(term.length, word.length);
  if (shorter < 5) {
    return false;
  }
  let shared = 0;
  while (shared < shorter && term[shared] === word[shared]) {
    shared += 1;
  }
  return (
    shared >= Math.max(4, Math.ceil(shorter * 0.75)) &&
    term.length - shared <= 3 &&
    word.length - shared <= 3
  );
};

/**
 * How well a typed term matches a word: 1 for the same word, less for a word
 * it starts — much less when it is a small part of a long one — and less
 * again for another form of it, and for a word that merely holds it. Two
 * letters or fewer only ever match themselves, or "no" would find "not",
 * "now" and "notice".
 */
const closeness = (term: string, word: string): number => {
  if (word === term) {
    return 1;
  }
  if (term.length >= 3 && word.startsWith(term)) {
    return 0.9 - 0.5 * (1 - term.length / word.length);
  }
  // The word the typed one grows out of: "headphones" is the chapter titled
  // "Headphone correction", "presets" its "Preset", and a Russian case ending
  // the same word. Two letters at most, or "limiting" would be "limit".
  if (
    word.length >= 4 &&
    term.length - word.length <= 2 &&
    term.startsWith(word)
  ) {
    return 0.85;
  }
  if (sameWordAnotherForm(term, word)) {
    return 0.75;
  }
  if (term.length >= 4 && word.includes(term)) {
    return 0.5;
  }
  return 0;
};

/**
 * The same, one or two letters off: only for a term nothing else matched,
 * and never a short one — one letter is a quarter of "dark", and "mark" is
 * not what anyone searching for it meant.
 */
const typoCloseness = (term: string, word: string): number => {
  if (term.length < 5) {
    return 0;
  }
  const limit = term.length >= 8 ? 2 : 1;
  const apart = distance(term, word, limit);
  if (apart > limit) {
    return 0;
  }
  return apart === 1 ? 0.6 : 0.45;
};

const indexChapter = (
  chapter: IHelpChapter<HelpChapterId, string>,
  number: number,
  locale: LocaleCode,
  add: (passage: IPassage) => void,
) => {
  const { id } = chapter;
  const inEnglish = locale !== 'en';
  const piece = (
    kind: THelpPassageKind,
    anchor: string,
    text: string,
    english: string,
  ) =>
    add({
      chapter: number,
      kind,
      anchor,
      text,
      words: wordsOf(text, locale),
      english: inEnglish ? wordsOf(english, 'en') : [],
    });
  const both = (kind: THelpPassageKind, anchor: string, key: TranslationKey) =>
    piece(kind, anchor, translate(locale, key), translate('en', key));

  both('title', helpAnchor.title(id), `help.${id}.title`);
  both('intro', helpAnchor.intro(id), `help.${id}.intro`);
  const steps = translate(locale, `help.${id}.steps`).split('\n');
  const englishSteps = translate('en', `help.${id}.steps`).split('\n');
  steps.forEach((step, index) =>
    piece('step', helpAnchor.step(id, index), step, englishSteps[index] ?? ''),
  );
  both('tip', helpAnchor.tip(id), `help.${id}.tip`);
  // Where each control is, by its name, for the labels that belong to one.
  const controls = new Map<TranslationKey, string>();
  chapter.figures.forEach((figure, figureIndex) => {
    const at = helpAnchor.figure(id, figureIndex);
    if (figure.caption) {
      both('caption', helpAnchor.caption(at), figure.caption);
    }
    (figure.controls ?? []).forEach((control, index) => {
      const anchor = helpAnchor.control(at, index);
      if (!controls.has(control.name)) {
        controls.set(control.name, anchor);
      }
      both('controlName', anchor, control.name);
      both('controlText', anchor, control.text);
    });
  });
  helpSearchTerms(id).forEach(({ key, control }) =>
    both(
      'term',
      controls.get(key) ??
        (control && controls.get(control)) ??
        helpAnchor.title(id),
      key,
    ),
  );
  // One passage per search word or phrase, so the words of two different
  // phrases never count as standing together. The reader's and the English
  // lists are not translations of each other, so they are passages apart.
  const phrases = (text: string) =>
    text
      .split(',')
      .map((phrase) => phrase.trim())
      .filter(Boolean);
  phrases(translate(locale, `help.${id}.keywords`)).forEach((phrase) =>
    piece('keyword', helpAnchor.title(id), phrase, ''),
  );
  if (inEnglish) {
    phrases(translate('en', `help.${id}.keywords`)).forEach((phrase) =>
      piece('keyword', helpAnchor.title(id), '', phrase),
    );
  }
};

/** Reads the whole guide in one language, once. */
export const buildHelpIndex = (
  chapters: readonly IHelpChapter<HelpChapterId, string>[],
  locale: LocaleCode,
): IHelpIndex => {
  const passages: IPassage[] = [];
  const byChapter: number[][] = chapters.map(() => []);
  const vocabulary = new Map<string, IOccurrence[]>();
  const note = (key: string, occurrence: IOccurrence) => {
    const list = vocabulary.get(key);
    if (list) {
      list.push(occurrence);
    } else {
      vocabulary.set(key, [occurrence]);
    }
  };
  chapters.forEach((chapter, number) =>
    indexChapter(chapter, number, locale, (passage) => {
      const at = passages.length;
      passages.push(passage);
      byChapter[number].push(at);
      passage.words.forEach((word) =>
        note(word.key, { passage: at, english: false }),
      );
      passage.english.forEach((word) =>
        note(word.key, { passage: at, english: true }),
      );
    }),
  );
  return {
    locale,
    chapters: chapters.map((chapter) => chapter.id),
    passages,
    byChapter,
    vocabulary,
  };
};

/** How well one term matches each word of the guide that it matches at all. */
const wordsMatching = (index: IHelpIndex, term: string) => {
  const found = new Map<string, number>();
  index.vocabulary.forEach((_, word) => {
    const value = closeness(term, word);
    if (value > 0) {
      found.set(word, value);
    }
  });
  if (found.size === 0) {
    index.vocabulary.forEach((_, word) => {
      const value = typoCloseness(term, word);
      if (value > 0) {
        found.set(word, value);
      }
    });
  }
  return found;
};

/** Where an unspaced term stands in a text, case aside. */
const rangesInside = (text: string, term: string): THelpRange[] => {
  const lower = text.toLocaleLowerCase();
  if (lower.length !== text.length) {
    return [];
  }
  const ranges: THelpRange[] = [];
  let from = lower.indexOf(term);
  while (from >= 0) {
    ranges.push([from, from + term.length]);
    from = lower.indexOf(term, from + term.length);
  }
  return ranges;
};

interface ITermMatch {
  readonly term: string;
  /** Per passage: the best closeness found in it, and whether only in English. */
  readonly passages: ReadonlyMap<number, { value: number; english: boolean }>;
  /** Per shown passage: the words to mark for this term. */
  readonly ranges: ReadonlyMap<number, THelpRange[]>;
}

const matchTerm = (index: IHelpIndex, term: string): ITermMatch => {
  const passages = new Map<number, { value: number; english: boolean }>();
  const ranges = new Map<number, THelpRange[]>();
  const keep = (passage: number, value: number, english: boolean) => {
    const worth = english ? value * ENGLISH_WORTH : value;
    const known = passages.get(passage);
    if (!known || worth > known.value) {
      passages.set(passage, { value: worth, english });
    }
  };
  const mark = (passage: number, range: THelpRange) => {
    const list = ranges.get(passage);
    if (list) {
      list.push(range);
    } else {
      ranges.set(passage, [range]);
    }
  };
  if (UNSPACED.test(term)) {
    index.passages.forEach((passage, at) => {
      const inside = rangesInside(passage.text, term);
      if (inside.length > 0) {
        keep(at, 1, false);
        inside.forEach((range) => mark(at, range));
      }
    });
    return { term, passages, ranges };
  }
  wordsMatching(index, term).forEach((value, word) => {
    (index.vocabulary.get(word) ?? []).forEach(({ passage, english }) => {
      keep(passage, value, english);
      if (!english) {
        index.passages[passage].words.forEach((each) => {
          if (each.key === word) {
            mark(passage, [each.start, each.end]);
          }
        });
      }
    });
  });
  return { term, passages, ranges };
};

/**
 * Whether the typed terms stand one after another, in order, somewhere in the
 * passage — words the search ignores between them aside, so "add a band"
 * stands together in "or add a band beside it".
 */
const standsTogether = (
  words: readonly IWord[],
  terms: readonly string[],
  stop: ReadonlySet<string>,
) => {
  const keys = words.map((word) => word.key).filter((key) => !stop.has(key));
  const fits = (key: string, term: string) =>
    key === term || (term.length >= 3 && key.startsWith(term));
  for (let start = 0; start + terms.length <= keys.length; start += 1) {
    if (terms.every((term, offset) => fits(keys[start + offset], term))) {
      return true;
    }
  }
  return false;
};

const mergeRanges = (ranges: readonly THelpRange[]): THelpRange[] => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  sorted.forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  });
  return merged;
};

/** The longest quote a snippet starts before its first mark. */
const LEAD = 40;

/**
 * A passage quoted from a little before its first marked word, so the word is
 * in the two lines the contents show.
 */
const quote = (text: string, marks: readonly THelpRange[]): IHelpMarkedText => {
  const first = marks[0];
  if (!first || first[0] <= LEAD) {
    return { text, marks };
  }
  const space = text.lastIndexOf(' ', first[0] - LEAD / 2);
  const cut =
    space > 0 && first[0] - space <= LEAD ? space + 1 : first[0] - LEAD / 2;
  return {
    text: `…${text.slice(cut)}`,
    marks: marks.map(([start, end]) => [start - cut + 1, end - cut + 1]),
  };
};

/**
 * Searches the guide. `undefined` when nothing searchable was typed, which
 * means the whole guide, as it reads.
 */
export const searchHelp = (
  index: IHelpIndex,
  query: string,
): IHelpSearch | undefined => {
  const { locale, passages } = index;
  const terms = helpQueryTerms(query, locale);
  if (terms.length === 0) {
    return undefined;
  }
  const count = index.chapters.length;
  const matches = terms
    .map((term) => matchTerm(index, term))
    .filter((match) => match.passages.size > 0);
  // Most of what was typed is in no chapter: whatever the rest matches is not
  // what was asked. "Dark mode" is not a question about EQ mode.
  if (matches.length === 0 || matches.length * 3 < terms.length * 2) {
    return { hits: [], marks: new Map() };
  }

  // Per term and chapter: the best worth found in it, and how often.
  const best = matches.map(() => new Map<number, number>());
  const often = matches.map(() => new Map<number, number>());
  matches.forEach((match, t) =>
    match.passages.forEach(({ value }, at) => {
      const { chapter, kind } = passages[at];
      const worth = value * WORTH[kind];
      best[t].set(chapter, Math.max(best[t].get(chapter) ?? 0, worth));
      often[t].set(chapter, (often[t].get(chapter) ?? 0) + 1);
    }),
  );
  const rarity = best.map((chapters) => Math.log(1 + count / chapters.size));
  const allTerms = matches.map((match) => match.term);
  const stop = stopWordsOf(locale);
  const together = (chapter: number) =>
    allTerms.length > 1 &&
    index.byChapter[chapter].some(
      (at) =>
        standsTogether(passages[at].words, allTerms, stop) ||
        standsTogether(passages[at].english, allTerms, stopWordsOf('en')),
    );
  const everyChapter = index.chapters.map((_, chapter) => chapter);
  const matchesAll = (chapter: number) =>
    best.every((chapters) => chapters.has(chapter));
  const rare = best
    .map((chapters, t) => (chapters.size <= count * COMMON_SHARE ? t : -1))
    .filter((t) => t >= 0);
  let candidates: number[];
  if (rare.length > 0) {
    candidates = everyChapter.filter((chapter) =>
      rare.some((t) => best[t].has(chapter)),
    );
  } else if (allTerms.length > 1) {
    // Every word typed is in most chapters — French "pas de son" is "not",
    // "of" and "sound", and was twenty chapters. Where the words stand
    // together is the answer; failing that, where all of them are.
    const phrased = everyChapter.filter(together);
    candidates = phrased.length > 0 ? phrased : everyChapter.filter(matchesAll);
  } else {
    candidates = everyChapter.filter((chapter) => best[0].has(chapter));
  }
  const totalRarity = rarity.reduce((sum, value) => sum + value, 0);

  const scored = candidates.map((chapter) => {
    let score = 0;
    let covered = 0;
    best.forEach((chapters, t) => {
      const worth = chapters.get(chapter);
      if (worth !== undefined) {
        const times = often[t].get(chapter) ?? 1;
        score += rarity[t] * worth * (1 + 0.15 * Math.log(times));
        covered += rarity[t];
      }
    });
    const coverage = totalRarity > 0 ? covered / totalRarity : 0;
    score *= coverage * coverage;
    if (together(chapter)) {
      score *= PHRASE_WORTH;
    }
    return { chapter, score };
  });
  scored.sort((a, b) => b.score - a.score || a.chapter - b.chapter);
  const top = scored[0]?.score ?? 0;
  const shown = scored.filter(({ score }) => score >= top * KEEP_SHARE);

  const shownChapters = new Set(shown.map(({ chapter }) => chapter));

  // The words found, per passage of a shown chapter, from every term.
  const found = new Map<number, THelpRange[]>();
  matches.forEach((match) =>
    match.ranges.forEach((ranges, at) => {
      if (shownChapters.has(passages[at].chapter)) {
        found.set(at, [...(found.get(at) ?? []), ...ranges]);
      }
    }),
  );
  found.forEach((ranges, at) => found.set(at, mergeRanges(ranges)));
  const rangesAt = (at: number) => found.get(at) ?? [];

  // What the article marks: the passages it draws.
  const marks = new Map<string, readonly THelpRange[]>();
  found.forEach((ranges, at) => {
    const { anchor, kind } = passages[at];
    if (kind !== 'term' && kind !== 'keyword') {
      marks.set(helpMarkKey(anchor, kind), ranges);
    }
  });

  /** What a passage is worth to this search, all terms together. */
  const worthOf = (at: number) =>
    matches.reduce((sum, match, t) => {
      const hit = match.passages.get(at);
      return hit ? sum + rarity[t] * hit.value * WORTH[passages[at].kind] : sum;
    }, 0);
  /** The passage of these kinds worth most, if any is worth anything. */
  const bestOf = (chapter: number, kinds: readonly THelpPassageKind[]) => {
    let best = -1;
    let worth = 0;
    index.byChapter[chapter].forEach((at) => {
      if (kinds.includes(passages[at].kind)) {
        const value = worthOf(at);
        if (value > worth) {
          worth = value;
          best = at;
        }
      }
    });
    return best;
  };
  const passageOf = (chapter: number, anchor: string, kind: THelpPassageKind) =>
    index.byChapter[chapter].find(
      (at) => passages[at].anchor === anchor && passages[at].kind === kind,
    );
  const quoted = (at: number | undefined) =>
    at === undefined ? [] : [quote(passages[at].text, rangesAt(at))];

  const hits = shown.map(({ chapter, score }): IHelpHit => {
    const chapterId = index.chapters[chapter];
    // What the reader can see matched: quoted, and where the article goes. A
    // control is quoted by its name and its line, whichever of them matched.
    const text = bestOf(chapter, [
      'intro',
      'step',
      'tip',
      'caption',
      'controlName',
      'controlText',
    ]);
    if (text >= 0) {
      const { anchor, kind } = passages[text];
      const control = kind === 'controlName' || kind === 'controlText';
      return {
        chapterId,
        score,
        anchor,
        snippet: control
          ? [
              ...quoted(passageOf(chapter, anchor, 'controlName')),
              ...quoted(passageOf(chapter, anchor, 'controlText')),
            ]
          : quoted(text),
      };
    }
    // Only one of the app's own names matched: quoted under the control it
    // is chosen in, which is where the article goes.
    const term = bestOf(chapter, ['term']);
    if (term >= 0) {
      const { anchor } = passages[term];
      return {
        chapterId,
        score,
        anchor,
        snippet: [
          ...quoted(passageOf(chapter, anchor, 'controlName')),
          ...quoted(term),
        ],
      };
    }
    // The title, a search word or the English guide alone: the chapter itself.
    return {
      chapterId,
      score,
      anchor: helpAnchor.title(chapterId),
      snippet: quoted(passageOf(chapter, helpAnchor.intro(chapterId), 'intro')),
    };
  });
  return { hits, marks };
};

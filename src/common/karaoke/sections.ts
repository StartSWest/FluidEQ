/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Structural headings, in the ten languages this app ships.
 *
 * WHY A VOCABULARY AND NOT A SHAPE. "A bracketed group on its own" looks like
 * the general rule and is not: `[Ooh ooh ooh]`, `[x2]` and `[Laughing]` are
 * all written that way and are all words somebody sings. Calling one of them a
 * heading is the expensive mistake, because a heading is skipped in the
 * singing lane and drawn smaller — the line silently disappears from the song.
 * Failing to recognise a real heading only leaves it on screen looking like a
 * lyric, which the singer can see for themselves.
 *
 * So the list stays a list. What was wrong before was its LENGTH: thirteen
 * English words, in an app that ships in ten languages, so `[Estribillo]` and
 * `[サビ]` were handed to the singer as words to perform.
 */
const SECTION_WORDS = [
  // English, plus the Genius-derived spellings that dominate scraped lyrics.
  'intro',
  'verse',
  'pre-?chorus',
  'post-?chorus',
  'chorus',
  'bridge',
  'break',
  'breakdown',
  'instrumental',
  'interlude',
  'solo',
  'outro',
  'hook',
  'refrain',
  'ending',
  'coda',
  'drop',
  'skit',
  'spoken',
  // Spanish
  'intro(?:ducci[oó]n)?',
  'verso',
  'estribillo',
  'coro',
  'estrofa',
  'puente',
  'interludio',
  'final',
  // French
  'couplet',
  'pont',
  'interlude',
  // German
  'strophe',
  'refrain',
  'br[uü]cke',
  'zwischenspiel',
  'ende',
  // Italian
  'strofa',
  'ritornello',
  'ponte',
  'strumentale',
  'assolo',
  'finale',
  // Portuguese
  'refr[aã]o',
  'interl[uú]dio',
  // Russian
  'интро',
  'куплет',
  'припев',
  'бридж',
  'проигрыш',
  'соло',
  'аутро',
  'кода',
  'вступление',
  // Japanese
  'イントロ',
  '[ABC]メロ',
  'サビ',
  '大サビ',
  '間奏',
  'アウトロ',
  '前奏',
  // Chinese
  '前奏',
  '主歌',
  '副歌',
  '间奏',
  '間奏',
  '尾奏',
  '橋段',
  '桥段',
  '独奏',
  // Hindi
  'मुखड़ा',
  'अंतरा',
  'स्थायी',
] as const;

/**
 * The brackets a heading is written in, as pairs so `[サビ）` cannot match.
 *
 * ASCII round brackets are deliberately absent: providers distinguish them,
 * writing `[Chorus]` for structure and `(Oh yeah)` for a backing vocal that
 * somebody sings. Their fullwidth cousins are not the same character and are
 * not used that way — a Japanese sheet writes `（間奏）` for the section an
 * English one calls `[Instrumental]`.
 *
 * The bracket set and the vocabulary answer different halves of the question,
 * which is why both are needed: `（Ooh ooh ooh）` is still not a heading here,
 * because "ooh" is not one of the words.
 */
const SECTION_BRACKETS: readonly (readonly [string, string])[] = [
  ['\\[', '\\]'],
  ['\\{', '\\}'],
  ['【', '】'],
  ['〔', '〕'],
  ['［', '］'],
  ['（', '）'],
];

/**
 * One heading, with the decorations real files put on it.
 *
 * A trailing number (`Verse 2`), an ordinal word before it (`2nd Chorus`) and
 * a performer after a colon (`[Verse 2: Kendrick]`, which is how every lyric
 * site writes it) are all the same heading. The colon clause was the common
 * case the old list could not match at all.
 */
const SECTION_BODY = `\\s*(?:\\d+\\s*[.)-]?\\s*)?(?:${SECTION_WORDS.join(
  '|',
)})(?:\\s*\\d+)?(?:\\s*[:\\-–]\\s*[^\\]\\}】〕］）]*)?\\s*`;

const SECTION_TEXT = new RegExp(
  `^\\s*(?:${SECTION_BRACKETS.map(
    ([open, close]) => `${open}${SECTION_BODY}${close}`,
  ).join('|')})\\s*$`,
  'iu',
);

/**
 * Whether this lyric line is a heading rather than something to sing.
 *
 * Shared so the importer and the Maker cannot disagree about the same text:
 * they held two separate English word lists, and a heading pasted into the
 * Maker came back from an export as a lyric.
 */
export const isKaraokeSectionText = (text: string): boolean =>
  SECTION_TEXT.test(text);

export default isKaraokeSectionText;

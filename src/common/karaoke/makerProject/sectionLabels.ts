/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Bracket pairs a lyrics provider might wrap a structure label in. */
const BRACKET_PAIRS: readonly (readonly [string, string])[] = [
  ['[', ']'],
  ['(', ')'],
  ['{', '}'],
  ['【', '】'],
  ['（', '）'],
  ['〔', '〕'],
  ['［', '］'],
];

/**
 * A structure label is at most this many words. Checked against the names all
 * ten shipped locales use: "Pre-Chorus", "Estribillo", "Припев 2", "副歌",
 * "मुखड़ा", "Pré-refrão" — none reaches four.
 */
const MAXIMUM_LABEL_WORDS = 3;

/** Longer than any of those names, shorter than a sung line worth timing. */
const MAXIMUM_LABEL_CHARACTERS = 24;

/**
 * Whether a lyric line is a structure label rather than something sung.
 *
 * This used to be a list of English words — intro, verse, pre-chorus, chorus,
 * bridge, break, instrumental, interlude, solo, outro, hook, refrain, ending —
 * which is wrong in nine of the ten locales the app ships. A Spanish sheet's
 * "[Estribillo]" failed the test, became a one-token lyric line, and sat in
 * the karaoke output forever untimed, because no singer ever sings the word.
 *
 * A label is recognisable by its shape and not by its vocabulary: wrapped in
 * brackets with nothing outside them, a few words at most, and none of the
 * punctuation a sung line carries. That test costs no vocabulary in any
 * language, and every string the old list matched still passes it — those
 * names are all bracket-wrapped and at most two words.
 *
 * It cannot tell a label from a bracketed aside the singer actually performs.
 * Nothing about the text can; only the audio knows. The comma rule catches the
 * common case, and confirming the rest belongs to whatever heard the song.
 */
export const karaokeMakerLineLooksLikeLabel = (text: string): boolean => {
  const trimmed = text.trim();
  const pair = BRACKET_PAIRS.find(
    ([open, close]) =>
      trimmed.length > 2 && trimmed.startsWith(open) && trimmed.endsWith(close),
  );
  if (!pair) {
    return false;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (
    !inner ||
    inner.length > MAXIMUM_LABEL_CHARACTERS ||
    // A second closing bracket means the line is not one wrapped label.
    inner.includes(pair[1]) ||
    // Punctuation a label does not carry and a sung aside does.
    /[,;:!?。、，；：！？…]/u.test(inner) ||
    !/\p{L}/u.test(inner)
  ) {
    return false;
  }
  return inner.split(/\s+/u).filter(Boolean).length <= MAXIMUM_LABEL_WORDS;
};

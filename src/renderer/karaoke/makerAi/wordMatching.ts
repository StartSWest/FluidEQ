/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerToken } from '../../../common/karaoke/makerProject';
import { IKaraokeMakerTranscriptWord } from './whisperProgress';
import { maximumAutomaticWordDurationMs } from './analysisWindows';

/**
 * Katakana and hiragana write the same sounds, and a lyric sheet and a
 * transcript disagree about which to use constantly. Measured: "\u30a2\u30a4" against
 * "\u3042\u3044" scored an edit ratio of 1.0 against a 0.34 bar and never matched.
 * U+30A1..U+30F6 have hiragana counterparts exactly 0x60 below; the four
 * without one and the shared long-vowel mark are left alone.
 */
const foldKatakanaToHiragana = (value: string): string =>
  Array.from(value)
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCodePoint(code - 0x60)
        : character;
    })
    .join('');

/**
 * The closing NFC undoes something NFKD did that nothing here wanted.
 *
 * NFKD decomposes a Hangul syllable into its jamo, so "\ud55c" was three code
 * points and "\ud558" two \u2014 one insertion out of three is a ratio of 0.333, inside
 * the 0.34 that counts as a match. Two different Korean syllables matched each
 * other. Recomposed they are one code point each and do not.
 */
/**
 * Answers already given, because a song asks the same few questions millions
 * of times.
 *
 * The sentence router normalises every transcript word once per lyric anchor
 * of every line: measured on a song repeating one three-word line four hundred
 * times, 26.6 million calls for three distinct strings, and half the cost of
 * building candidates. Nothing here depends on when the call happens, only on
 * the string, so the answer keeps. The bound guards a pathological vocabulary
 * rather than sizing a working set \u2014 a song's is a few thousand words.
 */
const normalizedWords = new Map<string, string>();

export const normalizedWord = (value: string): string => {
  const remembered = normalizedWords.get(value);
  if (remembered !== undefined) {
    return remembered;
  }
  const normalized = foldKatakanaToHiragana(
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .normalize('NFC'),
  );
  if (normalizedWords.size >= 20_000) {
    normalizedWords.clear();
  }
  normalizedWords.set(value, normalized);
  return normalized;
};

export const normalizedWordDistance = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  if (!left || !right) {
    return 4;
  }
  if (
    Math.min(left.length, right.length) >= 3 &&
    (left.includes(right) || right.includes(left))
  ) {
    return 1;
  }
  let previous = new Uint16Array(right.length + 1);
  let current = new Uint16Array(right.length + 1);
  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }
  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    [previous, current] = [current, previous];
  }
  const ratio = previous[right.length] / Math.max(left.length, right.length);
  return ratio <= 0.34 ? 1 : 4;
};

/** Map one lyric phrase onto one bounded Whisper phrase. */
export const alignWordSequenceSegment = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): Map<string, IKaraokeMakerTranscriptWord> => {
  const lyricCount = Math.min(4_000, lyrics.length);
  const transcriptCount = Math.min(4_000, transcript.length);
  const width = transcriptCount + 1;
  const directions = new Uint8Array((lyricCount + 1) * width);
  let previous = new Uint16Array(width);
  let current = new Uint16Array(width);
  for (let column = 0; column <= transcriptCount; column += 1) {
    previous[column] = column * 2;
  }
  for (let row = 1; row <= lyricCount; row += 1) {
    current[0] = row * 2;
    for (let column = 1; column <= transcriptCount; column += 1) {
      const distance = normalizedWordDistance(
        normalizedWord(lyrics[row - 1].text),
        normalizedWord(transcript[column - 1].text),
      );
      const diagonal = previous[column - 1] + distance;
      const removeLyric = previous[column] + 2;
      const skipTranscript = current[column - 1] + 2;
      const best = Math.min(diagonal, removeLyric, skipTranscript);
      current[column] = best;
      let direction = 3;
      // In an exact tie, keep the earliest lyric occurrence matched and skip
      // the later duplicate. Otherwise one omitted repeated chorus/line makes
      // Whisper's first performance attach to the second reference copy.
      if (best === removeLyric) {
        direction = 2;
      } else if (best === diagonal) {
        direction = 1;
      }
      directions[row * width + column] = direction;
    }
    [previous, current] = [current, previous];
  }
  const mapping = new Map<string, IKaraokeMakerTranscriptWord>();
  let row = lyricCount;
  let column = transcriptCount;
  while (row > 0 && column > 0) {
    const direction = directions[row * width + column];
    if (direction === 1) {
      if (
        normalizedWordDistance(
          normalizedWord(lyrics[row - 1].text),
          normalizedWord(transcript[column - 1].text),
        ) <= 1
      ) {
        mapping.set(lyrics[row - 1].id, transcript[column - 1]);
      }
      row -= 1;
      column -= 1;
    } else if (direction === 2) {
      row -= 1;
    } else {
      column -= 1;
    }
  }
  return mapping;
};

/**
 * Align one sentence while pinning the lyric anchor to the exact Whisper
 * occurrence that produced the candidate. An unconstrained edit-distance
 * backtrack naturally prefers the last copy when two performances of the
 * same line fit in the local window. That made a real first performance
 * disappear whenever the singer repeated the phrase immediately afterward.
 */
export const alignWordSequenceAtOccurrence = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
  lyricAnchorIndex: number,
  transcriptAnchorIndex: number,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const mapping = alignWordSequenceSegment(
    lyrics.slice(0, lyricAnchorIndex),
    transcript.slice(0, transcriptAnchorIndex),
  );
  const lyricAnchor = lyrics[lyricAnchorIndex];
  const transcriptAnchor = transcript[transcriptAnchorIndex];
  if (
    lyricAnchor &&
    transcriptAnchor &&
    normalizedWordDistance(
      normalizedWord(lyricAnchor.text),
      normalizedWord(transcriptAnchor.text),
    ) <= 1
  ) {
    mapping.set(lyricAnchor.id, transcriptAnchor);
  }
  alignWordSequenceSegment(
    lyrics.slice(lyricAnchorIndex + 1),
    transcript.slice(transcriptAnchorIndex + 1),
  ).forEach((timing, tokenId) => mapping.set(tokenId, timing));
  return mapping;
};

/**
 * A single short word is not a trustworthy speech anchor. Whisper can emit
 * common fragments such as "a", "I", or "oh" over an instrumental passage;
 * accepting one of those in isolation is enough to pull an otherwise missing
 * lyric line into the music. Keep them only when neighbouring lyric and
 * transcript words form one locally coherent spoken phrase.
 */
export const pruneWeakDirectMappings = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
  mapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const transcriptIndexes = new Map(
    transcript.map((word, index) => [word, index] as const),
  );
  const pairs = lyrics.flatMap((token, lyricIndex) => {
    const word = mapping.get(token.id);
    const transcriptIndex = word ? transcriptIndexes.get(word) : undefined;
    return word && transcriptIndex !== undefined
      ? [{ token, word, lyricIndex, transcriptIndex }]
      : [];
  });
  const coherentWith = (
    current: (typeof pairs)[number],
    neighbour: (typeof pairs)[number] | undefined,
  ): boolean => {
    if (!neighbour) {
      return false;
    }
    const lyricDistance = Math.abs(current.lyricIndex - neighbour.lyricIndex);
    const transcriptDistance = Math.abs(
      current.transcriptIndex - neighbour.transcriptIndex,
    );
    let timeDistance = 0;
    if (current.word.startMs >= neighbour.word.endMs) {
      timeDistance = current.word.startMs - neighbour.word.endMs;
    } else if (neighbour.word.startMs >= current.word.endMs) {
      timeDistance = neighbour.word.startMs - current.word.endMs;
    }
    return (
      lyricDistance <= 2 && transcriptDistance <= 2 && timeDistance <= 2_500
    );
  };
  const pruned = new Map(mapping);
  pairs.forEach((pair, index) => {
    const normalized = normalizedWord(pair.token.text);
    const isShort = Array.from(normalized).length <= 2;
    const isProviderSyllableGroup =
      pair.token.startsWord === false ||
      lyrics[pair.lyricIndex + 1]?.startsWord === false;
    const isApproximate =
      normalizedWordDistance(normalized, normalizedWord(pair.word.text)) > 0;
    const hasPhraseSupport =
      coherentWith(pair, pairs[index - 1]) ||
      coherentWith(pair, pairs[index + 1]);
    const previousTranscript = transcript[pair.transcriptIndex - 1];
    const nextTranscript = transcript[pair.transcriptIndex + 1];
    const hasRecognizedSpeechNeighbour =
      (previousTranscript !== undefined &&
        pair.word.startMs - previousTranscript.endMs <= 2_500) ||
      (nextTranscript !== undefined &&
        nextTranscript.startMs - pair.word.endMs <= 2_500);
    // A one-word line skips this guard, which lets a lone ad-lib "yeah" be
    // pinned to an isolated fragment in an intro. Applying it to those lines
    // too was tried and reverted: a song whose lyrics are a single word has no
    // neighbours by construction, so the guard rejected the only correct match
    // there is and three tested cases went untimed. The real distinction is
    // between a short line inside a song and a song that is short, and this
    // clause cannot see which it has.
    if (
      (lyrics.length > 1 &&
        !isProviderSyllableGroup &&
        !hasRecognizedSpeechNeighbour &&
        !hasPhraseSupport) ||
      ((isShort || (isApproximate && normalized.length <= 3)) &&
        !hasPhraseSupport)
    ) {
      pruned.delete(pair.token.id);
    }
  });
  return pruned;
};

/**
 * Make automatic word windows safe without relocating Whisper evidence.
 * Small timestamp overlap is trimmed. A mapping that is out of order or falls
 * on the wrong side of a manual anchor is rejected instead of being pushed to
 * a different part of the song.
 */
export const constrainAutomaticWordTiming = (
  lyrics: readonly IKaraokeMakerToken[],
  mapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
  durationMs: number,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const constrained = new Map<string, IKaraokeMakerTranscriptWord>();
  let previousEndMs = 0;
  lyrics.forEach((token, tokenIndex) => {
    if (
      token.timingLocked &&
      token.startMs !== undefined &&
      token.endMs !== undefined
    ) {
      previousEndMs = Math.max(previousEndMs, token.endMs);
      return;
    }
    const proposed = mapping.get(token.id);
    if (!proposed) {
      return;
    }
    const nextProtected = lyrics
      .slice(tokenIndex + 1)
      .find(
        (candidate) =>
          candidate.timingLocked && candidate.startMs !== undefined,
      );
    const upperBoundMs = Math.min(
      durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY,
      nextProtected?.startMs ?? Number.POSITIVE_INFINITY,
    );
    if (proposed.endMs <= previousEndMs || proposed.startMs >= upperBoundMs) {
      return;
    }
    const startMs = Math.max(previousEndMs, proposed.startMs);
    const endMs = Math.min(
      upperBoundMs,
      proposed.endMs,
      startMs + maximumAutomaticWordDurationMs(token.text),
    );
    if (endMs - startMs < 20) {
      return;
    }
    constrained.set(token.id, { ...proposed, startMs, endMs });
    previousEndMs = endMs;
  });
  return constrained;
};

/**
 * Whisper's timestamp head fails by reporting a position it does not have, and
 * both shapes of that were being written into projects as measurements.
 *
 * Measured over one 253 s song, 158 recognised words: 27 came back stacked on
 * their chunk's terminal timestamp — 29.98 s past a chunk start, so 169.98,
 * 189.98, 209.98 — and every one was saved as a 1 ms word, which is how the
 * song's whole last third ended up looking detected while carrying no timing
 * at all. A word sharing its start with its neighbour has not been placed.
 */
const stackedTranscriptWords = (
  words: readonly IKaraokeMakerTranscriptWord[],
): ReadonlySet<IKaraokeMakerTranscriptWord> => {
  const byStart = new Map<number, IKaraokeMakerTranscriptWord[]>();
  words.forEach((word) => {
    const shared = byStart.get(word.startMs) ?? [];
    shared.push(word);
    byStart.set(word.startMs, shared);
  });
  return new Set(
    [...byStart.values()].flatMap((shared) => {
      if (shared.every((word) => word.endMs <= word.startMs)) {
        return shared;
      }
      // Whisper quantises to 20 ms, so two fast-sung words can honestly tie on
      // one bin — "gotta go" at 24.50 s with spans of 60 ms and 150 ms is two
      // real words, and dropping both loses highlight sync in exactly the
      // passages that need it. Three or more on one instant is not singing.
      return shared.length >= 3 ? shared : [];
    }),
  );
};

/**
 * The longest a word may last when the voice never stops during it.
 *
 * Deliberately the same nine seconds the syllable ceiling tops out at, because
 * that number exists to refuse a chunk-sized timestamp of twenty to thirty
 * seconds and continuous voicing is no reason to start accepting one. What
 * changes here is only the floor: a one-syllable word was held to 2 500 ms
 * whatever the stem said, and now reaches this when the stem agrees.
 */
const HELD_NOTE_CEILING_MS = 9_000;

/**
 * How long this word may last, given what the stem was doing while it sounded.
 *
 * A span that never crosses a silence is a note somebody is holding; one that
 * does is a timestamp that ran past the end of the phrase. The syllable-count
 * ceiling cannot tell those apart and so refuses both, which is why a
 * phrase-final "Ohhh" lost its timing — a cost the comment on that ceiling
 * calls knowingly paid. It is only unavoidable without the stem.
 */
const wordCeilingMs = (
  word: IKaraokeMakerTranscriptWord,
  rests: readonly { startMs: number; endMs: number }[],
): number =>
  rests.length > 0 &&
  !rests.some((rest) => rest.startMs < word.endMs && rest.endMs > word.startMs)
    ? HELD_NOTE_CEILING_MS
    : maximumAutomaticWordDurationMs(word.text);

export const constrainTranscriptWords = (
  words: readonly IKaraokeMakerTranscriptWord[],
  rests: readonly { startMs: number; endMs: number }[] = [],
): IKaraokeMakerTranscriptWord[] => {
  const stacked = stackedTranscriptWords(words);
  const usable = words.filter((word) => !stacked.has(word));
  let previousEndMs = 0;
  return usable.map((word, index) => {
    const startMs = Math.max(previousEndMs, Math.max(0, word.startMs));
    const nextStartMs = usable[index + 1]?.startMs;
    const plausibleEndMs = Math.min(
      word.endMs,
      startMs + wordCeilingMs(word, rests),
    );
    const unclampedEndMs = Math.max(startMs + 1, plausibleEndMs);
    const endMs =
      nextStartMs !== undefined && nextStartMs > startMs
        ? Math.max(startMs + 1, Math.min(unclampedEndMs, nextStartMs))
        : unclampedEndMs;
    previousEndMs = endMs;
    return { ...word, startMs, endMs };
  });
};

export interface IKaraokeMakerTranscriptPlacement {
  text: string;
  startMs?: number;
  endMs?: number;
}

/**
 * Place the words of a transcript that is becoming the lyrics itself.
 *
 * With no supplied lyrics there is nothing to corroborate a timestamp, so a
 * span that cannot be true is not narrowed into a plausible-looking one — the
 * word keeps its text and loses its timing. Narrowing an over-long span from
 * its start is what put the opening word of a phrase at the tail of the
 * previous one: Whisper starts such a span where the last phrase ended, so the
 * shortened word lands in the instrumental gap and the phrase it opens begins
 * without it. Measured on the same song, three words did exactly that, and one
 * more was placed 13 s past the end of the audio.
 *
 * `constrainAutomaticWordTiming` narrows the same shape deliberately on the
 * alignment path and should keep doing so: there a broken span sits between
 * two matched lyric words that bound it, and here nothing bounds it.
 */
export const placeTranscriptWords = (
  words: readonly IKaraokeMakerTranscriptWord[],
  durationMs: number,
  rests: readonly { startMs: number; endMs: number }[] = [],
): IKaraokeMakerTranscriptPlacement[] => {
  const stacked = stackedTranscriptWords(words);
  const placeable = words.filter(
    (word) =>
      !stacked.has(word) &&
      word.endMs - word.startMs <= wordCeilingMs(word, rests) &&
      (durationMs <= 0 || word.startMs < durationMs),
  );
  // A word that cannot keep a span a syllable could occupy was not placed,
  // whatever produced it. Letting two words honestly share a timestamp bin
  // brought this back: the pair is packed one after the other and the first
  // can be left holding a millisecond, which reads as detected and is not.
  const timings = new Map(
    constrainTranscriptWords(placeable, rests)
      .map((timing, index) => [placeable[index], timing] as const)
      .filter(([, timing]) => timing.endMs - timing.startMs >= 40),
  );
  return words.map((word) => {
    const timing = timings.get(word);
    return timing
      ? { text: word.text, startMs: timing.startMs, endMs: timing.endMs }
      : { text: word.text };
  });
};

export interface IKaraokeMakerAlignmentWord {
  word: IKaraokeMakerToken;
  tokens: IKaraokeMakerToken[];
  lineIndex: number;
}

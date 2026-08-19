/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerTranscriptWord } from './whisperProgress';
import { normalizedWord } from './wordMatching';

export interface IKaraokeMakerRepeat {
  /** Word index where the earlier performance starts. */
  firstIndex: number;
  /** Word index where the later performance starts. */
  secondIndex: number;
  /** How many words the two performances share. */
  length: number;
  /** Total surprisal of the shared run, in nats, against this song's own words. */
  surprisal: number;
}

/**
 * Two performances of the same phrase have to be far enough apart in time to
 * be a structural repeat rather than a stutter or a doubled ad-lib. Measured
 * across the saved library: repeated blocks recur on the order of tens of
 * seconds apart, never within one phrase.
 */
const MINIMUM_SEPARATION_MS = 8_000;

/** Below four words a match is a common collocation, not a hook. */
const MINIMUM_RUN_WORDS = 4;

/**
 * How much a repeated run has to say before it counts as structure.
 *
 * Measured in nats against the song's own unigram distribution rather than in
 * words, because the two are not the same question: "oh oh oh oh oh oh" is six
 * words of almost nothing in a song that says "oh" forty times, while a
 * four-word hook in a song that says each of those words twice is a great deal.
 * A word count would accept the first and reject the second.
 */
const MINIMUM_SURPRISAL_NATS = 12;

/**
 * Where a song repeats itself.
 *
 * Songs have structure — an intro, verses, a chorus that returns, a bridge —
 * but never the same structure twice, and the labels for it are not in the
 * audio. Measured across the saved library: between 0% and 46% of a song's
 * lines recur, one line is sung as many as 22 times, and a song has between
 * zero and four repeated blocks running up to 21 lines each. Nothing about
 * that is fixed enough to name, and all of it is visible in the words alone.
 *
 * So this looks for the repetition itself and never for a section title. What
 * it returns is evidence: a run of words the singer performed more than once,
 * whose edges are phrase boundaries the silence may not have shown, and whose
 * performances should agree with each other in length and in melody.
 */
export const karaokeMakerRepeatedRuns = (
  words: readonly IKaraokeMakerTranscriptWord[],
  minimumSeparationMs: number = MINIMUM_SEPARATION_MS,
): IKaraokeMakerRepeat[] => {
  const normalized = words.map((word) => normalizedWord(word.text));
  const usable = normalized.filter(Boolean).length;
  if (usable < MINIMUM_RUN_WORDS * 2) {
    return [];
  }
  // The song's own vocabulary decides what is surprising in it. A word the
  // singer repeats all night carries almost no information about structure.
  const counts = new Map<string, number>();
  normalized.forEach((word) => {
    if (word) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  });
  const surprisalOf = (word: string): number => {
    const count = counts.get(word) ?? 0;
    return count > 0 ? Math.log(usable / count) : 0;
  };

  const starts = new Map<string, number[]>();
  for (
    let index = 0;
    index + MINIMUM_RUN_WORDS <= normalized.length;
    index += 1
  ) {
    const key = normalized.slice(index, index + MINIMUM_RUN_WORDS).join(' ');
    if (key.trim().length >= MINIMUM_RUN_WORDS) {
      const seen = starts.get(key) ?? [];
      seen.push(index);
      starts.set(key, seen);
    }
  }

  const repeats: IKaraokeMakerRepeat[] = [];
  const claimed = new Set<string>();
  starts.forEach((indexes) => {
    if (indexes.length < 2) {
      return;
    }
    for (let a = 0; a < indexes.length - 1; a += 1) {
      for (let b = a + 1; b < indexes.length; b += 1) {
        const first = indexes[a];
        const second = indexes[b];
        const tooClose =
          words[second].startMs - words[first].startMs < minimumSeparationMs ||
          second - first < MINIMUM_RUN_WORDS;
        // Extend the match as far as the two performances agree, then charge
        // it for what it actually said.
        let length = MINIMUM_RUN_WORDS;
        while (
          first + length < second &&
          second + length < normalized.length &&
          normalized[first + length] !== '' &&
          normalized[first + length] === normalized[second + length]
        ) {
          length += 1;
        }
        const key = `${first}:${second}`;
        const surprisal = normalized
          .slice(first, first + length)
          .reduce((total, word) => total + surprisalOf(word), 0);
        if (
          !tooClose &&
          !claimed.has(key) &&
          surprisal >= MINIMUM_SURPRISAL_NATS
        ) {
          claimed.add(key);
          repeats.push({
            firstIndex: first,
            secondIndex: second,
            length,
            surprisal,
          });
        }
      }
    }
  });

  // Keep the longest run at each starting pair and drop runs wholly inside
  // another, so one chorus reports once rather than once per suffix.
  repeats.sort((left, right) => right.length - left.length);
  const kept: IKaraokeMakerRepeat[] = [];
  repeats.forEach((repeat) => {
    const covered = kept.some(
      (other) =>
        repeat.firstIndex >= other.firstIndex &&
        repeat.firstIndex + repeat.length <= other.firstIndex + other.length &&
        repeat.secondIndex >= other.secondIndex &&
        repeat.secondIndex + repeat.length <= other.secondIndex + other.length,
    );
    if (!covered) {
      kept.push(repeat);
    }
  });
  return kept.sort((left, right) => left.firstIndex - right.firstIndex);
};

/**
 * The word boundaries a song's own repetition argues for.
 *
 * Where a repeated run begins and ends is a phrase edge by construction: the
 * singer started that phrase twice and finished it twice. This is the one line
 * signal that survives a song with no measurable pauses, which is the case that
 * defeated both silence and note gaps — a vocal stem voiced 80% of the time
 * with backing harmony filling every gap the lead left.
 */
export const karaokeMakerRepeatEdgeBreaks = (
  repeats: readonly IKaraokeMakerRepeat[],
  wordCount: number,
): ReadonlySet<number> => {
  const breaks = new Set<number>();
  const add = (index: number) => {
    if (index > 0 && index < wordCount) {
      breaks.add(index);
    }
  };
  repeats.forEach((repeat) => {
    add(repeat.firstIndex);
    add(repeat.firstIndex + repeat.length);
    add(repeat.secondIndex);
    add(repeat.secondIndex + repeat.length);
  });
  return breaks;
};

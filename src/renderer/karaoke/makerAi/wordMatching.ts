/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerToken } from '../../../common/karaoke/makerProject';
import { IKaraokeMakerTranscriptWord } from './whisperProgress';
import { maximumAutomaticWordDurationMs } from './basicPitch';

export const normalizedWord = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

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

export const constrainTranscriptWords = (
  words: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerTranscriptWord[] => {
  let previousEndMs = 0;
  return words.map((word, index) => {
    const startMs = Math.max(previousEndMs, Math.max(0, word.startMs));
    const nextStartMs = words[index + 1]?.startMs;
    const plausibleEndMs = Math.min(
      word.endMs,
      startMs + maximumAutomaticWordDurationMs(word.text),
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

export interface IKaraokeMakerAlignmentWord {
  word: IKaraokeMakerToken;
  tokens: IKaraokeMakerToken[];
  lineIndex: number;
}

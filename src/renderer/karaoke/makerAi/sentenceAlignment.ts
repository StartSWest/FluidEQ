/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  karaokeMakerWordDurationIsPlausible,
} from '../../../common/karaoke/makerProject';
import { IKaraokeMakerTranscriptWord } from './whisperProgress';
import {
  alignWordSequenceAtOccurrence,
  IKaraokeMakerAlignmentWord,
  normalizedWord,
  normalizedWordDistance,
  pruneWeakDirectMappings,
} from './wordMatching';
/** Treat provider/FluidEQ syllable tokens as one readable word for Whisper. */
export const karaokeMakerAlignmentWords = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAlignmentWord[] =>
  project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line, lineIndex) => {
      const groups: IKaraokeMakerToken[][] = [];
      line.tokens.forEach((token) => {
        if (!groups.length || token.startsWord !== false) {
          groups.push([token]);
        } else {
          groups[groups.length - 1].push(token);
        }
      });
      return groups.map((tokens) => {
        const validTokens = tokens.map((token) => {
          const validTiming =
            token.startMs !== undefined &&
            token.endMs !== undefined &&
            karaokeMakerWordDurationIsPlausible(
              token.text,
              token.endMs - token.startMs,
              token.source,
            );
          return validTiming
            ? token
            : {
                ...token,
                startMs: undefined,
                endMs: undefined,
                confidence: undefined,
                timingLocked: undefined,
              };
        });
        const timed = validTokens.filter(
          (token) => token.startMs !== undefined && token.endMs !== undefined,
        );
        const first = validTokens[0];
        return {
          tokens: validTokens,
          lineIndex,
          word: {
            ...first,
            text: tokens.map((token) => token.text).join(''),
            startMs: timed.length
              ? Math.min(...timed.map((token) => token.startMs as number))
              : undefined,
            endMs: timed.length
              ? Math.max(...timed.map((token) => token.endMs as number))
              : undefined,
            timingLocked:
              validTokens.some((token) => token.timingLocked) || undefined,
          },
        };
      });
    });

interface IKaraokeMakerSentenceCandidate {
  mapping: Map<string, IKaraokeMakerTranscriptWord>;
  endMs: number;
  mappedWords: number;
  score: number;
  startMs: number;
}

/**
 * Whisper often drops short sung words even when it recognises the surrounding
 * sentence. Once both sentence edges and enough interior words are confirmed,
 * keep the supplied lyrics authoritative and place only the missing interior
 * words inside that same continuous vocal phrase. Weak/partial matches are left
 * untouched so they cannot paint a whole verse over music.
 */
export const fillConfirmedSentenceGaps = (
  lyrics: readonly IKaraokeMakerToken[],
  phrase: readonly IKaraokeMakerTranscriptWord[],
  directMapping: ReadonlyMap<string, IKaraokeMakerTranscriptWord>,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const result = new Map(directMapping);
  if (lyrics.length < 3) {
    return result;
  }
  const phraseIndexes = new Map(
    phrase.map((word, index) => [word, index] as const),
  );
  const anchors = lyrics.flatMap((lyric, lyricIndex) => {
    const timing = directMapping.get(lyric.id);
    const phraseIndex = timing ? phraseIndexes.get(timing) : undefined;
    return timing && phraseIndex !== undefined
      ? [{ lyric, lyricIndex, phraseIndex, timing }]
      : [];
  });
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  const requiredEvidence = Math.max(3, Math.ceil(lyrics.length * 0.55));
  const hasExactEdges =
    first?.lyricIndex === 0 &&
    last?.lyricIndex === lyrics.length - 1 &&
    normalizedWordDistance(
      normalizedWord(first.lyric.text),
      normalizedWord(first.timing.text),
    ) === 0 &&
    normalizedWordDistance(
      normalizedWord(last.lyric.text),
      normalizedWord(last.timing.text),
    ) === 0;
  if (!hasExactEdges || anchors.length < requiredEvidence) {
    return result;
  }

  anchors.slice(1).forEach((right, anchorIndex) => {
    const left = anchors[anchorIndex];
    const missingLyrics = lyrics.slice(left.lyricIndex + 1, right.lyricIndex);
    if (!missingLyrics.length) {
      return;
    }
    const availableStartMs = left.timing.endMs;
    const availableEndMs = right.timing.startMs;
    const availableDurationMs = availableEndMs - availableStartMs;
    if (
      availableDurationMs < missingLyrics.length * 25 ||
      availableDurationMs > Math.max(2_500, missingLyrics.length * 1_200)
    ) {
      return;
    }
    const recognizedBetween = phrase.slice(
      left.phraseIndex + 1,
      right.phraseIndex,
    );
    if (recognizedBetween.length >= missingLyrics.length) {
      missingLyrics.forEach((lyric, missingIndex) => {
        const groupStart = Math.floor(
          (missingIndex * recognizedBetween.length) / missingLyrics.length,
        );
        const groupEnd = Math.max(
          groupStart + 1,
          Math.floor(
            ((missingIndex + 1) * recognizedBetween.length) /
              missingLyrics.length,
          ),
        );
        const words = recognizedBetween.slice(groupStart, groupEnd);
        result.set(lyric.id, {
          text: lyric.text,
          startMs: words[0].startMs,
          endMs: words[words.length - 1].endMs,
          inferred: true,
        });
      });
      return;
    }

    const weights = missingLyrics.map((lyric) =>
      Math.max(1, Array.from(normalizedWord(lyric.text)).length),
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let consumedWeight = 0;
    missingLyrics.forEach((lyric, missingIndex) => {
      const startMs =
        availableStartMs + (availableDurationMs * consumedWeight) / totalWeight;
      consumedWeight += weights[missingIndex];
      const endMs =
        availableStartMs + (availableDurationMs * consumedWeight) / totalWeight;
      result.set(lyric.id, {
        text: lyric.text,
        startMs,
        endMs,
        inferred: true,
      });
    });
  });
  return result;
};

const sentenceCandidatesForPass = (
  line: readonly IKaraokeMakerAlignmentWord[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerSentenceCandidate[] => {
  const lyrics = line.map((group) => group.word);
  const transcriptIndexes = new Map(
    transcript.map((word, index) => [word, index] as const),
  );
  const candidates: IKaraokeMakerSentenceCandidate[] = [];
  const maximumWords = Math.max(
    lyrics.length + 6,
    Math.ceil(lyrics.length * 1.8),
  );
  const maximumSpanMs = Math.max(12_000, lyrics.length * 1_500);
  // A sung attack is the least reliable part of a line: Whisper frequently
  // drops the first few words under accompaniment. Search the complete lyric
  // sentence for an exact anchor, then require multi-word local evidence and
  // let the song-wide monotonic route decide which repeated performance wins.
  const anchorCount = lyrics.length;

  for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
    const anchor = normalizedWord(lyrics[anchorIndex].text);
    // A token that normalises to nothing — a dash, an ellipsis, a lone "♪" —
    // is not an anchor, but it is also not a reason to stop looking. This
    // abandoned the whole line on the first such token, so a sheet written
    // with dialogue dashes ("— I never told you") produced no candidates for
    // any line beginning with one, and no timing at all.
    transcript.forEach((word, transcriptIndex) => {
      if (!anchor) {
        return;
      }
      const anchorDistance = normalizedWordDistance(
        anchor,
        normalizedWord(word.text),
      );
      if (
        anchorDistance !== 0 &&
        !(line[anchorIndex].tokens.length > 1 && anchorDistance <= 1)
      ) {
        return;
      }
      let phraseStart = transcriptIndex;
      const desiredPrefix = anchorIndex + 2;
      while (
        phraseStart > 0 &&
        transcriptIndex - phraseStart < desiredPrefix &&
        transcript[phraseStart].startMs - transcript[phraseStart - 1].endMs <=
          2_500
      ) {
        phraseStart -= 1;
      }
      let phraseEnd = transcriptIndex + 1;
      // Keep this candidate close to its anchor. In particular, do not let a
      // phrase beginning at the first performance consume the complete next
      // performance of the same lyric line.
      const localPhraseEnd = Math.min(
        transcript.length,
        transcriptIndex + (lyrics.length - anchorIndex) + 3,
      );
      while (
        phraseEnd < localPhraseEnd &&
        phraseEnd - phraseStart < maximumWords &&
        transcript[phraseEnd].startMs - transcript[phraseEnd - 1].endMs <=
          2_500 &&
        transcript[phraseEnd].endMs - transcript[phraseStart].startMs <=
          maximumSpanMs
      ) {
        phraseEnd += 1;
      }
      const phrase = transcript.slice(phraseStart, phraseEnd);
      const candidateMapping = pruneWeakDirectMappings(
        lyrics,
        phrase,
        alignWordSequenceAtOccurrence(
          lyrics,
          phrase,
          anchorIndex,
          transcriptIndex - phraseStart,
        ),
      );
      const mappedAnchor = candidateMapping.get(lyrics[anchorIndex].id);
      if (mappedAnchor !== word) {
        return;
      }
      const pairs = lyrics.flatMap((lyric, lyricIndex) => {
        const timing = candidateMapping.get(lyric.id);
        const matchedIndex = timing ? transcriptIndexes.get(timing) : undefined;
        return timing && matchedIndex !== undefined
          ? [{ lyric, lyricIndex, timing, transcriptIndex: matchedIndex }]
          : [];
      });
      const minimumEvidence =
        lyrics.length === 1 ? 1 : Math.max(2, Math.ceil(lyrics.length * 0.32));
      if (pairs.length < minimumEvidence) {
        return;
      }
      const exactMatches = pairs.filter(
        ({ lyric, timing }) =>
          normalizedWordDistance(
            normalizedWord(lyric.text),
            normalizedWord(timing.text),
          ) === 0,
      ).length;
      const first = pairs[0];
      const last = pairs[pairs.length - 1];
      const coverage = pairs.length / lyrics.length;
      const edgeSupport =
        Number(first.lyricIndex === 0) +
        Number(last.lyricIndex === lyrics.length - 1);
      // This bonus is large enough to beat two correctly matched words — on a
      // four-word line it reaches 2 600 against the 1 000 a word is worth — and
      // that is deliberate, though it reads like a bug. It is what stops a line
      // being finished by a matching phrase half a minute away: with the bonus
      // scaled down to 400, "She lives a lonely life" abandons its own opening
      // at 11 s to take "a lonely life" from 45 s, because three late words
      // outscore two early ones.
      //
      // The cost is real too: a candidate mapping a line's first two words
      // outranks one mapping its last three. Both failures come from scoring
      // candidates independently, and the fix for both is to compare the
      // performances of a repeated line against each other — a line sung four
      // times should not have one performance a third the length of its
      // siblings. Until that exists, keep the protection that is tested.
      const sentenceStartSupport =
        first.lyricIndex === 0 ? Math.max(1_500, lyrics.length * 650) : 0;
      candidates.push({
        mapping: fillConfirmedSentenceGaps(lyrics, phrase, candidateMapping),
        startMs: first.timing.startMs,
        endMs: last.timing.endMs,
        mappedWords: pairs.length,
        score:
          pairs.length * 1_000 +
          exactMatches * 80 +
          coverage * 100 +
          edgeSupport * 20 +
          sentenceStartSupport,
      });
    });
  }

  const deduplicated = new Map<string, IKaraokeMakerSentenceCandidate>();
  candidates.forEach((candidate) => {
    const key = `${Math.round(candidate.startMs / 120)}:${Math.round(
      candidate.endMs / 120,
    )}`;
    const prior = deduplicated.get(key);
    if (!prior || candidate.score > prior.score) {
      deduplicated.set(key, candidate);
    }
  });
  const uniqueCandidates = [...deduplicated.values()];
  return uniqueCandidates.sort(
    (left, right) => left.startMs - right.startMs || right.score - left.score,
  );
};

/**
 * Build one monotonic route through all lyric sentences. Each sentence uses a
 * single continuous Whisper phrase, but the route is solved across the whole
 * song so repeated verses take distinct chronological performances instead of
 * a greedy early choice shifting every later line.
 */
export const alignLyricsBySentence = (
  groups: readonly IKaraokeMakerAlignmentWord[],
  transcripts: readonly (readonly IKaraokeMakerTranscriptWord[])[],
): Map<string, IKaraokeMakerTranscriptWord> => {
  const lineGroups = new Map<number, IKaraokeMakerAlignmentWord[]>();
  groups.forEach((group) => {
    const values = lineGroups.get(group.lineIndex) ?? [];
    values.push(group);
    lineGroups.set(group.lineIndex, values);
  });
  const lines = [...lineGroups.values()];
  interface IRouteNode {
    candidate: IKaraokeMakerSentenceCandidate;
    coveredLines: number;
    lineIndex: number;
    previous?: IRouteNode;
    score: number;
  }
  const compareRoutes = (left: IRouteNode, right: IRouteNode): number =>
    right.coveredLines - left.coveredLines ||
    right.score - left.score ||
    left.candidate.startMs - right.candidate.startMs;
  const priorNodes: IRouteNode[] = [];
  /**
   * Nodes from lines already solved, kept sorted by the time they end.
   *
   * The predecessor search used to filter and sort every node accumulated so
   * far, for every candidate of every line. On an ordinary forty-line song
   * that is a thousand nodes and finishes instantly, which is why it was never
   * noticed; on a song that repeats one short line a hundred times each line
   * produces hundreds of candidates, the total passes sixty thousand nodes,
   * and the work becomes quadratic — several seconds to minutes, synchronously
   * on the renderer thread, after the progress bar has already said complete.
   * Sorted once per line and searched by bisection, the same answer costs a
   * logarithmic lookup.
   */
  const settled: IRouteNode[] = [];
  /** Best route among all settled nodes ending at or before each position. */
  const bestUpTo: IRouteNode[] = [];
  const settle = (nodes: readonly IRouteNode[]) => {
    settled.push(...nodes);
    settled.sort((left, right) => left.candidate.endMs - right.candidate.endMs);
    bestUpTo.length = 0;
    settled.forEach((node, index) => {
      const carried = bestUpTo[index - 1];
      bestUpTo.push(
        carried && compareRoutes(carried, node) <= 0 ? carried : node,
      );
    });
  };
  lines.forEach((line, lineIndex) => {
    const candidates = transcripts.flatMap((transcript) =>
      sentenceCandidatesForPass(line, transcript),
    );
    const added = candidates.map((candidate) => {
      // Rightmost settled node ending no later than this candidate starts.
      const limit = candidate.startMs + 40;
      let low = 0;
      let high = settled.length - 1;
      let found = -1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (settled[middle].candidate.endMs <= limit) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      const previous = found >= 0 ? bestUpTo[found] : undefined;
      return {
        candidate,
        coveredLines: (previous?.coveredLines ?? 0) + 1,
        lineIndex,
        previous,
        score: candidate.score + (previous?.score ?? 0),
      };
    });
    priorNodes.push(...added);
    settle(added);
  });
  const mapping = new Map<string, IKaraokeMakerTranscriptWord>();
  let node: IRouteNode | undefined = priorNodes.sort(compareRoutes)[0];
  while (node) {
    node.candidate.mapping.forEach((timing, tokenId) =>
      mapping.set(tokenId, timing),
    );
    node = node.previous;
  }
  return mapping;
};

/** Whisper occasionally returns a sung word as two adjacent fragments. */
export const mergeTranscriptFragmentsForLyrics = (
  lyrics: readonly IKaraokeMakerToken[],
  transcript: readonly IKaraokeMakerTranscriptWord[],
): IKaraokeMakerTranscriptWord[] => {
  const lyricWords = new Set(lyrics.map((token) => normalizedWord(token.text)));
  const merged: IKaraokeMakerTranscriptWord[] = [];
  for (let index = 0; index < transcript.length; index += 1) {
    let take = 1;
    for (
      let candidateCount = Math.min(4, transcript.length - index);
      candidateCount >= 2;
      candidateCount -= 1
    ) {
      const candidate = transcript
        .slice(index, index + candidateCount)
        .map((word) => normalizedWord(word.text))
        .join('');
      const candidateWords = transcript.slice(index, index + candidateCount);
      const hasLargeGap = candidateWords.some(
        (word, wordIndex) =>
          wordIndex > 0 &&
          word.startMs - candidateWords[wordIndex - 1].endMs > 350,
      );
      if (!hasLargeGap && lyricWords.has(candidate)) {
        take = candidateCount;
        break;
      }
    }
    const words = transcript.slice(index, index + take);
    merged.push({
      text: words.map((word) => word.text).join(''),
      startMs: words[0].startMs,
      endMs: words[words.length - 1].endMs,
    });
    index += take - 1;
  }
  return merged;
};

export const distributeAlignmentWordTiming = (
  group: IKaraokeMakerAlignmentWord,
  timing: IKaraokeMakerTranscriptWord,
): Map<string, IKaraokeMakerTranscriptWord> => {
  const distributed = new Map<string, IKaraokeMakerTranscriptWord>();
  if (group.tokens.length === 1) {
    distributed.set(group.tokens[0].id, timing);
    return distributed;
  }
  const existingDurations = group.tokens.map((token) =>
    token.startMs !== undefined && token.endMs !== undefined
      ? Math.max(1, token.endMs - token.startMs)
      : 0,
  );
  const usesExistingRatio = existingDurations.every((duration) => duration > 0);
  const weights = usesExistingRatio
    ? existingDurations
    : group.tokens.map((token) =>
        Math.max(1, Array.from(normalizedWord(token.text)).length),
      );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let consumed = 0;
  group.tokens.forEach((token, index) => {
    const startMs =
      timing.startMs +
      ((timing.endMs - timing.startMs) * consumed) / totalWeight;
    consumed += weights[index];
    const endMs =
      timing.startMs +
      ((timing.endMs - timing.startMs) * consumed) / totalWeight;
    distributed.set(token.id, {
      text: token.text,
      startMs,
      endMs: Math.max(startMs + 1, endMs),
      inferred: timing.inferred,
    });
  });
  return distributed;
};

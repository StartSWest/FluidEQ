/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  makerLinesFromPlainText,
  synchronizeKaraokeMakerSections,
} from '../../common/karaoke/makerProject';
import { normalizedWord } from './makerAi/wordMatching';

interface IExistingWord {
  tokens: IKaraokeMakerToken[];
  lineId: string;
  key: string;
}

interface INewWord {
  token: IKaraokeMakerToken;
  lineIndex: number;
  tokenIndex: number;
  key: string;
}

export interface IKaraokeMakerLyricsReconciliation {
  project: IKaraokeMakerProject;
  existingWordCount: number;
  nextWordCount: number;
  preservedWordCount: number;
  untimedWordCount: number;
}

const wordKey = (value: string): string => {
  const normalized = normalizedWord(value);
  return normalized || `raw:${value.trim().toLocaleLowerCase()}`;
};

const wordsInLine = (line: IKaraokeMakerLine): IKaraokeMakerToken[][] => {
  const words: IKaraokeMakerToken[][] = [];
  line.tokens.forEach((token) => {
    if (token.startsWord !== false || !words.length) {
      words.push([token]);
    } else {
      words[words.length - 1].push(token);
    }
  });
  return words;
};

const distributeEditedText = (
  tokens: readonly IKaraokeMakerToken[],
  text: string,
): IKaraokeMakerToken[] => {
  if (tokens.length === 1) {
    return [{ ...tokens[0], text, startsWord: true }];
  }
  const characters = Array.from(text);
  const weights = tokens.map((token) =>
    Math.max(1, Array.from(token.text).length),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let consumedWeight = 0;
  let characterIndex = 0;
  return tokens.map((token, index) => {
    consumedWeight += weights[index];
    const remainingTokens = tokens.length - index - 1;
    const proportionalEnd = Math.round(
      (characters.length * consumedWeight) / totalWeight,
    );
    const minimumEnd =
      characters.length - characterIndex >= remainingTokens + 1
        ? characterIndex + 1
        : characterIndex;
    const maximumEnd = Math.max(
      characterIndex,
      characters.length - remainingTokens,
    );
    const end =
      index === tokens.length - 1
        ? characters.length
        : Math.max(minimumEnd, Math.min(maximumEnd, proportionalEnd));
    const nextText = characters.slice(characterIndex, end).join('');
    characterIndex = end;
    return {
      ...token,
      text: nextText,
      startsWord: index === 0,
    };
  });
};

/**
 * Match equal words while allowing insertions, deletions and line-break edits.
 *
 * Most lyric edits touch only a handful of words, so an exact LCS gives stable
 * duplicate handling. The bounded fallback prevents a pasted pathological
 * document from allocating a matrix proportional to the whole document.
 */
const alignedWordIndexes = (
  existing: readonly IExistingWord[],
  next: readonly INewWord[],
): Map<number, number> => {
  const aligned = new Map<number, number>();
  let prefix = 0;
  while (
    prefix < existing.length &&
    prefix < next.length &&
    existing[prefix].key === next[prefix].key
  ) {
    aligned.set(prefix, prefix);
    prefix += 1;
  }

  let existingEnd = existing.length;
  let nextEnd = next.length;
  while (
    existingEnd > prefix &&
    nextEnd > prefix &&
    existing[existingEnd - 1].key === next[nextEnd - 1].key
  ) {
    existingEnd -= 1;
    nextEnd -= 1;
    aligned.set(nextEnd, existingEnd);
  }

  const existingCount = existingEnd - prefix;
  const nextCount = nextEnd - prefix;
  if (!existingCount || !nextCount) {
    return aligned;
  }

  if (existingCount * nextCount <= 4_000_000) {
    const width = nextCount + 1;
    const directions = new Uint8Array((existingCount + 1) * width);
    let previous = new Uint32Array(width);
    let current = new Uint32Array(width);
    for (let row = 1; row <= existingCount; row += 1) {
      for (let column = 1; column <= nextCount; column += 1) {
        const diagonal =
          existing[prefix + row - 1].key === next[prefix + column - 1].key
            ? previous[column - 1] + 1
            : -1;
        if (diagonal > previous[column] && diagonal > current[column - 1]) {
          current[column] = diagonal;
          directions[row * width + column] = 1;
        } else if (previous[column] >= current[column - 1]) {
          current[column] = previous[column];
          directions[row * width + column] = 2;
        } else {
          current[column] = current[column - 1];
          directions[row * width + column] = 3;
        }
      }
      [previous, current] = [current, previous];
      current.fill(0);
    }
    let row = existingCount;
    let column = nextCount;
    while (row > 0 && column > 0) {
      const direction = directions[row * width + column];
      if (direction === 1) {
        aligned.set(prefix + column - 1, prefix + row - 1);
        row -= 1;
        column -= 1;
      } else if (direction === 2) {
        row -= 1;
      } else {
        column -= 1;
      }
    }
    return aligned;
  }

  const positions = new Map<string, number[]>();
  for (let index = prefix; index < existingEnd; index += 1) {
    const matches = positions.get(existing[index].key) ?? [];
    matches.push(index);
    positions.set(existing[index].key, matches);
  }
  let existingCursor = prefix;
  const positionCursors = new Map<string, number>();
  for (let nextIndex = prefix; nextIndex < nextEnd; nextIndex += 1) {
    const { key } = next[nextIndex];
    const matches = positions.get(key);
    let matchCursor = positionCursors.get(key) ?? 0;
    while (
      matches &&
      matchCursor < matches.length &&
      matches[matchCursor] < existingCursor
    ) {
      matchCursor += 1;
    }
    const existingIndex = matches?.[matchCursor];
    if (existingIndex !== undefined) {
      aligned.set(nextIndex, existingIndex);
      existingCursor = existingIndex + 1;
      positionCursors.set(key, matchCursor + 1);
    }
  }
  return aligned;
};

const withTokenRange = (line: IKaraokeMakerLine): IKaraokeMakerLine => {
  const timed = line.tokens.filter(
    (token) => token.startMs !== undefined && token.endMs !== undefined,
  );
  return {
    ...line,
    startMs: timed.length
      ? Math.min(...timed.map((token) => token.startMs as number))
      : undefined,
    endMs: timed.length
      ? Math.max(...timed.map((token) => token.endMs as number))
      : undefined,
  };
};

/**
 * Apply edited plain lyrics without throwing away the timeline.
 *
 * Equal words keep their complete token groups, IDs, timing and note links even
 * when a line break moves. Only added or changed words receive fresh untimed
 * tokens. Notes belonging to deleted words remain as melody evidence but are
 * detached from the lyric token that no longer exists.
 */
export const reconcileKaraokeMakerLyrics = (
  project: IKaraokeMakerProject,
  text: string,
): IKaraokeMakerLyricsReconciliation => {
  const built = makerLinesFromPlainText(text);
  const existing = project.lyrics.lines.flatMap((line): IExistingWord[] =>
    karaokeMakerLineIsSection(line)
      ? []
      : wordsInLine(line).map((tokens) => ({
          tokens,
          lineId: line.id,
          key: wordKey(tokens.map((token) => token.text).join('')),
        })),
  );
  const next = built.flatMap((line, lineIndex): INewWord[] =>
    karaokeMakerLineIsSection(line)
      ? []
      : line.tokens.map((token, tokenIndex) => ({
          token,
          lineIndex,
          tokenIndex,
          key: wordKey(token.text),
        })),
  );
  const alignment = alignedWordIndexes(existing, next);
  const nextWordIndex = new Map(
    next.map((word, index) => [`${word.lineIndex}:${word.tokenIndex}`, index]),
  );
  const reusedTokenIds = new Set<string>();
  const usedLineIds = new Set<string>();
  const oldSections = project.lyrics.lines.filter(karaokeMakerLineIsSection);
  const usedSectionIds = new Set<string>();

  const lines = built.map((line, lineIndex) => {
    if (karaokeMakerLineIsSection(line)) {
      const key = wordKey(line.tokens.map((token) => token.text).join(''));
      const matched = oldSections.find(
        (candidate) =>
          !usedSectionIds.has(candidate.id) &&
          wordKey(candidate.tokens.map((token) => token.text).join('')) === key,
      );
      if (matched) {
        usedSectionIds.add(matched.id);
        return { ...line, id: matched.id };
      }
      return line;
    }

    const oldLineVotes = new Map<string, { count: number; first: number }>();
    const tokens = line.tokens.flatMap((token, tokenIndex) => {
      const newIndex = nextWordIndex.get(`${lineIndex}:${tokenIndex}`);
      const existingIndex =
        newIndex === undefined ? undefined : alignment.get(newIndex);
      const matched =
        existingIndex === undefined ? undefined : existing[existingIndex];
      if (!matched) {
        return [token];
      }
      const vote = oldLineVotes.get(matched.lineId);
      oldLineVotes.set(matched.lineId, {
        count: (vote?.count ?? 0) + 1,
        first: vote?.first ?? tokenIndex,
      });
      matched.tokens.forEach((candidate) => reusedTokenIds.add(candidate.id));
      return distributeEditedText(matched.tokens, token.text);
    });
    const lineId = [...oldLineVotes.entries()]
      .filter(([candidate]) => !usedLineIds.has(candidate))
      .sort(
        ([, left], [, right]) =>
          right.count - left.count || left.first - right.first,
      )[0]?.[0];
    if (lineId) {
      usedLineIds.add(lineId);
    }
    return withTokenRange({ ...line, id: lineId ?? line.id, tokens });
  });

  const nextProject = synchronizeKaraokeMakerSections({
    ...project,
    lyrics: { ...project.lyrics, source: 'manual', lines },
    melody: {
      ...project.melody,
      notes: project.melody.notes.map((note) =>
        note.tokenId && !reusedTokenIds.has(note.tokenId)
          ? { ...note, tokenId: undefined }
          : note,
      ),
    },
  });
  return {
    project: nextProject,
    existingWordCount: existing.length,
    nextWordCount: next.length,
    preservedWordCount: alignment.size,
    untimedWordCount: lines
      .filter((line) => !karaokeMakerLineIsSection(line))
      .flatMap((line) => line.tokens)
      .filter(
        (token) => token.startMs === undefined || token.endMs === undefined,
      ).length,
  };
};

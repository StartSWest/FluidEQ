/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * Splitting one sung word into the parts a singer actually lands on.
 *
 * Separate from `model` because it is the only place that cares how a word is
 * spelled rather than when it is sung, and separate from `boundaries` because
 * splitting a word invents new tokens where dragging an edge only moves
 * existing ones.
 */
import { splitKaraokeWordSyllables } from '../syllables';
import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerId,
  karaokeMakerLineIsSection,
} from './model';

const karaokeMakerTextWeight = (text: string): number =>
  Math.max(1, Array.from(text).filter((character) => character.trim()).length);

/**
 * Turn one readable word into editable sung syllables. The first token keeps
 * its identity so selections and imported references remain stable. Melody
 * notes linked to the word are cut at the same boundaries and linked to the
 * resulting syllable token, so no note can silently span two syllables.
 */
const splitKaraokeMakerWordIntoSyllables = (
  project: IKaraokeMakerProject,
  tokenId: string,
  language: string | undefined,
  requestedSyllables?: readonly string[],
): IKaraokeMakerProject => {
  const lineIndex = project.lyrics.lines.findIndex(
    (line) =>
      !karaokeMakerLineIsSection(line) &&
      line.tokens.some((token) => token.id === tokenId),
  );
  if (lineIndex < 0) {
    return project;
  }
  const line = project.lyrics.lines[lineIndex];
  const selectedIndex = line.tokens.findIndex((token) => token.id === tokenId);
  let wordStartIndex = selectedIndex;
  while (
    wordStartIndex > 0 &&
    line.tokens[wordStartIndex].startsWord === false
  ) {
    wordStartIndex -= 1;
  }
  let wordEndIndex = wordStartIndex + 1;
  while (
    wordEndIndex < line.tokens.length &&
    line.tokens[wordEndIndex].startsWord === false
  ) {
    wordEndIndex += 1;
  }
  const oldTokens = line.tokens.slice(wordStartIndex, wordEndIndex);
  const wordText = oldTokens.map((token) => token.text).join('');
  const manualSyllables =
    requestedSyllables &&
    requestedSyllables.length > 1 &&
    requestedSyllables.every((syllable) => syllable.length > 0) &&
    requestedSyllables.join('') === wordText
      ? [...requestedSyllables]
      : undefined;
  const syllables =
    manualSyllables ??
    splitKaraokeWordSyllables(
      wordText,
      language ?? project.lyrics.language ?? 'en',
    );
  if (syllables.length <= 1) {
    return project;
  }
  if (
    oldTokens.length === syllables.length &&
    oldTokens.every((token, index) => token.text === syllables[index])
  ) {
    return project;
  }

  const timedStarts = oldTokens.flatMap((token) =>
    token.startMs === undefined ? [] : [token.startMs],
  );
  const timedEnds = oldTokens.flatMap((token) =>
    token.endMs === undefined ? [] : [token.endMs],
  );
  const wordStartMs = timedStarts.length ? Math.min(...timedStarts) : undefined;
  const wordEndMs = timedEnds.length ? Math.max(...timedEnds) : undefined;
  const hasTiming =
    wordStartMs !== undefined &&
    wordEndMs !== undefined &&
    wordEndMs > wordStartMs;
  const totalWeight = syllables.reduce(
    (sum, syllable) => sum + karaokeMakerTextWeight(syllable),
    0,
  );
  let consumedWeight = 0;
  const newTokens = syllables.map((syllable, index): IKaraokeMakerToken => {
    const startProgress = consumedWeight / totalWeight;
    consumedWeight += karaokeMakerTextWeight(syllable);
    const endProgress = consumedWeight / totalWeight;
    const startMs = hasTiming
      ? Math.round(
          (wordStartMs as number) +
            ((wordEndMs as number) - (wordStartMs as number)) * startProgress,
        )
      : undefined;
    let endMs: number | undefined;
    if (hasTiming) {
      endMs =
        index === syllables.length - 1
          ? wordEndMs
          : Math.round(
              (wordStartMs as number) +
                ((wordEndMs as number) - (wordStartMs as number)) * endProgress,
            );
    }
    return {
      ...oldTokens[Math.min(index, oldTokens.length - 1)],
      id: index === 0 ? oldTokens[0].id : karaokeMakerId('word'),
      text: syllable,
      startsWord: index === 0,
      startMs,
      endMs,
      source: 'manual',
      timingLocked: hasTiming ? true : oldTokens[0].timingLocked,
    };
  });
  const oldTokenIds = new Set(oldTokens.map((token) => token.id));
  const linkedNotes = project.melody.notes.filter(
    (note) => note.tokenId && oldTokenIds.has(note.tokenId),
  );
  const linkedNoteIds = new Set(linkedNotes.map((note) => note.id));
  const splitLinkedNotes = linkedNotes.flatMap((note): IKaraokeMakerNote[] => {
    if (!hasTiming) {
      const tokenIndex = Math.max(
        0,
        Math.min(
          newTokens.length - 1,
          Math.floor(
            (linkedNotes.indexOf(note) / Math.max(1, linkedNotes.length)) *
              newTokens.length,
          ),
        ),
      );
      return [{ ...note, tokenId: newTokens[tokenIndex].id, source: 'manual' }];
    }
    const intersections = newTokens.flatMap((token) => {
      const startMs = Math.max(note.startMs, token.startMs as number);
      const endMs = Math.min(note.endMs, token.endMs as number);
      return endMs > startMs ? [{ token, startMs, endMs }] : [];
    });
    if (!intersections.length) {
      const midpoint = (note.startMs + note.endMs) / 2;
      const closest = newTokens.reduce((best, token) => {
        const center =
          ((token.startMs as number) + (token.endMs as number)) / 2;
        const bestCenter =
          ((best.startMs as number) + (best.endMs as number)) / 2;
        return Math.abs(center - midpoint) < Math.abs(bestCenter - midpoint)
          ? token
          : best;
      });
      return [{ ...note, tokenId: closest.id, source: 'manual' }];
    }
    return intersections.map(({ token, startMs, endMs }, index) => ({
      ...note,
      id: index === 0 ? note.id : karaokeMakerId('note'),
      tokenId: token.id,
      startMs,
      endMs,
      source: 'manual' as const,
    }));
  });

  const nextLine = {
    ...line,
    tokens: [
      ...line.tokens.slice(0, wordStartIndex),
      ...newTokens,
      ...line.tokens.slice(wordEndIndex),
    ],
  };
  return {
    ...project,
    lyrics: {
      ...project.lyrics,
      source: 'manual',
      lines: project.lyrics.lines.map((candidate, index) =>
        index === lineIndex ? nextLine : candidate,
      ),
    },
    melody: {
      ...project.melody,
      source: linkedNotes.length ? 'manual' : project.melody.source,
      notes: [
        ...project.melody.notes.filter((note) => !linkedNoteIds.has(note.id)),
        ...splitLinkedNotes,
      ].sort((left, right) => left.startMs - right.startMs),
    },
  };
};

export default splitKaraokeMakerWordIntoSyllables;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What both export writers need and neither owns.
 *
 * Small on purpose: the LRC writer and the UltraStar writer have almost
 * nothing in common, and the little they do share is the definition of a word,
 * which has to mean the same thing in both or the "left out" counts they
 * report to the user would not be comparable.
 */
import { IKaraokeMakerLine, IKaraokeMakerToken } from './makerProject';

/** A written file and what it could not carry. */
export interface IWrittenKaraokeFile {
  contents: string;
  droppedLines: number;
  droppedWords: number;
}

/**
 * Words, which is not the same as tokens in either direction.
 *
 * A line imported from plain LRC arrives as ONE token holding the whole
 * sentence, so `tokens.length` reported `droppedWords: 1` for a line of nine;
 * a line the Maker has split into syllables counts the other way and would
 * have reported four for two words. Rebuilding the text with the `startsWord`
 * rule and counting its whitespace runs is the only measure true of both.
 */
export const countWords = (tokens: readonly IKaraokeMakerToken[]): number =>
  tokens
    .map((token) => `${token.startsWord ? ' ' : ''}${token.text}`)
    .join('')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

/** One entry per word: the token that starts it and any syllables after it. */
export const wordTokenGroups = (
  line: IKaraokeMakerLine,
): IKaraokeMakerToken[][] =>
  line.tokens.reduce<IKaraokeMakerToken[][]>((groups, token) => {
    const current = groups[groups.length - 1];
    if (!current || token.startsWord) {
      groups.push([token]);
    } else {
      current.push(token);
    }
    return groups;
  }, []);

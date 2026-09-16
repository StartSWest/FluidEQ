/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The listening test that picks a head: five pairs, a winner.
 *
 * Three heads ship, and no anthropometry is asked for: the listener hears
 * the same sound through two heads and says which one sounds more around
 * them. Three pairs cover every pairing of the three heads; the fourth and
 * fifth replay the two heads that have won most, so a coin-flip answer on
 * one pair does not decide it. "They sound the same" counts for neither.
 */

import { ROOM_HEADS, TRoomHead } from '../../common/dsp/chain';

export type TFitAnswer = 'a' | 'b' | 'same';

export interface IFitPair {
  a: TRoomHead;
  b: TRoomHead;
}

export const FIT_PAIRS = 5;

const OPENING: IFitPair[] = [
  { a: 'small', b: 'medium' },
  { a: 'medium', b: 'large' },
  { a: 'small', b: 'large' },
];

export const tallyOf = (
  pairs: readonly IFitPair[],
  answers: readonly TFitAnswer[],
): Record<TRoomHead, number> => {
  const tally: Record<TRoomHead, number> = { small: 0, medium: 0, large: 0 };
  answers.forEach((answer, at) => {
    const pair = pairs[at];
    if (!pair || answer === 'same') {
      return;
    }
    tally[answer === 'a' ? pair.a : pair.b] += 1;
  });
  return tally;
};

/** The heads in order of wins, ties broken towards the medium head. */
const ranked = (tally: Record<TRoomHead, number>): TRoomHead[] =>
  [...ROOM_HEADS].sort((left, right) => {
    if (tally[right] !== tally[left]) {
      return tally[right] - tally[left];
    }
    if (left === 'medium') {
      return -1;
    }
    return right === 'medium' ? 1 : 0;
  });

/**
 * The pair to play next, from what has been answered so far, or undefined
 * when five have been.
 */
export const nextPair = (
  answers: readonly TFitAnswer[],
): IFitPair | undefined => {
  const at = answers.length;
  if (at >= FIT_PAIRS) {
    return undefined;
  }
  if (at < OPENING.length) {
    return OPENING[at];
  }
  const [first, second] = ranked(tallyOf(pairsSoFar(answers), answers));
  // The later pairs swap sides, so a listener who always presses A does
  // not hand the same head every win.
  return at % 2 === 0 ? { a: first, b: second } : { a: second, b: first };
};

/** Every pair that was played for these answers, in order. */
export const pairsSoFar = (answers: readonly TFitAnswer[]): IFitPair[] => {
  const pairs: IFitPair[] = [];
  for (let at = 0; at < answers.length; at += 1) {
    const pair = nextPair(answers.slice(0, at));
    if (!pair) {
      break;
    }
    pairs.push(pair);
  }
  return pairs;
};

/** The head the five answers chose. */
export const chosenHead = (answers: readonly TFitAnswer[]): TRoomHead =>
  ranked(tallyOf(pairsSoFar(answers), answers))[0];

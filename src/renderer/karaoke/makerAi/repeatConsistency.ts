/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerRepeat } from './lyricRepetition';

/** All this needs of a word is when it was heard. */
interface ITimedWord {
  startMs: number;
  endMs: number;
}

/**
 * How differently the same words may be laid out the two times they are sung.
 *
 * Measured as the worst word's displacement, as a fraction of the phrase's own
 * length, after tempo is divided out — so this is disagreement about shape and
 * never about speed. Across nine fully timed songs in the saved library, 170
 * repeated runs: the seven whose timing is sound never exceed 0.49 and sit at
 * 0.003-0.12 in the median, while the one song that is visibly mistimed has a
 * median of 0.775. At 0.60 nothing in any sound song is flagged — 0 of 51 —
 * and 74 of that song's 96 runs are.
 *
 * The gap between 0.49 and 0.775 is what this number lives in. It is not a
 * round number chosen for looking reasonable, and moving it to 0.5 starts
 * charging a song whose only crime is a chorus that ends on a different
 * ad-lib each time.
 */
const MINIMUM_SHAPE_DISAGREEMENT = 0.6;

/**
 * How much further from the singer's own pace one performance must be before
 * we are willing to say which of the two is the broken one.
 *
 * A factor of two, in log space. Below it the two performances are equally
 * plausible and the disagreement says only that one of them is wrong, not
 * which — so nothing is touched. That happens in 11 of 76 flagged runs; those
 * keep the timing they had rather than having a coin flipped over them.
 */
const MINIMUM_PACE_DIFFERENCE = Math.log(2);

/** Where a run starts and how far its words are spread. */
const spanOf = (words: readonly ITimedWord[]): number =>
  words.length ? words[words.length - 1].endMs - words[0].startMs : 0;

/**
 * The worst disagreement between two performances of the same words, as a
 * fraction of the phrase length, with tempo divided out.
 *
 * A phrase sung slower the second time is not evidence of anything; a phrase
 * whose fourth word lands halfway through one performance and at the very end
 * of the other is.
 */
const shapeDisagreement = (
  left: readonly ITimedWord[],
  right: readonly ITimedWord[],
): number => {
  const leftSpan = spanOf(left);
  const rightSpan = spanOf(right);
  if (leftSpan <= 0 || rightSpan <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  let worst = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    worst = Math.max(
      worst,
      Math.abs(
        (left[index].startMs - left[0].startMs) / leftSpan -
          (right[index].startMs - right[0].startMs) / rightSpan,
      ),
    );
  }
  return worst;
};

/**
 * Words whose timing the song's own repetition contradicts.
 *
 * A singer who performs the same phrase twice performs it roughly the same
 * shape twice. When two performances disagree about that shape, one of them is
 * wrong — and unlike every other check here, this one needs no model, no
 * threshold about silence and no opinion about song structure. The song is
 * being compared with itself.
 *
 * It answers the failure the other guards cannot see: a performance whose
 * timings are individually plausible — no stacked starts, no over-long spans,
 * every word inside a voiced stretch — and collectively wrong. Nothing about
 * one such run looks broken until the other performance of the same words is
 * put beside it.
 *
 * What comes back is only ever the untrustworthy half, and only when the two
 * halves can be told apart by the singer's own pace. A disagreement whose
 * blame cannot be assigned leaves both alone: the point is to remove bad
 * evidence, never to invent good evidence.
 */
export const karaokeMakerInconsistentRepeatWords = (
  words: readonly ITimedWord[],
  repeats: readonly IKaraokeMakerRepeat[],
): ReadonlySet<number> => {
  const suspect = new Set<number>();
  if (!repeats.length || words.length < 2) {
    return suspect;
  }
  // This singer's own pace, not a constant: what counts as a plausible word
  // length in a ballad is a whole phrase in something twice as fast.
  const durations = words
    .map((word) => word.endMs - word.startMs)
    .sort((left, right) => left - right);
  const medianWordMs = Math.max(1, durations[Math.floor(durations.length / 2)]);
  const paceError = (run: readonly ITimedWord[]): number =>
    Math.abs(Math.log(Math.max(1, spanOf(run)) / run.length / medianWordMs));

  repeats.forEach((repeat) => {
    const left = words.slice(
      repeat.firstIndex,
      repeat.firstIndex + repeat.length,
    );
    const right = words.slice(
      repeat.secondIndex,
      repeat.secondIndex + repeat.length,
    );
    if (
      left.length !== repeat.length ||
      right.length !== repeat.length ||
      shapeDisagreement(left, right) < MINIMUM_SHAPE_DISAGREEMENT
    ) {
      return;
    }
    const leftError = paceError(left);
    const rightError = paceError(right);
    if (Math.abs(leftError - rightError) < MINIMUM_PACE_DIFFERENCE) {
      return;
    }
    const from =
      leftError > rightError ? repeat.firstIndex : repeat.secondIndex;
    for (let offset = 0; offset < repeat.length; offset += 1) {
      suspect.add(from + offset);
    }
  });
  return suspect;
};

export default karaokeMakerInconsistentRepeatWords;

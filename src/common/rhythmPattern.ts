/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where in the bar each drum plays (`sceneRhythm.ts`). A drum part repeats:
 * the kick and the snare keep to a pattern bar after bar, and the hats run
 * through every eighth or sixteenth. So a hit where the drum has been playing
 * is believed a little sooner, and one where it never plays has to be much
 * clearer - a sung "s" or a strum between the beats, which a detector hears
 * as a hit now and then, is what lit the snare lamp "at random" (Ivan,
 * 2026-09-24: "a snare is a hit that is not random", "hats are something
 * predictable", "same for kick").
 *
 * The bar is counted from the clock's own beats, four at a time, whichever
 * of them the bar's first beat turns out to be: a pattern only has to repeat,
 * not to be named. It is kept in twelfths of a beat, where sixteenths and
 * triplets both land, and forgotten over about MEMORY_BARS bars, so a new
 * part of the song is learnt in a few.
 */

/** Twelfths of a beat, four beats: sixteenths and triplets both land on one. */
const SLOTS_PER_BEAT = 12;
const SLOTS = 4 * SLOTS_PER_BEAT;
/** How many bars the pattern remembers, give or take: each halves in this many. */
const MEMORY_BARS = 6;
/** Bars of evidence before the pattern says anything at all. */
const EVIDENCE_BARS = 2;
/**
 * What a detector asks of a hit, as a share of its own threshold: where the
 * drum has not played for bars, and where it has hit on most of them.
 */
const OFF_PATTERN_BIAS = 1.8;
const ON_PATTERN_BIAS = 0.8;
/** A slot hit on this share of bars counts as fully part of the pattern. */
const REGULAR_SHARE = 0.5;
/**
 * How long after the sound a hit is heard: the analysers' window and a frame
 * or so. The made-up songs, whose hits are all known, heard them 10 to 29 ms
 * late.
 */
const HEARD_LATE_MS = 18;

export interface IDrumPattern {
  /** Hits heard at each slot, fading. */
  hits: Float32Array;
  /** Bars heard with a sure clock, fading the same way: what the hits are out of. */
  bars: number;
}

export const createDrumPattern = (): IDrumPattern => ({
  hits: new Float32Array(SLOTS),
  bars: 0,
});

/**
 * The slot the sound now being heard was made in: the clock's beat within
 * its bar of four and its phase, less the time a hit takes to be heard.
 */
export const slotOf = (beats: number, phase: number, tempo: number) => {
  const late = (HEARD_LATE_MS * tempo) / 60_000;
  const inBar = ((((beats % 4) + 4) % 4) + phase - late + 4) % 4;
  return Math.round(inBar * SLOTS_PER_BEAT) % SLOTS;
};

/** A slot's hits per bar, with its neighbours at half weight. */
const rateAt = (pattern: IDrumPattern, slot: number) =>
  (pattern.hits[slot] +
    0.5 *
      (pattern.hits[(slot + 1) % SLOTS] +
        pattern.hits[(slot + SLOTS - 1) % SLOTS])) /
  pattern.bars;

/**
 * How much of its threshold the drum asks of a hit in this slot: 1 while
 * there is no pattern to go by, less where the drum keeps playing, more
 * where it has not played for bars. A slot is judged with its neighbours at
 * half weight, so a hit a twelfth of a beat early or late still finds its
 * place.
 *
 * There is a pattern only where the drum has kept to a place: its busiest
 * slot hit on most bars. A drum that has not been playing has none - measured
 * by bars alone, a ballad's verses without a snare made every place "off the
 * pattern", and the chorus's snares were thrown away - and nor has one heard
 * on a wrong grid, a tempo two-thirds of the song's, whose hits land all over
 * the bar.
 */
export const patternBias = (pattern: IDrumPattern, slot: number) => {
  if (pattern.bars < EVIDENCE_BARS) {
    return 1;
  }
  let busiest = 0;
  for (let at = 0; at < SLOTS; at += 1) {
    busiest = Math.max(busiest, rateAt(pattern, at));
  }
  const known =
    Math.max(0, Math.min(1, (busiest - 0.3) / 0.4)) *
    Math.min(1, (pattern.bars - EVIDENCE_BARS) / EVIDENCE_BARS + 0.5);
  const regular = Math.min(1, rateAt(pattern, slot) / REGULAR_SHARE);
  const bias =
    OFF_PATTERN_BIAS + (ON_PATTERN_BIAS - OFF_PATTERN_BIAS) * regular;
  return 1 + (bias - 1) * known;
};

/**
 * How far over its threshold a hit has to stand to be learnt in full; one
 * that barely crossed is learnt in proportion.
 */
const CLEAR_HIT = 1.3;

/**
 * A hit heard in `slot`, which stood `stoodOver` times what was asked of it
 * (`listenFor`). A hit that barely crossed is as likely a bass note as a
 * kick, and learnt in full, the few a detector let through early became the
 * pattern, and the pattern then let the rest through: measured on a made-up
 * rock song, one kick in fifty was false or two in five, depending only on
 * where in the sound the first reading happened to fall.
 */
export const learnHit = (
  pattern: IDrumPattern,
  slot: number,
  stoodOver: number,
) => {
  pattern.hits[slot] += Math.max(
    0,
    Math.min(1, (stoodOver - 1) / (CLEAR_HIT - 1)),
  );
};

/**
 * Time passing with the clock sure: the bars counted, and everything
 * forgotten a little. `beats` is how many beats the step covered.
 */
export const followPattern = (pattern: IDrumPattern, beats: number) => {
  const keep = 2 ** (-beats / (4 * MEMORY_BARS));
  pattern.bars = pattern.bars * keep + beats / 4;
  for (let slot = 0; slot < SLOTS; slot += 1) {
    pattern.hits[slot] *= keep;
  }
};

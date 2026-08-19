/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface IKaraokeMakerVocalRest {
  startMs: number;
  endMs: number;
}

/** 20 ms of signal per measurement, stepped by half a frame. */
const FRAME_MS = 20;
const HOP_MS = 10;

/**
 * A rest shorter than this is a consonant, not a breath. Sung syllables are
 * routinely separated by 100–200 ms of near-silence; a singer who has stopped
 * to breathe is quiet for appreciably longer.
 */
const MINIMUM_REST_MS = 300;

/**
 * Where the voice stops, measured in the isolated vocal rather than inferred
 * from a transcript.
 *
 * The Maker asked Whisper's timestamps where the singer breathed, which fails
 * precisely when Whisper is having trouble: measured on one song it returned
 * 39 words across 14.2 seconds with every gap at zero, so the line breaker saw
 * one unbroken phrase and produced one unreadable line. The stem has no
 * opinion about words and answers the question directly.
 *
 * The threshold is relative to the take's own loud passages, because a stem's
 * absolute level depends on the separation and the master it came from. Bleed
 * from the backing track sits far below the sung voice, so a fraction of the
 * loud level clears it without needing a gate the user has to tune.
 */
export const karaokeMakerVocalRests = (
  samples: Float32Array,
  sampleRate: number,
): IKaraokeMakerVocalRest[] => {
  if (!samples.length || sampleRate <= 0) {
    return [];
  }
  const frameSize = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1_000));
  const hop = Math.max(1, Math.round((sampleRate * HOP_MS) / 1_000));
  const levels: number[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    let sum = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      sum += samples[index] * samples[index];
    }
    levels.push(Math.sqrt(sum / frameSize));
  }
  if (!levels.length) {
    return [];
  }
  // Two levels live in a vocal stem: the singer, and what is left when the
  // singer stops — bleed from the separation, reverb tails, room. The 90th and
  // 10th percentiles stand in for them without letting one clipped peak or one
  // digitally silent stretch set the scale, and the threshold sits halfway
  // between the two in dB, which is the middle of the gap rather than a fixed
  // fraction of the loud end.
  //
  // A fixed fraction was the first attempt and it read the bleed as singing:
  // 6% of the loud level is 24 dB down, under the floor of a real separation,
  // so a four-minute song reported 14 rests when the singer breathes many
  // times that.
  const ranked = [...levels].sort((left, right) => left - right);
  const at = (fraction: number) =>
    ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * fraction))];
  const loud = at(0.9);
  if (loud <= 0) {
    return [];
  }
  const floor = Math.max(at(0.1), loud * 1e-4);
  const threshold = Math.sqrt(floor * loud);
  const rests: IKaraokeMakerVocalRest[] = [];
  let restStart: number | undefined;
  levels.forEach((level, index) => {
    const quiet = level < threshold;
    if (quiet && restStart === undefined) {
      restStart = index;
      return;
    }
    if (!quiet && restStart !== undefined) {
      const startMs = restStart * HOP_MS;
      const endMs = index * HOP_MS;
      if (endMs - startMs >= MINIMUM_REST_MS) {
        rests.push({ startMs, endMs });
      }
      restStart = undefined;
    }
  });
  if (restStart !== undefined) {
    const startMs = restStart * HOP_MS;
    const endMs = levels.length * HOP_MS;
    if (endMs - startMs >= MINIMUM_REST_MS) {
      rests.push({ startMs, endMs });
    }
  }
  return rests;
};

/**
 * Which word boundaries the singer breathed at: one break per measured rest,
 * at the boundary nearest to it.
 *
 * Asking instead whether a rest *overlaps* the gap between two words cannot
 * work, because that gap is usually nothing: Whisper hands back words whose
 * spans butt together or overlap outright, so the boundary is a single instant
 * and no interval can meet it. Nearest-boundary asks the question the timings
 * can actually answer — they are unreliable in absolute terms but monotonic,
 * so a breath still falls closest to the words it fell between.
 *
 * Rests outside the sung span are ignored rather than pushed onto the first or
 * last boundary: the silence before the first line is not a line break.
 */
/**
 * How far a measured pause may reach for the boundary it belongs to.
 *
 * Words inside a phrase are 300-500 ms apart, so 1.5 s is several words of
 * slack — enough to absorb the disagreement between two of Whisper's heads,
 * and short enough that a pause with no word near it claims nothing. Without
 * a limit, nearest-boundary always finds *some* boundary: a segmentation that
 * lands one boundary every 20-30 s would then cut a coherent line in half
 * every time, which is the failure this signal exists to prevent.
 */
const MAXIMUM_CLAIM_MS = 1_500;

/**
 * Drop words the model reported where the isolated voice is silent.
 *
 * Over an intro, an instrumental break or an outro, Whisper is handed the
 * residue of the separation — near-silence and bleed — which is the input that
 * produces its idle-loop hallucinations: "Thank you.", "Subtitles by…", "♪".
 * On the path where the transcript becomes the lyrics those arrive as real
 * lines with real timings at the top of a song, and nothing downstream can
 * tell them from singing, because by then they look exactly like it.
 *
 * The stem answers directly and was already measured for line breaking. A word
 * lying wholly inside a rest was not sung there. Only wholly: a word that
 * merely touches a rest is a phrase edge, which is the normal case.
 */
export const karaokeMakerWordsInsideRests = <
  T extends { startMs: number; endMs: number },
>(
  words: readonly T[],
  rests: readonly IKaraokeMakerVocalRest[],
): T[] =>
  rests.length
    ? words.filter(
        (word) =>
          !rests.some(
            (rest) => word.startMs >= rest.startMs && word.endMs <= rest.endMs,
          ),
      )
    : [...words];

/**
 * Every line break the evidence supports, from all three sources at once.
 *
 * Kept here rather than in `apply.ts`, which is at its size limit, and kept in
 * one function because the three are one decision: a boundary is a boundary
 * whether the singer stopped, the model ended an utterance, or the phrase is
 * one the singer performs more than once. Measured on this library, no single
 * one of them is sufficient — silence finds 2-9 breaks a minute against the
 * 18-21 human karaoke uses, and a song whose backing vocals never leave a gap
 * has only the other two.
 */
export const karaokeMakerLineBreaks = (
  words: readonly { startMs: number; endMs: number }[],
  rests: readonly IKaraokeMakerVocalRest[],
  segmentEndsMs: readonly number[],
  repeatEdges: ReadonlySet<number>,
  /** Sentence ends and audible gaps, which the words themselves supply. */
  fromWords: ReadonlySet<number>,
): ReadonlySet<number> => {
  const claimed = [
    ...new Set([
      ...karaokeMakerRestLineBreaks(rests, words),
      ...karaokeMakerRestLineBreaks(
        segmentEndsMs.map((atMs) => ({ startMs: atMs, endMs: atMs })),
        words,
      ),
      ...repeatEdges,
      ...fromWords,
    ]),
  ].sort((left, right) => left - right);
  // Three instruments measuring one phrase ending will not agree to the word:
  // a segment end, a stem rest and a repeated run's edge each land where their
  // own resolution puts them, and every disagreement used to mint a line. That
  // is how a song came back with 31 of its 54 lines one or two words long
  // against the 6-8 human karaoke uses. Adjacent claims are corroboration of
  // the same boundary, so they collapse to the first of them rather than each
  // cutting again.
  const merged = new Set<number>();
  let previous = Number.NEGATIVE_INFINITY;
  claimed.forEach((index) => {
    if (index - previous > 1) {
      merged.add(index);
      previous = index;
    }
  });
  return merged;
};

export const karaokeMakerRestLineBreaks = (
  rests: readonly IKaraokeMakerVocalRest[],
  words: readonly { startMs: number; endMs: number }[],
): ReadonlySet<number> => {
  const breaks = new Set<number>();
  if (words.length < 2 || !rests.length) {
    return breaks;
  }
  const firstMs = words[0].startMs;
  const lastMs = words[words.length - 1].endMs;
  rests.forEach((rest) => {
    const centreMs = (rest.startMs + rest.endMs) / 2;
    if (centreMs <= firstMs || centreMs >= lastMs) {
      return;
    }
    let bestIndex = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 1; index < words.length; index += 1) {
      const boundaryMs = (words[index - 1].endMs + words[index].startMs) / 2;
      const distance = Math.abs(centreMs - boundaryMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestDistance <= MAXIMUM_CLAIM_MS) {
      breaks.add(bestIndex);
    }
  });
  return breaks;
};

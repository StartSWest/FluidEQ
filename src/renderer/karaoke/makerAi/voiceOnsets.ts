/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** 20 ms of signal per measurement, stepped by half a frame. */
const FRAME_MS = 20;
const HOP_MS = 10;

/**
 * Two onsets closer than this are one attack measured twice. A singer can
 * articulate about eight syllables a second at speed, so 80 ms is below the
 * fastest real delivery and above the width of a single consonant burst.
 */
const MINIMUM_ONSET_GAP_MS = 80;

/**
 * How far a word may be moved to meet an onset.
 *
 * Whisper knows roughly where a word is and not exactly where it starts; the
 * envelope knows exactly where a sound starts and nothing about words. Beyond
 * this the two are describing different events, and moving the word would be
 * inventing rather than refining.
 */
const MAXIMUM_SNAP_MS = 400;

/**
 * Where the voice starts making a sound.
 *
 * The pitch tracker was the obvious candidate and cannot do this: measured on
 * one song, 379 detected notes covered 37% of the voiced audio, because a
 * consonant, a breathy attack and a rapped line carry no pitch. The stem's own
 * energy covers all of it — 80% of that song — and a sung word always begins
 * with a rise in it, pitched or not.
 *
 * Rises are found in the log envelope so a quiet verse and a loud chorus are
 * measured on the same scale, and picked against the song's own distribution
 * of rises rather than a fixed level.
 */
export const karaokeMakerVoiceOnsets = (
  samples: Float32Array,
  sampleRate: number,
): number[] => {
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
  if (levels.length < 3) {
    return [];
  }
  const ranked = [...levels].sort((left, right) => left - right);
  const at = (fraction: number) =>
    ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * fraction))];
  const loud = at(0.9);
  if (loud <= 0) {
    return [];
  }
  const floor = Math.max(at(0.1), loud * 1e-4);
  const audible = Math.sqrt(floor * loud);
  // A rise in the log envelope, which measures the same proportional jump
  // whether the singer is whispering or belting.
  const rises = levels.map((level, index) =>
    index === 0
      ? 0
      : Math.max(
          0,
          Math.log(level + 1e-9) - Math.log(levels[index - 1] + 1e-9),
        ),
  );
  const moving = [...rises].filter((rise) => rise > 0).sort((a, b) => a - b);
  if (!moving.length) {
    return [];
  }
  const median = moving[Math.floor(moving.length / 2)];
  const spread =
    moving[Math.min(moving.length - 1, Math.floor(moving.length * 0.9))] -
    median;
  const trigger = median + Math.max(spread, 1e-6) * 1.5;
  const onsets: number[] = [];
  let lastMs = Number.NEGATIVE_INFINITY;
  rises.forEach((rise, index) => {
    const atMs = index * HOP_MS;
    if (
      rise >= trigger &&
      levels[index] >= audible &&
      atMs - lastMs >= MINIMUM_ONSET_GAP_MS
    ) {
      onsets.push(atMs);
      lastMs = atMs;
    }
  });
  return onsets;
};

/** A word that may or may not have been placed; an unplaced one is untouched. */
export interface IKaraokeMakerSnappedWord {
  startMs?: number;
  endMs?: number;
}

/**
 * Put each word on the sound that is actually it.
 *
 * Whisper supplies the order and the neighbourhood; the envelope supplies the
 * instant. A word is moved only to the nearest onset it can reach without
 * overtaking the word before it, so the sequence stays monotonic and a word
 * with no onset nearby keeps what it had rather than being dragged to one.
 */
export const karaokeMakerSnapWordsToOnsets = <
  T extends IKaraokeMakerSnappedWord,
>(
  words: readonly T[],
  onsets: readonly number[],
): T[] => {
  if (!onsets.length) {
    return [...words];
  }
  let previousMs = Number.NEGATIVE_INFINITY;
  // The last onset at or before the word being placed. Advancing instead to
  // the furthest onset still within reach put the search window past the
  // answer: with attacks 80 ms apart, a word sitting exactly on one of them
  // had that onset four places behind the cursor and snapped 240 ms away.
  let cursor = 0;
  return words.map((word, index) => {
    const { startMs, endMs } = word;
    if (startMs === undefined || endMs === undefined) {
      return word;
    }
    while (cursor + 1 < onsets.length && onsets[cursor + 1] <= startMs) {
      cursor += 1;
    }
    // A word may not be moved past where the next word was already heard.
    // Without this the snap could reorder the song: a word pulled forward onto
    // a late onset left the word after it stranded behind, and the sequence
    // that `placeTranscriptWords` had guaranteed to be forward-only came out
    // of here going backwards.
    const nextHeardMs =
      words.slice(index + 1).find((later) => later.startMs !== undefined)
        ?.startMs ?? Number.POSITIVE_INFINITY;
    let best: number | undefined;
    let bestDistance = MAXIMUM_SNAP_MS;
    for (
      let at = Math.max(0, cursor - 2);
      at < Math.min(onsets.length, cursor + 3);
      at += 1
    ) {
      const candidate = onsets[at];
      const distance = Math.abs(candidate - startMs);
      if (
        candidate > previousMs &&
        candidate < nextHeardMs &&
        distance <= bestDistance
      ) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (best === undefined) {
      previousMs = Math.max(previousMs, startMs);
      return word;
    }
    previousMs = best;
    return {
      ...word,
      startMs: best,
      // The word keeps the length it was measured to have; only where it
      // begins was in doubt.
      endMs: Math.max(best + 1, best + (endMs - startMs)),
    };
  });
};

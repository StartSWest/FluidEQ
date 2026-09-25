/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from './smoothing';

/**
 * The drums, heard apart from the rest of the music, from the rhythm's 24
 * bands (a third of an octave each from 40 Hz to 12 kHz, 0..1 over 100 dB,
 * `soundHops.ts`), for `sceneRhythm.ts`. The hits themselves are heard in
 * the spectrum where it is there (`rhythmSpectrum.ts`); what is here is
 * what the beat grid and the tempo are heard from, and the drums of music
 * that arrives as a spectrum alone.
 *
 * A hit is a band getting louder, fast. How much louder is measured over a
 * fixed RISE_LAG_MS, never from one drawn frame to the next: the frames come
 * thirty to two hundred and forty a second, and a rise measured per frame
 * was a fifth as tall at 144 Hz as at 30, so every detector fired at a
 * different rate on every screen - at 100 Hz the kicks came out one in two
 * false, and the beat clock drifted onto the off-beat.
 */

/**
 * Band ranges, both ends included, among the 24, chosen from each drum's own
 * picture in the bands - measured on made-up songs whose every hit is known
 * (a kick lifts all of 40-211 Hz at once, a bass note mostly its own
 * fundamental; a snare lifts 1.1-3.6 kHz five times as much as a hat or a
 * kick's click does; a hat lifts only the top).
 */
type TBands = readonly [number, number];
/** A snare's crack and a clap: 1.1 to 3.6 kHz. */
const CRACK_BANDS: TBands = [14, 18];
/** Hi-hats and cymbals: 4.6 to 12 kHz. */
const HAT_BANDS: TBands = [20, 23];

/** How far back a band's rise is measured from. */
export const RISE_LAG_MS = 25;
/** Band frames kept for it: enough for a 240 Hz screen to reach back 25 ms. */
const FRAMES_KEPT = 12;

export interface IBandFrame {
  atMs: number;
  bands: readonly number[];
}

/** The frames a rise is measured against, oldest first. */
export const keepBandFrame = (
  frames: IBandFrame[],
  atMs: number,
  bands: readonly number[],
) => {
  frames.push({ atMs, bands: [...bands] });
  if (frames.length > FRAMES_KEPT) {
    frames.shift();
  }
};

/**
 * How much each band rose over the last RISE_LAG_MS: against the newest frame
 * at least that old, or the oldest there is. Only rises count - what comes
 * off a note ending is not an onset.
 */
export const bandRises = (
  frames: readonly IBandFrame[],
  atMs: number,
  bands: readonly number[],
): number[] => {
  let base: IBandFrame | undefined;
  for (let at = frames.length - 1; at >= 0; at -= 1) {
    if (atMs - frames[at].atMs >= RISE_LAG_MS) {
      base = frames[at];
      break;
    }
  }
  base ??= frames[0];
  if (!base || base.bands.length !== bands.length) {
    return bands.map(() => 0);
  }
  const before = base.bands;
  return bands.map((energy, at) => Math.max(0, energy - before[at]));
};

/**
 * How loud each band has been at its loudest lately, falling 3 dB a second,
 * so its rises can be judged against it (`gateRises`).
 */
export const followBandTops = (
  tops: Float32Array,
  bands: readonly number[],
  stepMs: number,
) => {
  const fall = (0.03 * stepMs) / 1_000;
  for (let at = 0; at < tops.length; at += 1) {
    tops[at] = Math.max(bands[at] ?? 0, tops[at] - fall);
  }
};

/**
 * Rises counted only where the band is anywhere near its own loudest: fully
 * within 20 dB of it, not at all 40 dB under. The bands are decibels, where
 * a wobble in a whisper rises as far as a kick does: a pad's chord leaking
 * into the kick's two lowest bins, forty decibels down, moved them 10 to
 * 14 dB and fired a kick in a ballad four times out of five.
 */
export const gateRises = (
  rises: readonly number[],
  bands: readonly number[],
  tops: Float32Array,
): number[] =>
  rises.map((rise, at) => {
    const under = tops[at] - (bands[at] ?? 0);
    return rise * Math.max(0, Math.min(1, (0.4 - under) / 0.2));
  });

/** How much each band rose since the last frame, whatever its length. */
export const stepRises = (
  frames: readonly IBandFrame[],
  bands: readonly number[],
): number[] => {
  const last = frames[frames.length - 1];
  if (!last || last.bands.length !== bands.length) {
    return bands.map(() => 0);
  }
  return bands.map((energy, at) => Math.max(0, energy - last.bands[at]));
};

const meanOf = (rises: readonly number[], [from, to]: TBands) => {
  let sum = 0;
  for (let at = from; at <= to; at += 1) {
    sum += rises[at] ?? 0;
  }
  return sum / (to - from + 1);
};

/** What each part of the kit is doing, from the bands' rises. */
export interface IDrumFeatures {
  kick: number;
  snare: number;
  hat: number;
  /** Every band's rise: all the onsets there are, for the beat clock. */
  broad: number;
}

/**
 * A kick lifts the whole low end at once - its thump sweeps down from
 * 160 Hz to 50 - where a bass note lifts its own fundamental hardest and
 * fades up its harmonics: counted by the least-lifted third of 40-211 Hz.
 */
const kickOf = (rises: readonly number[]) =>
  Math.min(
    meanOf(rises, [0, 2]),
    meanOf(rises, [3, 4]),
    1.3 * meanOf(rises, [5, 6]),
  );

export const drumFeatures = (rises: readonly number[]): IDrumFeatures => {
  const crack = meanOf(rises, CRACK_BANDS);
  const top = meanOf(rises, HAT_BANDS);
  const kick = kickOf(rises);
  return {
    kick,
    // A snare is noise from its crack right up past 8 kHz, all at once: a
    // guitar chord or a voice stops well under the top, so the lesser of the
    // two is what a snare lifts and they do not. A hat reaches down into the
    // crack a little too, a sixth of its top against a snare's half, so a
    // crack that small beside the top is a hat's. A kick's beater clicks in
    // both, faintly: what its low end explains is taken back out.
    snare: Math.max(
      0,
      Math.min(crack, 0.8 * top) *
        Math.max(0, Math.min(1, (crack / Math.max(top, 1e-4) - 0.2) / 0.15)) -
        0.15 * meanOf(rises, [0, 6]),
    ),
    // A snare lifts the top bands too; what the crack explains is not a hat.
    hat: Math.max(0, meanOf(rises, HAT_BANDS) - 2.5 * crack),
    broad: meanOf(rises, [0, rises.length - 1]),
  };
};

/**
 * The onsets the beat grid is laid over, from one frame's rises: kicks and
 * snares alike, everything else a little, so the grid lands where a
 * drummer's beat is. The snare as heavy as the kick because the backbeat is
 * what says where the beat is when the kicks are syncopated: weighed at a
 * little over half, a hip-hop grid swung between the beat and the eighth
 * after it, its beats wandering 140 ms. Straight sums of the rises, so a
 * frame's share can be split over the time it covered and come out the same
 * at any frame rate.
 */
export const beatStrength = (
  rises: readonly number[],
  kickHeight: number,
  snareHeight: number,
) => {
  // Each drum counted against its own usual hit, so one kick weighs what one
  // snare does however much louder the kick's band runs: counted raw, the
  // kicks of a hip-hop pattern outweighed its backbeat three to one. And each
  // counted as its detector hears it, so what the detector knows is not a
  // snare - a sung "s", a guitar - does not pull the grid either.
  const drums = drumFeatures(rises);
  const kick = drums.kick / Math.max(0.02, kickHeight);
  const snare = drums.snare / Math.max(0.02, snareHeight);
  const broad = drums.broad / Math.max(0.02, kickHeight, snareHeight);
  return kick + snare + 0.2 * broad;
};

/**
 * The onsets the tempo is heard from, from the rises over RISE_LAG_MS: every
 * band's rise, counted as far as the band stands near the loudest band at
 * that moment - fully within 30 dB of it, not at all 40 dB under - and the
 * kick's again at half. A song's tempo is carried by its loud parts: heard
 * from every band alike, Take On Me's bright synth riff, three against two,
 * put it at two-thirds of its 169. The kick at half because counted in full
 * a hip-hop pattern of kicks on one, the and of two and three repeated every
 * beat and a half, and a 90 song was heard at 60.
 */
export const tempoStrength = (
  rises: readonly number[],
  bands: readonly number[],
) => {
  let loudest = 0;
  bands.forEach((level) => {
    loudest = Math.max(loudest, level);
  });
  let sum = 0;
  rises.forEach((rise, at) => {
    const under = loudest - (bands[at] ?? 0);
    sum += rise * Math.max(0, Math.min(1, (0.4 - under) / 0.1));
  });
  return sum / Math.max(1, rises.length) + 0.5 * kickOf(rises);
};

/**
 * One drum's detector: the quiet between its hits and their spread, how tall
 * its hits have been standing, the tallest rise of the hit under way, and how
 * long since the last.
 */
export interface IHitDetector {
  floor: number;
  spread: number;
  peak: number;
  hitTop: number;
  sinceMs: number;
}

export const newDetector = (): IHitDetector => ({
  // Started above what music reaches, so a fade-in cannot stand above a
  // threshold of nothing and fire a burst.
  floor: 0.02,
  spread: 0.02,
  peak: 0,
  hitTop: 0,
  sinceMs: 1_000,
});

/** Nothing this small is a hit, however quiet the music around it: 1 dB. */
const SMALLEST_HIT = 0.01;
/** How quickly the height of past hits is forgotten, so a quiet verse is heard. */
const PEAK_HALF_LIFE_MS = 4_000;
/** The most of the drum's tallest recent hit a hit is ever asked for. */
const MOST_SHARE = 0.95;

/** What one drum's detector asks of a rise before it is a hit. */
export interface IHitRule {
  /** How far above the quiet between hits, in its spreads. */
  margin: number;
  /**
   * The share of the drum's own recent hits it has to reach. A threshold set
   * by the music's average alone sat far under a drum's hits - they are
   * brief, so they barely move an average - and a voice's vibrato or a pad's
   * shimmer crossed it all through a ballad.
   */
  share: number;
  /** No second hit this soon after one. */
  refractoryMs: number;
}

/**
 * One drum's step: a hit is a rise standing clear of what that part of the
 * spectrum has been doing - its floor, the quiet between hits, which follows
 * the music down at once and up only slowly so the hits themselves do not
 * lift it - and a fair share of how tall the drum's hits have been, and
 * never two inside the rule's refractory time. `bias` scales what is asked:
 * under 1 where the drum is expected, over 1 where it never plays.
 *
 * Returns how far a hit stood over what was asked of it, as a ratio (1 or
 * more), and 0 when there was none.
 */
export const listenFor = (
  detector: IHitDetector,
  feature: number,
  stepMs: number,
  { margin, share, refractoryMs }: IHitRule,
  bias = 1,
): number => {
  // The bias moves what is asked of the hit, but never past the drum's own
  // tallest recent hit: scaling the whole threshold, a snare asked for four
  // fifths of its tallest hit was asked for 1.4 times it off the pattern, and
  // a build's roll - new, and real - was never heard at all.
  const threshold = Math.max(
    detector.floor + bias * margin * detector.spread,
    Math.min(MOST_SHARE, bias * share) * detector.peak,
    SMALLEST_HIT,
  );
  const wasWithin = detector.sinceMs < refractoryMs;
  detector.sinceMs += stepMs;
  if (detector.sinceMs < refractoryMs) {
    // Still inside the last hit: how tall it got.
    detector.hitTop = Math.max(detector.hitTop, feature);
  } else if (wasWithin) {
    // The last hit is over: the drum's height is its tallest recent hit.
    // Averaged over the hits heard instead, every false hit - smaller than a
    // true one - lowered what the next had to reach, and the made-up songs'
    // snares were heard with a recall of 1.00 and a precision of 0.3 to 0.7.
    detector.peak = Math.max(detector.peak, detector.hitTop);
  }
  const hit = feature > threshold && detector.sinceMs >= refractoryMs;
  const towards = getEaseFactor(stepMs, feature < detector.floor ? 150 : 2_000);
  detector.floor += (feature - detector.floor) * towards;
  detector.spread +=
    (Math.abs(feature - detector.floor) - detector.spread) *
    getEaseFactor(stepMs, 1_200);
  detector.peak *= 2 ** (-stepMs / PEAK_HALF_LIFE_MS);
  if (hit) {
    detector.sinceMs = 0;
    detector.hitTop = feature;
  }
  return hit ? feature / threshold : 0;
};

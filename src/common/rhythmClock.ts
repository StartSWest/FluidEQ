/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  estimatePhase,
  estimateTempo,
  isRelated,
  OSS_HOP_MS,
} from './rhythmTempo';
import { getEaseFactor } from './smoothing';

/**
 * The music's clock (`sceneRhythm.ts`): the onsets kept at a steady rate, the
 * tempo heard in them and kept, and a phase that runs on at that tempo and is
 * steered onto where the onsets put the beat - with the bar counted in fours
 * on top of it.
 */

/** An onset history: one value per OSS_HOP_MS, as a ring, and the hop being filled. */
export interface IOnsetRing {
  values: Float32Array;
  at: number;
  held: number;
  hopLeftMs: number;
  hopRise: number;
}

export interface IRhythmClock {
  /** Every onset alike, for the tempo (`tempoStrength`). */
  tempoOnsets: IOnsetRing;
  /** The drums' onsets, for where the beat falls (`beatStrength`). */
  beatOnsets: IOnsetRing;
  sinceTempoMs: number;
  sincePhaseMs: number;
  tempo: number;
  confidence: number;
  /** How clearly the last estimate heard a tempo, and a beat grid. */
  tempoClarity: number;
  tempoAgreement: number;
  phaseClarity: number;
  /** A tempo heard that is not the one kept, and how often in a row. */
  candidate: number;
  candidateVotes: number;
  /** The next tempo heard is a new song's, and is taken as it is. */
  fresh: boolean;
  /** How long the tempo kept has been kept, in music time. */
  heldMs: number;
  phase: number;
  /** Beats counted since the start, for the bar. */
  beats: number;
  /**
   * Where the onsets put the beat, as a phase, and how long ago that was
   * measured: the clock is steered towards it, carried on by the tempo.
   */
  target: number;
  targetAgeMs: number;
  hasTarget: boolean;
  /**
   * Whether the clock has been set onto the onsets since it last lost them
   * (a new song, a tempo taken afresh, time lost behind a hidden window).
   * Until it has, it is set straight; after, only steered.
   */
  aligned: boolean;
  /** How heavily each of the bar's four beats lands, on average. */
  slots: number[];
  downSlot: number;
  beatWeight: number;
}

/**
 * Ten seconds of onsets. The tempo's comb counts a multiple of a beat only
 * while half the history still overlaps it, and the bar is the multiple that
 * counts most: with six seconds, the bar of River's 74 (3.2 s) fell outside
 * while the bar of 148 was inside, and the song was heard at double. A new
 * song after a gap starts a history of its own; one that follows another
 * without a gap takes 6 to 11 s to be heard, against 3 to 7 with six.
 */
const OSS_LENGTH = 1_000;
/** How often the tempo is worked out again, in music time. */
const TEMPO_EVERY_MS = 250;
/** How often the beat grid is laid over the onsets again. */
const PHASE_EVERY_MS = 100;

/** Re-estimates in a row a new tempo needs: a related one, and another. */
const RELATED_VOTES = 12;
const OTHER_VOTES = 4;

/**
 * How long a tempo is on trial after it is first taken: the first seconds of
 * a song are the least clear, and the same fifteen songs spent 10 to 20 s on
 * a related tempo first - Cry Me a River at 99 for 74 - when the lean and the
 * long vote held on to a first guess as hard as to a settled one. On trial it
 * leans nothing and a related tempo needs no more votes than any other.
 */
const SETTLE_MS = 8_000;

/**
 * Where an onset stands in the history against the sound that made it, in
 * milliseconds, later positive: the beat the grid finds among the onsets is
 * moved by it onto the sound. Measured, not reasoned, on made-up songs whose
 * every beat is known: with the sound read every ten milliseconds, a clock
 * set with this at -15 - what a reading once a drawn frame needed - beat
 * 19 ms after the true beat (the median over twelve songs, 13 to 25 ms
 * each), at 33, 60 and 100 frames a second alike.
 */
const HEARD_OFFSET_MS = 4;

/**
 * How the clock is steered onto the grid once it is on it: most of the way
 * in this long, and never faster than this share of the tempo - so it runs a
 * little fast or slow for a moment, and never jumps.
 */
const STEER_MS = 300;
const STEER_MOST = 0.2;

/** A phase difference as the shorter way round, -0.5..0.5 of a beat. */
export const aroundBeat = (value: number) => value - Math.round(value);

const newOnsetRing = (): IOnsetRing => ({
  values: new Float32Array(OSS_LENGTH),
  at: 0,
  held: 0,
  hopLeftMs: OSS_HOP_MS,
  hopRise: 0,
});

export const createRhythmClock = (): IRhythmClock => ({
  tempoOnsets: newOnsetRing(),
  beatOnsets: newOnsetRing(),
  sinceTempoMs: 0,
  sincePhaseMs: 0,
  tempo: 0,
  confidence: 0,
  tempoClarity: 0,
  tempoAgreement: 0,
  phaseClarity: 0,
  candidate: 0,
  candidateVotes: 0,
  fresh: false,
  heldMs: 0,
  phase: 0,
  beats: 0,
  target: 0,
  targetAgeMs: 0,
  hasTarget: false,
  aligned: false,
  slots: [0, 0, 0, 0],
  downSlot: 0,
  beatWeight: 0,
});

/**
 * A new song, after a gap: its tempo from its own onsets alone, taken at
 * once, and the clock set onto its own beat.
 */
export const restartClock = (clock: IRhythmClock) => {
  clock.tempoOnsets.held = 0;
  clock.beatOnsets.held = 0;
  clock.fresh = true;
  clock.hasTarget = false;
  clock.aligned = false;
};

/** An onset history, oldest first. */
const historyOf = (ring: IOnsetRing): Float32Array => {
  const count = Math.min(ring.held, OSS_LENGTH);
  const out = new Float32Array(count);
  for (let at = 0; at < count; at += 1) {
    out[at] = ring.values[(ring.at - count + at + OSS_LENGTH) % OSS_LENGTH];
  }
  return out;
};

/** Walks a step's time across the ring's hops, closing each one filled. */
const fillHops = (
  ring: IOnsetRing,
  stepMs: number,
  add: (take: number) => void,
) => {
  let remaining = stepMs;
  while (remaining > 0) {
    const take = Math.min(remaining, ring.hopLeftMs);
    add(take);
    ring.hopLeftMs -= take;
    remaining -= take;
    if (ring.hopLeftMs <= 0) {
      ring.values[ring.at] = ring.hopRise;
      ring.at = (ring.at + 1) % OSS_LENGTH;
      ring.held = Math.min(OSS_LENGTH, ring.held + 1);
      ring.hopRise = 0;
      ring.hopLeftMs = OSS_HOP_MS;
    }
  }
};

/**
 * A step's onsets, kept at a steady rate in a history: what rose since the
 * last step, shared out over the hops that step's time covered, so a hop
 * holds how much rose in its own ten milliseconds whatever the step. Handed
 * whole to every hop of a long step, a hit heard at 30 Hz stood 30 ms wide
 * and early, and the clock found the beat 45 ms before the sound.
 */
export const keepOnset = (
  ring: IOnsetRing,
  strength: number,
  stepMs: number,
) => {
  fillHops(ring, stepMs, (take) => {
    ring.hopRise += (strength * take) / stepMs;
  });
};

/**
 * A step's onsets, held in every hop the step covers at their height: for
 * the tempo, heard from the rises over RISE_LAG_MS, which stand as tall and
 * as wide at any step, so the history's rhythm is the music's. Shared out as
 * `keepOnset` shares them, a long step's hit came out a third as tall and
 * three hops wide, and the tempo heard at 30 frames a second was not the
 * tempo heard at 100.
 */
export const holdOnset = (
  ring: IOnsetRing,
  strength: number,
  stepMs: number,
) => {
  fillHops(ring, stepMs, () => {
    ring.hopRise = Math.max(ring.hopRise, strength);
  });
};

/**
 * Keeps the tempo it has unless another one is heard again and again - for
 * three seconds when it is one the song's onsets always also fit (a related
 * tempo), for one otherwise - and takes a new song's first tempo as it is.
 */
const settleTempo = (clock: IRhythmClock, heard: number, clarity: number) => {
  if (clock.tempo === 0 || clock.fresh) {
    if (clarity > 0.15) {
      clock.tempo = heard;
      clock.fresh = false;
      clock.aligned = false;
      clock.candidateVotes = 0;
      clock.heldMs = 0;
    }
    return;
  }
  const ratio = heard / clock.tempo;
  if (Math.abs(ratio - 1) < 0.04) {
    clock.tempo += (heard - clock.tempo) * 0.35;
    clock.candidateVotes = 0;
    return;
  }
  if (Math.abs(heard / clock.candidate - 1) < 0.04) {
    clock.candidateVotes += 1;
  } else {
    clock.candidate = heard;
    clock.candidateVotes = 1;
  }
  const onTrial = clock.heldMs < SETTLE_MS;
  const needed = isRelated(ratio) && !onTrial ? RELATED_VOTES : OTHER_VOTES;
  if (clock.candidateVotes >= needed) {
    clock.tempo = heard;
    clock.candidateVotes = 0;
    clock.heldMs = 0;
  }
};

/** The tempo worked out again, and how far what is heard agrees with it. */
const followTempo = (clock: IRhythmClock) => {
  const leanOn = clock.heldMs >= SETTLE_MS ? clock.tempo : 0;
  const heard = estimateTempo(historyOf(clock.tempoOnsets), leanOn);
  if (heard) {
    settleTempo(clock, heard.tempo, heard.clarity);
  }
  // Sure of the clock only as far as what is heard agrees with the tempo it
  // keeps: a clear estimate of some other tempo is doubt, not certainty.
  let agreement = 0;
  if (heard && clock.tempo > 0) {
    const ratio = heard.tempo / clock.tempo;
    if (Math.abs(ratio - 1) < 0.04) {
      agreement = 1;
    } else if (isRelated(ratio)) {
      agreement = 0.6;
    }
  }
  clock.tempoClarity = heard ? heard.clarity : 0;
  clock.tempoAgreement = agreement;
};

/** The phase moved by `by` beats, the count of beats kept with it. */
const shiftPhase = (clock: IRhythmClock, by: number) => {
  clock.phase += by;
  while (clock.phase < 0) {
    clock.phase += 1;
    clock.beats -= 1;
  }
  while (clock.phase >= 1) {
    clock.phase -= 1;
    clock.beats += 1;
  }
};

/**
 * Where the onsets put the beat now: the grid laid over the history, its
 * last beat moved onto the sound (HEARD_OFFSET_MS), and carried from the
 * history's newest hop to this moment. The grid stays where the clock is
 * unless another place fits clearly better.
 */
const aimClock = (clock: IRhythmClock) => {
  const periodMs = 60_000 / clock.tempo;
  const period = periodMs / OSS_HOP_MS;
  const ring = clock.beatOnsets;
  // The newest hop in the history ended this long ago, and its middle half
  // a hop before that.
  const newestMs = OSS_HOP_MS - ring.hopLeftMs + OSS_HOP_MS / 2;
  // Where the clock puts the last beat, as hops back in the history.
  const keep = clock.aligned
    ? ((((clock.phase * periodMs - newestMs - HEARD_OFFSET_MS) / OSS_HOP_MS) %
        period) +
        period) %
      period
    : undefined;
  const found = estimatePhase(historyOf(ring), period, keep);
  if (!found) {
    return;
  }
  const sinceBeatMs = newestMs + found.back * OSS_HOP_MS + HEARD_OFFSET_MS;
  clock.target = (sinceBeatMs / periodMs) % 1;
  clock.targetAgeMs = 0;
  clock.hasTarget = true;
  clock.phaseClarity = found.clarity;
};

/**
 * One step of the phase: it runs on at the tempo, and is steered onto where
 * the onsets put the beat - set straight there while nothing is dancing to
 * it yet, and otherwise moved there gradually, a little faster or slower
 * than the tempo for a moment. Pulled onto each kick as it landed, it jumped
 * whenever one was heard wrong or early, and its beats wandered by a hundred
 * milliseconds and more on half the songs measured.
 */
const runClock = (clock: IRhythmClock, stepMs: number) => {
  if (clock.tempo <= 0) {
    return;
  }
  const periodMs = 60_000 / clock.tempo;
  shiftPhase(clock, stepMs / periodMs);
  clock.targetAgeMs += stepMs;
  if (!clock.hasTarget) {
    return;
  }
  const error = aroundBeat(
    clock.target + clock.targetAgeMs / periodMs - clock.phase,
  );
  if (!clock.aligned || clock.confidence < 0.2) {
    shiftPhase(clock, error);
    clock.aligned = true;
    return;
  }
  const most = (STEER_MOST * stepMs) / periodMs;
  shiftPhase(
    clock,
    Math.max(-most, Math.min(most, error * getEaseFactor(stepMs, STEER_MS))),
  );
};

/**
 * Which of the bar's four beats is its first: the one whose kicks land
 * heaviest, snares counted against it (a backbeat is on two and four). In
 * music with the same kick on every beat this is a guess, and it is kept
 * steady rather than wandering: a new first beat has to land a quarter
 * heavier than the old one for a while before the bar moves.
 */
const countBar = (clock: IRhythmClock, weight: number, wasEarly: boolean) => {
  if (clock.phase < 0.25 || clock.phase >= 0.85) {
    clock.beatWeight = Math.max(clock.beatWeight, weight);
    return;
  }
  if (wasEarly) {
    const slot = ((clock.beats % 4) + 4) % 4;
    clock.slots[slot] = clock.slots[slot] * 0.85 + clock.beatWeight * 0.15;
    clock.beatWeight = 0;
    const heaviest = clock.slots.indexOf(Math.max(...clock.slots));
    if (
      heaviest !== clock.downSlot &&
      clock.slots[heaviest] > clock.slots[clock.downSlot] * 1.25 + 0.01
    ) {
      clock.downSlot = heaviest;
    }
  }
};

/**
 * One step of the clock, once this step's onsets are kept: the tempo and the
 * beat grid worked out again when their time comes, the certainty, the phase
 * run on, and the bar weighed by `barWeight` - how hard this step's kick
 * landed, its snare counted against it.
 */
export const followClock = (
  clock: IRhythmClock,
  stepMs: number,
  barWeight: number,
) => {
  if (clock.tempo > 0) {
    clock.heldMs += stepMs;
  }
  clock.sinceTempoMs += stepMs;
  if (clock.sinceTempoMs >= TEMPO_EVERY_MS) {
    clock.sinceTempoMs = 0;
    followTempo(clock);
  }
  clock.sincePhaseMs += stepMs;
  if (clock.sincePhaseMs >= PHASE_EVERY_MS && clock.tempo > 0) {
    clock.sincePhaseMs = 0;
    aimClock(clock);
  }
  const sure =
    clock.tempoClarity *
    clock.tempoAgreement *
    (0.4 + 0.6 * (clock.hasTarget ? clock.phaseClarity : 0));
  clock.confidence += (sure - clock.confidence) * getEaseFactor(stepMs, 1_000);

  const wasEarly = clock.phase < 0.25;
  runClock(clock, stepMs);
  countBar(clock, barWeight, wasEarly);
};

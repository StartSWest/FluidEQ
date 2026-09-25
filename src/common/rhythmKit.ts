/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  listenFor,
  newDetector,
  type IHitDetector,
  type IHitRule,
} from './rhythmDrums';
import {
  createDrumPattern,
  followPattern,
  learnHit,
  patternBias,
  slotOf,
  type IDrumPattern,
} from './rhythmPattern';

/**
 * The drum kit as a scene hears it (`sceneRhythm.ts`): a kick, a snare and
 * the hats, each a detector listening to its own part of the spectrum
 * (`rhythmSpectrum.ts`, `listenFor`), each judged against where in the bar it
 * has been playing (`rhythmPattern.ts`), and each shown only while it has
 * been heard to be a drum.
 *
 * HEARD TO BE A DRUM. A kick is a sudden rise in the low end, and so is a
 * bass note; a snare is a sudden rise in its own range, and so is a piano
 * chord or a strum. What a drum does that a note does not is die away.
 * Measured on made-up songs whose every hit is known, 90 ms after a hit a
 * snare's range had fallen 9 dB (the median; 6.2 for the lowest tenth) and a
 * kick's 4.9 (3.2), where the notes the detectors took for hits in songs with
 * no drums at all had fallen 3.9 and 1.1. So every hit is checked 90 ms after
 * it is heard, and a drum is shown only while most of its recent hits died
 * away as a drum's do: a song with no drums lights no lamp, where the
 * detectors alone lit the kick's and the snare's about once a second (Ivan,
 * 2026-09-24: "this current song doesn't have any of that and it's beating
 * like crazy"). The check never holds a hit back: it decides whether the
 * drum is in the music, and a drum that is shows each hit the moment it is
 * heard.
 *
 * The hats are not checked: a strum's pick and a piano's hammer die away in
 * the top octave as fast as a hat does, so the check would pass them all.
 */

export type TDrum = 'kick' | 'snare' | 'hat';

const DRUMS: readonly TDrum[] = ['kick', 'snare', 'hat'];

/**
 * How each drum's envelope falls after its hit: halving every this many
 * milliseconds. The Studio's made-up music uses the same, so a scene tuned
 * on it moves as it will under real music.
 */
export const KICK_HALF_LIFE_MS = 70;
export const SNARE_HALF_LIFE_MS = 60;
export const HAT_HALF_LIFE_MS = 40;

const HALF_LIFE_MS: Record<TDrum, number> = {
  kick: KICK_HALF_LIFE_MS,
  snare: SNARE_HALF_LIFE_MS,
  hat: HAT_HALF_LIFE_MS,
};

/**
 * What each drum's detector asks of a rise (`listenFor`), chosen over the
 * made-up songs, the ones with no drums at all among them: the snare has to
 * reach four fifths of its tallest recent hit, where a kick's click and an
 * open hat over a bass note reach two thirds; a kick seven tenths; a hat,
 * quieter and more even, not half. Against the detectors these replace, F1
 * went from 0.74, 0.66 and 0.77 to 0.74, 0.89 and 0.81, and the false hits a
 * second in songs with no drums from 1.8, 2.4 and 2.6 to 1.0, 0.5 and 0.35.
 */
const RULES: Record<TDrum, IHitRule> = {
  kick: { margin: 4, share: 0.7, refractoryMs: 120 },
  snare: { margin: 2.5, share: 0.8, refractoryMs: 120 },
  hat: { margin: 2, share: 0.45, refractoryMs: 60 },
};

/**
 * Where each checked drum's level is read, among the rhythm's 24 bands
 * (`soundHops.ts`), both ends included: the kick's 50 to 267 Hz, the snare's
 * 1.1 to 7.4 kHz.
 */
const CHECKED_BANDS: Partial<Record<TDrum, readonly [number, number]>> = {
  kick: [1, 7],
  snare: [14, 21],
};
/** How long after a hit it is checked, and how long its level may still climb. */
const CHECK_AFTER_MS = 90;
const PEAK_WITHIN_MS = 20;
/**
 * How far a drum's range has to have fallen by the check, in dB, or - the
 * snare - how much of its rise it has to have given back. A fall alone lost
 * the soft snares of a ballad, rising 7 dB over the voice and falling 3; a
 * share of the rise alone lost every kick, whose body rings on for longer
 * than a bass note that ends does.
 */
const DIES_AWAY_DB: Partial<Record<TDrum, number>> = { kick: 2, snare: 3 };
const GIVES_BACK: Partial<Record<TDrum, number>> = { snare: 0.35 };
/** How far before a hit its range is taken as it was, in steps: 30 ms of hops. */
const BEFORE_STEPS = 3;
/**
 * How far each checked hit moves a drum's presence, where a new song starts
 * it - under PRESENT, so a drum has to die away once before it is shown - and
 * where it is shown.
 */
const PRESENCE_RATE = 0.25;
const PRESENCE_START = 0.35;
const PRESENT = 0.5;

interface IDrumCheck {
  atMs: number;
  beforeDb: number;
  peakDb: number;
}

export interface IKitDrum {
  detector: IHitDetector;
  pattern: IDrumPattern;
  /** 1 at a hit shown, halving every HALF_LIFE_MS. */
  envelope: number;
  /** How surely this drum is in the music: its recent hits that died away. */
  presence: number;
  /** Hits waiting for CHECK_AFTER_MS to pass. */
  checks: IDrumCheck[];
  /** The checked range's level over the last BEFORE_STEPS steps, oldest first. */
  earlierDb: number[];
  /** Since the last hit shown, in music time. */
  shownSinceMs: number;
}

export type TDrumKit = Record<TDrum, IKitDrum>;

const newKitDrum = (drum: TDrum): IKitDrum => ({
  detector: newDetector(),
  pattern: createDrumPattern(),
  envelope: 0,
  presence: DIES_AWAY_DB[drum] === undefined ? 1 : PRESENCE_START,
  checks: [],
  earlierDb: [],
  shownSinceMs: 60_000,
});

export const createDrumKit = (): TDrumKit => ({
  kick: newKitDrum('kick'),
  snare: newKitDrum('snare'),
  hat: newKitDrum('hat'),
});

/** Where the bar's clock is, for the patterns: undefined while it is unsure. */
export interface IKitClock {
  beats: number;
  phase: number;
  tempo: number;
}

/** The mean level of bands `from` to `to` (0..1 over 100 dB), in dB. */
const levelDb = (
  bands: readonly number[],
  [from, to]: readonly [number, number],
) => {
  let power = 0;
  for (let at = from; at <= to; at += 1) {
    power += 10 ** (((bands[at] ?? 0) * 100 - 100) / 10);
  }
  return 10 * Math.log10(Math.max(1e-12, power / (to - from + 1)));
};

/** A drum's hits whose time has come, checked against how far its range fell. */
const followChecks = (
  drum: IKitDrum,
  name: TDrum,
  level: number,
  atMs: number,
) => {
  const fall = DIES_AWAY_DB[name];
  if (fall === undefined) {
    return;
  }
  drum.checks = drum.checks.filter((check) => {
    const age = atMs - check.atMs;
    if (age <= PEAK_WITHIN_MS) {
      check.peakDb = Math.max(check.peakDb, level);
    }
    if (age < CHECK_AFTER_MS) {
      return true;
    }
    const fell = check.peakDb - level;
    const gaveBack = fell / Math.max(0.5, check.peakDb - check.beforeDb);
    const diedAway =
      fell >= fall || gaveBack >= (GIVES_BACK[name] ?? Infinity) ? 1 : 0;
    drum.presence += (diedAway - drum.presence) * PRESENCE_RATE;
    return false;
  });
};

/**
 * One step of the kit: `features` is what each drum's detector listens to,
 * `bands` the step's bands, `atMs` the music's time, `clock` where the bar
 * is when the clock is sure of it. Returns which drums were shown hitting.
 */
export const hearKit = (
  kit: TDrumKit,
  features: Record<TDrum, number>,
  bands: readonly number[],
  atMs: number,
  clock: IKitClock | undefined,
  stepMs: number,
): Record<TDrum, boolean> => {
  const slot = clock ? slotOf(clock.beats, clock.phase, clock.tempo) : 0;
  const shown: Record<TDrum, boolean> = {
    kick: false,
    snare: false,
    hat: false,
  };
  DRUMS.forEach((name) => {
    const drum = kit[name];
    const bandsOf = CHECKED_BANDS[name];
    const level = bandsOf ? levelDb(bands, bandsOf) : 0;
    followChecks(drum, name, level, atMs);
    const stoodOver = listenFor(
      drum.detector,
      features[name],
      stepMs,
      RULES[name],
      clock ? patternBias(drum.pattern, slot) : 1,
    );
    if (bandsOf) {
      if (stoodOver > 0) {
        drum.checks.push({
          atMs,
          beforeDb: drum.earlierDb[0] ?? level,
          peakDb: level,
        });
      }
      drum.earlierDb.push(level);
      if (drum.earlierDb.length > BEFORE_STEPS) {
        drum.earlierDb.shift();
      }
    }
    drum.shownSinceMs += stepMs;
    shown[name] = stoodOver > 0 && drum.presence >= PRESENT;
    if (shown[name]) {
      drum.envelope = 1;
      drum.shownSinceMs = 0;
    } else {
      drum.envelope *= 2 ** (-stepMs / HALF_LIFE_MS[name]);
    }
    // Where the drum plays is learnt from the hits shown, once the clock is
    // sure enough for "where in the bar" to mean something.
    if (clock) {
      if (shown[name]) {
        learnHit(drum.pattern, slot, stoodOver);
      }
      followPattern(drum.pattern, (stepMs * clock.tempo) / 60_000);
    }
  });
  return shown;
};

/** Nothing heard for `quietMs`: the envelopes fall, and no check can be made. */
export const quietKit = (kit: TDrumKit, quietMs: number) => {
  DRUMS.forEach((name) => {
    kit[name].envelope *= 2 ** (-quietMs / HALF_LIFE_MS[name]);
    kit[name].checks = [];
    kit[name].earlierDb = [];
  });
};

/**
 * A new song: its drums are its own - where they play, and whether they are
 * there at all. The detectors keep what they know of how loud hits stand.
 */
export const restartKit = (kit: TDrumKit) => {
  DRUMS.forEach((name) => {
    const drum = kit[name];
    drum.pattern = createDrumPattern();
    drum.presence = newKitDrum(name).presence;
    drum.checks = [];
    drum.earlierDb = [];
  });
};

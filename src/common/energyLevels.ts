/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { BASS_FROM_HZ, BASS_TO_HZ, isBassBin } from './bassNotes';
import type { IRhythmSpectrum } from './rhythmSpectrum';
import { getEaseFactor } from './smoothing';
import { NOTHING_DB, RHYTHM_BAND_COUNT, rhythmBandEdgeHz } from './soundHops';

/**
 * The four levels a scene is handed (`spectrumEnergy.ts`): the whole, the
 * bass, the mids and the treble - each a part of the music a listener would
 * name. The bass is the kick and the bass line: the low end whose own peak is
 * a bass note's, 30 to 115 Hz. The mids are what sounds there and lasts -
 * pianos, voices, chords - from 200 Hz to 4.5 kHz. The treble is the hats and
 * the cymbals, from 5 kHz up.
 *
 * WHAT WAS WRONG. The three were means of the rhythm's third-octave bands,
 * each stretched between the lowest and highest it had lately been: every
 * drum hit lifted all three, and stretched, every one of them went to the
 * top. Measured over Stayin' Alive, the mids and the treble drew the kick's
 * and the snare's pattern, beat for beat, as the bass did; the treble,
 * starting at 1.8 kHz, was the snare's crack and the singer's consonants,
 * and barely moved when the hats did (Ivan, 2026-09-24: "bass is bass, mid
 * is mid, pianos and so, and trebles are hats").
 *
 * So each part is its own power, summed over its own bins; the mids keep of
 * each bin only what has lasted - the middle of its last 90 ms, which a
 * drum's crack of a few milliseconds never is; and each part is read against
 * its own usual level - its decibels over the last two seconds or so - never
 * stretched: USUAL_READS where it is playing as it has been, 1 PART_SWING_DB
 * over that, nothing well under it, and nothing at all where the part has
 * nothing in it. Read against the loudest it had lately been instead, a
 * dense record's mids sat at 1.00 whatever they did. The whole is read
 * against its loudest lately, so the loud parts of a song read louder than
 * the quiet ones.
 *
 * THE BASS AND A VOICE. Summed from 30 to 200 Hz, the bass was a man's
 * voice: his notes stand from about 100 Hz up, and the window spreads each
 * note's skirt down through every bin below it. On the karaoke feature's
 * separated voice tracks - eighteen songs with nothing in them but the
 * singing - Bass read over 0.3 in half of every sung moment, and near 1
 * through a low phrase (Ivan, 2026-09-24: "bass is for bass only, can't fire
 * with any freq"). A bass note is a peak of its own at 115 Hz or under, and
 * a skirt is the slope of a note higher up, so only the low bins that belong
 * to a bass note count (`bassNotes.ts`); and the bass is there only as a real
 * part of the sound (PRESENCE_DB) - half of an instrumental's power, its
 * median, where a breath, a pop on a "p" or the low edge of a note are 25 dB
 * and more under the loudest. On the same tracks Bass now reads over 0.3 in
 * 1.2% of sung moments - a man's lowest notes, under 115 Hz, and pops - and
 * a song's Bass keeps closer to its instrumental's alone than it did (0.010
 * apart hop by hop, from 0.019). Under made-up bass lines laid over the same
 * voices, notes played 12, 6 and 0 dB under the singing read 0.29, 0.57 and
 * 0.79, where all of them read 0.83 to 0.96; every made-up kick reaches 0.6
 * or more; and between the notes Bass is over 0.3 in 0.7% of moments, where
 * it was in 32%.
 *
 * SILENCE. The analyser writes a bin with nothing in it as NOTHING_DB, and
 * that floor summed over every bin of the whole came to -75 dB, well over
 * the quietest its loudest was allowed to fall to: a dozen seconds after a
 * song stopped, the loudest had fallen to the silence itself, and nothing
 * playing read a level of 1 and every part 0.55 (Ivan's screenshot,
 * 2026-09-24) - and the level, squared, went on winding the music's wheel
 * (`spectrumEnergy.ts`). The same floor summed was the whole of a quiet
 * song's treble, which read 0.55 with no hats in it. A bin at the floor now
 * carries nothing, and a part with nothing in it is absent.
 */

export interface ILevelState {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** The loudest the whole has lately been, in dB; undefined before the first. */
  ceiling: number | undefined;
  /** Each part's usual level lately, in dB; undefined before the first. */
  usual: Record<TLevelPart, number | undefined>;
  /** Each mid bin's last MID_HISTORY powers, a ring, for its lasting part. */
  midHistory: Float32Array;
  midAt: number;
}

export type TLevelPart = 'bass' | 'mid' | 'treble';

/** Where the parts are, in Hz: the bass's notes are `bassNotes.ts`'s. */
const MID_FROM_HZ = 200;
const MID_TO_HZ = 4_500;
const TREBLE_FROM_HZ = 5_000;
const TREBLE_TO_HZ = 16_000;

/**
 * Each bin of the mids keeps the middle of its last this-many hops (90 ms):
 * a sound that lasts is in most of them, a drum's hit in one or two.
 */
const MID_HISTORY = 9;

/** How far under the whole's loudest lately it reads nothing, in dB. */
const LEVEL_WINDOW_DB = 24;
/** How fast that loudest is let go of, in dB a second. */
const CEILING_RELEASE_DB_S = 4;
/** What a part playing at its usual level reads, and how far over it reads 1. */
const USUAL_READS = 0.55;
const PART_SWING_DB = 10;
/**
 * How quickly a part's usual level follows it, up and down: a chorus coming
 * in after a quiet verse is its new usual within a second or so, and a quiet
 * bar takes longer to lower it. Started from nothing, one symmetrical follow
 * held every part at 1 for the first four seconds of every song.
 */
const USUAL_RISE_MS = 700;
const USUAL_FALL_MS = 1_400;
/**
 * How far under the whole's loudest lately each part is nothing, and where it
 * is wholly there, in dB. Anything 40 dB under is no part of the mids or the
 * treble. The bass has to be more than a trace (THE BASS AND A VOICE):
 * nothing at 25 dB under, all there at 15. Measured on the same voices,
 * nothing at 28 dB under lit Bass 40% more often; all there at 10 dB under
 * read a bass played 12 dB under the singing at 0.25 or less nearly half
 * again as often.
 */
const PRESENCE_DB: Record<TLevelPart, readonly [number, number]> = {
  bass: [25, 15],
  mid: [40, 30],
  treble: [40, 30],
};
/** The quietest the whole's loudest is taken to be: under this nothing plays. */
const LEVEL_FLOOR_DB = -90;

/**
 * How quickly each part falls away: they rise at once. The hats' fall is the
 * shortest, so eighths stay apart; the mids', longest, so a voice or a chord
 * reads as the line it is.
 */
const RELEASE_MS: Record<TLevelPart | 'level', number> = {
  level: 120,
  bass: 90,
  mid: 150,
  treble: 50,
};

export const createLevelState = (): ILevelState => ({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  ceiling: undefined,
  usual: { bass: undefined, mid: undefined, treble: undefined },
  midHistory: new Float32Array(0),
  midAt: 0,
});

/** The rhythm's bands from `fromHz` to `toHz`, both ends included. */
const bandsBetween = (
  fromHz: number,
  toHz: number,
): readonly [number, number] => {
  let first = 0;
  let last = RHYTHM_BAND_COUNT - 1;
  for (let band = 0; band < RHYTHM_BAND_COUNT; band += 1) {
    if (rhythmBandEdgeHz(band + 1) <= fromHz) {
      first = band + 1;
    }
    if (rhythmBandEdgeHz(band) < toHz) {
      last = band;
    }
  }
  return [first, last];
};

/**
 * Which of the rhythm's bands a part is heard in, both ends included: the
 * bass's reaches up to where the mids start, the skirts of its notes too.
 */
export const levelBandsOf = (part: TLevelPart): readonly [number, number] => {
  const [fromHz, toHz] = {
    bass: [BASS_FROM_HZ, MID_FROM_HZ],
    mid: [MID_FROM_HZ, MID_TO_HZ],
    treble: [TREBLE_FROM_HZ, TREBLE_TO_HZ],
  }[part];
  return bandsBetween(fromHz, toHz);
};

/**
 * Where the parts meet, in Hertz. A part heard on its own (the Studio's Bass,
 * Mids and Treble) is everything on its side of them.
 */
export const BASS_HZ: readonly [number, number] = [0, MID_FROM_HZ];
export const MID_HZ: readonly [number, number] = [MID_FROM_HZ, TREBLE_FROM_HZ];
export const TREBLE_HZ: readonly [number, number] = [
  TREBLE_FROM_HZ,
  Number.POSITIVE_INFINITY,
];

/** A bin's power: none at all in a bin with nothing in it (SILENCE). */
const powerOf = (db: number) => (db <= NOTHING_DB ? 0 : 10 ** (db / 10));

/** The summed power of `bins` (dB) whose frequencies fall in [fromHz, toHz). */
const partPower = (
  bins: Float32Array,
  binHz: number,
  fromHz: number,
  toHz: number,
) => {
  let power = 0;
  const first = Math.max(1, Math.ceil(fromHz / binHz));
  const last = Math.min(bins.length - 1, Math.ceil(toHz / binHz) - 1);
  for (let bin = first; bin <= last; bin += 1) {
    power += powerOf(bins[bin]);
  }
  return power;
};

/** The bass's power: the low bins, under the mids, that belong to a bass note. */
const bassPower = (bins: Float32Array, binHz: number) => {
  let power = 0;
  const last = Math.min(bins.length - 1, Math.ceil(MID_FROM_HZ / binHz) - 1);
  for (let bin = 1; bin <= last; bin += 1) {
    if (isBassBin(bins, binHz, bin)) {
      power += powerOf(bins[bin]);
    }
  }
  return power;
};

/** The middle of `values`, which it reorders. */
const middleOf = (values: Float32Array) => {
  values.sort();
  return values[Math.floor(values.length / 2)];
};

/**
 * The mids' lasting power: each of `powers` kept in its bin's history, and
 * the middle of that history summed.
 */
const lastingPower = (state: ILevelState, powers: Float32Array) => {
  if (state.midHistory.length !== powers.length * MID_HISTORY) {
    state.midHistory = new Float32Array(powers.length * MID_HISTORY);
    state.midAt = 0;
  }
  const scratch = new Float32Array(MID_HISTORY);
  let sum = 0;
  for (let bin = 0; bin < powers.length; bin += 1) {
    const base = bin * MID_HISTORY;
    state.midHistory[base + state.midAt] = powers[bin];
    scratch.set(state.midHistory.subarray(base, base + MID_HISTORY));
    sum += middleOf(scratch);
  }
  state.midAt = (state.midAt + 1) % MID_HISTORY;
  return sum;
};

/** The mids' bins of a hop's short window, as powers. */
const midPowersOf = (spectrum: IRhythmSpectrum) => {
  const first = Math.ceil(MID_FROM_HZ / spectrum.highBinHz);
  const last = Math.min(
    spectrum.high.length - 1,
    Math.ceil(MID_TO_HZ / spectrum.highBinHz) - 1,
  );
  const powers = new Float32Array(Math.max(0, last - first + 1));
  for (let bin = first; bin <= last; bin += 1) {
    powers[bin - first] = powerOf(spectrum.high[bin]);
  }
  return powers;
};

/** The same parts from the rhythm's bands, for music that comes as a spectrum alone. */
const bandPowers = (
  bands: readonly number[],
  [first, last]: readonly [number, number],
) => {
  const powers = new Float32Array(last - first + 1);
  for (let band = first; band <= last; band += 1) {
    powers[band - first] = powerOf(
      (bands[band] ?? 0) * -NOTHING_DB + NOTHING_DB,
    );
  }
  return powers;
};

const sum = (values: Float32Array) =>
  values.reduce((total, value) => total + value, 0);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const dbOf = (power: number) => 10 * Math.log10(Math.max(1e-12, power));

/** A reading moved to `target`: at once when it rises, eased as it falls. */
const settle = (
  state: ILevelState,
  part: TLevelPart | 'level',
  target: number,
  stepMs: number,
) => {
  const now = state[part];
  state[part] =
    target >= now
      ? target
      : now + (target - now) * getEaseFactor(stepMs, RELEASE_MS[part]);
};

/** The whole's reading from its power: against its loudest lately. */
const followWhole = (state: ILevelState, power: number, stepMs: number) => {
  const db = dbOf(power);
  const previous = state.ceiling;
  const ceiling = Math.max(
    LEVEL_FLOOR_DB,
    db,
    previous === undefined
      ? db
      : previous - (CEILING_RELEASE_DB_S * stepMs) / 1_000,
  );
  state.ceiling = ceiling;
  settle(
    state,
    'level',
    clamp01((db - ceiling + LEVEL_WINDOW_DB) / LEVEL_WINDOW_DB),
    stepMs,
  );
};

/** A part's reading from its power: against its own usual level. */
const followPart = (
  state: ILevelState,
  part: TLevelPart,
  power: number,
  stepMs: number,
) => {
  const db = dbOf(power);
  // A part with nothing in it is nothing, and one with next to nothing in
  // it, against the whole, is nothing too.
  const [absentDb, fullDb] = PRESENCE_DB[part];
  const present =
    power > 0
      ? clamp01(
          (db - ((state.ceiling ?? LEVEL_FLOOR_DB) - absentDb)) /
            (absentDb - fullDb),
        )
      : 0;
  const previous = state.usual[part];
  if (previous === undefined && present < 0.5) {
    // Its usual level starts from its first real sound.
    settle(state, part, 0, stepMs);
    return;
  }
  // A part with nothing in it says nothing of how it usually plays, and its
  // usual level stands where it was. Followed down into the gaps between a
  // bass line's notes instead, it put every next note 10 dB over its usual,
  // and Bass read 1 through the whole line however it was played.
  let usual = previous ?? db;
  if (previous !== undefined && present > 0) {
    usual +=
      (db - previous) *
      getEaseFactor(stepMs, db > previous ? USUAL_RISE_MS : USUAL_FALL_MS);
  }
  state.usual[part] = usual;
  const target = clamp01(
    USUAL_READS + ((db - usual) * (1 - USUAL_READS)) / PART_SWING_DB,
  );
  settle(state, part, target * present, stepMs);
};

/**
 * One step of the four levels: from a hop's own bins where there are any,
 * else from the rhythm's bands (0..1 over 100 dB), which are too coarse to
 * tell a bass note's peak from a skirt: there the bass is its range's power.
 */
export const followLevels = (
  state: ILevelState,
  bands: readonly number[],
  spectrum: IRhythmSpectrum | undefined,
  stepMs: number,
) => {
  let bass: number;
  let mid: number;
  let treble: number;
  let all: number;
  if (spectrum) {
    bass = bassPower(spectrum.low, spectrum.lowBinHz);
    mid = lastingPower(state, midPowersOf(spectrum));
    treble = partPower(
      spectrum.high,
      spectrum.highBinHz,
      TREBLE_FROM_HZ,
      TREBLE_TO_HZ,
    );
    all =
      partPower(spectrum.low, spectrum.lowBinHz, BASS_FROM_HZ, MID_FROM_HZ) +
      partPower(spectrum.high, spectrum.highBinHz, MID_FROM_HZ, TREBLE_TO_HZ);
  } else {
    bass = sum(bandPowers(bands, bandsBetween(BASS_FROM_HZ, BASS_TO_HZ)));
    mid = lastingPower(state, bandPowers(bands, levelBandsOf('mid')));
    treble = sum(bandPowers(bands, levelBandsOf('treble')));
    all = sum(bandPowers(bands, [0, bands.length - 1]));
  }
  followWhole(state, all, stepMs);
  followPart(state, 'bass', bass, stepMs);
  followPart(state, 'mid', mid, stepMs);
  followPart(state, 'treble', treble, stepMs);
};

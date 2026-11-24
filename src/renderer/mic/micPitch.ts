/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The lowest note of a voice, for the Low cut picture's "keep the cut under
 * it": the fundamental of each voiced moment, read from the arrival tap's
 * long window, and a low percentile of those over the last half minute.
 *
 * Read by subharmonic summation (Hermes, 1988): every candidate fundamental
 * scores the spectrum at its first ten harmonics, each weighted 0.84 per
 * step up. The weights are what keep it off the octaves: half the true pitch
 * finds every harmonic again but only at the even steps, where the weights
 * are smaller, and twice it misses the odd harmonics altogether. Levels are
 * taken 40 dB down from the loudest and no further, so a formant cannot
 * outvote the comb and the room under the voice counts for nothing.
 *
 * A moment counts as voiced only when its harmonics stand clear of the
 * valleys between them (a comb, not a hiss) AND the voice's band stands
 * 12 dB over what the room has been lately: a steady mains hum is a comb
 * too, and between words it would otherwise be read as a note at 100 Hz.
 *
 * The long window is what makes this possible at all: 16384 points are
 * 2.9 Hz a bin at 48 kHz, where the 2048-point window's 23 Hz bins put a
 * deep voice's first three harmonics in four bins.
 */

const LOWEST_HZ = 60;
const HIGHEST_HZ = 500;
const STEP_HZ = 0.5;
const HARMONICS = 10;
const WEIGHT = 0.84;
/** Where harmonics are looked for: a voice's comb is clear under this. */
const TOP_HARMONIC_HZ = 4000;
const RANGE_DB = 40;
/** The first harmonics, whose peaks against their valleys say "comb". */
const CONTRAST_HARMONICS = 6;
/**
 * How far, on average, those peaks must stand over the valleys half way
 * between them. A voiced vowel's low harmonics stand 15 to 30 dB clear, a
 * breathy one 10 to 15; hiss and a room stand nowhere.
 */
const CONTRAST_DB = 8;
/** The voice's band, for "is anybody speaking". */
const BAND_LOW_HZ = 200;
const BAND_HIGH_HZ = 2500;

export interface IPitchMoment {
  /** The fundamental, Hz, when the moment is a comb at all. */
  hz?: number;
  /** The voice band's level, dB on the window's own scale. */
  bandDb: number;
}

/** One moment of the long window: its comb's fundamental and its loudness. */
export const voicePitch = (
  detailDb: Float32Array,
  binHz: number,
): IPitchMoment => {
  const top = Math.min(
    detailDb.length - 2,
    Math.floor(TOP_HARMONIC_HZ / binHz),
  );
  let loudest = -Infinity;
  let bandPower = 0;
  for (let bin = Math.ceil(LOWEST_HZ / binHz); bin <= top; bin += 1) {
    const hz = bin * binHz;
    loudest = Math.max(loudest, detailDb[bin]);
    if (hz >= BAND_LOW_HZ && hz <= BAND_HIGH_HZ) {
      bandPower += 10 ** (detailDb[bin] / 10);
    }
  }
  const bandDb = bandPower > 0 ? 10 * Math.log10(bandPower) : -Infinity;
  if (!Number.isFinite(loudest)) {
    return { bandDb };
  }
  const floor = loudest - RANGE_DB;
  // The bin either side too: a harmonic between two bins reads in both.
  const peakDb = (hz: number) => {
    const at = Math.min(top, Math.max(1, Math.round(hz / binHz)));
    return Math.max(detailDb[at - 1], detailDb[at], detailDb[at + 1]);
  };
  const strength = (hz: number) =>
    hz / binHz > top ? 0 : Math.max(0, peakDb(hz) - floor) / RANGE_DB;
  let best = 0;
  let bestHz = 0;
  for (let hz = LOWEST_HZ; hz <= HIGHEST_HZ; hz += STEP_HZ) {
    let score = 0;
    let weight = 1;
    for (let h = 1; h <= HARMONICS && h * hz <= TOP_HARMONIC_HZ; h += 1) {
      score += weight * strength(h * hz);
      weight *= WEIGHT;
    }
    if (score > best) {
      best = score;
      bestHz = hz;
    }
  }
  let contrast = 0;
  for (let h = 1; h <= CONTRAST_HARMONICS; h += 1) {
    const valley = Math.min(top, Math.round(((h + 0.5) * bestHz) / binHz));
    contrast += peakDb(h * bestHz) - detailDb[valley];
  }
  return best > 0 && contrast / CONTRAST_HARMONICS >= CONTRAST_DB
    ? { hz: bestHz, bandDb }
    : { bandDb };
};

/** How long the lowest note remembers, and how many moments it needs. */
const MEMORY_MS = 30_000;
const ENOUGH = 24;
/** The tenth percentile: a voice's bottom, not one growl's. */
const LOW_SHARE = 0.1;
/** The room: the quietest tenth of the voice band over the last 4 s. */
const ROOM_MS = 4000;
const ROOM_SHARE = 0.1;
/** How far over the room the band must stand for a moment to be speech. */
const SPEECH_OVER_ROOM_DB = 12;

export interface ILowestNote {
  /** One moment of the long window. */
  add: (at: number, moment: IPitchMoment) => void;
  /** The voice's lowest note so far, once enough has been heard. */
  read: (now: number) => number | undefined;
  reset: () => void;
}

export const createLowestNote = (): ILowestNote => {
  const notes: { at: number; hz: number }[] = [];
  const bands: { at: number; db: number }[] = [];
  const forget = (now: number) => {
    while (notes.length > 0 && now - notes[0].at > MEMORY_MS) {
      notes.shift();
    }
    while (bands.length > 0 && now - bands[0].at > ROOM_MS) {
      bands.shift();
    }
  };
  return {
    add: (at, moment) => {
      if (Number.isFinite(moment.bandDb)) {
        bands.push({ at, db: moment.bandDb });
      }
      forget(at);
      if (moment.hz === undefined || bands.length < 2) {
        return;
      }
      const sorted = bands.map((band) => band.db).sort((a, b) => a - b);
      const room = sorted[Math.floor(sorted.length * ROOM_SHARE)];
      if (moment.bandDb >= room + SPEECH_OVER_ROOM_DB) {
        notes.push({ at, hz: moment.hz });
      }
    },
    read: (now) => {
      forget(now);
      if (notes.length < ENOUGH) {
        return undefined;
      }
      const sorted = notes.map((note) => note.hz).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * LOW_SHARE)];
    },
    reset: () => {
      notes.length = 0;
      bands.length = 0;
    },
  };
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from './smoothing';
import type { IVoiceSpectrum } from './soundHops';

/**
 * The singing voice (`spectrumEnergy.ts`): how open a singer's mouth is now,
 * the note being sung, and how sure it is that anybody is singing - for a
 * creature whose lips move with the song, or anything else that follows a
 * voice (Ivan, 2026-09-24).
 *
 * A lead vocal stands in the middle of the mix, where a stereo record puts
 * it, and sings one note at a time. So the voice is heard in the power left
 * and right share - the mid's, less the side's, bin by bin - between 200 Hz
 * and 4 kHz, where a voice's harmonics and its vowels are; and it counts as
 * a voice only as far as that is a line of notes: the pitch whose harmonics
 * stand clearest over the troughs between them, holding together from one
 * hop to the next - gliding, bending, wavering in vibrato, but never
 * leaping about. Measured on real records, how clear the comb stood could
 * not tell a strummed guitar from a singer - both stood two to three times
 * the band's mean - but the pitch could: through the guitar that opens
 * Rolling in the Deep it scattered over three octaves from hop to hop, and
 * the moment Adele sang it drew her melody. A snare in the middle is noise
 * and makes no line; a guitar panned to one side leaves with the side. A
 * lead synth or a guitar solo in the middle does draw one, and is heard as
 * a singer, which for a mouth singing along is no worse than silence.
 */

export interface IVoiceReading {
  /** How open a singer's mouth is: 0 closed, 1 as loud as the voice has lately sung. */
  open: number;
  /** The note being sung, 0 at 80 Hz to 1 at 1 kHz on a log scale; held between notes. */
  pitch: number;
  /** How sure it is that a voice is singing now, 0..1. */
  sure: number;
}

export const SILENT_VOICE: IVoiceReading = { open: 0, pitch: 0, sure: 0 };

/** Where a voice's harmonics are looked for: bass and kicks own what is below. */
const LOW_HZ = 200;
const TOP_HZ = 4_000;
/** The notes a voice sings, and where `pitch` puts them. */
export const VOICE_LOW_HZ = 80;
export const VOICE_HIGH_HZ = 1_000;
/** Each pitch tried is this much above the last: a quarter of a semitone. */
const PITCH_STEP = 2 ** (1 / 48);
/** No more harmonics than this are weighed, and no fewer than this found. */
const MOST_HARMONICS = 12;
const FEWEST_HARMONICS = 3;
/**
 * How far the clearest comb has to stand over its troughs, as a share of the
 * band's mean, before anything counts: under it is noise, a snare, silence.
 */
const COMB_FLOOR = 0.8;
const COMB_FULL = 1.2;
/** Hops the line is judged over (70 ms), and the step it may take between two. */
const LINE_HOPS = 7;
const LINE_STEP_SEMITONES = 0.6;
/** The share of steps that have to hold for the line to begin to count, and fully. */
const LINE_FROM = 0.5;
const LINE_FULL = 0.85;
/** How quickly a mouth closes when the voice falls away. It opens at once. */
const OPEN_RELEASE_MS = 70;
/**
 * How quickly the mouth's gate opens on a line of notes and closes off one:
 * a syllable's pitch wobbles for a hop or two between notes, and a gate
 * that shut on every wobble made the mouth blink through a held word.
 */
const GATE_OPEN_MS = 30;
const GATE_CLOSE_MS = 120;
/** How far under the loudest the voice has lately sung a mouth is closed, in dB. */
const OPEN_DEPTH_DB = 30;
/** How fast the loudest is let go of: over a few seconds, as a phrase ends. */
const LOUDEST_RELEASE_DB_S = 3;
/** How quickly the certainty follows, and a new note is taken up. */
const SURE_MS = 250;
const PITCH_MS = 25;

export interface IVoiceState {
  open: number;
  pitch: number;
  sure: number;
  /** The loudest the voice has lately sung, in dB; undefined before the first. */
  loudestDb: number | undefined;
  /** What the last step heard, for a debugging eye: harmonicity and the pitch in Hz. */
  harmonicity: number;
  pitchHz: number;
  /** The centre's amplitudes, a bin each, reused from step to step. */
  centre: Float32Array;
  /** The clearest pitch of the last LINE_HOPS hops, in semitones, oldest first. */
  line: number[];
  /** How far the mouth's gate stands open, 0..1. */
  gate: number;
}

export const createVoiceState = (): IVoiceState => ({
  open: 0,
  pitch: 0,
  sure: 0,
  loudestDb: undefined,
  harmonicity: 0,
  pitchHz: 0,
  centre: new Float32Array(0),
  line: [],
  gate: 0,
});

export const readVoice = (state: IVoiceState): IVoiceReading => ({
  open: state.open,
  pitch: state.pitch,
  sure: state.sure,
});

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** `values` read between bins, linearly; 0 outside them. */
const at = (values: Float32Array, bin: number) => {
  const whole = Math.floor(bin);
  if (whole < 0 || whole + 1 >= values.length) {
    return 0;
  }
  const part = bin - whole;
  return values[whole] * (1 - part) + values[whole + 1] * part;
};

/**
 * The note whose harmonics stand clearest over the troughs between them, and
 * how clearly, as a share of the band's mean amplitude.
 */
const clearestNote = (centre: Float32Array, binHz: number, mean: number) => {
  let best = 0;
  let bestHz = 0;
  for (let f0 = VOICE_LOW_HZ; f0 <= VOICE_HIGH_HZ; f0 *= PITCH_STEP) {
    let standing = 0;
    let counted = 0;
    for (
      let harmonic = Math.ceil(LOW_HZ / f0);
      harmonic * f0 <= TOP_HZ && counted < MOST_HARMONICS;
      harmonic += 1
    ) {
      const hz = harmonic * f0;
      const peak = at(centre, hz / binHz);
      const trough =
        0.5 *
        (at(centre, (hz - f0 / 2) / binHz) + at(centre, (hz + f0 / 2) / binHz));
      standing += peak - trough;
      counted += 1;
    }
    if (counted >= FEWEST_HARMONICS && standing / counted > best) {
      best = standing / counted;
      bestHz = f0;
    }
  }
  return { hz: bestHz, clearness: mean > 0 ? best / mean : 0 };
};

/** One hop of the voice. */
export const followVoice = (
  state: IVoiceState,
  spectrum: IVoiceSpectrum,
  stepMs: number,
) => {
  const { mid, side, binHz } = spectrum;
  if (state.centre.length !== mid.length) {
    state.centre = new Float32Array(mid.length);
  }
  const { centre } = state;
  const from = Math.ceil(LOW_HZ / binHz);
  const to = Math.min(mid.length - 1, Math.floor(TOP_HZ / binHz));
  let sum = 0;
  let power = 0;
  for (let bin = 0; bin < mid.length; bin += 1) {
    const shared = Math.max(0, 10 ** (mid[bin] / 10) - 10 ** (side[bin] / 10));
    centre[bin] = Math.sqrt(shared);
    if (bin >= from && bin <= to) {
      sum += centre[bin];
      power += shared;
    }
  }
  const mean = sum / Math.max(1, to - from + 1);
  const note = clearestNote(centre, binHz, mean);
  state.harmonicity = note.clearness;
  // The line: how many of the last steps stayed within a step of each other.
  state.line.push(note.hz > 0 ? 12 * Math.log2(note.hz / VOICE_LOW_HZ) : -99);
  if (state.line.length > LINE_HOPS) {
    state.line.shift();
  }
  let held = 0;
  for (let at = 1; at < state.line.length; at += 1) {
    if (Math.abs(state.line[at] - state.line[at - 1]) <= LINE_STEP_SEMITONES) {
      held += 1;
    }
  }
  const holding = held / (LINE_HOPS - 1);
  const voiced =
    clamp01((holding - LINE_FROM) / (LINE_FULL - LINE_FROM)) *
    clamp01((note.clearness - COMB_FLOOR) / (COMB_FULL - COMB_FLOOR));

  // How loud the voice is, against the loudest it has lately sung.
  const db = 10 * Math.log10(Math.max(1e-12, power));
  if (voiced > 0) {
    state.loudestDb =
      state.loudestDb === undefined
        ? db
        : Math.max(
            db,
            state.loudestDb - (LOUDEST_RELEASE_DB_S * stepMs) / 1_000,
          );
  }
  const placed =
    state.loudestDb === undefined
      ? 0
      : Math.max(
          0,
          Math.min(1, (db - state.loudestDb + OPEN_DEPTH_DB) / OPEN_DEPTH_DB),
        );
  state.gate +=
    (voiced - state.gate) *
    getEaseFactor(stepMs, voiced > state.gate ? GATE_OPEN_MS : GATE_CLOSE_MS);
  const open = placed * state.gate;
  state.open =
    open >= state.open
      ? open
      : state.open +
        (open - state.open) * getEaseFactor(stepMs, OPEN_RELEASE_MS);

  if (voiced >= 0.5) {
    state.pitchHz = note.hz;
    const pitch =
      Math.log2(note.hz / VOICE_LOW_HZ) /
      Math.log2(VOICE_HIGH_HZ / VOICE_LOW_HZ);
    state.pitch += (pitch - state.pitch) * getEaseFactor(stepMs, PITCH_MS);
  }
  state.sure += (voiced - state.sure) * getEaseFactor(stepMs, SURE_MS);
};

/** Nothing heard for `quietMs`: the mouth closes and the certainty falls; the note holds. */
export const quietVoice = (state: IVoiceState, quietMs: number) => {
  state.open *= 1 - getEaseFactor(quietMs, OPEN_RELEASE_MS);
  state.sure *= 1 - getEaseFactor(quietMs, SURE_MS);
  state.gate *= 1 - getEaseFactor(quietMs, GATE_CLOSE_MS);
  state.line.length = 0;
};

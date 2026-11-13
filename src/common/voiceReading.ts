/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from './smoothing';
import { HOP_MS, type IVoiceSpectrum } from './soundHops';

/**
 * The voice (`spectrumEnergy.ts`): how sure it is that somebody is singing
 * or speaking now, how open their mouth is, and the note - for a character
 * whose lips move with the song, and for nothing else (Ivan, 2026-11-13:
 * "make sure the voice channel is really a voice detector").
 *
 * WHAT WAS WRONG. It was "a line of notes in the middle of the mix": the
 * pitch whose harmonics stood clearest, holding together from hop to hop.
 * A bass line, a piano's melody, a guitar's riff and a synth are lines of
 * notes in the middle too. Measured on nineteen songs against their own
 * separated voice tracks, which say when somebody sings: it said "voice" in
 * 39% of the sung moments and in 26% of the unsung ones, and through the
 * same songs with the voice taken out - nothing but instruments - a mouth
 * stood open (over 0.3) 57% of the time. On five of the nineteen it was
 * surer of a voice between the phrases than in them.
 *
 * WHAT A VOICE DOES THAT AN INSTRUMENT DOES NOT. A string, a key and a reed
 * hold the pitch they are given: their partials stand still, to the cent,
 * from the attack to the next note. A voice never does - it glides into a
 * note, wavers on it and bends out of it, and because every harmonic is a
 * multiple of the one pitch, all of them move the same number of cents at
 * once. So each partial in the middle of the mix is followed by the
 * frequency its phase says it has (far finer than a bin: 1.5 Hz or so),
 * from one hop to the one two before, and what is measured is how much of
 * the middle's power moved TOGETHER, by the same few cents, while it moved
 * at all. Beside it: how much of the band stands in the middle at all (a
 * lead voice is mixed there), how far the moves reach, and how far apart
 * they are. Four numbers, weighed once against the same nineteen songs
 * (WEIGHTS), each song judged by weights fitted without it: "voice" in 83%
 * of sung moments, 14% of unsung, 13% of the instrumentals alone.
 *
 * What it still takes for a voice: anything that glides and wavers as one
 * does and stands in the middle - a bowed string's solo, a slide guitar, a
 * lead synth with vibrato, a talk box. And what it misses: a voice mixed
 * hard to one side, and one drowned 15 dB under its band.
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
/**
 * Where its partials are followed: under this a hertz and a half of doubt
 * is a dozen cents, as much as a voice moves.
 */
const PARTIALS_FROM_HZ = 450;
/** The notes a voice sings, and where `pitch` puts them. */
export const VOICE_LOW_HZ = 80;
export const VOICE_HIGH_HZ = 1_000;
/** Each pitch tried is this much above the last: a quarter of a semitone. */
const PITCH_STEP = 2 ** (1 / 48);
/** No more harmonics than this are weighed, and no fewer than this found. */
const MOST_HARMONICS = 12;
const FEWEST_HARMONICS = 3;

/** A partial counts down to this share of the band's loudest bin: 30 dB. */
const PARTIAL_DEPTH = 1e-3;
const MOST_PARTIALS = 96;
/** Each partial is followed from the hop this many before: 20 ms. */
const FOLLOW_HOPS = 2;
/** And is the same partial only within this of where it was: 80 cents. */
const FOLLOW_RATIO = 2 ** (80 / 1_200) - 1;
/** The partials stood still if their middle moved less than this: the phase's own doubt. */
const STILL_CENTS = 3;
/** The moves count as one voice's within this of their middle, in cents or as a share of it. */
const TOGETHER_CENTS = 4;
const TOGETHER_SHARE = 0.35;
/** What a hop's move and spread are counted up to, in cents. */
const WOBBLE_MOST = 30;
const SPREAD_MOST = 40;
/** How long the four numbers are weighed over. */
const TRAITS_MS = 250;

/**
 * The four numbers' weights (WHAT A VOICE DOES), fitted by logistic
 * regression on nineteen songs' sung and unsung moments and the same songs'
 * instrumentals: sure = 1 / (1 + exp(-(bias + sum of weight x number))).
 */
const WEIGHTS = {
  bias: -13.322,
  share: 7.274,
  together: 13.633,
  wobble: 0.0282,
  spread: 0.3016,
};

/** How quickly a mouth closes when the voice falls away. It opens at once. */
const OPEN_RELEASE_MS = 70;
/**
 * How quickly the mouth's gate opens on a voice and closes off one: a
 * syllable's pitch wobbles for a hop or two between notes, and a gate that
 * shut on every wobble made the mouth blink through a held word.
 */
const GATE_OPEN_MS = 30;
const GATE_CLOSE_MS = 120;
/**
 * How sure of a voice the gate begins to open at, and stands wide open at.
 * Shut until an even chance and wide open at three in four, the mouth was
 * cut off through the unsure moments inside a phrase: against the voice's
 * own loudness it moved at a correlation of 0.26 (the median of the
 * nineteen songs), open in 80% of sung moments and 18% of unsung. From 0.3
 * to 0.6, with a syllable's 20 dB to move through: 0.44, 84% and 23%.
 */
const GATE_FROM = 0.3;
const GATE_FULL = 0.6;
/** How far under the loudest the voice has lately sung a mouth is closed, in dB. */
const OPEN_DEPTH_DB = 20;
/** How fast the loudest is let go of: over a few seconds, as a phrase ends. */
const LOUDEST_RELEASE_DB_S = 3;
/** How quickly the certainty follows, and a new note is taken up. */
const SURE_MS = 120;
const PITCH_MS = 25;

/** One hop's partials: where each really is, and its power. */
interface IPartials {
  hz: Float32Array;
  power: Float32Array;
  count: number;
}

/** The four numbers, weighed over TRAITS_MS (WHAT A VOICE DOES). */
export interface IVoiceTraits {
  /** The middle's share of the band's power. */
  share: number;
  /** The share of the partials' power that moved together. */
  together: number;
  /** How far the partials moved, in cents a hop. */
  wobble: number;
  /** How far apart their moves were, in cents. */
  spread: number;
}

export interface IVoiceState {
  open: number;
  pitch: number;
  sure: number;
  /** The loudest the voice has lately sung, in dB; undefined before the first. */
  loudestDb: number | undefined;
  /** The note last heard, in Hz, for a debugging eye. */
  pitchHz: number;
  /** The centre's amplitudes, a bin each, reused from step to step. */
  centre: Float32Array;
  /** The mid's phase at the hop before, and whether there is one. */
  phase: Float32Array;
  phased: boolean;
  /** The last hops' partials, a ring, and the slot written last. */
  partials: IPartials[];
  partialsAt: number;
  /** The four numbers, and the power the share that moved together is out of. */
  traits: IVoiceTraits;
  movedTogether: number;
  movedOutOf: number;
  /** How far the mouth's gate stands open, 0..1. */
  gate: number;
}

const newPartials = (): IPartials => ({
  hz: new Float32Array(MOST_PARTIALS),
  power: new Float32Array(MOST_PARTIALS),
  count: 0,
});

export const createVoiceState = (): IVoiceState => ({
  open: 0,
  pitch: 0,
  sure: 0,
  loudestDb: undefined,
  pitchHz: 0,
  centre: new Float32Array(0),
  phase: new Float32Array(0),
  phased: false,
  partials: Array.from({ length: FOLLOW_HOPS + 1 }, newPartials),
  partialsAt: 0,
  traits: { share: 0, together: 0, wobble: 0, spread: SPREAD_MOST },
  movedTogether: 0,
  movedOutOf: 0,
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

/** The note whose harmonics stand clearest over the troughs between them, in Hz. */
const clearestNote = (centre: Float32Array, binHz: number) => {
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
  return bestHz;
};

/** What one hop's partials did against the hop FOLLOW_HOPS before. */
interface IMoves {
  /** The partials' power, and how much of it moved together. */
  power: number;
  together: number;
  /** The middle of the moves, in cents, and how far apart they were. */
  drift: number;
  spread: number;
}

const moveCents = new Float32Array(MOST_PARTIALS);
const movePower = new Float32Array(MOST_PARTIALS);
const moveOrder = new Uint8Array(MOST_PARTIALS);

/**
 * This hop's partials, each at the frequency its phase says it has, kept in
 * `now`; and how they moved against `before`'s. A partial is a bin louder
 * than both its neighbours; its frequency is its bin's, moved by how far its
 * phase ran ahead of or behind the bin's own since the hop before.
 */
const followPartials = (
  state: IVoiceState,
  spectrum: IVoiceSpectrum,
  now: IPartials,
  before: IPartials,
): IMoves => {
  const { centre } = state;
  const { binHz, phase, advanceMs } = spectrum;
  const from = Math.max(2, Math.ceil(PARTIALS_FROM_HZ / binHz));
  const to = Math.min(centre.length - 2, Math.floor(TOP_HZ / binHz));
  const moves: IMoves = { power: 0, together: 0, drift: 0, spread: 0 };
  now.count = 0;
  const known =
    phase !== undefined &&
    advanceMs !== undefined &&
    advanceMs > 0.5 * HOP_MS &&
    advanceMs < 1.5 * HOP_MS;
  if (known && state.phased && state.phase.length === phase.length) {
    let loudest = 0;
    for (let bin = from; bin <= to; bin += 1) {
      loudest = Math.max(loudest, centre[bin]);
    }
    // The centre is kept as amplitudes: the depth is its square root.
    const floor = loudest * Math.sqrt(PARTIAL_DEPTH);
    const turn = 2 * Math.PI;
    const seconds = advanceMs / 1_000;
    for (let bin = from; bin <= to && now.count < MOST_PARTIALS; bin += 1) {
      const here = centre[bin];
      if (here > floor && here >= centre[bin - 1] && here > centre[bin + 1]) {
        let ahead =
          phase[bin] - state.phase[bin] - turn * bin * binHz * seconds;
        ahead -= turn * Math.round(ahead / turn);
        now.hz[now.count] = bin * binHz + ahead / (turn * seconds);
        now.power[now.count] =
          centre[bin - 1] ** 2 + here ** 2 + centre[bin + 1] ** 2;
        now.count += 1;
      }
    }
  }
  if (phase !== undefined) {
    if (state.phase.length !== phase.length) {
      state.phase = new Float32Array(phase.length);
    }
    state.phase.set(phase);
  }
  state.phased = known;

  // Each partial against the nearest one there was, FOLLOW_HOPS before.
  let moved = 0;
  for (let index = 0; index < now.count; index += 1) {
    const hz = now.hz[index];
    moves.power += now.power[index];
    let nearest = -1;
    let nearestOff = FOLLOW_RATIO;
    for (let old = 0; old < before.count; old += 1) {
      const off = Math.abs(hz / before.hz[old] - 1);
      if (off < nearestOff) {
        nearestOff = off;
        nearest = old;
      }
    }
    if (nearest >= 0) {
      moveCents[moved] = 1_200 * Math.log2(hz / before.hz[nearest]);
      movePower[moved] = now.power[index];
      moveOrder[moved] = moved;
      moved += 1;
    }
  }
  if (moved === 0) {
    moves.spread = SPREAD_MOST;
    return moves;
  }
  // The middle of the moves by power: sorted by insertion, a few dozen.
  let followed = 0;
  for (let index = 0; index < moved; index += 1) {
    followed += movePower[index];
    const taken = moveOrder[index];
    let slot = index;
    while (slot > 0 && moveCents[moveOrder[slot - 1]] > moveCents[taken]) {
      moveOrder[slot] = moveOrder[slot - 1];
      slot -= 1;
    }
    moveOrder[slot] = taken;
  }
  let run = 0;
  for (let index = 0; index < moved; index += 1) {
    run += movePower[moveOrder[index]];
    if (run >= followed / 2) {
      moves.drift = moveCents[moveOrder[index]];
      break;
    }
  }
  const within = Math.max(
    TOGETHER_CENTS,
    TOGETHER_SHARE * Math.abs(moves.drift),
  );
  let apart = 0;
  let together = 0;
  for (let index = 0; index < moved; index += 1) {
    const off = Math.abs(moveCents[index] - moves.drift);
    apart += movePower[index] * Math.min(SPREAD_MOST, off);
    if (off < within) {
      together += movePower[index];
    }
  }
  moves.spread = apart / followed;
  // Standing still together is what every instrument does.
  moves.together = Math.abs(moves.drift) >= STILL_CENTS ? together : 0;
  return moves;
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
  const { centre, traits } = state;
  const from = Math.ceil(PARTIALS_FROM_HZ / binHz);
  const to = Math.min(mid.length - 1, Math.floor(TOP_HZ / binHz));
  let power = 0;
  let whole = 0;
  for (let bin = 0; bin < mid.length; bin += 1) {
    const all = 10 ** (mid[bin] / 10);
    const shared = Math.max(0, all - 10 ** (side[bin] / 10));
    centre[bin] = Math.sqrt(shared);
    if (bin >= from && bin <= to) {
      power += shared;
      whole += all;
    }
  }

  state.partialsAt = (state.partialsAt + 1) % state.partials.length;
  const moves = followPartials(
    state,
    spectrum,
    state.partials[state.partialsAt],
    state.partials[(state.partialsAt + 1) % state.partials.length],
  );

  // The four numbers, weighed over TRAITS_MS; the share that moved together
  // by the power it is a share of, so the loud moments say most.
  const ease = getEaseFactor(stepMs, TRAITS_MS);
  traits.share += ((whole > 0 ? power / whole : 0) - traits.share) * ease;
  traits.wobble +=
    (Math.min(WOBBLE_MOST, Math.abs(moves.drift)) - traits.wobble) * ease;
  traits.spread += (moves.spread - traits.spread) * ease;
  state.movedTogether += (moves.together - state.movedTogether) * ease;
  state.movedOutOf += (moves.power - state.movedOutOf) * ease;
  traits.together =
    state.movedOutOf > 0 ? state.movedTogether / state.movedOutOf : 0;
  const weighed =
    WEIGHTS.bias +
    WEIGHTS.share * traits.share +
    WEIGHTS.together * traits.together +
    WEIGHTS.wobble * traits.wobble +
    WEIGHTS.spread * traits.spread;
  const voiced = power > 0 ? 1 / (1 + Math.exp(-weighed)) : 0;
  state.sure += (voiced - state.sure) * getEaseFactor(stepMs, SURE_MS);

  // How loud the voice is, against the loudest it has lately sung.
  const db = 10 * Math.log10(Math.max(1e-12, power));
  if (state.sure >= 0.5) {
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
      : clamp01((db - state.loudestDb + OPEN_DEPTH_DB) / OPEN_DEPTH_DB);
  // The gate, from how sure it is (GATE_FROM, GATE_FULL).
  const wanted = clamp01((state.sure - GATE_FROM) / (GATE_FULL - GATE_FROM));
  state.gate +=
    (wanted - state.gate) *
    getEaseFactor(stepMs, wanted > state.gate ? GATE_OPEN_MS : GATE_CLOSE_MS);
  const open = placed * state.gate;
  state.open =
    open >= state.open
      ? open
      : state.open +
        (open - state.open) * getEaseFactor(stepMs, OPEN_RELEASE_MS);

  if (voiced >= 0.5) {
    const hz = clearestNote(centre, binHz);
    if (hz > 0) {
      state.pitchHz = hz;
      const pitch =
        Math.log2(hz / VOICE_LOW_HZ) / Math.log2(VOICE_HIGH_HZ / VOICE_LOW_HZ);
      state.pitch += (pitch - state.pitch) * getEaseFactor(stepMs, PITCH_MS);
    }
  }
};

/** Nothing heard for `quietMs`: the mouth closes and the certainty falls; the note holds. */
export const quietVoice = (state: IVoiceState, quietMs: number) => {
  state.open *= 1 - getEaseFactor(quietMs, OPEN_RELEASE_MS);
  state.sure *= 1 - getEaseFactor(quietMs, SURE_MS);
  state.gate *= 1 - getEaseFactor(quietMs, GATE_CLOSE_MS);
  // What comes next is followed from its own first hop.
  state.phased = false;
  state.partials.forEach((partials) => {
    partials.count = 0;
  });
};

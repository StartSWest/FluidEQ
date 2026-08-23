/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IEqBandSettings } from '../../common/dsp/chain';

/**
 * What turns a band from a fixed shape into one that only acts when asked.
 *
 * A static band is honest and blunt. A cut at 6 kHz to tame one singer's
 * sibilance also dulls every cymbal on the record, because a filter cannot tell
 * a sibilant from a ride. This measures the energy in the band's own passband
 * and scales the band's contribution by how far that energy is over a
 * threshold, so the same cut arrives on the sibilant and not on the cymbal.
 *
 * The detector is the band's own output minus its input — what the filter is
 * CHANGING — divided by how much change a full-strength band would make. That
 * quotient is the level of the band's passband and nothing else: no second
 * filter is needed for the sidechain, and the threshold keeps its meaning when
 * the gain dial moves, which it would not if the raw difference were used.
 */

/**
 * How far above the threshold the band reaches full strength, in dB.
 *
 * A soft knee by another name. Twelve because a resonance worth catching
 * typically sits ten to fifteen decibels above the level around it: a shorter
 * range makes the band snap on and off audibly, and a longer one never quite
 * arrives on the peaks it was set for.
 */
const RANGE_DB = 12;

/** The linear ratio the range works out to, so no sample needs a logarithm. */
const RANGE_RATIO = 10 ** (RANGE_DB / 20);

/**
 * Fast enough for a sibilant, slow enough not to chatter on a bass note.
 *
 * 5 ms of attack catches the front of an "s"; anything faster starts tracking
 * individual cycles down low and modulates them. 80 ms of release is under the
 * gap between syllables and well over one cycle at 50 Hz, so the band lets go
 * between words without pumping in time with the music.
 */
const ATTACK_MS = 5;
const RELEASE_MS = 80;

export interface IBandDynamics {
  /** False for a static band: every dynamic path is skipped entirely. */
  active: boolean;
  /** Linear amplitude at which the band begins to act. */
  threshold: number;
  /** Turns the band's own change back into the level of its input. */
  normalise: number;
  attack: number;
  release: number;
  /** Held across blocks — an envelope reset per block is a click per block. */
  envelope: number;
  /** What the band is currently applying, 0 to 1. Read by the meter. */
  amount: number;
}

export const createBandDynamics = (): IBandDynamics => ({
  active: false,
  threshold: 1,
  normalise: 1,
  attack: 0,
  release: 0,
  envelope: 0,
  amount: 0,
});

/** One-pole coefficient: after `ms` the envelope has travelled 1 - 1/e of the
 * distance, which is the usual meaning of an attack or release time. */
const coefficientFor = (ms: number, sampleRate: number): number =>
  Math.exp(-1 / ((ms / 1_000) * sampleRate));

/**
 * Point `state` at what `band` is now asking for, keeping its envelope.
 *
 * Rebuilt on every settings message, so it must not disturb what is running:
 * the envelope is the last few milliseconds of audio and resetting it because
 * a neighbouring band moved would be a click on every drag.
 */
export const refreshBandDynamics = (
  state: IBandDynamics,
  band: IEqBandSettings,
  sampleRate: number,
  /** The whole rack. A bypassed equaliser has no bands doing anything, and
   * a follower still reporting its last engagement makes the graph and the
   * readout claim otherwise. */
  isRackEnabled: boolean,
): void => {
  const swing = Math.abs(10 ** (band.gainDb / 20) - 1);
  // A band with no gain changes nothing, so there is nothing to detect and
  // nothing to scale. Dividing by that swing would be a division by zero.
  state.active = isRackEnabled && band.dynamic && band.enabled && swing > 1e-4;
  state.threshold = 10 ** (band.thresholdDb / 20);
  state.normalise = state.active ? 1 / swing : 1;
  state.attack = coefficientFor(ATTACK_MS, sampleRate);
  state.release = coefficientFor(RELEASE_MS, sampleRate);
  if (!state.active) {
    state.amount = 0;
  }
};

/**
 * Follow one sample and answer how much of the band to apply, 0 to 1.
 *
 * Peak-following rather than RMS, and deliberately: the point is to catch the
 * loudest moment in the band, and an RMS detector averages exactly that away.
 */
export const bandDynamicAmount = (
  state: IBandDynamics,
  difference: number,
): number => {
  const level = Math.abs(difference) * state.normalise;
  const coefficient = level > state.envelope ? state.attack : state.release;
  state.envelope = level + (state.envelope - level) * coefficient;
  const over = state.envelope - state.threshold;
  if (over <= 0) {
    return 0;
  }
  // Linear in amplitude between the threshold and the top of the range, which
  // is close enough to linear in dB across twelve of them and costs no
  // logarithm per sample.
  const span = state.threshold * (RANGE_RATIO - 1);
  return over >= span ? 1 : over / span;
};

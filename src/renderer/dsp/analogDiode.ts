/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const WARM_BIAS = 0.58;
const AIR_BIAS = 0.12;
const CURRENT_CEILING = 0.45;

/**
 * The later Aphex transient discriminator lets the harmonic output lead an
 * onset, then settles it back as the level detector catches up. These time
 * constants reproduce that shape continuously rather than making an on/off
 * decision at an AudioWorklet block boundary.
 */
const TRANSIENT_FAST_ATTACK_MS = 1.5;
const TRANSIENT_FAST_RELEASE_MS = 35;
const TRANSIENT_SLOW_ATTACK_MS = 20;
const TRANSIENT_SLOW_RELEASE_MS = 250;
const TRANSIENT_CONTROL_ATTACK_MS = 2;
const TRANSIENT_CONTROL_RELEASE_MS = 55;
const TRANSIENT_FLOOR = 0.002;
const TRANSIENT_NORMALISER = 0.025;

/** The public Texture range; the top remains slightly asymmetric. */
export const ANALOG_DIODE_MAX_CHARACTER = 0.7;

export interface IExciterTransientState {
  fastEnvelope: number;
  slowEnvelope: number;
  amount: number;
  sampleRate: number;
  fastAttack: number;
  fastRelease: number;
  slowAttack: number;
  slowRelease: number;
  controlAttack: number;
  controlRelease: number;
}

export const createExciterTransientState = (): IExciterTransientState => ({
  fastEnvelope: 0,
  slowEnvelope: 0,
  amount: 0,
  sampleRate: 0,
  fastAttack: 0,
  fastRelease: 0,
  slowAttack: 0,
  slowRelease: 0,
  controlAttack: 0,
  controlRelease: 0,
});

export const resetExciterTransientState = (
  state: IExciterTransientState,
): void => {
  state.fastEnvelope = 0;
  state.slowEnvelope = 0;
  state.amount = 0;
};

const timeCoefficient = (milliseconds: number, sampleRate: number): number =>
  1 - Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));

/**
 * Return a continuous 0..1 measure of a new onset.
 *
 * A fast peak envelope sees the front of a note while a 20 ms control envelope
 * is still catching up. Their normalised difference falls back towards zero on
 * sustained material. A separate short smoothing stage prevents waveform
 * cycles, block edges, and detector chatter from becoming amplitude modulation.
 * There is no threshold gate and the result never controls the foundation or
 * the wet mix; it only leans on the nonlinear residue below.
 */
export const exciterTransientSample = (
  state: IExciterTransientState,
  sample: number,
  sampleRate: number,
): number => {
  if (state.sampleRate !== sampleRate) {
    state.sampleRate = sampleRate;
    state.fastAttack = timeCoefficient(TRANSIENT_FAST_ATTACK_MS, sampleRate);
    state.fastRelease = timeCoefficient(TRANSIENT_FAST_RELEASE_MS, sampleRate);
    state.slowAttack = timeCoefficient(TRANSIENT_SLOW_ATTACK_MS, sampleRate);
    state.slowRelease = timeCoefficient(TRANSIENT_SLOW_RELEASE_MS, sampleRate);
    state.controlAttack = timeCoefficient(
      TRANSIENT_CONTROL_ATTACK_MS,
      sampleRate,
    );
    state.controlRelease = timeCoefficient(
      TRANSIENT_CONTROL_RELEASE_MS,
      sampleRate,
    );
  }
  const magnitude = Math.abs(sample);
  const fastCoefficient =
    magnitude > state.fastEnvelope ? state.fastAttack : state.fastRelease;
  const slowCoefficient =
    magnitude > state.slowEnvelope ? state.slowAttack : state.slowRelease;
  state.fastEnvelope += (magnitude - state.fastEnvelope) * fastCoefficient;
  state.slowEnvelope += (magnitude - state.slowEnvelope) * slowCoefficient;

  const target =
    state.fastEnvelope > TRANSIENT_FLOOR
      ? Math.max(
          0,
          Math.min(
            1,
            (state.fastEnvelope - state.slowEnvelope) /
              Math.max(TRANSIENT_NORMALISER, state.fastEnvelope),
          ),
        )
      : 0;
  const controlCoefficient =
    target > state.amount ? state.controlAttack : state.controlRelease;
  state.amount += (target - state.amount) * controlCoefficient;
  return state.amount;
};

/**
 * A smooth digital counterpart of the original Exciter's driven sidechain.
 *
 * US 4,150,253 does not return a synthetic harmonic residue. Its attenuated
 * excited signal contains the phase-shifted fundamentals passed by the filter
 * and the low-order odd/even harmonics created from them. That continuous
 * filtered component is the foundation that prevents the harmonics from being
 * heard as detached fizz.
 *
 * Normalising the tangent at silence keeps that foundation at unity while
 * Drive changes curvature rather than loudness. Bias supplies the one-sided
 * diode character, and Texture moves from even-rich warmth toward denser air.
 * There is no threshold, programme follower, or block measurement in the
 * curve, so it stays continuous under sustained material. `harmonicGain`
 * changes only the difference between that foundation and the curved signal;
 * the transient discriminator can therefore breathe without moving the whole
 * sidechain up and down.
 */
export const analogDiodeExcitedSample = (
  sample: number,
  drive: number,
  character: number,
  level: number,
  harmonicGain = 1,
): number => {
  const driven = sample * drive;
  const characterMix = Math.max(
    0,
    Math.min(1, character / ANALOG_DIODE_MAX_CHARACTER),
  );
  const bias = WARM_BIAS + (AIR_BIAS - WARM_BIAS) * characterMix;
  const biasOutput = Math.tanh(bias);
  const tangentGain = 1 - biasOutput * biasOutput;
  const shaped = Math.tanh(driven + bias) - biasOutput;
  const complete = (shaped * level) / (Math.max(0.001, drive) * tangentGain);
  const foundation = sample * level;
  return foundation + (complete - foundation) * harmonicGain;
};

/**
 * The same diode, weighted toward the octave rather than the twelfth.
 *
 * `evenWeight` at 0 is `analogDiodeExcitedSample`; at 1 the added harmonics are
 * the squared shape, which carries only even orders.
 *
 * `tanh` is odd, so on its own it produces third and fifth orders — on a 60 Hz
 * note, 180 and 300 Hz, a twelfth and a seventeenth above the root. Dissonant
 * intervals, heard as hardness. The bias adds even orders, but drive is what
 * makes harmonics loud and drive pushes the odd content up faster than the bias
 * can answer: measured on the low band, the third order came back 5 dB ABOVE
 * the second.
 *
 * Squaring an odd shape is even-symmetric, so it gives the second and fourth
 * orders and nothing else — the octave and two octaves, which is the interval a
 * small speaker uses to imply a fundamental it cannot reproduce. The doubling
 * restores unity, since `sin(x)^2` puts half its amplitude at 2f and half at
 * DC, and the DC is removed downstream by the exciter's block filter.
 *
 * The blend is between the two sets of HARMONICS rather than between two
 * signals. The odd shape carries the fundamental through it and the squared one
 * does not, so blending the shapes and then subtracting the foundation removes
 * a fundamental the even half never contributed — measured at -4.2 dB on the
 * first attempt, which is an exciter acting as a volume control.
 */
export const analogDiodeOctaveSample = (
  sample: number,
  drive: number,
  character: number,
  level: number,
  harmonicGain: number,
  evenWeight: number,
): number => {
  const driven = sample * drive;
  const characterMix = Math.max(
    0,
    Math.min(1, character / ANALOG_DIODE_MAX_CHARACTER),
  );
  const bias = WARM_BIAS + (AIR_BIAS - WARM_BIAS) * characterMix;
  const biasOutput = Math.tanh(bias);
  const tangentGain = 1 - biasOutput * biasOutput;
  const odd = Math.tanh(driven + bias) - biasOutput;
  const even = 2 * odd * odd;
  const safeDrive = drive > 0.001 ? drive : 0.001;
  const scale = level / (safeDrive * tangentGain);
  const foundation = sample * level;
  const oddResidue = odd * scale - foundation;
  const evenResidue = even * scale;
  const weight = Math.max(0, Math.min(1, evenWeight));
  const residue = oddResidue + (evenResidue - oddResidue) * weight;
  return foundation + residue * harmonicGain;
};

/** High and Organic alone use the protected rail; Low and Mid stay unbounded. */
export const limitExciterCurrent = (current: number): number =>
  Math.tanh(current / CURRENT_CEILING) * CURRENT_CEILING;

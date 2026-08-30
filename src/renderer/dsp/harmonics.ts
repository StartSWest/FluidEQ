/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter's harmonic generator: a fixed recipe at a fixed depth.
 *
 * The stage this replaces drove a biased tangent directly with the programme,
 * which made the amount of harmonic content follow the input LEVEL. Measured on
 * the shipping defaults, the low band's second order sat 12.8 dB below the
 * fundamental at -6 dBFS, 33.6 dB below at -26, and 48.7 dB below at -46. Music
 * averaging -20 dBFS therefore got almost nothing, and its peaks got a fifth of
 * their amplitude as distortion. The mid band was worse: its third order fell
 * 40 dB for every 20 dB of input. That is not an effect with a character, it is
 * an effect that arrives only on transients.
 *
 * Three pieces fix it, and each is measurable on its own:
 *
 * 1. The band's own level is measured and divided out before shaping, then
 *    multiplied back afterwards. The shaper therefore always sees roughly the
 *    same waveform and returns the same harmonic RATIO, whatever the programme
 *    is doing. This is the "adaptive nonlinearity" every good exciter has.
 *
 * 2. The shapes are Chebyshev polynomials rather than a tangent's accidental
 *    Taylor series. T2 puts its energy at exactly twice the input frequency and
 *    T3 at exactly three times, so a band's harmonic recipe is authored rather
 *    than discovered, and Texture moves between two known intervals instead of
 *    between two adjectives.
 *
 * 3. Whatever the shaper hands back OF THE INPUT ITSELF is measured and
 *    subtracted. T3 is only a pure third harmonic for a unit sine; fed anything
 *    else it returns a large fundamental component too — enough to drop the
 *    note being excited by 2 dB. Removing the projection makes "Drive and
 *    Texture never become a volume control" true by construction rather than by
 *    tuning, for both shapes and for any programme.
 */

/**
 * Fast enough to find a note, slow enough not to ride out its decay.
 *
 * The level follower is what makes the harmonic ratio constant, so its release
 * is the one number that decides whether a fade-out keeps its character. At
 * 180 ms a decaying note stays excited as it falls; much faster and the
 * follower chases the note's own envelope, which puts the effect back where it
 * started.
 */
const LEVEL_ATTACK_MS = 10;
const LEVEL_RELEASE_MS = 180;

/**
 * Below this the effect fades out rather than amplifying the noise floor.
 *
 * Dividing by a measured level is division by something that reaches zero. The
 * floor is not a gate: the level is clamped, not the signal, so the ratio falls
 * away smoothly under -60 dBFS instead of switching off at a threshold.
 */
const QUIET_FLOOR = 0.001;

/**
 * The fit tracks the shaper's linear gain, not the waveform.
 *
 * It has to be far slower than the lowest note in the lowest band or it starts
 * removing the harmonics as well: at 20 Hz one cycle is 50 ms, so the window
 * has to be several of those. What it is measuring barely moves, so the lag
 * costs nothing.
 */
const FIT_TRACK_MS = 250;

/** Below this there is no signal to fit, and the ratio would be noise. */
const FIT_FLOOR = 1e-9;

export interface IHarmonicState {
  meanSquare: number;
  cross: number;
  energy: number;
  sampleRate: number;
  levelAttack: number;
  levelRelease: number;
  fit: number;
}

export const createHarmonicState = (): IHarmonicState => ({
  meanSquare: 0,
  cross: 0,
  energy: 0,
  sampleRate: 0,
  levelAttack: 0,
  levelRelease: 0,
  fit: 0,
});

export const resetHarmonicState = (state: IHarmonicState): void => {
  state.meanSquare = 0;
  state.cross = 0;
  state.energy = 0;
};

const timeCoefficient = (milliseconds: number, sampleRate: number): number =>
  1 - Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));

/**
 * One sample of harmonics, at a depth that does not follow the input level.
 *
 * `depth` is the harmonic amplitude relative to the band, so it maps directly
 * onto a decibel figure a test can assert. `evenWeight` at 1 is all second
 * order — the octave, which is body and, on a small speaker, the fundamental it
 * cannot reproduce; at 0 it is all third — the twelfth, which is edge and
 * definition. The return carries harmonics only: the caller adds its own
 * foundation if it wants one.
 */
export const harmonicSample = (
  state: IHarmonicState,
  sample: number,
  depth: number,
  evenWeight: number,
  sampleRate: number,
): number => {
  // Three exponentials to rebuild the constants; only when the rate moves.
  if (state.sampleRate !== sampleRate) {
    state.sampleRate = sampleRate;
    state.levelAttack = timeCoefficient(LEVEL_ATTACK_MS, sampleRate);
    state.levelRelease = timeCoefficient(LEVEL_RELEASE_MS, sampleRate);
    state.fit = timeCoefficient(FIT_TRACK_MS, sampleRate);
  }

  const square = sample * sample;
  const levelCoefficient =
    square > state.meanSquare ? state.levelAttack : state.levelRelease;
  state.meanSquare += (square - state.meanSquare) * levelCoefficient;
  // Mean square rather than a peak follower: a peak follower on a 40 Hz note
  // ripples at the note's own rate, and dividing by a rippling level is
  // amplitude modulation. The factor of two makes this the peak of a sine, so
  // a tone normalises to unity and `depth` reads as a plain ratio.
  const measured = Math.sqrt(2 * state.meanSquare);
  const level = measured > QUIET_FLOOR ? measured : QUIET_FLOOR;

  // Bounded before the polynomials, which is not optional: T3 grows as the
  // cube, so a transient sitting three times over the level would come back
  // twenty-six times its own size. The tangent is nearly linear over the range
  // the follower normalises to, so it costs almost no harmonics of its own.
  const normalised = Math.tanh(sample / level);
  const squareNormalised = normalised * normalised;
  /**
   * T2 = 2x^2 - 1 and T3 = 4x^3 - 3x, at exactly 2f and 3f — except that the
   * second order is used WITHOUT Chebyshev's -1.
   *
   * That constant centres a full-scale sine, and the signal here is not one. It
   * is only right while a note is sounding at the level the follower holds, and
   * the follower holds for 180 ms after the note goes — so -1 times that level
   * keeps being painted over the silence. Measured on the low band after a
   * gated note, that left a tail which PLATEAUED rather than decayed: -40.6 dB
   * at 20-60 ms, -44.6 at 60-150, still -47.0 at 150-400. The same windows read
   * -36.2, -79.6 and nothing once the constant went.
   *
   * `2x^2` reaches zero when the signal does, so the offset follows the
   * programme instead of the follower. It carries the same energy at 2f — every
   * harmonic figure measured across all three bands was unchanged to 0.1 dB —
   * and what it carries at DC is what the block filter downstream is for.
   */
  const second = 2 * squareNormalised;
  const third = normalised * (4 * squareNormalised - 3);
  const weight = Math.max(0, Math.min(1, evenWeight));
  const shaped = third + (second - third) * weight;

  /**
   * Subtract whatever of the input the shaper handed back.
   *
   * A running least-squares fit of `shaped` onto `normalised`: the ratio of
   * their product to the input's own energy is exactly the linear gain the
   * shape has, and removing that much of the input leaves only what the shape
   * ADDED. Without it the third-order path returns most of a fundamental of its
   * own — measured at 0.98 of the input for a normalised sine, which turns the
   * Texture control into a 2 dB cut.
   */
  state.cross += (shaped * normalised - state.cross) * state.fit;
  state.energy += (squareNormalised - state.energy) * state.fit;
  const projection = state.energy > FIT_FLOOR ? state.cross / state.energy : 0;
  const harmonics = shaped - projection * normalised;

  return harmonics * depth * level;
};

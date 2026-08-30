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
 * an effect that arrives only on transients, which is what "I do not like the
 * exciters" sounds like.
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
#ifndef FLUIDEQ_HARMONICS_H
#define FLUIDEQ_HARMONICS_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Everything one band needs to keep its harmonics level-independent.
 *
 * `mean_square` is the band's working level; `cross` and `energy` are the
 * running least-squares fit of the shaped signal onto the input, which is the
 * fundamental the shaper is handing back.
 */
typedef struct FeqHarmonicState {
  double mean_square;
  double cross;
  double energy;
  double sample_rate;
  double level_attack;
  double level_release;
  double fit;
} FeqHarmonicState;

void feq_harmonic_init(FeqHarmonicState* state);
void feq_harmonic_reset(FeqHarmonicState* state);

/**
 * One sample of harmonics, at a depth that does not follow the input level.
 *
 * `depth` is the harmonic amplitude relative to the band, so it maps directly
 * onto a decibel figure a test can assert. `even_weight` at 1 is all second
 * order — the octave, which is body and, on a small speaker, the fundamental it
 * cannot reproduce; at 0 it is all third — the twelfth, which is edge and
 * definition. The return carries harmonics only: the caller adds its own
 * foundation if it wants one.
 */
double feq_harmonic_sample(FeqHarmonicState* state,
                           double sample,
                           double depth,
                           double even_weight,
                           double sample_rate);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_HARMONICS_H */

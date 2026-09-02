/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass that a speaker can actually play, made two different ways.
 *
 * The two generators here exist because "more bass" is two problems with
 * opposite answers, and a stage offering only one of them is wrong on half
 * the hardware people listen on.
 *
 * A laptop speaker, a phone and most Bluetooth boxes have a hard acoustic
 * floor somewhere between 150 and 400 Hz. Below it they radiate nothing at
 * any drive level, so a control that adds energy at 45 Hz on those devices
 * spends headroom on something no listener will ever hear. What works there
 * is the missing fundamental: supply the HARMONICS of the bass note and the
 * ear reconstructs a pitch that was never radiated. That is `presence_amount`,
 * and it is the same trick every commercial bass enhancer is selling.
 *
 * A subwoofer wants the exact opposite — a real octave below what the record
 * carries, because it can play it and the harmonics are already there. That
 * is `sub_amount`.
 *
 * Neither is a volume control, and that is enforced rather than tuned. The
 * whole band is scaled so its level after generation matches its level before,
 * measured over a window slow enough not to track a note. Without that, every
 * A/B of this stage is won by whichever side is louder and nobody can hear
 * what the controls actually do — which is how a bass enhancer ends up
 * shipping as a hidden gain stage.
 *
 * The generation source is always `(low[0] + low[1]) / 2`. Harmonics generated
 * per channel are two decorrelated sets, which is a phase problem sold as
 * width; the mono listener pays for it and the stereo listener gets a thinner
 * picture. The dry low band keeps its own stereo untouched, and the app's
 * mono-maker stays where it already lives, in the EQ.
 */
#ifndef FLUIDEQ_BASS_FORGE_H
#define FLUIDEQ_BASS_FORGE_H

#include <stdint.h>

#include "fluideq/biquad.h"
#include "fluideq/harmonics.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Eight band-pass followers on a log grid, 20 Hz to 1 kHz.
 *
 * The graph these feed is zoomed to the bass and to nothing else, which is the
 * whole point of it: the octave of detail under 100 Hz that this stage works
 * in is four pixels wide on a 20 Hz to 20 kHz analyser.
 */
#define FEQ_BASS_FORGE_BANDS 8

typedef struct FeqBassForgeSettings {
  int enabled;
  /**
   * Hear the stage's contribution alone, with the programme dropped.
   *
   * A subtraction, exactly as the EQ's and Denoise's monitors are: what is
   * left is `(dry + generated) * normaliser - dry`, which is everything this
   * stage adds and nothing else. It is deliberately NOT the low band soloed —
   * a crossover band plays whether the stage is doing anything or not, which
   * is the one thing a monitor must never do.
   *
   * At a mix of zero it is therefore silence to the last bit, because both
   * mean squares are then fed identical numbers and the delta is exactly
   * zero. That is the reading rather than a fault: nothing added, nothing to
   * hear.
   *
   * A monitoring mode, not a setting. `readStored` in the renderer drops it on
   * load — never `clampDspSettings`, which also runs on every patch and every
   * settings message and would strip the value between the button and the
   * audio.
   */
  int isolate;
  /**
   * Where bass ends, 40 to 200 Hz. Structural: it moves both filters.
   *
   * The generators' corner and the normaliser's shelf midpoint at once — at
   * this frequency the delivered gain is the root mean square of the band's
   * gain and unity, which is what a shelf's corner means everywhere else.
   */
  double split_hz;
  /**
   * Whether the eight-band analyser runs this block. **Not a wire field.**
   *
   * Sixteen band-passes and sixteen followers per sample is 1.5 million biquad
   * evaluations a second at 48 kHz, spent entirely on a graph that is one tab
   * of ten and usually closed. `chain_process_bass_forge` fills this from
   * `feq_meters_enabled`, the same gate `feq_meters_capture` already applies to
   * every other stage's meter work. The followers are reset when it turns back
   * on, so an opened panel reads the audio playing now rather than the audio
   * playing when it was last closed.
   */
  int meters;
  /**
   * 0 to 12 dB, and what it drives is a curve rather than a level.
   *
   * A gain in front of these generators does nothing, and that is not a
   * tuning accident: `feq_harmonic_sample` divides the band's own level out
   * before it shapes anything, and the divider's output is matched back onto
   * the band it came from. Both are level-invariant by construction, so
   * anything in front of them has nothing to bite on. Drive therefore feeds
   * the asymmetric curve in `saturate.h`, applied to the generated content
   * before the band is normalised — which is warmth with a second harmonic in
   * front of the third, and is the only reading of "hot" this stage can
   * honestly offer. It also moves where the programme sits against the
   * divider's floor; see `kDividerFloor` in `bass_forge.cpp`.
   */
  double drive_db;
  /**
   * The octave below, 0 to 2. For hardware that can radiate it.
   *
   * Two rather than one because an amount is multiplied by `mix` on its way in
   * and the profiles sit around half of that, so a ceiling of one put the top
   * of this dial at half the effect the generator can make. `kMaxAmount` in
   * `bass_forge.cpp` carries the measurement and why the ceiling is not four.
   */
  double sub_amount;
  /** The harmonics above, 0 to 2. For hardware that cannot. @see sub_amount */
  double presence_amount;
  /**
   * Even against odd in the presence recipe, 0 to 1.
   *
   * The full range is usable here, unlike the Exciter's 0 to 0.7 cap: this
   * maps straight onto `feq_harmonic_sample`'s `even_weight` rather than onto
   * a diode character curve. At 1 it is the octave up, which is exactly the
   * phantom-fundamental cue; at 0 it is the twelfth, which for a band ending
   * at 200 Hz reaches 600 Hz and nowhere near the region that cap protects.
   */
  double texture;
  /** How much of the generated content arrives, 0 to 1. Zero is bypass. */
  double mix;
} FeqBassForgeSettings;

typedef struct FeqBassForge {
  /**
   * The GENERATORS' band: one Linkwitz-Riley 4th-order lowpass per channel.
   *
   * Steep, because the divider counts zero crossings and a band that leaked
   * midrange would have it counting the wrong ones. It is not what the
   * normalising gain is applied through; `shelf` below is, and says why.
   */
  FeqBiquadState split[2][2];
  /**
   * The GAIN's band: one pole per channel, and the one state a TDF-II
   * first-order section needs.
   *
   * The band and the rest are recombined by subtraction, so the delivered
   * response is `rest + (band - rest) * L(f)` and everything turns on what `L`
   * does at the corner. A one-pole's Nyquist locus is the circle
   * `|L - 1/2| = 1/2`, giving `Re(L) = |L|^2` at every frequency and therefore
   * `|delivered|^2 = rest^2 + (band^2 - rest^2) / (1 + (f/split)^2)`: monotone
   * between the two gains, never past either. An LR4 lowpass is -0.5 at its own
   * corner, so a CUT on the band arrived there as a lift — measured at
   * +0.41 dB while the normaliser was holding the band 0.76 dB down. See
   * `bass_punch.cpp`, which carries the full argument and the same one-pole.
   */
  double shelf[2];
  /** The divider's band limit. Mono, so one set of states rather than two. */
  FeqBiquadState divider_low[2];
  FeqBiquadState divider_high;
  FeqHarmonicState harmonic;
  /** Cached because they depend only on the rate, which almost never moves. */
  FeqBiquadCoefficients meter_coefficients[FEQ_BASS_FORGE_BANDS];
  FeqBiquadState meter_input[FEQ_BASS_FORGE_BANDS];
  FeqBiquadState meter_output[FEQ_BASS_FORGE_BANDS];
  double meter_input_mean_square[FEQ_BASS_FORGE_BANDS];
  double meter_output_mean_square[FEQ_BASS_FORGE_BANDS];
  /** Whether the analyser ran last block, so the gate's edge can be seen. */
  int meters_running;
  /** The divider's flip-flop, and the sign it is watching for a rising edge. */
  int flipped;
  int positive;
  /** The level that decides whether the divider runs at all, and its fade. */
  double divider_mean_square;
  double divider_gate;
  /** The running match of the divider's output onto the band it came from. */
  double source_mean_square;
  double octave_mean_square;
  double sub_gain;
  /** One DC blocker, downstream of every non-linearity. `kGeneratedDcHz`. */
  double dc_input;
  double dc_output;
  /** The no-free-loudness gain, and the two mean squares it comes from. */
  double low_mean_square;
  double wet_mean_square;
  double gain;
  /** Smoothed controls. A `mix` below zero means none of them is primed. */
  double drive;
  double saturation;
  double sub_amount;
  double presence_amount;
  double texture;
  double mix;
  /** Caller-owned, each at least two channels of the largest block. */
  float* low;
  float* scratch;
  double sample_rate;
} FeqBassForge;

/**
 * `low` and `scratch` are caller-owned and each at least `frames * 2` long,
 * where `frames` is the largest block the chain will ever ask for. Nothing
 * inside `feq_bass_forge_process` allocates, so the sizing happens at prepare
 * time or not at all.
 */
void feq_bass_forge_init(FeqBassForge* state, float* low, float* scratch);

void feq_bass_forge_reset(FeqBassForge* state);

/**
 * Forge in place, over the first two channels of a planar block.
 *
 * Disabled, and `mix` of zero, are both bit-exact passthrough rather than
 * approximate ones — the crossover recombines by subtraction so that they can
 * be. A stage that is only nearly transparent at zero is a stage nobody can
 * leave switched on.
 */
void feq_bass_forge_process(FeqBassForge* state,
                            float* const* channels,
                            uint32_t channel_count,
                            uint32_t frames,
                            const FeqBassForgeSettings* settings,
                            double sample_rate);

/** The eight band levels in dBFS, 20 Hz to 1 kHz. **Control thread.** */
void feq_bass_forge_bands(const FeqBassForge* state,
                          double* input_db,
                          double* output_db);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_BASS_FORGE_H */

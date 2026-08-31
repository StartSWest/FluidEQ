/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How bass hits, which is a question about time and not about frequency.
 *
 * Everything else in this rack that touches low end asks where the energy is.
 * This asks when: the first fifteen milliseconds of a kick against the two
 * hundred after it. That is the whole difference between a mix that thumps and
 * one that rumbles, and no filter can move it, because the two live at the
 * same frequency.
 *
 * The shaper is a difference of envelopes rather than a threshold. A fast
 * follower minus a slow one IS the transient, at any level — so a quiet kick
 * gets the same treatment as a loud one and there is no dial to set, no
 * material that slips under it, and no pumping when the level drifts across
 * it. Over any complete note the two followers converge, so the gain averages
 * to unity and this cannot become a tone control. That is asserted.
 *
 * The bloom is a decay extension and deliberately not a reverb. It is fed from
 * the low band summed to mono and it comes back mono, because stereo bass
 * reverb is the standard way to make a mix muddy and mono-incompatible — the
 * width is inaudible where it is applied and the cancellation is not.
 *
 * Duck exists because bass reading as powerful is mostly about what is NOT
 * competing with it. Pulling the upper band down under the low band's own
 * envelope buys more apparent weight than raising the bass does, and it costs
 * headroom instead of spending it.
 */
#ifndef FLUIDEQ_BASS_PUNCH_H
#define FLUIDEQ_BASS_PUNCH_H

#include <stdint.h>

#include "fluideq/biquad.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Three combs at mutually prime delays, and one all-pass behind them.
 *
 * One comb is a pitched ring rather than a space, and three that share a factor
 * are one comb with extra steps — `dimension.cpp` chose its all-pass delays on
 * the same reasoning. The all-pass is what makes the short end of the decay
 * dial reachable at all: no comb here has a round trip short enough to fit
 * inside forty milliseconds, and its seven do.
 */
#define FEQ_BASS_PUNCH_COMBS 3
#define FEQ_BASS_PUNCH_BLOOM_LINES (FEQ_BASS_PUNCH_COMBS + 1)

typedef struct FeqBassPunchSettings {
  int enabled;
  /**
   * Where bass ends, 40 to 200 Hz. Structural: it moves both filters.
   *
   * The detector's corner and the shelf's midpoint at once — at this frequency
   * the delivered gain is the root mean square of the two band gains, which is
   * what a shelf's corner means everywhere else in audio.
   */
  double split_hz;
  /**
   * The leading edge, -1 to +1. Positive is harder, negative is softer.
   *
   * What it scales is the amount by which the fast envelope stands ABOVE the
   * slow one, which is only ever during a rise. In the tail the two have
   * converged and this is exactly zero, so `attack` cannot reach the sustain
   * and the two dials never fight over the same milliseconds.
   */
  double attack;
  /** The tail, -1 to +1: negative is dry and tight, positive is wet and long. */
  double sustain;
  /** How much of the bloom arrives, 0 to 1. Zero is bypass. */
  double bloom_amount;
  /** Its decay, 40 to 250 ms, and it is a measured decay. See the source. */
  double bloom_decay_ms;
  /** How hard the band above the split is pulled down under the bass, 0 to 1. */
  double duck;
} FeqBassPunchSettings;

/** One delay line of the bloom network. The buffer is caller-owned. */
typedef struct FeqBassPunchDelay {
  float* buffer;
  uint32_t capacity;
  uint32_t delay;
  uint32_t cursor;
} FeqBassPunchDelay;

typedef struct FeqBassPunch {
  /**
   * The DETECTOR's band: one Linkwitz-Riley 4th-order lowpass per channel.
   *
   * Steep, because what the followers are asked to find is a kick and not a
   * snare, and 24 dB per octave is what keeps a vocal out of the envelope. It
   * is not what the gain is applied through; see `shelf` below for why those
   * are two different filters.
   */
  FeqBiquadState split[2][2];
  /**
   * The GAIN's band: one pole per channel, and the one state a TDF-II
   * first-order section needs.
   *
   * The two bands are recombined by subtraction, so the delivered response is
   * `rest + (band - rest) * L(f)` and everything depends on what `L` does at
   * the corner. A one-pole's Nyquist locus is the circle `|L - 1/2| = 1/2`,
   * which gives `Re(L) = |L|^2` at every frequency and therefore
   * `|delivered|^2 = rest^2 + (band^2 - rest^2) / (1 + (f/split)^2)` — a
   * magnitude that runs monotonically from one gain to the other and can
   * neither overshoot nor reach zero. No steeper filter has that property, and
   * an LR4 lowpass is the worst case of not having it: it is exactly -0.5 at
   * its own corner, so a boost arrives inverted there.
   */
  double shelf[2];
  /** The bloom's band limit. Mono, so one pair of stages rather than two. */
  FeqBiquadState bloom_low[2];
  FeqBassPunchDelay combs[FEQ_BASS_PUNCH_COMBS];
  FeqBassPunchDelay all_pass;
  /** Smoothed, because the dial is dragged and these are the loop gains. */
  double comb_feedback[FEQ_BASS_PUNCH_COMBS];
  double all_pass_gain;
  /**
   * The three envelopes, each a slowed copy of the one before it.
   *
   * That cascade is what makes "the followers converge" exact rather than
   * close: a single-constant smoother has unity gain at DC, so over a steady
   * note the mean of `slow` IS the mean of `fast` and their difference is zero.
   * Three independent attack/release followers do not have that property —
   * measured, they leave a standing 0.7 dB offset on a 60 Hz tone, which is a
   * tone control by another name.
   */
  double detector_mean_square;
  double fast;
  double slow;
  double slower;
  /** The duck's own follower, and the gain it produced. */
  double duck_level;
  /** Smoothed controls. `primed` is clear until the first block has run. */
  int primed;
  double attack;
  double sustain;
  double bloom_amount;
  double duck;
  /** What the meters read, in dB of applied gain. **Control thread.** */
  double transient_gain_db;
  double sustain_gain_db;
  double duck_gain_db;
  /** Caller-owned, at least two channels of the largest block. */
  float* low;
  double sample_rate;
} FeqBassPunch;

/** Longest bloom delay in samples at this rate, which sizes every line. */
uint32_t feq_bass_punch_bloom_capacity(double sample_rate);

/**
 * `low` is caller-owned and at least `frames * 2` long, where `frames` is the
 * largest block the chain will ever ask for; `bloom_buffers` is
 * `FEQ_BASS_PUNCH_BLOOM_LINES` buffers each `bloom_capacity` long. Nothing
 * inside `feq_bass_punch_process` allocates, so the sizing happens at prepare
 * time or not at all — and the lines are sized once at the longest delay and
 * never resized, because a buffer replaced while a dial is dragged arrives full
 * of zeros, which is what the Maximizer's look-ahead ring learned the
 * expensive way.
 */
void feq_bass_punch_init(FeqBassPunch* state,
                         float* low,
                         float* const* bloom_buffers,
                         uint32_t bloom_capacity);

void feq_bass_punch_reset(FeqBassPunch* state);

/**
 * Shape in place, over the first two channels of a planar block.
 *
 * Disabled, and every control at rest, are both bit-exact passthrough rather
 * than approximate ones — the crossover recombines by subtraction so that they
 * can be. A stage that is only nearly transparent at zero is a stage nobody can
 * leave switched on.
 */
void feq_bass_punch_process(FeqBassPunch* state,
                            float* const* channels,
                            uint32_t channel_count,
                            uint32_t frames,
                            const FeqBassPunchSettings* settings,
                            double sample_rate);

/** Gain the attack section is applying, in dB. **Control thread.** */
double feq_bass_punch_transient_db(const FeqBassPunch* state);

/** Gain the sustain section is applying, in dB. **Control thread.** */
double feq_bass_punch_sustain_db(const FeqBassPunch* state);

/**
 * Gain the duck is applying to the upper band, in dB. **Control thread.**
 *
 * This is the gain the band is given, and above the split it is the gain the
 * output receives: `bass_split_test.cpp` holds the delivered response to the
 * shelf's closed form at seven frequencies, and it reaches this number four
 * octaves up. Across the corner it arrives gradually, as a shelf does — that
 * is the reading, not a discrepancy. Before the split was built on a one-pole
 * it was a discrepancy: this said -6.0 while 200 Hz measured -11.98.
 */
double feq_bass_punch_duck_db(const FeqBassPunch* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_BASS_PUNCH_H */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass transient shaping and a short mono bloom tail.
 *
 * The gain follows the bass envelope. Tail duck reduces the generated bloom
 * under a new hit; it never attenuates the rest of the programme.
 *
 * A final linear-phase filter confines the complete contribution to bass.
 * Lookahead gives the bass detector time to catch the hit. The original
 * waveform is delayed by lookahead plus filter alignment and added unchanged.
 * Bypass keeps that alignment and current histories, avoiding timing jumps
 * when this stage is switched on or off.
 */
#ifndef FLUIDEQ_BASS_PUNCH_H
#define FLUIDEQ_BASS_PUNCH_H

#include <stdint.h>

#include "fluideq/biquad.h"

// Six averaging sections give a nonnegative, linear-phase low-pass response.
// Capacity covers device rates up to 409.6 kHz without audio-thread allocation.
#define FEQ_BASS_PUNCH_BAND_STAGES 6
#define FEQ_BASS_PUNCH_BAND_CAPACITY 1024
#define FEQ_BASS_PUNCH_DRY_CAPACITY (5 * FEQ_BASS_PUNCH_BAND_CAPACITY)

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
  /** Hear only the band-limited contribution; zero controls settle to silence. */
  int isolate;
  /** Bass focus, 40–200 Hz; the final contribution stays within the bass band. */
  double split_hz;
  /** Leading-edge amount, -1 to +1, with a short release across the bass hit. */
  double attack;
  /** The tail, -1 to +1: negative is dry and tight, positive is wet and long. */
  double sustain;
  /** How much of the bloom arrives, 0 to 1. Zero is bypass. */
  double bloom_amount;
  /** Its decay, 40 to 250 ms, and it is a measured decay. See the source. */
  double bloom_decay_ms;
  /** How much bloom is pulled down while a new bass hit arrives, 0 to 1. */
  double duck;
  /** 0 is dry; 1 is normal; 2 doubles additions and deepens cuts in decibels. */
  double mix;
} FeqBassPunchSettings;

/** One delay line of the bloom network. The buffer is caller-owned. */
typedef struct FeqBassPunchDelay {
  float* buffer;
  uint32_t capacity;
  uint32_t delay;
  uint32_t cursor;
} FeqBassPunchDelay;

typedef struct FeqBassPunchBand {
  double history[FEQ_BASS_PUNCH_BAND_STAGES][FEQ_BASS_PUNCH_BAND_CAPACITY];
  double sum[FEQ_BASS_PUNCH_BAND_STAGES];
  double fresh_sum[FEQ_BASS_PUNCH_BAND_STAGES];
  float dry[FEQ_BASS_PUNCH_DRY_CAPACITY];
  uint32_t cursor;
  uint32_t dry_cursor;
} FeqBassPunchBand;

typedef struct FeqBassPunch {
  /**
   * The DETECTOR's band: one Linkwitz-Riley 4th-order lowpass per channel.
   *
   * Steep, because what the followers are asked to find is a kick and not a
   * snare, and 24 dB per octave is what keeps a vocal out of the envelope. It
   * is separate from the phase-aligned contribution filter below.
   */
  FeqBiquadState split[2][2];
  /** Band-limit the complete contribution, including modulation sidebands. */
  FeqBassPunchBand band[2];
  uint32_t band_length;
  uint32_t lookahead_frames;
  /** The bloom's band limit. Mono, so one pair of stages rather than two. */
  FeqBiquadState bloom_low[2];
  FeqBassPunchDelay combs[FEQ_BASS_PUNCH_COMBS];
  FeqBassPunchDelay all_pass;
  /** Smoothed, because the dial is dragged and these are the loop gains. */
  double comb_feedback[FEQ_BASS_PUNCH_COMBS];
  double all_pass_gain;
  /** Fast envelope, then two slower copies for onset and decay contrast. */
  double detector_mean_square;
  double fast;
  double slow;
  double slower;
  /** Bounded onset emphasis, released over several cycles of a bass note. */
  double punch_envelope_db;
  /** The duck's own follower, and the gain it produced. */
  double duck_level;
  /** Smoothed controls. `primed` is clear until the first block has run. */
  int primed;
  double attack;
  double sustain;
  double bloom_amount;
  double duck;
  double mix;
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

/** The fixed dry-path alignment also runs while the stage is bypassed. */
uint32_t feq_bass_punch_latency_frames(double sample_rate);

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
 * Bypass and zero controls preserve the original samples after the fixed
 * alignment delay and the finite contribution tail have drained. They do not
 * run the original waveform through an equalizer.
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

/** Gain applied only to the generated bloom tail, in dB. **Control thread.** */
double feq_bass_punch_duck_db(const FeqBassPunch* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_BASS_PUNCH_H */

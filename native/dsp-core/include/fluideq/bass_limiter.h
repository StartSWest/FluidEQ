/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Maximizer's low band: a peak the bass put over the ceiling is taken out
 * of the bass.
 *
 * On a record that is already loud, the loudest moments are the kick's, and
 * every peak a rack adds down there — Bass Punch's onset above all, a bass
 * shelf, the Maximizer's own drive — reaches the ceiling as a peak of the
 * WHOLE record. A broadband limiter can only answer that by turning the whole
 * record down, the voice and the cymbals with the kick, and letting them back
 * up over the following beat. That is pumping, and it is heard in everything
 * except the kick that caused it. Ivan, 2026-09-22, on the Punch chain: "lot
 * of bumping, sucks really big".
 *
 * This stage runs in front of the Maximizer's limiter. A first-order low-pass
 * splits each channel into a low band and the rest, which add back to exactly
 * the input, and only the low band's gain moves. At unity the stage is a delay
 * and nothing else; moved, it is a low shelf that dips for the length of a
 * kick's peak.
 *
 * What it asks of the low band is exact, per sample. A sample `s = low + rest`
 * over the target comes down to it at a low-band gain of
 * `1 - (|s| - target) / |low|` when the low band points the same way as the
 * peak; when it points the other way, lowering it only makes the sample
 * louder, so the low band is left alone and the limiter behind this stage
 * catches that peak as it always did. The gain has a floor, and whatever a
 * peak still needs past it is the limiter's too.
 *
 * Two things keep it to the kick's peaks and off everything else:
 *
 *  - Only a peak the low band carries most of. Where the low band is a small
 *    part of a sample, taking a decibel off the sample means taking many off
 *    the bass, which moves the bass further than the limiter would have moved
 *    the record; so the share of the excess the low band takes rises from none
 *    at 40% of the sample to all of it at 60%.
 *  - Only what rises above the limiter's platform (`limiter.h`). Dense
 *    material asks the limiter for a steady reduction, and a steady reduction
 *    is not pumping — the platform is there to hold it. A peak no higher than
 *    the platform already holds costs nothing, so the target is the peak the
 *    platform answers for, and a driven record keeps its steady reduction in
 *    the limiter, on everything alike, with its bass where the profile left it.
 *
 * Linked across channels, like the limiter: one gain for every channel, from
 * whichever channel needs the most, so a kick panned a little to one side does
 * not move the image.
 */
#ifndef FLUIDEQ_BASS_LIMITER_H
#define FLUIDEQ_BASS_LIMITER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** The chain's width (`FEQ_CHAIN_MAX_CHANNELS`, held equal by chain.cpp). */
#define FEQ_BASS_LIMITER_MAX_CHANNELS 8

typedef struct FeqBassLimiter {
  /** Each channel's split: the one-pole low-pass's integrator. */
  double split[FEQ_BASS_LIMITER_MAX_CHANNELS];
  /**
   * `channels` pointers each, every line `capacity` floats, caller-owned: the
   * input and its low band, delayed together so the gain decided for a sample
   * meets the sample it was decided for.
   */
  float** input_delay;
  float** low_delay;
  /** The low band's gain in dB, delayed in lockstep. Caller-owned. */
  float* gain_db;
  uint32_t channels;
  uint32_t capacity;
  /** Samples of look-ahead, at most `capacity - 1`; see the limiter's. */
  uint32_t look_ahead;
  int64_t position;
  /** The gain the peaks are asking for, before the look-ahead's fade. */
  double detector_gain;
  int64_t release_hold_remaining;
  /**
   * The deepest gain asked for in the window running now and in the one
   * before it: together, the last `window_samples` to twice that. Recovery
   * aims there rather than at the sample in hand, which between two peaks of
   * a bass note asks for nothing at all.
   */
  double window_asked;
  double previous_window_asked;
  int64_t window_elapsed;
  /** The low band's gain on the most recently emitted frame, for a meter. */
  double gain;
} FeqBassLimiter;

typedef struct FeqBassLimiterOptions {
  /**
   * The limiter's ceiling (linear), knee and platform (dB, 0 or below): the
   * curve this stage reads its target from. No finite, positive ceiling
   * means nothing to limit, and the stage is its delay.
   */
  double ceiling;
  double knee_db;
  double platform_db;
  /** The deepest the low band's gain goes, linear, 0 to 1. */
  double floor_gain;
  /** The split's corner. */
  double split_hz;
  /** Per-sample recovery toward the gain the peaks ask for, 0 to 1. */
  double release_coefficient;
  /** Samples a reduction is held before it may recover. */
  double release_hold_samples;
  /**
   * Samples a peak's reduction stays the recovery's aim: at least half a
   * cycle of the lowest bass note, or recovery starts in the trough between
   * two of its peaks and the gain moves inside every cycle. 0 aims at the
   * sample in hand.
   */
  double window_samples;
  /** Finish a recovery once its remaining gap is this fraction of it. */
  double release_snap_ratio;
  double sample_rate;
} FeqBassLimiterOptions;

/**
 * `input_delay` and `low_delay` are `channels` lines each and `gain_db` one,
 * all `capacity` floats long and all the caller's: the audio thread does not
 * allocate. Starts with the whole ring as look-ahead, like the limiter.
 */
void feq_bass_limiter_init(FeqBassLimiter* state,
                           float** input_delay,
                           float** low_delay,
                           float* gain_db,
                           uint32_t channels,
                           uint32_t capacity);

/**
 * Move the look-ahead without touching the audio already in the delay: one
 * integer the next sample reads, clamped to `capacity - 1`. Safe from the
 * command thread while the audio thread runs, for the reason the limiter's is.
 */
void feq_bass_limiter_set_look_ahead(FeqBassLimiter* state,
                                     uint32_t look_ahead);

/** Clear the gain control without emptying the delays or the split. */
void feq_bass_limiter_reset_control(FeqBassLimiter* state);

/** Empty the delays and the split as well: a new source, not an A/B. */
void feq_bass_limiter_reset(FeqBassLimiter* state);

/** Shape every channel in place, delayed by the look-ahead. */
void feq_bass_limiter_process(FeqBassLimiter* state,
                              float* const* channels,
                              uint32_t frames,
                              const FeqBassLimiterOptions* options);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_BASS_LIMITER_H */

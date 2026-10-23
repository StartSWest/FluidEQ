/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#ifndef FLUIDEQ_ROOM_RATE_H
#define FLUIDEQ_ROOM_RATE_H

#include <cstdint>
#include <vector>

/**
 * The Room on an output faster than its heads: 88.2, 176.4 and 352.8 kHz
 * render at 44.1, and 384 kHz at 96 — the room's input taken down by an
 * integer factor, its two ears brought back up (`feq_room_head_rate`).
 *
 * It used to render nothing at those rates, with the card blaming a missing
 * head: the heads ship at 44.1, 48 and 96 kHz and only 192 had a way to them
 * (doubling the 96 block, `head_response`). Interpolating a head four or
 * eight times is not that way: the classic renderer's kernel is a fixed
 * 2048 taps, 5.3 ms at 384 kHz and too short for its walls, and the new
 * one's grows with the rate, so either would do four to sixty-four times
 * the work for an octave above 24 kHz no head measurement carries. So the
 * room renders where its head was measured, and only this converts.
 *
 * One linear-phase Kaiser-windowed sinc for both directions, 100 dB down,
 * flat to 20 kHz and stopped from where an image of that edge lands, the
 * room's rate less 20 kHz: nothing that is heard aliases on the way down or
 * leaves an image on the way up. The
 * delay is the filter's length less one, exactly — the two halves of the
 * symmetric filter, with the samples a block leaves over primed to cancel
 * the decimator's phase. Neither converter the core already has does this:
 * `resampler.h` is not for the audio thread and has no fixed delay to
 * report, and `oversample.h` goes no further than 4x and only in whole
 * multiples of its factor, where a driver's block can be any length.
 *
 * AUDIO thread for `decimate`, `interpolate`, `reset` and `swap_state`;
 * `prepare` allocates and runs where the room is created.
 */
class RoomRate {
 public:
  /**
   * Rendering at `room_rate`, the output's divided by `factor` — 2, 4 or 8;
   * anything else, or a room too slow for the flat band, leaves the
   * converter inert.
   */
  void prepare(double room_rate, uint32_t factor, uint32_t channels,
               uint32_t max_frames);

  uint32_t factor() const noexcept { return factor_; }

  /** The stream frames the two filters add, together: taps less one. */
  uint32_t latency() const noexcept { return taps_ == 0 ? 0u : taps_ - 1u; }

  /** The most room frames one call of `decimate` can hand back. */
  uint32_t max_room_frames() const noexcept { return max_room_frames_; }

  /**
   * `frames` of each of the first `channels` inputs, taken down into `room`;
   * returns how many room frames came out — `frames / factor`, give or take
   * one as the factor's phase carries across blocks.
   */
  uint32_t decimate(const float* const* in, uint32_t frames,
                    float* const* room);

  /**
   * `room_frames` of the two ears brought back up, `frames` of them written
   * to `out[0]` and `out[1]`: what does not fill this block is kept for the
   * next.
   */
  void interpolate(const float* const* room, uint32_t room_frames,
                   float* const* out, uint32_t frames);

  /** Empties every history and primes the samples kept between blocks. */
  void reset() noexcept;

  /** A chain handover: the histories and what is kept move to the new room. */
  void swap_state(RoomRate& other) noexcept;

 private:
  uint32_t factor_ = 0;
  uint32_t channels_ = 0;
  uint32_t taps_ = 0;
  uint32_t phase_taps_ = 0;
  uint32_t max_room_frames_ = 0;
  // Decimation: unity gain at DC, symmetric. Interpolation: the same filter
  // split into `factor_` phases of `phase_taps_`, each scaled by the factor
  // and stored back to front.
  std::vector<float> kernel_;
  std::vector<float> phases_;
  // Doubled rings, each channel's history once oldest first and once newest
  // first: either way the newest `taps_` (or `phase_taps_`) samples sit
  // contiguously, so no inner loop wraps or runs backwards.
  std::vector<float> in_ring_;
  std::vector<float> in_mirror_;
  uint32_t in_cursor_ = 0;
  uint32_t in_mirror_cursor_ = 0;
  uint32_t in_phase_ = 0;
  std::vector<float> ear_ring_;
  uint32_t ear_cursor_ = 0;
  // Each ear's output made and not yet handed out, from the front.
  std::vector<float> pending_;
  uint32_t pending_capacity_ = 0;
  uint32_t pending_size_ = 0;
};

#endif  // FLUIDEQ_ROOM_RATE_H

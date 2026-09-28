/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ring arithmetic `limiter.cpp` and `bass_limiter.cpp` share.
 *
 * Both hold their audio back by a look-ahead and write the gain they decide
 * into a ring that runs in lockstep with it, so a gain can be lowered BEFORE
 * the peak that asked for it is heard. Two copies of the ramp that does that
 * would be two chances for the two stages of one Maximizer to disagree about
 * where a peak lands.
 */
#ifndef FLUIDEQ_LIMITER_INTERNAL_H
#define FLUIDEQ_LIMITER_INTERNAL_H

#include <stdint.h>

namespace feq_limiter {

/**
 * One sample of a recovery from `gain` up towards `target`: `1 - coefficient`
 * of the gap, until the gap is `finish_ratio` of the target, and from there
 * straight on at the pace it had there, so it arrives one release time later
 * rather than never.
 *
 * It used to jump the rest of the way in one sample, and the jump was a
 * click of its own: the Maximizer's last 2% is 0.17 dB, heard at -69 dBFS
 * above 5 kHz under four low tones, 150 ms after every hit it limited
 * (measured in a Punch rack starting from silence; with this, nothing left
 * above -86 over the rack's steady -88.5).
 */
inline double release_toward(double gain,
                             double target,
                             double coefficient,
                             double finish_ratio) {
  const double step = (target - gain) * (1.0 - coefficient);
  if (!(target > gain)) {
    return gain + step;
  }
  const double least = target * finish_ratio * (1.0 - coefficient);
  const double next = gain + (step > least ? step : least);
  return next < target ? next : target;
}

/** Positive modulo over a capacity, for the ring indices. */
inline int64_t slot(int64_t value, uint32_t capacity) {
  const int64_t span = static_cast<int64_t>(capacity);
  const int64_t rest = value % span;
  return rest < 0 ? rest + span : rest;
}

/**
 * Back-fill a linear-in-dB fade that reaches `reduction_db` exactly at
 * `position`, over the `span` samples in front of it.
 *
 * A deeper value already in the ring wins, so overlapping peaks stay covered:
 * the fade stops at the first slot that is already at or below it, because
 * everything behind that slot was written by a deeper ramp still.
 */
inline void back_fill(float* ring,
                      uint32_t capacity,
                      int64_t position,
                      int64_t span,
                      double reduction_db) {
  if (span <= 0 || !(reduction_db < 0.0)) {
    return;
  }
  const double step_db = -reduction_db / static_cast<double>(span);
  double ramp_db = reduction_db + step_db;
  for (int64_t back = 1; back <= span; ++back) {
    const int64_t index = slot(position - back, capacity);
    if (static_cast<double>(ring[index]) <= ramp_db) {
      break;
    }
    ring[index] = static_cast<float>(ramp_db);
    ramp_db += step_db;
  }
}

}  // namespace feq_limiter

#endif /* FLUIDEQ_LIMITER_INTERNAL_H */

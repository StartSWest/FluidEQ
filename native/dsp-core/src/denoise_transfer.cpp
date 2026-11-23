/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "denoise_internal.h"
#include <utility>

namespace {

/**
 * Whether the playing restoration's state can carry into the prepared one.
 *
 * The voice cleaner carries too, now, by trading runtimes: a mic's rack is
 * rebuilt on every switch flipped on its tab, and a cleaner that started
 * again from nothing on each one — a fresh worker, a cold model, an empty
 * delayed input — could only be handed over by playing two racks through a
 * crossfade, two models racing their hops at once. Anything new handed to a
 * restoration joins this check and the swap below in the same commit, as
 * `reuse_rack` and `feq_chain_transfer_state` require of the rack's stages:
 * a state left out starts from nothing in the middle of the stream.
 */
bool carries(const FeqDenoise* prepared, const FeqDenoise* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous ||
      prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels ||
      prepared->window != previous->window ||
      prepared->max_frames != previous->max_frames ||
      prepared->profile_ready || previous->profile_ready ||
      prepared->settings.enabled != previous->settings.enabled ||
      prepared->settings.hiss.enabled != previous->settings.hiss.enabled ||
      prepared->settings.click.enabled != previous->settings.click.enabled ||
      prepared->settings.click.max_repair_samples !=
          previous->settings.click.max_repair_samples) {
    return false;
  }
  const bool fresh_voice = prepared->voice.load(std::memory_order_acquire) != nullptr;
  const bool playing_voice = previous->voice.load(std::memory_order_acquire) != nullptr;
  if (!fresh_voice && !playing_voice) {
    return true;
  }
  return denoise_voice_can_swap(prepared, previous);
}

}  // namespace

extern "C" int feq_denoise_can_transfer_state(const FeqDenoise* prepared,
                                              const FeqDenoise* previous) {
  return carries(prepared, previous) ? 1 : 0;
}

extern "C" int feq_denoise_transfer_state(FeqDenoise* prepared, FeqDenoise* previous) {
  if (!carries(prepared, previous)) {
    return 0;
  }
  // New knobs keep their prepared coefficients; the estimator and delayed
  // samples keep playing. A normal EQ edit must not retrain the noise floor
  // from silence or empty all the restoration delay lines.
  using std::swap;
  swap(prepared->spectral, previous->spectral);
  swap(prepared->click, previous->click);
  swap(prepared->dry_delay, previous->dry_delay);
  swap(prepared->dry_cursor, previous->dry_cursor);
  swap(prepared->live_floor_db, previous->live_floor_db);
  swap(prepared->live_hiss_reduction_db, previous->live_hiss_reduction_db);
  swap(prepared->live_hum, previous->live_hum);
  for (uint32_t family = 0; family < 2; ++family) {
    for (uint32_t partial = 0; partial < FEQ_DENOISE_MAX_HUM_PARTIALS; ++partial) {
      swap(prepared->live_hum.families[family][partial].notch,
           previous->live_hum.families[family][partial].notch);
      swap(prepared->live_hum.families[family][partial].depth_db,
           previous->live_hum.families[family][partial].depth_db);
    }
  }
  if (prepared->settings.hum.mode == previous->settings.hum.mode &&
      prepared->hum_coefficients.size() == previous->hum_coefficients.size()) {
    swap(prepared->hum, previous->hum);
  }
  if (prepared->voice.load(std::memory_order_acquire) != nullptr) {
    denoise_voice_swap(prepared, previous);
  }
  prepared->reported_clicks.store(previous->reported_clicks.load(std::memory_order_relaxed),
                                  std::memory_order_relaxed);
  prepared->reported_voice_underruns.store(
      previous->reported_voice_underruns.load(std::memory_order_relaxed),
      std::memory_order_relaxed);
  return 1;
}

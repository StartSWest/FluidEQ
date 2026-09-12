/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "denoise_internal.h"
#include <utility>

extern "C" int feq_denoise_transfer_state(FeqDenoise* prepared, FeqDenoise* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous ||
      prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels || prepared->window != previous->window ||
      prepared->max_frames != previous->max_frames ||
      prepared->profile_ready || previous->profile_ready ||
      prepared->voice.load(std::memory_order_relaxed) != nullptr ||
      previous->voice.load(std::memory_order_relaxed) != nullptr ||
      prepared->settings.enabled != previous->settings.enabled ||
      prepared->settings.hiss.enabled != previous->settings.hiss.enabled ||
      prepared->settings.click.enabled != previous->settings.click.enabled ||
      prepared->settings.click.max_repair_samples != previous->settings.click.max_repair_samples) {
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
  prepared->reported_clicks.store(previous->reported_clicks.load(std::memory_order_relaxed),
                                  std::memory_order_relaxed);
  return 1;
}

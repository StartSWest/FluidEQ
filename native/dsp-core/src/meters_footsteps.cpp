/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "meters_footsteps.h"

namespace {

constexpr float kFloorDb = -120.0f;

void fold_above(std::atomic<float>& slot, float value) {
  float held = slot.load(std::memory_order_relaxed);
  while (value > held &&
         !slot.compare_exchange_weak(held, value, std::memory_order_relaxed)) {
  }
}

void fold_below(std::atomic<float>& slot, float value) {
  float held = slot.load(std::memory_order_relaxed);
  while (value < held &&
         !slot.compare_exchange_weak(held, value, std::memory_order_relaxed)) {
  }
}

}  // namespace

FootstepsMeterWindow::FootstepsMeterWindow() {
  for (auto& lift : lift_db) {
    lift.store(0.0f, std::memory_order_relaxed);
  }
}

void footsteps_window_fold(FootstepsMeterWindow& window,
                           const FeqFootstepsReport& report) {
  fold_above(window.level_db, report.level_db);
  fold_above(window.cue_db, report.cue_db);
  window.bed_db.store(report.bed_db, std::memory_order_relaxed);
  for (int band = 0; band < FEQ_FOOTSTEPS_BANDS; ++band) {
    fold_above(window.lift_db[band], report.lift_db[band]);
  }
  fold_below(window.calm_db, report.calm_db);
}

void footsteps_window_take(FootstepsMeterWindow& window,
                           FeqFootstepsReport* out) {
  out->level_db = window.level_db.exchange(kFloorDb, std::memory_order_relaxed);
  out->cue_db = window.cue_db.exchange(kFloorDb, std::memory_order_relaxed);
  out->bed_db = window.bed_db.load(std::memory_order_relaxed);
  for (int band = 0; band < FEQ_FOOTSTEPS_BANDS; ++band) {
    out->lift_db[band] =
        window.lift_db[band].exchange(0.0f, std::memory_order_relaxed);
  }
  out->calm_db = window.calm_db.exchange(0.0f, std::memory_order_relaxed);
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "meters_deesser.h"

namespace {

constexpr float kFloorDb = -120.0f;

void fold_below(std::atomic<float>& slot, float value) {
  float held = slot.load(std::memory_order_relaxed);
  while (value < held &&
         !slot.compare_exchange_weak(held, value, std::memory_order_relaxed)) {
  }
}

void fold_above(std::atomic<float>& slot, float value) {
  float held = slot.load(std::memory_order_relaxed);
  while (value > held &&
         !slot.compare_exchange_weak(held, value, std::memory_order_relaxed)) {
  }
}

}  // namespace

DeEsserMeterWindow::DeEsserMeterWindow() {
  for (uint32_t band = 0; band < FEQ_DEESSER_MAX_BANDS; ++band) {
    band_hz[band].store(0.0f, std::memory_order_relaxed);
    band_level_db[band].store(kFloorDb, std::memory_order_relaxed);
    band_threshold_db[band].store(kFloorDb, std::memory_order_relaxed);
    band_cut_db[band].store(0.0f, std::memory_order_relaxed);
  }
}

void deesser_window_fold(DeEsserMeterWindow& window,
                         const FeqDeEsserReport& report) {
  // Where the S was and how sure the stage was go with the deepest cut of the
  // window, so the page names the frequency it actually cut.
  const auto tells = [&window, &report]() {
    window.confidence.store(report.confidence, std::memory_order_relaxed);
    window.centre.store(report.centre, std::memory_order_relaxed);
    window.shape.store(report.shape, std::memory_order_relaxed);
    window.onset.store(report.onset, std::memory_order_relaxed);
  };
  if (report.reduction_db < window.reduction_db.load(std::memory_order_relaxed)) {
    window.frequency_hz.store(report.frequency_hz, std::memory_order_relaxed);
    tells();
  } else if (window.reduction_db.load(std::memory_order_relaxed) == 0.0f &&
             report.sibilance_db >
                 window.sibilance_db.load(std::memory_order_relaxed)) {
    tells();
  }
  fold_below(window.reduction_db, report.reduction_db);
  fold_above(window.sibilance_db, report.sibilance_db);
  const uint32_t bands = report.band_count < FEQ_DEESSER_MAX_BANDS
                             ? report.band_count
                             : FEQ_DEESSER_MAX_BANDS;
  window.band_count.store(bands, std::memory_order_relaxed);
  for (uint32_t band = 0; band < bands; ++band) {
    window.band_hz[band].store(report.band_hz[band], std::memory_order_relaxed);
    fold_above(window.band_level_db[band], report.band_level_db[band]);
    window.band_threshold_db[band].store(report.band_threshold_db[band],
                                         std::memory_order_relaxed);
    fold_below(window.band_cut_db[band], report.band_cut_db[band]);
  }
}

void deesser_window_take(DeEsserMeterWindow& window, FeqDeEsserReport* out) {
  out->reduction_db = window.reduction_db.exchange(0.0f, std::memory_order_relaxed);
  out->frequency_hz = window.frequency_hz.exchange(0.0f, std::memory_order_relaxed);
  out->confidence = window.confidence.exchange(0.0f, std::memory_order_relaxed);
  out->centre = window.centre.exchange(0.0f, std::memory_order_relaxed);
  out->shape = window.shape.exchange(0.0f, std::memory_order_relaxed);
  out->onset = window.onset.exchange(0.0f, std::memory_order_relaxed);
  out->sibilance_db =
      window.sibilance_db.exchange(kFloorDb, std::memory_order_relaxed);
  out->band_count = window.band_count.load(std::memory_order_relaxed);
  for (uint32_t band = 0; band < FEQ_DEESSER_MAX_BANDS; ++band) {
    out->band_hz[band] = window.band_hz[band].load(std::memory_order_relaxed);
    out->band_level_db[band] =
        window.band_level_db[band].exchange(kFloorDb, std::memory_order_relaxed);
    out->band_threshold_db[band] =
        window.band_threshold_db[band].load(std::memory_order_relaxed);
    out->band_cut_db[band] =
        window.band_cut_db[band].exchange(0.0f, std::memory_order_relaxed);
  }
}

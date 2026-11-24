/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "meters_voice.h"

#include <new>

namespace {

/** The level the gate reads while it hears nothing, as every meter's floor. */
constexpr float kGateFloorDb = -120.0f;

}  // namespace

VoiceMeterWindow::~VoiceMeterWindow() {
  delete arrival.load(std::memory_order_acquire);
}

void voice_window_prepare(VoiceMeterWindow& window) {
  if (window.arrival.load(std::memory_order_acquire) != nullptr) {
    return;
  }
  // Published whole: the audio thread sees null, or a ring ready to write.
  window.arrival.store(new (std::nothrow) EqLiveWindow(),
                       std::memory_order_release);
}

void voice_window_capture(VoiceMeterWindow& window,
                          const float* left,
                          const float* right,
                          uint32_t frames) {
  EqLiveWindow* arrival = window.arrival.load(std::memory_order_acquire);
  if (arrival != nullptr) {
    eq_live_capture(*arrival, left, right, frames);
  }
}

void voice_window_restart(VoiceMeterWindow& window) {
  EqLiveWindow* arrival = window.arrival.load(std::memory_order_acquire);
  if (arrival != nullptr) {
    eq_live_restart(*arrival);
  }
}

int voice_window_read_short(VoiceMeterWindow& window,
                            double sample_rate,
                            float* out_db) {
  EqLiveWindow* arrival = window.arrival.load(std::memory_order_acquire);
  return arrival != nullptr ? eq_live_read_short(*arrival, sample_rate, out_db)
                            : 0;
}

int voice_window_read_long(VoiceMeterWindow& window,
                           double sample_rate,
                           float* out_db) {
  EqLiveWindow* arrival = window.arrival.load(std::memory_order_acquire);
  return arrival != nullptr ? eq_live_read_long(*arrival, sample_rate, out_db)
                            : 0;
}

void voice_window_publish(VoiceMeterWindow& window,
                          const FeqVoiceReport& report) {
  window.gate_level_db.store(report.gate_level_db, std::memory_order_relaxed);
  window.gate_gain_db.store(report.gate_gain_db, std::memory_order_relaxed);
  window.active.store(report.active, std::memory_order_relaxed);
}

void voice_window_read(const VoiceMeterWindow& window, FeqVoiceReport* out) {
  if (out == nullptr) {
    return;
  }
  *out = FeqVoiceReport{};
  out->active = window.active.load(std::memory_order_relaxed);
  out->gate_level_db = out->active != 0
                           ? window.gate_level_db.load(std::memory_order_relaxed)
                           : kGateFloorDb;
  out->gate_gain_db = out->active != 0
                          ? window.gate_gain_db.load(std::memory_order_relaxed)
                          : 0.0f;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/compander.h"

#include <algorithm>
#include <cmath>
#include <new>

namespace {

constexpr double kPi = 3.14159265358979323846;
/** The detector's window: long enough to read a level, short enough for a step. */
constexpr double kDetectorMs = 10.0;
/** Over this many dB above the floor the lift reaches its full amount. */
constexpr double kLiftFadeDb = 6.0;
constexpr double kSilencePower = 1e-15;

double one_pole(double sample_rate, double hz) {
  return std::exp(-2.0 * kPi * hz / sample_rate);
}

double time_coefficient(double sample_rate, double ms) {
  return std::exp(-1.0 / (std::max(ms, 0.05) * 1e-3 * sample_rate));
}

double clamp(double value, double low, double high) {
  return std::isfinite(value) ? std::min(std::max(value, low), high) : low;
}

}  // namespace

struct FeqCompander {
  double sample_rate = 48000.0;
  uint32_t channels = 0;
  int lfe = -1;
  FeqCompanderSettings settings{};
  bool active = false;
  double low_c = 0.0;
  double high_c = 0.0;
  double detector_c = 0.0;
  double attack_c = 0.0;
  double release_c = 0.0;
  /** Per channel: the 150 Hz low-pass and the 4 kHz low-pass of the rest. */
  double low_state[FEQ_COMPANDER_MAX_CHANNELS] = {};
  double high_state[FEQ_COMPANDER_MAX_CHANNELS] = {};
  /** Per band, linked: the detector's power and the gain in dB. */
  double power[FEQ_COMPANDER_BANDS] = {};
  double gain_db[FEQ_COMPANDER_BANDS] = {};
  FeqCompanderReport report{};
};

void feq_compander_settings_defaults(FeqCompanderSettings* settings) {
  if (settings == nullptr) {
    return;
  }
  *settings = FeqCompanderSettings{};
  for (FeqCompanderBand& band : settings->bands) {
    band.up_threshold_db = -40.0;
    band.up_ratio = 1.0;
    band.up_max_db = 0.0;
    band.down_threshold_db = -20.0;
    band.down_ratio = 1.0;
  }
  settings->attack_ms = 10.0;
  settings->release_ms = 200.0;
  settings->mix = 1.0;
  settings->makeup_db = 0.0;
}

namespace {

void start_report(FeqCompanderReport& report) {
  for (int band = 0; band < FEQ_COMPANDER_BANDS; ++band) {
    report.level_db[band] = -120.0f;
    report.lift_db[band] = 0.0f;
    report.hold_db[band] = 0.0f;
  }
}

/** The gain a band asks for at `level_db`, before any smoothing. */
double target_gain_db(const FeqCompanderBand& band, double level_db) {
  double gain = 0.0;
  if (band.up_ratio > 1.0 && level_db < band.up_threshold_db) {
    const double lift = std::min(
        band.up_max_db,
        (band.up_threshold_db - level_db) * (1.0 - 1.0 / band.up_ratio));
    // Faded in over the 6 dB above the floor, so silence is never lifted
    // and nothing jumps as a sound rises out of it.
    const double above = level_db - FEQ_COMPANDER_LIFT_FLOOR_DB;
    gain += lift * clamp(above / kLiftFadeDb, 0.0, 1.0);
  }
  if (band.down_ratio > 1.0 && level_db > band.down_threshold_db) {
    gain -= (level_db - band.down_threshold_db) * (1.0 - 1.0 / band.down_ratio);
  }
  return gain;
}

bool band_does_something(const FeqCompanderBand& band) {
  return (band.up_ratio > 1.0 && band.up_max_db > 0.0) ||
         band.down_ratio > 1.0;
}

}  // namespace

FeqCompander* feq_compander_create(double sample_rate, uint32_t channels) {
  auto* state = new (std::nothrow) FeqCompander();
  if (state == nullptr) {
    return nullptr;
  }
  state->sample_rate = sample_rate > 0.0 ? sample_rate : 48000.0;
  state->channels = std::min<uint32_t>(channels, FEQ_COMPANDER_MAX_CHANNELS);
  state->low_c = one_pole(state->sample_rate, FEQ_COMPANDER_LOW_SPLIT_HZ);
  state->high_c = one_pole(state->sample_rate, FEQ_COMPANDER_HIGH_SPLIT_HZ);
  state->detector_c = time_coefficient(state->sample_rate, kDetectorMs);
  feq_compander_settings_defaults(&state->settings);
  feq_compander_configure(state, &state->settings);
  feq_compander_reset(state);
  return state;
}

void feq_compander_destroy(FeqCompander* state) { delete state; }

void feq_compander_configure(FeqCompander* state,
                             const FeqCompanderSettings* settings) {
  if (state == nullptr || settings == nullptr) {
    return;
  }
  FeqCompanderSettings next = *settings;
  for (FeqCompanderBand& band : next.bands) {
    band.up_threshold_db = clamp(band.up_threshold_db, -80.0, -10.0);
    band.up_ratio = clamp(band.up_ratio, 1.0, 4.0);
    band.up_max_db = clamp(band.up_max_db, 0.0, 18.0);
    band.down_threshold_db = clamp(band.down_threshold_db, -60.0, 0.0);
    band.down_ratio = clamp(band.down_ratio, 1.0, 20.0);
  }
  next.attack_ms = clamp(next.attack_ms, 1.0, 100.0);
  next.release_ms = clamp(next.release_ms, 20.0, 1000.0);
  next.mix = clamp(next.mix, 0.0, 1.0);
  next.makeup_db = clamp(next.makeup_db, -12.0, 12.0);
  state->settings = next;
  state->attack_c = time_coefficient(state->sample_rate, next.attack_ms);
  state->release_c = time_coefficient(state->sample_rate, next.release_ms);
  bool any = false;
  for (const FeqCompanderBand& band : next.bands) {
    any = any || band_does_something(band);
  }
  state->active =
      next.enabled != 0 && next.mix > 0.0 && (any || next.makeup_db != 0.0);
}

void feq_compander_set_lfe(FeqCompander* state, int channel) {
  if (state != nullptr) {
    state->lfe = channel;
  }
}

void feq_compander_reset(FeqCompander* state) {
  if (state == nullptr) {
    return;
  }
  std::fill(std::begin(state->low_state), std::end(state->low_state), 0.0);
  std::fill(std::begin(state->high_state), std::end(state->high_state), 0.0);
  std::fill(std::begin(state->power), std::end(state->power), 0.0);
  std::fill(std::begin(state->gain_db), std::end(state->gain_db), 0.0);
  start_report(state->report);
}

void feq_compander_transfer(FeqCompander* into, const FeqCompander* from) {
  if (into == nullptr || from == nullptr ||
      into->sample_rate != from->sample_rate ||
      into->channels != from->channels) {
    return;
  }
  std::copy(std::begin(from->low_state), std::end(from->low_state),
            std::begin(into->low_state));
  std::copy(std::begin(from->high_state), std::end(from->high_state),
            std::begin(into->high_state));
  std::copy(std::begin(from->power), std::end(from->power),
            std::begin(into->power));
  std::copy(std::begin(from->gain_db), std::end(from->gain_db),
            std::begin(into->gain_db));
}

int feq_compander_active(const FeqCompander* state) {
  return state != nullptr && state->active ? 1 : 0;
}

void feq_compander_process(FeqCompander* state, float* const* channels,
                           uint32_t frames) {
  if (state == nullptr || channels == nullptr || !state->active) {
    return;
  }
  const FeqCompanderSettings& s = state->settings;
  const uint32_t count = state->channels;
  double split[FEQ_COMPANDER_MAX_CHANNELS][FEQ_COMPANDER_BANDS];
  for (uint32_t frame = 0; frame < frames; ++frame) {
    double loudest[FEQ_COMPANDER_BANDS] = {0.0, 0.0, 0.0};
    for (uint32_t c = 0; c < count; ++c) {
      const double x = channels[c][frame];
      state->low_state[c] = x + state->low_c * (state->low_state[c] - x);
      const double low = state->low_state[c];
      const double rest = x - low;
      state->high_state[c] =
          rest + state->high_c * (state->high_state[c] - rest);
      const double mid = state->high_state[c];
      split[c][0] = low;
      split[c][1] = mid;
      split[c][2] = rest - mid;
      if (static_cast<int>(c) != state->lfe) {
        for (int b = 0; b < FEQ_COMPANDER_BANDS; ++b) {
          loudest[b] = std::max(loudest[b], split[c][b] * split[c][b]);
        }
      }
    }
    double gain[FEQ_COMPANDER_BANDS];
    for (int b = 0; b < FEQ_COMPANDER_BANDS; ++b) {
      state->power[b] =
          loudest[b] + state->detector_c * (state->power[b] - loudest[b]);
      const double level_db =
          10.0 * std::log10(std::max(state->power[b], kSilencePower)) + 3.0103;
      const double target = target_gain_db(s.bands[b], level_db);
      const double coefficient =
          target < state->gain_db[b] ? state->attack_c : state->release_c;
      state->gain_db[b] =
          target + coefficient * (state->gain_db[b] - target);
      gain[b] = std::pow(10.0, (state->gain_db[b] + s.makeup_db) / 20.0);
      FeqCompanderReport& r = state->report;
      r.level_db[b] = std::max(r.level_db[b], static_cast<float>(level_db));
      r.lift_db[b] = std::max(r.lift_db[b],
                              static_cast<float>(state->gain_db[b]));
      r.hold_db[b] = std::min(r.hold_db[b],
                              static_cast<float>(state->gain_db[b]));
    }
    for (uint32_t c = 0; c < count; ++c) {
      if (static_cast<int>(c) == state->lfe) {
        continue;
      }
      const double x = channels[c][frame];
      const double processed =
          split[c][0] * gain[0] + split[c][1] * gain[1] + split[c][2] * gain[2];
      channels[c][frame] = static_cast<float>(x + s.mix * (processed - x));
    }
  }
}

void feq_compander_block_report(FeqCompander* state,
                                FeqCompanderReport* report) {
  if (state == nullptr || report == nullptr) {
    return;
  }
  *report = state->report;
  report->active = state->active ? 1u : 0u;
  for (int band = 0; band < FEQ_COMPANDER_BANDS; ++band) {
    // Read the gain already applied by the audio loop. No second detector,
    // no settings-derived target: the display follows attack and release too.
    const double wet = std::pow(
        10.0, (state->gain_db[band] + state->settings.makeup_db) / 20.0);
    report->gain_db[band] = state->active
        ? static_cast<float>(20.0 * std::log10(
              1.0 - state->settings.mix + state->settings.mix * wet))
        : 0.0f;
    if (!state->active) report->level_db[band] = -120.0f;
  }
  start_report(state->report);
}

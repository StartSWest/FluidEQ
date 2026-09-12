/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "fluideq/live_normalizer.h"
#include "fluideq/loudness_meter.h"
#include "fluideq/post_filter_normalizer.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <vector>

struct FeqLiveNormalizer {
  double rate;
  uint32_t channels;
  uint32_t latency;
  double gain_db = 0;
  uint64_t samples = 0;
  uint64_t learning_samples = 0;
  uint64_t silent_samples = 0;
  bool gap_cleared = false;
  int mode = -1;
  double reference_lufs = -120;
  double programme_peak = 0;
  FeqLoudnessMeter* loudness = nullptr;
  FeqPostFilterNormalizer safety{};
  std::vector<FeqTruePeak> detectors;
  std::vector<FeqTruePeak> input_detectors;
  std::vector<std::vector<float>> delay;
  std::vector<float*> planes;
  std::vector<float> reductions;
  ~FeqLiveNormalizer() { feq_loudness_meter_destroy(loudness); }
};

namespace {
double db(double value) { return value > 1e-6 ? 20 * std::log10(value) : -120; }
double bounded(double value, double fallback, double low, double high) {
  return std::isfinite(value) ? std::clamp(value, low, high) : fallback;
}
void clear_programme(FeqLiveNormalizer& state) {
  state.samples = state.learning_samples = 0;
  state.reference_lufs = -120;
  state.programme_peak = 0;
  feq_loudness_meter_reset(state.loudness);
}
void silent_frames(FeqLiveNormalizer& state, uint32_t frames) {
  if (state.gap_cleared) return;
  state.silent_samples += frames;
  if (state.silent_samples >= state.rate * 3) {
    clear_programme(state);
    state.gap_cleared = true;
  }
}

double leveling_target(FeqLiveNormalizer& state, const FeqLoudnessReading& measured,
                       double peak, uint32_t frames, const FeqNormalizerSettings& settings,
                       int& status) {
  // Three seconds of near-digital silence marks a new listening segment.
  // Quiet music is deliberately not a segment boundary. Without metadata we
  // cannot distinguish every seamless track change from musical dynamics.
  if (peak < 1e-5) {
    silent_frames(state, frames);
    status = 3;
    return state.gain_db;
  }
  state.silent_samples = 0;
  state.gap_cleared = false;
  state.programme_peak = std::max(state.programme_peak, peak);
  const bool complete_window = state.samples >= state.rate * 3;
  if (!complete_window || measured.momentary_lufs <= -50 ||
      measured.short_term_lufs <= -50) {
    status = state.learning_samples < state.rate * 10 ? 2 : 3;
    return state.gain_db;
  }
  const double seconds = static_cast<double>(frames) / state.rate;
  const bool learning = state.learning_samples < state.rate * 10;
  if (learning) {
    // Establish a representative foreground level before applying boost.
    state.reference_lufs = std::max(state.reference_lufs, measured.short_term_lufs);
    state.learning_samples += frames;
    status = 2;
    return state.gain_db;
  }
  // The old gate followed the same three-second window as the target. After
  // three quiet seconds it forgot the louder passage and started turning up
  // the music. This gate references persistent programme history instead.
  if (measured.momentary_lufs < state.reference_lufs - 6 ||
      measured.short_term_lufs < state.reference_lufs - 6) {
    status = 3;
    return state.gain_db;
  }
  const double time_constant = measured.short_term_lufs > state.reference_lufs ? 10 : 60;
  state.reference_lufs += (measured.short_term_lufs - state.reference_lufs) *
                          (-std::expm1(-seconds / time_constant));
  const double requested = bounded(settings.target_lufs, -14, -24, -5) - state.reference_lufs;
  const double peak_room = bounded(settings.ceiling_db, -1, -12, -0.1) -
                           db(state.programme_peak) - 0.5;
  // Preserve observed crest factor instead of boosting into continuous
  // limiting to force a LUFS target. A target is an aim, not a guarantee.
  const double target = std::clamp(std::min(requested, peak_room), -48.0, 6.0);
  status = target < requested - 0.75 ? 5 : 4;
  return std::abs(target - state.gain_db) <= 0.75 ? state.gain_db : target;
}
}

extern "C" {
FeqLiveNormalizer* feq_live_normalizer_create(double rate, uint32_t channels) {
  if (!std::isfinite(rate) || rate < 8000 || rate > 384000 ||
      channels == 0 || channels > 2) return nullptr;
  auto state = std::make_unique<FeqLiveNormalizer>();
  state->rate = rate;
  state->channels = channels;
  state->latency = feq_post_filter_normalizer_look_ahead(rate);
  state->loudness = feq_loudness_meter_create(rate, channels);
  if (state->loudness == nullptr) return nullptr;
  state->detectors.resize(channels);
  state->input_detectors.resize(channels);
  state->delay.resize(channels);
  state->planes.resize(channels);
  state->reductions.resize(state->latency + 1);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    state->delay[channel].resize(state->latency + 1);
    state->planes[channel] = state->delay[channel].data();
  }
  feq_live_normalizer_reset(state.get());
  return state.release();
}
void feq_live_normalizer_destroy(FeqLiveNormalizer* state) { delete state; }
void feq_live_normalizer_reset(FeqLiveNormalizer* state) {
  if (state == nullptr) return;
  state->gain_db = 0;
  state->samples = 0;
  state->learning_samples = state->silent_samples = 0;
  state->reference_lufs = -120;
  state->programme_peak = 0;
  state->mode = -1;
  state->gap_cleared = false;
  feq_loudness_meter_reset(state->loudness);
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    std::fill(state->delay[channel].begin(), state->delay[channel].end(), 0.0f);
    feq_true_peak_init(&state->input_detectors[channel], 4);
  }
  std::fill(state->reductions.begin(), state->reductions.end(), 0.0f);
  feq_post_filter_normalizer_init(&state->safety, state->detectors.data(),
      state->planes.data(), state->reductions.data(), state->channels,
      state->latency + 1, 4);
  feq_linked_limiter_set_look_ahead(&state->safety.limiter, state->latency);
}
uint32_t feq_live_normalizer_latency(const FeqLiveNormalizer* state) {
  return state == nullptr ? 0 : state->latency;
}
void feq_live_normalizer_silence(FeqLiveNormalizer* state, uint32_t frames) {
  if (state != nullptr && state->mode == 2) silent_frames(*state, frames);
}
FeqLiveNormalizerReading feq_live_normalizer_process(FeqLiveNormalizer* state,
    float* const* channels, uint32_t frames, const FeqNormalizerSettings* settings) {
  FeqLiveNormalizerReading reading{-120, -120, 0, -120, 0};
  if (state == nullptr || channels == nullptr || settings == nullptr || frames == 0)
    return reading;
  if (state->mode != settings->mode) {
    clear_programme(*state);
    state->silent_samples = 0;
    state->gap_cleared = false;
    state->mode = settings->mode;
  }
  feq_loudness_meter_process(state->loudness, channels, frames);
  FeqLoudnessReading measured{};
  feq_loudness_meter_read(state->loudness, &measured);
  state->samples += frames;
  const bool ready = state->samples >= static_cast<uint64_t>(state->rate * 3);
  reading.input_lufs = ready ? measured.short_term_lufs : measured.momentary_lufs;
  double peak = 0;
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    peak = std::max(peak, feq_true_peak_block(&state->input_detectors[channel],
                                            channels[channel], frames));
  }
  reading.input_true_peak_db = db(peak);
  double target = 0;
  reading.level_state = settings->mode == 1 ? 1 : 0;
  if (settings->mode == 2) {
    target = leveling_target(*state, measured, peak, frames, *settings, reading.level_state);
  }
  reading.reference_lufs = state->reference_lufs;
  // Slow corrections plus a 0.75 LU deadband avoid riding every phrase.
  // Mode changes return to unity promptly without stepping the waveform.
  const double speed = settings->mode == 2 ? (target < state->gain_db ? 1.0 : 0.2) : 30.0;
  const double step = speed / state->rate;
  for (uint32_t frame = 0; frame < frames; ++frame) {
    state->gain_db += std::clamp(target - state->gain_db, -step, step);
    const double gain = std::pow(10.0, state->gain_db / 20);
    for (uint32_t channel = 0; channel < state->channels; ++channel)
      channels[channel][frame] = static_cast<float>(channels[channel][frame] * gain);
  }
  // Peak protection answers the delayed samples, never a UI measurement.
  // Keep the same delay while bypassed so switching modes cannot shift audio.
  FeqPostFilterNormalizerOptions options{};
  options.enabled = settings->mode == 1 || settings->mode == 2;
  options.output_ceiling_db = bounded(settings->ceiling_db, -1, -12, -0.1);
  options.sample_rate = state->rate;
  options.release_ms = 250;
  feq_post_filter_normalizer_process(&state->safety, channels, frames, &options);
  const auto safety = feq_post_filter_normalizer_take_telemetry(&state->safety);
  reading.applied_gain_db = state->gain_db + safety.gain_reduction_db;
  return reading;
}
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "footsteps_internal.h"

#include <algorithm>
#include <cmath>
#include <new>

namespace feq_footsteps_detail {
namespace {

// A regularized least-squares fit handles several notes sharing a band. An
// online gradient fit converges too slowly on nearly dependent harmonics.
void fit(BedPrediction& state, uint32_t glide) {
  double factor[kBedTaps][kBedTaps] = {};
  double fit[kBedTaps] = {};
  double energy = 0.0;
  for (int i = 0; i < kBedTaps; ++i) energy += state.covariance[i][i];
  const double ridge = energy * 1e-5 + 1e-12;
  for (int i = 0; i < kBedTaps; ++i) {
    for (int j = 0; j <= i; ++j) {
      double value = state.covariance[i][j];
      for (int k = 0; k < j; ++k) value -= factor[i][k] * factor[j][k];
      factor[i][j] = i == j ? std::sqrt(std::max(ridge, value + ridge))
                            : value / factor[j][j];
    }
    double value = state.cross[i];
    for (int j = 0; j < i; ++j) value -= factor[i][j] * fit[j];
    fit[i] = value / factor[i][i];
  }
  double norm = 0.0;
  for (int i = kBedTaps - 1; i >= 0; --i) {
    for (int j = i + 1; j < kBedTaps; ++j) fit[i] -= factor[j][i] * fit[j];
    fit[i] /= factor[i][i];
    norm += fit[i] * fit[i];
  }
  const double scale = norm > 4.0 ? 2.0 / std::sqrt(norm) : 1.0;
  double matched = 0.0;
  double predicted = 0.0;
  for (int i = 0; i < kBedTaps; ++i) {
    matched += fit[i] * state.cross[i];
    predicted += fit[i] * fit[i] * state.covariance[i][i];
    for (int j = 0; j < i; ++j) {
      predicted += 2 * fit[i] * fit[j] * state.covariance[i][j];
    }
  }
  // Only use a model that explains a sustained waveform. A fit to rain or
  // other diffuse noise is not a bed we can subtract from a new cue.
  const double explained = (2 * scale * matched - scale * scale * predicted) /
      (state.energy + 1e-12);
  const double confidence = std::clamp((explained - 0.65) / 0.25, 0.0, 1.0);
  if (!state.active && confidence == 0.0 && state.glide_left == 0) return;
  state.active = confidence > 0.0;
  for (int i = 0; i < kBedTaps; ++i) {
    state.step[i] = (confidence * scale * fit[i] - state.weight[i]) / glide;
  }
  state.glide_left = glide;
}

void observe(FeqFootsteps& f, int band, int lfe, const BedFrame* const* past,
             const BedFrame& current, const double* residual) {
  auto& state = f.state.bed_prediction[band];
  // Sample at varying intervals so the observations don't always hit the
  // same phase of a periodic signal. The average is roughly 1.3 kHz.
  state.phase = state.phase * 1664525u + 1013904223u;
  state.observe_in = f.bed_observation_frames +
      (state.phase >> 16) % f.bed_observation_frames;
  if (f.state.whole_power < 1e-8 ||
      (f.state.band_gain_db[band] > 0.1 && state.observations >= 32)) return;
  double adapt = 0.005;
  double energy = 0.0;
  double novelty = 0.0;
  for (uint32_t c = 0; c < f.channels; ++c) {
    if (static_cast<int>(c) == lfe) continue;
    energy += current.sample[c] * current.sample[c];
    novelty += residual[c] * residual[c];
  }
  if (state.active) {
    // A quiet bed observation can refine the model. A large innovation has
    // little influence, so a cue's tail cannot replace the music it covers.
    adapt *= std::clamp(0.04 * state.energy / (novelty + 1e-12), 0.05, 1.0);
  } else if ((f.state.learning || f.state.cue_relearn_left > 0) &&
             state.observations >= 16) {
    // Re-enabling the filter can land in a fight. A few large observations
    // must not dominate the initial model before it can reject innovations.
    adapt *= std::clamp(2.0 * state.energy / (energy + 1e-12), 0.05, 1.0);
  }
  state.energy += adapt * (energy - state.energy);
  for (int i = 0; i < kBedTaps; ++i) {
    double cross = 0.0;
    double covariance[kBedTaps] = {};
    for (uint32_t c = 0; c < f.channels; ++c) {
      if (static_cast<int>(c) == lfe) continue;
      const double x = past[i]->sample[c];
      cross += x * current.sample[c];
      for (int j = 0; j <= i; ++j) covariance[j] += x * past[j]->sample[c];
    }
    state.cross[i] += adapt * (cross - state.cross[i]);
    for (int j = 0; j <= i; ++j) {
      state.covariance[i][j] += adapt * (covariance[j] - state.covariance[i][j]);
    }
  }
  if (++state.observations % 32 == 0) fit(state, f.bed_glide_frames);
}

}  // namespace

bool prepare_bed_history(FeqFootsteps& f) {
  // Spread the taps across 4–17 ms, with unequal spacing so that several
  // tones in the same wide cue band do not alias to the same predictor.
  // Broadband onsets lose correlation over this gap.
  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    auto& history = f.bed_history[b];
    uint32_t phase = 1;
    for (int tap = 0; tap < kBedTaps; ++tap) {
      phase = phase * 1664525u + 1013904223u;
      const double seconds = 0.004 + tap * 0.00053 + 0.00044 * (phase >> 16) / 65536.0;
      history.delay[tap] = static_cast<uint32_t>(std::max(1L, std::lround(f.sample_rate * seconds)));
    }
    history.length = history.delay[kBedTaps - 1] + 1;
    history.frames.reset(new (std::nothrow) BedFrame[history.length]);
    if (!history.frames) return false;
  }
  f.bed_observation_frames = static_cast<uint32_t>(std::max(1L, std::lround(f.sample_rate / 2000)));
  f.bed_glide_frames = static_cast<uint32_t>(std::max(1L, std::lround(f.sample_rate * 0.012)));
  return true;
}

void cue_residual(FeqFootsteps& f, int band, int lfe, double* samples) {
  auto& history = f.bed_history[band];
  auto& prediction = f.state.bed_prediction[band];
  const bool ready = prediction.filled == history.length;
  const bool predicts = ready && (prediction.active || prediction.glide_left > 0);
  const bool observing = ready && prediction.observe_in == 0;
  const BedFrame* past[kBedTaps];
  if (predicts || observing) {
    for (int tap = 0; tap < kBedTaps; ++tap) {
      const uint32_t delay = history.delay[tap];
      const uint32_t at = prediction.write + (prediction.write < delay ? history.length : 0);
      past[tap] = &history.frames[at - delay];
    }
  }
  auto& current = history.frames[prediction.write];
  double predicted[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
  if (predicts) {
    for (int tap = 0; tap < kBedTaps; ++tap) {
      for (uint32_t c = 0; c < f.channels; ++c) {
        predicted[c] += prediction.weight[tap] * past[tap]->sample[c];
      }
    }
  }
  for (uint32_t c = 0; c < f.channels; ++c) {
    if (static_cast<int>(c) == lfe) continue;
    current.sample[c] = samples[c];
    if (predicts) samples[c] -= predicted[c];
  }
  if (prediction.glide_left > 0) {
    --prediction.glide_left;
    for (int tap = 0; tap < kBedTaps; ++tap) prediction.weight[tap] += prediction.step[tap];
  }
  if (observing) observe(f, band, lfe, past, current, samples);
  if (prediction.observe_in > 0) --prediction.observe_in;
  if (++prediction.write == history.length) prediction.write = 0;
  prediction.filled = std::min(prediction.filled + 1, history.length);
}

void transfer_bed_history(FeqFootsteps& prepared, const FeqFootsteps& previous) {
  for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
    const auto& from = previous.bed_history[b];
    auto& to = prepared.bed_history[b];
    std::copy_n(from.frames.get(), previous.state.bed_prediction[b].filled,
                to.frames.get());
  }
}

}  // namespace feq_footsteps_detail

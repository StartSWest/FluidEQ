/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/post_filter_normalizer.h"

#include <cmath>
#include <limits>

namespace {

double amplitude_db(double amplitude) {
  return amplitude > 1e-6 ? 20.0 * std::log10(amplitude) : -120.0;
}

}  // namespace

extern "C" {

uint32_t feq_post_filter_normalizer_look_ahead(double sample_rate) {
  const double samples =
      (FEQ_AUTO_HEADROOM_LOOK_AHEAD_MS / 1000.0) * sample_rate;
  const auto rounded = static_cast<uint32_t>(std::llround(samples));
  return rounded < 1 ? 1u : rounded;
}

void feq_post_filter_normalizer_init(FeqPostFilterNormalizer* state,
                                     FeqTruePeak* detectors,
                                     float** delay,
                                     float* gain_reduction_db,
                                     uint32_t channels,
                                     uint32_t capacity,
                                     uint32_t true_peak_factor) {
  if (state == nullptr) {
    return;
  }
  feq_linked_limiter_init(&state->limiter, detectors, delay, gain_reduction_db,
                          channels, capacity, true_peak_factor);
  state->minimum_gain = 1.0;
  state->input_true_peak = 0.0;
  state->sustain_samples = 0.0;
}

void feq_post_filter_normalizer_rebase(FeqPostFilterNormalizer* state) {
  if (state == nullptr) {
    return;
  }
  feq_linked_limiter_reset_control(&state->limiter);
  state->minimum_gain = 1.0;
  state->input_true_peak = 0.0;
  state->sustain_samples = 0.0;
}

void feq_post_filter_normalizer_process(
    FeqPostFilterNormalizer* state,
    float* const* channels,
    uint32_t frames,
    const FeqPostFilterNormalizerOptions* options) {
  if (state == nullptr || channels == nullptr || options == nullptr) {
    return;
  }
  const bool enabled = options->enabled != 0;
  if (!enabled) {
    // Preserve the current gain and remove only the hold, so the continuously
    // running look-ahead path can return to unity without a level step.
    state->limiter.release_hold_remaining = 0;
  }

  // Judge the peak at the FINAL output, not at this earlier tap.
  const double reserved_db = std::isfinite(options->following_gain_db)
                                 ? options->following_gain_db
                                 : 0.0;
  const double normalized_ceiling_db =
      options->output_ceiling_db - reserved_db - FEQ_AUTO_HEADROOM_MARGIN_DB;

  const double selected_ms = std::isfinite(options->release_ms)
                                 ? (options->release_ms > 1.0
                                        ? options->release_ms
                                        : 1.0)
                                 : FEQ_AUTO_HEADROOM_BYPASS_RELEASE_MS;
  const double bounded_ms =
      enabled ? (selected_ms < FEQ_AUTO_HEADROOM_MAX_RELEASE_MS
                     ? selected_ms
                     : FEQ_AUTO_HEADROOM_MAX_RELEASE_MS)
              : FEQ_AUTO_HEADROOM_BYPASS_RELEASE_MS;
  /**
   * Program-dependent: the dialled release for a transient, slower for a
   * passage that has been held down.
   *
   * `sustain` is how long the stage has already been reducing, measured
   * against the block that just went past, so this block's release reflects
   * what the music has been doing rather than what one sample did. A single
   * peak leaves it near zero and releases at the time on the dial. Sustained
   * limiting stretches it toward three times that, which is what stops the
   * level between peaks moving at the rate of the peaks themselves.
   *
   * Only while enabled. The bypass release is a fixed slow walk back to unity
   * and has nothing to be program-dependent about.
   */
  const double sustain_span =
      (FEQ_AUTO_HEADROOM_SUSTAIN_MS / 1000.0) * options->sample_rate;
  const double sustained =
      enabled && sustain_span > 0.0
          ? (state->sustain_samples < sustain_span
                 ? state->sustain_samples / sustain_span
                 : 1.0)
          : 0.0;
  const double effective_ms =
      bounded_ms *
      (1.0 + sustained * (FEQ_AUTO_HEADROOM_SUSTAIN_STRETCH - 1.0));
  const double release_coefficient =
      std::exp(-1.0 / ((effective_ms / 1000.0) * options->sample_rate));

  FeqLimiterOptions limiter{};
  limiter.ceiling = enabled ? std::pow(10.0, normalized_ceiling_db / 20.0)
                            : std::numeric_limits<double>::infinity();
  // The reference leaves `activationThreshold` unset here, which defaults it
  // to the ceiling.
  limiter.activation_threshold = limiter.ceiling;
  limiter.release_coefficient = release_coefficient;
  limiter.limiting_release_coefficient = release_coefficient;
  limiter.knee_db = enabled ? FEQ_AUTO_HEADROOM_KNEE_DB : 0.0;
  limiter.release_hold_samples =
      enabled ? std::llround((FEQ_AUTO_HEADROOM_RELEASE_HOLD_MS / 1000.0) *
                             options->sample_rate)
              : 0.0;
  /**
   * Zero, which selects the look-ahead path rather than the dB-per-second one.
   *
   * A slew rate is how a stage with no look-ahead approximates an attack, and
   * it cannot reduce the peak that asked for it — only the seconds of program
   * that follow. The back-filled ramp reaches the exact reduction at the peak
   * itself, so the level between peaks never has to move.
   */
  limiter.attack_slew_db_per_second = 0.0;
  limiter.release_snap_ratio = FEQ_AUTO_HEADROOM_RELEASE_SNAP_RATIO;
  limiter.sample_rate = options->sample_rate;

  feq_linked_limiter_process(&state->limiter, channels, frames, &limiter);

  if (state->limiter.block_peak > state->input_true_peak) {
    state->input_true_peak = state->limiter.block_peak;
  }
  if (state->limiter.gain < state->minimum_gain) {
    state->minimum_gain = state->limiter.gain;
  }

  // Counted up while the stage is working and down while it is not, at the
  // same rate — so a passage broken by a bar of space does not arrive back at
  // the fast release the instant one peak stops asking for reduction.
  const double reducing_below =
      std::pow(10.0, -FEQ_AUTO_HEADROOM_SUSTAIN_THRESHOLD_DB / 20.0);
  const double moved = static_cast<double>(frames);
  if (enabled && state->limiter.gain < reducing_below) {
    state->sustain_samples += moved;
    if (state->sustain_samples > sustain_span) {
      state->sustain_samples = sustain_span;
    }
  } else {
    state->sustain_samples -= moved;
    if (state->sustain_samples < 0.0) {
      state->sustain_samples = 0.0;
    }
  }
}

FeqPostFilterNormalizerTelemetry feq_post_filter_normalizer_take_telemetry(
    FeqPostFilterNormalizer* state) {
  FeqPostFilterNormalizerTelemetry telemetry{};
  if (state == nullptr) {
    return telemetry;
  }
  telemetry.gain_reduction_db = amplitude_db(state->minimum_gain);
  telemetry.input_true_peak_db = amplitude_db(state->input_true_peak);
  state->minimum_gain = 1.0;
  state->input_true_peak = 0.0;
  return telemetry;
}

}  // extern "C"

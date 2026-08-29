/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"
#include "fluideq/exciter_guard.h"

#include <algorithm>
#include <cmath>

namespace {

constexpr uint32_t kWide = 4;

bool path_is_active(const FeqChain* chain, uint32_t path) {
  const ChainExciterPath& state = chain->paths[path];
  return feq_exciter_channel_is_active(&state.exciter) != 0 ||
         state.organic_mix > 0.0001 || state.aligner.low_delay > 0.0001 ||
         state.aligner.mid_delay > 0.0001;
}

FeqExciterSettings exciter_setup(const FeqChainExciterSettings& source) {
  FeqExciterSettings setup{};
  setup.enabled = source.enabled;
  setup.isolate = source.isolate;
  for (uint32_t band = 0; band < FEQ_CHAIN_EXCITER_BANDS; ++band) {
    setup.bands[band].enabled = source.bands[band].enabled;
    setup.bands[band].freq_hz = source.bands[band].freq_hz;
    setup.bands[band].range = source.bands[band].range;
    setup.bands[band].drive = source.bands[band].drive;
    setup.bands[band].mix = source.bands[band].mix;
    setup.bands[band].texture = source.bands[band].texture;
  }
  return setup;
}

/** Timing, three bands and Organic for one L/R/M/S signal path. */
void process_path(FeqChain* chain, float* target, uint32_t frames,
                  uint32_t path) {
  const FeqChainExciterSettings& settings = chain->settings.exciter;
  ChainExciterPath& state = chain->paths[path];

  const bool wants_alignment = settings.enabled != 0 &&
                               settings.align_enabled != 0 &&
                               settings.align_amount > 0.0;
  feq_phase_align_process(&state.aligner, target, frames,
                          wants_alignment ? settings.align_amount : 0.0,
                          chain->sample_rate);

  const FeqExciterSettings setup = exciter_setup(settings);
  double report[FEQ_CHAIN_EXCITER_BANDS] = {0.0, 0.0, 0.0};
  feq_exciter_channel_process(&state.exciter, target, frames, &setup,
                              chain->sample_rate, report);

  /**
   * Kept for the panel, from one path only.
   *
   * Every path computes the same report and the display shows one set of three,
   * so taking path zero matches what the worklet did — it reported for a single
   * channel too. Averaging the paths would be a different number that no
   * control corresponds to.
   *
   * It was computed and discarded before this, which is why the exciter's band
   * lights sat still: the nonlinear stage has no fixed transfer curve, so what
   * it contributed cannot be derived from the settings and has to be measured.
   */
  if (path == 0) {
    for (uint32_t band = 0; band < FEQ_CHAIN_EXCITER_BANDS; band += 1) {
      chain->exciter_band_report[band] = report[band];
    }
  }

  const double organic_target =
      settings.enabled != 0 && settings.organic_enabled != 0
          ? feq_organic_exciter_return_gain(settings.organic_amount)
          : 0.0;
  double organic_mix = state.organic_mix;
  if (organic_target <= 0.0 && organic_mix <= 0.0001) {
    feq_organic_path_reset_transient(&state.organic);
    if (path == 0) {
      // Off, and saying so: a stale reading would leave the organic light on
      // after the stage had been switched out.
      chain->exciter_organic_report = 0.0;
    }
    return;
  }

  feq_organic_path_process(&state.organic, state.exciter.dry, frames,
                           settings.organic_focus_hz, settings.organic_range,
                           settings.organic_amount, chain->sample_rate,
                           state.middle.data());
  const double smooth =
      1.0 - std::exp(-1.0 / ((kExciterSmoothingMs / 1000.0) *
                             chain->sample_rate));
  // The block's mean mix, which is what the worklet reported: a single figure
  // for a value that ramps across the block rather than its end point.
  double mean_mix = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    organic_mix += (organic_target - organic_mix) * smooth;
    target[at] = static_cast<float>(
        static_cast<double>(target[at]) +
        static_cast<double>(state.organic.band[at]) * organic_mix);
    mean_mix += organic_mix;
  }
  if (path == 0) {
    chain->exciter_organic_report =
        frames > 0 ? mean_mix / static_cast<double>(frames) : 0.0;
  }
  if (organic_target == 0.0 && organic_mix < 0.0001) {
    organic_mix = 0.0;
    feq_organic_path_reset_transient(&state.organic);
  }
  state.organic_mix = organic_mix;
}

}  // namespace

void chain_prepare_exciter_path(FeqChain* chain, uint32_t path) {
  ChainExciterPath& state = chain->paths[path];
  const uint32_t frames = chain->max_frames;
  const size_t wide = static_cast<size_t>(frames) * kWide;

  for (auto& band : state.bands) {
    band.assign(frames, 0.0f);
  }
  state.wet_return.assign(frames, 0.0f);
  state.wide.assign(wide, 0.0f);
  state.wide_dry.assign(wide, 0.0f);
  state.middle.assign(static_cast<size_t>(frames) * 2, 0.0f);
  state.dry.assign(frames, 0.0f);
  state.guard_scratch.assign(frames, 0.0f);
  feq_exciter_channel_init(&state.exciter, state.bands[0].data(),
                           state.bands[1].data(), state.bands[2].data(),
                           state.wet_return.data(), state.wide.data(),
                           state.wide_dry.data(), state.middle.data(),
                           state.dry.data(), state.guard_scratch.data());

  const uint32_t low_capacity =
      feq_phase_align_low_capacity(chain->sample_rate);
  const uint32_t mid_capacity =
      feq_phase_align_mid_capacity(chain->sample_rate);
  state.align_low.assign(frames, 0.0f);
  state.align_mid.assign(frames, 0.0f);
  state.align_high.assign(frames, 0.0f);
  state.align_low_line.assign(low_capacity, 0.0f);
  state.align_mid_line.assign(mid_capacity, 0.0f);
  feq_phase_align_init(&state.aligner, state.align_low.data(),
                       state.align_mid.data(), state.align_high.data(),
                       state.align_low_line.data(), low_capacity,
                       state.align_mid_line.data(), mid_capacity);

  state.organic_band.assign(frames, 0.0f);
  state.organic_foundation.assign(frames, 0.0f);
  state.organic_wide.assign(wide, 0.0f);
  state.organic_wide_dry.assign(wide, 0.0f);
  state.organic_guard.assign(frames, 0.0f);
  feq_organic_path_init(&state.organic, state.organic_band.data(),
                        state.organic_foundation.data(),
                        state.organic_wide.data(),
                        state.organic_wide_dry.data(),
                        state.organic_guard.data());
}

void chain_process_exciter(FeqChain* chain, float* const* channels,
                           uint32_t frames) {
  const FeqChainExciterSettings& settings = chain->settings.exciter;
  /**
   * Mid/Side wraps Timing, Low/Mid/High and Organic together.
   *
   * Encoding only Organic was the bug in the earlier implementation: the
   * selector claimed a whole-stage mode while three quarters of the stage
   * remained ordinary left/right. Four independent histories keep L, R, Mid
   * and Side from handing filter or delay memory to one another.
   */
  const bool mid_side =
      settings.stereo != FEQ_STEREO_STEREO && chain->channels >= 2;
  if (mid_side) {
    chain_encode_mid_side(channels, frames);
  }

  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    const bool selected =
        !mid_side || (settings.stereo == FEQ_STEREO_MID ? channel == 0
                                                        : channel == 1);
    const uint32_t path = mid_side ? channel + 2 : channel;
    if (selected && (settings.enabled != 0 || path_is_active(chain, path))) {
      process_path(chain, channels[channel], frames, path);
    } else if (!selected && settings.enabled != 0 && settings.isolate != 0) {
      // Isolate means only what the selected Exciter domain contributes.
      std::fill(channels[channel], channels[channel] + frames, 0.0f);
    }
  }

  if (mid_side) {
    chain_decode_mid_side(channels, frames);
  }
}

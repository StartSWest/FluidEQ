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

/**
 * A path still sounding: a band's return, the Isolate monitor's dry or
 * Organic gliding toward where it was sent. Timing is not a path's any more
 * (`align_channels`), so it is not asked here.
 */
bool path_is_active(const FeqChain* chain, uint32_t path) {
  const ChainExciterPath& state = chain->paths[path];
  return feq_exciter_channel_is_active(&state.exciter) != 0 ||
         state.organic_mix > 0.0001;
}

/**
 * What a path is asked to do this block.
 *
 * `kFull` is the stage as set. `kQuiet` is a part of the sound the selector
 * leaves out — the other half of a mid/side pair, or a channel beyond the
 * front pair under Sides only: no band and no Organic, but the Isolate
 * monitor as set, so under Isolate it fades to silence exactly as the
 * selected half's dry does rather than being zeroed in one sample. `kFade`
 * is a domain not in use — the left/right paths in a mid/side mode, the
 * mid/side paths in Stereo — run only until what it was making has glided
 * out, so changing the selector crosses rather than steps.
 */
enum class PathRole { kFull, kQuiet, kFade };

FeqExciterSettings exciter_setup(const FeqChainExciterSettings& source) {
  FeqExciterSettings setup{};
  setup.enabled = source.enabled;
  setup.isolate = source.isolate;
  setup.oversampling = source.oversampling;
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

/** The three bands and Organic for one L/R/M/S signal path, in its role. */
void process_path(FeqChain* chain, float* target, uint32_t frames,
                  uint32_t path, PathRole role, bool reports) {
  const FeqChainExciterSettings& settings = chain->settings.exciter;
  ChainExciterPath& state = chain->paths[path];

  // Organic runs the way the bands run, changed in the same fade. Taken
  // here, before the bands' block, because the bands switch at the END of a
  // block whose ramp has reached nothing: Organic then changes at the start
  // of the next, the first one ramping up, and never mid-ramp.
  if (state.organic.shaper.quality != state.exciter.quality) {
    state.organic.shaper.quality = state.exciter.quality;
    feq_exciter_oversampler_reset(&state.organic.shaper.oversampler);
  }

  FeqExciterSettings setup = exciter_setup(settings);
  if (role != PathRole::kFull) {
    for (auto& band : setup.bands) {
      band.enabled = 0;
    }
  }
  if (role == PathRole::kFade) {
    setup.enabled = 0;
    setup.isolate = 0;
  }
  double report[FEQ_CHAIN_EXCITER_BANDS] = {0.0, 0.0, 0.0};
  feq_exciter_channel_process(&state.exciter, target, frames, &setup,
                              chain->sample_rate, report);

  /**
   * Kept for the panel, from the one path the panel speaks for: the first
   * channel in Stereo, Mid in Mid only, Side in Sides only.
   *
   * It was path zero always, which is the left channel and never runs in
   * either mid/side mode — so on Mid only and Sides only the band boxes and
   * the Organic bar went dark while the stage worked. The nonlinear stage
   * has no fixed transfer curve, so what it contributed has to be measured,
   * and measured where it is made.
   */
  if (reports) {
    for (uint32_t band = 0; band < FEQ_CHAIN_EXCITER_BANDS; band += 1) {
      chain->exciter_band_report[band] = report[band];
    }
  }

  const double organic_target =
      role == PathRole::kFull && settings.enabled != 0 &&
              settings.organic_enabled != 0
          ? feq_organic_exciter_return_gain(settings.organic_amount)
          : 0.0;
  double organic_mix = state.organic_mix;
  if (organic_target <= 0.0 && organic_mix <= 0.0001) {
    feq_organic_path_reset_transient(&state.organic);
    return;
  }

  // The bands' ramp for this block, which the harmonics of Organic go
  // through as the bands' do: the clean part of its return never fades.
  state.organic.shaper.switch_from = state.exciter.switch_from;
  state.organic.shaper.switch_to = state.exciter.switch_to;
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
  if (reports) {
    chain->exciter_organic_report =
        frames > 0 ? mean_mix / static_cast<double>(frames) : 0.0;
  }
  if (organic_target == 0.0 && organic_mix < 0.0001) {
    organic_mix = 0.0;
    feq_organic_path_reset_transient(&state.organic);
  }
  state.organic_mix = organic_mix;
}

bool is_lfe(const FeqChain* chain, uint32_t channel) {
  return chain->lfe_channel >= 0 &&
         static_cast<uint32_t>(chain->lfe_channel) == channel;
}

/**
 * Timing, on every channel but the LFE, before any mid/side encoding.
 *
 * It is a whole-programme turn of phase and has to be the same on both
 * channels. Run on the mid/side path it was processing, it turned Mid and
 * not Side (or the reverse), and decoding two halves whose phase differs by
 * frequency moves sound between left and right: at the frequency where the
 * two sections reach 180 degrees — about 700 Hz at the default amount — a
 * hard-left instrument came out on the right. Turning left and right alike
 * turns Mid and Side alike, and leaves the selector nothing to change here.
 */
void align_channels(FeqChain* chain, float* const* channels, uint32_t frames) {
  const FeqChainExciterSettings& settings = chain->settings.exciter;
  const bool wants = settings.enabled != 0 && settings.align_enabled != 0 &&
                     settings.align_amount > 0.0;
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    FeqPhaseAlign& aligner = chain->paths[channel].aligner;
    if (is_lfe(chain, channel) ||
        (!wants && feq_phase_align_is_active(&aligner) == 0)) {
      continue;
    }
    feq_phase_align_process(&aligner, channels[channel], frames,
                            wants ? settings.align_amount : 0.0,
                            chain->sample_rate);
  }
}

/**
 * Whether a path in this role has anything to do this block: anything still
 * gliding, and otherwise the stage as set — which a quiet part only has
 * under Isolate, where it holds that part silent.
 */
bool runs(const FeqChain* chain, uint32_t path, PathRole role) {
  const FeqChainExciterSettings& settings = chain->settings.exciter;
  if (path_is_active(chain, path)) {
    return true;
  }
  switch (role) {
    case PathRole::kFull:
      return settings.enabled != 0;
    case PathRole::kQuiet:
      return settings.enabled != 0 && settings.isolate != 0;
    case PathRole::kFade:
      return false;
  }
  return false;
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

  feq_phase_align_init(&state.aligner);

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
  // Read fresh every block: a stage that processed nothing reports nothing,
  // never the figures it last had.
  for (double& band : chain->exciter_band_report) {
    band = 0.0;
  }
  chain->exciter_organic_report = 0.0;

  align_channels(chain, channels, frames);

  /**
   * Mid/Side wraps the three bands and Organic together; Timing is the whole
   * programme's (`align_channels`).
   *
   * Four independent histories keep L, R, Mid and Side from handing filter
   * memory to one another, and each domain runs out its own returns when the
   * selector leaves it (`PathRole::kFade`). A channel beyond the front pair
   * has no side: it carries mid content, so it is excited unless the
   * selector asks for the sides alone.
   */
  const bool has_pair = chain->channels >= 2;
  const bool mid_side = settings.stereo != FEQ_STEREO_STEREO && has_pair;
  const bool sides_only = mid_side && settings.stereo == FEQ_STEREO_SIDE;
  bool reported = false;

  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    if (is_lfe(chain, channel)) {
      // Harmonics added to the subwoofer feed are heard as the subwoofer
      // buzzing: the stage exists to add presence, and the LFE has none.
      continue;
    }
    const bool in_pair = has_pair && channel < FEQ_CHAIN_CHANNELS;
    PathRole role = PathRole::kFull;
    if (in_pair && mid_side) {
      role = PathRole::kFade;
    } else if (!in_pair && sides_only) {
      role = PathRole::kQuiet;
    }
    if (runs(chain, channel, role)) {
      const bool reports = role == PathRole::kFull && !mid_side && !reported;
      process_path(chain, channels[channel], frames, channel, role, reports);
      reported = reported || reports;
    }
  }

  if (!has_pair) {
    return;
  }
  const uint32_t mid = kExciterMidPath;
  const uint32_t side = kExciterMidPath + 1;
  if (!mid_side && !path_is_active(chain, mid) &&
      !path_is_active(chain, side)) {
    return;
  }
  chain_encode_mid_side(channels, frames);
  for (uint32_t half = 0; half < 2; ++half) {
    const uint32_t path = half == 0 ? mid : side;
    const bool selected =
        mid_side && (settings.stereo == FEQ_STEREO_MID ? half == 0 : half == 1);
    PathRole role = PathRole::kFade;
    if (mid_side) {
      role = selected ? PathRole::kFull : PathRole::kQuiet;
    }
    if (runs(chain, path, role)) {
      process_path(chain, channels[half], frames, path, role, selected);
    }
  }
  chain_decode_mid_side(channels, frames);
}

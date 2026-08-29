/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace {

constexpr uint32_t kMaxOversample = 4;

void resize_slot(ChainEqSlot& slot, uint32_t frames, uint32_t latency) {
  slot.input.assign(frames, 0.0f);
  slot.delayed_input.assign(frames, 0.0f);
  slot.isolate_oversampled.assign(
      static_cast<size_t>(frames) * kMaxOversample, 0.0f);
  slot.bypass_line.assign(static_cast<size_t>(latency) + 1, 0.0f);
  slot.isolate_line.assign(static_cast<size_t>(latency) + 1, 0.0f);
  feq_delay_line_init(&slot.bypass_delay, slot.bypass_line.data(),
                      latency + 1, latency);
  feq_delay_line_init(&slot.isolate_delay, slot.isolate_line.data(),
                      latency + 1, latency);
  feq_biquad_reset(&slot.subsonic);
  feq_oversampler_reset(&slot.eq_oversampler);
  feq_oversampler_reset(&slot.isolate_oversampler);
  feq_oversampler_reset(&slot.isolate_colour_oversampler);
  feq_saturator_reset(&slot.fuzz);
}

/**
 * Rebuild the Maximizer's limiter only when the look-ahead actually moved.
 *
 * Rebuilding on every settings message drops the delay line's contents
 * mid-stream, which is an audible click on every knob turn.
 */
void rebuild_maximizer(FeqChain* chain) {
  double samples = (chain->settings.maximizer.look_ahead_ms / 1000.0) *
                   chain->sample_rate;
  samples = std::floor(samples + 0.5);
  uint32_t look_ahead = samples < 1.0 ? 1u : static_cast<uint32_t>(samples);
  if (look_ahead == chain->maximizer_look_ahead &&
      chain->maximizer.delay != nullptr) {
    return;
  }
  chain->maximizer_look_ahead = look_ahead;
  const uint32_t capacity = look_ahead + 1;
  chain->maximizer_detectors.assign(chain->channels, FeqTruePeak{});
  chain->maximizer_reduction.assign(capacity, 0.0f);
  chain->maximizer_delay_pointers.assign(chain->channels, nullptr);
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    chain->maximizer_delay[channel].assign(capacity, 0.0f);
    chain->maximizer_delay_pointers[channel] =
        chain->maximizer_delay[channel].data();
  }
  feq_linked_limiter_init(
      &chain->maximizer, chain->maximizer_detectors.data(),
      chain->maximizer_delay_pointers.data(), chain->maximizer_reduction.data(),
      chain->channels, capacity,
      feq_oversample_factor_for_sample_rate(chain->sample_rate));
}

void chain_encode_mid_side_impl(float* const* channels, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double left = static_cast<double>(channels[0][at]);
    const double right = static_cast<double>(channels[1][at]);
    channels[0][at] = static_cast<float>((left + right) * 0.5);
    channels[1][at] = static_cast<float>((left - right) * 0.5);
  }
}

void chain_decode_mid_side_impl(float* const* channels, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double mid = static_cast<double>(channels[0][at]);
    const double side = static_cast<double>(channels[1][at]);
    channels[0][at] = static_cast<float>(mid + side);
    channels[1][at] = static_cast<float>(mid - side);
  }
}

}  // namespace

void chain_encode_mid_side(float* const* channels, uint32_t frames) {
  chain_encode_mid_side_impl(channels, frames);
}

void chain_decode_mid_side(float* const* channels, uint32_t frames) {
  chain_decode_mid_side_impl(channels, frames);
}


extern "C" {

void feq_chain_settings_defaults(FeqChainSettings* settings) {
  if (settings == nullptr) {
    return;
  }
  *settings = FeqChainSettings{};
  settings->enabled = 1;
  settings->output_safety_enabled = 1;
  settings->eq.model_amount = 1.0;
  settings->eq.oversample = 1;
  settings->compressor.crossover_hz[0] = 200.0;
  settings->compressor.crossover_hz[1] = 3000.0;
  for (auto& band : settings->compressor.bands) {
    band.threshold_db = -18.0;
    band.ratio = 2.0;
    band.attack_ms = 10.0;
    band.release_ms = 120.0;
    band.makeup_db = 0.0;
  }
  settings->maximizer.ceiling_db = -0.1;
  settings->maximizer.look_ahead_ms = 5.0;
  settings->maximizer.release_ms = 150.0;
  settings->master.output_trim_db = 0.0;
  settings->master.loudness_target_lufs = -14.0;
  settings->master.ceiling_db = -1.0;
  settings->master.release_ms = 2000.0;
}

FeqChain* feq_chain_create(double sample_rate,
                           uint32_t channels,
                           uint32_t maximum_block_frames) {
  if (!(sample_rate > 0.0) || channels == 0 ||
      channels > FEQ_CHAIN_CHANNELS || maximum_block_frames == 0) {
    return nullptr;
  }
  auto* chain = new FeqChain();
  chain->sample_rate = sample_rate;
  chain->channels = channels;
  chain->max_frames = maximum_block_frames;
  feq_chain_settings_defaults(&chain->settings);

  const uint32_t frames = maximum_block_frames;
  const uint32_t latency = feq_linear_phase_latency();
  const size_t wide = static_cast<size_t>(frames) * kMaxOversample;

  for (auto& slot : chain->slots) {
    resize_slot(slot, frames, latency);
  }
  chain->eq_dry.assign(frames, 0.0f);
  chain->eq_wet.assign(frames, 0.0f);
  chain->eq_doubled.assign(wide, 0.0f);
  chain->eq_dry_doubled.assign(wide, 0.0f);
  chain->eq_wet_doubled.assign(wide, 0.0f);
  chain->eq_middle.assign(static_cast<size_t>(frames) * 2, 0.0f);
  chain->fuzz_oversampled.assign(wide, 0.0f);
  chain->fuzz_middle.assign(static_cast<size_t>(frames) * 2, 0.0f);
  chain->convolver_scratch.assign(frames, 0.0f);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    chain->linked_dry[channel].assign(frames, 0.0f);
    chain->linked_wet[channel].assign(frames, 0.0f);
    chain->linked_doubled[channel].assign(wide, 0.0f);
    chain->linked_dry_doubled[channel].assign(wide, 0.0f);
    chain->linked_wet_doubled[channel].assign(wide, 0.0f);
    chain->linked_middle[channel].assign(static_cast<size_t>(frames) * 2,
                                         0.0f);
    for (uint32_t band = 0; band < FEQ_CHAIN_COMPRESSOR_BANDS; ++band) {
      chain->compressor_bands[channel][band].assign(frames, 0.0f);
    }
    feq_crossover_reset(&chain->crossovers[channel]);
  }
  for (auto& state : chain->compressors) {
    feq_compressor_reset(&state);
  }
  feq_biquad_reset(&chain->side_highpass);
  for (uint32_t path = 0; path < kExciterPaths; ++path) {
    chain_prepare_exciter_path(chain, path);
  }

  rebuild_maximizer(chain);

  const uint32_t post_capacity =
      feq_post_filter_normalizer_look_ahead(sample_rate) + 1;
  chain->post_detectors.assign(channels, FeqTruePeak{});
  chain->post_reduction.assign(post_capacity, 0.0f);
  chain->post_delay_pointers.assign(channels, nullptr);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    chain->post_delay[channel].assign(post_capacity, 0.0f);
    chain->post_delay_pointers[channel] = chain->post_delay[channel].data();
  }
  feq_post_filter_normalizer_init(
      &chain->post_normalizer, chain->post_detectors.data(),
      chain->post_delay_pointers.data(), chain->post_reduction.data(), channels,
      post_capacity, feq_oversample_factor_for_sample_rate(sample_rate));

  const uint32_t safety_capacity =
      feq_output_safety_look_ahead(sample_rate) + 1;
  chain->safety_dc.assign(channels, FeqDcBlock{});
  chain->safety_detectors.assign(channels, FeqTruePeak{});
  chain->safety_reduction.assign(safety_capacity, 0.0f);
  chain->safety_delay_pointers.assign(channels, nullptr);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    chain->safety_delay[channel].assign(safety_capacity, 0.0f);
    chain->safety_delay_pointers[channel] =
        chain->safety_delay[channel].data();
  }
  feq_output_safety_init(&chain->safety, chain->safety_dc.data(),
                         chain->safety_detectors.data(),
                         chain->safety_delay_pointers.data(),
                         chain->safety_reduction.data(), channels,
                         safety_capacity, sample_rate);

  /**
   * Every filter history, sized for the largest rack the app allows, once.
   *
   * Sixty-four bands across two channels is four kilobytes, and buying it here
   * means these vectors are never resized again. That matters because
   * `chain_refresh_eq` runs on the control thread: a `resize` there is a
   * reallocation under an audio thread that is mid-read, which is a click at
   * best and a use-after-free at worst.
   *
   * Reset rather than value-initialised. A zeroed `FeqBandDynamics` is not the
   * same as an initialised one, and a detector that starts from garbage opens
   * on the first block for no reason.
   */
  const size_t histories =
      static_cast<size_t>(FeqChain::kBandStride) * FEQ_CHAIN_CHANNELS;
  chain->band_states.resize(histories);
  chain->band_dynamics.resize(histories);
  // Sized with the rack, so publishing activity allocates nothing per block.
  chain->band_amount_scratch.assign(histories, 1.0);
  chain->band_level_scratch.assign(histories, 0.0);
  chain->dynamic_states.resize(histories);
  chain->dynamic_dynamics.resize(histories);
  for (size_t index = 0; index < histories; ++index) {
    feq_biquad_reset(&chain->band_states[index]);
    feq_biquad_reset(&chain->dynamic_states[index]);
    feq_band_dynamics_init(&chain->band_dynamics[index]);
    feq_band_dynamics_init(&chain->dynamic_dynamics[index]);
  }
  // Both sets, so the first published one is complete and the spare is not a
  // half-built rack waiting to be swapped in.
  chain_refresh_eq(chain);
  chain_refresh_eq(chain);
  return chain;

}

void feq_chain_destroy(FeqChain* chain) {
  if (chain == nullptr) {
    return;
  }
  for (auto*& convolver : chain->convolvers) {
    feq_convolver_destroy(convolver);
    convolver = nullptr;
  }
  for (auto*& convolver : chain->convolvers_next) {
    feq_convolver_destroy(convolver);
    convolver = nullptr;
  }
  feq_convolver_kernel_destroy(chain->kernel);
  feq_convolver_kernel_destroy(chain->kernel_next);
  // Anything still in transit has no thread left to reach it, and it holds the
  // largest allocation in the chain.
  chain_release_kernel_handoff(chain);
  delete chain;
}

void feq_chain_configure(FeqChain* chain, const FeqChainSettings* settings) {
  if (chain == nullptr || settings == nullptr) {
    return;
  }
  chain->settings = *settings;
  if (chain->settings.eq.band_count > FEQ_CHAIN_MAX_EQ_BANDS) {
    chain->settings.eq.band_count = FEQ_CHAIN_MAX_EQ_BANDS;
  }
  if (chain->settings.eq.oversample != 1 &&
      chain->settings.eq.oversample != 2 &&
      chain->settings.eq.oversample != 4) {
    chain->settings.eq.oversample = 1;
  }
  rebuild_maximizer(chain);
  chain_refresh_eq(chain);
  // After the bands, because it is built from the same settings and the guard
  // inside it decides whether anything is done at all. This is what makes
  // linear phase and Minimum Isolate work on this engine: without it nothing
  // ever calls `feq_chain_set_eq_kernel`, `convolvers[0]` stays null for the
  // life of the chain, and `chain_linear_running` answers 0 to every block
  // while the panel goes on offering the mode.
  chain_refresh_eq_kernel(chain);
}

void feq_chain_set_track_level_gains(FeqChain* chain,
                                     double input_gain_db,
                                     double master_loudness_gain_db,
                                     int snap) {
  if (chain == nullptr) {
    return;
  }
  if (snap != 0) {
    chain->input_gain_now = std::pow(10.0, input_gain_db / 20.0);
    chain->master_loudness_now_db = master_loudness_gain_db;
    chain->transition_frames = 0;
    chain->transition_elapsed = 0;
  } else {
    chain->input_gain_start_db =
        20.0 * std::log10(chain->input_gain_now > 1e-12 ? chain->input_gain_now
                                                        : 1e-12);
    chain->master_loudness_start_db = chain->master_loudness_now_db;
    const bool moves = input_gain_db != chain->input_gain_start_db ||
                       master_loudness_gain_db != chain->master_loudness_start_db;
    chain->transition_frames =
        moves ? static_cast<int64_t>(std::ceil(
                    (kTrackLevelTransitionMs / 1000.0) * chain->sample_rate))
              : 0;
    chain->transition_elapsed = 0;
    // Headroom learned while an uncached song was still at raw unity describes
    // the wrong input level. The delay stays continuous; only that obsolete
    // held decision is discarded, so first play and replay converge.
    if (input_gain_db != chain->input_gain_target_db) {
      feq_post_filter_normalizer_rebase(&chain->post_normalizer);
    }
  }
  chain->input_gain_target_db = input_gain_db;
  chain->master_loudness_target_db = master_loudness_gain_db;
}

void feq_chain_reset(FeqChain* chain, FeqChainResetReason reason) {
  if (chain == nullptr) {
    return;
  }
  for (auto& slot : chain->slots) {
    feq_biquad_reset(&slot.subsonic);
    feq_oversampler_reset(&slot.eq_oversampler);
    feq_oversampler_reset(&slot.isolate_oversampler);
    feq_oversampler_reset(&slot.isolate_colour_oversampler);
    feq_saturator_reset(&slot.fuzz);
    std::fill(slot.bypass_line.begin(), slot.bypass_line.end(), 0.0f);
    std::fill(slot.isolate_line.begin(), slot.isolate_line.end(), 0.0f);
  }
  for (auto& state : chain->band_states) {
    feq_biquad_reset(&state);
  }
  for (auto& state : chain->dynamic_states) {
    feq_biquad_reset(&state);
  }
  feq_biquad_reset(&chain->side_highpass);
  for (auto& crossover : chain->crossovers) {
    feq_crossover_reset(&crossover);
  }
  for (auto& compressor : chain->compressors) {
    feq_compressor_reset(&compressor);
  }
  feq_linked_limiter_reset_control(&chain->maximizer);

  if (reason == FEQ_CHAIN_RESET_SOURCE_CHANGE) {
    /**
     * A source boundary empties every delayed sample.
     *
     * Not an A/B toggle: without this the previous song plays on under the
     * next song's gain for the length of the look-ahead, which is a quarter of
     * a second of the wrong track at the wrong level.
     */
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      std::fill(chain->safety_delay[channel].begin(),
                chain->safety_delay[channel].end(), 0.0f);
      std::fill(chain->post_delay[channel].begin(),
                chain->post_delay[channel].end(), 0.0f);
      std::fill(chain->maximizer_delay[channel].begin(),
                chain->maximizer_delay[channel].end(), 0.0f);
    }
    feq_post_filter_normalizer_rebase(&chain->post_normalizer);
  }
}

uint32_t feq_chain_latency_frames(const FeqChain* chain) {
  if (chain == nullptr) {
    return 0;
  }
  return chain_linear_running(chain) != 0 ? feq_linear_phase_latency() : 0u;
}

void feq_chain_process(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  if (chain == nullptr || channels == nullptr || frames == 0 ||
      frames > chain->max_frames || chain->settings.enabled == 0) {
    return;
  }

  /**
   * The rack for this block, chosen once and used throughout.
   *
   * Adopting a newly published set halfway down would put the EQ on one rack
   * and the isolate subtraction beneath it on another, which is two different
   * filters inside one buffer rather than a settings change.
   */
  chain->active =
      &chain->coefficient_sets[chain->published_coefficients.load(
          std::memory_order_acquire)];

  // The kernel arrives the same way and for the same reason, and is taken at
  // the same point: this is the one moment in a block where swapping a filter
  // costs nothing, because none of it has been used yet.
  chain_adopt_kernel_handoff(chain);

  chain_process_input_gain(chain, channels, frames);

  chain_process_exciter(chain, channels, frames);
  // Tapped where the visible chain draws its boundary, not where it is
  // convenient: the exciter graph is showing what the exciter did, so it has to
  // be read before the EQ has had a turn at the same buffer.
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_EXCITER, channels, frames);

  chain_process_eq(chain, channels, frames);
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_EQ, channels, frames);

  /**
   * What each band did with this block, for the panel to draw.
   *
   * Taken here because the dynamics have just run and their envelopes describe
   * this block rather than the previous one. A dynamic band's effect is the one
   * thing in the rack that cannot be drawn from its settings — the curve is
   * drawn at full strength and its at-rest twin at zero, and neither moves when
   * the threshold does — so without this the threshold dial looks broken while
   * working perfectly.
   */
  if (chain->meters != nullptr) {
    const size_t bands = chain->band_dynamics.size();
    for (size_t band = 0; band < bands && band < FEQ_METER_MAX_BANDS;
         band += 1) {
      // A static band is always fully applied, which is what makes it static.
      chain->band_amount_scratch[band] =
          chain->band_dynamics[band].active != 0
              ? chain->band_dynamics[band].amount
              : 1.0;
      chain->band_level_scratch[band] = chain->band_dynamics[band].envelope;
    }
    feq_meters_publish_bands(
        chain->meters, chain->band_amount_scratch.data(),
        chain->band_level_scratch.data(),
        static_cast<uint32_t>(bands < FEQ_METER_MAX_BANDS
                                  ? bands
                                  : FEQ_METER_MAX_BANDS));
  }

  chain_process_compressor(chain, channels, frames);
  chain_process_maximizer(chain, channels, frames);

  const bool uses_selected_headroom =
      chain->settings.master.enabled != 0 &&
      chain->settings.master.loudness_maximize != 0;
  FeqPostFilterNormalizerOptions headroom{};
  headroom.enabled = uses_selected_headroom ? 1 : 0;
  headroom.output_ceiling_db = chain->settings.master.ceiling_db;
  // Reserve only gain actually present in this quantum. Reserving the future
  // target made Auto Headroom latch attenuation while the LUFS makeup was
  // still ramping, so uncached and cached playback disagreed.
  headroom.following_gain_db =
      chain->settings.master.output_trim_db + chain->master_loudness_now_db;
  headroom.release_ms = chain->settings.master.release_ms;
  headroom.sample_rate = chain->sample_rate;
  feq_post_filter_normalizer_process(&chain->post_normalizer, channels, frames,
                                     &headroom);

  chain_process_master_output(chain, channels, frames);

  if (chain->settings.output_safety_enabled != 0) {
    // Safety is separate from Auto Headroom. It sanitizes invalid results and
    // removes DC after the final gain, but its limiter stays at unity for
    // ordinary audio and arms only at the pathological +10 dBTP threshold.
    FeqOutputSafetyOptions options{};
    options.limiter_enabled = 1;
    options.ceiling = std::pow(10.0, kOutputSafetyCeilingDb / 20.0);
    options.activation_threshold =
        std::pow(10.0, kOutputSafetyExtremeDbtp / 20.0);
    // Safety is not a loudness processor. A coefficient of one latches
    // attenuation instead of following the programme back toward unity.
    options.release_coefficient = 1.0;
    options.knee_db = 0.0;
    options.release_hold_samples = 0.0;
    feq_output_safety_process(&chain->safety, channels, frames, &options);
  }

  // Last, after safety, because this is the one tap that has to be what leaves
  // for the device. A master meter read before the final limiter would show a
  // peak the listener never hears and miss the reduction that removed it.
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_MASTER, channels, frames);
}

void feq_chain_set_meters(FeqChain* chain, FeqMeters* meters) {
  if (chain != nullptr) {
    chain->meters = meters;
  }
}

}  // extern "C"

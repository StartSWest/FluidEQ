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

/** The look-ahead the dial is asking for, in samples, inside the ring. */
uint32_t maximizer_look_ahead_samples(const FeqChain* chain) {
  const double asked = chain->settings.maximizer.look_ahead_ms;
  const double capped =
      asked > kMaximizerMaxLookAheadMs ? kMaximizerMaxLookAheadMs : asked;
  const double samples = std::floor((capped / 1000.0) * chain->sample_rate +
                                    0.5);
  return samples < 1.0 ? 1u : static_cast<uint32_t>(samples);
}

/**
 * Build the Maximizer's limiter once, at the largest look-ahead the dial has.
 *
 * Only ever called while the device is stopped — `rebuild_chain_and_player`
 * negotiates the rate, builds, and only then lets a callback in. Sizing this
 * from the CURRENT look-ahead instead meant every step of that dial resized
 * the ring from the command thread while the audio thread was reading it: the
 * old buffer freed under it, the new one full of zeros. One step emitted a
 * hole of silence as long as the look-ahead, and a drag emitted a run of them.
 */
void allocate_maximizer(FeqChain* chain) {
  const uint32_t largest = static_cast<uint32_t>(std::floor(
      (kMaximizerMaxLookAheadMs / 1000.0) * chain->sample_rate + 0.5));
  const uint32_t capacity = (largest < 1u ? 1u : largest) + 1;
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
  chain->maximizer_look_ahead = maximizer_look_ahead_samples(chain);
  feq_linked_limiter_set_look_ahead(&chain->maximizer,
                                    chain->maximizer_look_ahead);
}

/**
 * Point the limiter at a different distance inside the ring it already has.
 *
 * One integer, and the audio in the delay is left exactly where it is. Moving
 * it splices the read cursor by the difference — a tenth of a millisecond per
 * step of the dial, against the twenty milliseconds of silence a resize used
 * to produce.
 */
void apply_maximizer_look_ahead(FeqChain* chain) {
  if (chain->maximizer.delay == nullptr) {
    return;
  }
  const uint32_t look_ahead = maximizer_look_ahead_samples(chain);
  if (look_ahead == chain->maximizer_look_ahead) {
    return;
  }
  chain->maximizer_look_ahead = look_ahead;
  feq_linked_limiter_set_look_ahead(&chain->maximizer, look_ahead);
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
  feq_denoise_settings_defaults(&settings->denoise);
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
  // Both bass stages off, and every generator at rest under that. A decoder
  // that failed halfway leaves these, so the resting values have to be the
  // bit-exact bypass rather than a pleasant-sounding starting point.
  settings->bass_forge.split_hz = 90.0;
  settings->bass_forge.texture = 0.8;
  settings->bass_punch.split_hz = 110.0;
  settings->bass_punch.bloom_decay_ms = 120.0;
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
  chain->loudness_meter = feq_loudness_meter_create(sample_rate, channels);
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

  /**
   * Two channels of the largest block each, because both stages work on a low
   * band they split off and hand back, and neither may allocate to do it.
   */
  const size_t stereo_block = static_cast<size_t>(frames) * 2;
  chain->bass_forge_low.assign(stereo_block, 0.0f);
  chain->bass_forge_scratch.assign(stereo_block, 0.0f);
  feq_bass_forge_init(&chain->bass_forge, chain->bass_forge_low.data(),
                      chain->bass_forge_scratch.data());

  const uint32_t bloom_capacity = feq_bass_punch_bloom_capacity(sample_rate);
  chain->bass_punch_low.assign(stereo_block, 0.0f);
  chain->bass_punch_bloom_pointers.assign(FEQ_BASS_PUNCH_BLOOM_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_BLOOM_LINES; ++at) {
    chain->bass_punch_bloom[at].assign(bloom_capacity, 0.0f);
    chain->bass_punch_bloom_pointers[at] = chain->bass_punch_bloom[at].data();
  }
  feq_bass_punch_init(&chain->bass_punch, chain->bass_punch_low.data(),
                      chain->bass_punch_bloom_pointers.data(), bloom_capacity);

  const uint32_t dimension_capacity =
      feq_dimension_allpass_capacity(sample_rate);
  chain->dimension_side.assign(frames, 0.0f);
  chain->dimension_low.assign(frames, 0.0f);
  chain->dimension_mid.assign(frames, 0.0f);
  chain->dimension_high.assign(frames, 0.0f);
  chain->dimension_allpass_pointers.assign(FEQ_DIMENSION_ALLPASSES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_ALLPASSES; ++at) {
    chain->dimension_allpass[at].assign(dimension_capacity, 0.0f);
    chain->dimension_allpass_pointers[at] = chain->dimension_allpass[at].data();
  }
  feq_dimension_init(&chain->dimension, chain->dimension_side.data(),
                     chain->dimension_low.data(), chain->dimension_mid.data(),
                     chain->dimension_high.data(),
                     chain->dimension_allpass_pointers.data(),
                     dimension_capacity);

  allocate_maximizer(chain);

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
  // Skipped rather than fatal if it cannot allocate. A rack that refuses to
  // make any sound because one processor could not get memory is worse than a
  // rack missing one processor.
  chain->denoise =
      feq_denoise_create(sample_rate, chain->channels, maximum_block_frames);

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
  feq_loudness_meter_destroy(chain->loudness_meter);
  feq_denoise_destroy(chain->denoise);
  chain->denoise = nullptr;
  delete chain;
}

void feq_chain_set_noise_profile(FeqChain* chain,
                                 const FeqNoiseProfile* profile) {
  if (chain == nullptr) {
    return;
  }
  feq_denoise_set_profile(chain->denoise, profile);
}

int feq_chain_load_voice_model(FeqChain* chain,
                               const char* model_path,
                               const char* runtime_path) {
  if (chain == nullptr) {
    return 0;
  }
  return feq_denoise_load_voice_model(chain->denoise, model_path,
                                      runtime_path);
}

void feq_chain_denoise_report(const FeqChain* chain, FeqDenoiseReport* out) {
  feq_denoise_report(chain == nullptr ? nullptr : chain->denoise, out);
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
  apply_maximizer_look_ahead(chain);
  feq_denoise_configure(chain->denoise, &chain->settings.denoise);
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
  feq_denoise_reset(chain->denoise);
  feq_biquad_reset(&chain->side_highpass);
  for (auto& crossover : chain->crossovers) {
    feq_crossover_reset(&crossover);
  }
  for (auto& compressor : chain->compressors) {
    feq_compressor_reset(&compressor);
  }
  feq_linked_limiter_reset_control(&chain->maximizer);
  // A seek or a new source must not arrive with the previous passage's bloom
  // tail still decaying under it, which is what these two hold that no filter
  // history above does.
  feq_bass_forge_reset(&chain->bass_forge);
  feq_bass_punch_reset(&chain->bass_punch);

  if (reason != FEQ_CHAIN_RESET_SEEK) {
    /**
     * A new programme is a new measurement, and a seek is not a new programme.
     *
     * Integrated loudness describes one piece of music. Carrying it across a
     * track change would answer a question nobody asked — the average of the
     * last three songs — and the reading would drift further from the target
     * the longer the queue ran. Jumping about inside one song, on the other
     * hand, is still that song, and restarting the integration on every scrub
     * would make the number unreadable exactly when it is being watched.
     */
    feq_loudness_meter_reset(chain->loudness_meter);
  }

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
  uint32_t latency =
      chain_linear_running(chain) != 0 ? feq_linear_phase_latency() : 0u;
  // Denoise adds delay only for the modules that are on: the comb is zero
  // latency, the repair costs its lookahead, the spectral module its window
  // less a hop. A stage reporting a latency it is not actually adding puts the
  // deck's crossfade out by that much on every handoff.
  latency += feq_denoise_latency_frames(chain->denoise);
  return latency;
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

  /*
   * Restoration, before anything creative touches the block.
   *
   * Below the input gain because that gain was chosen from a cached whole-file
   * true peak: altering the waveform above it makes the measurement describe a
   * signal that no longer exists, and the ceiling stops holding with nothing
   * reporting it. Above the exciter because the alternative is generating
   * harmonics from hiss and then trying to remove the result.
   */
  feq_denoise_process(chain->denoise, channels, frames);
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_DENOISE, channels, frames);

  chain_process_exciter(chain, channels, frames);
  /**
   * Tapped where the visible chain draws its boundary, not where it is
   * convenient: the exciter graph is showing what the exciter did, so it has
   * to be read before anything else has had a turn at the same buffer.
   *
   * This sat four lines lower for as long as Bass Forge has been in the
   * chain, which put a second generator between the stage and its own meter:
   * with Forge switched on the Exciter graph was drawing Forge's output, and
   * the two stages are hard to tell apart on a spectrum precisely because
   * both of them add harmonics to material that did not have them. Forge has
   * its own eight-band meter below and does not need a spectrum tap.
   */
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_EXCITER, channels, frames);
  // And what its three bands and the organic stage contributed, which the
  // spectrum cannot show: a nonlinear stage has no transfer curve to draw.
  feq_meters_publish_exciter(chain->meters, chain->exciter_band_report,
                             chain->exciter_organic_report);

  /**
   * Forge after the Exciter because both of them generate.
   *
   * They are the chain's two synthesis stages and they sit together, ahead of
   * the EQ, so the EQ is shaping everything that will be heard rather than
   * everything except what the two of them just made.
   */
  chain_process_bass_forge(chain, channels, frames);
  /**
   * The dry low band against the forged one, which no spectrum can separate.
   *
   * Both runs come off band-pass followers the stage already ran during the
   * block, so this is a copy of sixteen doubles rather than a measurement.
   * Published unconditionally: `chain_process_bass_forge` resets the stage on
   * every block it is switched off for, which drives both runs to the -120
   * floor — an honest "not running" rather than a minute-old reading held on
   * screen.
   */
  if (chain->meters != nullptr) {
    double forge_input_db[FEQ_BASS_FORGE_BANDS];
    double forge_output_db[FEQ_BASS_FORGE_BANDS];
    feq_bass_forge_bands(&chain->bass_forge, forge_input_db, forge_output_db);
    feq_meters_publish_bass_forge(chain->meters, forge_input_db,
                                  forge_output_db);
  }

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
      // In dB, because that is the scale the line is plotted on. See
      // `feq_meters_publish_bands`: the raw envelope read as a level just
      // under 0 dB whatever the band was hearing.
      const double envelope = chain->band_dynamics[band].envelope;
      chain->band_level_scratch[band] =
          envelope > 1e-6 ? 20.0 * std::log10(envelope) : -120.0;
    }
    feq_meters_publish_bands(
        chain->meters, chain->band_amount_scratch.data(),
        chain->band_level_scratch.data(),
        static_cast<uint32_t>(bands < FEQ_METER_MAX_BANDS
                                  ? bands
                                  : FEQ_METER_MAX_BANDS));
  }

  /**
   * Punch after the EQ and before the compressor: shaped, then controlled.
   *
   * A transient this stage has sharpened is something the compressor then gets
   * to decide about. The other order hands the compressor's low band an
   * envelope that has already been squashed, and Punch spends its range
   * rebuilding an attack that was just taken away.
   */
  chain_process_bass_punch(chain, channels, frames);
  /**
   * Three gains, which are the only evidence the stage is doing what it says.
   *
   * Its claim is that the leading edge and the tail are shaped independently
   * and that over a complete note the two followers converge, so the gain
   * averages to unity. A dial position cannot show either. Published every
   * block for the same reason Forge's bands are: `chain_process_bass_punch`
   * resets the stage while it is off, which puts all three at 0 dB.
   */
  feq_meters_publish_bass_punch(chain->meters,
                                feq_bass_punch_transient_db(&chain->bass_punch),
                                feq_bass_punch_sustain_db(&chain->bass_punch),
                                feq_bass_punch_duck_db(&chain->bass_punch));

  /**
   * Width before the dynamics, and that position is forced rather than chosen.
   *
   * Anything that changes level has to happen before the ceiling holds it, or
   * the widening pushes peaks back over a limit the Maximizer has already
   * enforced. Before the compressor too, so the compressor is deciding about
   * the signal that will actually be heard.
   */
  chain_process_dimension(chain, channels, frames);
  feq_meters_publish_dimension(chain->meters,
                               feq_dimension_guard(&chain->dimension));
  chain_process_compressor(chain, channels, frames);
  chain_process_maximizer(chain, channels, frames);
  // What it is holding down, which the spectrum cannot show either: a limiter
  // that is working looks exactly like one that is not until you see the
  // reduction.
  feq_meters_publish_maximizer(chain->meters, chain->maximizer_reduction_db);

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
    // EQ boosts and processor combinations can overload at 0 dB input even
    // with Master and Maximizer off. The former +10 dBTP activation left that
    // entire overload range to hard-clip at the device. Catch peaks at the
    // actual output ceiling, after every stage and the final gain.
    FeqOutputSafetyOptions options{};
    options.limiter_enabled = 1;
    options.ceiling = std::pow(10.0, kOutputSafetyCeilingDb / 20.0);
    options.activation_threshold = options.ceiling;
    // Slow recovery avoids modulating sustained bass, but still restores the
    // level after an overload. No drive or loudness makeup is added here.
    options.release_coefficient = std::exp(
        -1.0 / ((FEQ_SAFETY_RELEASE_MS / 1000.0) * chain->sample_rate));
    options.knee_db = 0.0;
    // Without a hold the guard recovered between bass peaks: a clean 20 Hz
    // note driven by +9 dB measured 0.63% THD+N despite never clipping.
    options.release_hold_samples = std::floor(
        (FEQ_SAFETY_RELEASE_HOLD_MS / 1000.0) * chain->sample_rate + 0.5);
    feq_output_safety_process(&chain->safety, channels, frames, &options);
  }

  /**
   * What the Master tail just did, for the card that claims to show it.
   *
   * Taken unconditionally, including while the panel is closed and while
   * safety is bypassed. Both stages hold their readings until something takes
   * them, so skipping the take would let a reduction from minutes ago be the
   * first thing displayed when the tab is opened — a meter reporting a peak
   * event that is over. Taking costs five `log10` calls a block.
   */
  const FeqPostFilterNormalizerTelemetry headroom_report =
      feq_post_filter_normalizer_take_telemetry(&chain->post_normalizer);
  const FeqOutputSafetyTelemetry safety_report =
      feq_output_safety_take_telemetry(&chain->safety);
  FeqMasterTelemetry master_report{};
  master_report.auto_headroom_reduction_db = headroom_report.gain_reduction_db;
  master_report.auto_headroom_true_peak_db =
      headroom_report.input_true_peak_db;
  master_report.safety_reduction_db = safety_report.gain_reduction_db;
  master_report.safety_true_peak_db = safety_report.input_true_peak_db;
  master_report.dc_correction_db = safety_report.dc_correction_db;
  master_report.repaired_samples = safety_report.repaired_samples;
  master_report.true_peak_factor = safety_report.true_peak_factor;
  master_report.safety_enabled = chain->settings.output_safety_enabled;
  feq_meters_publish_master(chain->meters, &master_report);

  // Last, after safety, because this is the one tap that has to be what leaves
  // for the device. A master meter read before the final limiter would show a
  // peak the listener never hears and miss the reduction that removed it.
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_MASTER, channels, frames);

  /**
   * The loudness of that same tap, and it runs whether or not anyone is
   * watching.
   *
   * Gating the measurement on the panel being open would make the integrated
   * reading depend on when the tab was opened, which is not a property of the
   * music. Only the publish is gated, inside the meters, and the measurement
   * costs two biquads per channel per sample.
   */
  feq_loudness_meter_process(chain->loudness_meter, channels, frames);
  FeqLoudnessReading loudness{};
  feq_loudness_meter_read(chain->loudness_meter, &loudness);
  feq_meters_publish_loudness(chain->meters, &loudness);
}

void feq_chain_set_meters(FeqChain* chain, FeqMeters* meters) {
  if (chain != nullptr) {
    chain->meters = meters;
  }
}

}  // extern "C"

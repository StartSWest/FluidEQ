/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"

#include <algorithm>
#include <cmath>
#include <cstring>

// The live normalizer is created with the chain's channel count and applies
// its one gain to every channel it was given; a chain wider than it takes
// would come up with no leveling at all, silently.
static_assert(FEQ_CHAIN_MAX_CHANNELS <= FEQ_LIVE_NORMALIZER_MAX_CHANNELS,
              "the live normalizer must take a full chain's channels");

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
  // Game mode with the Maximizer off: it keeps running — its state stays
  // current and switching it on is not a jump from a stale past — but with
  // nothing to limit, holding the audio back 5 ms for it is a comfort a
  // player does not want paid for.
  if (chain->settings.low_latency != 0 &&
      chain->settings.maximizer.enabled == 0) {
    return 0u;
  }
  const double asked = chain->settings.maximizer.look_ahead_ms;
  const double capped =
      asked > kMaximizerMaxLookAheadMs ? kMaximizerMaxLookAheadMs : asked;
  const double samples = std::floor((capped / 1000.0) * chain->sample_rate +
                                    0.5);
  return samples < 1.0 ? 1u : static_cast<uint32_t>(samples);
}

/** The low band's ring, one more than its longest look-ahead. */
uint32_t maximizer_low_capacity(double sample_rate) {
  const double samples =
      std::floor((kMaximizerLowLookAheadMs / 1000.0) * sample_rate + 0.5);
  return (samples < 1.0 ? 1u : static_cast<uint32_t>(samples)) + 1;
}

/**
 * The low band's look-ahead: its own, or the limiter's when that is shorter.
 *
 * Never longer than the limiter's, so a profile that asks for a short one —
 * the Punch profile's 1.5 ms is its whole character — gets a short one in
 * both, and game mode's zero is zero here too.
 */
uint32_t maximizer_low_look_ahead_samples(const FeqChain* chain) {
  const uint32_t own = maximizer_low_capacity(chain->sample_rate) - 1;
  const uint32_t limiter = maximizer_look_ahead_samples(chain);
  return own < limiter ? own : limiter;
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

  const uint32_t low_capacity = maximizer_low_capacity(chain->sample_rate);
  chain->maximizer_low_gain.assign(low_capacity, 0.0f);
  chain->maximizer_low_input_pointers.assign(chain->channels, nullptr);
  chain->maximizer_low_band_pointers.assign(chain->channels, nullptr);
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    chain->maximizer_low_input[channel].assign(low_capacity, 0.0f);
    chain->maximizer_low_band[channel].assign(low_capacity, 0.0f);
    chain->maximizer_low_input_pointers[channel] =
        chain->maximizer_low_input[channel].data();
    chain->maximizer_low_band_pointers[channel] =
        chain->maximizer_low_band[channel].data();
  }
  feq_bass_limiter_init(&chain->maximizer_low,
                        chain->maximizer_low_input_pointers.data(),
                        chain->maximizer_low_band_pointers.data(),
                        chain->maximizer_low_gain.data(), chain->channels,
                        low_capacity);
  chain->maximizer_low_look_ahead = maximizer_low_look_ahead_samples(chain);
  feq_bass_limiter_set_look_ahead(&chain->maximizer_low,
                                  chain->maximizer_low_look_ahead);
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
  if (look_ahead != chain->maximizer_look_ahead) {
    chain->maximizer_look_ahead = look_ahead;
    feq_linked_limiter_set_look_ahead(&chain->maximizer, look_ahead);
  }
  const uint32_t low_look_ahead = maximizer_low_look_ahead_samples(chain);
  if (low_look_ahead != chain->maximizer_low_look_ahead) {
    chain->maximizer_low_look_ahead = low_look_ahead;
    feq_bass_limiter_set_look_ahead(&chain->maximizer_low, low_look_ahead);
  }
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
  settings->surround_all_channels = 1;
  FeqRoomSettings room{};
  feq_room_settings_defaults(&room);
  settings->room.preset = 1;  // Living room, the one the dials describe.
  settings->room.size_m = room.size_m;
  settings->room.walls = room.walls;
  settings->room.distance_m = room.distance_m;
  settings->room.head = 1;
  settings->room.bass_management = room.bass_management;
  settings->room.crossover_hz = room.crossover_hz;
  settings->room.music_upmix = room.music_upmix;
  settings->room.upmix_amount = room.upmix_amount;
  settings->room.renderer_version = room.renderer_version;
  settings->room.early_reflection_db = room.early_reflection_db;
  settings->room.ambience_mix = room.ambience_mix;
  settings->room.ambience_decay_s = room.ambience_decay_s;
  settings->room.ambience_damping_hz = room.ambience_damping_hz;
  settings->room.preserve_position = room.preserve_position;
  settings->room.compare_original = room.compare_original;
  settings->room.source_already_spatial = room.source_already_spatial;
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    settings->room.angle_deg[speaker] = room.angle_deg[speaker];
    settings->room.level_db[speaker] = room.level_db[speaker];
    settings->room.speaker_distance_m[speaker] = room.speaker_distance_m[speaker];
    settings->room.mute[speaker] = room.mute[speaker];
  }
  settings->room.mute[FEQ_ROOM_SPEAKERS] = room.mute[FEQ_ROOM_SPEAKERS];
  settings->normalizer.ceiling_db = -1;
  settings->normalizer.target_lufs = -14;
  feq_denoise_settings_defaults(&settings->denoise);
  settings->eq.model_amount = 1.0;
  settings->eq.oversample = 1;
  // The cookbook, which is what every test and fixture was built against;
  // the app says Precise on the wire (`FeqChainEqSettings::matched`).
  settings->eq.matched = 0;
  // Both bass stages off, and every generator at rest under that. A decoder
  // that failed halfway leaves these, so the resting values have to be the
  // bit-exact bypass rather than a pleasant-sounding starting point.
  settings->bass_forge.split_hz = 90.0;
  settings->bass_forge.texture = 0.8;
  settings->bass_punch.split_hz = 110.0;
  settings->bass_punch.bloom_decay_ms = 120.0;
  settings->bass_punch.mix = 1.0;
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
      channels > FEQ_CHAIN_MAX_CHANNELS || maximum_block_frames == 0) {
    return nullptr;
  }
  auto* chain = new FeqChain();
  chain->sample_rate = sample_rate;
  chain->channels = channels;
  chain->max_frames = maximum_block_frames;
  chain->loudness_meter = feq_loudness_meter_create(sample_rate, channels);
  // The Master measures the programme with one of its own where nobody has
  // measured the track for it: see `chain_update_live_master`.
  chain->programme_meter = feq_loudness_meter_create(sample_rate, channels);
  feq_chain_settings_defaults(&chain->settings);

  const uint32_t frames = maximum_block_frames;
  const uint32_t latency = feq_linear_phase_latency();
  const size_t wide = static_cast<size_t>(frames) * kMaxOversample;

  // Only the channels this chain has: a slot holds two lines the length of
  // the linear-phase latency, and a stereo chain buying six more of them
  // would be half a megabyte for channels it will never see.
  for (uint32_t channel = 0; channel < channels; ++channel) {
    resize_slot(chain->slots[channel], frames, latency);
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
  for (uint32_t channel = 0; channel < channels; ++channel) {
    chain->linked_dry[channel].assign(frames, 0.0f);
    chain->linked_wet[channel].assign(frames, 0.0f);
    chain->linked_doubled[channel].assign(wide, 0.0f);
    chain->linked_dry_doubled[channel].assign(wide, 0.0f);
    chain->linked_wet_doubled[channel].assign(wide, 0.0f);
    chain->linked_middle[channel].assign(static_cast<size_t>(frames) * 2,
                                         0.0f);
  }
  chain->mono_maker.side.assign(frames, 0.0f);
  chain->mono_maker.side_outgoing.assign(frames, 0.0f);
  chain_mono_maker_reset(chain);
  // One path per channel, and Mid and Side only where there is a pair to
  // encode: each path is twenty-odd blocks of scratch, so the ones a chain
  // cannot reach are left unallocated rather than bought for nothing.
  for (uint32_t path = 0; path < channels; ++path) {
    chain_prepare_exciter_path(chain, path);
  }
  if (channels >= 2) {
    chain_prepare_exciter_path(chain, kExciterMidPath);
    chain_prepare_exciter_path(chain, kExciterMidPath + 1);
  }

  /**
   * The surround channels' alignment with the front pair — see
   * `denoise_align` in `chain_internal.h`. Sized once, here, at the most the
   * restoration can ever delay and at Bass Punch's fixed FIR, because
   * `feq_chain_configure` runs with no lock: a line resized there is freed
   * under the audio thread, the lesson the Maximizer's ring paid for. The
   * restoration's line changes only its read distance when its modules do.
   */
  if (channels > FEQ_CHAIN_CHANNELS) {
    const uint32_t punch = feq_bass_punch_latency_frames(sample_rate);
    for (uint32_t channel = FEQ_CHAIN_CHANNELS; channel < channels; ++channel) {
      chain->punch_align_line[channel].assign(
          static_cast<size_t>(punch) + 1, 0.0f);
      feq_delay_line_init(&chain->punch_align[channel],
                          chain->punch_align_line[channel].data(), punch + 1,
                          punch);
      chain->denoise_align_line[channel].assign(
          static_cast<size_t>(FEQ_DENOISE_MAX_LATENCY_FRAMES) + 1, 0.0f);
      feq_delay_line_init(&chain->denoise_align[channel],
                          chain->denoise_align_line[channel].data(),
                          FEQ_DENOISE_MAX_LATENCY_FRAMES + 1, 0);
    }
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
  chain->dimension_allpass_pointers.assign(FEQ_DIMENSION_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_LINES; ++at) {
    chain->dimension_allpass[at].assign(dimension_capacity, 0.0f);
    chain->dimension_allpass_pointers[at] = chain->dimension_allpass[at].data();
  }
  feq_dimension_init(&chain->dimension,
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
      static_cast<size_t>(FeqChain::kBandStride) * FEQ_CHAIN_MAX_CHANNELS;
  chain->band_states.resize(histories);
  chain->band_dynamics.resize(histories);
  // Sized with the rack, so publishing activity allocates nothing per block.
  chain->band_amount_scratch.assign(histories, 1.0);
  chain->band_level_scratch.assign(histories, 0.0);
  for (size_t index = 0; index < histories; ++index) {
    feq_biquad_reset(&chain->band_states[index]);
    feq_band_dynamics_init(&chain->band_dynamics[index]);
  }
  // The rack an edit crosses from, sized the same way and for the same
  // reason: a fade starts on the audio thread and may only copy.
  chain_eq_fade_allocate(chain);
  // `assign` value-initialises, and a zeroed biquad history is a reset one.
  const size_t tone_histories =
      static_cast<size_t>(FeqChain::kToneSlots) * FEQ_CHAIN_MAX_CHANNELS;
  chain->tone_states.assign(tone_histories, FeqBiquadState{});
  chain->tone_inverse_states.assign(tone_histories, FeqBiquadState{});
  for (uint32_t channel = 0; channel < channels; ++channel) {
    chain->change_active[channel].assign(feq_convolver_latency(), 0.0f);
    chain->change_next[channel].assign(feq_convolver_latency(), 0.0f);
    chain->kernel_difference[channel].assign(feq_convolver_latency(), 0.0f);
    chain->share_input[channel].assign(feq_convolver_latency(), 0.0f);
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
  // The room, for whatever width this chain has; a mono chain's stays
  // inactive. Created last, so a failure here has a whole chain to free.
  chain->room = feq_room_create(sample_rate, channels, frames);
  if (chain->room == nullptr) {
    feq_chain_destroy(chain);
    return nullptr;
  }
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
  chain_kernel_destroy(chain->kernel);
  chain_kernel_destroy(chain->kernel_next);
  for (auto* convolver : chain->queued_convolvers) {
    feq_convolver_destroy(convolver);
  }
  chain_kernel_destroy(chain->queued_kernel);
  for (uint32_t retired = 0; retired < chain->retired_count; ++retired) {
    for (auto* convolver : chain->retired_convolvers[retired]) {
      feq_convolver_destroy(convolver);
    }
    chain_kernel_destroy(chain->retired_kernels[retired]);
  }
  // Anything still in transit has no thread left to reach it, and it holds the
  // largest allocation in the chain.
  chain_release_kernel_handoff(chain);
  feq_loudness_meter_destroy(chain->loudness_meter);
  feq_loudness_meter_destroy(chain->programme_meter);
  feq_live_normalizer_destroy(chain->live_normalizer);
  feq_room_destroy(chain->room);
  chain->room = nullptr;
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
  feq_linked_limiter_set_look_ahead(&chain->post_normalizer.limiter,
                                    chain_headroom_look_ahead(chain));
  feq_live_normalizer_set_standby(chain->live_normalizer,
                                  chain_leveler_idle(chain) ? 1 : 0);
  feq_denoise_configure(chain->denoise, &chain->settings.denoise);
  // After the restoration, whose modules decide how far behind the front
  // pair now runs — and so how far the other channels must be held back.
  chain_apply_denoise_alignment(chain);
  {
    FeqRoomSettings room{};
    feq_room_settings_defaults(&room);
    room.enabled = chain->settings.room.enabled;
    room.size_m = chain->settings.room.size_m;
    room.walls = chain->settings.room.walls;
    room.distance_m = chain->settings.room.distance_m;
    room.centre_db = chain->settings.room.centre_db;
    room.sub_db = chain->settings.room.sub_db;
    room.bass_management = chain->settings.room.bass_management;
    room.crossover_hz = chain->settings.room.crossover_hz;
    room.music_upmix = chain->settings.room.music_upmix;
    room.upmix_amount = chain->settings.room.upmix_amount;
    room.renderer_version = chain->settings.room.renderer_version;
    room.early_reflection_db = chain->settings.room.early_reflection_db;
    room.ambience_mix = chain->settings.room.ambience_mix;
    room.ambience_decay_s = chain->settings.room.ambience_decay_s;
    room.ambience_damping_hz = chain->settings.room.ambience_damping_hz;
    room.preserve_position = chain->settings.room.preserve_position;
    room.compare_original = chain->settings.room.compare_original;
    room.source_already_spatial = chain->settings.room.source_already_spatial;
    // The three shipped heads, small to large, and the interaural delay
    // each is scaled to: the fit test will refine these per listener.
    const double scales[3] = {0.94, 1.0, 1.06};
    const int head = chain->settings.room.head;
    room.head_scale = head >= 0 && head < 3 ? scales[head] : 1.0;
    for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
      room.angle_deg[speaker] = chain->settings.room.angle_deg[speaker];
      room.level_db[speaker] = chain->settings.room.level_db[speaker];
      room.speaker_distance_m[speaker] =
          chain->settings.room.speaker_distance_m[speaker];
      room.mute[speaker] = chain->settings.room.mute[speaker];
    }
    room.mute[FEQ_ROOM_SPEAKERS] = chain->settings.room.mute[FEQ_ROOM_SPEAKERS];
    feq_room_set_low_latency(chain->room, chain->settings.low_latency);
    feq_room_configure(chain->room, &room);
  }
  chain_refresh_eq(chain);
  // After the bands, because it is built from the same settings and the guard
  // inside it decides whether anything is done at all. This is what makes
  // linear phase and Minimum Isolate work on this engine: without it nothing
  // ever calls `feq_chain_set_eq_kernel`, `convolvers[0]` stays null for the
  // life of the chain, and `chain_linear_running` answers 0 to every block
  // while the panel goes on offering the mode.
  chain_refresh_eq_kernel(chain);
}

void feq_chain_set_lfe_channel(FeqChain* chain, int channel) {
  if (chain == nullptr) {
    return;
  }
  chain->lfe_channel =
      channel >= 0 && static_cast<uint32_t>(channel) < chain->channels
          ? channel
          : -1;
  feq_room_set_layout(chain->room, chain->room_speakers, chain->lfe_channel);
}

void feq_chain_set_room_head(FeqChain* chain, const float* left,
                             const float* right, uint32_t directions,
                             uint32_t taps, int doubling) {
  if (chain == nullptr) {
    return;
  }
  feq_room_set_head(chain->room, left, right, directions, taps, doubling);
}

void feq_chain_set_room_layout(FeqChain* chain, const int* speaker) {
  if (chain == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < FEQ_CHAIN_MAX_CHANNELS; ++channel) {
    chain->room_speakers[channel] = speaker != nullptr ? speaker[channel] : -1;
  }
  feq_room_set_layout(chain->room, chain->room_speakers, chain->lfe_channel);
}

int feq_chain_room_active(const FeqChain* chain) {
  return chain == nullptr ? 0 : feq_room_active(chain->room);
}

void feq_chain_set_track_level_gains(FeqChain* chain,
                                     double input_gain_db,
                                     double master_loudness_gain_db,
                                     int snap) {
  if (chain == nullptr) {
    return;
  }
  // Somebody has measured this track, so the chain must not measure it again:
  // the Library's makeup and a live one would be the same correction twice.
  chain->host_track_gains = 1;
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

void feq_chain_reset_room(FeqChain* chain) {
  if (chain == nullptr) return;
  feq_room_reset_route(chain->room);
  // Punch's always-running standby alignment feeds the Room reference too.
  // Without clearing it, regular mode captures the pre-route block on return.
  feq_bass_punch_reset(&chain->bass_punch);
  // Room output already queued downstream is stale Room audio too.
  feq_dimension_reset(&chain->dimension);
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    // Both alignment lines, as `feq_chain_reset` clears them: each holds
    // audio from before the route changed, on its way to the Room. Only the
    // stereo host calls this today, where neither carries anything.
    for (auto* line : {&chain->post_delay[channel],
                       &chain->maximizer_delay[channel],
                       &chain->punch_align_line[channel],
                       &chain->denoise_align_line[channel]}) {
      std::fill(line->begin(), line->end(), 0.0f);
    }
  }
  // The Maximizer's low band holds the same audio a little earlier.
  feq_bass_limiter_reset(&chain->maximizer_low);
  const FeqRoomReport inactive{FEQ_ROOM_REPORT_TAG, 0};
  feq_meters_publish_room(chain->meters, &inactive);
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
  // Nothing of the previous passage is crossed from.
  chain_eq_fade_stop(chain);
  feq_denoise_reset(chain->denoise);
  feq_live_normalizer_reset(chain->live_normalizer);
  chain_mono_maker_reset(chain);
  // A stream starts at the drive asked for; only a change glides.
  chain->maximizer_drive_now =
      chain->settings.maximizer.enabled != 0
          ? std::pow(10.0, chain->settings.maximizer.drive_db / 20.0)
          : 1.0;
  feq_linked_limiter_reset_control(&chain->maximizer);
  feq_bass_limiter_reset_control(&chain->maximizer_low);
  // A seek or a new source must not arrive with the previous passage's bloom
  // tail still decaying under it, which is what these two hold that no filter
  // history above does.
  feq_bass_forge_reset(&chain->bass_forge);
  chain->bass_forge_run = FeqChain::BassForgeRun{};
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
    // And the Master's own measurement of the programme, for the same reason
    // and with the same exception for a seek.
    feq_loudness_meter_reset(chain->programme_meter);
    chain->live_master_peak_db = -120.0;
    chain->live_master_frames = 0;
    chain->live_master_target_db = 0.0;
  }

  feq_room_reset(chain->room);
  if (reason == FEQ_CHAIN_RESET_SOURCE_CHANGE) {
    /**
     * A source boundary empties every delayed sample.
     *
     * Not an A/B toggle: without this the previous song plays on under the
     * next song's gain for the length of the look-ahead, which is a quarter of
     * a second of the wrong track at the wrong level.
     */
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      std::fill(chain->post_delay[channel].begin(),
                chain->post_delay[channel].end(), 0.0f);
      std::fill(chain->maximizer_delay[channel].begin(),
                chain->maximizer_delay[channel].end(), 0.0f);
      // The surround channels' alignment lines are delayed audio too, and
      // the front pair's own delays (the restoration's ring, Punch's FIR)
      // are emptied by the resets above this block.
      std::fill(chain->denoise_align_line[channel].begin(),
                chain->denoise_align_line[channel].end(), 0.0f);
      std::fill(chain->punch_align_line[channel].begin(),
                chain->punch_align_line[channel].end(), 0.0f);
    }
    feq_bass_limiter_reset(&chain->maximizer_low);
    feq_post_filter_normalizer_rebase(&chain->post_normalizer);
    // The Maximizer's ring is empty now, so the curve around it starts over
    // from silence rather than gliding from the last song's.
    chain_tone_restart(chain);
  }
}

void feq_chain_latency_parts(const FeqChain* chain, FeqChainLatencyParts* out) {
  if (out == nullptr) {
    return;
  }
  *out = FeqChainLatencyParts{};
  if (chain == nullptr || chain->settings.enabled == 0) {
    return;
  }
  out->linear_eq =
      chain_linear_running(chain) != 0 ? feq_linear_phase_latency() : 0u;
  // Denoise adds delay only for the modules that are on: the comb is zero
  // latency, the repair costs its lookahead, the spectral module its window
  // less a hop. A stage reporting a latency it is not actually adding puts the
  // deck's crossfade out by that much on every handoff.
  out->restoration = feq_denoise_latency_frames(chain->denoise);
  out->leveler = feq_live_normalizer_latency(chain->live_normalizer);
  out->room = feq_room_latency_frames(chain->room);
  if (chain->channels >= 2 && !chain_bass_punch_idle(chain)) {
    // Bass Punch keeps this alignment under bypass, so only the rack bypass
    // removes it — or game mode, when Punch is off. Account for it when
    // aligning deck transitions.
    out->bass_punch = feq_bass_punch_latency_frames(chain->sample_rate);
  }
  // The two limiters at the end of the chain hold the audio back by their
  // look-ahead on every block — even when they are off, so that switching
  // them on is never a jump — and for years neither was counted here. Read
  // from the limiters themselves, so the number is whatever they were last
  // set to, game mode's zero included.
  out->maximizer =
      chain->maximizer.delay != nullptr
          ? chain->maximizer.look_ahead + chain->maximizer_low.look_ahead
          : 0u;
  out->headroom = chain->post_normalizer.limiter.look_ahead;
}

uint32_t feq_chain_latency_frames(const FeqChain* chain) {
  FeqChainLatencyParts parts{};
  feq_chain_latency_parts(chain, &parts);
  return parts.linear_eq + parts.restoration + parts.leveler + parts.room +
         parts.bass_punch + parts.maximizer + parts.headroom;
}

uint32_t feq_chain_active_stages(const FeqChain* chain) {
  if (chain == nullptr || chain->settings.enabled == 0) return 0u;
  const auto& settings = chain->settings;
  const bool active[] = {
      settings.normalizer.mode != 0,
      settings.denoise.enabled != 0,
      settings.exciter.enabled != 0,
      settings.bass_forge.enabled != 0,
      settings.eq.enabled != 0,
      settings.bass_punch.enabled != 0 && chain->channels >= 2,
      feq_chain_room_active(chain) != 0,
      settings.dimension.enabled != 0 && chain->channels >= 2 &&
          !(feq_chain_room_active(chain) && settings.room.preserve_position),
      settings.maximizer.enabled != 0,
      settings.master.enabled != 0 && settings.master.loudness_maximize != 0,
      settings.master.enabled != 0,
  };
  uint32_t mask = 0;
  for (uint32_t stage = 0; stage < 11u; ++stage) {
    if (active[stage]) mask |= 1u << stage;
  }
  return mask;
}

uint32_t feq_chain_processed_stages(const FeqChain* chain) {
  uint32_t mask = feq_chain_active_stages(chain);
  if (chain == nullptr || chain->settings.enabled == 0) return mask;
  FeqRoomReport report{};
  feq_room_report(chain->room, &report);
  mask &= ~((1u << 6) | (1u << 7));
  if ((report.flags & FEQ_ROOM_REPORT_ACTIVE) != 0) mask |= 1u << 6;
  if (chain->settings.dimension.enabled && chain->channels >= 2 &&
      (report.flags & FEQ_ROOM_REPORT_PROTECTED) == 0) mask |= 1u << 7;
  return mask;
}

void feq_chain_process(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  if (chain == nullptr || channels == nullptr || frames == 0 ||
      frames > chain->max_frames) {
    return;
  }
  if (chain->settings.enabled == 0) {
    FeqRoomReport inactive{FEQ_ROOM_REPORT_TAG, 0};
    feq_meters_publish_room(chain->meters, &inactive);
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
  // A new EQ rack is crossed to rather than jumped to, with every band's
  // history following the band (`chain_eq_fade.cpp`); here, before any of
  // the block has run, for the reason the set is chosen here.
  chain_eq_adopt(chain);

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
  // The restoration works on the front pair and delays it by its modules;
  // the channels beyond the pair are held back by the same amount here, so
  // the exciter and everything after it see all of them in step.
  chain_process_denoise_align(chain, channels, frames);
  if (chain->meters != nullptr) {
    FeqDenoiseReport report{};
    // Read on the producer thread: the estimator's arrays are mutable audio
    // state, so the pipe worker must consume a published copy instead.
    feq_denoise_report(chain->denoise, &report);
    feq_meters_publish_denoise(chain->meters, &report);
  }
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
   * Punch after the EQ and before the level stages: shaped, then controlled.
   *
   * A transient this stage has sharpened is something the Maximizer then gets
   * to decide about. The other order hands Punch an envelope that has already
   * been held down, and it spends its range rebuilding an attack that was
   * just taken away.
   */
  chain_process_bass_punch(chain, channels, frames);
  /**
   * Three gains, which are the only evidence the stage is doing what it says.
   *
   * Its claim is that the leading edge and the tail are shaped independently
   * and that over a complete note the two followers converge, so the gain
   * averages to unity. A dial position cannot show either. Published every
   * block for the same reason Forge's bands are. Bypass zeros the controls
   * while keeping the dry alignment and finite contribution history current.
   */
  feq_meters_publish_bass_punch(chain->meters,
                                feq_bass_punch_transient_db(&chain->bass_punch),
                                feq_bass_punch_sustain_db(&chain->bass_punch),
                                feq_bass_punch_duck_db(&chain->bass_punch));

  /**
   * The room, after everything that is per channel and before everything
   * that is about the pair: from here on the front pair carries the two
   * ears and the stages below run on that, as they run on any stereo mix.
   */
  feq_room_process(chain->room, channels, frames);
  FeqRoomReport room_report{};
  feq_room_report(chain->room, &room_report);
  feq_meters_publish_room(chain->meters, &room_report);

  /**
   * Width before the dynamics, and that position is forced rather than chosen.
   *
   * Anything that changes level has to happen before the ceiling holds it, or
   * the widening pushes peaks back over a limit the Maximizer has already
   * enforced.
   */
  chain_process_dimension(chain, channels, frames);
  feq_meters_publish_dimension(chain->meters,
                               feq_dimension_guard(&chain->dimension));
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
  headroom.following_gain_db = chain->settings.master.output_trim_db +
                               chain->master_loudness_now_db +
                               chain->live_master_now_db;
  headroom.release_ms = chain->settings.master.release_ms;
  headroom.sample_rate = chain->sample_rate;
  feq_post_filter_normalizer_process(&chain->post_normalizer, channels, frames,
                                     &headroom);

  chain_process_master_output(chain, channels, frames);
  // The preset's curve comes off here, after the Master as well as the
  // Maximizer: a chain that ends in the Master's Auto Headroom (Default, the
  // voices) held its peaks to the ceiling BEFORE the curve and went over once
  // it had played, as the Maximizer's did before it was told the curve.
  chain_tone_inverse(chain, channels, frames);

  /**
   * There is nothing after the Master's gain: no final limiter, no DC filter.
   *
   * A guard used to sit here — a -0.1 dBTP true-peak limiter and a 3 Hz
   * high-pass, always on, whatever the cards said. It held every record
   * mastered above its ceiling, which is most of them, so a rack with every
   * card off still changed the sound and the window read it as clipping. It
   * was removed on 2026-09-22 at Ivan's call: the rack with nothing on is a
   * delay and nothing else (`chain_transparency_test.cpp`), and a stage that
   * raises the level carries its own ceiling — the Maximizer, the Master's
   * Auto Headroom, the Normalizer's peak guard. Nothing is put back here that
   * touches a sample the listener did not ask to be touched.
   *
   * The one thing that does leave here is a sample that is not a number: a
   * NaN or an infinity plays as silence or a full-scale burst and, inside a
   * biquad's history, never ends. It is replaced by silence without a meter,
   * because a finite sample is never changed by this.
   */
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    float* samples = channels[channel];
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(samples[at])) {
        samples[at] = 0.0f;
      }
    }
  }

  /**
   * What the Master's Auto Headroom just did, for the card that shows it.
   *
   * Taken unconditionally, including while the panel is closed. The stage
   * holds its reading until something takes it, so skipping the take would
   * let a reduction from minutes ago be the first thing displayed when the
   * tab is opened — a meter reporting a peak event that is over.
   */
  const FeqPostFilterNormalizerTelemetry headroom_report =
      feq_post_filter_normalizer_take_telemetry(&chain->post_normalizer);
  FeqMasterTelemetry master_report{};
  master_report.auto_headroom_reduction_db = headroom_report.gain_reduction_db;
  master_report.auto_headroom_true_peak_db =
      headroom_report.input_true_peak_db;
  /**
   * The same true peak, kept as the programme's loudest so far.
   *
   * This is the peak of the signal entering the master gain, measured with
   * the oversampling detector Auto Headroom already runs — so the chain's own
   * loudness makeup can be capped by the room the programme has left without
   * a second true-peak detector anywhere.
   */
  if (headroom_report.input_true_peak_db > chain->live_master_peak_db) {
    chain->live_master_peak_db = headroom_report.input_true_peak_db;
  }
  feq_meters_publish_master(chain->meters, &master_report);

  // Last, because this is the one tap that has to be what leaves for the
  // device: what the master meter draws is what the listener hears.
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

int feq_chain_enable_live_normalizer(FeqChain* chain) {
  if (chain == nullptr) return 0;
  if (chain->live_normalizer == nullptr) {
    chain->live_normalizer = feq_live_normalizer_create(chain->sample_rate, chain->channels);
    // Made after the chain was configured, so it learns game mode here.
    feq_live_normalizer_set_standby(chain->live_normalizer,
                                    chain_leveler_idle(chain) ? 1 : 0);
  }
  return chain->live_normalizer != nullptr ? 1 : 0;
}
void feq_chain_attach_leveling_memory(FeqChain* chain, FeqLevelingMemory* memory) {
  if (chain == nullptr) return;
  feq_live_normalizer_attach_memory(chain->live_normalizer, memory);
  // The Master reads it too, for one thing only: whether the song changed,
  // because integrated loudness describes one piece of music.
  chain->leveling = memory;
}
void feq_chain_notify_input_silence(FeqChain* chain, uint32_t frames) {
  if (chain != nullptr) feq_live_normalizer_silence(chain->live_normalizer, frames);
}

}  // extern "C"

#include "chain_internal.h"

#include <utility>

namespace {

bool same_kernel(const FeqChain& prepared, const FeqChain& previous) noexcept {
  if (prepared.kernel_wanted != previous.kernel_wanted ||
      prepared.kernel_band_count != previous.kernel_band_count ||
      prepared.kernel_engine != previous.kernel_engine ||
      prepared.kernel_model != previous.kernel_model ||
      prepared.kernel_model_amount != previous.kernel_model_amount ||
      prepared.kernel_subsonic_hz != previous.kernel_subsonic_hz) {
    return false;
  }
  for (uint32_t index = 0; index < prepared.kernel_band_count; ++index) {
    const auto& wanted = prepared.kernel_bands[index];
    const auto& playing = previous.kernel_bands[index];
    if (wanted.enabled != playing.enabled || wanted.dynamic != playing.dynamic ||
        wanted.type != playing.type || wanted.frequency != playing.frequency ||
        wanted.gain_db != playing.gain_db || wanted.quality != playing.quality) {
      return false;
    }
  }
  return true;
}

void transfer_convolvers(FeqChain& prepared, FeqChain& previous) noexcept {
  using std::swap;
  prepared.defer_convolver_retirement = true;
  if (same_kernel(prepared, previous)) {
    swap(prepared.kernel, previous.kernel);
    swap(prepared.kernel_next, previous.kernel_next);
    swap(prepared.convolvers, previous.convolvers);
    swap(prepared.convolvers_next, previous.convolvers_next);
    swap(prepared.queued_kernel, previous.queued_kernel);
    swap(prepared.queued_convolvers, previous.queued_convolvers);
    swap(prepared.convolver_blend, previous.convolver_blend);
    swap(prepared.convolver_warmup, previous.convolver_warmup);
    swap(prepared.convolver_priming, previous.convolver_priming);
  } else if (prepared.kernel != nullptr && previous.kernel != nullptr) {
    const bool blending = previous.convolvers_next[0] != nullptr &&
        (previous.convolver_blend[0] > 0.0 || previous.convolver_blend[1] > 0.0);
    swap(prepared.kernel, previous.kernel);
    swap(prepared.convolvers, previous.convolvers);
    prepared.convolver_priming = previous.convolver_priming;
    if (blending) {
      swap(prepared.kernel_next, previous.kernel_next);
      swap(prepared.convolvers_next, previous.convolvers_next);
      swap(prepared.convolver_blend, previous.convolver_blend);
      swap(prepared.convolver_warmup, previous.convolver_warmup);
      swap(prepared.queued_kernel, previous.kernel);
      swap(prepared.queued_convolvers, previous.convolvers);
    } else {
      swap(prepared.kernel_next, previous.kernel);
      swap(prepared.convolvers_next, previous.convolvers);
      prepared.convolver_warmup = static_cast<int64_t>(
          feq_convolver_kernel_warmup(prepared.kernel_next));
    }
  }
}

void transfer_histories(FeqChain& prepared, FeqChain& previous) noexcept {
  using std::swap;
  swap(prepared.slots, previous.slots);
  swap(prepared.paths, previous.paths);
  swap(prepared.band_states, previous.band_states);
  for (size_t index = 0; index < prepared.band_dynamics.size(); ++index) {
    prepared.band_dynamics[index].envelope = previous.band_dynamics[index].envelope;
    prepared.band_dynamics[index].amount = previous.band_dynamics[index].amount;
  }
  swap(prepared.dynamic_states, previous.dynamic_states);
  swap(prepared.side_highpass, previous.side_highpass);
  swap(prepared.crossovers, previous.crossovers);
  swap(prepared.compressors, previous.compressors);

  swap(prepared.maximizer, previous.maximizer);
  swap(prepared.maximizer_detectors, previous.maximizer_detectors);
  swap(prepared.maximizer_delay, previous.maximizer_delay);
  swap(prepared.maximizer_delay_pointers, previous.maximizer_delay_pointers);
  swap(prepared.maximizer_reduction, previous.maximizer_reduction);
  swap(prepared.maximizer_reduction_db, previous.maximizer_reduction_db);
  feq_linked_limiter_set_look_ahead(&prepared.maximizer,
                                    prepared.maximizer_look_ahead);

  swap(prepared.bass_forge, previous.bass_forge);
  swap(prepared.bass_forge_low, previous.bass_forge_low);
  swap(prepared.bass_forge_scratch, previous.bass_forge_scratch);
  swap(prepared.bass_punch, previous.bass_punch);
  swap(prepared.bass_punch_low, previous.bass_punch_low);
  swap(prepared.bass_punch_bloom, previous.bass_punch_bloom);
  swap(prepared.bass_punch_bloom_pointers, previous.bass_punch_bloom_pointers);

  swap(prepared.dimension, previous.dimension);
  swap(prepared.dimension_side, previous.dimension_side);
  swap(prepared.dimension_low, previous.dimension_low);
  swap(prepared.dimension_mid, previous.dimension_mid);
  swap(prepared.dimension_high, previous.dimension_high);
  swap(prepared.dimension_allpass, previous.dimension_allpass);
  swap(prepared.dimension_allpass_pointers, previous.dimension_allpass_pointers);

  swap(prepared.post_normalizer, previous.post_normalizer);
  swap(prepared.post_detectors, previous.post_detectors);
  swap(prepared.post_delay, previous.post_delay);
  swap(prepared.post_delay_pointers, previous.post_delay_pointers);
  swap(prepared.post_reduction, previous.post_reduction);
  swap(prepared.safety, previous.safety);
  swap(prepared.safety_dc, previous.safety_dc);
  swap(prepared.safety_detectors, previous.safety_detectors);
  swap(prepared.safety_delay, previous.safety_delay);
  swap(prepared.safety_delay_pointers, previous.safety_delay_pointers);
  swap(prepared.safety_reduction, previous.safety_reduction);
  swap(prepared.loudness_meter, previous.loudness_meter);

  swap(prepared.input_gain_now, previous.input_gain_now);
  swap(prepared.live_normalizer, previous.live_normalizer);
  swap(prepared.input_gain_target_db, previous.input_gain_target_db);
  swap(prepared.input_gain_start_db, previous.input_gain_start_db);
  swap(prepared.master_loudness_now_db, previous.master_loudness_now_db);
  swap(prepared.master_loudness_target_db, previous.master_loudness_target_db);
  swap(prepared.master_loudness_start_db, previous.master_loudness_start_db);
  swap(prepared.transition_frames, previous.transition_frames);
  swap(prepared.transition_elapsed, previous.transition_elapsed);
  swap(prepared.master_gain_now, previous.master_gain_now);
}

}

extern "C" int feq_chain_transfer_state(FeqChain* prepared, FeqChain* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous ||
      prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels ||
      prepared->max_frames != previous->max_frames ||
      (prepared->live_normalizer == nullptr) != (previous->live_normalizer == nullptr) ||
      prepared->kernel_handoff.load(std::memory_order_relaxed) != nullptr ||
      previous->kernel_handoff.load(std::memory_order_relaxed) != nullptr ||
      prepared->defer_convolver_retirement) {
    return 0;
  }
  if (prepared->settings.denoise.enabled != 0 || previous->settings.denoise.enabled != 0) {
    // Incompatible restoration keeps its freshly prepared state. It must not
    // discard the level learned by the input Normalizer or unrelated delays.
    feq_denoise_transfer_state(prepared->denoise, previous->denoise);
  }
  transfer_histories(*prepared, *previous);
  transfer_convolvers(*prepared, *previous);
  return 1;
}

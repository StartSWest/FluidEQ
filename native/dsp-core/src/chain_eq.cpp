/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"

#include <algorithm>
#include <cmath>

namespace {

/**
 * Pass a dry reference through one identity oversampling round trip.
 *
 * A plain integer delay is not enough at 4x: the two half-band stages have a
 * half-sample group delay and their skirts are part of the result. Running the
 * same filters is the only sample-for-sample reference for what reaches the
 * processed path — and the isolate monitor is a subtraction, so a reference
 * half a sample early leaves a comb filter behind instead of silence.
 */
void match_oversampling(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        FeqOversampler* state,
                        uint32_t factor,
                        float* work) {
  feq_oversample_up(state, target, work, frames, factor,
                    chain->eq_middle.data());
  feq_oversample_down(state, work, target, frames, factor,
                      chain->eq_middle.data());
}

uint32_t live_band_count(const FeqChain* chain) {
  return static_cast<uint32_t>(chain->coefficients.size());
}

uint32_t dynamic_band_count(const FeqChain* chain) {
  return static_cast<uint32_t>(chain->dynamic_coefficients.size());
}

/** Copy the dynamic bands' shared state into the contiguous scratch. */
void gather_dynamic(FeqChain* chain) {
  const uint32_t live = live_band_count(chain);
  const uint32_t count = dynamic_band_count(chain);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    for (uint32_t index = 0; index < count; ++index) {
      const size_t from =
          static_cast<size_t>(channel) * live + chain->dynamic_slots[index];
      const size_t to = static_cast<size_t>(channel) * count + index;
      chain->dynamic_states[to] = chain->band_states[from];
      chain->dynamic_dynamics[to] = chain->band_dynamics[from];
    }
  }
}

/** And back, so a phase change resumes the envelope rather than restarting it. */
void scatter_dynamic(FeqChain* chain) {
  const uint32_t live = live_band_count(chain);
  const uint32_t count = dynamic_band_count(chain);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    for (uint32_t index = 0; index < count; ++index) {
      const size_t to =
          static_cast<size_t>(channel) * live + chain->dynamic_slots[index];
      const size_t from = static_cast<size_t>(channel) * count + index;
      chain->band_states[to] = chain->dynamic_states[from];
      chain->band_dynamics[to] = chain->dynamic_dynamics[from];
    }
  }
}

/** Capture this EQ domain's isolate references at exact unity input. */
bool prepare_eq_channel(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        uint32_t slot_index) {
  ChainEqSlot& slot = chain->slots[slot_index];
  if (chain->settings.eq.enabled == 0) {
    return false;
  }
  std::copy(target, target + frames, slot.input.begin());
  std::copy(target, target + frames, slot.delayed_input.begin());
  feq_delay_line_process(&slot.isolate_delay, slot.delayed_input.data(),
                         frames);
  if (chain->settings.eq.phase == FEQ_PHASE_MINIMUM &&
      chain->settings.eq.isolate != 0 && chain->convolvers[0] == nullptr) {
    // The monitor is magnitude-matched, and there is nothing to match against
    // until a kernel exists. Silence is honest; the dry signal is not.
    std::fill(target, target + frames, 0.0f);
    slot.dry_mix = 0.0;
    return false;
  }
  return true;
}

/** Run one already-prepared channel through the current linear convolver. */
void process_eq_convolver_channel(FeqChain* chain,
                                  float* target,
                                  uint32_t frames,
                                  uint32_t slot_index) {
  FeqConvolver* active = chain->convolvers[slot_index];
  FeqConvolver* next = chain->convolvers_next[slot_index];
  if (next != nullptr && chain->convolver_warmup <= 0) {
    chain->convolver_blend[slot_index] = feq_convolve_blend(
        active, next, target, chain->convolver_scratch.data(), frames,
        chain->convolver_blend[slot_index], 1.0 / 1024.0);
    return;
  }
  if (next != nullptr) {
    // Both run while the replacement fills its partitions. Only the active one
    // is heard, but a convolver started cold at the fade's first sample would
    // fade in from an empty tail, which is the click this prevents.
    std::copy(target, target + frames, chain->convolver_scratch.begin());
    feq_convolve(active, target, frames);
    feq_convolve(next, chain->convolver_scratch.data(), frames);
    return;
  }
  feq_convolve(active, target, frames);
}

/** Fuzz, and the latency-matched isolate subtraction after all EQ bands. */
void finish_eq_channel(FeqChain* chain,
                       float* target,
                       uint32_t frames,
                       uint32_t slot_index) {
  ChainEqSlot& slot = chain->slots[slot_index];
  const FeqChainEqSettings& eq = chain->settings.eq;
  if (eq.fuzz_amount > 0.0) {
    feq_saturate_block(&slot.fuzz, target, frames,
                       feq_fuzz_drive(eq.fuzz_amount),
                       feq_fuzz_blend(eq.fuzz_amount), chain->sample_rate,
                       chain->fuzz_oversampled.data(),
                       chain->fuzz_middle.data());
  }

  if (eq.phase == FEQ_PHASE_MINIMUM && eq.isolate != 0 &&
      chain->convolver_priming > 0) {
    std::fill(target, target + frames, 0.0f);
    slot.dry_mix = 0.0;
    return;
  }

  const double dry_target = eq.isolate != 0 ? 0.0 : 1.0;
  double dry_mix = slot.dry_mix;
  const double smooth = 1.0 - std::exp(-1.0 / ((kEqIsolateSmoothingMs / 1000.0) *
                                               chain->sample_rate));
  const bool linear = chain_linear_running(chain) != 0;
  float* reference = linear ? slot.delayed_input.data() : slot.input.data();
  if (!linear && eq.oversample > 1) {
    match_oversampling(chain, reference, frames, &slot.isolate_oversampler,
                       eq.oversample, slot.isolate_oversampled.data());
  }
  if (eq.fuzz_amount > 0.0) {
    match_oversampling(chain, reference, frames,
                       &slot.isolate_colour_oversampler, 4,
                       slot.isolate_oversampled.data());
  }
  for (uint32_t at = 0; at < frames; ++at) {
    dry_mix += (dry_target - dry_mix) * smooth;
    target[at] = static_cast<float>(
        static_cast<double>(target[at]) -
        static_cast<double>(reference[at]) * (1.0 - dry_mix));
  }
  if (std::fabs(dry_target - dry_mix) < 0.0001) {
    dry_mix = dry_target;
  }
  slot.dry_mix = dry_mix;
}

/** One selected L/R/M/S EQ domain. */
void process_eq_channel(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        uint32_t slot_index) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  if (!prepare_eq_channel(chain, target, frames, slot_index)) {
    return;
  }
  ChainEqSlot& slot = chain->slots[slot_index];
  const uint32_t live = live_band_count(chain);
  const uint32_t dynamic = dynamic_band_count(chain);
  const size_t base = static_cast<size_t>(slot_index) * live;

  if (chain_linear_running(chain) != 0) {
    process_eq_convolver_channel(chain, target, frames, slot_index);
    if (dynamic > 0) {
      gather_dynamic(chain);
      const size_t dynamic_base = static_cast<size_t>(slot_index) * dynamic;
      feq_eq_process_bands(chain->dynamic_states.data() + dynamic_base,
                           chain->dynamic_coefficients.data(), dynamic, target,
                           frames, eq.engine, chain->eq_dry.data(),
                           chain->eq_wet.data(),
                           chain->dynamic_dynamics.data() + dynamic_base);
      scatter_dynamic(chain);
    }
  } else {
    if (chain->has_subsonic != 0) {
      feq_biquad_process(&slot.subsonic, target, frames,
                         &chain->subsonic_coefficients);
    }
    if (eq.oversample > 1) {
      feq_eq_process_oversampled(
          chain->band_states.data() + base, chain->coefficients.data(), live,
          target, frames, eq.engine, &slot.eq_oversampler, eq.oversample,
          chain->eq_doubled.data(), chain->eq_dry_doubled.data(),
          chain->eq_wet_doubled.data(), chain->eq_middle.data(),
          live == 0 ? nullptr : chain->band_dynamics.data() + base);
    } else {
      feq_eq_process_bands(
          chain->band_states.data() + base, chain->coefficients.data(), live,
          target, frames, eq.engine, chain->eq_dry.data(),
          chain->eq_wet.data(),
          live == 0 ? nullptr : chain->band_dynamics.data() + base);
    }
  }
  finish_eq_channel(chain, target, frames, slot_index);
}

/** Stereo mode: one dynamic amount per band, applied to both domains. */
void process_eq_stereo(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  const uint32_t channel_count = chain->channels < FEQ_CHAIN_CHANNELS
                                     ? chain->channels
                                     : FEQ_CHAIN_CHANNELS;
  if (eq.enabled == 0 || channel_count < 2) {
    return;
  }
  bool ready = true;
  for (uint32_t channel = 0; channel < channel_count; ++channel) {
    ready = prepare_eq_channel(chain, channels[channel], frames, channel) &&
            ready;
  }
  if (!ready) {
    return;
  }
  const uint32_t live = live_band_count(chain);
  const uint32_t dynamic = dynamic_band_count(chain);

  if (chain_linear_running(chain) != 0) {
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      process_eq_convolver_channel(chain, channels[channel], frames, channel);
    }
    if (dynamic > 0) {
      gather_dynamic(chain);
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->pointers_a[channel] = chain->linked_dry[channel].data();
        chain->pointers_b[channel] = chain->linked_wet[channel].data();
      }
      feq_eq_process_bands_linked(
          chain->dynamic_states.data(), chain->dynamic_coefficients.data(),
          dynamic, channels, channel_count, frames, eq.engine,
          chain->pointers_a, chain->pointers_b,
          chain->dynamic_dynamics.data());
      scatter_dynamic(chain);
    }
  } else {
    if (chain->has_subsonic != 0) {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        feq_biquad_process(&chain->slots[channel].subsonic, channels[channel],
                           frames, &chain->subsonic_coefficients);
      }
    }
    if (eq.oversample > 1) {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->pointers_a[channel] = chain->linked_doubled[channel].data();
        chain->pointers_b[channel] = chain->linked_dry_doubled[channel].data();
        chain->pointers_c[channel] = chain->linked_wet_doubled[channel].data();
        chain->pointers_d[channel] = chain->linked_middle[channel].data();
      }
      FeqOversampler oversamplers[FEQ_CHAIN_CHANNELS] = {
          chain->slots[0].eq_oversampler, chain->slots[1].eq_oversampler};
      feq_eq_process_oversampled_linked(
          chain->band_states.data(), chain->coefficients.data(), live, channels,
          channel_count, frames, eq.engine, oversamplers, eq.oversample,
          chain->pointers_a, chain->pointers_b, chain->pointers_c,
          chain->pointers_d,
          live == 0 ? nullptr : chain->band_dynamics.data());
      chain->slots[0].eq_oversampler = oversamplers[0];
      chain->slots[1].eq_oversampler = oversamplers[1];
    } else {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->pointers_a[channel] = chain->linked_dry[channel].data();
        chain->pointers_b[channel] = chain->linked_wet[channel].data();
      }
      feq_eq_process_bands_linked(
          chain->band_states.data(), chain->coefficients.data(), live, channels,
          channel_count, frames, eq.engine, chain->pointers_a,
          chain->pointers_b,
          live == 0 ? nullptr : chain->band_dynamics.data());
    }
  }

  // The second domain's detectors mirror the first: one decision was made, and
  // a meter showing two would suggest the band opened on one side only.
  for (uint32_t index = 0; index < live; ++index) {
    chain->band_dynamics[static_cast<size_t>(live) + index].envelope =
        chain->band_dynamics[index].envelope;
    chain->band_dynamics[static_cast<size_t>(live) + index].amount =
        chain->band_dynamics[index].amount;
  }
  for (uint32_t channel = 0; channel < channel_count; ++channel) {
    finish_eq_channel(chain, channels[channel], frames, channel);
  }
}

/**
 * Advance the replacement convolver's warm-up, and retire the old one.
 *
 * A decision about the pair, not about a channel: a handover that completed
 * for the left and not the right puts the two on different filters, which is a
 * collapsed image rather than a click.
 */
void settle_convolvers(FeqChain* chain, uint32_t frames) {
  chain->convolver_priming -= static_cast<int64_t>(frames);
  if (chain->convolver_priming < 0) {
    chain->convolver_priming = 0;
  }
  if (chain->convolvers_next[0] == nullptr) {
    return;
  }
  if (chain->convolver_warmup > 0) {
    chain->convolver_warmup -= static_cast<int64_t>(frames);
    return;
  }
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    if (chain->convolver_blend[channel] < 1.0) {
      return;
    }
  }
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    feq_convolver_destroy(chain->convolvers[channel]);
    chain->convolvers[channel] = chain->convolvers_next[channel];
    chain->convolvers_next[channel] = nullptr;
  }
  feq_convolver_kernel_destroy(chain->kernel);
  chain->kernel = chain->kernel_next;
  chain->kernel_next = nullptr;
}

}  // namespace

int chain_linear_running(const FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  return eq.enabled != 0 && (eq.phase == FEQ_PHASE_LINEAR || eq.isolate != 0) &&
                 chain->convolvers[0] != nullptr
             ? 1
             : 0;
}

void chain_refresh_eq(FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  // Oversampling runs the cascade at twice the rate, so its filters have to be
  // DESIGNED for that rate. Handing it the ordinary set would place every band
  // an octave low — a bug rather than a mode.
  const double design_rate = chain->sample_rate * eq.oversample;

  // Built at the base rate, because they run BEFORE the oversampler: a high
  // pass whose job is to keep energy out has nothing to gain from being
  // inside, and doing it first means the oversampler carries less.
  chain->has_mono_below = eq.mono_below_hz > 0.0 ? 1 : 0;
  if (chain->has_mono_below != 0) {
    chain->mono_below_coefficients = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, eq.mono_below_hz, 0.0, 0.707, chain->sample_rate);
  }
  chain->has_subsonic = eq.subsonic_hz > 0.0 ? 1 : 0;
  if (chain->has_subsonic != 0) {
    chain->subsonic_coefficients = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, eq.subsonic_hz, 0.0, 0.707, chain->sample_rate);
  }

  chain->coefficients.clear();
  chain->dynamic_slots.clear();
  chain->dynamic_coefficients.clear();
  std::vector<const FeqChainEqBand*> live;
  for (uint32_t index = 0; index < eq.band_count; ++index) {
    const FeqChainEqBand& band = eq.bands[index];
    if (band.enabled == 0) {
      continue;
    }
    live.push_back(&band);
    chain->coefficients.push_back(feq_biquad_coefficients_modelled(
        band.type, band.frequency, band.gain_db, band.quality, design_rate,
        eq.model, eq.model_amount));
  }
  for (uint32_t index = 0; index < live.size(); ++index) {
    if (live[index]->dynamic != 0) {
      chain->dynamic_slots.push_back(index);
      const FeqChainEqBand& band = *live[index];
      // Built at the base rate, not the design rate: these run after the
      // convolution, which is base rate, and never inside the oversampler.
      chain->dynamic_coefficients.push_back(feq_biquad_coefficients_modelled(
          band.type, band.frequency, band.gain_db, band.quality,
          chain->sample_rate, eq.model, eq.model_amount));
    }
  }

  const size_t count = live.size();
  const size_t total = count * FEQ_CHAIN_CHANNELS;
  // Grown rather than rebuilt: the filter history IS the last few milliseconds
  // of audio, and clearing it because a neighbouring band moved is a click on
  // every drag.
  while (chain->band_states.size() < total) {
    FeqBiquadState state;
    feq_biquad_reset(&state);
    chain->band_states.push_back(state);
    FeqBandDynamics dynamics;
    feq_band_dynamics_init(&dynamics);
    chain->band_dynamics.push_back(dynamics);
  }
  chain->band_states.resize(total);
  chain->band_dynamics.resize(total);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    for (size_t index = 0; index < count; ++index) {
      feq_band_dynamics_refresh(
          &chain->band_dynamics[static_cast<size_t>(channel) * count + index],
          eq.enabled, live[index]->enabled, live[index]->dynamic,
          live[index]->gain_db, live[index]->threshold_db, chain->sample_rate);
    }
  }

  const size_t dynamic_total =
      chain->dynamic_coefficients.size() * FEQ_CHAIN_CHANNELS;
  chain->dynamic_states.assign(dynamic_total, FeqBiquadState{});
  chain->dynamic_dynamics.assign(dynamic_total, FeqBandDynamics{});
  for (auto& state : chain->dynamic_states) {
    feq_biquad_reset(&state);
  }
  for (auto& dynamics : chain->dynamic_dynamics) {
    feq_band_dynamics_init(&dynamics);
  }
}

void chain_process_eq(FeqChain* chain, float* const* channels,
                      uint32_t frames) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  /**
   * Mid/side wraps the whole loop rather than sitting inside it.
   *
   * Mid is what both speakers share and side is what they differ by, so
   * neither exists in one channel: the sum and the difference have to be taken
   * across the pair before anything is filtered, and undone after.
   */
  const bool mid_side =
      (eq.stereo != FEQ_STEREO_STEREO || eq.mono_below_hz > 0.0) &&
      chain->channels >= 2;
  if (mid_side) {
    chain_encode_mid_side(channels, frames);
  }

  if (eq.stereo == FEQ_STEREO_STEREO && chain->channels >= 2) {
    process_eq_stereo(chain, channels, frames);
  } else {
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      // In mid/side the two slots are no longer left and right: slot 0 carries
      // the middle and slot 1 the difference, and only the chosen one is
      // filtered. The other passes untouched, which is what makes this a tool
      // rather than a different way of spelling stereo.
      const bool skip =
          mid_side && ((eq.stereo == FEQ_STEREO_MID && channel == 1) ||
                       (eq.stereo == FEQ_STEREO_SIDE && channel == 0));
      const uint32_t slot_index =
          channel < FEQ_CHAIN_CHANNELS ? channel : FEQ_CHAIN_CHANNELS - 1;
      if (!skip) {
        process_eq_channel(chain, channels[channel], frames, slot_index);
        continue;
      }
      ChainEqSlot& slot = chain->slots[slot_index];
      // Keep this domain's isolate reference current even while it is the half
      // the selected mid/side mode passes through untouched.
      std::copy(channels[channel], channels[channel] + frames,
                slot.delayed_input.begin());
      feq_delay_line_process(&slot.isolate_delay, slot.delayed_input.data(),
                             frames);
      if (chain_linear_running(chain) != 0) {
        // Untouched, but exactly as late as the half that went through the
        // convolver. Without this the decode below recombines two signals
        // 181 ms apart.
        feq_delay_line_process(&slot.bypass_delay, channels[channel], frames);
      }
      if (eq.enabled == 0) {
        continue;
      }
      // The unselected half contributes nothing. Fade that dry-only domain out
      // under isolate rather than leaving it audible beside the selected
      // domain's difference signal.
      if (eq.phase == FEQ_PHASE_MINIMUM && eq.isolate != 0 &&
          (chain->convolvers[0] == nullptr || chain->convolver_priming > 0)) {
        std::fill(channels[channel], channels[channel] + frames, 0.0f);
        slot.dry_mix = 0.0;
        continue;
      }
      const double dry_target = eq.isolate != 0 ? 0.0 : 1.0;
      double dry_mix = slot.dry_mix;
      const double smooth =
          1.0 - std::exp(-1.0 / ((kEqIsolateSmoothingMs / 1000.0) *
                                 chain->sample_rate));
      for (uint32_t at = 0; at < frames; ++at) {
        dry_mix += (dry_target - dry_mix) * smooth;
        channels[channel][at] = static_cast<float>(
            static_cast<double>(channels[channel][at]) * dry_mix);
      }
      if (std::fabs(dry_target - dry_mix) < 0.0001) {
        dry_mix = dry_target;
      }
      slot.dry_mix = dry_mix;
    }
  }

  settle_convolvers(chain, frames);

  /**
   * The phase-cancellation fix, applied to the side channel only.
   *
   * Bass out of phase between the two channels vanishes the moment they are
   * summed — a phone speaker, a mono PA and most Bluetooth speakers all do
   * that — so a mix can sound enormous on headphones and gutless everywhere
   * else. High-passing the SIDE removes the part that can cancel and leaves
   * the middle whole. Above the corner the image is untouched: width is worth
   * keeping wherever it cannot cancel.
   */
  if (mid_side && chain->has_mono_below != 0) {
    feq_biquad_process(&chain->side_highpass, channels[1], frames,
                       &chain->mono_below_coefficients);
  }
  if (mid_side) {
    chain_decode_mid_side(channels, frames);
  }
}

extern "C" {

void feq_chain_set_eq_kernel(FeqChain* chain,
                             const float* kernel,
                             uint32_t length) {
  if (chain == nullptr) {
    return;
  }
  if (kernel == nullptr || length == 0) {
    for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
      feq_convolver_destroy(chain->convolvers[channel]);
      feq_convolver_destroy(chain->convolvers_next[channel]);
      chain->convolvers[channel] = nullptr;
      chain->convolvers_next[channel] = nullptr;
    }
    feq_convolver_kernel_destroy(chain->kernel);
    feq_convolver_kernel_destroy(chain->kernel_next);
    chain->kernel = nullptr;
    chain->kernel_next = nullptr;
    chain->convolver_priming = 0;
    return;
  }

  FeqConvolverKernel* prepared = feq_convolver_kernel_create(kernel, length);
  if (prepared == nullptr) {
    return;
  }
  if (chain->convolvers[0] == nullptr) {
    // Nothing playing through one yet, so there is nothing to fade from.
    chain->kernel = prepared;
    for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
      chain->convolvers[channel] = feq_convolver_create(prepared);
    }
    chain->convolver_priming = feq_linear_phase_latency();
    return;
  }
  feq_convolver_kernel_destroy(chain->kernel_next);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    feq_convolver_destroy(chain->convolvers_next[channel]);
    chain->convolvers_next[channel] = feq_convolver_create(prepared);
    chain->convolver_blend[channel] = 0.0;
  }
  chain->kernel_next = prepared;
  chain->convolver_warmup = feq_convolver_warmup();
}

}  // extern "C"

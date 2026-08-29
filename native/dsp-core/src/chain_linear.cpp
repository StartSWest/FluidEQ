/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The linear-phase half of the EQ: the convolver, its handover, its kernel.
 *
 * Split from `chain_eq.cpp`, which holds the bands. The seam is real rather
 * than arbitrary — everything here concerns a filter that is a kernel instead
 * of a cascade, and swapping one for another without a click.
 */

#include "chain_internal.h"

#include <algorithm>
#include <new>
#include <vector>

int chain_linear_running(const FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  return eq.enabled != 0 && (eq.phase == FEQ_PHASE_LINEAR || eq.isolate != 0) &&
                 chain->convolvers[0] != nullptr
             ? 1
             : 0;
}

void chain_process_eq_convolver_channel(FeqChain* chain,
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

/**
 * Advance the replacement convolver's warm-up, and retire the old one.
 *
 * A decision about the pair, not about a channel: a handover that completed
 * for the left and not the right puts the two on different filters, which is a
 * collapsed image rather than a click.
 */
void chain_settle_convolvers(FeqChain* chain, uint32_t frames) {
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

namespace {

/**
 * The bands the kernel is made of, in the shape the builder wants.
 *
 * Every band goes in, enabled or not and dynamic or not, because
 * `impulse_response` decides which to bake from those same two flags. Filtering
 * here instead would put a band at a different index than the flags describing
 * it, which is the wrong filter rather than a missing one.
 */
uint32_t kernel_bands_of(const FeqChainEqSettings& eq,
                         FeqLinearPhaseBand* out) {
  const uint32_t count = eq.band_count > FEQ_CHAIN_MAX_EQ_BANDS
                             ? FEQ_CHAIN_MAX_EQ_BANDS
                             : eq.band_count;
  for (uint32_t index = 0; index < count; ++index) {
    const FeqChainEqBand& band = eq.bands[index];
    out[index].enabled = band.enabled;
    out[index].dynamic = band.dynamic;
    out[index].type = band.type;
    out[index].frequency = band.frequency;
    out[index].gain_db = band.gain_db;
    out[index].quality = band.quality;
  }
  return count;
}

/** Whether a kernel is wanted at all — `chain_linear_running`'s own test. */
int kernel_wanted_by(const FeqChainEqSettings& eq) {
  return eq.enabled != 0 && (eq.phase == FEQ_PHASE_LINEAR || eq.isolate != 0)
             ? 1
             : 0;
}

bool same_band(const FeqLinearPhaseBand& left, const FeqLinearPhaseBand& right) {
  return left.enabled == right.enabled && left.dynamic == right.dynamic &&
         left.type == right.type && left.frequency == right.frequency &&
         left.gain_db == right.gain_db && left.quality == right.quality;
}

/** Free a handoff and everything in it. Whoever the exchange gave it to. */
void discard_handoff(FeqChain::KernelHandoff* handoff) {
  if (handoff == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    feq_convolver_destroy(handoff->convolvers[channel]);
  }
  feq_convolver_kernel_destroy(handoff->kernel);
  delete handoff;
}

/**
 * Publish a handoff, and clear up whichever one the exchange gives back.
 *
 * A stale handoff means the control thread wrote twice before the audio thread
 * read once — a drag turning the same knob faster than blocks go by. The one
 * that comes back was never adopted, so freeing it here is safe and is the only
 * place it can be freed: the audio thread will never see it again.
 */
void publish_handoff(FeqChain* chain, FeqChain::KernelHandoff* fresh) {
  discard_handoff(
      chain->kernel_handoff.exchange(fresh, std::memory_order_acq_rel));
}

}  // namespace

void chain_adopt_kernel_handoff(FeqChain* chain) {
  FeqChain::KernelHandoff* taken =
      chain->kernel_handoff.exchange(nullptr, std::memory_order_acquire);
  if (taken == nullptr) {
    return;
  }
  if (taken->kernel == nullptr) {
    // Linear phase switched off, or the rack emptied. Everything goes,
    // including anything mid-handover: there is no filter to fade towards.
    for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
      feq_convolver_destroy(chain->convolvers[channel]);
      feq_convolver_destroy(chain->convolvers_next[channel]);
      chain->convolvers[channel] = nullptr;
      chain->convolvers_next[channel] = nullptr;
      chain->convolver_blend[channel] = 0.0;
    }
    feq_convolver_kernel_destroy(chain->kernel);
    feq_convolver_kernel_destroy(chain->kernel_next);
    chain->kernel = nullptr;
    chain->kernel_next = nullptr;
    chain->convolver_priming = 0;
    chain->convolver_warmup = 0;
    delete taken;
    return;
  }
  if (chain->convolvers[0] == nullptr) {
    // Nothing playing through one yet, so there is nothing to fade from.
    feq_convolver_kernel_destroy(chain->kernel);
    chain->kernel = taken->kernel;
    for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
      chain->convolvers[channel] = taken->convolvers[channel];
    }
    chain->convolver_priming = feq_linear_phase_latency();
    delete taken;
    return;
  }
  // A replacement was already on its way and has now been overtaken. It never
  // reached the blend, so it is dropped rather than faded away from.
  feq_convolver_kernel_destroy(chain->kernel_next);
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    feq_convolver_destroy(chain->convolvers_next[channel]);
    chain->convolvers_next[channel] = taken->convolvers[channel];
    chain->convolver_blend[channel] = 0.0;
  }
  chain->kernel_next = taken->kernel;
  chain->convolver_warmup = feq_convolver_warmup();
  delete taken;
}

void chain_refresh_eq_kernel(FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  FeqLinearPhaseBand bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};
  const uint32_t count = kernel_bands_of(eq, bands);
  const int wanted = kernel_wanted_by(eq);

  bool moved = wanted != chain->kernel_wanted ||
               count != chain->kernel_band_count ||
               eq.engine != chain->kernel_engine ||
               eq.model != chain->kernel_model ||
               eq.model_amount != chain->kernel_model_amount ||
               eq.subsonic_hz != chain->kernel_subsonic_hz;
  for (uint32_t index = 0; index < count && !moved; ++index) {
    moved = !same_band(bands[index], chain->kernel_bands[index]);
  }
  if (!moved) {
    return;
  }

  chain->kernel_wanted = wanted;
  chain->kernel_band_count = count;
  chain->kernel_engine = eq.engine;
  chain->kernel_model = eq.model;
  chain->kernel_model_amount = eq.model_amount;
  chain->kernel_subsonic_hz = eq.subsonic_hz;
  for (uint32_t index = 0; index < count; ++index) {
    chain->kernel_bands[index] = bands[index];
  }

  if (wanted == 0) {
    feq_chain_set_eq_kernel(chain, nullptr, 0);
    return;
  }

  FeqLinearPhaseRack rack{};
  rack.bands = bands;
  rack.band_count = count;
  rack.engine = eq.engine;
  rack.model = eq.model;
  rack.model_amount = eq.model_amount;
  rack.subsonic_hz = eq.subsonic_hz;

  std::vector<float> kernel(FEQ_LINEAR_PHASE_KERNEL_SIZE, 0.0f);
  feq_build_linear_phase_kernel(&rack, chain->sample_rate, kernel.data());
  feq_chain_set_eq_kernel(chain, kernel.data(), FEQ_LINEAR_PHASE_KERNEL_SIZE);
}

void chain_release_kernel_handoff(FeqChain* chain) {
  discard_handoff(
      chain->kernel_handoff.exchange(nullptr, std::memory_order_acq_rel));
}

extern "C" {

void feq_chain_set_eq_kernel(FeqChain* chain,
                             const float* kernel,
                             uint32_t length) {
  if (chain == nullptr) {
    return;
  }
  if (kernel == nullptr || length == 0) {
    publish_handoff(chain, new (std::nothrow) FeqChain::KernelHandoff());
    return;
  }

  FeqConvolverKernel* prepared = feq_convolver_kernel_create(kernel, length);
  if (prepared == nullptr) {
    return;
  }
  auto* fresh = new (std::nothrow) FeqChain::KernelHandoff();
  if (fresh == nullptr) {
    feq_convolver_kernel_destroy(prepared);
    return;
  }
  fresh->kernel = prepared;
  for (uint32_t channel = 0; channel < FEQ_CHAIN_CHANNELS; ++channel) {
    fresh->convolvers[channel] = feq_convolver_create(prepared);
  }
  publish_handoff(chain, fresh);
}

}  // extern "C"

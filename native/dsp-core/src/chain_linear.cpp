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

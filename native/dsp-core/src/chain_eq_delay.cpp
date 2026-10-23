/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"

#include <algorithm>
#include <cmath>

/**
 * The EQ stage's delay: the round trips it sends the sound on, what it owes
 * the delay the rack reports, and the half it leaves alone in Mid only and
 * Sides only, which has to arrive as late as the half it works on.
 *
 * Measured 2026-10-14 with an impulse: the EQ's oversampling brought the
 * sound back 31 frames late at 2x and 46 at 4x, and its Colour stage 46 more
 * at 48 kHz, and none of it was counted — what Windows was told for video
 * sync, and what the Library's crossfades lined up by, were that much short.
 * In Mid only and Sides only the untouched half was not held back by them
 * either, so a sound on one side came out twice, 0.65 to 1.9 ms apart.
 */

uint32_t chain_eq_colour_factor(const FeqChain* chain) {
  return feq_oversample_factor_for_sample_rate(chain->sample_rate);
}

void chain_eq_round_trip(FeqChain* chain, float* target, uint32_t frames,
                         FeqOversampler* state, uint32_t factor, float* work) {
  feq_oversample_up(state, target, work, frames, factor,
                    chain->eq_middle.data());
  feq_oversample_down(state, work, target, frames, factor,
                      chain->eq_middle.data());
}

void chain_eq_pass_untouched(FeqChain* chain, ChainEqSlot& slot,
                             float* target, uint32_t frames) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  const bool linear = chain_linear_running(chain) != 0;
  // Its isolate reference stays current while it is the half passed
  // through, for the moment it is the worked one again.
  std::copy(target, target + frames, slot.delayed_input.begin());
  feq_delay_line_process(&slot.isolate_delay, slot.delayed_input.data(),
                         frames);
  if (linear) {
    // As late as the half that went through the convolver. Without this the
    // decode recombined two signals 181 ms apart.
    feq_delay_line_process(&slot.bypass_delay, target, frames);
  }
  if (eq.enabled == 0) {
    return;
  }
  // And as late as the oversampler and Colour make the worked half: the
  // same filters with nothing between them, through the slot's own states,
  // so the half carries on from them when it is the worked one again.
  if (!linear && eq.oversample > 1) {
    chain_eq_round_trip(chain, target, frames, &slot.eq_oversampler,
                        eq.oversample, slot.isolate_oversampled.data());
  }
  if (eq.fuzz_amount > 0.0) {
    chain_eq_round_trip(chain, target, frames, &slot.fuzz.oversampler,
                        chain_eq_colour_factor(chain),
                        slot.isolate_oversampled.data());
  }
  // It contributes nothing to what the EQ took, so under Isolate it fades
  // out rather than playing beside the worked half's difference.
  if (eq.phase == FEQ_PHASE_MINIMUM && eq.isolate != 0 &&
      (chain->convolvers[0] == nullptr || chain->convolver_priming > 0)) {
    std::fill(target, target + frames, 0.0f);
    slot.dry_mix = 0.0;
    return;
  }
  const double dry_target = eq.isolate != 0 ? 0.0 : 1.0;
  double dry_mix = slot.dry_mix;
  const double smooth =
      1.0 - std::exp(-1.0 / ((kEqIsolateSmoothingMs / 1000.0) *
                             chain->sample_rate));
  for (uint32_t at = 0; at < frames; ++at) {
    dry_mix += (dry_target - dry_mix) * smooth;
    target[at] =
        static_cast<float>(static_cast<double>(target[at]) * dry_mix);
  }
  if (std::fabs(dry_target - dry_mix) < 0.0001) {
    dry_mix = dry_target;
  }
  slot.dry_mix = dry_mix;
}

uint32_t chain_eq_latency_frames(const FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  const bool linear = chain_linear_running(chain) != 0;
  double frames = linear ? static_cast<double>(feq_linear_phase_latency()) : 0.0;
  if (eq.enabled != 0) {
    if (!linear) {
      frames += feq_oversample_round_trip_frames(eq.oversample);
    }
    if (eq.fuzz_amount > 0.0) {
      frames += feq_oversample_round_trip_frames(chain_eq_colour_factor(chain));
    }
  }
  // A 4x round trip is late by half a frame more than a whole one: the
  // impulse's first sample over half its height is the whole one.
  return static_cast<uint32_t>(std::floor(frames));
}

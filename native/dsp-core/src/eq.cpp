/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The band arrangement, transcribed from `eqEngine.ts`.
 *
 * The one thing that does NOT transcribe literally is the arithmetic width.
 * `target[i] += wet[i] - dry[i]` in JavaScript reads three floats, widens them
 * all to double, evaluates in double, and rounds exactly once when it stores.
 * The same line in C++ over `float` arrays rounds the subtraction and then
 * rounds the addition — twice, at single precision — and the result drifts
 * from the reference by more than the parity tolerance allows across a block.
 *
 * So every mixed expression here is widened by hand. It looks like noise and
 * it is the difference between a port that matches and one that nearly does.
 * The dynamic detector is fed that same widened difference for the same
 * reason: narrowing it would put the envelope on a different trajectory from
 * the reference within a few samples, and an envelope never re-converges.
 */

#include "fluideq/eq.h"

#include <cmath>

namespace {

/**
 * Add to a sample with exactly one rounding, at the store.
 *
 * The whole reason this is a function rather than an expression: written
 * inline it is easy to drop one of the casts, and the result still compiles,
 * still sounds right, and fails parity by a few ULPs a thousand samples later.
 */
inline void target_add(float* target, uint32_t at, double delta) {
  target[at] = static_cast<float>(static_cast<double>(target[at]) + delta);
}

}  // namespace

extern "C" {

void feq_eq_process_bands(FeqBiquadState* states,
                          const FeqBiquadCoefficients* coefficients,
                          uint32_t band_count,
                          float* target,
                          uint32_t frames,
                          FeqEqEngine engine,
                          float* dry,
                          float* wet,
                          FeqBandDynamics* dynamics) {
  if (states == nullptr || coefficients == nullptr || target == nullptr ||
      band_count == 0 || frames == 0) {
    return;
  }
  const bool has_scratch = dry != nullptr && wet != nullptr;

  if (engine == FEQ_EQ_SERIAL) {
    for (uint32_t band = 0; band < band_count; ++band) {
      FeqBandDynamics* dynamic =
          dynamics != nullptr ? &dynamics[band] : nullptr;
      if (dynamic == nullptr || dynamic->active == 0) {
        // Untouched from before dynamics existed: a static band in a cascade
        // filters in place, with no copy and no envelope.
        feq_biquad_process(&states[band], target, frames, &coefficients[band]);
        continue;
      }
      if (!has_scratch) {
        return;
      }
      // A dynamic band in a cascade needs its own input kept, because what is
      // blended is this band's change against what reached it — the previous
      // band's output, not the signal that entered the rack.
      for (uint32_t at = 0; at < frames; ++at) {
        dry[at] = target[at];
        wet[at] = target[at];
      }
      feq_biquad_process(&states[band], wet, frames, &coefficients[band]);
      double peak = 0.0;
      for (uint32_t at = 0; at < frames; ++at) {
        const double difference =
            static_cast<double>(wet[at]) - static_cast<double>(dry[at]);
        const double amount = feq_band_dynamic_amount(dynamic, difference);
        target[at] = static_cast<float>(static_cast<double>(dry[at]) +
                                        difference * amount);
        peak = amount > peak ? amount : peak;
      }
      dynamic->amount = peak;
    }
    return;
  }

  if (!has_scratch) {
    return;
  }

  for (uint32_t at = 0; at < frames; ++at) {
    dry[at] = target[at];
  }
  for (uint32_t band = 0; band < band_count; ++band) {
    for (uint32_t at = 0; at < frames; ++at) {
      wet[at] = dry[at];
    }
    feq_biquad_process(&states[band], wet, frames, &coefficients[band]);
    FeqBandDynamics* dynamic = dynamics != nullptr ? &dynamics[band] : nullptr;

    if (dynamic == nullptr || dynamic->active == 0) {
      for (uint32_t at = 0; at < frames; ++at) {
        // Only what this band CHANGED is added. Summing the bands themselves
        // would stack one copy of the dry signal per band and come out N times
        // too loud.
        const double difference =
            static_cast<double>(wet[at]) - static_cast<double>(dry[at]);
        target[at] =
            static_cast<float>(static_cast<double>(target[at]) + difference);
      }
      continue;
    }

    // The same difference, scaled by how much of the band the material is
    // currently asking for. Parallel needs no extra buffer: the difference the
    // dynamic stage works on is the one already being summed.
    double peak = 0.0;
    for (uint32_t at = 0; at < frames; ++at) {
      const double difference =
          static_cast<double>(wet[at]) - static_cast<double>(dry[at]);
      const double amount = feq_band_dynamic_amount(dynamic, difference);
      target[at] = static_cast<float>(static_cast<double>(target[at]) +
                                      difference * amount);
      peak = amount > peak ? amount : peak;
    }
    dynamic->amount = peak;
  }
}

void feq_eq_process_bands_linked(FeqBiquadState* states,
                                 uint32_t state_stride,
                                 const FeqBiquadCoefficients* coefficients,
                                 uint32_t band_count,
                                 float* const* targets,
                                 uint32_t channels,
                                 uint32_t frames,
                                 FeqEqEngine engine,
                                 float* const* dry,
                                 float* const* wet,
                                 FeqBandDynamics* dynamics) {
  if (states == nullptr || coefficients == nullptr || targets == nullptr ||
      dry == nullptr || wet == nullptr || band_count == 0 || channels == 0 ||
      frames == 0) {
    return;
  }

  /** The loudest channel's change at this sample, keeping its sign. */
  const auto detector = [&](uint32_t frame) {
    double loudest = 0.0;
    for (uint32_t channel = 0; channel < channels; ++channel) {
      const double difference = static_cast<double>(wet[channel][frame]) -
                                static_cast<double>(dry[channel][frame]);
      if (std::fabs(difference) > std::fabs(loudest)) {
        loudest = difference;
      }
    }
    return loudest;
  };

  if (engine == FEQ_EQ_SERIAL) {
    for (uint32_t band = 0; band < band_count; ++band) {
      FeqBandDynamics* dynamic =
          dynamics != nullptr ? &dynamics[band] : nullptr;
      if (dynamic == nullptr || dynamic->active == 0) {
        for (uint32_t channel = 0; channel < channels; ++channel) {
          feq_biquad_process(&states[channel * state_stride + band],
                             targets[channel], frames, &coefficients[band]);
        }
        continue;
      }
      for (uint32_t channel = 0; channel < channels; ++channel) {
        for (uint32_t at = 0; at < frames; ++at) {
          dry[channel][at] = targets[channel][at];
          wet[channel][at] = targets[channel][at];
        }
        feq_biquad_process(&states[channel * state_stride + band], wet[channel],
                           frames, &coefficients[band]);
      }
      double peak = 0.0;
      for (uint32_t at = 0; at < frames; ++at) {
        const double amount = feq_band_dynamic_amount(dynamic, detector(at));
        for (uint32_t channel = 0; channel < channels; ++channel) {
          const double difference = static_cast<double>(wet[channel][at]) -
                                    static_cast<double>(dry[channel][at]);
          targets[channel][at] = static_cast<float>(
              static_cast<double>(dry[channel][at]) + difference * amount);
        }
        peak = amount > peak ? amount : peak;
      }
      dynamic->amount = peak;
    }
    return;
  }

  for (uint32_t channel = 0; channel < channels; ++channel) {
    for (uint32_t at = 0; at < frames; ++at) {
      dry[channel][at] = targets[channel][at];
    }
  }
  for (uint32_t band = 0; band < band_count; ++band) {
    for (uint32_t channel = 0; channel < channels; ++channel) {
      for (uint32_t at = 0; at < frames; ++at) {
        wet[channel][at] = dry[channel][at];
      }
      feq_biquad_process(&states[channel * state_stride + band], wet[channel],
                         frames, &coefficients[band]);
    }
    FeqBandDynamics* dynamic = dynamics != nullptr ? &dynamics[band] : nullptr;
    if (dynamic == nullptr || dynamic->active == 0) {
      for (uint32_t channel = 0; channel < channels; ++channel) {
        for (uint32_t at = 0; at < frames; ++at) {
          const double difference = static_cast<double>(wet[channel][at]) -
                                    static_cast<double>(dry[channel][at]);
          target_add(targets[channel], at, difference);
        }
      }
      continue;
    }
    double peak = 0.0;
    for (uint32_t at = 0; at < frames; ++at) {
      const double amount = feq_band_dynamic_amount(dynamic, detector(at));
      for (uint32_t channel = 0; channel < channels; ++channel) {
        const double difference = static_cast<double>(wet[channel][at]) -
                                  static_cast<double>(dry[channel][at]);
        target_add(targets[channel], at, difference * amount);
      }
      peak = amount > peak ? amount : peak;
    }
    dynamic->amount = peak;
  }
}

void feq_eq_process_oversampled(FeqBiquadState* states,
                                const FeqBiquadCoefficients* coefficients,
                                uint32_t band_count,
                                float* target,
                                uint32_t frames,
                                FeqEqEngine engine,
                                FeqOversampler* oversampler,
                                uint32_t factor,
                                float* doubled,
                                float* dry_doubled,
                                float* wet_doubled,
                                float* middle,
                                FeqBandDynamics* dynamics) {
  if (oversampler == nullptr || doubled == nullptr || factor == 0) {
    return;
  }
  feq_oversample_up(oversampler, target, doubled, frames, factor, middle);
  feq_eq_process_bands(states, coefficients, band_count, doubled,
                       frames * factor, engine, dry_doubled, wet_doubled,
                       dynamics);
  feq_oversample_down(oversampler, doubled, target, frames, factor, middle);
}

void feq_eq_process_oversampled_linked(FeqBiquadState* states,
                                       uint32_t state_stride,
                                       const FeqBiquadCoefficients* coeffs,
                                       uint32_t band_count,
                                       float* const* targets,
                                       uint32_t channels,
                                       uint32_t frames,
                                       FeqEqEngine engine,
                                       FeqOversampler* oversamplers,
                                       uint32_t factor,
                                       float* const* doubled,
                                       float* const* dry_doubled,
                                       float* const* wet_doubled,
                                       float* const* middle,
                                       FeqBandDynamics* dynamics) {
  if (oversamplers == nullptr || doubled == nullptr || targets == nullptr ||
      channels == 0 || factor == 0) {
    return;
  }
  for (uint32_t channel = 0; channel < channels; ++channel) {
    feq_oversample_up(&oversamplers[channel], targets[channel],
                      doubled[channel], frames, factor,
                      middle != nullptr ? middle[channel] : nullptr);
  }
  feq_eq_process_bands_linked(states, state_stride, coeffs, band_count, doubled,
                              channels,
                              frames * factor, engine, dry_doubled,
                              wet_doubled, dynamics);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    feq_oversample_down(&oversamplers[channel], doubled[channel],
                        targets[channel], frames, factor,
                        middle != nullptr ? middle[channel] : nullptr);
  }
}

}  // extern "C"

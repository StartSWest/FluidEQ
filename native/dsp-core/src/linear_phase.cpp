/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/linear_phase.h"
#include "fluideq/convolver.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace {

constexpr uint32_t kSize = FEQ_LINEAR_PHASE_KERNEL_SIZE;

/** The rack's response to a unit impulse, built the way the rack runs. */
std::vector<float> impulse_response(const FeqLinearPhaseRack* rack,
                                    double sample_rate) {
  std::vector<float> dry(kSize, 0.0f);
  dry[0] = 1.0f;
  std::vector<float> buffer = dry;
  std::vector<float> wet(kSize, 0.0f);

  for (uint32_t index = 0; index < rack->band_count; ++index) {
    const FeqLinearPhaseBand& band = rack->bands[index];
    if (band.enabled == 0 || band.dynamic != 0) {
      continue;
    }
    const FeqBiquadCoefficients coefficients = feq_biquad_coefficients_designed(
        band.type, band.frequency, band.gain_db, band.quality, sample_rate,
        rack->model, rack->model_amount, rack->matched);

    FeqBiquadState state;
    feq_biquad_reset(&state);
    if (rack->engine == FEQ_EQ_SERIAL) {
      feq_biquad_process(&state, buffer.data(), kSize, &coefficients);
      continue;
    }
    /**
     * Parallel is built the way it runs, not approximated.
     *
     * The topology was once silently ignored here: an impulse pushed through a
     * cascade IS the serial arrangement, so choosing parallel and linear phase
     * together produced a serial kernel with no sign of it. They do not make
     * the same curve — overlapping bands add in one and multiply in the other.
     */
    wet = dry;
    feq_biquad_process(&state, wet.data(), kSize, &coefficients);
    for (uint32_t at = 0; at < kSize; ++at) {
      buffer[at] = static_cast<float>(static_cast<double>(buffer[at]) +
                                      (static_cast<double>(wet[at]) -
                                       static_cast<double>(dry[at])));
    }
  }

  if (rack->subsonic_hz > 0.0) {
    /**
     * The subsonic filter belongs in the kernel, and takes no character model.
     *
     * It is part of what the rack does — a protective filter that switched
     * itself off when the phase mode changed would be worse than one never
     * offered. `HPQ` carries no gain, so every model collapses to the cookbook
     * here; the reference reaches the same coefficients through the modelled
     * call with its amount left at the default.
     */
    const FeqBiquadCoefficients subsonic = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, rack->subsonic_hz, 0.0, 0.707, sample_rate);
    FeqBiquadState state;
    feq_biquad_reset(&state);
    feq_biquad_process(&state, buffer.data(), kSize, &subsonic);
  }
  return buffer;
}

/** The magnitude of an impulse response's spectrum, bin by bin. */
std::vector<double> magnitude_of(const std::vector<float>& impulse) {
  std::vector<double> real(kSize, 0.0);
  std::vector<double> imaginary(kSize, 0.0);
  for (uint32_t at = 0; at < kSize; ++at) {
    real[at] = static_cast<double>(impulse[at]);
  }
  feq_fft_in_place(real.data(), imaginary.data(), kSize, 0);
  for (uint32_t bin = 0; bin < kSize; ++bin) {
    real[bin] = std::hypot(real[bin], imaginary[bin]);
  }
  return real;
}

/**
 * A real spectrum back to a causal kernel.
 *
 * Real and symmetric going in, so what the inverse returns is real and
 * symmetric too. The inverse leaves the 1/N to the caller, and its impulse is
 * centred on sample zero with the second half wrapped to the end. Rotating by
 * half puts the centre in the middle, which is what makes the filter causal
 * and where every sample of the latency comes from.
 */
void kernel_from_spectrum(std::vector<double>& real, float* kernel) {
  std::vector<double> imaginary(kSize, 0.0);
  feq_fft_in_place(real.data(), imaginary.data(), kSize, 1);
  const uint32_t half = kSize / 2;
  for (uint32_t at = 0; at < kSize; ++at) {
    kernel[at] = static_cast<float>(real[(at + half) % kSize] / kSize);
  }
}

}  // namespace

extern "C" {

uint32_t feq_linear_phase_latency(void) {
  return FEQ_LINEAR_PHASE_KERNEL_LATENCY + feq_convolver_latency();
}

void feq_build_linear_phase_kernel(const FeqLinearPhaseRack* rack,
                                   double sample_rate,
                                   float* kernel) {
  if (rack == nullptr || kernel == nullptr) {
    return;
  }
  // Throw the phase away and keep the magnitude.
  std::vector<double> magnitude =
      magnitude_of(impulse_response(rack, sample_rate));
  kernel_from_spectrum(magnitude, kernel);
}

void feq_build_linear_phase_change_kernel(const FeqLinearPhaseRack* rack,
                                          uint32_t band,
                                          double sample_rate,
                                          float* kernel) {
  if (rack == nullptr || kernel == nullptr) {
    return;
  }
  std::fill(kernel, kernel + kSize, 0.0f);
  if (band >= rack->band_count || rack->bands[band].enabled == 0) {
    return;
  }
  const FeqLinearPhaseBand& chosen = rack->bands[band];
  // Designed exactly as the rack's own bands are, so the band sounds the same
  // whether it is static inside the rack's kernel or dynamic beside it.
  const FeqBiquadCoefficients coefficients = feq_biquad_coefficients_designed(
      chosen.type, chosen.frequency, chosen.gain_db, chosen.quality,
      sample_rate, rack->model, rack->model_amount, rack->matched);
  std::vector<float> alone(kSize, 0.0f);
  alone[0] = 1.0f;
  FeqBiquadState state;
  feq_biquad_reset(&state);
  feq_biquad_process(&state, alone.data(), kSize, &coefficients);

  // On top of the static rack rather than beside it: the band hears what the
  // rack's other bands have already done, as it did running after the kernel.
  std::vector<double> change =
      magnitude_of(impulse_response(rack, sample_rate));
  const std::vector<double> own = magnitude_of(alone);
  for (uint32_t bin = 0; bin < kSize; ++bin) {
    change[bin] *= own[bin] - 1.0;
  }
  kernel_from_spectrum(change, kernel);
}

}  // extern "C"

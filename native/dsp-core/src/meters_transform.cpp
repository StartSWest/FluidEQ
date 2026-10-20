/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "meters_transform.h"

#include <cmath>

#include "fluideq/convolver.h"

std::vector<double> meter_blackman(uint32_t size) {
  std::vector<double> window(size);
  constexpr double kAlpha = 0.16;
  const double a0 = (1.0 - kAlpha) / 2.0;
  const double a1 = 0.5;
  const double a2 = kAlpha / 2.0;
  for (uint32_t at = 0; at < size; at += 1) {
    const double phase = (2.0 * 3.14159265358979323846 * at) / (size - 1);
    window[at] = a0 - a1 * std::cos(phase) + a2 * std::cos(2.0 * phase);
  }
  return window;
}

void meter_two_channel_magnitudes(double* real,
                                  double* imaginary,
                                  uint32_t size,
                                  uint32_t bins,
                                  double* out_magnitudes) {
  feq_fft_in_place(real, imaginary, size, 0);
  const double scale = 0.25 / static_cast<double>(size);
  for (uint32_t bin = 0; bin < bins; bin += 1) {
    // Z = FFT(l + i r): L[k] = (Z[k] + conj Z[-k]) / 2 and
    // R[k] = (Z[k] - conj Z[-k]) / 2i, so each magnitude is half of one sum.
    const uint32_t mirror = bin == 0 ? 0 : size - bin;
    const double zr = real[bin];
    const double zi = imaginary[bin];
    const double wr = real[mirror];
    const double wi = imaginary[mirror];
    const double left = std::hypot(zr + wr, zi - wi);
    const double right = std::hypot(zr - wr, zi + wi);
    // 0.5 for the channels' average, 0.5 for each recovered spectrum.
    out_magnitudes[bin] = scale * (left + right);
  }
}

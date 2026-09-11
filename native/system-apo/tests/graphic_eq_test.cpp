/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `design_graphic_kernel`, held to a direct DTFT evaluated over the kernel's
 * own taps — the ground truth, independent of the FFT the design itself
 * uses, so a bug shared between the two could not hide from this test.
 */

#include "../src/graphic_eq.h"

#include <cmath>
#include <cstdio>
#include <vector>

#include "fluideq_engine/config.h"

using fluideq_engine::design_graphic_kernel;
using fluideq_engine::GraphicPoint;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

constexpr double kPi = 3.14159265358979323846;

// |H(f)| in dB by direct summation, the textbook DTFT definition — not the
// FFT `design_graphic_kernel` itself is built on, so this cannot pass by
// sharing the same mistake.
double dtft_magnitude_db(const std::vector<float>& kernel, double hz,
                         double rate) {
  double real = 0.0;
  double imaginary = 0.0;
  for (size_t i = 0; i < kernel.size(); ++i) {
    const double angle = -2.0 * kPi * hz * static_cast<double>(i) / rate;
    real += static_cast<double>(kernel[i]) * std::cos(angle);
    imaginary += static_cast<double>(kernel[i]) * std::sin(angle);
  }
  return 20.0 * std::log10(std::hypot(real, imaginary));
}

void symmetric_and_matches_the_target_curve() {
  std::printf("symmetric taps, on target at 1 kHz and 100 Hz\n");
  const std::vector<GraphicPoint> points = {
      {20.0, 0.0}, {1000.0, -12.0}, {20000.0, 0.0}};
  constexpr uint32_t kRate = 48000;
  const auto kernel = design_graphic_kernel({points}, kRate, 4097);
  CHECK(kernel.size() == 4097);

  bool symmetric = true;
  for (size_t i = 0; i < kernel.size() && symmetric; ++i) {
    symmetric = std::fabs(static_cast<double>(kernel[i]) -
                          static_cast<double>(kernel[kernel.size() - 1 - i])) <
               1e-9;
  }
  CHECK(symmetric);

  const double at_1k = dtft_magnitude_db(kernel, 1000.0, kRate);
  std::printf("       1 kHz measures %.2f dB (target -12)\n", at_1k);
  CHECK(std::fabs(at_1k - (-12.0)) < 1.0);

  // The same piecewise-linear-in-log10(f) interpolation the design itself
  // uses, evaluated by hand between the (20, 0) and (1000, -12) points.
  const double target_100 =
      -12.0 * std::log(100.0 / 20.0) / std::log(1000.0 / 20.0);
  const double at_100 = dtft_magnitude_db(kernel, 100.0, kRate);
  std::printf("       100 Hz measures %.2f dB (target %.2f)\n", at_100,
              target_100);
  CHECK(std::fabs(at_100 - target_100) < 1.5);
}

// Two curves in series multiply their magnitudes, so the one kernel designed
// from both has to measure their dB added — at a point where each has a
// breakpoint the other does not, and between points on both.
void curves_add_in_decibels() {
  std::printf("two curves design one kernel measuring their sum\n");
  constexpr uint32_t kRate = 48000;
  const std::vector<GraphicPoint> dip = {
      {20.0, 0.0}, {1000.0, -12.0}, {20000.0, 0.0}};
  // Written out of order on purpose: each curve is sorted on its own.
  const std::vector<GraphicPoint> tilt = {{10000.0, -3.0}, {100.0, 3.0}};

  const auto both = design_graphic_kernel({dip, tilt}, kRate, 4097);
  const auto dip_only = design_graphic_kernel({dip}, kRate, 4097);
  const auto tilt_only = design_graphic_kernel({tilt}, kRate, 4097);
  CHECK(both.size() == 4097);

  for (const double hz : {100.0, 400.0, 1000.0, 5000.0, 10000.0}) {
    const double measured = dtft_magnitude_db(both, hz, kRate);
    const double summed = dtft_magnitude_db(dip_only, hz, kRate) +
                          dtft_magnitude_db(tilt_only, hz, kRate);
    std::printf("       %6.0f Hz measures %6.2f dB (sum of the two %6.2f)\n",
                hz, measured, summed);
    CHECK(std::fabs(measured - summed) < 0.25);
  }
  // Against the curves themselves as well, not only against each other: at
  // 1 kHz the dip is -12 and the tilt, half way in log frequency between its
  // two points, is 0.
  CHECK(std::fabs(dtft_magnitude_db(both, 1000.0, kRate) - (-12.0)) < 1.0);
  // And a positive control: the tilt alone is nowhere near -12 there, so
  // the check above cannot pass on the dip alone by accident of the tilt.
  CHECK(std::fabs(dtft_magnitude_db(tilt_only, 1000.0, kRate)) < 0.5);
  CHECK(std::fabs(dtft_magnitude_db(both, 100.0, kRate) -
                  dtft_magnitude_db(dip_only, 100.0, kRate) - 3.0) < 0.25);
}

void empty_points_is_a_centred_unit_impulse() {
  std::printf("no curve at all designs a unit impulse\n");
  const auto kernel = design_graphic_kernel({}, 48000, 4097);
  CHECK(kernel.size() == 4097);
  const size_t centre = kernel.size() / 2;
  CHECK(std::fabs(static_cast<double>(kernel[centre]) - 1.0) < 1e-5);

  bool rest_is_zero = true;
  for (size_t i = 0; i < kernel.size() && rest_is_zero; ++i) {
    if (i == centre) {
      continue;
    }
    rest_is_zero = std::fabs(static_cast<double>(kernel[i])) < 1e-5;
  }
  CHECK(rest_is_zero);
}

void even_tap_count_is_forced_odd() {
  std::printf("4096 taps becomes 4097\n");
  const auto kernel = design_graphic_kernel({}, 48000, 4096);
  CHECK(kernel.size() == 4097);
}

}  // namespace

int main() {
  std::printf("fluideq graphic eq kernel design\n");
  symmetric_and_matches_the_target_curve();
  curves_add_in_decibels();
  empty_points_is_a_centred_unit_impulse();
  even_tap_count_is_forced_odd();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

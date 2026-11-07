/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "footsteps_test_support.h"
#include <algorithm>

namespace {
using namespace feq_footsteps_test;
using feq_test::check;
using feq_test::Signal;

Signal hot_mix(double rate) {
  Parts parts;
  parts.bed = false;
  parts.loud = false;
  Scene steps = make_scene(rate, parts);
  Signal in = steps.mix;
  double peak = 0;
  for (size_t i = 0; i < in.left.size(); ++i) {
    const double t = static_cast<double>(i) / rate;
    in.left[i] = static_cast<float>(in.left[i] * 24 + 0.86 * std::sin(2 * feq_test::kPi * 110 * t));
    in.right[i] = static_cast<float>(in.right[i] * 24 + 0.73 * std::sin(2 * feq_test::kPi * 110 * t + 0.7));
    peak = std::max({peak, std::fabs(static_cast<double>(in.left[i])), std::fabs(static_cast<double>(in.right[i]))});
  }
  for (auto* channel : {&in.left, &in.right}) for (float& x : *channel) x = static_cast<float>(x * 0.98 / peak);
  return in;
}

void overlay_has_headroom(double rate) {
  const Signal in = hot_mix(rate);
  auto settings = competitive();
  settings.calm = 0;
  settings.lift = 1;
  const Signal out = run(in, rate, settings);
  double peak = 0, difference = 0;
  for (size_t i = 0; i < in.left.size(); ++i) {
    peak = std::max({peak, std::fabs(static_cast<double>(out.left[i])), std::fabs(static_cast<double>(out.right[i]))});
    difference = std::max(difference, std::fabs(static_cast<double>(out.left[i] - in.left[i])));
  }
  std::printf("%.0f Hz: hot input 0.98, output %.8f, positive-control delta %.8f\n", rate, peak, difference);
  check(difference > 0.001, "control: quiet steps really receive an overlay");
  check(peak <= 0.980001, "the overlay never creates an over from a hot original");

  settings.lift = 0;
  const Signal zero = run(in, rate, settings);
  check(zero.left == in.left && zero.right == in.right, "zero adds nothing to either original channel");
  settings.enabled = 0;
  const Signal off = run(in, rate, settings);
  check(off.left == in.left && off.right == in.right, "off is the original to the bit");

  settings.enabled = 1;
  settings.lift = 1;
  const Signal reversed{in.right, in.left};
  const Signal reversed_out = run(reversed, rate, settings);
  check(out.left == reversed_out.right && out.right == reversed_out.left,
        "headroom is linked: exchanging ears exchanges the exact outputs");
  Signal silence;
  silence.left.resize(static_cast<size_t>(rate));
  silence.right = silence.left;
  const Signal quiet = run(silence, rate, settings);
  check(quiet.left == silence.left && quiet.right == silence.right,
        "the positive lift creates no signal from silence");
}

void a_hot_steady_bed_stays_clean() {
  constexpr double rate = 48000;
  for (double frequency : {20., 80., 300., 1000., 6000.}) {
    for (double amplitude : {0.3, 0.6, 0.8, 0.98}) {
      Signal in;
      in.left.resize(6 * 48000);
      for (size_t i = 0; i < in.left.size(); ++i) {
        in.left[i] = static_cast<float>(amplitude *
            std::sin(2 * feq_test::kPi * frequency * i / rate));
      }
      in.right = in.left;
      auto settings = competitive();
      settings.lift = 0;
      settings.calm = 0;
      settings.environment = 1;
      const Signal out = run(in, rate, settings);
      double sine = 0, cosine = 0, total = 0, peak = 0;
      for (size_t i = 4 * 48000; i < in.left.size(); ++i) {
        const double phase = 2 * feq_test::kPi * frequency * i / rate;
        sine += out.left[i] * std::sin(phase);
        cosine += out.left[i] * std::cos(phase);
        total += static_cast<double>(out.left[i]) * out.left[i];
        peak = std::max(peak, std::fabs(static_cast<double>(out.left[i])));
      }
      const double fundamental = (sine * sine + cosine * cosine) / 48000;
      const double residual = 10 * std::log10(
          std::max(1e-30, total - fundamental) / fundamental);
      std::printf("Environment +100, %.0f Hz tone %.2f: non-fundamental %.2f dBc\n",
                  frequency, amplitude, residual);
      check(residual < -70,
            "headroom protection adds no measurable harmonic distortion to a steady bed");
      check(peak <= std::max(amplitude, std::pow(10.0, -1.0 / 20.0)) + 1e-6,
            "partially limited tones stay within the original or added-signal ceiling");
      if (amplitude == 0.3) {
        check(total > 48000 * amplitude * amplitude * 2,
              "control: Environment really raises the tone when there is room");
      }
      if (amplitude == 0.6 || amplitude == 0.8) {
        check(total > 48000 * amplitude * amplitude * 1.01,
              "control: partial headroom still adds signal instead of bypassing the boost");
      }
    }
  }
}
}  // namespace

int main() {
  for (const double rate : {44100., 48000., 88200., 96000., 176400., 192000., 352800., 384000.}) overlay_has_headroom(rate);
  a_hot_steady_bed_stays_clean();
  return feq_test::finish();
}

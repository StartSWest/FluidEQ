/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Maximizer's low band on a held bass note.
 *
 * It used to recover toward what the sample in hand asked for, which between
 * two peaks of a note is nothing, so its gain moved inside every cycle it was
 * working on: 0.9% of harmonics on a steady 30 Hz note, whose half cycle
 * outlasts the hold, and 0.6% on a 60 Hz one that wavered by a tenth of a
 * percent. These hold what the notes' "no distortion" asks of it — a steady
 * or wavering note held down by the low band keeps its harmonics under
 * -80 dB — with the old aim (no window) as the control, which must fail the
 * same measurement, or the measurement proves nothing.
 */

#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/bass_limiter.h"

using feq_test::bin_magnitude;
using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

namespace {

/** 3 ms of look-ahead at 48 kHz, as the chain gives the low band. */
constexpr uint32_t kLookAhead = 144;
constexpr uint32_t kCapacity = kLookAhead + 1;
constexpr uint32_t kBlock = 256;

struct Rendered {
  std::vector<float> left;
};

/**
 * A note at `hz` and -1 dBFS whose level wavers by `wobble` at 3 Hz, through
 * the low band with its ceiling 2 dB under the note's peak, so the band is
 * working on every cycle. `window_ms` 0 is the old aim.
 */
Rendered render(double hz, double wobble, double window_ms) {
  std::vector<float> input_line[2] = {std::vector<float>(kCapacity),
                                      std::vector<float>(kCapacity)};
  std::vector<float> low_line[2] = {std::vector<float>(kCapacity),
                                    std::vector<float>(kCapacity)};
  float* input_delay[2] = {input_line[0].data(), input_line[1].data()};
  float* low_delay[2] = {low_line[0].data(), low_line[1].data()};
  std::vector<float> gain_db(kCapacity);
  FeqBassLimiter state{};
  feq_bass_limiter_init(&state, input_delay, low_delay, gain_db.data(), 2,
                        kCapacity);
  feq_bass_limiter_set_look_ahead(&state, kLookAhead);

  const double amplitude = std::pow(10.0, -1.0 / 20.0);
  FeqBassLimiterOptions options{};
  options.ceiling = amplitude * std::pow(10.0, -2.0 / 20.0);
  options.knee_db = 1.5;
  options.platform_db = 0.0;
  options.floor_gain = std::pow(10.0, -12.0 / 20.0);
  options.split_hz = 250.0;
  options.release_coefficient = std::exp(-1.0 / (0.030 * kRate));
  options.release_hold_samples = std::floor(0.010 * kRate + 0.5);
  options.release_snap_ratio = 0.02;
  options.window_samples = std::floor(window_ms / 1000.0 * kRate + 0.5);
  options.sample_rate = kRate;

  const size_t frames = static_cast<size_t>(3.0 * kRate);
  Rendered out{std::vector<float>(frames)};
  std::vector<float> right(frames);
  for (size_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    const double level =
        amplitude * (1.0 + wobble * std::sin(2.0 * kPi * 3.0 * t));
    out.left[at] = static_cast<float>(level * std::sin(2.0 * kPi * hz * t));
    right[at] = out.left[at];
  }
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    float* channels[2] = {out.left.data() + at, right.data() + at};
    feq_bass_limiter_process(&state, channels, kBlock, &options);
  }
  return out;
}

/**
 * The loudest of the note's second to fifth harmonics against the note, in
 * dB, over one second from 1.5 s: a whole number of cycles of every note
 * here and of the waver, so neither leaks into a harmonic's bin.
 */
double worst_harmonic_db(const Rendered& rendered, double hz) {
  const size_t from = static_cast<size_t>(1.5 * kRate);
  const size_t count = static_cast<size_t>(kRate);
  const double fundamental = bin_magnitude(rendered.left, hz, from, count);
  double worst = 0.0;
  for (int k = 2; k <= 5; ++k) {
    worst = std::fmax(worst, bin_magnitude(rendered.left, hz * k, from, count));
  }
  return 20.0 * std::log10(std::fmax(worst, 1e-12) / fundamental);
}

}  // namespace

int main() {
  struct Case {
    double hz;
    double wobble;
    const char* name;
  };
  const Case cases[] = {
      {30.0, 0.0, "a steady 30 Hz note"},
      {45.0, 0.0, "a steady 45 Hz note"},
      {60.0, 0.001, "a 60 Hz note wavering by 0.1%"},
      {40.0, 0.001, "a 40 Hz note wavering by 0.1%"},
  };
  for (const Case& note : cases) {
    const double now =
        worst_harmonic_db(render(note.hz, note.wobble, 20.0), note.hz);
    const double before =
        worst_harmonic_db(render(note.hz, note.wobble, 0.0), note.hz);
    std::printf("%-30s harmonics %7.1f dB (the old aim: %7.1f dB)\n",
                note.name, now, before);
    check(now < -80.0,
          "the low band holds a bass note without writing harmonics into it");
    check(before > -70.0,
          "control: aiming at the sample in hand saws the same note");
  }
  return feq_test::finish();
}

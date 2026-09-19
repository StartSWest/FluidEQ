/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three-band split, held to the one thing a split is for.
 *
 * Nothing in this engine splits a signal in order to put it back unchanged:
 * the compressor holds each band on its own detector, Dimension gives each a
 * width, and the exciter's Timing delays the lower two. So the property that
 * matters is not that the bands recombine — a subtraction does that trivially,
 * and this split did exactly that until 2026-09-19 — but that they recombine
 * SENSIBLY when they are not equal. A Linkwitz-Riley lowpass is -0.5 at its
 * own corner, so subtracted bands arrive half a cycle apart and unequal gains
 * cancel instead of blending: the Gaming compressor measured -10 to -14 dB at
 * 120-250 Hz with nothing in its settings asking for a cut.
 *
 * Every check below is a frequency response of the reassembled signal, because
 * that is where the fault lived and it is invisible in any test of one band.
 */
#include "fluideq/primitives.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

constexpr double kPi = 3.14159265358979323846;
constexpr uint32_t kFrames = 512;
constexpr double kLowHz = 200.0;
constexpr double kHighHz = 3000.0;

struct Gains {
  double low;
  double mid;
  double high;
};

/**
 * The level of the reassembled signal at `hz`, as a ratio of what went in.
 *
 * Measured over a whole number of cycles at an integer hertz, after a second
 * of settling, so the reading is the steady state and one bin of it.
 */
double response_at(double hz, const Gains& gains, double rate,
                   double low_hz = kLowHz, double high_hz = kHighHz) {
  FeqCrossover state;
  feq_crossover_reset(&state);
  std::vector<float> input(kFrames);
  std::vector<float> low(kFrames);
  std::vector<float> mid(kFrames);
  std::vector<float> high(kFrames);

  constexpr double kAmplitude = 0.25;
  const auto settle = static_cast<uint64_t>(rate);
  const auto window = static_cast<uint64_t>(rate);
  double real = 0.0;
  double imaginary = 0.0;
  uint64_t taken = 0;
  for (uint64_t position = 0; taken < window; position += kFrames) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const auto n = static_cast<double>(position + at);
      input[at] = static_cast<float>(kAmplitude *
                                     std::sin((2.0 * kPi * hz * n) / rate));
    }
    feq_crossover_split(&state, input.data(), low.data(), mid.data(),
                        high.data(), kFrames, low_hz, high_hz, rate);
    if (position < settle) {
      continue;
    }
    for (uint32_t at = 0; at < kFrames && taken < window; ++at) {
      const double sum = static_cast<double>(low[at]) * gains.low +
                         static_cast<double>(mid[at]) * gains.mid +
                         static_cast<double>(high[at]) * gains.high;
      const auto n = static_cast<double>(position + at);
      real += sum * std::cos((2.0 * kPi * hz * n) / rate);
      imaginary += sum * std::sin((2.0 * kPi * hz * n) / rate);
      ++taken;
    }
  }
  const double amplitude = 2.0 * std::sqrt(real * real + imaginary * imaginary) /
                           static_cast<double>(taken);
  return amplitude / kAmplitude;
}

double as_db(double ratio) { return 20.0 * std::log10(ratio); }

/**
 * THE property, and the one the old split failed.
 *
 * Gains of 0 dB and -12 dB on neighbouring bands: every frequency has to come
 * out somewhere between them. Not approximately — a response outside that
 * range is two bands cancelling, which is a hole nothing in the settings
 * asked for and nothing downstream can put back.
 */
void test_unequal_gains_never_cancel(double rate) {
  std::printf("\ncrossover: unequal bands blend rather than cancel (%.0f Hz)\n",
              rate);
  const Gains cut_mid{1.0, 0.251, 1.0};
  const double probes[] = {100.0, 141.0, 200.0, 283.0, 400.0};
  double worst_low = 10.0;
  double worst_high = -10.0;
  for (const double hz : probes) {
    const double db = as_db(response_at(hz, cut_mid, rate));
    std::printf("       %5.0f Hz: %+6.2f dB\n", hz, db);
    worst_low = std::fmin(worst_low, db);
    worst_high = std::fmax(worst_high, db);
  }
  // A tenth of a decibel of room for the filters' own arithmetic; the failure
  // this catches was eighteen decibels deep.
  check(worst_low > -12.1, "nothing is cut deeper than the band that was cut");
  check(worst_high < 0.1, "and nothing is louder than the band that was not");

  const Gains cut_high{1.0, 1.0, 0.251};
  double worst_upper_low = 10.0;
  double worst_upper_high = -10.0;
  const double upper_probes[] = {1500.0, 2121.0, 3000.0, 4243.0, 6000.0};
  for (const double hz : upper_probes) {
    const double db = as_db(response_at(hz, cut_high, rate));
    std::printf("       %5.0f Hz: %+6.2f dB\n", hz, db);
    worst_upper_low = std::fmin(worst_upper_low, db);
    worst_upper_high = std::fmax(worst_upper_high, db);
  }
  check(worst_upper_low > -12.1 && worst_upper_high < 0.1,
        "and the same where the upper two meet");
}

/**
 * The positive control: the same measurement, on bands that DO cancel.
 *
 * Flipping one band's polarity is the fault the checks above exist to catch,
 * written down on purpose. If the probe cannot see this, it cannot see a hole
 * and everything above it is a null test.
 */
void test_the_probe_can_see_a_hole() {
  std::printf("\ncrossover: the measurement can see cancellation\n");
  const Gains inverted{1.0, -1.0, 1.0};
  const double db = as_db(response_at(kLowHz, inverted, 48000.0));
  std::printf("       an inverted mid band at the corner: %+6.2f dB\n", db);
  check(db < -6.0, "an inverted band reads as the hole it is");
}

/**
 * Untouched bands come back as the input, through the phase the split turns.
 *
 * The turn is what lets the bands share one phase, and a stage that has to
 * stay aligned with a signal it did not split runs the same turn over it.
 * Those two have to be the same thing to the sample, or Dimension's mid and
 * its side part company at the corners.
 */
void test_the_sum_is_the_phase_filter() {
  std::printf("\ncrossover: the bands sum to what the phase filter gives\n");
  constexpr double kRate = 48000.0;
  FeqCrossover split;
  feq_crossover_reset(&split);
  FeqCrossoverPhase phase{};
  feq_crossover_phase_reset(&phase);

  uint32_t seed = 0x12345677u;
  const auto noise = [&seed]() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<float>(static_cast<double>(seed >> 8) / 8388608.0 - 1.0);
  };

  std::vector<float> input(kFrames);
  std::vector<float> turned(kFrames);
  std::vector<float> low(kFrames);
  std::vector<float> mid(kFrames);
  std::vector<float> high(kFrames);
  double worst = 0.0;
  double level = 0.0;
  for (uint32_t block = 0; block < 100; ++block) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      input[at] = 0.5f * noise();
      turned[at] = input[at];
    }
    feq_crossover_split(&split, input.data(), low.data(), mid.data(),
                        high.data(), kFrames, kLowHz, kHighHz, kRate);
    feq_crossover_phase_process(&phase, turned.data(), kFrames, kLowHz, kHighHz,
                                kRate);
    for (uint32_t at = 0; at < kFrames; ++at) {
      const double sum = static_cast<double>(low[at]) +
                         static_cast<double>(mid[at]) +
                         static_cast<double>(high[at]);
      worst = std::fmax(worst, std::fabs(sum - static_cast<double>(turned[at])));
      level = std::fmax(level, std::fabs(static_cast<double>(turned[at])));
    }
  }
  std::printf("       worst difference %.3e against a signal of %.3f\n", worst,
              level);
  check(worst < 1e-5, "the three bands are the same signal, split");
}

/** Each band is a band: an octave out, it is down where LR4 says it is. */
void test_each_band_is_a_band() {
  std::printf("\ncrossover: each band is where it says it is\n");
  constexpr double kRate = 48000.0;
  const double low_only = as_db(response_at(400.0, {1.0, 0.0, 0.0}, kRate));
  const double mid_only = as_db(response_at(100.0, {0.0, 1.0, 0.0}, kRate));
  const double high_only = as_db(response_at(1500.0, {0.0, 0.0, 1.0}, kRate));
  std::printf("       low at 400 Hz %+6.2f dB, mid at 100 Hz %+6.2f dB, "
              "high at 1500 Hz %+6.2f dB\n",
              low_only, mid_only, high_only);
  // Fourth order is 24 dB an octave; the reading is allowed to be steeper,
  // never shallower, which is what a split that leaks would be.
  check(low_only < -22.0 && mid_only < -22.0 && high_only < -22.0,
        "an octave outside its band, each one is down by a fourth order");
}

/**
 * A split does NOT start transparently, which is why stages fade it in.
 *
 * This is the measurement behind `FEQ_SPLIT_FADE_MS`, kept because the number
 * is the whole reason that fade exists: an empty filter's first sample is its
 * own first coefficient times the input, and for these two corners that comes
 * to a little over half. A stage that switched its split on between one sample
 * and the next would drop the signal by nearly half for an instant, which is a
 * click — so the compressor, Dimension and the exciter's Timing each crossfade
 * their own output against their input instead.
 *
 * If a future split reconstructs from cold (a linear-phase one would), this
 * check is what says the fades can go.
 */
void test_a_cold_split_starts_short() {
  std::printf("\ncrossover: a split starts short, and the stages fade it in\n");
  constexpr double kRate = 48000.0;
  constexpr uint32_t kBlock = 64;
  // The signal is well into its cycle, near the top, which is where a first
  // sample scaled by anything other than one would show.
  constexpr uint32_t kFrom = 60;
  FeqCrossover state;
  feq_crossover_reset(&state);
  std::vector<float> input(kBlock);
  std::vector<float> low(kBlock);
  std::vector<float> mid(kBlock);
  std::vector<float> high(kBlock);
  for (uint32_t at = 0; at < kBlock; ++at) {
    input[at] = static_cast<float>(
        0.1 * std::sin((2.0 * kPi * kLowHz * (at + kFrom)) / kRate));
  }
  feq_crossover_split(&state, input.data(), low.data(), mid.data(), high.data(),
                      kBlock, kLowHz, kHighHz, kRate);
  const double first = static_cast<double>(low[0]) + static_cast<double>(mid[0]) +
                       static_cast<double>(high[0]);
  const double ratio = first / static_cast<double>(input[0]);
  std::printf("       first sample in %+0.5f, out %+0.5f (%.3f of it)\n",
              input[0], first, ratio);
  check(ratio < 0.9,
        "a cold split's first sample is short of the one that went in");
  check(feq_split_fade_step(kRate) * (FEQ_SPLIT_FADE_MS / 1000.0) * kRate >
            0.99,
        "and the fade that covers it reaches unity in its own length");
}

/** Reset means reset: the same input from a cleared state is the same output. */
void test_reset_clears_every_filter() {
  std::printf("\ncrossover: reset empties all of it\n");
  constexpr double kRate = 48000.0;
  std::vector<float> input(kFrames);
  for (uint32_t at = 0; at < kFrames; ++at) {
    input[at] = static_cast<float>(
        0.4 * std::sin((2.0 * kPi * 220.0 * static_cast<double>(at)) / kRate));
  }
  std::vector<float> low(kFrames);
  std::vector<float> mid(kFrames);
  std::vector<float> high(kFrames);
  FeqCrossover fresh;
  feq_crossover_reset(&fresh);
  feq_crossover_split(&fresh, input.data(), low.data(), mid.data(), high.data(),
                      kFrames, kLowHz, kHighHz, kRate);
  const std::vector<float> expected_low = low;
  const std::vector<float> expected_mid = mid;
  const std::vector<float> expected_high = high;

  FeqCrossover used;
  feq_crossover_reset(&used);
  for (uint32_t block = 0; block < 4; ++block) {
    feq_crossover_split(&used, input.data(), low.data(), mid.data(), high.data(),
                        kFrames, kLowHz, kHighHz, kRate);
  }
  feq_crossover_reset(&used);
  feq_crossover_split(&used, input.data(), low.data(), mid.data(), high.data(),
                      kFrames, kLowHz, kHighHz, kRate);
  double worst = 0.0;
  for (uint32_t at = 0; at < kFrames; ++at) {
    worst = std::fmax(worst, std::fabs(static_cast<double>(low[at]) -
                                       static_cast<double>(expected_low[at])));
    worst = std::fmax(worst, std::fabs(static_cast<double>(mid[at]) -
                                       static_cast<double>(expected_mid[at])));
    worst = std::fmax(worst, std::fabs(static_cast<double>(high[at]) -
                                       static_cast<double>(expected_high[at])));
  }
  std::printf("       worst difference after a reset: %.3e\n", worst);
  check(worst == 0.0, "a reset state is a fresh state, in every section");
}

}  // namespace

int main() {
  std::printf("fluideq crossover\n");
  // Every rate the engine is measured at: a coefficient that assumed one of
  // them would pass at 48 kHz and be heard on somebody's 96 kHz converter.
  test_unequal_gains_never_cancel(44100.0);
  test_unequal_gains_never_cancel(48000.0);
  test_unequal_gains_never_cancel(96000.0);
  test_unequal_gains_never_cancel(192000.0);
  test_the_probe_can_see_a_hole();
  test_the_sum_is_the_phase_filter();
  test_each_band_is_a_band();
  test_a_cold_split_starts_short();
  test_reset_clears_every_filter();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

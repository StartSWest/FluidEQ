/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A limiter's release never finishes in a jump (`release_toward`).
 *
 * The Maximizer used to cover the last 2% of every release in one sample:
 * 0.17 dB, heard as a tick after each hit it limited — the switch probe found
 * it at -69 dBFS above 5 kHz, 150 ms into a Punch rack. Measured here on the
 * gain itself: a DC input, so the output over the delayed input IS the gain,
 * sample by sample. The old finish, written out beside it, is the control
 * that has to fail the same measurement.
 */

#include <cmath>
#include <cstdio>
#include <vector>

#include "../src/limiter_internal.h"
#include "dsp_test_support.h"
#include "fluideq/limiter.h"

using feq_test::check;
using feq_test::kRate;

namespace {

/** 150 ms, a Maximizer release. */
const double kCoefficient = std::exp(-1.0 / (0.15 * kRate));
constexpr double kFinishRatio = 0.02;

/** The finish this replaced: the rest of the gap in one sample. */
double released_with_a_jump(double gain, double target) {
  gain += (target - gain) * (1.0 - kCoefficient);
  if (target > gain && target - gain <= target * kFinishRatio) {
    gain = target;
  }
  return gain;
}

struct Recovery {
  /** The largest single-sample rise, as a fraction of the target. */
  double largest_step = 0.0;
  /** The rise the recovery had when it came within 2%. */
  double pace_at_finish = 0.0;
  /** Samples until it was there, or 0 if it never arrived. */
  uint32_t samples = 0;
};

template <typename Step>
Recovery recover(Step step) {
  Recovery out;
  double gain = 0.5;
  const double target = 1.0;
  for (uint32_t at = 1; at < static_cast<uint32_t>(kRate) * 10; ++at) {
    const double next = step(gain, target);
    const double rise = next - gain;
    if (out.pace_at_finish == 0.0 && target - next <= target * kFinishRatio) {
      out.pace_at_finish = target * kFinishRatio * (1.0 - kCoefficient);
    }
    out.largest_step = std::fmax(out.largest_step, rise);
    gain = next;
    if (gain >= target) {
      out.samples = at;
      break;
    }
  }
  return out;
}

void a_recovery_arrives_without_a_jump() {
  const Recovery now = recover([](double gain, double target) {
    return feq_limiter::release_toward(gain, target, kCoefficient, kFinishRatio);
  });
  const Recovery before = recover(released_with_a_jump);
  const double tau = 0.15 * kRate;
  std::printf("release: arrives after %.2f releases, largest step %.5f "
              "(the old finish: %.2f releases, a %.5f jump)\n",
              now.samples / tau, now.largest_step, before.samples / tau,
              before.largest_step);
  check(now.samples > 0, "a recovery arrives");
  // From half way down: ln(0.5 / 0.02) releases to come within 2%, one more
  // to cross the 2% in a straight line.
  check(now.samples / tau < std::log(0.5 / kFinishRatio) + 1.05,
        "within one release of where the old finish arrived");
  // Nothing faster than the pace it had: the first sample of the recovery,
  // the steepest of an exponential, is the largest step.
  check(now.largest_step <= 0.5 * (1.0 - kCoefficient) + 1e-12,
        "no step larger than the recovery's own first");
  check(before.largest_step > 0.019, "control: the old finish jumps the last 2%");
}

/**
 * The same through the linked limiter: one loud burst over DC, then the
 * recovery read off the output sample by sample.
 */
void the_limiter_lets_go_without_a_jump() {
  constexpr uint32_t kLookAhead = 96;
  constexpr uint32_t kCapacity = kLookAhead + 1;
  FeqTruePeak detector{};
  std::vector<float> line(kCapacity, 0.0f);
  float* lines[1] = {line.data()};
  std::vector<float> reductions(kCapacity, 0.0f);
  FeqLinkedLimiter limiter{};
  feq_linked_limiter_init(&limiter, &detector, lines, reductions.data(), 1, kCapacity, 1);
  feq_linked_limiter_set_look_ahead(&limiter, kLookAhead);
  FeqLimiterOptions options{};
  options.ceiling = 0.5;
  options.activation_threshold = options.ceiling;
  options.release_coefficient = kCoefficient;
  options.limiting_release_coefficient = kCoefficient;
  options.release_snap_ratio = kFinishRatio;
  options.sample_rate = kRate;
  const uint32_t frames = static_cast<uint32_t>(kRate) * 3;
  std::vector<float> input(frames, 0.25f);
  for (uint32_t at = 4800; at < 4848; ++at) input[at] = 2.0f;
  std::vector<float> output = input;
  for (uint32_t at = 0; at < frames; at += 480) {
    float* planes[1] = {output.data() + at};
    feq_linked_limiter_process(&limiter, planes, 480, &options);
  }
  // Well after the burst has left the delay: the gain is what came out over
  // what went in, and it only rises from here.
  double largest_step = 0.0;
  double last = 0.0;
  for (uint32_t at = 4848 + kLookAhead + 1; at < frames; ++at) {
    const double gain = output[at] / input[at - kLookAhead];
    if (last > 0.0) largest_step = std::fmax(largest_step, gain - last);
    last = gain;
  }
  std::printf("limiter: back to %.6f, largest rise in one sample %.6f\n", last,
              largest_step);
  check(std::fabs(last - 1.0) < 1e-6, "the limiter lets go all the way");
  // Its steepest rise is its first, from the burst's 0.25 towards 1.
  check(largest_step < 0.75 * (1.0 - kCoefficient) * 1.01,
        "and never faster than its own release");
}

}  // namespace

int main() {
  a_recovery_arrives_without_a_jump();
  the_limiter_lets_go_without_a_jump();
  return feq_test::finish();
}

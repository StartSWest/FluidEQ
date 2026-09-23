/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The curves stage: with no curve, the exact delay the full convolver used
 * to be; with a curve, the convolvers; and every way from one to the other
 * without a click, a gap or a burst of work.
 */

#include "../src/curve_stage.h"
#include "../src/graphic_eq.h"
#include "graph_test_support.h"

#include <algorithm>
#include <cmath>
#include <memory>
#include <random>
#include <vector>

using namespace fluideq_engine_test;
using fluideq_engine::CurveStage;
using fluideq_engine::GraphicPoint;

namespace {

constexpr uint32_t kBlock = 480;
constexpr uint32_t kTaps = 16384;

std::vector<float> noise(uint32_t frames, uint32_t seed) {
  std::mt19937 engine(seed);
  std::uniform_real_distribution<float> spread(-0.25f, 0.25f);
  std::vector<float> out(frames);
  for (float& sample : out) sample = spread(engine);
  return out;
}

/** A treble lift and a bass cut, designed the way the engine designs one. */
std::vector<float> curve_kernel(double treble_db) {
  const std::vector<std::vector<GraphicPoint>> curves = {
      {{20, -3}, {200, 0}, {2000, 0}, {8000, treble_db}, {20000, treble_db}}};
  return fluideq_engine::design_minimum_graphic_kernel(curves, kRate, kTaps);
}

/** Runs `input` (both channels the same) through `stage` in blocks, from `from`. */
void run(CurveStage& stage, const std::vector<float>& input, uint32_t from,
         uint32_t to, std::vector<float>& left, std::vector<float>& right) {
  for (uint32_t at = from; at < to; at += kBlock) {
    const uint32_t span = std::min(kBlock, to - at);
    std::copy_n(input.begin() + at, span, left.begin() + at);
    std::copy_n(input.begin() + at, span, right.begin() + at);
    float* planar[2] = {left.data() + at, right.data() + at};
    stage.process(planar, span);
  }
}

double worst_difference(const std::vector<float>& a, const std::vector<float>& b,
                        uint32_t from, uint32_t to) {
  double worst = 0.0;
  for (uint32_t at = from; at < to; ++at) {
    worst = std::max(worst, std::abs(static_cast<double>(a[at]) - b[at]));
  }
  return worst;
}

void empty_stage_is_an_exact_delay() {
  std::printf("an empty stage is an exact delay\n");
  const uint32_t frames = kRate * 2;
  const std::vector<float> input = noise(frames, 1);
  CurveStage stage({}, 0, kRate, 2, kBlock);
  CHECK(!stage.convolving() && !stage.failed());
  CHECK(stage.latency() == feq_convolver_latency());
  std::vector<float> left(frames), right(frames);
  run(stage, input, 0, frames, left, right);
  bool exact = true;
  for (uint32_t at = 0; at < frames; ++at) {
    const float expected = at < stage.latency() ? 0.0f : input[at - stage.latency()];
    exact = exact && left[at] == expected && right[at] == expected;
  }
  CHECK(exact);
  // POSITIVE CONTROL: a stage with a curve is not a delay, so "exact" above
  // is the empty stage's doing and not a comparison that cannot fail.
  CurveStage curved(curve_kernel(6.0), 0, kRate, 2, kBlock);
  std::vector<float> curved_left(frames), curved_right(frames);
  run(curved, input, 0, frames, curved_left, curved_right);
  CHECK(worst_difference(curved_left, left, kRate, frames) > 0.01);
}

void first_curve_waits_until_warm_then_fades_in() {
  std::printf("a first curve is heard only once warm, then fades in\n");
  const uint32_t frames = kRate * 3;
  const std::vector<float> input = noise(frames, 2);
  const std::vector<float> kernel = curve_kernel(6.0);
  // The reference: the same curve, running from the start.
  CurveStage reference(kernel, 0, kRate, 2, kBlock);
  std::vector<float> want_left(frames), want_right(frames);
  run(reference, input, 0, frames, want_left, want_right);

  auto empty = std::make_unique<CurveStage>(std::vector<float>{}, 0, kRate, 2, kBlock);
  std::vector<float> left(frames), right(frames);
  const uint32_t swap = kRate / 2 / kBlock * kBlock;
  run(*empty, input, 0, swap, left, right);
  CurveStage curved(kernel, 0, kRate, 2, kBlock);
  curved.adopt(*empty);
  empty.reset();
  run(curved, input, swap, frames, left, right);

  const uint32_t latency = curved.latency();
  const uint32_t warm = kTaps + feq_convolver_latency();
  // Until its convolvers are warm the stage plays the delay, sample exact.
  bool delay_until_warm = true;
  for (uint32_t at = swap; at < swap + warm - kBlock; ++at) {
    delay_until_warm = delay_until_warm && left[at] == input[at - latency];
  }
  CHECK(delay_until_warm);
  // Then the fade, and from its end the curve exactly as if it had always run.
  const uint32_t settled = swap + warm + kBlock * 5;
  CHECK(worst_difference(left, want_left, settled, frames) < 1e-5);
  CHECK(worst_difference(right, want_right, settled, frames) < 1e-5);
  // No block anywhere lost the music.
  bool continuous = true;
  for (uint32_t at = swap; at + kBlock <= frames; at += kBlock) {
    continuous = continuous && rms_db(left, at, at + kBlock) > -30.0;
  }
  CHECK(continuous);
}

void last_curve_fades_to_the_delay() {
  std::printf("the last curve fades to the delay\n");
  const uint32_t frames = kRate * 2;
  const std::vector<float> input = tone(1000, 0.25, frames, 0);
  auto curved = std::make_unique<CurveStage>(curve_kernel(6.0), 0, kRate, 2, kBlock);
  std::vector<float> left(frames), right(frames);
  const uint32_t swap = kRate;
  run(*curved, input, 0, swap, left, right);
  CurveStage empty({}, 0, kRate, 2, kBlock);
  empty.adopt(*curved);
  curved.reset();  // The previous stage goes; what the new one took stays.
  run(empty, input, swap, frames, left, right);
  const uint32_t latency = empty.latency();
  const uint32_t faded = swap + kRate / 50 + kBlock;
  bool exact = true;
  for (uint32_t at = faded; at < frames; ++at) {
    exact = exact && left[at] == input[at - latency];
  }
  CHECK(exact);
  // A 1 kHz tone changes smoothly through the fade: no sample jumps by more
  // than the tone itself moves between two samples, plus the fade's share.
  double worst_step = 0.0;
  for (uint32_t at = swap - kBlock; at < faded; ++at) {
    worst_step = std::max(worst_step, std::abs(static_cast<double>(left[at + 1]) - left[at]));
  }
  const double tone_step = 0.25 * 2.0 * kPi * 1000.0 / kRate;
  CHECK(worst_step < tone_step * 1.2);
}

void one_curve_replaced_by_another_crosses_over() {
  std::printf("one curve replaced by another crosses over\n");
  const uint32_t frames = kRate * 2;
  const std::vector<float> input = noise(frames, 3);
  auto first = std::make_unique<CurveStage>(curve_kernel(6.0), 0, kRate, 2, kBlock);
  std::vector<float> left(frames), right(frames);
  const uint32_t swap = kRate;
  run(*first, input, 0, swap, left, right);
  const std::vector<float> kernel = curve_kernel(-4.0);
  CurveStage second(kernel, 0, kRate, 2, kBlock);
  second.adopt(*first);
  first.reset();
  run(second, input, swap, frames, left, right);
  CurveStage reference(kernel, 0, kRate, 2, kBlock);
  std::vector<float> want_left(frames), want_right(frames);
  run(reference, input, 0, frames, want_left, want_right);
  // The convolvers hand their history over: no warm-up wait, only the fade.
  CHECK(worst_difference(left, want_left, swap + kRate / 10, frames) < 1e-5);
  bool continuous = true;
  for (uint32_t at = swap; at + kBlock <= frames; at += kBlock) {
    continuous = continuous && rms_db(left, at, at + kBlock) > -30.0;
  }
  CHECK(continuous);
}

void quick_changes_stay_finite_and_audible() {
  std::printf("curves added and taken away in quick succession\n");
  const uint32_t frames = kRate * 2;
  const std::vector<float> input = noise(frames, 4);
  std::vector<float> left(frames), right(frames);
  auto stage = std::make_unique<CurveStage>(std::vector<float>{}, 0, kRate, 2, kBlock);
  uint32_t at = 0;
  for (int change = 0; at + kBlock * 4 <= frames; ++change) {
    run(*stage, input, at, at + kBlock * 2, left, right);
    at += kBlock * 2;
    const bool with_curve = change % 2 == 0;
    auto next = std::make_unique<CurveStage>(
        with_curve ? curve_kernel(change % 4 == 0 ? 6.0 : -6.0) : std::vector<float>{},
        0, kRate, 2, kBlock);
    next->adopt(*stage);
    stage = std::move(next);
  }
  bool finite = true;
  for (float sample : left) finite = finite && std::isfinite(sample);
  CHECK(finite);
  bool continuous = true;
  for (uint32_t from = kRate / 10; from + kBlock <= at; from += kBlock) {
    continuous = continuous && rms_db(left, from, from + kBlock) > -30.0;
  }
  CHECK(continuous);
}

}  // namespace

int main() {
  empty_stage_is_an_exact_delay();
  first_curve_waits_until_warm_then_fades_in();
  last_curve_fades_to_the_delay();
  one_curve_replaced_by_another_crosses_over();
  quick_changes_stay_finite_and_audible();
  return report();
}

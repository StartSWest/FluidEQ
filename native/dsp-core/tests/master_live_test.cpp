/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Master's loudness target, where nobody has measured the track.
 *
 * In the Library the app measures a file once and hands the chain a makeup.
 * Everywhere else — every stream Windows plays through the system engine —
 * there is no analysis, and the makeup was zero for ever: the target could be
 * dragged from one end of the dial to the other and nothing changed. That is
 * the bug these cases hold closed, and they measure the one thing a listener
 * would: the loudness of what leaves.
 */

#include "fluideq/chain.h"
#include "fluideq/loudness_meter.h"

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

namespace {

constexpr double kRate = 48000.0;
constexpr uint32_t kFrames = 480;
constexpr double kPi = 3.14159265358979323846;

int failures = 0;

void check(bool passed, const char* message) {
  if (!passed) {
    std::printf("FAIL: %s\n", message);
    ++failures;
  }
}

using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;
using Meter = std::unique_ptr<FeqLoudnessMeter, decltype(&feq_loudness_meter_destroy)>;

/** Everything off but the Master, which is the stage under test. */
FeqChainSettings master_only(double target_lufs, double amplitude_trim = 0.0) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.normalizer.mode = 0;
  settings.eq.enabled = 0;
  settings.exciter.enabled = 0;
  settings.compressor.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.dimension.enabled = 0;
  settings.master.enabled = 1;
  settings.master.loudness_maximize = 1;
  settings.master.loudness_target_lufs = target_lufs;
  settings.master.ceiling_db = -1.0;
  settings.master.peak_limiting_db = 9.0;
  settings.master.release_ms = 200.0;
  settings.master.output_trim_db = amplitude_trim;
  settings.master.matched_bypass = 0;
  return settings;
}

/**
 * Music-shaped rather than a tone: a gated loudness measurement of a single
 * sine is a measurement of the gate, not of the stage.
 */
void fill(std::vector<float>& left, std::vector<float>& right, uint32_t block,
          double amplitude) {
  for (uint32_t frame = 0; frame < kFrames; ++frame) {
    const double at =
        static_cast<double>(block) * kFrames + static_cast<double>(frame);
    const double phase = 2.0 * kPi * at / kRate;
    const double voice = 0.6 * std::sin(phase * 220.0) +
                         0.3 * std::sin(phase * 660.0) +
                         0.2 * std::sin(phase * 1320.0) +
                         0.1 * std::sin(phase * 3300.0);
    const double bass = 0.5 * std::sin(phase * 55.0);
    left[frame] = static_cast<float>(amplitude * (voice + bass) * 0.5);
    right[frame] = static_cast<float>(amplitude * (voice * 0.9 + bass) * 0.5);
  }
}

/** The loudness of what leaves, over `seconds` of that programme. */
double delivered_lufs(FeqChain* rack, double amplitude, double seconds) {
  Meter meter(feq_loudness_meter_create(kRate, 2), &feq_loudness_meter_destroy);
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  const auto blocks =
      static_cast<uint32_t>(seconds * kRate / static_cast<double>(kFrames));
  // The last third is what is measured: the makeup glides in, and a mean over
  // the glide would report the ramp rather than where it arrived.
  const uint32_t settled = blocks - blocks / 3;
  for (uint32_t block = 0; block < blocks; ++block) {
    fill(left, right, block, amplitude);
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(rack, planes, kFrames);
    if (block == settled) {
      feq_loudness_meter_reset(meter.get());
    }
    if (block >= settled) {
      const float* read[2] = {left.data(), right.data()};
      feq_loudness_meter_process(meter.get(), read, kFrames);
    }
  }
  FeqLoudnessReading reading{};
  feq_loudness_meter_read(meter.get(), &reading);
  return reading.integrated_lufs;
}

Rack build(const FeqChainSettings& settings) {
  Rack rack(feq_chain_create(kRate, 2, kFrames), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  feq_chain_enable_live_normalizer(rack.get());
  feq_chain_reset(rack.get(), FEQ_CHAIN_RESET_STREAM_START);
  return rack;
}

/** A quiet programme is brought UP to the target, which is the whole point. */
void a_quiet_programme_reaches_the_target() {
  const FeqChainSettings settings = master_only(-14.0);
  Rack rack = build(settings);
  const double delivered = delivered_lufs(rack.get(), 0.2, 30.0);
  std::printf("  quiet programme delivered %.1f LUFS\n", delivered);
  check(std::fabs(delivered - (-14.0)) < 1.5,
        "a quiet programme leaves at the Master's target");

  FeqChainSettings off = settings;
  off.master.loudness_maximize = 0;
  Rack bypassed = build(off);
  const double untouched = delivered_lufs(bypassed.get(), 0.2, 30.0);
  std::printf("  with the target off: %.1f LUFS\n", untouched);
  check(delivered - untouched > 3.0,
        "POSITIVE CONTROL: with the target off the same programme stays quiet");
}

/** And a loud one is brought DOWN to it, or the dial is a boost cap. */
void a_loud_programme_comes_down_to_the_target() {
  Rack rack = build(master_only(-20.0));
  const double delivered = delivered_lufs(rack.get(), 0.5, 30.0);
  check(delivered < -17.0,
        "a loud programme is attenuated toward the Master's target");
}

/** Move the dial, hear the difference: the complaint that started this. */
void the_dial_moves_the_level() {
  Rack quiet = build(master_only(-23.0));
  Rack loud = build(master_only(-14.0));
  const double at_quiet = delivered_lufs(quiet.get(), 0.2, 30.0);
  const double at_loud = delivered_lufs(loud.get(), 0.2, 30.0);
  std::printf("  dial at -23: %.1f LUFS, at -14: %.1f LUFS\n", at_quiet,
              at_loud);
  check(at_loud - at_quiet > 6.0,
        "nine decibels of target is audible as level");
}

/** The Library measured the track, so the chain must not measure it again. */
void a_measured_track_is_left_to_its_host() {
  Rack rack = build(master_only(-14.0));
  feq_chain_set_track_level_gains(rack.get(), 0.0, 0.0, 1);
  const double delivered = delivered_lufs(rack.get(), 0.2, 30.0);

  FeqChainSettings off = master_only(-14.0);
  off.master.loudness_maximize = 0;
  Rack bypassed = build(off);
  const double untouched = delivered_lufs(bypassed.get(), 0.2, 30.0);
  check(std::fabs(delivered - untouched) < 0.5,
        "a host that sets the track's gains keeps the makeup to itself");
}

/** Whatever the target asks for, the ceiling is still the ceiling. */
void the_ceiling_holds() {
  FeqChainSettings settings = master_only(-6.0);
  Rack rack = build(settings);
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  double peak = 0.0;
  for (uint32_t block = 0; block < 3000; ++block) {
    fill(left, right, block, 0.2);
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(rack.get(), planes, kFrames);
    for (uint32_t frame = 0; frame < kFrames; ++frame) {
      peak = std::fmax(peak, std::fabs(static_cast<double>(left[frame])));
      peak = std::fmax(peak, std::fabs(static_cast<double>(right[frame])));
      check(std::isfinite(left[frame]) && std::isfinite(right[frame]),
            "every sample the live makeup produces is finite");
    }
  }
  check(peak < 1.0, "a target nobody can reach still cannot clip the output");
}

}  // namespace

int main() {
  a_quiet_programme_reaches_the_target();
  a_loud_programme_comes_down_to_the_target();
  the_dial_moves_the_level();
  a_measured_track_is_left_to_its_host();
  the_ceiling_holds();
  std::printf("master live: %d failures\n", failures);
  return failures == 0 ? 0 : 1;
}

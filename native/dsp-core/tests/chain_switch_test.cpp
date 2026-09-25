/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset switch that keeps the delay, heard as the engine hands it over.
 *
 * The engine builds a new rack for every switch and hands it the old one's
 * state (`feq_chain_transfer_state`), and a stage whose setting changed there
 * used to step: the mono maker moved the whole EQ from left and right onto
 * mid and side, the Maximizer applied a new drive to every sample at once and
 * dropped its reduction the block it was switched off, Bass Forge's addition
 * and its level normaliser let go in one sample, and Dimension's all-pass
 * network came on empty and landed its delayed taps as steps well after its
 * fade. Measured 2026-09-25 under four low tones, as the loudest millisecond
 * above 5 kHz around the switch against the loudest either rack puts there
 * while steady: -42, -47, -57, -55 and -57 dBFS, where the steady racks sit
 * near -85.
 *
 * Every case has a control: the same two racks' steady outputs spliced at the
 * same sample, which is what an unsmoothed switch sounds like. A case whose
 * splice would not click proves nothing, so each control must.
 */

#include "fluideq/chain.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

namespace {

using feq_test::check;
using feq_test::kPi;

constexpr double kRate = 48000.0;
constexpr uint32_t kBlock = 480;
constexpr uint32_t kBefore = 48000;  // a second of the first rack
constexpr uint32_t kAfter = 28800;   // 600 ms of the second
/** How far over the steady racks a switch may reach above 5 kHz, in dB. */
constexpr double kAllowedDb = 6.0;
/** How far over them the unsmoothed splice has to reach for a case to count. */
constexpr double kControlDb = 20.0;

using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

/** As the engine builds one: configured, one silent block, back to its start. */
Rack prepare(const FeqChainSettings& settings) {
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  std::vector<float> silence(kBlock * 2, 0.0f);
  float* planes[2] = {silence.data(), silence.data() + kBlock};
  feq_chain_process(rack.get(), planes, kBlock);
  feq_chain_reset(rack.get(), FEQ_CHAIN_RESET_STREAM_START);
  return rack;
}

/**
 * Four low tones, the two sides a little apart so the width stages have a
 * side to work on. Nothing above 1.2 kHz, so what lands above 5 kHz is what
 * the racks make and what the switch makes.
 */
void signal(uint32_t from, std::vector<float>& left, std::vector<float>& right) {
  for (uint32_t at = 0; at < kBlock; ++at) {
    const double t = static_cast<double>(from + at) / kRate;
    left[at] = static_cast<float>(
        0.25 * std::sin(2 * kPi * 55.0 * t) + 0.12 * std::sin(2 * kPi * 180.3 * t) +
        0.06 * std::sin(2 * kPi * 441.7 * t) + 0.02 * std::sin(2 * kPi * 1103.0 * t));
    right[at] = static_cast<float>(
        0.23 * std::sin(2 * kPi * 55.0 * t + 0.3) + 0.12 * std::sin(2 * kPi * 180.3 * t + 0.9) +
        0.05 * std::sin(2 * kPi * 441.7 * t + 1.7) + 0.025 * std::sin(2 * kPi * 1103.0 * t + 2.2));
  }
}

/** The rack's left channel over [from, from + frames). */
void run(FeqChain* rack, uint32_t from, uint32_t frames, std::vector<float>& out) {
  std::vector<float> left(kBlock), right(kBlock);
  for (uint32_t done = 0; done < frames; done += kBlock) {
    signal(from + done, left, right);
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(rack, planes, kBlock);
    out.insert(out.end(), left.begin(), left.end());
  }
}

struct Biquad {
  double b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  double step(double x) {
    const double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  }
};

Biquad highpass(double q) {
  const double w = 2 * kPi * 5000.0 / kRate;
  const double c = std::cos(w);
  const double alpha = std::sin(w) / (2 * q);
  const double a0 = 1 + alpha;
  return {(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - alpha) / a0};
}

/** The loudest millisecond above 5 kHz in [from, to), as an RMS. */
double loudest_top(const std::vector<float>& out, size_t from, size_t to) {
  Biquad one = highpass(0.5412);
  Biquad two = highpass(1.3066);
  std::vector<double> top(out.size());
  for (size_t at = 0; at < out.size(); ++at) {
    top[at] = two.step(one.step(static_cast<double>(out[at])));
  }
  double loudest = 0;
  for (size_t at = from; at + 48 <= to && at + 48 <= top.size(); at += 24) {
    double sum = 0;
    for (size_t k = 0; k < 48; ++k) sum += top[at + k] * top[at + k];
    loudest = std::max(loudest, std::sqrt(sum / 48));
  }
  return loudest;
}

/** The switch against the steady racks either side of it, in dB. */
double over_steady(const std::vector<float>& out) {
  const double before = loudest_top(out, 24000, kBefore - 960);
  const double after = loudest_top(out, kBefore + 14400, out.size());
  const double seam = loudest_top(out, kBefore - 240, kBefore + 14400);
  return 20 * std::log10(std::max(seam, 1e-12) / std::max({before, after, 1e-9}));
}

void switched(const char* name, const FeqChainSettings& from,
              const FeqChainSettings& to) {
  auto running = prepare(from);
  std::vector<float> handed;
  run(running.get(), 0, kBefore, handed);
  auto next = prepare(to);
  check(feq_chain_transfer_state(next.get(), running.get()) == 1,
        "the prepared rack accepts the handover");
  run(next.get(), kBefore, kAfter, handed);

  auto first = prepare(from);
  auto second = prepare(to);
  std::vector<float> spliced, other;
  run(first.get(), 0, kBefore, spliced);
  run(second.get(), 0, kBefore + kAfter, other);
  spliced.insert(spliced.end(), other.begin() + kBefore, other.end());

  const double handed_db = over_steady(handed);
  const double spliced_db = over_steady(spliced);
  std::printf("  %-44s %+6.1f dB over steady (unsmoothed %+6.1f)\n", name,
              handed_db, spliced_db);
  check(spliced_db > kControlDb, "control: spliced unsmoothed, the switch clicks");
  check(handed_db < kAllowedDb, "handed over, it does not");
}

FeqChainSettings quiet() {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.normalizer.mode = 0;
  settings.master.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.eq.enabled = 0;
  settings.exciter.enabled = 0;
  settings.dimension.enabled = 0;
  settings.bass_forge.enabled = 0;
  settings.bass_punch.enabled = 0;
  return settings;
}

void the_mono_maker_crosses() {
  std::printf("the mono maker, on, off and moved\n");
  FeqChainSettings off = quiet();
  off.eq.enabled = 1;
  FeqChainSettings at120 = off;
  at120.eq.mono_below_hz = 120.0;
  FeqChainSettings at240 = off;
  at240.eq.mono_below_hz = 240.0;
  switched("switched on at 120 Hz", off, at120);
  switched("switched off from 120 Hz", at120, off);
  switched("moved from 120 to 240 Hz", at120, at240);
}

void the_maximizer_glides_and_lets_go() {
  std::printf("the Maximizer's drive, and the stage switched off while limiting\n");
  // Drive under a ceiling the tones never reach, so the step is the drive's
  // alone rather than hidden in what a working limiter makes up top.
  FeqChainSettings open = quiet();
  open.maximizer.enabled = 1;
  open.maximizer.drive_db = 0.0;
  open.maximizer.ceiling_db = 0.0;
  open.maximizer.look_ahead_ms = 5.0;
  open.maximizer.release_ms = 100.0;
  FeqChainSettings pushed = open;
  pushed.maximizer.drive_db = 3.0;
  switched("drive 0 to 3 dB", open, pushed);
  switched("drive 3 to 0 dB", pushed, open);
  // A ceiling 4 dB under the tones' peaks with a slow release: the limiter
  // holds a steady reduction, and switching it off lets go of that.
  FeqChainSettings holding = open;
  holding.maximizer.ceiling_db = -11.0;
  holding.maximizer.release_ms = 1000.0;
  FeqChainSettings off = holding;
  off.maximizer.enabled = 0;
  switched("switched off while holding 4 dB", holding, off);
}

void bass_forge_fades_both_ways() {
  std::printf("Bass Forge switched off and on\n");
  FeqChainSettings off = quiet();
  FeqChainSettings on = off;
  on.bass_forge.enabled = 1;
  on.bass_forge.split_hz = 100.0;
  on.bass_forge.drive_db = 0.0;
  on.bass_forge.sub_amount = 0.0;
  on.bass_forge.presence_amount = 1.0;
  on.bass_forge.texture = 0.9;
  on.bass_forge.mix = 0.7;
  switched("switched off, normaliser and all", on, off);
  switched("switched on", off, on);
}

void dimension_arrives_with_its_network_filled() {
  std::printf("Dimension switched on\n");
  FeqChainSettings off = quiet();
  FeqChainSettings on = off;
  on.dimension.enabled = 1;
  on.dimension.low_width = 0.4;
  on.dimension.mid_width = 1.2;
  on.dimension.high_width = 1.6;
  on.dimension.low_hz = 260.0;
  on.dimension.high_hz = 2400.0;
  on.dimension.decorrelation = 0.5;
  switched("switched on, decorrelating", off, on);
  switched("switched off", on, off);
}

}  // namespace

int main() {
  the_mono_maker_crosses();
  the_maximizer_glides_and_lets_go();
  bass_forge_fades_both_ways();
  dimension_arrives_with_its_network_filled();
  return feq_test::finish();
}

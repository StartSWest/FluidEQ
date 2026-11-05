/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "../../dsp-host/src/wire.h"

namespace {
using feq_test::check;
constexpr double kRate = 48000.0;
constexpr double kPi = 3.14159265358979323846;
constexpr uint32_t kBlock = 512;
using Block = std::array<float, kBlock>;
using Spectrum = std::array<float, FEQ_METER_BINS>;

FeqChainSettings settings() {
  FeqChainSettings s{};
  feq_chain_settings_defaults(&s);
  s.enabled = 1;
  s.normalizer.mode = 0;
  s.eq.enabled = 0;
  s.exciter.enabled = 0;
  s.maximizer.enabled = 0;
  s.dimension.enabled = 0;
  s.master.enabled = 0;
  s.bass_forge.enabled = 0;
  s.bass_punch.enabled = 0;
  s.compander.enabled = 1;
  return s;
}

void flat_gain_taps() {
  auto s = settings();
  s.compander.makeup_db = 6.0;
  s.compander.mix = 0.5;
  s.master.enabled = 1;
  s.master.output_trim_db = -12.0;
  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_enabled(meters, 1);
  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(chain, meters);
  feq_chain_configure(chain, &s);
  Block left{}, right{};
  float* planes[2] = {left.data(), right.data()};
  Spectrum in{}, out{}, master{};
  for (uint32_t block = 0; block < 240; ++block) {
    for (uint32_t i = 0; i < kBlock; ++i) {
      left[i] = right[i] = static_cast<float>(0.03 * std::sin(
          2 * kPi * 1000 * (block * kBlock + i) / kRate));
    }
    feq_chain_process(chain, planes, kBlock);
    feq_meters_read_spectrum(meters, FEQ_METER_STAGE_DYNAMICS_IN, in.data(), FEQ_METER_BINS);
    feq_meters_read_spectrum(meters, FEQ_METER_STAGE_DYNAMICS_OUT, out.data(), FEQ_METER_BINS);
    feq_meters_read_spectrum(meters, FEQ_METER_STAGE_MASTER, master.data(), FEQ_METER_BINS);
  }
  const auto peak = static_cast<size_t>(std::max_element(in.begin(), in.end()) - in.begin());
  const double expected = 20 * std::log10(0.5 + 0.5 * std::pow(10.0, 6.0 / 20));
  FeqCompanderReport report{};
  feq_meters_read_dynamics(meters, &report);
  std::printf("Dynamics taps: gain %.4f dB (expected %.4f), Master delta %.4f\n",
              out[peak] - in[peak], expected, master[peak] - out[peak]);
  check(std::fabs(out[peak] - in[peak] - expected) < 0.02,
        "input/output taps measure the amplitude dry/wet blend");
  check(std::fabs(master[peak] - out[peak] + 12.0) < 0.05,
        "Dynamics output is captured before Master changes it");
  check(report.active == 1 && std::fabs(report.gain_db[1] - expected) < 0.0001,
        "reported current gain includes make-up and Mix");
  s.compander.enabled = 0;
  feq_chain_configure(chain, &s);
  feq_chain_process(chain, planes, kBlock);
  feq_meters_read_dynamics(meters, &report);
  check(report.active == 0 && report.gain_db[0] == 0 && report.gain_db[1] == 0 && report.gain_db[2] == 0,
        "bypass immediately clears old applied gains");
  feq_chain_destroy(chain); feq_meters_destroy(meters);
}

void movement_and_transparency(const char* capture_path) {
  auto s = settings();
  for (auto& band : s.compander.bands) {
    band.up_ratio = 2; band.up_max_db = 12; band.up_threshold_db = -40;
    band.down_ratio = 4; band.down_threshold_db = -24;
  }
  s.compander.release_ms = 100;
  s.compander.mix = 0.65;
  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_enabled(meters, 1);
  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  FeqChain* control = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(chain, meters);
  feq_chain_configure(chain, &s); feq_chain_configure(control, &s);
  Block left{}, right{}, control_left{}, control_right{};
  float* planes[2] = {left.data(), right.data()};
  float* control_planes[2] = {control_left.data(), control_right.data()};
  std::ofstream capture;
  if (capture_path != nullptr) capture.open(capture_path, std::ios::binary);
  check(capture_path == nullptr || capture.is_open(), "optional visual capture opens");
  double worst = 0;
  double largest_lift = 0;
  double deepest_hold = 0;
  Spectrum in{}, out{};
  for (uint32_t block = 0; block < 576; ++block) {
    for (uint32_t i = 0; i < kBlock; ++i) {
      const double time = (block * kBlock + i) / kRate;
      const double amplitude = time < 1.5 ? 0.001 : time < 3 ? 0.3 : time < 4.5 ? 0.015 : 0;
      double sample = 0;
      for (int harmonic = 1; harmonic <= 12; ++harmonic) {
        sample += amplitude / harmonic * std::sin(2 * kPi * 80 * harmonic * time);
        sample += amplitude / (harmonic * 3) * std::sin(2 * kPi * 620 * harmonic * time);
      }
      left[i] = control_left[i] = static_cast<float>(sample);
      right[i] = control_right[i] = static_cast<float>(-sample * 0.8);
    }
    feq_chain_process(chain, planes, kBlock);
    feq_chain_process(control, control_planes, kBlock);
    for (uint32_t i = 0; i < kBlock; ++i) {
      worst = std::max(worst, std::fabs(static_cast<double>(left[i]) - control_left[i]));
      worst = std::max(worst, std::fabs(static_cast<double>(right[i]) - control_right[i]));
    }
    if (block % 4 != 3) continue;
    const bool fresh_in = feq_meters_read_spectrum(meters, FEQ_METER_STAGE_DYNAMICS_IN, in.data(), FEQ_METER_BINS) != 0;
    const bool fresh_out = feq_meters_read_spectrum(meters, FEQ_METER_STAGE_DYNAMICS_OUT, out.data(), FEQ_METER_BINS) != 0;
    check(fresh_in && fresh_out, "both Dynamics spectra publish together");
    FeqCompanderReport report{};
    feq_meters_read_dynamics(meters, &report);
    for (float gain : report.gain_db) {
      largest_lift = std::max(largest_lift, static_cast<double>(gain));
      deepest_hold = std::min(deepest_hold, static_cast<double>(gain));
    }
    if (capture.is_open()) {
      FeqWireAnalysisFrame frame{};
      frame.magic = FEQ_MAGIC_ANALYSIS; frame.sequence = block / 4 + 1;
      frame.stage_mask = (1u << FEQ_METER_STAGE_DYNAMICS_IN) | (1u << FEQ_METER_STAGE_DYNAMICS_OUT);
      frame.bins = FEQ_METER_BINS;
      feq_wire_dynamics_report(frame, report);
      const uint32_t bytes = static_cast<uint32_t>(sizeof(frame) + sizeof(in) + sizeof(out));
      capture.write(reinterpret_cast<const char*>(&bytes), sizeof(bytes));
      capture.write(reinterpret_cast<const char*>(&frame), sizeof(frame));
      capture.write(reinterpret_cast<const char*>(in.data()), sizeof(in));
      capture.write(reinterpret_cast<const char*>(out.data()), sizeof(out));
    }
  }
  FeqCompanderReport silence{}; feq_meters_read_dynamics(meters, &silence);
  std::printf("Dynamics movement: lift %.3f dB, hold %.3f dB, audio difference %.1e\n", largest_lift, deepest_hold, worst);
  check(largest_lift > 5 && deepest_hold < -3, "quiet and loud passages move measured gains in both directions");
  check(std::fabs(silence.gain_db[0]) < 0.05 && silence.level_db[0] < -100,
        "silence settles at neutral, with no artificial motion");
  check(worst == 0, "publishing Dynamics measurements changes no audio samples");
  feq_chain_destroy(control); feq_chain_destroy(chain); feq_meters_destroy(meters);
}
}  // namespace

int main(int argc, char** argv) {
  flat_gain_taps();
  movement_and_transparency(argc > 1 ? argv[1] : nullptr);
  return feq_test::g_failures == 0 ? 0 : 1;
}

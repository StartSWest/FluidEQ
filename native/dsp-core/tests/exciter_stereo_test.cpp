/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter in Mid only and Sides only: what the page is told, and what
 * Timing does to the stereo picture.
 *
 * Reported from the listening chair (2026-10-13): in Mid only and Sides only
 * "the bars disappear and it sounds weird". The bars came from the left
 * channel's path alone, which neither mode runs; and Timing turned only the
 * half being processed, so decoding moved sound from one side to the other.
 */

#include "../src/chain_internal.h"
#include "dsp_test_support.h"
#include "fluideq/phase_align.h"

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

namespace {

using feq_test::check;
using feq_test::kPi;

constexpr double kRate = 48000.0;
constexpr uint32_t kBlock = 480;
constexpr uint32_t kBlocks = 200;

using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

FeqChainSettings exciter_only(FeqStereoMode mode) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.normalizer.mode = 0;
  settings.master.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.eq.enabled = 0;
  settings.dimension.enabled = 0;
  settings.bass_forge.enabled = 0;
  settings.bass_punch.enabled = 0;
  settings.exciter.enabled = 1;
  settings.exciter.stereo = mode;
  return settings;
}

Rack prepare(const FeqChainSettings& settings) {
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  return rack;
}

/** `kBlocks` blocks of `left` and `right` through the rack, in place. */
void run(FeqChain* rack, std::vector<float>& left, std::vector<float>& right) {
  for (uint32_t block = 0; block < kBlocks; ++block) {
    float* planes[2] = {left.data() + block * kBlock,
                        right.data() + block * kBlock};
    feq_chain_process(rack, planes, kBlock);
  }
}

double rms_db(const std::vector<float>& samples, size_t from) {
  double sum = 0.0;
  for (size_t at = from; at < samples.size(); ++at) {
    sum += static_cast<double>(samples[at]) * static_cast<double>(samples[at]);
  }
  const double mean = sum / static_cast<double>(samples.size() - from);
  return mean > 0.0 ? 10.0 * std::log10(mean) : -400.0;
}

/**
 * Every mode reports what the stage made: the bands and Organic, from the
 * path that is making it. Positive control: the stage switched off reports
 * nothing, so a reading above zero is the stage's.
 */
void every_mode_reports_its_bands() {
  std::printf("every stereo mode reports what the stage made\n");
  const size_t frames = static_cast<size_t>(kBlock) * kBlocks;
  for (const FeqStereoMode mode :
       {FEQ_STEREO_STEREO, FEQ_STEREO_MID, FEQ_STEREO_SIDE}) {
    for (const bool enabled : {true, false}) {
      FeqChainSettings settings = exciter_only(mode);
      settings.exciter.enabled = enabled ? 1 : 0;
      settings.exciter.organic_enabled = 1;
      settings.exciter.organic_amount = 0.4;
      for (auto& band : settings.exciter.bands) {
        band.enabled = 1;
        band.mix = 0.8;
      }
      Rack rack = prepare(settings);
      // Two different programmes on the two sides, so Mid and Side both
      // carry something to excite.
      std::vector<float> left(frames), right(frames);
      for (size_t at = 0; at < frames; ++at) {
        const double t = static_cast<double>(at) / kRate;
        left[at] = static_cast<float>(0.2 * std::sin(2 * kPi * 90.0 * t) +
                                      0.1 * std::sin(2 * kPi * 1000.0 * t) +
                                      0.05 * std::sin(2 * kPi * 7000.0 * t));
        right[at] = static_cast<float>(0.2 * std::sin(2 * kPi * 70.0 * t) +
                                       0.1 * std::sin(2 * kPi * 1300.0 * t) +
                                       0.05 * std::sin(2 * kPi * 8200.0 * t));
      }
      run(rack.get(), left, right);
      double bands = 0.0;
      for (const double band : rack->exciter_band_report) {
        bands = std::max(bands, band);
      }
      const double organic = rack->exciter_organic_report;
      const char* names[] = {"Stereo", "Mid only", "Sides only"};
      std::printf("  %-10s %-4s bands %.3f  organic %.3f\n", names[mode],
                  enabled ? "on" : "off", bands, organic);
      if (enabled) {
        check(bands > 0.1, "the bands report while the stage works");
        check(organic > 0.01, "Organic reports while the stage works");
      } else {
        check(bands == 0.0 && organic == 0.0, "control: off reports nothing");
      }
    }
  }
}

/**
 * Timing keeps a hard-left sound on the left in every mode.
 *
 * Bands and Organic off, so Timing is all the stage does: two all-passes
 * that are linear and the same on both channels leave a silent right channel
 * silent, and every mode then plays exactly what Stereo plays. The control
 * is the defect itself — the same aligner on Mid alone — which puts the
 * tone on the right, so a test that read silence there for every input
 * would fail it.
 */
void timing_keeps_the_picture() {
  std::printf("Timing keeps a hard-left sound on the left\n");
  const size_t frames = static_cast<size_t>(kBlock) * kBlocks;
  // Where the two sections reach 180 degrees at the default amount.
  constexpr double kFlipHz = 707.0;
  const auto hard_left = [&](std::vector<float>& left,
                             std::vector<float>& right) {
    left.assign(frames, 0.0f);
    right.assign(frames, 0.0f);
    for (size_t at = 0; at < frames; ++at) {
      left[at] = static_cast<float>(
          0.3 * std::sin(2 * kPi * kFlipHz * static_cast<double>(at) / kRate));
    }
  };
  std::vector<float> stereo_left;
  for (const FeqStereoMode mode :
       {FEQ_STEREO_STEREO, FEQ_STEREO_MID, FEQ_STEREO_SIDE}) {
    FeqChainSettings settings = exciter_only(mode);
    for (auto& band : settings.exciter.bands) band.enabled = 0;
    settings.exciter.organic_enabled = 0;
    settings.exciter.align_enabled = 1;
    settings.exciter.align_amount = 0.45;
    Rack rack = prepare(settings);
    std::vector<float> left, right;
    hard_left(left, right);
    run(rack.get(), left, right);
    const double right_db = rms_db(right, frames / 2);
    std::printf("  mode %d: right channel %.1f dB, left %.1f dB\n",
                static_cast<int>(mode), right_db, rms_db(left, frames / 2));
    check(right_db < -120.0, "the right channel stays silent");
    if (mode == FEQ_STEREO_STEREO) {
      stereo_left = left;
    } else {
      double largest = 0.0;
      for (size_t at = 0; at < frames; ++at) {
        largest = std::max(largest, std::fabs(static_cast<double>(left[at]) -
                                              stereo_left[at]));
      }
      check(largest < 1e-6, "every mode times the programme as Stereo does");
    }
  }

  // CONTROL: Timing on Mid alone, as it ran before.
  std::vector<float> left, right;
  hard_left(left, right);
  FeqPhaseAlign aligner{};
  feq_phase_align_init(&aligner);
  std::vector<float> mid(kBlock), side(kBlock);
  for (uint32_t block = 0; block < kBlocks; ++block) {
    float* l = left.data() + block * kBlock;
    float* r = right.data() + block * kBlock;
    for (uint32_t at = 0; at < kBlock; ++at) {
      mid[at] = 0.5f * (l[at] + r[at]);
      side[at] = 0.5f * (l[at] - r[at]);
    }
    feq_phase_align_process(&aligner, mid.data(), kBlock, 0.45, kRate);
    for (uint32_t at = 0; at < kBlock; ++at) {
      l[at] = mid[at] + side[at];
      r[at] = mid[at] - side[at];
    }
  }
  const double leaked = rms_db(right, frames / 2);
  std::printf("  control, Mid alone turned: right channel %.1f dB\n", leaked);
  check(leaked > -20.0, "control: turning Mid alone moves the tone right");
}

}  // namespace

int main() {
  every_mode_reports_its_bands();
  timing_keeps_the_picture();
  return feq_test::finish();
}

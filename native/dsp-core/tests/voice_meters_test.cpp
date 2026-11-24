/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A mic's readings (engine 1.32): the voice as it arrives and as the cleaner
 * hears it, either side of the low cut, and the gate's own level and gain.
 *
 * Where each tap stands is the question, not whether a transform measures:
 * a tap taken one stage early reads a real spectrum of the wrong signal and
 * every check of the transform still passes. So the low cut's own response
 * is read as the gap between the two taps, beside a control with the cut off
 * where that gap is nothing. The gate's level is held to the voice after the
 * cleaner, not the mic's; the readings change no sample, at every shared-mode
 * rate; and an output's rack carries neither tap nor the arrival tap's ring.
 */

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/meters.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;
constexpr std::array<double, 8> kRates = {44100.0,  48000.0,  88200.0,
                                          96000.0,  176400.0, 192000.0,
                                          352800.0, 384000.0};
using Spectrum = std::array<float, FEQ_METER_BINS>;
using Detail = std::array<float, FEQ_METER_DETAIL_BINS>;

FeqChainSettings mic(double low_cut_hz) {
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
  s.compander.enabled = 0;
  s.denoise.enabled = 0;
  s.voice.enabled = 1;
  s.voice.low_cut_hz = low_cut_hz;
  s.voice.gate_enabled = 1;
  s.voice.gate_threshold_db = -50.0;
  s.voice.gate_range_db = 15.0;
  return s;
}

/** The magnitude of the voice's 12 dB/oct Butterworth high-pass, dB. */
double high_pass_db(double f, double corner) {
  const double r = (f / corner) * (f / corner);
  return 20.0 * std::log10(r / std::sqrt(1.0 + r * r));
}

struct Rig {
  FeqMeters* meters = nullptr;
  FeqChain* chain = nullptr;
  uint32_t block = 0;
  std::vector<float> left, right;

  Rig(double rate, const FeqChainSettings& settings, bool metered) {
    block = static_cast<uint32_t>(rate / 100.0);
    left.assign(block, 0.0f);
    right.assign(block, 0.0f);
    chain = feq_chain_create(rate, 2, block);
    if (metered) {
      meters = feq_meters_create(2);
      feq_meters_set_sample_rate(meters, rate);
      feq_meters_set_enabled(meters, 1);
    }
    feq_chain_configure(chain, &settings);
    if (metered) feq_chain_set_meters(chain, meters);
  }
  ~Rig() {
    feq_chain_destroy(chain);
    feq_meters_destroy(meters);
  }
  Rig(const Rig&) = delete;
  Rig& operator=(const Rig&) = delete;

  /** One 10 ms block of `sample(t)` on both channels. */
  template <typename Sample>
  void run(double rate, uint64_t& at, Sample sample) {
    for (uint32_t i = 0; i < block; ++i, ++at) {
      left[i] = right[i] = static_cast<float>(sample(at / rate));
    }
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(chain, planes, block);
  }
};

/** The bin nearest `f` in a window of `size` at `rate`. */
size_t bin_of(double f, double rate, uint32_t size) {
  return static_cast<size_t>(std::lround(f * size / rate));
}

float peak_near(const float* bins, size_t centre, size_t count) {
  float best = -400.0f;
  for (size_t k = centre > 1 ? centre - 1 : 0; k <= centre + 1 && k < count;
       ++k) {
    best = std::max(best, bins[k]);
  }
  return best;
}

/**
 * At 48 kHz, where both tones sit clear of each other in the 2048-point
 * windows: the gap between the arrival and cleaner taps at 50 Hz is the low
 * cut's response there, and at 1 kHz nothing; with the cut off, nothing at
 * either. The arrival tap's long window resolves 50 Hz from a tone 20 Hz
 * above it, which its short window cannot.
 */
void the_taps_stand_either_side_of_the_low_cut() {
  constexpr double rate = 48000.0;
  constexpr double corner = 150.0;
  const auto tones = [](double t) {
    return 0.1 * std::sin(2 * kPi * 50 * t) +
           0.05 * std::sin(2 * kPi * 1000 * t);
  };
  for (const double cut : {corner, 0.0}) {
    Rig rig(rate, mic(cut), true);
    uint64_t at = 0;
    Spectrum arriving{}, cleaner{};
    for (int b = 0; b < 300; ++b) {
      rig.run(rate, at, tones);
      feq_meters_read_spectrum(rig.meters, FEQ_METER_STAGE_VOICE_IN,
                               arriving.data(), FEQ_METER_BINS);
      feq_meters_read_spectrum(rig.meters, FEQ_METER_STAGE_CLEANER_IN,
                               cleaner.data(), FEQ_METER_BINS);
    }
    const size_t low = bin_of(50, rate, FEQ_METER_WINDOW);
    const size_t high = bin_of(1000, rate, FEQ_METER_WINDOW);
    const double low_gap = peak_near(cleaner.data(), low, FEQ_METER_BINS) -
                           peak_near(arriving.data(), low, FEQ_METER_BINS);
    const double high_gap = peak_near(cleaner.data(), high, FEQ_METER_BINS) -
                            peak_near(arriving.data(), high, FEQ_METER_BINS);
    const double expected = cut > 0 ? high_pass_db(50, cut) : 0.0;
    std::printf("cut %.0f Hz: 50 Hz gap %.2f dB (filter %.2f), 1 kHz gap %.2f\n",
                cut, low_gap, expected, high_gap);
    check(std::fabs(low_gap - expected) < 1.5,
          cut > 0 ? "the 50 Hz gap between the taps is the low cut's response"
                  : "with the cut off the taps agree at 50 Hz (control)");
    check(std::fabs(high_gap) < 0.3,
          "the taps agree at 1 kHz, where the cut takes nothing");
  }

  // Resolution: 50 and 70 Hz together.
  Rig rig(rate, mic(0.0), true);
  uint64_t at = 0;
  Spectrum arriving{};
  Detail detail{};
  int long_reads = 0;
  for (int b = 0; b < 300; ++b) {
    rig.run(rate, at, [](double t) {
      return 0.1 * std::sin(2 * kPi * 50 * t) + 0.1 * std::sin(2 * kPi * 70 * t);
    });
    feq_meters_read_spectrum(rig.meters, FEQ_METER_STAGE_VOICE_IN,
                             arriving.data(), FEQ_METER_BINS);
    long_reads += feq_meters_read_voice_detail(rig.meters, detail.data(),
                                               FEQ_METER_DETAIL_BINS);
  }
  const auto dip = [&](const float* bins, uint32_t size) {
    const size_t a = bin_of(50, rate, size), b = bin_of(70, rate, size);
    const size_t m = bin_of(60, rate, size);
    return std::min(bins[a], bins[b]) - bins[m];
  };
  const double long_dip = dip(detail.data(), FEQ_METER_DETAIL_WINDOW);
  const double short_dip = dip(arriving.data(), FEQ_METER_WINDOW);
  const double level = detail[bin_of(50, rate, FEQ_METER_DETAIL_WINDOW)];
  std::printf("50 + 70 Hz: long window dip %.1f dB, short %.1f dB, "
              "50 Hz at %.1f dB, %d long reads\n",
              long_dip, short_dip, level, long_reads);
  check(long_reads > 0, "the arrival tap carries its long window");
  check(long_dip > 20, "the long window tells 50 Hz from 70 Hz");
  check(short_dip < 3, "the short window cannot (control)");
}

/**
 * The gate's level is its detector's, behind the cleaner, and its gain is
 * what it applied; both reach the meters at every rate, and reading them
 * changes no sample of what leaves the rack.
 */
void the_gate_reports_itself_and_nothing_changes(double rate) {
  Rig metered(rate, mic(80.0), true);
  Rig plain(rate, mic(80.0), false);
  uint64_t at_metered = 0, at_plain = 0;
  double worst = 0;
  const auto speech = [](double t) {
    return t < 1.0 ? 0.0316 * std::sin(2 * kPi * 1000 * t) : 0.0;
  };
  FeqVoiceReport open{}, closed{};
  for (int b = 0; b < 250; ++b) {
    metered.run(rate, at_metered, speech);
    plain.run(rate, at_plain, speech);
    for (uint32_t i = 0; i < metered.block; ++i) {
      worst = std::max(worst, std::fabs(static_cast<double>(metered.left[i]) -
                                        plain.left[i]));
    }
    if (b == 90) feq_meters_read_voice(metered.meters, &open);
  }
  feq_meters_read_voice(metered.meters, &closed);
  Spectrum arriving{};
  // Past the first second only silence has played; the arrival tap still
  // answers, which is all asked of it here.
  const int short_read = feq_meters_read_spectrum(
      metered.meters, FEQ_METER_STAGE_VOICE_IN, arriving.data(),
      FEQ_METER_BINS);
  std::printf("%6.0f Hz: open %.1f dB at %.1f dB, closed %.1f dB at %.1f dB, "
              "difference %.1e\n",
              rate, open.gate_gain_db, open.gate_level_db, closed.gate_gain_db,
              closed.gate_level_db, worst);
  check(open.active == 1 && open.gate_gain_db > -0.01,
        "a voice over the threshold reads the gate open");
  check(std::fabs(open.gate_level_db + 30.0) < 3.0,
        "the gate's level is the voice's, -30 dBFS");
  check(closed.gate_gain_db < -14.9 && closed.gate_level_db < -100,
        "silence reads it closed to its range, at the floor");
  check(short_read != 0, "the arrival tap answers at this rate");
  check(worst == 0, "reading a mic changes no sample of what it sends");
}

/** An output's rack: no voice, so no ring is made and nothing is captured. */
void an_output_carries_no_mic_taps() {
  constexpr double rate = 48000.0;
  auto s = mic(80.0);
  s.voice.enabled = 0;
  Rig rig(rate, s, true);
  uint64_t at = 0;
  Spectrum spectrum{};
  Detail detail{};
  int voice_reads = 0, cleaner_reads = 0, long_reads = 0;
  for (int b = 0; b < 100; ++b) {
    rig.run(rate, at, [](double t) { return 0.1 * std::sin(2 * kPi * 440 * t); });
    voice_reads += feq_meters_read_spectrum(rig.meters, FEQ_METER_STAGE_VOICE_IN,
                                            spectrum.data(), FEQ_METER_BINS);
    cleaner_reads += feq_meters_read_spectrum(
        rig.meters, FEQ_METER_STAGE_CLEANER_IN, spectrum.data(), FEQ_METER_BINS);
    long_reads += feq_meters_read_voice_detail(rig.meters, detail.data(),
                                               FEQ_METER_DETAIL_BINS);
  }
  FeqVoiceReport report{};
  feq_meters_read_voice(rig.meters, &report);
  const int denoise_reads = feq_meters_read_spectrum(
      rig.meters, FEQ_METER_STAGE_DENOISE, spectrum.data(), FEQ_METER_BINS);
  std::printf("output: %d voice, %d cleaner, %d long reads, active %u\n",
              voice_reads, cleaner_reads, long_reads, report.active);
  check(voice_reads == 0 && cleaner_reads == 0 && long_reads == 0,
        "an output's rack publishes neither mic tap");
  check(report.active == 0 && report.gate_level_db <= -119.0f,
        "and its gate reads inactive");
  check(denoise_reads != 0, "while its own taps still publish (control)");
}

}  // namespace

int main() {
  the_taps_stand_either_side_of_the_low_cut();
  for (const double rate : kRates) {
    the_gate_reports_itself_and_nothing_changes(rate);
  }
  an_output_carries_no_mic_taps();
  return feq_test::finish();
}

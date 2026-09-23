/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Isolate on a dynamic band plays what the band changes, and nothing beside.
 *
 * Isolate runs the EQ through its linear-phase kernel and subtracts the dry
 * signal, so a static band is heard as |H| - 1: its own change, zero away from
 * it. A dynamic band used to run after the kernel as a minimum-phase biquad,
 * and the subtraction then left H - 1 — the band's phase as well as its
 * level. Away from a narrow bell the level is one and the phase is not zero,
 * so the whole record leaked through around it: reported as "I hear too much
 * of the nearby frequencies, only when Dynamic is on" (2026-09-22), measured
 * on pink noise at +14 dB an octave either side and +25 dB under 2 kHz.
 *
 * The measure is a sine held away from the band, through Isolate with the
 * band dynamic and fully open, against the same rack with the band static.
 * Two controls stand beside it, on the same measure: at the band's centre
 * the monitor must carry the band's full change (a monitor that played
 * nothing would pass the leak test), and the old arithmetic — the biquad's
 * change, H - 1 — must read as the leak at the same frequency.
 */

#include "fluideq/biquad.h"
#include "fluideq/chain.h"

#include "dsp_test_support.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {

using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

constexpr uint32_t kBlock = 480;
constexpr double kBand = 4269.0;
constexpr double kGainDb = 5.4;
constexpr double kQuality = 9.1;
constexpr double kLevel = 0.1;
/** Long enough for the kernel's warm-up and the detector to settle first. */
constexpr double kSeconds = 2.0;
constexpr double kMeasureFrom = 1.2;

FeqChainSettings rack_of(FeqPhaseMode phase, FeqEqEngine engine,
                         int dynamic) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.isolate = 1;
  settings.eq.phase = phase;
  settings.eq.engine = engine;
  settings.eq.stereo = FEQ_STEREO_STEREO;
  settings.eq.oversample = 1;
  settings.eq.band_count = 1;
  FeqChainEqBand& band = settings.eq.bands[0];
  band.enabled = 1;
  band.type = FEQ_FILTER_PK;
  band.frequency = kBand;
  band.gain_db = kGainDb;
  band.quality = kQuality;
  band.dynamic = dynamic;
  // Far under anything played: dynamic, the band is fully open, which is
  // exactly the static band's gain — so the two monitors should agree.
  band.threshold_db = -140.0;
  return settings;
}

/** A sine through the rack; the level of what Isolate plays, in dB re input. */
double monitored_db(const FeqChainSettings& settings, double hz) {
  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_configure(chain, &settings);
  const auto total =
      static_cast<size_t>(kRate * kSeconds) / kBlock * kBlock;
  const auto from = static_cast<size_t>(kRate * kMeasureFrom);
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  const double step = (2.0 * kPi * hz) / kRate;
  double phase = 0.0;
  double power = 0.0;
  size_t counted = 0;
  for (size_t at = 0; at < total; at += kBlock) {
    for (uint32_t index = 0; index < kBlock; ++index) {
      left[index] = static_cast<float>(kLevel * std::sin(phase));
      right[index] = left[index];
      phase += step;
    }
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(chain, planes, kBlock);
    for (uint32_t index = 0; index < kBlock; ++index) {
      if (at + index >= from) {
        power += static_cast<double>(left[index]) *
                 static_cast<double>(left[index]);
        counted += 1;
      }
    }
  }
  feq_chain_destroy(chain);
  const double input_power = kLevel * kLevel / 2.0;
  return 10.0 *
         std::log10(power / static_cast<double>(counted) / input_power + 1e-30);
}

/** The old engine's arithmetic: the biquad's change, H - 1, in dB re input. */
double biquad_change_db(double hz) {
  const FeqBiquadCoefficients filter =
      feq_biquad_coefficients(FEQ_FILTER_PK, kBand, kGainDb, kQuality, kRate);
  FeqBiquadState state;
  feq_biquad_reset(&state);
  const auto total = static_cast<size_t>(kRate * kSeconds);
  const auto from = static_cast<size_t>(kRate * kMeasureFrom);
  std::vector<float> dry(total);
  const double step = (2.0 * kPi * hz) / kRate;
  for (size_t at = 0; at < total; ++at) {
    dry[at] =
        static_cast<float>(kLevel * std::sin(step * static_cast<double>(at)));
  }
  std::vector<float> wet = dry;
  feq_biquad_process(&state, wet.data(), static_cast<uint32_t>(total), &filter);
  double power = 0.0;
  for (size_t at = from; at < total; ++at) {
    const double change =
        static_cast<double>(wet[at]) - static_cast<double>(dry[at]);
    power += change * change;
  }
  const double input_power = kLevel * kLevel / 2.0;
  return 10.0 * std::log10(power / static_cast<double>(total - from) /
                               input_power +
                           1e-30);
}

/** What a static band's monitor is at the centre: 20log10(|H| - 1). */
double centre_change_db() {
  return 20.0 * std::log10(std::pow(10.0, kGainDb / 20.0) - 1.0);
}

void isolate_plays_only_the_band(const char* label, FeqPhaseMode phase,
                                 FeqEqEngine engine) {
  std::printf("%s\n", label);
  const FeqChainSettings still = rack_of(phase, engine, 0);
  const FeqChainSettings dynamic = rack_of(phase, engine, 1);

  const double centre_static = monitored_db(still, kBand);
  const double centre_dynamic = monitored_db(dynamic, kBand);
  std::printf("  at %.0f Hz: static %.2f dB, dynamic %.2f dB, |H| - 1 is "
              "%.2f dB\n",
              kBand, centre_static, centre_dynamic, centre_change_db());
  check(std::fabs(centre_static - centre_change_db()) < 0.5,
        "positive control: the static band's monitor carries its change");
  check(std::fabs(centre_dynamic - centre_change_db()) < 0.5,
        "the open dynamic band's monitor carries the same change");

  // An octave under the band, and far under it: where the leak was loudest.
  const double away[] = {kBand / 2.0, 1000.0};
  for (const double hz : away) {
    const double at_static = monitored_db(still, hz);
    const double at_dynamic = monitored_db(dynamic, hz);
    const double leak = biquad_change_db(hz);
    std::printf("  at %.0f Hz: static %.1f dB, dynamic %.1f dB, H - 1 is "
                "%.1f dB\n",
                hz, at_static, at_dynamic, leak);
    check(leak > at_static + 10.0,
          "positive control: H - 1 reads as a leak on this measure");
    check(at_dynamic < at_static + 3.0 || at_dynamic < -60.0,
          "the dynamic band leaks nothing beside itself");
  }
}

}  // namespace

int main() {
  isolate_plays_only_the_band("linear phase, serial", FEQ_PHASE_LINEAR,
                              FEQ_EQ_SERIAL);
  isolate_plays_only_the_band("minimum phase, serial", FEQ_PHASE_MINIMUM,
                              FEQ_EQ_SERIAL);
  isolate_plays_only_the_band("linear phase, parallel", FEQ_PHASE_LINEAR,
                              FEQ_EQ_PARALLEL);
  return feq_test::finish();
}

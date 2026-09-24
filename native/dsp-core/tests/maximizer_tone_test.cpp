/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Maximizer limiting through the curve that plays after it.
 *
 * A preset's tone is a layer of the main EQ, after the rack, and an EQ after
 * a limiter puts back the peaks it took off. These hold the three things the
 * curve on the wire must do: land the programme on the ceiling once the
 * layer has played (with the same rack told nothing as the control, which
 * goes over), cancel exactly where nothing is limited, and carry across a
 * chain handover like every other history.
 */

#include <algorithm>
#include <cmath>
#include <iterator>
#include <memory>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/primitives.h"
#include "room_contract_fixture.h"

using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

namespace {

constexpr uint32_t kBlock = 256;
using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

/** A curve like a genre's: a bass shelf, a sub bell and a presence lift. */
const FeqChainToneBand kCurve[] = {
    {FEQ_FILTER_LSC, 100.0, 4.0, 0.707},
    {FEQ_FILTER_PK, 55.0, 3.0, 1.4},
    {FEQ_FILTER_PK, 3000.0, 2.5, 1.0},
};
constexpr uint32_t kCurveBands = 3;

FeqChainSettings rack_settings(bool told_the_curve, double drive_db) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.maximizer.enabled = 1;
  settings.maximizer.drive_db = drive_db;
  settings.maximizer.ceiling_db = -1.0;
  settings.maximizer.look_ahead_ms = 5.0;
  settings.maximizer.release_ms = 100.0;
  if (told_the_curve) {
    settings.tone.band_count = kCurveBands;
    std::copy(std::begin(kCurve), std::end(kCurve), settings.tone.bands);
  }
  return settings;
}

/**
 * A master as a limiter leaves it: bass, low mids and presence summed, then
 * clipped softly at full scale, so its peaks are where its parts arrive in
 * step — which is exactly what an EQ's phase turn undoes.
 */
feq_test::Signal master(double seconds, double level) {
  const size_t frames = static_cast<size_t>(seconds * kRate);
  feq_test::Signal signal{std::vector<float>(frames),
                          std::vector<float>(frames)};
  for (size_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    // A kick every half second under a steady bass line.
    const double beat = std::fmod(t, 0.5);
    const double kick =
        std::exp(-beat * 18.0) * std::sin(2.0 * kPi * 52.0 * beat);
    const double body = 0.55 * std::sin(2.0 * kPi * 55.0 * t) +
                        0.35 * std::sin(2.0 * kPi * 220.0 * t + 0.7) +
                        0.25 * std::sin(2.0 * kPi * 2000.0 * t + 1.9) + kick;
    const double shaped = std::tanh(1.6 * body) * level;
    signal.left[at] = static_cast<float>(shaped);
    signal.right[at] = static_cast<float>(
        shaped * 0.9 + 0.05 * level * std::sin(2.0 * kPi * 700.0 * t));
  }
  return signal;
}

/** Through a rack a block at a time; the output is lined up with the input. */
feq_test::Signal through(const FeqChainSettings& settings,
                         const feq_test::Signal& input) {
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  feq_test::Signal output = input;
  for (size_t at = 0; at + kBlock <= output.left.size(); at += kBlock) {
    float* planes[2] = {output.left.data() + at, output.right.data() + at};
    feq_chain_process(rack.get(), planes, kBlock);
  }
  const size_t latency = feq_chain_latency_frames(rack.get());
  output.left.erase(output.left.begin(),
                    output.left.begin() + static_cast<long>(latency));
  output.right.erase(output.right.begin(),
                     output.right.begin() + static_cast<long>(latency));
  return output;
}

/** The curve as the layer after the rack plays it. */
void play_curve(feq_test::Signal& signal) {
  for (std::vector<float>* channel : {&signal.left, &signal.right}) {
    for (const FeqChainToneBand& band : kCurve) {
      const FeqBiquadCoefficients coefficients = feq_biquad_coefficients(
          band.type, band.frequency, band.gain_db, band.quality, kRate);
      FeqBiquadState state{};
      feq_biquad_process(&state, channel->data(),
                         static_cast<uint32_t>(channel->size()),
                         &coefficients);
    }
  }
}

/** True peak in dBTP from `from` on, both channels. */
double true_peak_db(const feq_test::Signal& signal, size_t from) {
  FeqTruePeak left{};
  FeqTruePeak right{};
  feq_true_peak_init(&left, 4);
  feq_true_peak_init(&right, 4);
  double peak = 0.0;
  for (size_t at = 0; at < signal.left.size(); ++at) {
    const double a = feq_true_peak_sample(&left, signal.left[at]);
    const double b = feq_true_peak_sample(&right, signal.right[at]);
    if (at >= from) {
      peak = std::max(peak, std::max(a, b));
    }
  }
  return 20.0 * std::log10(std::max(peak, 1e-12));
}

void lands_on_the_ceiling_once_the_curve_has_played() {
  const feq_test::Signal input = master(4.0, 1.0);
  const size_t settle = static_cast<size_t>(kRate);
  feq_test::Signal told = through(rack_settings(true, 2.0), input);
  feq_test::Signal blind = through(rack_settings(false, 2.0), input);
  const double told_rack = true_peak_db(told, settle);
  const double blind_rack = true_peak_db(blind, settle);
  play_curve(told);
  play_curve(blind);
  const double told_after = true_peak_db(told, settle);
  const double blind_after = true_peak_db(blind, settle);
  std::printf(
      "  rack told the curve: %.2f dBTP leaving, %.2f after the curve\n"
      "  rack told nothing:   %.2f dBTP leaving, %.2f after the curve\n",
      told_rack, told_after, blind_rack, blind_after);
  check(blind_after > -1.0 + 1.0,
        "control: a rack told nothing is pushed over its ceiling by the curve");
  check(told_after <= -1.0 + 0.15,
        "a rack told the curve lands on its ceiling once the curve has played");
}

void cancels_where_nothing_is_limited() {
  const feq_test::Signal input = master(2.0, 0.08);
  feq_test::Signal output = through(rack_settings(true, 0.0), input);
  double worst = 0.0;
  for (size_t at = 0; at < output.left.size(); ++at) {
    worst = std::max(worst, std::fabs(static_cast<double>(output.left[at]) -
                                      static_cast<double>(input.left[at])));
    worst = std::max(worst, std::fabs(static_cast<double>(output.right[at]) -
                                      static_cast<double>(input.right[at])));
  }
  std::printf("  quiet programme through the curve and back: %.2e worst\n",
              worst);
  check(worst < 2e-6,
        "the curve and its inverse cancel where the limiter does nothing");
}

void carries_across_a_handover() {
  const FeqChainSettings settings = rack_settings(true, 2.0);
  const feq_test::Signal input = master(2.0, 1.0);
  feq_test::Signal whole = input;
  feq_test::Signal handed = input;
  Rack reference(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  Rack first(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(reference.get(), &settings);
  feq_chain_configure(first.get(), &settings);
  // Prepared as the engine prepares a chain before a handover: one block
  // through it, then back to a stream's start, so what it was configured
  // with has been taken up and nothing is pending.
  Rack second(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(second.get(), &settings);
  std::vector<float> silence(static_cast<size_t>(kBlock) * 2, 0.0f);
  float* silent[2] = {silence.data(), silence.data() + kBlock};
  feq_chain_process(second.get(), silent, kBlock);
  feq_chain_reset(second.get(), FEQ_CHAIN_RESET_STREAM_START);
  const size_t handover = static_cast<size_t>(kRate) / kBlock * kBlock;
  double worst = 0.0;
  for (size_t at = 0; at + kBlock <= input.left.size(); at += kBlock) {
    if (at == handover) {
      check(feq_chain_transfer_state(second.get(), first.get()) != 0,
            "the handover is accepted");
    }
    FeqChain* running = at < handover ? first.get() : second.get();
    float* planes[2] = {handed.left.data() + at, handed.right.data() + at};
    feq_chain_process(running, planes, kBlock);
    float* reference_planes[2] = {whole.left.data() + at,
                                  whole.right.data() + at};
    feq_chain_process(reference.get(), reference_planes, kBlock);
    if (at >= handover) {
      for (uint32_t frame = 0; frame < kBlock; ++frame) {
        worst = std::max(worst, std::fabs(static_cast<double>(
                                              handed.left[at + frame]) -
                                          static_cast<double>(
                                              whole.left[at + frame])));
      }
    }
  }
  std::printf("  after a handover, against one rack all along: %.2e\n", worst);
  check(worst < 1e-5, "the curve's histories carry across a handover");
}

bool decode(const std::vector<double>& wire, FeqChainSettings* out) {
  return feq_chain_settings_decode(wire.data(),
                                   static_cast<uint32_t>(wire.size()),
                                   out) != 0;
}

void reads_the_curve_off_the_wire() {
  const std::vector<double> room(std::begin(kRoomContractFixture),
                                 std::end(kRoomContractFixture));
  const auto with_tone = [](std::vector<double> wire, double matched) {
    wire.insert(wire.end(), {FEQ_CHAIN_TONE_TAG, FEQ_CHAIN_TONE_SCHEMA,
                             static_cast<double>(kCurveBands), matched});
    for (const FeqChainToneBand& band : kCurve) {
      wire.insert(wire.end(), {static_cast<double>(band.type), band.frequency,
                               band.gain_db, band.quality});
    }
    return wire;
  };
  FeqChainSettings settings{};
  check(decode(with_tone(room, 1), &settings) &&
            settings.tone.band_count == kCurveBands &&
            settings.tone.matched == 1 &&
            settings.tone.bands[1].frequency == 55.0 &&
            settings.room.renderer_version == 2,
        "a curve after the Room's trailer decodes, and the Room with it");
  const size_t base =
      FEQ_CHAIN_PARAM_LEAD + static_cast<size_t>(room[FEQ_CHAIN_PARAM_LEAD - 1]) *
                                 FEQ_CHAIN_BAND_PARAMS;
  std::vector<double> plain(room.begin(),
                            room.begin() + static_cast<long>(base + 4));
  check(decode(with_tone(plain, 0), &settings) &&
            settings.tone.band_count == kCurveBands &&
            settings.tone.matched == 0,
        "a curve straight after the low-latency word decodes");
  check(decode(plain, &settings) && settings.tone.band_count == 0,
        "a line with no curve carries none");
  auto truncated = with_tone(room, 1);
  truncated.pop_back();
  settings.tone.band_count = 77;
  check(!decode(truncated, &settings) && settings.tone.band_count == 77,
        "a short curve is refused without touching the caller");
  auto notch = with_tone(room, 1);
  notch[notch.size() - 4] = FEQ_FILTER_NO;
  check(!decode(notch, &settings), "a band with no inverse is refused");
  auto design = with_tone(room, 2);
  check(!decode(design, &settings), "a design other than 0 or 1 is refused");
}

}  // namespace

int main() {
  lands_on_the_ceiling_once_the_curve_has_played();
  cancels_where_nothing_is_limited();
  carries_across_a_handover();
  reads_the_curve_off_the_wire();
  return feq_test::finish();
}

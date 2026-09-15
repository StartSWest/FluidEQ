/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ and the DSP rack measured at every rate Windows runs an output at,
 * not only at 48 kHz.
 *
 * A user's DAC runs its outputs at 96 kHz, and every other measured test in
 * this engine builds its graph at 48 kHz — so a coefficient, a filter length
 * or a rack stage that quietly assumed one rate would have passed all of them
 * and changed nothing on his machine. Each case here plays a real tone
 * through a real graph at four rates and reads what came out: 44.1 and 48 for
 * ordinary outputs, 96 for a DAC like his, and 192 because it is the highest
 * a shared-mode endpoint is offered and the first place a fixed-length filter
 * runs out of room.
 *
 * Every measurement is in decibels of change against the same tone that went
 * in, at the same frequency, so the numbers mean the same thing at every rate
 * — which is the whole claim being tested: the sound does not depend on what
 * Windows chose.
 */

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine_test::chain_from;
using fluideq_engine_test::chain_with;
using fluideq_engine_test::kEqEnabled;
using fluideq_engine_test::kMaximizerCeilingDb;
using fluideq_engine_test::kMaximizerDriveDb;
using fluideq_engine_test::kMaximizerEnabled;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;
using fluideq_engine_test::rms_db;
using fluideq_engine_test::run_blocks;

namespace {

/** The four rates a Windows output is actually run at in shared mode. */
constexpr uint32_t kRates[] = {44100, 48000, 96000, 192000};

/** One second of a steady tone at `rate`, rather than at the fixture's 48k. */
std::vector<float> tone_at(double hz, double amplitude, uint32_t rate) {
  std::vector<float> out(rate);
  for (uint32_t at = 0; at < rate; ++at) {
    out[at] = static_cast<float>(
        amplitude *
        std::cos(2.0 * 3.14159265358979323846 * hz * at / rate));
  }
  return out;
}

/**
 * What one tone's level does through `chain` at `rate`, in dB.
 *
 * The block size follows the rate the way Windows' own does — 10 ms — so a
 * stage whose latency or lookahead is counted in frames is exercised with the
 * frame counts it would really see.
 */
double change_db_at(const Chain& chain, double hz, uint32_t rate) {
  std::vector<std::vector<float>> channels(2, tone_at(hz, 0.5, rate));
  const std::vector<float> reference = channels[0];
  const uint32_t block = rate / 100;

  Graph graph(chain, rate, 2, block);
  run_blocks(graph, channels, block);

  const double before = rms_db(reference, rate / 2, rate);
  const double left = rms_db(channels[0], rate / 2, rate);
  const double right = rms_db(channels[1], rate / 2, rate);
  // The two channels run the same filters over the same signal: a difference
  // is per-channel state leaking, and at an unusual rate it is likeliest.
  CHECK(std::fabs(left - right) < 1e-6);
  return left - before;
}

void a_peak_filter_lands_at_every_rate() {
  std::printf("a -20 dB peak at 1 kHz, at every rate\n");
  const Chain chain = chain_from("Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\n");
  CHECK(chain.matched);

  for (const uint32_t rate : kRates) {
    const double at_1k = change_db_at(chain, 1000.0, rate);
    const double at_100 = change_db_at(chain, 100.0, rate);
    std::printf("       %6u Hz: 1 kHz %.2f dB, 100 Hz %.2f dB\n", rate, at_1k,
                at_100);
    CHECK(std::fabs(at_1k - (-20.0)) < 1.0);
    CHECK(std::fabs(at_100) < 0.5);
  }
}

void a_shelf_and_a_preamp_land_at_every_rate() {
  std::printf("a high shelf and a preamp, at every rate\n");
  const Chain chain = chain_from(
      "Preamp: -6 dB\r\nFilter: ON HSC Fc 4000 Hz Gain 8 dB Q 0.7\r\n");
  CHECK(chain.matched);

  for (const uint32_t rate : kRates) {
    // Well inside the shelf, and well below it, at every rate — 12 kHz is
    // under half of even 44.1 kHz, so the same tone is legal throughout.
    const double high = change_db_at(chain, 12000.0, rate);
    const double low = change_db_at(chain, 200.0, rate);
    std::printf("       %6u Hz: 12 kHz %.2f dB, 200 Hz %.2f dB\n", rate, high,
                low);
    // Preamp plus shelf: about +2 dB up top, and the preamp alone below it.
    CHECK(std::fabs(high - 2.0) < 1.5);
    CHECK(std::fabs(low - (-6.0)) < 0.5);
  }
}

void the_rack_runs_at_every_rate() {
  std::printf("the DSP rack, at every rate\n");
  // The rack the app writes, with its maximizer driven hard and its ceiling
  // brought down: a stage that measures the signal and acts on it, which is
  // where a rate assumption would show up as a different sound.
  std::vector<double> values = reference_values();
  values[kEqEnabled] = 0.0;
  values[kMaximizerEnabled] = 1.0;
  values[kMaximizerDriveDb] = 12.0;
  values[kMaximizerCeilingDb] = -1.0;
  const Chain chain = chain_with(values);
  // Not `matched`: the rack is system-wide and carries no Device guard, so it
  // applies to an endpoint the EQ configuration never names (see `Chain`).
  CHECK(!chain.dsp_values.empty());

  double first = 0.0;
  for (size_t at = 0; at < std::size(kRates); ++at) {
    const double change = change_db_at(chain, 1000.0, kRates[at]);
    std::printf("       %6u Hz: %.2f dB\n", kRates[at], change);
    // It does something — a rack that silently did nothing at 96 kHz is the
    // failure this is here to catch.
    CHECK(std::fabs(change) > 0.5);
    if (at == 0) {
      first = change;
    } else {
      // And the same thing: the rack is not allowed to sound different
      // because Windows picked another rate.
      CHECK(std::fabs(change - first) < 1.0);
    }
  }
}

}  // namespace

int main() {
  std::printf("rate sweep\n\n");
  a_peak_filter_lands_at_every_rate();
  a_shelf_and_a_preamp_land_at_every_rate();
  the_rack_runs_at_every_rate();
  return report();
}

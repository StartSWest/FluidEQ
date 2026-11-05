/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamics on the rack's line, read the way the engine reads a rack file:
 * the DYNA trailer the app writes after Footsteps' and before the curve
 * (`dynamicsTrailer` in `dynamicsWire.ts`), from lines the encoder wrote
 * itself (`dynamics_line_fixture.h`). Every band's five values land where
 * the engine looks for them, a Dynamics the engine does not know is refused
 * whole, and a line from before the stage has it off.
 */

#include "../src/dsp_chain.h"

#include <cstdio>
#include <vector>

#include "dsp_chain_fixture.h"
#include "dynamics_line_fixture.h"
#include "fluideq/chain.h"
#include "fluideq_engine/config.h"
#include "graph_test_support.h"

using fluideq_engine::decode_dsp_chain;
using fluideq_engine::parse_dsp_values;
using fluideq_engine_test::dsp_file;
using fluideq_engine_test::kDynamicsAloneLine;
using fluideq_engine_test::kDynamicsBothLine;
using fluideq_engine_test::kDynamicsToneLine;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;

namespace {

std::vector<double> values_of(const char* line) {
  return parse_dsp_values(dsp_file(line));
}

size_t dynamics_at(const std::vector<double>& values) {
  for (size_t at = 0; at < values.size(); ++at) {
    if (values[at] == FEQ_CHAIN_DYNAMICS_TAG) return at;
  }
  return values.size();
}

bool band_is(const FeqCompanderBand& band, double up_threshold,
             double up_ratio, double up_max, double down_threshold,
             double down_ratio) {
  return band.up_threshold_db == up_threshold && band.up_ratio == up_ratio &&
         band.up_max_db == up_max && band.down_threshold_db == down_threshold &&
         band.down_ratio == down_ratio;
}

void every_value_lands_where_it_belongs() {
  std::printf("every Dynamics value lands where the engine reads it\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kDynamicsBothLine), &settings));
  CHECK(settings.compander.enabled == 1);
  CHECK(band_is(settings.compander.bands[0], -45, 1.5, 6, -18, 4));
  CHECK(band_is(settings.compander.bands[1], -42, 2, 9, -14, 2));
  CHECK(band_is(settings.compander.bands[2], -48, 2.5, 5, -10, 1));
  CHECK(settings.compander.attack_ms == 8);
  CHECK(settings.compander.release_ms == 250);
  CHECK(settings.compander.mix == 0.75);
  CHECK(settings.compander.makeup_db == 1.5);
  // Footsteps before it is read as it always was.
  CHECK(settings.footsteps.enabled == 1 && settings.footsteps.lift == 0.85);
  CHECK(settings.low_latency == 1);
}

void a_curve_after_it_is_read_too() {
  std::printf("a curve after Dynamics is read too\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kDynamicsToneLine), &settings));
  CHECK(settings.compander.enabled == 1 && settings.compander.mix == 0.75);
  CHECK(settings.tone.band_count == 1);
  CHECK(settings.tone.bands[0].frequency == 3150);
}

void dynamics_alone_stands_after_a_game_word_off() {
  std::printf("Dynamics alone stands after a game word written off\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kDynamicsAloneLine), &settings));
  CHECK(settings.low_latency == 0);
  CHECK(settings.footsteps.enabled == 0);
  CHECK(settings.compander.enabled == 1);
  CHECK(band_is(settings.compander.bands[1], -42, 2, 9, -14, 2));
}

void a_line_from_before_has_it_off() {
  std::printf("a line from before the stage has it off\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(reference_values(), &settings));
  CHECK(settings.compander.enabled == 0);
  CHECK(settings.compander.bands[0].up_ratio == 1);
}

void a_dynamics_it_does_not_know_is_refused() {
  std::printf("a Dynamics this engine does not know is refused whole\n");
  const std::vector<double> good = values_of(kDynamicsToneLine);
  const size_t at = dynamics_at(good);
  FeqChainSettings settings = {};
  CHECK(at < good.size());
  CHECK(decode_dsp_chain(good, &settings));  // control

  const auto refused = [&](std::vector<double> line, const char* what) {
    FeqChainSettings untouched = {};
    untouched.compander.mix = 0.123;
    const bool read = decode_dsp_chain(line, &untouched);
    std::printf("  %s: %s\n", what, read ? "read" : "refused");
    CHECK(!read && untouched.compander.mix == 0.123);
  };
  std::vector<double> line = good;
  line[at + 1] = 2;
  refused(line, "a schema it does not know");
  line = good;
  line[at + 2] = 18;
  refused(line, "a field count it does not know");
  line = good;
  line[at + 3] = 2;
  refused(line, "a switch that is not a flag");
  line = good;
  line[at + 5] = 5;
  refused(line, "an upward ratio past four");
  line = good;
  line[at + 8] = 25;
  refused(line, "a downward ratio past twenty");
  line = good;
  line[at + 6 + 10] = 20;
  refused(line, "a largest lift past eighteen, third band");
  line = good;
  line[at + 21] = 1.5;
  refused(line, "a mix past one");
  line = good;
  line[at + 22] = 13;
  refused(line, "a make-up past twelve");
  line = good;
  line.erase(line.begin() + at, line.begin() + at + FEQ_CHAIN_DYNAMICS_TRAILER);
  const std::vector<double> trailer(good.begin() + at,
                                    good.begin() + at + FEQ_CHAIN_DYNAMICS_TRAILER);
  line.insert(line.end(), trailer.begin(), trailer.end());
  refused(line, "the trailer after the curve");
}

}  // namespace

int main() {
  std::printf("Dynamics on the rack's line\n");
  every_value_lands_where_it_belongs();
  a_curve_after_it_is_read_too();
  dynamics_alone_stands_after_a_game_word_off();
  a_line_from_before_has_it_off();
  a_dynamics_it_does_not_know_is_refused();
  return report();
}

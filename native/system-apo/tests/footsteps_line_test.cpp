/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps on the rack's line, read the way the engine reads a rack file:
 * the trailer the app writes after the game word and the Room's, before the
 * curve (`footstepsTrailer` in `chainWire.ts`), from lines the encoder wrote
 * itself (`footsteps_line_fixture.h`). A Footsteps the engine does not know
 * is refused whole, as every trailer is, and a line from before the stage
 * has it off; with it on, the graph lists it among its stages.
 */
#include "../src/dsp_chain.h"

#include <cstdio>
#include <string>
#include <vector>

#include "dsp_chain_fixture.h"
#include "fluideq/chain.h"
#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "footsteps_line_fixture.h"
#include "graph_test_support.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine::decode_dsp_chain;
using fluideq_engine::parse_dsp_values;
using fluideq_engine_test::chain_with;
using fluideq_engine_test::dsp_file;
using fluideq_engine_test::kFootstepsAloneLine;
using fluideq_engine_test::kGamingLine;
using fluideq_engine_test::kGamingToneLine;
using fluideq_engine_test::kRate;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;

namespace {

std::vector<double> values_of(const char* line) {
  return parse_dsp_values(dsp_file(line));
}

/** Where the trailer's tag stands on a line that has one. */
size_t footsteps_at(const std::vector<double>& values) {
  for (size_t at = 0; at < values.size(); ++at) {
    if (values[at] == FEQ_CHAIN_FOOTSTEPS_TAG) return at;
  }
  return values.size();
}

void the_gaming_line_runs_footsteps() {
  std::printf("the Gaming line runs Footsteps at Competitive\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kGamingLine), &settings));
  CHECK(settings.footsteps.enabled == 1);
  CHECK(settings.footsteps.isolate == 0);
  CHECK(settings.footsteps.lift == 0.85);
  CHECK(settings.footsteps.calm == 0.5);
  CHECK(settings.low_latency == 1);
  CHECK(settings.eq.band_count == 15);

  const Chain chain = chain_with(values_of(kGamingLine));
  Graph graph(chain, kRate, 2, 480);
  bool listed = false;
  for (const std::string& stage : graph.active_stages()) {
    listed = listed || stage == "footsteps";
  }
  CHECK(listed);
}

void a_curve_after_it_is_read_too() {
  std::printf("a curve after Footsteps is read too\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kGamingToneLine), &settings));
  CHECK(settings.footsteps.enabled == 1 && settings.footsteps.lift == 0.85);
  CHECK(settings.tone.band_count == 1);
  CHECK(settings.tone.bands[0].frequency == 3150);
  CHECK(settings.tone.bands[0].gain_db == 2.8);
}

void footsteps_alone_stands_after_a_game_word_off() {
  std::printf("Footsteps alone stands after a game word written off\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kFootstepsAloneLine), &settings));
  CHECK(settings.low_latency == 0);
  CHECK(settings.footsteps.enabled == 1);
  CHECK(settings.footsteps.isolate == 1);
  CHECK(settings.footsteps.lift == 0.4);
  CHECK(settings.footsteps.calm == 0.2);
}

void a_line_from_before_has_it_off() {
  std::printf("a line from before the stage has it off\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(reference_values(), &settings));
  CHECK(settings.footsteps.enabled == 0);
  CHECK(settings.exciter.enabled == 1);
}

void a_footsteps_it_does_not_know_is_refused() {
  std::printf("a Footsteps this engine does not know is refused whole\n");
  const std::vector<double> good = values_of(kGamingToneLine);
  const size_t at = footsteps_at(good);
  FeqChainSettings settings = {};
  CHECK(at < good.size());
  CHECK(decode_dsp_chain(good, &settings));  // control

  const auto refused = [&](std::vector<double> line, const char* what) {
    FeqChainSettings untouched = {};
    untouched.footsteps.lift = 0.123;
    const bool read = decode_dsp_chain(line, &untouched);
    std::printf("  %s: %s\n", what, read ? "read" : "refused");
    CHECK(!read && untouched.footsteps.lift == 0.123);
  };
  std::vector<double> line = good;
  line[at + 1] = 2;
  refused(line, "a schema it does not know");
  line = good;
  line[at + 2] = 5;
  refused(line, "a field count it does not know");
  line = good;
  line[at + 5] = 1.5;
  refused(line, "a Lift past one");
  line = good;
  line[at + 6] = -0.1;
  refused(line, "a Calm under zero");
  line = good;
  line[at + 4] = 2;
  refused(line, "an Isolate that is not a flag");
  // After the curve, where nothing may stand.
  line = good;
  const std::vector<double> trailer(line.begin() + at, line.begin() + at + 7);
  line.erase(line.begin() + at, line.begin() + at + 7);
  line.insert(line.end(), trailer.begin(), trailer.end());
  refused(line, "the trailer after the curve");
  line = values_of(kGamingLine);
  line.pop_back();
  refused(line, "a trailer cut short");
}

}  // namespace

int main() {
  std::printf("Footsteps on the rack's line\n");
  the_gaming_line_runs_footsteps();
  a_curve_after_it_is_read_too();
  footsteps_alone_stands_after_a_game_word_off();
  a_line_from_before_has_it_off();
  a_footsteps_it_does_not_know_is_refused();
  return report();
}

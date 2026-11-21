/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's Voice stage on the rack's line, read the way the engine
 * reads a rack file: the VOIC trailer the app writes after Dynamics' and
 * before the curve (`voiceTrailer` in `voiceWire.ts`), from lines the
 * encoder wrote itself (`voice_line_fixture.h`). Every value lands where the
 * engine looks for it, a Voice the engine does not know is refused whole,
 * and a line from before the stage has it off.
 */

#include "../src/dsp_chain.h"

#include <cstdio>
#include <vector>

#include "dsp_chain_fixture.h"
#include "fluideq/chain.h"
#include "fluideq_engine/config.h"
#include "graph_test_support.h"
#include "voice_line_fixture.h"

using fluideq_engine::decode_dsp_chain;
using fluideq_engine::parse_dsp_values;
using fluideq_engine_test::dsp_file;
using fluideq_engine_test::kVoiceAloneLine;
using fluideq_engine_test::kVoiceDynamicsToneLine;
using fluideq_engine_test::kVoiceLowLagLine;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;

namespace {

std::vector<double> values_of(const char* line) {
  return parse_dsp_values(dsp_file(line));
}

size_t voice_at(const std::vector<double>& values) {
  for (size_t at = 0; at < values.size(); ++at) {
    if (values[at] == FEQ_CHAIN_VOICE_TAG) return at;
  }
  return values.size();
}

bool voice_is_the_fixture(const FeqVoiceSettings& v) {
  return v.enabled == 1 && v.low_cut_hz == 95 && v.proximity_db == 3.5 &&
         v.deplosive == 0.6 && v.gate_enabled == 1 &&
         v.gate_threshold_db == -47 && v.gate_range_db == 22 &&
         v.gate_hold_ms == 180 && v.gate_attack_ms == 1.5 &&
         v.gate_release_ms == 140;
}

void every_value_lands_where_it_belongs() {
  std::printf("every Voice value lands where the engine reads it\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kVoiceAloneLine), &settings));
  CHECK(voice_is_the_fixture(settings.voice));
  CHECK(settings.low_latency == 0);
  CHECK(settings.compander.enabled == 0);
}

void low_lag_is_read_with_it() {
  std::printf("low lag is read beside it\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kVoiceLowLagLine), &settings));
  CHECK(voice_is_the_fixture(settings.voice));
  CHECK(settings.low_latency == 1);
}

void dynamics_before_and_a_curve_after() {
  std::printf("Dynamics before it and a curve after it are read too\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values_of(kVoiceDynamicsToneLine), &settings));
  CHECK(voice_is_the_fixture(settings.voice));
  CHECK(settings.compander.enabled == 1);
  CHECK(settings.tone.band_count == 1);
  CHECK(settings.tone.bands[0].frequency == 3150);
}

void a_line_from_before_has_it_off() {
  std::printf("a line from before the stage has it off\n");
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(reference_values(), &settings));
  CHECK(settings.voice.enabled == 0);
  CHECK(settings.voice.gate_enabled == 0);
}

void a_voice_it_does_not_know_is_refused() {
  std::printf("a Voice this engine does not know is refused whole\n");
  const std::vector<double> good = values_of(kVoiceDynamicsToneLine);
  const size_t at = voice_at(good);
  FeqChainSettings settings = {};
  CHECK(at < good.size());
  CHECK(decode_dsp_chain(good, &settings));  // control

  const auto refused = [&](size_t offset, double value, const char* what) {
    std::vector<double> line = good;
    line[at + offset] = value;
    FeqChainSettings untouched = {};
    untouched.voice.gate_range_db = 0.123;
    const bool read = decode_dsp_chain(line, &untouched);
    std::printf("  %s: %s\n", what, read ? "read" : "refused");
    CHECK(!read && untouched.voice.gate_range_db == 0.123);
  };
  refused(1, 2, "a schema it does not know");
  refused(2, 11, "a field count it does not know");
  refused(3, 2, "a switch that is not 0 or 1");
  refused(4, 10, "a low cut under 20 Hz that is not off");
  refused(5, 13, "proximity past 12 dB");
  refused(6, 1.5, "a pop guard past 1");
  refused(8, -5, "a gate threshold over -10 dB");
  refused(9, 90, "a range past 80 dB");
  refused(11, 0, "an attack under 0.1 ms");
  refused(12, 3000, "a release past 2 s");
}

}  // namespace

int main() {
  every_value_lands_where_it_belongs();
  low_lag_is_read_with_it();
  dynamics_before_and_a_curve_after();
  a_line_from_before_has_it_off();
  a_voice_it_does_not_know_is_refused();
  return report();
}

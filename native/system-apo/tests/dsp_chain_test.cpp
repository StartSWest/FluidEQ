/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP rack running system-wide: the file the app writes, what the DLL
 * makes of it, and where it sits in the graph.
 *
 * The reference line in `dsp_chain_fixture.h` is the whole point of this
 * file: it was produced by the app's own encoder, and the checks below are
 * what catch the two sides of the wire disagreeing about its layout.
 */

#include "../src/dsp_chain.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "fluideq/chain.h"
#include "fluideq/linear_phase.h"
#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"

using fluideq_engine::Chain;
using fluideq_engine::decode_dsp_chain;
using fluideq_engine::Graph;
using fluideq_engine::parse_dsp_values;
using fluideq_engine::resolve_chain;
using fluideq_engine_test::chain_with;
using fluideq_engine_test::dsp_file;
using fluideq_engine_test::endpoint;
using fluideq_engine_test::Files;
using fluideq_engine_test::join;
using fluideq_engine_test::kBandCount;
using fluideq_engine_test::kConfigDir;
using fluideq_engine_test::kConfigPath;
using fluideq_engine_test::kDenoiseEnabled;
using fluideq_engine_test::kDspPath;
using fluideq_engine_test::kEqEnabled;
using fluideq_engine_test::kEqPhase;
using fluideq_engine_test::kExciterEnabled;
using fluideq_engine_test::kMaximizerCeilingDb;
using fluideq_engine_test::kMaximizerDriveDb;
using fluideq_engine_test::kMaximizerEnabled;
using fluideq_engine_test::kRate;
using fluideq_engine_test::kReferenceLine;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::mentions;
using fluideq_engine_test::provider;
using fluideq_engine_test::report;
using fluideq_engine_test::run_blocks;
using fluideq_engine_test::tone;

namespace {

/** Largest magnitude in `samples` over `[from, to)`, in dBFS. */
double peak_db(const std::vector<float>& samples, size_t from, size_t to) {
  double peak = 0.0;
  for (size_t at = from; at < to; ++at) {
    const double value = std::fabs(static_cast<double>(samples[at]));
    if (value > peak) {
      peak = value;
    }
  }
  return peak > 0.0 ? 20.0 * std::log10(peak) : -200.0;
}

/**
 * A second of 1 kHz at -6 dBFS through `chain`, and the peak of its last half.
 *
 * The last half rather than the whole buffer because the maximizer has a
 * 5 ms look-ahead and a 100 ms release: the first block comes out before the
 * gain computer has seen anything, which is the one place the ceiling is
 * legitimately over-shot.
 */
double limited_peak_db(const Chain& chain) {
  constexpr uint32_t kFrames = kRate;
  std::vector<std::vector<float>> channels(2, tone(1000.0, 0.5, kFrames, 0));
  Graph graph(chain, kRate, 2, 480);
  run_blocks(graph, channels, 480);
  const double left = peak_db(channels[0], kFrames / 2, kFrames);
  const double right = peak_db(channels[1], kFrames / 2, kFrames);
  CHECK(std::fabs(left - right) < 0.1);
  return left;
}

// ---------------------------------------------------------------------------

void the_encoder_s_own_line_decodes() {
  std::printf("the line the app writes decodes into the rack\n");
  const std::vector<double> values = reference_values();
  CHECK(values.size() ==
        FEQ_CHAIN_PARAM_LEAD + 15u * FEQ_CHAIN_BAND_PARAMS + 3);
  CHECK(values[kBandCount] == 15.0);

  const Chain chain = chain_with(values);
  CHECK(chain.dsp_values.size() == values.size());

  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(chain.dsp_values, &settings));
  CHECK(settings.enabled == 1);
  CHECK(settings.exciter.enabled == 1);
  CHECK(settings.eq.band_count == 15);
  CHECK(settings.normalizer.mode == 1);
  CHECK(settings.normalizer.ceiling_db == -1);
  CHECK(settings.normalizer.target_lufs == -14);
  auto legacy = values;
  legacy.resize(legacy.size() - 3);
  CHECK(decode_dsp_chain(legacy, &settings));
  CHECK(settings.normalizer.mode == 0);
  CHECK(settings.eq.band_count == 15);
}

void a_header_only_or_broken_file_is_no_rack() {
  std::printf("a file with no numbers, or a bad token, is no rack\n");
  CHECK(parse_dsp_values("# FluidEQ Engine DSP chain v1\r\n").empty());
  CHECK(parse_dsp_values(dsp_file("1 2 three 4")).empty());
  // The positive control: the same shape, all numeric, does parse. Without it
  // an `empty()` that came back for every input would look identical.
  CHECK(parse_dsp_values(dsp_file("1 2 3 4")).size() == 4);
}

void denoise_runs_without_the_neural_runtime() {
  std::printf("live restoration stays enabled; only neural Voice is unavailable\n");
  std::vector<double> values = reference_values();
  values[kDenoiseEnabled] = 1.0;
  values[kDenoiseEnabled + 16] = 1.0;

  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values, &settings));
  CHECK(settings.denoise.enabled == 1);
  CHECK(settings.denoise.voice.enabled == 0);
  CHECK(settings.denoise.profile_source == FEQ_DENOISE_PROFILE_ADAPTIVE);
  // The Library decoder retains the user's scanned-profile and Voice settings.
  CHECK(feq_chain_settings_decode(values.data(), static_cast<uint32_t>(values.size()), &settings));
  CHECK(settings.denoise.voice.enabled == 1);
  CHECK(settings.denoise.profile_source == FEQ_DENOISE_PROFILE_SCANNED);
  CHECK(settings.exciter.enabled == 1);
}

void a_wrong_band_count_is_refused_and_the_eq_still_runs() {
  std::printf("a line with the wrong band count leaves the EQ running\n");
  std::vector<double> values = reference_values();
  values[kBandCount] = 14.0;  // The tail is still 15 bands long.

  FeqChainSettings settings = {};
  CHECK(!decode_dsp_chain(values, &settings));

  const Chain chain = chain_with(values, "Preamp: -6 dB\r\n");
  Graph graph(chain, kRate, 2, 480);
  CHECK(mentions(graph.warnings(), "DSP rack"));
  CHECK(mentions(graph.problems(), "dsp-rack"));
  CHECK(!graph.is_passthrough());
  // The EQ half of the same chain is untouched: -6 dB of preamp on a
  // -6 dBFS tone is -12 dBFS, with no rack in front of it.
  std::vector<std::vector<float>> channels(2, tone(1000.0, 0.5, 4800, 0));
  run_blocks(graph, channels, 480);
  CHECK(std::fabs(peak_db(channels[0], 2400, 4800) + 12.0) < 0.1);
}

void switching_the_rack_off_is_not_a_failure() {
  std::printf("disabled and absent racks are healthy, malformed racks fail\n");
  std::vector<double> values = reference_values();
  values[0] = 0.0;
  Graph disabled(chain_with(values), kRate, 2, 480);
  CHECK(disabled.problems().empty());
  CHECK(disabled.warnings().empty());
  CHECK(disabled.is_passthrough());

  Graph absent(chain_with({}), kRate, 2, 480);
  CHECK(absent.problems().empty());
  CHECK(absent.is_passthrough());

  values[0] = 1.0;
  Graph enabled(chain_with(values), kRate, 2, 480);
  CHECK(enabled.problems().empty());
  CHECK(!enabled.is_passthrough());

  values[kBandCount] = 14.0;
  Graph malformed(chain_with(values), kRate, 2, 480);
  CHECK(mentions(malformed.problems(), "dsp-rack"));
}

void the_maximizer_holds_its_ceiling() {
  std::printf("the rack's maximizer holds -20 dBFS on a -6 dBFS tone\n");
  std::vector<double> values = reference_values();
  values[kExciterEnabled] = 0.0;  // Harmonics would move the peak.
  values[kMaximizerEnabled] = 1.0;
  values[kMaximizerDriveDb] = 0.0;
  values[kMaximizerCeilingDb] = -20.0;

  const double peak = limited_peak_db(chain_with(values));
  CHECK(std::fabs(peak + 20.0) < 0.5);
}

void the_rack_runs_before_the_eq() {
  std::printf("the rack runs first, then the EQ\n");
  std::vector<double> values = reference_values();
  values[kExciterEnabled] = 0.0;
  values[kMaximizerEnabled] = 1.0;
  values[kMaximizerDriveDb] = 0.0;
  values[kMaximizerCeilingDb] = -20.0;

  // Rack first: the limiter holds -20 dBFS and the preamp then lifts what
  // came out of it to -14. The other order would put +6 dB into a limiter
  // set to -20 and come out at -20, so these two numbers are the whole
  // difference between the two orders.
  const double peak = limited_peak_db(chain_with(values, "Preamp: 6 dB\r\n"));
  CHECK(std::fabs(peak + 14.0) < 0.5);
}

void latency_includes_the_rack() {
  std::printf("the reported latency includes the rack's own\n");
  const std::vector<double> values = reference_values();
  FeqChainSettings settings = {};
  CHECK(decode_dsp_chain(values, &settings));

  FeqChain* reference = feq_chain_create(static_cast<double>(kRate), 2, 480);
  CHECK(reference != nullptr);
  feq_chain_configure(reference, &settings);
  CHECK(feq_chain_enable_live_normalizer(reference) == 1);
  const uint32_t rack = feq_chain_latency_frames(reference);
  feq_chain_destroy(reference);
  // A null test needs a positive control: the rack's own latency has to be a
  // real number, or `latency_frames()` matching it proves nothing.
  CHECK(rack > 0);

  const Chain chain = chain_with(values);
  Graph graph(chain, kRate, 2, 480);
  CHECK(graph.latency_frames() == rack);
}

void final_guard_follows_the_rack_and_eq() {
  auto values = reference_values();
  values[kExciterEnabled] = 0.0;
  values[kMaximizerEnabled] = 1.0;
  values[kMaximizerDriveDb] = 0.0;
  values[kMaximizerCeilingDb] = -6.0;
  const auto chain = chain_with(values,
      "Filter: ON PK Fc 1000 Hz Gain 18 dB Q 2\n"
      "Preamp: 0 dB\n# FluidEQAutoPreamp: ON\n");
  auto raw = chain;
  raw.output_guard = false;
  CHECK(limited_peak_db(raw) > 1.0);
  const double protected_peak = limited_peak_db(chain);
  CHECK(protected_peak > -2.0 && protected_peak < -0.7);
}

void linear_phase_latency_is_known_before_the_first_block() {
  std::printf("linear phase reports its delay before any audio has run\n");
  std::vector<double> values = reference_values();
  values[kEqEnabled] = 1.0;
  values[kEqPhase] = 1.0;

  const Chain chain = chain_with(values);
  Graph graph(chain, kRate, 2, 480);
  // The number `GetLatency` hands Windows is read once, at publish time, from
  // a graph that has never processed a block — so a chain that only learns
  // its own latency after the audio thread has adopted its kernel would tell
  // Windows the effect adds nothing while delaying it by 171 ms. That is what
  // every video player's audio/video sync is computed from.
  CHECK(graph.latency_frames() >= feq_linear_phase_latency());
  // And the control: with minimum phase, the same rack does not report it.
  const Chain minimum = chain_with(reference_values());
  Graph plain(minimum, kRate, 2, 480);
  CHECK(plain.latency_frames() < feq_linear_phase_latency());
}

void channels_beyond_two_pass_the_rack_by() {
  std::printf("a surround stream runs the rack on the front pair only\n");
  const Chain chain = chain_with(reference_values());
  Graph graph(chain, kRate, 6, 480);
  CHECK(mentions(graph.warnings(), "first two"));
  CHECK(!graph.is_passthrough());
}

void a_rack_alone_is_not_a_pass_through() {
  std::printf("a rack with no EQ configuration still processes\n");
  Files files;
  files[kDspPath] = dsp_file(kReferenceLine);
  // No config.txt at all: `matched` stays false, and the rack is system-wide
  // so it applies anyway. This is the endpoint a user has never opened the EQ
  // page for.
  const Chain chain = resolve_chain(kConfigDir, endpoint(), provider(files));
  CHECK(!chain.matched);
  CHECK(!chain.dsp_values.empty());
  Graph graph(chain, kRate, 2, 480);
  CHECK(!graph.is_passthrough());
}

/**
 * An EQ-only edit — a band dragged — must not restart the rack.
 *
 * The graph is rebuilt on every configuration change, and a rebuilt rack
 * under linear phase is silent for 8192 frames while its kernel primes: 171 ms
 * at 48 kHz, on every frame of a drag. `inherit_rack` keeps the running chain
 * when the rack file has not changed by a single value.
 */
void an_eq_only_edit_keeps_the_rack_running() {
  std::printf("an EQ-only edit keeps the rack chain that is already primed\n");
  std::vector<double> values = reference_values();
  values[kEqEnabled] = 1.0;
  values[kEqPhase] = 1.0;  // Linear: a fresh chain is silent while it primes.

  const Chain before = chain_with(values, "Preamp: 0 dB\r\n");
  Graph running(before, kRate, 2, 480);
  // A second of tone, so this graph is well past its own priming.
  std::vector<std::vector<float>> primed(2, tone(1000.0, 0.5, kRate, 0));
  run_blocks(running, primed, 480);

  // The same rack file, a different EQ line: exactly the shape a band drag
  // produces.
  const Chain after = chain_with(values, "Preamp: -3 dB\r\n");
  Graph inheriting(after, kRate, 2, 480);
  Graph fresh(after, kRate, 2, 480);
  inheriting.inherit_rack(running);
  CHECK(inheriting.rack_is_shared_with(running));
  CHECK(!fresh.rack_is_shared_with(running));

  std::vector<std::vector<float>> through_inherited(
      2, tone(1000.0, 0.5, 480, 0));
  run_blocks(inheriting, through_inherited, 480);
  std::vector<std::vector<float>> through_fresh(2, tone(1000.0, 0.5, 480, 0));
  run_blocks(fresh, through_fresh, 480);

  const double inherited_peak = peak_db(through_inherited[0], 0, 480);
  const double fresh_peak = peak_db(through_fresh[0], 0, 480);
  std::printf("       first block: inherited %.1f dBFS, fresh %.1f dBFS\n",
              inherited_peak, fresh_peak);
  // Audio comes straight out of the shared chain...
  CHECK(inherited_peak > -20.0);
  // ...and the control says what the alternative sounds like: a chain that
  // starts from nothing has nothing to give for its first 8192 frames.
  CHECK(fresh_peak < -60.0);
}

void dsp_edits_keep_audio_in_flight() {
  std::printf("DSP edits keep delayed audio instead of starting with silence\n");
  for (const double phase : {0.0, 1.0}) {
    std::vector<double> values = reference_values();
    values[kExciterEnabled] = 0.0;
    values[kEqEnabled] = 1.0;
    values[kEqPhase] = phase;
    values[kMaximizerEnabled] = 1.0;
    values[kMaximizerDriveDb] = 0.0;
    values[kMaximizerCeilingDb] = -3.0;
    auto running = std::make_unique<Graph>(chain_with(values), kRate, 2, 128);
    std::vector<std::vector<float>> warm(2, tone(1000.0, 0.5, kRate, 0));
    run_blocks(*running, warm, 128);
    for (uint32_t edit = 0; edit < 12; ++edit) {
      values[kMaximizerCeilingDb] = edit % 2 == 0 ? -6.0 : -3.0;
      auto next = std::make_unique<Graph>(chain_with(values), kRate, 2, 128);
      next->request_state_transfer();
      next->inherit_rack(*running);
      next->adopt_state(running.get());
      std::vector<std::vector<float>> block(
          2, tone(1000.0, 0.5, 128, kRate + edit * 128));
      run_blocks(*next, block, 128);
      const double peak = peak_db(block[0], 0, 128);
      std::printf("       phase %.0f edit %u: %.1f dBFS\n", phase, edit, peak);
      CHECK(peak > -30.0);
      running = std::move(next);
    }
    Graph cold(chain_with(values), kRate, 2, 128);
    std::vector<std::vector<float>> control(2, tone(1000.0, 0.5, 128, 0));
    run_blocks(cold, control, 128);
    CHECK(peak_db(control[0], 0, 128) < -60.0);
  }
}

void a_changed_rack_is_never_shared() {
  std::printf("a rack whose values changed is built fresh\n");
  std::vector<double> values = reference_values();
  values[kEqEnabled] = 1.0;
  const Chain before = chain_with(values);
  Graph running(before, kRate, 2, 480);

  std::vector<double> edited = values;
  edited[kMaximizerEnabled] = 1.0;  // One value in the rack itself.
  Graph rebuilt(chain_with(edited), kRate, 2, 480);
  rebuilt.inherit_rack(running);
  CHECK(!rebuilt.rack_is_shared_with(running));

  // And a rack that is identical but running at another rate: the same array
  // builds different buffers and a different kernel there.
  Graph other_rate(before, 44100, 2, 480);
  other_rate.inherit_rack(running);
  CHECK(!other_rate.rack_is_shared_with(running));

  // Same values, same rate, same channels — but a different `max_frames`,
  // which is what sizes the shared chain's internal buffers at build time.
  // Sharing across that would have `feq_chain_process` write past buffers it
  // was never sized for.
  Graph other_block_size(before, kRate, 2, 960);
  other_block_size.inherit_rack(running);
  CHECK(!other_block_size.rack_is_shared_with(running));
}

}  // namespace

int main() {
  std::printf("fluideq engine system-wide DSP rack\n");
  the_encoder_s_own_line_decodes();
  a_header_only_or_broken_file_is_no_rack();
  denoise_runs_without_the_neural_runtime();
  a_wrong_band_count_is_refused_and_the_eq_still_runs();
  switching_the_rack_off_is_not_a_failure();
  the_maximizer_holds_its_ceiling();
  the_rack_runs_before_the_eq();
  latency_includes_the_rack();
  final_guard_follows_the_rack_and_eq();
  linear_phase_latency_is_known_before_the_first_block();
  channels_beyond_two_pass_the_rack_by();
  a_rack_alone_is_not_a_pass_through();
  an_eq_only_edit_keeps_the_rack_running();
  a_changed_rack_is_never_shared();
  dsp_edits_keep_audio_in_flight();
  return report();
}

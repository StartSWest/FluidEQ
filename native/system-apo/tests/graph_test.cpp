/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `Graph`'s biquads, preamp and state carry-over, measured rather than
 * inspected: every check here plays audio through the graph and reads what
 * came out, so a stage wired in the wrong order or a coefficient handed the
 * wrong sample rate fails even though the object it built looks correct.
 *
 * Chains are built by `resolve_chain` over an in-memory provider rather than
 * by filling a `Chain` by hand, so the same config grammar Equalizer APO
 * writes is exercised on the way in.
 *
 * The convolution and graphic-EQ checks live in `graph_convolution_test.cpp`:
 * they are the ones that touch disk and that measure delay in frames rather
 * than level in decibels, and together the two halves were past the 500-line
 * limit in one file.
 */

#include "fluideq_engine/graph.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <memory>
#include <string>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq_engine/config.h"
#include "graph_test_support.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine_test::chain_from;
using fluideq_engine_test::kRate;
using fluideq_engine_test::report;
using fluideq_engine_test::run_blocks;
using fluideq_engine_test::tone;
using fluideq_engine_test::tone_change_db;

namespace {

void peak_cut_attenuates_its_frequency() {
  std::printf("a -20 dB peak at 1 kHz cuts 1 kHz and leaves 100 Hz alone\n");
  const Chain chain = chain_from("Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\n");
  CHECK(chain.matched);
  CHECK(chain.bands.size() == 1);

  const double at_1k = tone_change_db(chain, 1000.0);
  std::printf("       1 kHz measures %.2f dB (target -20)\n", at_1k);
  CHECK(std::fabs(at_1k - (-20.0)) < 1.0);

  const double at_100 = tone_change_db(chain, 100.0);
  std::printf("       100 Hz measures %.2f dB (target 0)\n", at_100);
  CHECK(std::fabs(at_100) < 0.5);
}

void preamp_scales() {
  std::printf("a -6 dB preamp scales by -6 dB and adds no latency\n");
  const Chain chain = chain_from("Preamp: -6 dB\r\n");
  CHECK(chain.matched);
  CHECK(chain.bands.empty());

  Graph graph(chain, kRate, 2, 480);
  CHECK(!graph.is_passthrough());
  CHECK(graph.latency_frames() == 0);
  CHECK(graph.warnings().empty());

  const double change = tone_change_db(chain, 1000.0);
  std::printf("       measures %.3f dB (target -6)\n", change);
  CHECK(std::fabs(change - (-6.0)) < 0.05);
}

void unmatched_chain_is_passthrough() {
  std::printf("a config that never names this endpoint changes nothing\n");
  // Everything here is behind a guard for a different device, which is what
  // an endpoint FluidEQ has no profile for actually resolves to.
  const Chain guarded = chain_from(
      "Device: {BBBB}\r\nFilter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\n"
      "Preamp: -6 dB\r\n");
  CHECK(!guarded.matched);

  // And the same chain with real work in it, unmatched: this is what proves
  // the flag itself gates the graph, rather than the chain merely being empty.
  Chain unmatched = chain_from(
      "Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\nPreamp: -6 dB\r\n");
  CHECK(unmatched.matched);
  CHECK(unmatched.bands.size() == 1);
  unmatched.matched = false;

  for (const Chain& chain : {guarded, unmatched}) {
    std::vector<std::vector<float>> channels(2, tone(1000.0, 0.5, 4800, 0));
    const std::vector<float> reference = channels[0];

    Graph graph(chain, kRate, 2, 480);
    CHECK(graph.is_passthrough());
    CHECK(graph.latency_frames() == 0);
    run_blocks(graph, channels, 480);

    bool identical = true;
    for (size_t at = 0; at < reference.size(); ++at) {
      identical = identical && channels[0][at] == reference[at] &&
                  channels[1][at] == reference[at];
    }
    CHECK(identical);
  }
}

void state_inherits_across_gain_change() {
  std::printf("a gain change carries the filter history across\n");
  const Chain a = chain_from("Filter: ON PK Fc 1000 Hz Gain -3 dB Q 1\r\n");
  const Chain b = chain_from("Filter: ON PK Fc 1000 Hz Gain -4 dB Q 1\r\n");
  constexpr uint32_t kFrames = 4800;
  constexpr uint32_t kTail = 16;

  // The tone is a cosine so frame 4800 — 100 whole cycles of 1 kHz at 48 kHz
  // — is a peak rather than a zero crossing. At a zero crossing a filter
  // started from silence would produce nearly the right sample by accident
  // and the "without" half of this check would prove nothing.
  std::vector<std::vector<float>> first_channels(1,
                                                 tone(1000.0, 0.5, kFrames, 0));
  Graph first(a, kRate, 1, kFrames);
  run_blocks(first, first_channels, kFrames);
  const double last = static_cast<double>(first_channels[0][kFrames - 1]);

  const std::vector<float> next = tone(1000.0, 0.5, kTail, kFrames);

  std::vector<std::vector<float>> carried(1, next);
  Graph warm(b, kRate, 1, kFrames);
  warm.request_state_transfer();
  warm.adopt_state(&first);
  run_blocks(warm, carried, kTail);

  std::vector<std::vector<float>> fresh(1, next);
  Graph cold(b, kRate, 1, kFrames);
  run_blocks(cold, fresh, kTail);

  const double with_state = std::fabs(static_cast<double>(carried[0][0]) - last);
  const double without_state = std::fabs(static_cast<double>(fresh[0][0]) - last);
  std::printf("       step with history %.4f, without %.4f\n", with_state,
              without_state);
  CHECK(with_state < 0.05);
  CHECK(without_state > 0.05);

  // A band added beside it no longer restarts the one already running: that
  // band keeps its own history — found again by type and frequency, not by
  // the whole layout matching — and the new one fades in. Adding a band used
  // to start every band from silence.
  const Chain two_bands = chain_from(
      "Filter: ON PK Fc 1000 Hz Gain -3 dB Q 1\r\n"
      "Filter: ON HPQ Fc 30 Hz Q 0.71\r\n");
  std::vector<std::vector<float>> added(1, next);
  Graph wider(two_bands, kRate, 1, kFrames);
  wider.request_state_transfer();
  wider.adopt_state(&first);
  run_blocks(wider, added, kTail);
  const double with_added = std::fabs(static_cast<double>(added[0][0]) - last);
  std::printf("       step with a band added %.4f\n", with_added);
  CHECK(with_added < 0.05);
}

/**
 * The loudest thing above 6 kHz in `samples[from, to)`, in dBFS: an 8th-order
 * Butterworth high-pass run over the whole buffer first, so the program below
 * — 55 Hz and 700 Hz — lies some 150 dB under it and anything left is a
 * click's broadband edge.
 */
double click_dbfs(const std::vector<float>& samples, size_t from, size_t to) {
  const double qualities[] = {0.50980, 0.60134, 0.89998, 2.56292};
  std::vector<float> high = samples;
  for (const double quality : qualities) {
    const FeqBiquadCoefficients section =
        feq_biquad_coefficients(FEQ_FILTER_HPQ, 6000.0, 0.0, quality, kRate);
    FeqBiquadState state{};
    feq_biquad_process(&state, high.data(), static_cast<uint32_t>(high.size()),
                       &section);
  }
  double peak = 0.0;
  for (size_t at = from; at < to; ++at) {
    peak = std::max(peak, std::fabs(static_cast<double>(high[at])));
  }
  return 20.0 * std::log10(std::max(peak, 1e-12));
}

/**
 * A second edit landing while the first is still fading — a drag writes
 * every few milliseconds — onto a band at 0 dB, the value a gain dial's
 * sticky zero stops a drag on. The fade carries on from where it was and the
 * incoming side switches at once, so the band arriving at 0 dB takes the
 * history of the step before it. Held against a click floor measured on the
 * same program with nothing changing, and against a swap that carries
 * nothing (the positive control: the detector hears a click when there is
 * one).
 *
 * Measured 2026-09-23 with a matched band at 0 dB built as unity on its own
 * poles (`biquad_matched.cpp`): -109, -90 and -108 dBFS for the three cases
 * below, over a floor of -145; the swap without history clicks at -65, -47
 * and -24. A pole-less identity instead switched the incoming side from the
 * band's output to the untouched input in one sample.
 */
void an_edit_landing_mid_fade_on_zero_does_not_click() {
  std::printf("an edit landing mid-fade on 0 dB does not click\n");
  const auto band = [](const char* shape, double gain) {
    char line[160];
    std::snprintf(line, sizeof line,
                  "# FluidEQEqLayer: ON\r\n# FluidEQFilterDesign: MATCHED\r\n"
                  "Filter: ON %s Gain %.2f dB Q %s\r\n",
                  shape, gain,
                  std::string(shape).rfind("PK", 0) == 0 ? "1" : "0.7071");
    return chain_from(line);
  };
  constexpr uint32_t kBlock = 240;  // 5 ms: the second edit lands mid-fade.
  const uint32_t first_edit = kRate;
  const uint32_t frames = kRate * 2;
  std::vector<float> program(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    program[at] = static_cast<float>(0.25 * std::sin(2.0 * 3.141592653589793 * 55.0 * t) +
                                     0.25 * std::sin(2.0 * 3.141592653589793 * 700.0 * t));
  }
  struct Case {
    const char* shape;
    double gains[3];
  };
  const Case cases[] = {
      {"PK Fc 700 Hz", {-1.0, -0.5, 0.0}},
      {"PK Fc 700 Hz", {6.0, -6.0, 0.0}},
      {"LSC Fc 100 Hz", {6.0, -6.0, 0.0}},
  };
  for (const Case& one : cases) {
    const auto run = [&](bool carry) {
      std::vector<float> out = program;
      auto graph = std::make_unique<Graph>(band(one.shape, one.gains[0]), kRate, 1, kBlock);
      for (uint32_t at = 0; at < frames; at += kBlock) {
        const uint32_t edit = at == first_edit ? 1 : at == first_edit + kBlock ? 2 : 0;
        if (edit != 0) {
          auto next = std::make_unique<Graph>(band(one.shape, one.gains[edit]), kRate, 1, kBlock);
          if (carry) {
            next->request_state_transfer();
            next->adopt_state(graph.get());
          }
          graph = std::move(next);
        }
        float* planes[1] = {out.data() + at};
        graph->process(planes, kBlock);
      }
      return out;
    };
    const std::vector<float> faded = run(true);
    const std::vector<float> swapped = run(false);
    const double floor = click_dbfs(faded, kRate / 2, first_edit - kRate / 10);
    const double edited = click_dbfs(faded, first_edit, first_edit + kRate / 10);
    const double control = click_dbfs(swapped, first_edit, first_edit + kRate / 10);
    std::printf("  %-14s %+.1f -> %+.1f -> %+.1f dB: floor %.1f, edit %.1f, "
                "swap without history %.1f dBFS\n",
                one.shape, one.gains[0], one.gains[1], one.gains[2], floor,
                edited, control);
    CHECK(control > edited + 20.0);
    CHECK(edited < -85.0);
  }
}

void oversized_block_is_refused() {
  std::printf("a block larger than the graph was built for is left alone\n");
  const Chain chain = chain_from("Preamp: -6 dB\r\n");
  Graph graph(chain, kRate, 1, 480);

  std::vector<float> buffer = tone(1000.0, 0.5, 960, 0);
  const std::vector<float> reference = buffer;
  float* planar[1] = {buffer.data()};
  graph.process(planar, 960);

  bool identical = true;
  for (size_t at = 0; at < reference.size(); ++at) {
    identical = identical && buffer[at] == reference[at];
  }
  CHECK(identical);
}

bool all_finite(const std::vector<float>& samples) {
  for (const float sample : samples) {
    if (!std::isfinite(sample)) {
      return false;
    }
  }
  return true;
}

/**
 * One NaN in, and then clean audio: the block with it is silenced, and the
 * clean block after it plays — rather than the NaN living on in the biquad's
 * history and turning every block after it into NaN too.
 */
void a_nan_is_silenced_and_forgotten() {
  std::printf("a sample that is not a number is silenced, not kept\n");
  const Chain chain = chain_from("Filter: ON PK Fc 1000 Hz Gain 6 dB Q 1\r\n");
  Graph graph(chain, kRate, 1, 480);

  std::vector<float> poisoned = tone(1000.0, 0.5, 480, 0);
  poisoned[100] = std::numeric_limits<float>::quiet_NaN();
  float* planar[1] = {poisoned.data()};
  graph.process(planar, 480);
  CHECK(all_finite(poisoned));
  bool silent = true;
  for (const float sample : poisoned) {
    silent = silent && sample == 0.0f;
  }
  CHECK(silent);
  CHECK(graph.silenced_blocks() == 1);

  // The positive control is the one that matters: a clean block afterwards
  // comes out as music, not as the NaN the filter would otherwise remember.
  std::vector<float> clean = tone(1000.0, 0.5, 480, 480);
  planar[0] = clean.data();
  graph.process(planar, 480);
  CHECK(all_finite(clean));
  float loudest = 0.0f;
  for (const float sample : clean) {
    loudest = std::max(loudest, std::fabs(sample));
  }
  CHECK(loudest > 0.1f);
  CHECK(graph.silenced_blocks() == 1);
}

void an_infinity_is_silenced_too() {
  std::printf("an infinite sample is silenced as well\n");
  const Chain chain = chain_from("Preamp: -6 dB\r\n");
  Graph graph(chain, kRate, 2, 480);
  std::vector<float> left = tone(1000.0, 0.5, 480, 0);
  std::vector<float> right = tone(1000.0, 0.5, 480, 0);
  right[7] = std::numeric_limits<float>::infinity();
  float* planar[2] = {left.data(), right.data()};
  graph.process(planar, 480);
  // Both channels, not only the one that carried it: half a stereo pair
  // silenced is a hole in the image rather than a dropout.
  CHECK(all_finite(left) && all_finite(right));
  CHECK(left[10] == 0.0f && right[10] == 0.0f);
}

}  // namespace

int main() {
  std::printf("fluideq engine processing graph\n");
  peak_cut_attenuates_its_frequency();
  preamp_scales();
  unmatched_chain_is_passthrough();
  state_inherits_across_gain_change();
  an_edit_landing_mid_fade_on_zero_does_not_click();
  oversized_block_is_refused();
  a_nan_is_silenced_and_forgotten();
  an_infinity_is_silenced_too();
  return report();
}

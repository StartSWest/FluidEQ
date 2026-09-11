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
#include <vector>

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
  Graph warm(b, kRate, 1, kTail);
  CHECK(warm.has_same_band_layout(first));
  warm.inherit_state(first);
  run_blocks(warm, carried, kTail);

  std::vector<std::vector<float>> fresh(1, next);
  Graph cold(b, kRate, 1, kTail);
  run_blocks(cold, fresh, kTail);

  const double with_state = std::fabs(static_cast<double>(carried[0][0]) - last);
  const double without_state = std::fabs(static_cast<double>(fresh[0][0]) - last);
  std::printf("       step with history %.4f, without %.4f\n", with_state,
              without_state);
  CHECK(with_state < 0.05);
  CHECK(without_state > 0.05);

  // A different layout is refused, so a history is never fed to a filter it
  // did not come from.
  const Chain two_bands = chain_from(
      "Filter: ON PK Fc 1000 Hz Gain -3 dB Q 1\r\n"
      "Filter: ON HPQ Fc 30 Hz Q 0.71\r\n");
  Graph other(two_bands, kRate, 1, kTail);
  CHECK(!other.has_same_band_layout(first));
  CHECK(!first.has_same_band_layout(other));
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
  oversized_block_is_refused();
  a_nan_is_silenced_and_forgotten();
  an_infinity_is_silenced_too();
  return report();
}

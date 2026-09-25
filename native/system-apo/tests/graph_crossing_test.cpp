/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A switch that moves the sound in time crosses over rather than jumping.
 *
 * Each preset carries its own Maximizer look-ahead, None switches the rack
 * off, Game mode and the curves stage change the delay too, so most preset
 * switches hand the sound to a graph that delays it differently — and the
 * graph used to take over sample for sample, its first sample out some other
 * moment of the music: -24 to -30 dBFS above 5 kHz on 534 of 636 switches
 * between the factory chains (2026-09-25). The graph before now plays on
 * while the new one fills, and the two cross (`graph.h`). Measured as the
 * loudest millisecond above 5 kHz around the switch against the loudest the
 * two graphs put there while steady, under four low tones; each case beside
 * its control, the same two graphs' steady outputs spliced at the same
 * sample.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "../src/dsp_chain.h"
#include "../src/graph_reclaim.h"
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"

using fluideq_engine::Graph;
using fluideq_engine::OwnedGraph;
using fluideq_engine::reclaim_graphs;
using fluideq_engine_test::chain_with;
using fluideq_engine_test::kExciterEnabled;
using fluideq_engine_test::kMaximizerCeilingDb;
using fluideq_engine_test::kMaximizerDriveDb;
using fluideq_engine_test::kMaximizerEnabled;
using fluideq_engine_test::kMaximizerLookAheadMs;
using fluideq_engine_test::kPi;
using fluideq_engine_test::kRackEnabled;
using fluideq_engine_test::kRate;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;

namespace {

constexpr uint32_t kBlock = 480;
constexpr uint32_t kBefore = kRate;            // a second of the first graph
constexpr uint32_t kAfter = kRate * 6 / 10;    // 600 ms of what follows
constexpr double kAllowedDb = 6.0;
constexpr double kControlDb = 20.0;
/** Auto normalize on, as the app writes every configuration. */
constexpr const char* kEq = "# FluidEQAutoPreamp: ON\r\nPreamp: 0 dB\r\n";

std::vector<double> rack(double look_ahead_ms) {
  std::vector<double> values = reference_values();
  values[kExciterEnabled] = 0.0;  // it adds a top of its own to the tones
  values[kMaximizerEnabled] = 1.0;
  values[kMaximizerDriveDb] = 0.0;
  values[kMaximizerCeilingDb] = 0.0;
  values[kMaximizerLookAheadMs] = look_ahead_ms;
  return values;
}

std::unique_ptr<Graph> graph(const std::vector<double>& values,
                             const char* eq = kEq) {
  return std::make_unique<Graph>(chain_with(values, eq), kRate, 2, kBlock);
}

/** Four low tones, the sides a little apart; nothing above 1.2 kHz. */
void signal(uint32_t from, std::vector<float>& left, std::vector<float>& right) {
  for (uint32_t at = 0; at < kBlock; ++at) {
    const double t = static_cast<double>(from + at) / kRate;
    left[at] = static_cast<float>(
        0.25 * std::sin(2 * kPi * 55.0 * t) + 0.12 * std::sin(2 * kPi * 180.3 * t) +
        0.06 * std::sin(2 * kPi * 441.7 * t) + 0.02 * std::sin(2 * kPi * 1103.0 * t));
    right[at] = static_cast<float>(
        0.23 * std::sin(2 * kPi * 55.0 * t + 0.3) + 0.12 * std::sin(2 * kPi * 180.3 * t + 0.9) +
        0.05 * std::sin(2 * kPi * 441.7 * t + 1.7) + 0.025 * std::sin(2 * kPi * 1103.0 * t + 2.2));
  }
}

void run(Graph& through, uint32_t from, uint32_t frames, std::vector<float>& out) {
  std::vector<float> left(kBlock), right(kBlock);
  for (uint32_t done = 0; done < frames; done += kBlock) {
    signal(from + done, left, right);
    float* planes[2] = {left.data(), right.data()};
    through.process(planes, kBlock);
    out.insert(out.end(), left.begin(), left.end());
  }
}

/** As the watcher hands over: the graph before stays, the new one adopts. */
void hand_over(Graph& next, Graph& running) {
  next.request_state_transfer();
  next.inherit_rack(running);
  next.adopt_state(&running);
}

/** The loudest millisecond above 5 kHz in [from, to), as an RMS. */
double loudest_top(const std::vector<float>& out, size_t from, size_t to) {
  struct Section {
    double b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  };
  const auto highpass = [](double q) {
    const double w = 2 * kPi * 5000.0 / kRate;
    const double c = std::cos(w);
    const double alpha = std::sin(w) / (2 * q);
    const double a0 = 1 + alpha;
    return Section{(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0,
                   (1 - alpha) / a0};
  };
  Section sections[2] = {highpass(0.5412), highpass(1.3066)};
  std::vector<double> top(out.size());
  for (size_t at = 0; at < out.size(); ++at) {
    double x = static_cast<double>(out[at]);
    for (Section& s : sections) {
      const double y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
      s.x2 = s.x1;
      s.x1 = x;
      s.y2 = s.y1;
      s.y1 = y;
      x = y;
    }
    top[at] = x;
  }
  double loudest = 0;
  for (size_t at = from; at + 48 <= to && at + 48 <= top.size(); at += 24) {
    double sum = 0;
    for (size_t k = 0; k < 48; ++k) sum += top[at + k] * top[at + k];
    loudest = std::max(loudest, std::sqrt(sum / 48));
  }
  return loudest;
}

/** The switch against the steady graphs either side of it, in dB. */
double over_steady(const std::vector<float>& out, uint32_t seam) {
  const double before = loudest_top(out, kRate / 2, seam - kRate / 50);
  const double after = loudest_top(out, seam + kRate * 3 / 10, out.size());
  const double at_seam = loudest_top(out, seam - kRate / 200, seam + kRate * 3 / 10);
  return 20 * std::log10(std::max(at_seam, 1e-12) / std::max({before, after, 1e-9}));
}

/** The two graphs' steady outputs, spliced at the switch: the control. */
double spliced(const std::vector<double>& from, const std::vector<double>& to,
               const char* from_eq = kEq, const char* to_eq = kEq) {
  auto first = graph(from, from_eq);
  auto second = graph(to, to_eq);
  std::vector<float> out, other;
  run(*first, 0, kBefore, out);
  run(*second, 0, kBefore + kAfter, other);
  out.insert(out.end(), other.begin() + kBefore, other.end());
  return over_steady(out, kBefore);
}

void judged(const char* name, double handed, double control) {
  std::printf("  %-46s %+6.1f dB over steady (spliced %+6.1f)\n", name, handed,
              control);
  CHECK(control > kControlDb);
  CHECK(handed < kAllowedDb);
}

void a_new_look_ahead_crosses_over() {
  std::printf("a switch to another look-ahead\n");
  for (const auto& pair : {std::pair<double, double>{2.0, 12.0}, {12.0, 2.0}}) {
    const std::vector<double> from = rack(pair.first);
    const std::vector<double> to = rack(pair.second);
    auto running = graph(from);
    auto next = graph(to);
    CHECK(running->latency_frames() != next->latency_frames());
    std::vector<float> out;
    run(*running, 0, kBefore, out);
    hand_over(*next, *running);
    CHECK(next->crossing_from() == running.get());
    run(*next, kBefore, kAfter, out);
    // The whole crossing is over well inside 600 ms: the graph before is no
    // longer played, and says so.
    CHECK(next->crossing_from() == nullptr);
    judged(pair.first < pair.second ? "longer look-ahead" : "shorter look-ahead",
           over_steady(out, kBefore), spliced(from, to));
  }
}

void the_rack_switched_off_and_on_crosses_over() {
  std::printf("the rack switched off (None) and back on\n");
  std::vector<double> off = rack(5.0);
  off[kRackEnabled] = 0.0;
  const std::vector<double> on = rack(5.0);
  for (const bool switching_off : {true, false}) {
    const std::vector<double>& from = switching_off ? on : off;
    const std::vector<double>& to = switching_off ? off : on;
    auto running = graph(from);
    auto next = graph(to);
    std::vector<float> out;
    run(*running, 0, kBefore, out);
    hand_over(*next, *running);
    run(*next, kBefore, kAfter, out);
    judged(switching_off ? "rack switched off" : "rack switched on",
           over_steady(out, kBefore), spliced(from, to));
  }
}

/**
 * The arrows held down: a second switch while the first is still filling
 * (passed over, never heard) and while it crosses (played beneath the next).
 */
void a_switch_on_a_switch() {
  std::printf("a switch landing on another one\n");
  const std::vector<double> a = rack(2.0);
  const std::vector<double> b = rack(12.0);
  const std::vector<double> c = rack(6.0);
  for (const uint32_t gap_ms : {10u, 90u}) {
    const uint32_t gap = gap_ms * kRate / 1000;
    auto first = graph(a);
    auto second = graph(b);
    auto third = graph(c);
    std::vector<float> out;
    run(*first, 0, kBefore, out);
    hand_over(*second, *first);
    run(*second, kBefore, gap, out);
    hand_over(*third, *second);
    if (gap_ms == 10) {
      // Still filling, never heard: crossed over from what is heard instead.
      CHECK(third->crossing_from() == first.get());
    } else {
      CHECK(third->crossing_from() == second.get());
    }
    run(*third, kBefore + gap, kAfter, out);
    char name[64];
    std::snprintf(name, sizeof name, "second switch %u ms after the first", gap_ms);
    judged(name, over_steady(out, kBefore), spliced(a, c));
  }
}

/**
 * The same rack under a change of delay on the EQ side (the curves stage
 * switched on): one rack, run once a block, both graphs' EQ after it.
 */
void an_eq_delay_change_shares_the_rack() {
  std::printf("an EQ-side change of delay over one rack\n");
  const std::vector<double> values = rack(5.0);
  const char* staged = "# FluidEQAutoPreamp: ON\r\n# FluidEQCurveStage: ON\r\nPreamp: 0 dB\r\n";
  auto running = graph(values);
  auto next = graph(values, staged);
  CHECK(running->latency_frames() != next->latency_frames());
  std::vector<float> out;
  run(*running, 0, kBefore, out);
  hand_over(*next, *running);
  CHECK(next->rack_is_shared_with(*running));
  CHECK(next->crossing_from() == running.get());
  run(*next, kBefore, kAfter, out);
  judged("curves stage switched on", over_steady(out, kBefore),
         spliced(values, values, kEq, staged));
}

/** Nothing moved in time: the state is carried as it always was. */
void the_same_delay_hands_over_as_before() {
  std::printf("a switch that keeps the delay\n");
  std::vector<double> louder = rack(5.0);
  louder[kMaximizerDriveDb] = 3.0;
  auto running = graph(rack(5.0));
  auto next = graph(louder);
  CHECK(running->latency_frames() == next->latency_frames());
  std::vector<float> out;
  run(*running, 0, kBefore, out);
  hand_over(*next, *running);
  CHECK(next->crossing_from() == nullptr);
  run(*next, kBefore, kAfter, out);
  judged("drive 0 to 3 dB", over_steady(out, kBefore), spliced(rack(5.0), louder));
}

/** The watcher frees no graph that one it keeps is still crossing over from. */
void reclaim_keeps_what_is_crossed_from() {
  std::printf("the watcher keeps a graph still being crossed from\n");
  Graph* gone = graph(rack(5.0)).release();
  Graph* crossed = graph(rack(2.0)).release();
  Graph* crossing = graph(rack(12.0)).release();
  std::vector<float> out;
  run(*crossed, 0, kBefore, out);
  hand_over(*crossing, *crossed);
  std::vector<OwnedGraph> owned = {{gone, 0}, {crossed, 10}, {crossing, 20}};
  // Every grace period long over: only the newest is kept by it.
  reclaim_graphs(owned, 1000);
  CHECK(owned.size() == 2);
  CHECK(owned[0].graph == crossed && owned[1].graph == crossing);
  run(*crossing, kBefore, kAfter, out);
  CHECK(crossing->crossing_from() == nullptr);
  reclaim_graphs(owned, 1000);
  CHECK(owned.size() == 1 && owned[0].graph == crossing);
  reclaim_graphs(owned, 1000);
  delete crossing;
}

}  // namespace

int main() {
  a_new_look_ahead_crosses_over();
  the_rack_switched_off_and_on_crosses_over();
  a_switch_on_a_switch();
  an_eq_delay_change_shares_the_rack();
  the_same_delay_hands_over_as_before();
  reclaim_keeps_what_is_crossed_from();
  return report();
}

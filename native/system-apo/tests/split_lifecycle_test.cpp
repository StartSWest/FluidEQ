/* FluidEQ — GPL-3.0-or-later */

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <string>

#include "../src/split_tap.h"
#include "../src/split_file.h"
#include "graph_test_support.h"

using fluideq_engine::SplitTap;
using fluideq_engine::split_endpoint;
using fluideq_engine::split_role_of;
using fluideq_engine_test::report;

namespace {

constexpr uint32_t kFrames = 480;
constexpr int64_t kTicks = 10'000'000;
const std::wstring kMain = L"{10101010-1111-2222-3333-444455556666}";
const std::wstring kReceiver = L"{20202020-1111-2222-3333-444455556666}";
const std::wstring kOther = L"{30303030-1111-2222-3333-444455556666}";
const std::string kRoute =
    "# main {10101010-1111-2222-3333-444455556666}\n"
    "{10101010-1111-2222-3333-444455556666} "
    "{20202020-1111-2222-3333-444455556666} 0\n";

struct Block {
  std::array<float, kFrames * 2> raw{};
  std::array<float, kFrames> left{};
  std::array<float, kFrames> right{};
  float* planes[2] = {left.data(), right.data()};

  void render(SplitTap& tap, float local, int64_t ticks) {
    raw.fill(local);
    left.fill(local);
    right.fill(local);
    // The same public lifecycle as APOProcess, including its idle fast path.
    if (!tap.active()) return;
    tap.begin();
    const bool reading = tap.reading();
    tap.write(raw.data(), kFrames, ticks);
    if (reading) {
      tap.mix(planes, kFrames, ticks);
      tap.trim_output(planes, kFrames);
    }
  }
};

void a_marker_protects_main_without_a_receiver() {
  std::printf("a main marker protects the role without allocating a ring\n");
  const std::string marker = "# main {30303030-1111-2222-3333-444455556666}\n";
  SplitTap main(kOther, 48000, 2, 3, true, kTicks);
  main.follow(marker, true);
  CHECK(!main.active());
  CHECK(split_endpoint(kOther)->ring.load() == nullptr);
  const auto protected_main = split_role_of(marker + kRoute, kOther);
  CHECK(protected_main.primary && !protected_main.source && !protected_main.target());
  const auto chained = split_role_of(marker + kRoute, kReceiver);
  CHECK(!chained.primary && !chained.target());
}

void stopping_a_receiver_finishes_its_listening_volume_ramp() {
  std::printf("stopping a receiver restores its local stream over the full ramp\n");
  SplitTap receiver(kReceiver, 48000, 2, 3, true, kTicks);
  receiver.follow(kRoute, true);
  Block block;
  block.render(receiver, 0.4f, 0);
  CHECK(block.left.back() == 0.0f);
  receiver.follow(std::string(), true);
  block.render(receiver, 0.4f, kTicks / 100);
  const float middle = block.left.back();
  CHECK(middle > 0.199f && middle < 0.201f);
  block.render(receiver, 0.4f, kTicks / 50);
  // The reader itself is already gone. Skipping the remaining trim ramp
  // would step from 0.2 to 0.4 here, a click in the endpoint's local audio.
  CHECK(block.left.front() > middle && block.left.front() < middle + 0.001f);
  CHECK(std::fabs(block.left.back() - 0.4f) < 3e-5f);
  block.render(receiver, 0.4f, 3 * kTicks / 100);
  CHECK(!receiver.active() && !receiver.reading());
  CHECK(block.left.front() == 0.4f);
}

void a_promoted_main_keeps_only_its_own_raw_audio() {
  std::printf("a former receiver promoted to main immediately drops copy and trim\n");
  SplitTap main(kMain, 48000, 2, 3, true, kTicks);
  SplitTap receiver(kReceiver, 48000, 2, 3, true, kTicks);
  main.follow(kRoute, true);
  receiver.follow(kRoute, true);
  Block source;
  Block heard;
  for (int at = 0; at < 10; ++at) {
    source.render(main, 0.2f, at * kTicks / 100);
    heard.render(receiver, 0.4f, at * kTicks / 100 + kTicks / 300);
  }
  CHECK(heard.left.back() == 0.0f);
  receiver.follow("# main {20202020-1111-2222-3333-444455556666}\n", true);
  heard.render(receiver, 0.4f, kTicks / 10);
  CHECK(!receiver.reading());
  CHECK(heard.left.front() == 0.4f && heard.left.back() == 0.4f);
  CHECK(split_endpoint(kReceiver)->ring.load() == nullptr);
  CHECK(split_endpoint(kReceiver)->reader.load() == nullptr);
}

void stalled_receivers_never_hold_up_publication() {
  std::printf("stalled and absent receivers never alter main or its publication\n");
  SplitTap main(kMain, 48000, 2, 3, true, kTicks);
  SplitTap receiver(kReceiver, 48000, 2, 3, true, kTicks);
  main.follow(kRoute, true);
  receiver.follow(kRoute, true);
  Block source;
  Block heard;
  auto* ring = split_endpoint(kMain)->ring.load();
  CHECK(ring != nullptr);
  if (ring == nullptr) return;
  const auto before = ring->end();
  for (int at = 0; at < 200; ++at) {
    source.render(main, 0.25f, at * kTicks / 100);
    CHECK(source.left.front() == 0.25f && source.right.back() == 0.25f);
    // Stop reading for longer than the whole ring, then resume. Publication
    // still advances once per source block, with no receiver acknowledgement.
    if (at < 4 || at >= 190) {
      heard.render(receiver, 0.0f, at * kTicks / 100 + kTicks / 300);
    }
  }
  CHECK(ring->end() == before + 200 * kFrames);
  CHECK(ring->at(ring->end() - 1, 0) == 0.25f);
  const auto state = receiver.report();
  CHECK(state && state->state == fluideq_engine::SplitState::playing);
}

void a_main_at_no_output_rate_is_never_converted() {
  std::printf("a main output at a rate no output runs at is never converted\n");
  // The rate is read from memory another process writes, and each new one
  // used to build a 260 kB table kept for the tap's life. Own outputs here, so
  // no ring an earlier case left behind holds a clock already.
  const std::wstring main_id = L"{40404040-1111-2222-3333-444455556666}";
  const std::string route =
      "# main {40404040-1111-2222-3333-444455556666}\n"
      "{40404040-1111-2222-3333-444455556666} "
      "{50505050-1111-2222-3333-444455556666} 1\n";
  // 96 kHz is the positive control: the same run converts and plays.
  for (const uint32_t rate : {96000u, 96001u}) {
    SplitTap main(main_id, rate, 2, 3, true, kTicks);
    SplitTap receiver(L"{50505050-1111-2222-3333-444455556666}", 48000, 2, 3,
                      true, kTicks);
    main.follow(route, true);
    receiver.follow(route, true);
    Block source;
    Block heard;
    for (int at = 0; at < 100; ++at) {
      // Two 5 ms blocks of the main output for each 10 ms of the receiver.
      source.render(main, 0.25f, at * kTicks / 100);
      source.render(main, 0.25f, at * kTicks / 100 + kTicks / 200);
      heard.render(receiver, 0.0f, at * kTicks / 100 + kTicks / 300);
      receiver.prepare();  // What the watcher does when the reader asks.
    }
    const auto state = receiver.report();
    CHECK(state.has_value());
    if (!state) continue;
    if (rate == 96000u) {
      CHECK(state->state == fluideq_engine::SplitState::playing);
      CHECK(std::fabs(heard.left.back()) > 0.1f);
    } else {
      CHECK(state->state == fluideq_engine::SplitState::waiting);
      CHECK(heard.left.back() == 0.0f);
    }
  }
}

}  // namespace

int main() {
  a_marker_protects_main_without_a_receiver();
  stopping_a_receiver_finishes_its_listening_volume_ramp();
  a_promoted_main_keeps_only_its_own_raw_audio();
  stalled_receivers_never_hold_up_publication();
  a_main_at_no_output_rate_is_never_converted();
  return report();
}

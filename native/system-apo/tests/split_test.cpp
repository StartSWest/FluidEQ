/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The second output played straight from the main output's engine.
 *
 * Two engine instances on two clocks are simulated here block by block: a
 * writer at its device's rate, drifting against real time, and a reader on
 * its own period, out of step with it. The writer plays a 10 Hz sine on one
 * channel and its cosine on the other, so every frame the reader puts out
 * says exactly which of the writer's frames it came from — and so how far
 * behind it plays, to a thousandth of a frame — without the test ever looking
 * inside the reader. The file's text is pinned against
 * `src/main/outputSplit.ts`, which writes it.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

#include "../src/split_board.h"
#include "../src/split_file.h"
#include "../src/split_reader.h"
#include "../src/split_tap.h"
#include "graph_test_support.h"

using fluideq_engine::SplitKernel;
using fluideq_engine::SplitReader;
using fluideq_engine::SplitRing;
using fluideq_engine::SplitRole;
using fluideq_engine::SplitState;
using fluideq_engine::SplitStats;
using fluideq_engine::SplitTap;
using fluideq_engine::split_role_of;
using fluideq_engine_test::kPi;
using fluideq_engine_test::report;

namespace {

constexpr int64_t kTicks = 10'000'000;  // QueryPerformanceFrequency's usual
constexpr double kTone = 10.0;

const std::wstring kMain = L"{0A0A0A0A-1111-2222-3333-444455556666}";
const std::wstring kSecond = L"{0B0B0B0B-1111-2222-3333-444455556666}";

void the_split_file() {
  std::printf("the split file the app writes\n");
  // The exact text `splitFileText` produces for one second output.
  const std::string text =
      "# FluidEQ Engine second outputs v1\r\n"
      "{0a0a0a0a-1111-2222-3333-444455556666} "
      "{0b0b0b0b-1111-2222-3333-444455556666} 0.800\r\n";
  const SplitRole main = split_role_of(text, kMain);
  CHECK(main.source && !main.target());
  const SplitRole second = split_role_of(text, kSecond);
  CHECK(!second.source && second.target());
  CHECK(second.from == L"{0a0a0a0a-1111-2222-3333-444455556666}");
  CHECK(std::fabs(second.volume - 0.8f) < 1e-6f);
  const SplitRole other =
      split_role_of(text, L"{0C0C0C0C-1111-2222-3333-444455556666}");
  CHECK(!other.source && !other.target());
  CHECK(!split_role_of("", kSecond).target());

  // Anything that is not two ids and a volume from 0 to 1 is no line at all.
  const auto fed = [&](const std::string& line) {
    return split_role_of(line, kSecond).target();
  };
  CHECK(fed("{0a0a0a0a-1111-2222-3333-444455556666} "
            "{0b0b0b0b-1111-2222-3333-444455556666} 1\n"));
  CHECK(!fed("{0a0a0a0a-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} 1.5\n"));
  CHECK(!fed("{0a0a0a0a-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} -0.1\n"));
  CHECK(!fed("{0a0a0a0a-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} loud\n"));
  CHECK(!fed("{0a0a0a0a-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} 0.5 extra\n"));
  CHECK(!fed("0a0a0a0a-1111-2222-3333-444455556666 "
             "{0b0b0b0b-1111-2222-3333-444455556666} 0.5\n"));
  CHECK(!fed("# {0a0a0a0a-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} 0.5\n"));
  // An output never feeds itself.
  CHECK(!fed("{0b0b0b0b-1111-2222-3333-444455556666} "
             "{0b0b0b0b-1111-2222-3333-444455556666} 0.5\n"));
}

void the_ring_keeps_its_clock() {
  std::printf("the ring keeps each block with its clock\n");
  SplitRing ring;
  SplitRing::Clock clock;
  CHECK(ring.clock(&clock) && clock.end == 0 && clock.rate == 0);
  const std::vector<float> block = {0.25f, -0.5f, 0.75f, -1.0f};
  ring.write(block.data(), 2, 2, 48000, 3, 1000);
  CHECK(ring.clock(&clock));
  CHECK(clock.end == 2 && clock.block_start == 0 && clock.ticks == 1000);
  CHECK(clock.rate == 48000 && clock.channels == 2 && clock.mask == 3);
  CHECK(ring.at(1, 0) == 0.75f && ring.at(1, 1) == -1.0f);
  const uint32_t first = clock.generation;
  ring.write(nullptr, 2, 2, 48000, 3, 2000);
  CHECK(ring.clock(&clock) && clock.block_start == 2 && clock.end == 4);
  CHECK(clock.generation == first && ring.at(3, 0) == 0.0f);
  // A new shape is a new generation, which every reader starts over on.
  ring.write(block.data(), 4, 1, 96000, 0, 3000);
  CHECK(ring.clock(&clock) && clock.generation == first + 1);
}

/** One simulated run: a writer and a reader, each on its own clock. */
struct Run {
  uint32_t writer_rate = 48000;
  uint32_t writer_block = 480;
  /** How fast the writer's device runs against real time. */
  double writer_ppm = 200;
  uint32_t reader_rate = 48000;
  uint32_t reader_block = 480;
  double reader_phase = 0.0037;
  double seconds = 60;
  /** Measured from here on: the clocks' difference is learned by then. */
  double settle = 30;
  /** The writer writes nothing from `quiet_from` to `quiet_to` if this is set. */
  bool stall = false;
  /** Where the peak is measured, 30 ms in to leave the fade out of it. */
  double quiet_from = -1;
  double quiet_to = -1;
  /** One writer block, the first at or after this time, comes this late. */
  double late_at = -1;
  double late_by = 0;
};

struct Heard {
  /** Per reader frame from 3 s on, while playing: how far behind, in ms. */
  std::vector<double> behind_ms;
  double worst_amplitude_error = 0;
  /** Largest sample put out between `quiet_from` + 30 ms and `quiet_to`. */
  double quiet_peak = 0;
  bool waited = false;
  bool played_after = false;
  uint32_t underruns = 0;
  uint32_t lag_us = 0;
};

Heard simulate(const Run& run) {
  SplitRing ring;
  SplitReader reader(run.reader_rate, 2, 0);
  SplitStats stats;
  SplitKernel kernel(run.writer_rate, run.reader_rate);
  const double writer_true = run.writer_rate * (1.0 + run.writer_ppm * 1e-6);
  const double period = run.writer_rate / kTone;
  std::vector<float> block(static_cast<size_t>(run.writer_block) * 2);
  std::vector<float> left(run.reader_block);
  std::vector<float> right(run.reader_block);
  float* planes[2] = {left.data(), right.data()};
  Heard heard;
  // The writer's periods so far, written or not: its sound follows real
  // time, and a stalled writer's ring simply stops growing.
  uint64_t blocks = 0;
  bool late_done = false;
  double read_at = run.reader_phase;
  for (;;) {
    const double write_at =
        static_cast<double>(blocks * run.writer_block) / writer_true;
    const bool late = !late_done && run.late_at >= 0 && write_at >= run.late_at;
    const double due = late ? write_at + run.late_by : write_at;
    if (std::min(due, read_at) > run.seconds) {
      break;
    }
    if (due <= read_at) {
      if (!run.stall || write_at < run.quiet_from || write_at >= run.quiet_to) {
        const uint64_t first = blocks * run.writer_block;
        for (uint32_t frame = 0; frame < run.writer_block; ++frame) {
          const double phase =
              2.0 * kPi * static_cast<double>(first + frame) / period;
          block[frame * 2] = static_cast<float>(std::sin(phase));
          block[frame * 2 + 1] = static_cast<float>(std::cos(phase));
        }
        // Stamped when it reached the writer — late, if it came late.
        ring.write(block.data(), 2, run.writer_block, run.writer_rate, 0,
                   static_cast<int64_t>(due * kTicks));
      }
      late_done = late_done || late;
      blocks += 1;
      continue;
    }
    std::fill(left.begin(), left.end(), 0.0f);
    std::fill(right.begin(), right.end(), 0.0f);
    reader.mix(ring, &kernel, 1.0f, planes, run.reader_block,
               static_cast<int64_t>(read_at * kTicks), kTicks, stats);
    const auto state = static_cast<SplitState>(stats.state.load());
    const bool in_quiet = run.quiet_from >= 0 &&
                          read_at > run.quiet_from + 0.03 &&
                          read_at < run.quiet_to;
    if (in_quiet) {
      heard.waited = heard.waited || state == SplitState::waiting;
      for (uint32_t frame = 0; frame < run.reader_block; ++frame) {
        heard.quiet_peak = std::max(
            {heard.quiet_peak, std::fabs(static_cast<double>(left[frame])),
             std::fabs(static_cast<double>(right[frame]))});
      }
    }
    if (run.quiet_to >= 0 && read_at > run.quiet_to + 1.0 &&
        state == SplitState::playing) {
      heard.played_after = true;
    }
    const bool settled = read_at > run.settle &&
                         (run.quiet_from < 0 || read_at < run.quiet_from ||
                          read_at > run.quiet_to + 3.0) &&
                         (run.late_at < 0 || read_at < run.late_at ||
                          read_at > run.late_at + 3.0);
    if (settled && state == SplitState::playing) {
      for (uint32_t frame = 0; frame < run.reader_block; ++frame) {
        const double now = read_at + frame / static_cast<double>(run.reader_rate);
        const double amplitude = std::hypot(left[frame], right[frame]);
        heard.worst_amplitude_error =
            std::max(heard.worst_amplitude_error, std::fabs(amplitude - 1.0));
        double from = std::atan2(left[frame], right[frame]) / (2.0 * kPi) * period;
        double behind = std::fmod(now * writer_true - from, period);
        if (behind < 0) {
          behind += period;
        }
        heard.behind_ms.push_back(behind / writer_true * 1000.0);
      }
    }
    read_at += run.reader_block / static_cast<double>(run.reader_rate);
  }
  heard.underruns = stats.underruns.load();
  heard.lag_us = stats.lag_us.load();
  return heard;
}

double spread(const std::vector<double>& values) {
  const auto [low, high] = std::minmax_element(values.begin(), values.end());
  return *high - *low;
}

double mean(const std::vector<double>& values) {
  double sum = 0;
  for (const double value : values) {
    sum += value;
  }
  return sum / static_cast<double>(values.size());
}

void it_plays_in_time_with_a_drifting_writer() {
  std::printf("it plays a set distance behind a writer on another clock\n");
  const Heard heard = simulate(Run{});
  CHECK(!heard.behind_ms.empty());
  if (heard.behind_ms.empty()) {
    return;
  }
  const double behind = mean(heard.behind_ms);
  std::printf("  behind %.3f ms, spread %.4f ms, says %.3f ms, amplitude "
              "error %.2e\n",
              behind, spread(heard.behind_ms), heard.lag_us / 1000.0,
              heard.worst_amplitude_error);
  // One reader block, the kernel's reach and the 2 ms margin: 12.7 ms.
  CHECK(behind > 11.5 && behind < 14.0);
  // 200 ppm over the measured half minute is 6 ms of drift; held, it never shows.
  CHECK(spread(heard.behind_ms) < 0.1);
  // What the status says is what is played.
  CHECK(std::fabs(behind - heard.lag_us / 1000.0) < 0.3);
  CHECK(heard.underruns == 0);
  // The sinc kernel's own error on a 10 Hz tone, at 0.5% trim at most.
  CHECK(heard.worst_amplitude_error < 1e-3);
}

void it_follows_a_writer_at_another_rate() {
  std::printf("it converts a writer at another rate\n");
  for (const auto& [writer, reader] :
       {std::pair<uint32_t, uint32_t>{96000, 48000}, {48000, 44100},
        {44100, 48000}}) {
    Run run;
    run.writer_rate = writer;
    run.writer_block = writer / 100;
    run.reader_rate = reader;
    run.reader_block = reader / 100;
    run.writer_ppm = -150;
    const Heard heard = simulate(run);
    CHECK(!heard.behind_ms.empty());
    if (heard.behind_ms.empty()) {
      continue;
    }
    std::printf("  %u -> %u: behind %.3f ms, spread %.4f ms\n", writer, reader,
                mean(heard.behind_ms), spread(heard.behind_ms));
    CHECK(mean(heard.behind_ms) > 11.0 && mean(heard.behind_ms) < 14.5);
    CHECK(spread(heard.behind_ms) < 0.1);
    CHECK(heard.underruns == 0);
    CHECK(heard.worst_amplitude_error < 2e-3);
  }
}

void a_stopped_writer_is_never_played_again() {
  std::printf("a writer that stops is faded out, never replayed\n");
  Run run;
  run.stall = true;
  run.quiet_from = 35.0;
  run.quiet_to = 37.0;
  run.seconds = 50;
  const Heard heard = simulate(run);
  CHECK(heard.waited);
  // Exactly nothing once the 5 ms fade is over: the last 13 ms of the
  // writer's sound looped would be a buzz at 77 Hz.
  CHECK(heard.quiet_peak == 0.0);
  CHECK(heard.played_after);
  CHECK(!heard.behind_ms.empty() && spread(heard.behind_ms) < 0.1);
  // A song paused is not a dropout: the distance is what it was.
  CHECK(heard.underruns == 0);
  CHECK(heard.lag_us == simulate(Run{}).lag_us);

  // Positive control: the same window with the writer writing is loud.
  Run steady = run;
  steady.stall = false;
  CHECK(simulate(steady).quiet_peak > 0.9);
}

void a_late_block_widens_the_margin() {
  std::printf("a block that comes late costs one dropout and 1 ms more\n");
  Run run;
  run.late_at = 40.0;
  // Late by more than one of the reader's periods and the margin, so a read
  // is certain to fall while it is missing, whatever the two phases.
  run.late_by = 0.015;
  run.seconds = 50;
  const Heard on_time = simulate(Run{});
  const Heard heard = simulate(run);
  CHECK(heard.underruns == 1);
  CHECK(heard.lag_us >= on_time.lag_us + 900 &&
        heard.lag_us <= on_time.lag_us + 1100);
  CHECK(!heard.behind_ms.empty() && spread(heard.behind_ms) < 1.2);
}

/** Every channel a constant, so what reaches each output is its weight. */
std::vector<float> fold(uint32_t in, unsigned long mask,
                        const std::vector<float>& levels) {
  SplitRing ring;
  SplitReader reader(48000, 2, 0x3);
  SplitStats stats;
  SplitKernel kernel(48000, 48000);
  std::vector<float> block(static_cast<size_t>(480) * in);
  for (size_t at = 0; at < block.size(); ++at) {
    block[at] = levels[at % in];
  }
  std::vector<float> left(480);
  std::vector<float> right(480);
  float* planes[2] = {left.data(), right.data()};
  for (int step = 0; step < 100; ++step) {
    const auto at = static_cast<int64_t>(step) * kTicks / 100;
    ring.write(block.data(), in, 480, 48000, mask, at);
    std::fill(left.begin(), left.end(), 0.0f);
    std::fill(right.begin(), right.end(), 0.0f);
    reader.mix(ring, &kernel, 1.0f, planes, 480, at + kTicks / 400, kTicks,
               stats);
  }
  return {left.back(), right.back()};
}

void surround_folds_into_stereo() {
  std::printf("a surround main output folds into a stereo second one\n");
  constexpr float kHalf = 0.70710678f;
  // 5.1: FL FR C LFE BL BR.
  const auto five = fold(6, 0x3F, {0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f});
  CHECK(std::fabs(five[0] - (0.1f + 0.3f * kHalf + 0.5f * kHalf)) < 1e-4f);
  CHECK(std::fabs(five[1] - (0.2f + 0.3f * kHalf + 0.6f * kHalf)) < 1e-4f);
  const auto mono = fold(1, 0, {0.5f});
  CHECK(std::fabs(mono[0] - 0.5f * kHalf) < 1e-4f);
  CHECK(std::fabs(mono[1] - 0.5f * kHalf) < 1e-4f);
  const auto stereo = fold(2, 0x3, {0.25f, -0.75f});
  CHECK(std::fabs(stereo[0] - 0.25f) < 1e-4f &&
        std::fabs(stereo[1] + 0.75f) < 1e-4f);
}

void one_instance_writes_and_one_plays() {
  std::printf("one instance per output writes, and one plays\n");
  const std::string text =
      "{0A0A0A0A-1111-2222-3333-444455556666} "
      "{0B0B0B0B-1111-2222-3333-444455556666} 0.5\n";
  auto first = std::make_unique<SplitTap>(kMain, 48000, 2, 0x3, true, kTicks);
  auto second = std::make_unique<SplitTap>(kMain, 48000, 2, 0x3, true, kTicks);
  // Entering the source role now publishes transport health even though a
  // main has no `from` field. An unchanged role still avoids status churn.
  CHECK(first->follow(text, true));
  CHECK(second->follow(text, true));
  CHECK(!first->follow(text, true));
  CHECK(!second->follow(text, true));
  std::vector<float> block(960, 0.5f);
  SplitRing* ring = fluideq_engine::split_endpoint(kMain)->ring.load();
  CHECK(ring != nullptr);
  if (ring == nullptr) {
    return;
  }
  const uint64_t start = ring->end();
  first->begin();
  second->begin();
  first->write(block.data(), 480, 0);
  second->write(block.data(), 480, 0);
  CHECK(ring->end() == start + 480);
  // The first lets go; the second takes over at its next block.
  first.reset();
  second->begin();
  second->write(block.data(), 480, kTicks / 100);
  CHECK(ring->end() == start + 960);
  // With FluidEQ gone there is nothing to write.
  second->follow(text, false);
  second->begin();
  second->write(block.data(), 480, kTicks / 50);
  CHECK(ring->end() == start + 960);
  second->follow(text, true);

  SplitTap player(kSecond, 48000, 2, 0x3, true, kTicks);
  CHECK(player.follow(text, true));
  player.begin();
  CHECK(player.reading());
  std::vector<float> left(480);
  std::vector<float> right(480);
  float* planes[2] = {left.data(), right.data()};
  float heard = 0.0f;
  for (int step = 3; step < 60; ++step) {
    const int64_t at = static_cast<int64_t>(step) * kTicks / 100;
    second->begin();
    second->write(block.data(), 480, at);
    std::fill(left.begin(), left.end(), 0.0f);
    std::fill(right.begin(), right.end(), 0.0f);
    player.begin();
    player.mix(planes, 480, at + kTicks / 300);
    if (step == 59) CHECK(std::fabs(left.back() - 0.5f) < 1e-3f);
    player.trim_output(planes, 480);
    heard = left.back();
  }
  // Half the volume of a 0.5 constant.
  CHECK(std::fabs(heard - 0.25f) < 1e-3f);
  const auto said = player.report();
  CHECK(said && said->state == SplitState::playing &&
        said->from == L"{0A0A0A0A-1111-2222-3333-444455556666}");
  // Stopped: faded out over 5 ms, then nothing at all.
  player.follow(std::string(), true);
  CHECK(!player.report());
  for (int step = 60; step < 63; ++step) {
    std::fill(left.begin(), left.end(), 0.0f);
    player.begin();
    player.mix(planes, 480, static_cast<int64_t>(step) * kTicks / 100);
    player.trim_output(planes, 480);
  }
  CHECK(left.back() == 0.0f && !player.reading());
}

}  // namespace

int main() {
  std::printf("fluideq engine second output\n");
  the_split_file();
  the_ring_keeps_its_clock();
  it_plays_in_time_with_a_drifting_writer();
  it_follows_a_writer_at_another_rate();
  a_stopped_writer_is_never_played_again();
  a_late_block_widens_the_margin();
  surround_folds_into_stereo();
  one_instance_writes_and_one_plays();
  return report();
}

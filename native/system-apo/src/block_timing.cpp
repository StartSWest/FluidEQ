/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// No Windows header here: the test that pins the arithmetic and the wording
// links nothing but this.

#include "block_timing.h"

#include <cstdio>
#include <limits>

namespace fluideq_engine {

namespace {

constexpr uint32_t kHalf = 500;
constexpr uint32_t kStep = 250;
/** The highest step there is: a block that took twice its own time. */
constexpr uint32_t kTopStep = 8;

}  // namespace

uint32_t BlockTiming::record(uint64_t elapsed, uint64_t ticks_per_second,
                             uint32_t frames, uint32_t rate) noexcept {
  if (frames == 0 || rate == 0 || ticks_per_second == 0) {
    return static_cast<uint32_t>(slowest_.load(std::memory_order_relaxed) >>
                                 32);
  }
  // The share in thousandths: elapsed over the block's own time, which is
  // frames / rate seconds, or frames * ticks / rate counter ticks. Held in
  // range for a call a debugger stopped, so the product cannot overflow:
  // 2^32 ticks is seven minutes at the usual 10 MHz.
  const uint64_t held = elapsed < (uint64_t{1} << 32) ? elapsed : (uint64_t{1} << 32);
  const uint64_t share = held * 1000u * rate /
                         (static_cast<uint64_t>(frames) * ticks_per_second);
  const auto permille = static_cast<uint32_t>(
      share < std::numeric_limits<uint32_t>::max()
          ? share
          : std::numeric_limits<uint32_t>::max());
  const auto period_us =
      static_cast<uint32_t>(static_cast<uint64_t>(frames) * 1000000u / rate);

  blocks_.fetch_add(1, std::memory_order_relaxed);
  if (permille > kHalf) {
    over_half_.fetch_add(1, std::memory_order_relaxed);
  }
  const uint64_t packed = (static_cast<uint64_t>(permille) << 32) | period_us;
  uint64_t current = slowest_.load(std::memory_order_relaxed);
  while ((current >> 32) < permille &&
         !slowest_.compare_exchange_weak(current, packed,
                                         std::memory_order_relaxed)) {
    // Another instance got there first; `current` is what it wrote, and the
    // comparison runs again against that.
  }
  const auto slowest = static_cast<uint32_t>(current >> 32);
  return slowest > permille ? slowest : permille;
}

BlockTiming::Reading BlockTiming::read() const noexcept {
  Reading reading;
  reading.blocks = blocks_.load(std::memory_order_relaxed);
  reading.over_half = over_half_.load(std::memory_order_relaxed);
  const uint64_t slowest = slowest_.load(std::memory_order_relaxed);
  reading.slowest_permille = static_cast<uint32_t>(slowest >> 32);
  reading.period_ms = static_cast<double>(slowest & 0xffffffffu) / 1000.0;
  reading.slowest_ms =
      reading.period_ms * static_cast<double>(reading.slowest_permille) / 1000.0;
  return reading;
}

uint32_t timing_step(uint32_t permille) noexcept {
  const uint32_t step = permille / kStep;
  return step < kTopStep ? step : kTopStep;
}

std::string describe_timing(const BlockTiming::Reading& reading) {
  if (reading.blocks == 0) {
    return "no block timed yet";
  }
  char text[160] = {};
  std::snprintf(text, sizeof(text),
                "slowest block %.2f ms of its %.2f ms (%u%%), %llu of %llu "
                "over half",
                reading.slowest_ms, reading.period_ms,
                static_cast<unsigned>((reading.slowest_permille + 5u) / 10u),
                static_cast<unsigned long long>(reading.over_half),
                static_cast<unsigned long long>(reading.blocks));
  return text;
}

}  // namespace fluideq_engine

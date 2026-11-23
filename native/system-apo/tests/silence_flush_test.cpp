/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long a microphone's rack plays out once Windows sends silence
 * (`silence_flush.h`), at all eight shared-mode rates: exactly its delay and
 * the tail after the last sound, then nothing until the next sound - beside
 * the control of a stream that never had any, which owes nothing at all.
 */

#include <cstdint>
#include <cstdio>
#include <initializer_list>

#include "../src/silence_flush.h"

using fluideq_engine::SilenceFlush;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

void plays_out_its_delay_and_tail_then_stops(uint32_t rate) {
  const uint32_t block = rate / 100;
  const uint32_t latency = rate / 50;  // the cleaner's 20 ms
  const uint64_t owed = latency + static_cast<uint64_t>(rate) * SilenceFlush::kTailMs / 1000u;
  SilenceFlush flush;
  // Control: before any sound nothing is owed.
  CHECK(!flush.take(block));
  flush.heard(latency, rate);
  uint64_t played = 0;
  while (flush.take(block)) {
    played += block;
    CHECK(played < owed + 2u * block);  // bounded: it always stops
  }
  CHECK(played >= owed && played < owed + block);
  // Emptied: the next silent block skips, and keeps skipping.
  CHECK(!flush.take(block));
  CHECK(!flush.take(block));
  // Sound again owes the whole of it again.
  flush.heard(latency, rate);
  CHECK(flush.take(block));
  // A new stream owes nothing.
  flush.clear();
  CHECK(!flush.take(block));
}

}  // namespace

int main() {
  for (const uint32_t rate : {44100u, 48000u, 88200u, 96000u, 176400u, 192000u,
                              352800u, 384000u}) {
    std::printf("rate %u\n", rate);
    plays_out_its_delay_and_tail_then_stops(rate);
  }
  if (g_failures == 0) {
    std::printf("all checks passed\n");
  } else {
    std::printf("%d check(s) failed\n", g_failures);
  }
  return g_failures == 0 ? 0 : 1;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The doorbell the host's threads sleep on in place of a fixed sleep.
 *
 * What would go wrong is a lost ring: work made, the waiter asleep, nobody
 * coming — which is a Library that stops decoding or a voice cleaner that
 * stops cleaning. So the heavy case is a producer and a waiter racing through
 * a hundred thousand pieces of work, and the waiter has to see every one of
 * them. A lost ring there hangs, which ctest reports as a failure
 * (`TIMEOUT` on this test in CMakeLists.txt).
 */

#include "fluideq/doorbell.h"

#include <atomic>
#include <cstdint>
#include <cstdio>
#include <thread>

#include "dsp_test_support.h"

using feq_test::check;

namespace {

void arming_is_not_ringing() {
  std::printf("arming is not ringing\n");
  FeqDoorbell bell;
  const uint32_t before = bell.rung();
  bell.arm();
  bell.arm();
  check(bell.rung() == before, "arm alone leaves the count where it was");
  bell.ring_if_armed();
  // The positive control for the line above: the same doorbell does count.
  check(bell.rung() == before + 1, "two arms ring once");
  bell.ring_if_armed();
  check(bell.rung() == before + 1, "nothing armed, nothing rung");
}

void a_ring_before_the_wait_is_kept() {
  std::printf("a ring before the wait is kept\n");
  FeqDoorbell bell;
  const uint32_t seen = bell.rung();
  bell.ring();
  // Would never return if the ring had been dropped for having no sleeper.
  bell.wait(seen);
  check(bell.rung() != seen, "the wait returned on a ring made before it");
}

void a_sleeper_is_woken() {
  std::printf("a sleeper is woken\n");
  FeqDoorbell bell;
  std::atomic<int> woke{0};
  const uint32_t seen = bell.rung();
  std::thread sleeper([&] {
    bell.wait(seen);
    woke.store(1, std::memory_order_release);
  });
  bell.ring();
  sleeper.join();
  check(woke.load(std::memory_order_acquire) == 1, "the sleeper woke");
}

/**
 * The callback's pattern exactly: make work, arm, and ring what was armed
 * after the "block" — from a thread that is not the one waiting.
 */
void no_work_is_ever_slept_through() {
  std::printf("no work is ever slept through\n");
  constexpr uint32_t kWork = 100000;
  FeqDoorbell bell;
  std::atomic<uint32_t> made{0};
  uint32_t taken = 0;
  uint32_t sleeps = 0;
  std::thread waiter([&] {
    for (;;) {
      const uint32_t seen = bell.rung();
      const uint32_t available = made.load(std::memory_order_acquire);
      if (available != taken) {
        taken = available;
        if (taken == kWork) {
          return;
        }
        continue;
      }
      sleeps += 1;
      bell.wait(seen);
    }
  });
  for (uint32_t at = 0; at < kWork; ++at) {
    made.fetch_add(1, std::memory_order_release);
    bell.arm();
    bell.ring_if_armed();
  }
  waiter.join();
  std::printf("  %u pieces of work, %u sleeps between them\n", taken, sleeps);
  check(taken == kWork, "every piece of work was seen");
}

}  // namespace

int main() {
  arming_is_not_ringing();
  a_ring_before_the_wait_is_kept();
  a_sleeper_is_woken();
  no_work_is_ever_slept_through();
  return feq_test::finish();
}

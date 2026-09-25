/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The wake the audio callback gives the threads that wait on it
 * (`fluideq/wake.h`): the decoder, the voice cleaner and telemetry.
 *
 * The one way it can fail is a lost wake — a signal given between a thread
 * looking for work and going to sleep, slept through — and what that looks
 * like is not a wrong answer but a thread that never wakes: the decoder stops
 * refilling, the track runs dry. So the checks here are shaped as work that
 * cannot finish unless every wake arrives, and a failure is this program not
 * ending; ctest's own limit on the test is what reports it.
 */

#include "fluideq/wake.h"

#include <atomic>
#include <cstdint>
#include <cstdio>
#include <thread>

namespace {

int g_failures = 0;

void check(bool ok, const char* what) {
  std::printf("  %-4s %s\n", ok ? "ok" : "FAIL", what);
  if (!ok) {
    ++g_failures;
  }
}

/** A wake already given returns the wait at once, with nobody asleep. */
void test_signal_before_wait() {
  FeqWake wake;
  const uint32_t seen = wake.seen();
  wake.signal();
  wake.wait(seen);
  check(wake.seen() != seen, "a signal given before the wait is not slept through");
}

/**
 * A waiter sleeping on the wake is woken by another thread's signal.
 *
 * The waiter says it is about to wait; the signal is given after that, so it
 * lands either just before the wait (returns at once) or during it (wakes it).
 * Both are the contract; neither may leave the thread asleep.
 */
void test_signal_wakes_a_sleeper() {
  FeqWake wake;
  std::atomic<bool> about_to_wait{false};
  std::atomic<bool> woke{false};
  std::thread waiter([&] {
    const uint32_t seen = wake.seen();
    about_to_wait.store(true);
    about_to_wait.notify_one();
    wake.wait(seen);
    woke.store(true);
  });
  about_to_wait.wait(false);
  wake.signal();
  waiter.join();
  check(woke.load(), "a thread asleep on the wake is woken by a signal");
}

/**
 * The decoder's shape, a hundred thousand times over: a producer hands over
 * one item per signal, a consumer takes what is there and sleeps when there
 * is none. The consumer only finishes if no wake between its look and its
 * sleep is ever lost.
 */
void test_no_wake_is_lost_under_load() {
  constexpr uint32_t kItems = 100000;
  FeqWake wake;
  std::atomic<uint32_t> produced{0};
  uint32_t consumed = 0;
  std::thread consumer([&] {
    while (consumed < kItems) {
      const uint32_t seen = wake.seen();
      const uint32_t ready = produced.load(std::memory_order_acquire);
      if (ready > consumed) {
        consumed = ready;
        continue;
      }
      wake.wait(seen);
    }
  });
  for (uint32_t at = 0; at < kItems; ++at) {
    produced.store(at + 1, std::memory_order_release);
    wake.signal();
  }
  consumer.join();
  check(consumed == kItems, "every item was taken: no wake was lost");
}

/** How a waiting thread is told to stop, which is what every shutdown does. */
void test_stop_wakes_the_waiter() {
  FeqWake wake;
  std::atomic<bool> running{true};
  uint32_t passes = 0;
  std::thread worker([&] {
    for (;;) {
      const uint32_t seen = wake.seen();
      if (!running.load(std::memory_order_acquire)) {
        return;
      }
      passes += 1;
      wake.wait(seen);
    }
  });
  running.store(false, std::memory_order_release);
  wake.signal();
  worker.join();
  check(passes <= 1, "a stop and one signal end a thread asleep on the wake");
}

}  // namespace

int main() {
  std::printf("fluideq wake\n");
  test_signal_before_wait();
  test_signal_wakes_a_sleeper();
  test_no_wake_is_lost_under_load();
  test_stop_wakes_the_waiter();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

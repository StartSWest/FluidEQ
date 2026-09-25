/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One thread waking another, where the one doing the waking may be the audio
 * callback.
 *
 * What it replaces is a thread that slept for a fixed few milliseconds and
 * looked again: the decoder every 5 ms while its rings were full, the voice
 * cleaner every 1 ms while it had no input, telemetry every 25 ms. Each of
 * those waited on something the audio callback does — take from a ring, hand
 * over a block, render a period — and each guessed how long that takes. This
 * is the callback saying it did.
 *
 * The callback's side never blocks and never takes a lock: an atomic
 * increment, an atomic load, and only when the other thread is really asleep
 * on it, a wake (`WakeByAddressSingle` on Windows, a futex on Linux, `ulock`
 * on macOS — none of which waits for anything). A thread that is busy costs
 * the callback two atomic operations and nothing else.
 *
 * How to use it, so no signal is lost:
 *
 *     for (;;) {
 *       const uint32_t seen = wake.seen();   // BEFORE looking for work
 *       ...do whatever there is...
 *       if (nothing was done) wake.wait(seen);
 *     }
 *
 * A signal given while the pass was looking moves the generation past
 * `seen`, so the wait returns at once instead of sleeping through it. One
 * waiter per wake; any number of signallers.
 */
#ifndef FLUIDEQ_WAKE_H
#define FLUIDEQ_WAKE_H

#include <atomic>
#include <cstdint>

class FeqWake {
 public:
  /** Any thread, the audio callback included. */
  void signal() noexcept {
    generation_.fetch_add(1, std::memory_order_seq_cst);
    // Sequentially consistent against the waiter's store of `sleeping_`
    // before it compares the generation: either the waiter sees this
    // increment and does not sleep, or this load sees it asleep and wakes it.
    if (sleeping_.load(std::memory_order_seq_cst) != 0) {
      generation_.notify_one();
    }
  }

  /** Where things stand now. Read before looking for work. */
  uint32_t seen() const noexcept {
    return generation_.load(std::memory_order_seq_cst);
  }

  /** Sleeps until a signal given after `seen`. Returns at once if one was. */
  void wait(uint32_t seen) noexcept {
    sleeping_.store(1, std::memory_order_seq_cst);
    // `atomic::wait` compares before it sleeps and sleeps only while the
    // value still equals `seen`, and wakes are compared again inside the
    // platform wait, so a signal between the two cannot be slept through.
    generation_.wait(seen, std::memory_order_seq_cst);
    sleeping_.store(0, std::memory_order_seq_cst);
  }

 private:
  std::atomic<uint32_t> generation_{0};
  std::atomic<uint32_t> sleeping_{0};
};

#endif /* FLUIDEQ_WAKE_H */

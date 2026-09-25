/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One thread asleep until another says there is work for it.
 *
 * The threads around the audio callback used to find out whether there was
 * work by sleeping a fixed time and looking: the decoder every 5 ms, the voice
 * worker every 1 ms, telemetry every 25 ms. None of those numbers said
 * anything about the work. The decoder woke two hundred times a second with
 * two seconds of music already buffered, the voice worker a thousand times a
 * second with the Library stopped, and all three went on doing it for as long
 * as the host lived. A doorbell is rung by whoever made the work, and the
 * thread that does it sleeps until then — however fast or slow the machine.
 *
 * The audio callback may not make a system call, take a lock or wait, so it
 * never rings. It ARMS — one atomic store — and whoever owns the callback
 * rings what was armed once the block has been handed on: the device thread
 * after the period is released to the device, or the offline loop after each
 * block. The work was ready the moment the block ended; the ring follows it
 * by microseconds and costs the callback nothing.
 *
 * One waiter per doorbell. Every thread that waits on one here is the only
 * thread that ever will, and that is what lets a ring be a counter.
 */
#ifndef FLUIDEQ_DOORBELL_H
#define FLUIDEQ_DOORBELL_H

#ifdef __cplusplus

#include <atomic>
#include <cstdint>

class FeqDoorbell {
 public:
  FeqDoorbell() noexcept;
  ~FeqDoorbell();

  FeqDoorbell(const FeqDoorbell&) = delete;
  FeqDoorbell& operator=(const FeqDoorbell&) = delete;

  /**
   * Note that there is work, from the audio callback or anywhere else.
   *
   * One store and nothing more: no system call, no lock, no wait. Arming
   * twice before a ring is one ring, which is what a waiter that drains
   * everything it finds wants.
   */
  void arm() noexcept { armed_.store(1, std::memory_order_release); }

  /** Ring if armed since the last ring. Never from inside the callback. */
  void ring_if_armed() noexcept {
    if (armed_.exchange(0, std::memory_order_acq_rel) != 0) {
      ring();
    }
  }

  /** Wake the waiter now. Never from inside the callback. */
  void ring() noexcept;

  /**
   * How many times this has been rung. The waiter reads it BEFORE it looks
   * for work, and hands it to `wait`: a ring that lands between the look and
   * the wait then returns the wait at once instead of being slept through.
   */
  uint32_t rung() const noexcept {
    return rings_.load(std::memory_order_acquire);
  }

  /** Sleep until `rung()` is no longer `seen`. No timeout, by design. */
  void wait(uint32_t seen) noexcept;

 private:
  std::atomic<uint32_t> armed_{0};
  std::atomic<uint32_t> rings_{0};
#ifdef _WIN32
  /** An auto-reset event (see doorbell.cpp for why not WaitOnAddress). */
  void* event_ = nullptr;
#endif
};

#endif /* __cplusplus */

#endif /* FLUIDEQ_DOORBELL_H */

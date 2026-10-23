/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One output, at one format, with its graph running: the Linux engine's
 * counterpart of the Windows effect between `LockForProcess` and
 * `UnlockForProcess`.
 *
 * Built off the audio thread with every allocation it will ever make, so
 * `process` is arithmetic over memory that already exists — the same split
 * `apo_process.cpp` keeps. A change of rate, channels or output is a new
 * `OutputEngine`, handed to the audio thread by the router.
 */
#ifndef FLUIDEQ_LINUX_OUTPUT_ENGINE_H
#define FLUIDEQ_LINUX_OUTPUT_ENGINE_H

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

#include "block_timing.h"
#include "fluideq_engine/config.h"
#include "graph_slot.h"
#include "log.h"
#include "output_watcher.h"

namespace fluideq_linux {

struct OutputFormat {
  uint32_t rate = 0;
  uint32_t channels = 0;
  /** WAVEFORMATEXTENSIBLE speaker bits in channel order, or 0 for none. */
  unsigned long channel_mask = 0;
  /** The largest block `process` takes in one piece; longer ones are split. */
  uint32_t max_frames = 0;
};

class OutputEngine {
 public:
  /** Builds and starts everything; the first graph is already published. */
  OutputEngine(const fluideq_engine::Endpoint& endpoint,
               const OutputFormat& format,
               std::function<void()> latency_changed = {});
  ~OutputEngine();

  OutputEngine(const OutputEngine&) = delete;
  OutputEngine& operator=(const OutputEngine&) = delete;

  /**
   * Audio thread. In place over `channels` planar buffers of `frames`
   * samples. No allocation, lock or wait; the only system calls are the
   * clock and, a handful of times a stream, one eventfd write.
   */
  void process(float* const* planes, uint32_t frames) noexcept;

  /**
   * After the audio thread has stopped calling `process` for good: stops the
   * watcher, says the output is let go, frees every graph.
   */
  void retire() noexcept;

  const OutputFormat& format() const noexcept { return format_; }
  const fluideq_engine::Endpoint& endpoint() const noexcept { return endpoint_; }
  /** The delay the published graph adds, for the sound server's latency. */
  uint32_t latency_frames() const noexcept { return slot_.latency(); }

 private:
  void process_piece(float* const* planes, uint32_t frames) noexcept;

  const fluideq_engine::Endpoint endpoint_;
  const OutputFormat format_;
  GraphSlot slot_;
  std::unique_ptr<fluideq_engine::Log> log_;
  std::unique_ptr<OutputWatcher> watcher_;
  std::shared_ptr<std::atomic<bool>> carried_;
  std::shared_ptr<fluideq_engine::BlockTiming> timing_;
  bool carried_told_ = false;
  uint32_t timing_step_told_ = 0;
  // A pointer per channel, offset into the caller's planes for a piece.
  float* pieces_[8] = {};
  bool retired_ = false;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_OUTPUT_ENGINE_H

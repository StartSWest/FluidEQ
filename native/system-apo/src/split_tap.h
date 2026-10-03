/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One engine instance's part in a second output: writing its output's sound
 * for another to play, playing another's, or neither.
 *
 * Made by the watcher after the initial graph is ready, and destroyed after
 * the audio thread has stopped. Main never waits for sharing setup.
 * The watcher decides the part from `fluideq-split.txt` (`follow`), the audio
 * thread does it (`write`, `mix`), and the two meet only in atomics: which
 * ring to write, which output to read from, at what volume, through which
 * kernel. Everything that allocates — the ring, a kernel for a new rate —
 * happens on the watcher's thread, and the audio thread asks for it by
 * waking that thread, as it does to say sound has arrived.
 *
 * Only an instance in the default signal-processing mode takes a part: the
 * others carry calls and alerts, not what the second output is for.
 */
#ifndef FLUIDEQ_ENGINE_SPLIT_TAP_H
#define FLUIDEQ_ENGINE_SPLIT_TAP_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "split_board.h"
#include "split_reader.h"

namespace fluideq_engine {

/** What the status file says about a second output's engine. */
struct SplitReport {
  /** The output it plays, `{GUID}` as the split file named it. */
  std::wstring from;
  SplitState state = SplitState::off;
  uint32_t lag_us = 0;
  uint32_t underruns = 0;
};

class SplitTap {
 public:
  SplitTap(const std::wstring& endpoint, uint32_t rate, uint32_t channels,
           unsigned long mask, bool default_mode, int64_t ticks_per_second,
           const std::wstring& config_identity = {});
  /** Lets go of both claims. The audio thread has stopped. */
  ~SplitTap();
  SplitTap(const SplitTap&) = delete;
  SplitTap& operator=(const SplitTap&) = delete;

  /**
   * Watcher thread: the split file's text (none when there is no file) and
   * whether FluidEQ is running, which it must be for either part — a second
   * output nobody is left to stop must not go on playing. True when the
   * status should be written again.
   */
  bool follow(const std::optional<std::string>& text, bool owner) noexcept;

  /** Watcher thread: a kernel for the rate the audio thread asked for. */
  void prepare(void* initialized = nullptr) noexcept;
  /** Watcher wait set; handles stay valid until its next follow/prepare. */
  void* writer_process() const noexcept { return writer_process_; }
  void* writer_released() const noexcept;
  void* initializing() const noexcept;
  bool transport_failed() const noexcept;

  /** Watcher thread. Nothing when this instance plays no other output. */
  std::optional<SplitReport> report() const;

  /** Audio thread: take the role once, before this block touches any graph. */
  void begin() noexcept;
  /** Audio thread after begin: raw interleaved input, or null for silence. */
  bool write(const float* input, uint32_t frames, int64_t ticks) noexcept;

  /** Audio thread: do not query the clock or copy samples without a route. */
  bool active() const noexcept {
    SplitEndpoint* const route = route_.load(std::memory_order_acquire);
    return writing_ || reading_ != nullptr || output_gain_ != 1.0f ||
           (route != nullptr && (route != own_ || source_active_.load(std::memory_order_relaxed)));
  }

  /**
   * Audio thread: whether `mix` has anything to do on this output — playing
   * another output's sound, still fading it out, or restoring its own trim.
   */
  bool reading() const noexcept {
    return route_at_block_ != own_ &&
           (reading_ != nullptr || route_at_block_ != nullptr || output_gain_ != 1.0f);
  }

  /**
   * Audio thread: adds raw sound into `planes`, before this output's complete
   * graph. True when the watcher should be woken — see `SplitReader::mix`.
   */
  bool mix(float* const* planes, uint32_t frames, int64_t now) noexcept;
  /** Audio thread: the selected output's listening trim, after its graph. */
  void trim_output(float* const* planes, uint32_t frames) noexcept;

 private:
  /** The kernel for `rate`, built if it is not already. Watcher thread. */
  void ensure_kernel(uint32_t rate);
  SplitRing* writer_ring() noexcept;

  const std::wstring endpoint_;
  const std::wstring config_identity_;
  SplitEndpoint* const own_;
  const uint32_t rate_;
  const uint32_t channels_;
  const unsigned long mask_;
  const bool default_mode_;
  const int64_t ticks_per_second_;

  // Set by the watcher, read by the audio thread.
  // One pointer publishes the entire role: own_ means source, another
  // endpoint means receiver, null means off. A block takes one snapshot,
  // so a role switch can never write as main and mix as a receiver.
  std::atomic<SplitEndpoint*> route_{nullptr};
  std::atomic<bool> source_active_{false};
  std::atomic<float> volume_{1.0f};
  std::atomic<const SplitKernel*> kernel_{nullptr};
  // Set by the audio thread, read by the watcher.
  std::atomic<uint32_t> wanted_rate_{0};

  // Audio thread only.
  SplitReader reader_;
  SplitEndpoint* route_at_block_ = nullptr;
  bool source_at_block_ = false;
  SplitEndpoint* reading_ = nullptr;
  bool mixing_ = false;
  bool writing_ = false;
  float output_gain_ = 1.0f;

  // Watcher thread only. Kernels are kept until the tap goes: the audio
  // thread may be inside the last one published, and a lock sees a handful
  // of rates at most.
  std::wstring from_;
  SplitRing* writer_control_ = nullptr;
  SplitRing* reader_control_ = nullptr;
  void* writer_process_ = nullptr;
  bool source_enabled_ = false;
  bool transport_failed_ = false;
  std::vector<std::unique_ptr<SplitKernel>> kernels_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_SPLIT_TAP_H

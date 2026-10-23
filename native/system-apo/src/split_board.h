/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The second output's sound, handed from one output's engine to another's
 * across audiodg.exe instances in the same Windows session.
 *
 * Under Equalizer APO the second output is a copy: a helper process takes the
 * machine's sound with a process loopback and plays it again on the other
 * device, which costs a capture period, a 30 ms reserve against the two
 * processes' scheduling and a render buffer before either device's own
 * delay. Under the FluidEQ Engine the main output's engine writes its raw
 * input into a named shared ring and each second output runs its independent
 * graph after reading it a block later: one period of the second device
 * behind, with shared pages in the same process or across audio processes
 * (Ivan, 2026-10-02: "fluid fastest path for
 * realtime 2nd output if fluid engine selected").
 *
 * One `SplitEndpoint` per output for the life of the process, never freed,
 * like the leveling board: an instance of the engine on either side may be
 * unlocked and another locked at any moment, and the audio threads on both
 * sides hold plain pointers into this. A machine has a handful of outputs.
 */
#ifndef FLUIDEQ_ENGINE_SPLIT_BOARD_H
#define FLUIDEQ_ENGINE_SPLIT_BOARD_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>

namespace fluideq_engine {

struct SplitStorage;
class SplitTransport;

// Main's one publication must never hide a library-backed atomic lock.
static_assert(std::atomic<float>::is_always_lock_free);
static_assert(std::atomic<uint64_t>::is_always_lock_free);
static_assert(std::atomic<uint32_t>::is_always_lock_free);
static_assert(std::atomic<const void*>::is_always_lock_free);

/**
 * One writer's audio, the newest `kFrames` of it, and the clock it was
 * written on.
 *
 * The writer is one audio thread (the claim on `SplitEndpoint::writer` keeps
 * it to one); any number of readers on other audio threads read without
 * taking anything. The header is a sequence lock, so a reader never sees the
 * end of one block with the time of another, and every sample is an atomic
 * read and written relaxed — a plain store and load on x64 — because a reader
 * that fell a whole ring behind does read memory the writer is writing, and
 * finds out afterwards (`end`) that it did.
 */
class SplitRing {
 public:
  /** 1.36 s at 48 kHz and 170 ms at 384 kHz; a reader stays within ~50 ms. */
  static constexpr uint32_t kFrames = 1u << 16;
  /** Every frame has room for eight channels, the most the engine takes. */
  static constexpr uint32_t kStride = 8;

  /** Allocates 2 MiB. Control thread only. */
  SplitRing();
  explicit SplitRing(const std::wstring& mapping_name);
  ~SplitRing();
  SplitRing(const SplitRing&) = delete;
  SplitRing& operator=(const SplitRing&) = delete;

  /** What one reading of the header says, all from the same block. */
  struct Clock {
    /** One past the newest frame written. */
    uint64_t end = 0;
    /** The newest block's first frame, which was written at `ticks`. */
    uint64_t block_start = 0;
    /** `QueryPerformanceCounter` when that block reached the writer. */
    int64_t ticks = 0;
    uint32_t rate = 0;
    uint32_t channels = 0;
    unsigned long mask = 0;
    /** Moves each time the rate, the channels or the mask change. */
    uint32_t generation = 0;
  };

  /**
   * Writer's audio thread: `frames` frames of `channels` interleaved samples,
   * or of silence when `input` is null, reached the writer at `ticks`.
   */
  bool write(const float* input, uint32_t channels, uint32_t frames,
             uint32_t rate, unsigned long mask, int64_t ticks) noexcept;

  /** Control only. Returned process handle belongs to the caller. */
  void add_writer() noexcept;
  void remove_writer() noexcept;
  void* prepare_writer() noexcept;
  void* release_event() const noexcept;
  void* initializing() const noexcept;
  void initialize(void* acquired = nullptr) noexcept;
  bool failed() const noexcept;

  /**
   * Any thread. False when the writer was in the middle of a header every
   * time it looked, which a reader answers with the clock it read last.
   */
  bool clock(Clock* out) const noexcept;

  /** The newest end, for a reader checking it was not lapped while reading. */
  uint64_t end() const noexcept;

  float at(uint64_t frame, uint32_t channel) const noexcept;

 private:
  void publish(uint64_t start, uint32_t frames, uint32_t channels,
               uint32_t rate, unsigned long mask, int64_t ticks) noexcept;
  std::unique_ptr<SplitStorage> local_;
  std::unique_ptr<SplitTransport> transport_;
  std::atomic<SplitStorage*> storage_{nullptr};
};

/** What a second output's engine is doing with the sound it is fed. */
enum class SplitState : uint32_t {
  /** Not fed: no line in the split file names this output. */
  off = 0,
  /** Fed, and nothing fresh has come from the main output to play. */
  waiting = 1,
  playing = 2,
};

/**
 * What the reader on an output says about it, for the status file: shared by
 * every instance of the engine on that output, like `carried`, so whichever
 * instance writes the status writes the same thing.
 */
struct SplitStats {
  std::atomic<uint32_t> state{static_cast<uint32_t>(SplitState::off)};
  /** Configured reader buffering in microseconds, excluding DSP/device delay. */
  std::atomic<uint32_t> lag_us{0};
  /** Times the main output's sound was not there in time, since locking. */
  std::atomic<uint32_t> underruns{0};
};

struct SplitEndpoint {
  std::wstring mapping_name;  // Immutable after control-thread publication.
  /** The instance writing this output's sound into `ring`, if any. */
  std::atomic<const void*> writer{nullptr};
  /** The instance mixing another output's sound into this one, if any. */
  std::atomic<const void*> reader{nullptr};
  SplitStats stats;
  /** Null until a source or receiver first attaches this output's raw ring. */
  std::atomic<SplitRing*> ring{nullptr};
};

/**
 * The output's entry, made on first use. Null for an output with no id —
 * nothing could name it as either side — or when it could not be allocated.
 * Control thread only: it takes a lock.
 */
SplitEndpoint* split_endpoint(const std::wstring& guid,
                              const std::wstring& config_identity = {}) noexcept;

/**
 * The output's ring, allocated the first time it is asked for. Null when it
 * could not be. Control thread only.
 */
SplitRing* split_ring(SplitEndpoint& endpoint) noexcept;

/**
 * Takes `slot` for `owner`, or confirms `owner` already has it. Lock-free,
 * so an audio thread may call it: Windows can lock a new instance on an
 * output before it unlocks the old one, and the new one takes over the
 * moment the old one lets go.
 */
inline bool split_claim(std::atomic<const void*>& slot,
                        const void* owner) noexcept {
  const void* expected = nullptr;
  return slot.compare_exchange_strong(expected, owner,
                                      std::memory_order_acq_rel) ||
         expected == owner;
}

inline void split_release(std::atomic<const void*>& slot,
                          const void* owner) noexcept {
  const void* expected = owner;
  slot.compare_exchange_strong(expected, nullptr, std::memory_order_acq_rel);
}

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_SPLIT_BOARD_H

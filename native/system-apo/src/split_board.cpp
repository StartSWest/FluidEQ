/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "split_board.h"
#include "split_transport.h"

#include <cwctype>
#include <map>
#include <mutex>
#include <new>

namespace fluideq_engine {

namespace {

struct Board {
  std::mutex mutex;
  // Owned here for the life of the process; nothing is ever erased, so a
  // pointer handed out stays good on every thread.
  std::map<std::wstring, std::unique_ptr<SplitEndpoint>> outputs;
  std::map<SplitEndpoint*, std::unique_ptr<SplitRing>> rings;
};

Board& board() {
  static Board instance;
  return instance;
}

/** Windows and the app each spell an id in their own case. */
std::wstring folded(const std::wstring& guid) {
  std::wstring out = guid;
  for (wchar_t& c : out) {
    c = static_cast<wchar_t>(std::towlower(c));
  }
  return out;
}

/** Tries before a reader takes the clock it read last instead. */
constexpr int kClockTries = 4;

}  // namespace

SplitRing::SplitRing() : local_(std::make_unique<SplitStorage>()), storage_(local_.get()) {}
SplitRing::SplitRing(const std::wstring& mapping_name)
    : transport_(std::make_unique<SplitTransport>(mapping_name)), storage_(transport_->data()) {}
SplitRing::~SplitRing() = default;
void SplitRing::add_writer() noexcept { if (transport_) transport_->add_writer(); }
void SplitRing::remove_writer() noexcept { if (transport_) transport_->remove_writer(); }
void* SplitRing::prepare_writer() noexcept { return transport_ ? transport_->prepare_writer() : nullptr; }
void* SplitRing::release_event() const noexcept { return transport_ ? transport_->release_event() : nullptr; }
bool SplitRing::failed() const noexcept { return transport_ && transport_->failed(); }
void* SplitRing::initializing() const noexcept { return transport_ ? transport_->initializing() : nullptr; }
void SplitRing::initialize(void* acquired) noexcept {
  if (transport_) {
    transport_->initialize(acquired);
    // Another local watcher can publish while this caller still has a
    // pending (null) snapshot. A mapped view lives for the ring's lifetime;
    // publication must therefore only move from unavailable to available.
    if (SplitStorage* const data = transport_->data()) {
      storage_.store(data, std::memory_order_release);
    }
  }
}
uint64_t SplitRing::end() const noexcept {
  const auto* data_ = storage_.load(std::memory_order_acquire);
  return data_ ? data_->end.load(std::memory_order_acquire) : 0;
}
float SplitRing::at(uint64_t frame, uint32_t channel) const noexcept {
  const auto* data_ = storage_.load(std::memory_order_acquire);
  return data_ ? data_->samples[(frame & (kFrames - 1)) * kStride + channel].load(std::memory_order_relaxed) : 0.0f;
}

bool SplitRing::write(const float* input, uint32_t channels, uint32_t frames,
                      uint32_t rate, unsigned long mask,
                      int64_t ticks) noexcept {
  auto* data_ = storage_.load(std::memory_order_acquire);
  if (!data_) return false;
  if (channels == 0 || channels > kStride || frames == 0 ||
      frames > kFrames / 2) {
    return false;
  }
  bool wake = false;
  if (transport_ && !transport_->begin_write(&wake)) return wake;
  // Only this thread writes, so its own fields need no ordering to read.
  const uint64_t start = data_->end.load(std::memory_order_relaxed);
  for (uint32_t frame = 0; frame < frames; ++frame) {
    const size_t base =
        static_cast<size_t>((start + frame) & (kFrames - 1)) * kStride;
    for (uint32_t channel = 0; channel < channels; ++channel) {
      const float value =
          input != nullptr
              ? input[static_cast<size_t>(frame) * channels + channel]
              : 0.0f;
      data_->samples[base + channel].store(value, std::memory_order_relaxed);
    }
  }
  publish(start, frames, channels, rate, mask, ticks);
  return transport_ && transport_->end_write();
}

void SplitRing::publish(uint64_t start, uint32_t frames, uint32_t channels,
                        uint32_t rate, unsigned long mask, int64_t ticks) noexcept {
  auto* data_ = storage_.load(std::memory_order_relaxed);
  const bool reshaped = rate != data_->rate.load(std::memory_order_relaxed) ||
                        channels != data_->channels.load(std::memory_order_relaxed) ||
                        mask != data_->mask.load(std::memory_order_relaxed);
  const uint32_t sequence = data_->sequence.load(std::memory_order_relaxed);
  data_->sequence.store(sequence + 1, std::memory_order_relaxed);
  std::atomic_thread_fence(std::memory_order_release);
  if (reshaped) {
    data_->rate.store(rate, std::memory_order_relaxed);
    data_->channels.store(channels, std::memory_order_relaxed);
    data_->mask.store(mask, std::memory_order_relaxed);
    data_->generation.store(data_->generation.load(std::memory_order_relaxed) + 1,
                      std::memory_order_relaxed);
  }
  data_->block_start.store(start, std::memory_order_relaxed);
  data_->ticks.store(ticks, std::memory_order_relaxed);
  data_->end.store(start + frames, std::memory_order_relaxed);
  // Even again: the samples above and every field are published together.
  data_->sequence.store(sequence + 2, std::memory_order_release);
}

bool SplitRing::clock(Clock* out) const noexcept {
  const auto* data_ = storage_.load(std::memory_order_acquire);
  if (!data_) return false;
  for (int attempt = 0; attempt < kClockTries; ++attempt) {
    const uint32_t before = data_->sequence.load(std::memory_order_acquire);
    if ((before & 1u) != 0) {
      continue;
    }
    Clock read;
    read.end = data_->end.load(std::memory_order_relaxed);
    read.block_start = data_->block_start.load(std::memory_order_relaxed);
    read.ticks = data_->ticks.load(std::memory_order_relaxed);
    read.rate = data_->rate.load(std::memory_order_relaxed);
    read.channels = data_->channels.load(std::memory_order_relaxed);
    read.mask = data_->mask.load(std::memory_order_relaxed);
    read.generation = data_->generation.load(std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_acquire);
    if (data_->sequence.load(std::memory_order_relaxed) == before) {
      *out = read;
      return true;
    }
  }
  return false;
}

SplitEndpoint* split_endpoint(const std::wstring& guid,
                              const std::wstring& config_identity) noexcept {
  if (guid.empty()) {
    return nullptr;
  }
  try {
    const std::wstring mapping = config_identity.empty() ? std::wstring()
        : split_transport_name(config_identity, guid);
    Board& shared = board();
    const std::lock_guard<std::mutex> guard(shared.mutex);
    auto& slot = shared.outputs[mapping.empty() ? folded(guid) : mapping];
    if (!slot) {
      slot = std::make_unique<SplitEndpoint>();
      slot->mapping_name = mapping;
    }
    return slot.get();
  } catch (...) {
    return nullptr;
  }
}

SplitRing* split_ring(SplitEndpoint& endpoint) noexcept {
  if (SplitRing* ring = endpoint.ring.load(std::memory_order_acquire)) {
    return ring;
  }
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> guard(shared.mutex);
    auto& slot = shared.rings[&endpoint];
    if (!slot) {
      slot = endpoint.mapping_name.empty() ? std::make_unique<SplitRing>()
          : std::make_unique<SplitRing>(endpoint.mapping_name);
    }
    endpoint.ring.store(slot.get(), std::memory_order_release);
    return slot.get();
  } catch (...) {
    return nullptr;
  }
}

}  // namespace fluideq_engine

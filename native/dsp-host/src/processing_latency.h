/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_PROCESSING_LATENCY_H
#define FLUIDEQ_PROCESSING_LATENCY_H

#include <array>
#include <atomic>
#include <cstdint>
#include "fluideq/chain.h"

// A bounded, lock-free snapshot from the audio callback. Every word is atomic:
// a seqlock over ordinary fields would still be a C++ data race.
class ProcessingLatency {
 public:
  // Called only after the old audio thread joined and before a new device starts.
  void clear() noexcept { sequence_.store(0); }
  void publish(const FeqChain* chain) noexcept {
    FeqChainLatencyParts parts{};
    feq_chain_latency_parts(chain, &parts);
    const uint32_t words[] = {
        feq_chain_latency_frames(chain), parts.linear_eq, parts.restoration,
        parts.leveler, parts.room, parts.bass_punch, parts.maximizer,
        parts.headroom, parts.safety, feq_chain_processed_stages(chain)};
    sequence_.fetch_add(1);
    for (size_t i = 0; i < values_.size(); ++i) values_[i].store(words[i]);
    sequence_.fetch_add(1);
  }

  bool read(std::array<uint32_t, 10>& words) const noexcept {
    const uint32_t before = sequence_.load();
    if (before == 0 || (before & 1u) != 0) return false;
    for (size_t i = 0; i < values_.size(); ++i) words[i] = values_[i].load();
    return before == sequence_.load();
  }

 private:
  std::atomic<uint32_t> sequence_{0};
  std::array<std::atomic<uint32_t>, 10> values_{};
};

#endif

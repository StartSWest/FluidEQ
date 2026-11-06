/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_HOST_CHAIN_EXCHANGE_H
#define FLUIDEQ_HOST_CHAIN_EXCHANGE_H

#include "fluideq/chain.h"
#include <atomic>
#include <cstdint>

namespace feq_host {
static_assert(std::atomic<void*>::is_always_lock_free &&
              std::atomic<double>::is_always_lock_free &&
              std::atomic<uint64_t>::is_always_lock_free,
              "Host handover must be lock-free on the audio thread");

/** Control builds; audio alone adopts and mutates. Retired chains are freed
 * under device_mutex, after telemetry has released its borrowed report. */
class ChainExchange {
 public:
  struct Adoption { FeqChain* chain; bool changed; bool fresh; };
  ~ChainExchange() { clear_stopped(); }
  ChainExchange() = default;
  ChainExchange(const ChainExchange&) = delete;
  ChainExchange& operator=(const ChainExchange&) = delete;

  void publish(FeqChain* chain, bool preserve) {
    if (!preserve) ++source_generation_;
    auto* next = new Slot{chain, source_generation_};
    destroy(pending_.exchange(next, std::memory_order_acq_rel));
  }

  Adoption adopt() noexcept {
    // One retirement slot bounds retained memory without ever waiting on
    // the callback. Telemetry is rung when adoption leaves work for it.
    if (retired_.load(std::memory_order_acquire) != nullptr) {
      return {active_ == nullptr ? nullptr : active_->chain, false, false};
    }
    Slot* next = pending_.exchange(nullptr, std::memory_order_acq_rel);
    if (next == nullptr) {
      return {active_ == nullptr ? nullptr : active_->chain, false, false};
    }
    Slot* previous = active_;
    const bool transferred = previous != nullptr &&
        next->source_generation == previous->source_generation &&
        feq_chain_transfer_state(next->chain, previous->chain) != 0;
    active_ = next;
    published_.store(next->chain, std::memory_order_release);
    retired_.store(previous, std::memory_order_release);
    return {next->chain, true, !transferred};
  }

  void reclaim() { destroy(retired_.exchange(nullptr, std::memory_order_acq_rel)); }
  FeqChain* published() const noexcept {
    return published_.load(std::memory_order_acquire);
  }
  // The backend is closed/joined before these control operations.
  void replace_stopped(FeqChain* chain) {
    clear_stopped();
    active_ = new Slot{chain, source_generation_};
    published_.store(chain, std::memory_order_release);
  }
  void clear_stopped() {
    destroy(pending_.exchange(nullptr, std::memory_order_acq_rel));
    reclaim();
    destroy(active_);
    active_ = nullptr;
    published_.store(nullptr, std::memory_order_release);
  }

 private:
  struct Slot { FeqChain* chain; uint64_t source_generation; };
  static void destroy(Slot* slot) {
    if (slot != nullptr) { feq_chain_destroy(slot->chain); delete slot; }
  }
  Slot* active_ = nullptr;
  std::atomic<Slot*> pending_{nullptr};
  std::atomic<Slot*> retired_{nullptr};
  std::atomic<FeqChain*> published_{nullptr};
  uint64_t source_generation_ = 0; // Control owner, under device_mutex.
};

/** Coherent gains delivered without touching audio-owned ramps. Atomic
 * members keep interrupted publication race-free. Audio makes one bounded
 * attempt, otherwise keeping the previous block's gain. */
class TrackGainMailbox {
 public:
  void publish(double input, double master, bool snap) noexcept {
    sequence_.fetch_add(1);
    input_.store(input);
    master_.store(master);
    snap_.store(snap);
    sequence_.fetch_add(1);
  }
  void apply(FeqChain* chain, bool fresh) noexcept {
    fresh_ = fresh_ || fresh;
    fresh = fresh_;
    if (fresh && has_applied_) {
      // A publisher interrupted between its two gains must not leave a
      // freshly adopted chain at unity for one block. Keep the last coherent
      // pair until the new publication can be accepted whole.
      feq_chain_set_track_level_gains(chain, last_input_, last_master_, 1);
    }
    const uint64_t before = sequence_.load();
    if (before == 0 || (before & 1u) != 0 || (!fresh && before == applied_)) return;
    const double input = input_.load();
    const double master = master_.load();
    const bool snap = snap_.load();
    if (before != sequence_.load()) return;
    feq_chain_set_track_level_gains(chain, input, master, fresh || snap ? 1 : 0);
    applied_ = before;
    last_input_ = input;
    last_master_ = master;
    has_applied_ = true;
    fresh_ = false;
  }
  void reset_stopped() noexcept { applied_ = 0; fresh_ = true; }
 private:
  std::atomic<uint64_t> sequence_{0};
  std::atomic<double> input_{0};
  std::atomic<double> master_{0};
  std::atomic<bool> snap_{false};
  uint64_t applied_ = 0; // Audio owner only.
  bool fresh_ = true;
  bool has_applied_ = false;
  double last_input_ = 0;
  double last_master_ = 0;
};

} // namespace feq_host
#endif

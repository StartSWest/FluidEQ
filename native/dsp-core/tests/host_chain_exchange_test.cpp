/* FluidEQ — GPL-3.0-or-later */
#include "../src/chain_internal.h"
#include "../../dsp-host/src/chain_exchange.h"
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <thread>

namespace {
thread_local bool watch_heap = false;
std::atomic<uint32_t> heap_operations{0};
void require(bool condition, const char* message) {
  if (!condition) { std::fprintf(stderr, "%s\n", message); std::abort(); }
}
FeqChain* make_chain(double gain) {
  FeqChain* chain = feq_chain_create(48000, 2, 64);
  require(chain != nullptr, "chain allocation");
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.band_count = 1;
  settings.eq.bands[0] = {1, 0, FEQ_FILTER_PK, 1000, gain, 0.7, 0, 0};
  feq_chain_configure(chain, &settings);
  float left[64]{};
  float right[64]{};
  float* planes[] = {left, right};
  feq_chain_process(chain, planes, 64);
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
  return chain;
}
void process(FeqChain* chain) {
  float left[64]{};
  float right[64]{};
  left[0] = right[0] = 0.1f;
  float* planar[] = {left, right};
  feq_chain_process(chain, planar, 64);
  for (float sample : left) require(std::isfinite(sample), "finite output");
}
}

void* operator new(std::size_t size) {
  if (watch_heap) ++heap_operations;
  if (void* value = std::malloc(size == 0 ? 1 : size)) return value;
  throw std::bad_alloc();
}
void* operator new[](std::size_t size) { return ::operator new(size); }
void operator delete(void* value) noexcept {
  if (watch_heap && value != nullptr) ++heap_operations;
  std::free(value);
}
void operator delete[](void* value) noexcept { ::operator delete(value); }
void operator delete(void* value, std::size_t) noexcept { ::operator delete(value); }
void operator delete[](void* value, std::size_t) noexcept { ::operator delete(value); }

int main() {
  using feq_host::ChainExchange;
  ChainExchange exchange;
  exchange.replace_stopped(make_chain(0));
  exchange.publish(make_chain(1), true);
  watch_heap = true;
  const auto first = exchange.adopt();
  process(first.chain);
  watch_heap = false;
  require(first.changed && !first.fresh, "same-source edit transfers history");
  require(heap_operations.load() == 0, "audio adoption/process must not allocate or free");

  exchange.publish(make_chain(2), true);
  require(!exchange.adopt().changed, "retirement must be acknowledged before next adoption");
  exchange.reclaim();
  require(exchange.adopt().changed, "prepared edit survives occupied retirement slot");
  exchange.reclaim();
  exchange.publish(make_chain(3), false);
  exchange.publish(make_chain(4), true);
  require(exchange.adopt().fresh, "coalesced edit must preserve an unconsumed source boundary");
  exchange.reclaim();

  feq_host::TrackGainMailbox gains;
  FeqChain* playing = exchange.published();
  std::atomic<bool> complete{false};
  std::thread publisher([&] {
    for (uint32_t at = 1; at <= 20000; ++at) {
      const double value = static_cast<double>(at % 12);
      gains.publish(value, -value, true);
    }
    gains.publish(8, -8, true);
    complete.store(true, std::memory_order_release);
  });
  do {
    watch_heap = true;
    gains.apply(playing, false);
    watch_heap = false;
    require(playing->input_gain_target_db == -playing->master_loudness_target_db,
            "gain pair must never tear across concurrent publications");
  } while (!complete.load(std::memory_order_acquire));
  publisher.join();
  gains.apply(playing, false);
  require(playing->input_gain_target_db == 8, "latest gain must arrive");
  require(heap_operations.load() == 0, "audio gain application must not allocate or free");

  exchange.replace_stopped(make_chain(0));
  gains.reset_stopped();
  gains.apply(exchange.published(), false);
  require(exchange.published()->input_gain_target_db == 8,
          "a device rebuild must retain the measured track gain");
  std::puts("host chain ownership, source boundary, gain coherence and real-time heap contracts passed");
  return 0;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The identity engine: the whole pipeline, and none of the DSP.
 *
 * It copies input to output and is deliberately the first thing built. What is
 * being proven here is not arithmetic — it is that a settings snapshot can be
 * prepared on one thread and adopted on another at a block edge, that a drag
 * can reach the audio thread without a lock, that telemetry can leave the
 * callback without allocating, and that the callback obeys its own rules. Put
 * a filter in before any of that is true and every later bug has two possible
 * homes.
 *
 * Every processor added after this one goes between the repair pass and the
 * peak accumulation, and none of them may relax the rules stated in dsp.h.
 */

#include "fluideq/dsp.h"
#include "fluideq/parameters.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <memory>
#include <new>
#include <vector>

#if defined(_M_X64) || defined(__x86_64__) || defined(__SSE2__)
#include <xmmintrin.h>
#define FEQ_HAS_SSE_DENORMAL_CONTROL 1
#endif

namespace {

/**
 * The widest band index a parameter may carry.
 *
 * Matches `EQ_MAX_BAND_COUNT` in chain.ts. Storage for the fast path is
 * allocated for the worst case at create, because the alternative is growing a
 * table on the audio thread, and the audio thread may not allocate.
 */
constexpr int kMaxParameterIndex = 64;

/** Bin width and count for the callback-duration histogram, in microseconds. */
constexpr int kTimingBins = 64;
constexpr double kTimingBinUs = 32.0;

/**
 * Denormals off for the duration of the callback, and restored on the way out.
 *
 * A denormal is not a wrong number, it is a slow one — on x86 the hardware
 * traps into microcode and a multiply that costs one cycle starts costing
 * over a hundred. Filter tails and reverbs decay straight into that range, so
 * the cost arrives during the quiet part of a track and looks like a machine
 * that stutters only on fadeouts. Restored on exit because this is a process
 * -wide mode bit and the host's other threads did not ask for it.
 */
class ScopedDenormalsOff {
 public:
  ScopedDenormalsOff() {
#if FEQ_HAS_SSE_DENORMAL_CONTROL
    previous_ = _mm_getcsr();
    _mm_setcsr(previous_ | 0x8040u); /* FTZ | DAZ */
#endif
  }

  ~ScopedDenormalsOff() {
#if FEQ_HAS_SSE_DENORMAL_CONTROL
    _mm_setcsr(previous_);
#endif
  }

  ScopedDenormalsOff(const ScopedDenormalsOff&) = delete;
  ScopedDenormalsOff& operator=(const ScopedDenormalsOff&) = delete;

 private:
#if FEQ_HAS_SSE_DENORMAL_CONTROL
  unsigned int previous_ = 0;
#endif
};

/** One fully resolved chain, owned by whoever published it. */
struct Snapshot {
  uint32_t revision = 0;
  std::vector<double> values;
};

/**
 * A single-producer/single-consumer ring, preallocated and never resized.
 *
 * The audio thread pushes and gives up rather than waiting when the consumer
 * has fallen behind — a dropped meter frame is invisible, and a blocked audio
 * thread is a click. The drop is counted, because telemetry that silently goes
 * missing is worse than telemetry that says it went missing.
 */
template <typename T, size_t kCapacity>
class SpscRing {
 public:
  bool push(const T& value) {
    const size_t head = head_.load(std::memory_order_relaxed);
    const size_t next = (head + 1) % kCapacity;
    if (next == tail_.load(std::memory_order_acquire)) {
      return false;
    }
    slots_[head] = value;
    head_.store(next, std::memory_order_release);
    return true;
  }

  bool pop(T& out) {
    const size_t tail = tail_.load(std::memory_order_relaxed);
    if (tail == head_.load(std::memory_order_acquire)) {
      return false;
    }
    out = slots_[tail];
    tail_.store((tail + 1) % kCapacity, std::memory_order_release);
    return true;
  }

 private:
  T slots_[kCapacity]{};
  std::atomic<size_t> head_{0};
  std::atomic<size_t> tail_{0};
};

}  // namespace

struct FeqEngine {
  uint32_t sample_rate = 48000;
  uint32_t channels = 2;
  uint32_t maximum_block_frames = 512;

  /**
   * Two snapshots and a pointer, rather than a mutex.
   *
   * `prepare` fills whichever one the audio thread is not reading; `commit`
   * swaps the pointer. The retired snapshot is not freed — it is simply the
   * one the next prepare will overwrite, which happens on the control thread.
   * Nothing is allocated or released while audio is running.
   */
  Snapshot snapshots[2];
  std::atomic<Snapshot*> published{nullptr};
  Snapshot* preparing = nullptr;
  bool has_prepared = false;

  /**
   * The drag path: newest value wins, nothing queues.
   *
   * Indexed `slot * kMaxParameterIndex + index`. Relaxed ordering throughout:
   * these are independent scalars and the audio thread does not need to see
   * them agree with each other at any particular instant — a snapshot is what
   * carries a change that must arrive whole.
   */
  std::vector<std::atomic<double>> live_values;
  std::atomic<uint32_t> live_revision{0};

  std::atomic<uint32_t> applied_revision{0};
  std::atomic<uint64_t> frames_processed{0};
  std::atomic<uint64_t> repaired_samples{0};
  std::atomic<uint64_t> xruns{0};
  std::atomic<uint64_t> drops{0};
  std::atomic<uint32_t> latency_frames{0};

  /** Accumulators owned solely by the audio thread between reports. */
  uint64_t report_frames = 0;
  float window_peak[2] = {0.0f, 0.0f};
  uint32_t timing[kTimingBins + 1] = {};
  uint64_t sequence = 0;

  SpscRing<FeqTelemetryV1, 32> telemetry;
  SpscRing<FeqDiagnosticV1, 32> diagnostics;
};

namespace {

/**
 * Percentiles from the histogram, computed by whoever drains — never in the
 * callback. The bin's upper edge is reported, so a number here is always the
 * pessimistic reading rather than a flattering one.
 */
double percentile_us(const uint32_t* bins, uint64_t total, double fraction) {
  if (total == 0) {
    return 0.0;
  }
  const uint64_t target =
      static_cast<uint64_t>(static_cast<double>(total) * fraction);
  uint64_t seen = 0;
  for (int bin = 0; bin <= kTimingBins; ++bin) {
    seen += bins[bin];
    if (seen >= target) {
      return static_cast<double>(bin + 1) * kTimingBinUs;
    }
  }
  return static_cast<double>(kTimingBins + 1) * kTimingBinUs;
}

void publish_telemetry(FeqEngine* engine) {
  FeqTelemetryV1 record{};
  record.abi_version = FEQ_ABI_VERSION;
  record.sequence = ++engine->sequence;
  record.frames_processed =
      engine->frames_processed.load(std::memory_order_relaxed);
  record.applied_revision =
      engine->applied_revision.load(std::memory_order_relaxed);
  record.latency_frames = engine->latency_frames.load(std::memory_order_relaxed);
  record.peak[0] = engine->window_peak[0];
  record.peak[1] = engine->window_peak[1];

  uint64_t counted = 0;
  for (int bin = 0; bin <= kTimingBins; ++bin) {
    counted += engine->timing[bin];
  }
  record.callback_p50_us = percentile_us(engine->timing, counted, 0.50);
  record.callback_p99_us = percentile_us(engine->timing, counted, 0.99);
  record.xruns = engine->xruns.load(std::memory_order_relaxed);
  record.repaired_samples =
      engine->repaired_samples.load(std::memory_order_relaxed);
  record.drops = engine->drops.load(std::memory_order_relaxed);

  if (!engine->telemetry.push(record)) {
    engine->drops.fetch_add(1, std::memory_order_relaxed);
  }

  engine->report_frames = 0;
  engine->window_peak[0] = 0.0f;
  engine->window_peak[1] = 0.0f;
  std::memset(engine->timing, 0, sizeof(engine->timing));
}

}  // namespace

extern "C" {

FeqEngine* feq_engine_create(uint32_t sample_rate,
                             uint32_t channels,
                             uint32_t maximum_block_frames) {
  if (sample_rate == 0 || channels == 0 || channels > 2 ||
      maximum_block_frames == 0) {
    return nullptr;
  }
  auto* engine = new (std::nothrow) FeqEngine();
  if (engine == nullptr) {
    return nullptr;
  }
  engine->sample_rate = sample_rate;
  engine->channels = channels;
  engine->maximum_block_frames = maximum_block_frames;

  const size_t live_count =
      static_cast<size_t>(FEQ_PARAMETER_COUNT) * kMaxParameterIndex;
  engine->live_values = std::vector<std::atomic<double>>(live_count);
  for (size_t at = 0; at < live_count; ++at) {
    engine->live_values[at].store(0.0, std::memory_order_relaxed);
  }
  engine->snapshots[0].values.assign(FEQ_PARAMETER_COUNT, 0.0);
  engine->snapshots[1].values.assign(FEQ_PARAMETER_COUNT, 0.0);
  engine->published.store(&engine->snapshots[0], std::memory_order_release);
  engine->preparing = &engine->snapshots[1];
  return engine;
}

void feq_engine_destroy(FeqEngine* engine) { delete engine; }

FeqStatus feq_engine_prepare_config(FeqEngine* engine,
                                    const FeqConfigV1* config) {
  if (engine == nullptr || config == nullptr ||
      config->parameter_values == nullptr) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  if (config->abi_version != FEQ_ABI_VERSION) {
    return FEQ_ERR_UNSUPPORTED;
  }
  if (config->parameter_count != static_cast<uint32_t>(FEQ_PARAMETER_COUNT)) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  Snapshot* target = engine->preparing;
  target->revision = config->settings_revision;
  std::copy(config->parameter_values,
            config->parameter_values + config->parameter_count,
            target->values.begin());
  engine->has_prepared = true;
  return FEQ_OK;
}

FeqStatus feq_engine_commit_prepared_config(FeqEngine* engine) {
  if (engine == nullptr) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  if (!engine->has_prepared) {
    return FEQ_ERR_NOT_PREPARED;
  }
  Snapshot* incoming = engine->preparing;
  Snapshot* retiring = engine->published.exchange(incoming,
                                                  std::memory_order_acq_rel);
  // The one the audio thread has just stopped reading becomes the scratch for
  // the next prepare. It is reused, never freed, so no allocator runs while
  // audio is live.
  engine->preparing = retiring;
  engine->has_prepared = false;
  return FEQ_OK;
}

FeqStatus feq_engine_set_parameter(FeqEngine* engine,
                                   uint32_t parameter_id,
                                   int32_t index,
                                   double value,
                                   uint32_t settings_revision) {
  if (engine == nullptr) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  const int slot = feq_parameter_slot(parameter_id);
  if (slot < 0) {
    // Never coerced to slot 0: that is a real parameter, and answering an
    // unknown id with it drives the wrong processor rather than nothing.
    return FEQ_ERR_UNKNOWN_PARAMETER;
  }
  const int at = index < 0 ? 0 : index;
  if (at >= kMaxParameterIndex) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  if (!std::isfinite(value)) {
    return FEQ_ERR_INVALID_ARGUMENT;
  }
  engine->live_values[static_cast<size_t>(slot) * kMaxParameterIndex + at]
      .store(value, std::memory_order_relaxed);
  engine->live_revision.store(settings_revision, std::memory_order_release);
  return FEQ_OK;
}

void feq_engine_reset(FeqEngine* engine, FeqResetReason reason) {
  if (engine == nullptr) {
    return;
  }
  (void)reason;
  engine->report_frames = 0;
  engine->window_peak[0] = 0.0f;
  engine->window_peak[1] = 0.0f;
  std::memset(engine->timing, 0, sizeof(engine->timing));
}

void feq_engine_process_planar(FeqEngine* engine,
                               const float* const* input,
                               float* const* output,
                               uint32_t frames) {
  if (engine == nullptr || input == nullptr || output == nullptr ||
      frames == 0) {
    return;
  }
  const ScopedDenormalsOff denormals;
  const auto started = std::chrono::steady_clock::now();

  // Adopted at the block edge, which is the only place a chain may change.
  const Snapshot* active = engine->published.load(std::memory_order_acquire);
  if (active != nullptr) {
    engine->applied_revision.store(active->revision, std::memory_order_relaxed);
  }
  const uint32_t live = engine->live_revision.load(std::memory_order_acquire);
  if (live > engine->applied_revision.load(std::memory_order_relaxed)) {
    engine->applied_revision.store(live, std::memory_order_relaxed);
  }

  const uint32_t channels = engine->channels;
  uint64_t repaired = 0;
  for (uint32_t channel = 0; channel < channels; ++channel) {
    const float* in = input[channel];
    float* out = output[channel];
    if (in == nullptr || out == nullptr) {
      continue;
    }
    float peak = engine->window_peak[channel];
    for (uint32_t frame = 0; frame < frames; ++frame) {
      float sample = in[frame];
      /**
       * A non-finite sample is repaired to silence and counted.
       *
       * Not clamped, because there is no honest value to clamp a NaN to, and
       * not passed through: one NaN entering a filter's state makes every
       * subsequent sample NaN, so a single bad frame in a decoder silences
       * the rest of the track and looks like the engine died.
       */
      if (!std::isfinite(sample)) {
        sample = 0.0f;
        ++repaired;
      }
      out[frame] = sample;
      const float magnitude = std::fabs(sample);
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    engine->window_peak[channel] = peak;
  }
  if (repaired != 0) {
    engine->repaired_samples.fetch_add(repaired, std::memory_order_relaxed);
  }

  engine->frames_processed.fetch_add(frames, std::memory_order_relaxed);
  engine->report_frames += frames;

  const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(
                           std::chrono::steady_clock::now() - started)
                           .count();
  const double micros = static_cast<double>(elapsed) / 1000.0;
  int bin = static_cast<int>(micros / kTimingBinUs);
  if (bin < 0) {
    bin = 0;
  }
  if (bin > kTimingBins) {
    bin = kTimingBins;
  }
  ++engine->timing[bin];

  // Roughly forty reports a second at any sample rate, which is ahead of the
  // 20-30 Hz the renderer publishes at and well inside what the ring holds.
  if (engine->report_frames >= engine->sample_rate / 40) {
    publish_telemetry(engine);
  }
}

uint32_t feq_engine_latency_frames(const FeqEngine* engine) {
  return engine == nullptr
             ? 0
             : engine->latency_frames.load(std::memory_order_relaxed);
}

bool feq_engine_try_read_telemetry(FeqEngine* engine, FeqTelemetryV1* out) {
  if (engine == nullptr || out == nullptr) {
    return false;
  }
  return engine->telemetry.pop(*out);
}

bool feq_engine_try_read_diagnostic(FeqEngine* engine, FeqDiagnosticV1* out) {
  if (engine == nullptr || out == nullptr) {
    return false;
  }
  return engine->diagnostics.pop(*out);
}

const char* feq_core_version(void) { return FEQ_CORE_VERSION; }

uint32_t feq_core_abi_version(void) { return FEQ_ABI_VERSION; }

}  // extern "C"

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "output_engine.h"

#include <time.h>

#include <algorithm>

#include "fluideq/denormals.h"
#include "paths.h"
#include "status_file.h"

namespace fluideq_linux {

namespace {

// -90 dBFS: above it is sound, under it an idle stream (`apo_process.cpp`).
constexpr float kSilenceFloor = 3.2e-5f;
constexpr uint64_t kNanosPerSecond = 1000000000ull;

uint64_t now_nanos() noexcept {
  struct timespec at {};
  clock_gettime(CLOCK_MONOTONIC, &at);
  return static_cast<uint64_t>(at.tv_sec) * kNanosPerSecond +
         static_cast<uint64_t>(at.tv_nsec);
}

}  // namespace

OutputEngine::OutputEngine(const fluideq_engine::Endpoint& endpoint,
                           const OutputFormat& format,
                           std::function<void()> latency_changed)
    : endpoint_(endpoint), format_(format) {
  carried_ = fluideq_engine::output_carried_flag(endpoint_.guid);
  if (carried_) carried_->store(false, std::memory_order_relaxed);
  timing_ = fluideq_engine::output_block_timing(endpoint_.guid);
  log_ = std::make_unique<fluideq_engine::Log>(endpoint_.guid);
  watcher_ = std::make_unique<OutputWatcher>(
      slot_, *log_, endpoint_, fluideq_engine::config_dir(), format_.rate,
      format_.channels, format_.max_frames, format_.channel_mask,
      std::move(latency_changed));
  log_->write("locked: " + std::to_string(format_.channels) + " ch, " +
              std::to_string(format_.rate) + " Hz, up to " +
              std::to_string(format_.max_frames) + " frames, device \"" +
              fluideq_engine::to_utf8(endpoint_.friendly_name) + "\"");
  watcher_->load_initial();
  watcher_->start();
}

OutputEngine::~OutputEngine() { retire(); }

void OutputEngine::retire() noexcept {
  if (retired_) return;
  retired_ = true;
  if (watcher_) {
    watcher_->stop();
    watcher_->release_graphs();
  }
  if (log_ && timing_) {
    try {
      const auto reading = timing_->read();
      if (reading.blocks > 0) {
        log_->write("this stream: " + fluideq_engine::describe_timing(reading));
      }
    } catch (...) {
      // A line the log never gets costs the report, not the audio.
    }
  }
  watcher_.reset();
}

void OutputEngine::process(float* const* planes, uint32_t frames) noexcept {
  // Pieces of at most `max_frames`: PipeWire's quantum can be raised past
  // what the graph was sized for, and a graph refuses a block larger than
  // its size rather than overrun it.
  uint32_t done = 0;
  while (done < frames) {
    const uint32_t piece = std::min(frames - done, format_.max_frames);
    for (uint32_t channel = 0; channel < format_.channels; ++channel) {
      pieces_[channel] = planes[channel] + done;
    }
    process_piece(pieces_, piece);
    done += piece;
  }
}

void OutputEngine::process_piece(float* const* planes,
                                 uint32_t frames) noexcept {
  const FeqScopedDenormalsOff denormals;
  const uint64_t started = timing_ != nullptr ? now_nanos() : 0;
  fluideq_engine::Graph* const graph = slot_.adopt();

  if (!carried_told_) {
    for (uint32_t channel = 0; channel < format_.channels && !carried_told_;
         ++channel) {
      const float* plane = planes[channel];
      for (uint32_t frame = 0; frame < frames; ++frame) {
        if (plane[frame] > kSilenceFloor || plane[frame] < -kSilenceFloor) {
          carried_told_ = true;
          if (carried_) carried_->store(true, std::memory_order_relaxed);
          if (watcher_) watcher_->say_it_carried();
          break;
        }
      }
    }
  }

  if (graph != nullptr) {
    graph->report_meter_activity(frames > 0 && !graph->is_passthrough());
    if (!graph->is_passthrough()) graph->process(planes, frames);
  }

  if (timing_ != nullptr && frames > 0) {
    const uint32_t slowest =
        timing_->record(now_nanos() - started, kNanosPerSecond, frames,
                        format_.rate);
    const uint32_t step = fluideq_engine::timing_step(slowest);
    if (step > timing_step_told_) {
      timing_step_told_ = step;
      if (watcher_) watcher_->say_it_was_slow();
    }
  }
  slot_.finish_block();
  if (graph != nullptr) graph->wake_workers();
}

}  // namespace fluideq_linux

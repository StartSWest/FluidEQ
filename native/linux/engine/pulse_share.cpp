/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Share Audio on PulseAudio: "FluidEQ Share In", where the window plays the
 * sound other computers send here, and "FluidEQ Send", what this computer
 * plays, untouched, for the window to send (`pw_share.cpp` says why both
 * exist).
 *
 * "FluidEQ Send" is a remapped source over "FluidEQ"'s own monitor, which
 * carries what applications played into it and nothing else. "FluidEQ Share
 * In" is a second null sink: its monitor is recorded and mixed into each
 * block before the engine, so other computers' sound gets this computer's EQ
 * and never reaches "FluidEQ Send". Two null sinks keep the same time — both
 * count the system clock at their nominal rate — so the two records do not
 * drift apart; what the share delivered waits in a short queue for the next
 * block, and a queue that grows past it is let go from the front.
 */

#include <algorithm>
#include <string>

#include "pulse_router.h"

namespace fluideq_linux {

namespace {

constexpr uint32_t kInvalidIndex = UINT32_MAX;
// The most the share's queue holds before its oldest frames are let go:
// enough for a few of the server's periods, never a delay anybody hears.
constexpr uint32_t kShareQueueMs = 60;

}  // namespace

void PulseRouter::load_share() {
  if (shut_ || share_loading_ || module_index_ == kInvalidIndex) return;
  if (share_module_ != kInvalidIndex) {
    if (share_record_ == nullptr) {
      share_record_ =
          record_monitor(std::string(kShareSinkName) + ".monitor",
                         "FluidEQ Share In capture", &PulseRouter::on_share_read);
    }
    return;
  }
  // Quoted twice: the module's arguments end a value at a space unless it is
  // quoted, and the property list parses the inner quotes.
  const std::string args = null_sink_args(
      kShareSinkName,
      std::string("\"device.description='") + kShareSinkDescription + "'\"",
      rate_);
  share_loading_ = true;
  release(api_.context_load_module(context_, "module-null-sink", args.c_str(),
                                   &PulseRouter::on_share_loaded, this));
  const std::string send =
      "source_name=fluideq_send master=" + options_.sink_name +
      ".monitor source_properties=\"device.description='" +
      kSendSourceDescription + "'\"";
  release(api_.context_load_module(context_, "module-remap-source",
                                   send.c_str(), &PulseRouter::on_send_loaded,
                                   this));
}

void PulseRouter::on_share_loaded(pa::context* context, uint32_t index,
                                  void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  self->share_loading_ = false;
  self->api_.mainloop_signal(self->loop_, 0);
  if (index == kInvalidIndex) {
    self->log_->write("PulseAudio refused FluidEQ Share In (module-null-sink); "
                      "Share Audio runs one way");
    return;
  }
  if (self->shut_) {
    self->release(
        self->api_.context_unload_module(context, index, nullptr, nullptr));
    return;
  }
  self->share_module_ = index;
  self->load_share();
}

void PulseRouter::on_send_loaded(pa::context* context, uint32_t index,
                                 void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  self->api_.mainloop_signal(self->loop_, 0);
  if (index == kInvalidIndex) {
    self->log_->write("PulseAudio refused FluidEQ Send (module-remap-source); "
                      "Share Audio runs one way");
    return;
  }
  if (self->shut_) {
    self->release(
        self->api_.context_unload_module(context, index, nullptr, nullptr));
    return;
  }
  self->send_module_ = index;
}

void PulseRouter::unload_share() noexcept {
  for (uint32_t* module : {&send_module_, &share_module_}) {
    if (*module == kInvalidIndex) continue;
    wait(api_.context_unload_module(context_, *module, &PulseRouter::on_done,
                                    this));
    *module = kInvalidIndex;
  }
  share_fifo_.clear();
}

void PulseRouter::on_share_read(pa::stream* stream, size_t bytes, void* data) {
  (void)bytes;
  auto* self = static_cast<PulseRouter*>(data);
  const uint32_t channels = self->layout_.channels;
  if (channels == 0) return;
  const size_t frame_bytes = channels * sizeof(float);
  uint32_t arrived = 0;
  for (;;) {
    const void* chunk = nullptr;
    size_t size = 0;
    if (self->api_.stream_peek(stream, &chunk, &size) < 0 || size == 0) break;
    const auto frames = static_cast<uint32_t>(size / frame_bytes);
    const float* from = static_cast<const float*>(chunk);
    if (from != nullptr) {
      self->share_fifo_.insert(self->share_fifo_.end(), from,
                               from + static_cast<size_t>(frames) * channels);
    } else {
      self->share_fifo_.resize(self->share_fifo_.size() +
                               static_cast<size_t>(frames) * channels);
    }
    arrived += frames;
    self->api_.stream_drop(stream);
  }
  const size_t keep = static_cast<size_t>(self->rate_) * kShareQueueMs / 1000 *
                      channels;
  if (self->share_fifo_.size() > keep) {
    self->share_fifo_.erase(
        self->share_fifo_.begin(),
        self->share_fifo_.begin() +
            static_cast<std::ptrdiff_t>(self->share_fifo_.size() - keep));
  }
  // "FluidEQ" quiet since the last read: nothing else will turn what arrived
  // into blocks, so these frames do, over silence.
  if (!self->main_read_ && arrived > 0) {
    self->process(nullptr, arrived);
    self->follow_drift();
  }
  self->main_read_ = false;
}

void PulseRouter::mix_share(float* const* planes, uint32_t channels,
                            uint32_t frames) {
  if (channels == 0 || share_fifo_.empty()) return;
  const uint32_t held = static_cast<uint32_t>(share_fifo_.size() / channels);
  const uint32_t take = std::min(frames, held);
  for (uint32_t f = 0; f < take; ++f) {
    for (uint32_t c = 0; c < channels; ++c) {
      planes[c][f] += share_fifo_[static_cast<size_t>(f) * channels + c];
    }
  }
  share_fifo_.erase(share_fifo_.begin(),
                    share_fifo_.begin() +
                        static_cast<std::ptrdiff_t>(take) * channels);
}

}  // namespace fluideq_linux

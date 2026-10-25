/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "pulse_router.h"

#include <algorithm>

namespace fluideq_linux {

void PulseRouter::refresh_origins() {
  if (shut_ || pipewire_server_ || own_sink_index_ == UINT32_MAX ||
      record_ == nullptr) return;
  if (origins_reading_) {
    origins_again_ = true;
    return;
  }
  origins_reading_ = true;
  for (auto& [id, origin] : origins_) {
    (void)id;
    origin.seen = false;
  }
  release(api_.context_get_sink_input_info_list(context_, on_origin_info, this));
}

void PulseRouter::on_origin_info(pa::context*, const pa::sink_input_info* info,
                                int eol, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  if (!eol && info != nullptr) {
    // Only applications on our local sink. Neither received playback, the
    // final engine output nor the Send bus can enter this set.
    if (self->shut_ || self->record_ == nullptr ||
        info->sink != self->own_sink_index_ ||
        info->client == self->api_.context_get_index(self->context_)) return;
    auto& origin = self->origins_[info->index];
    origin.seen = true;
    if (origin.stream == nullptr) {
      origin.stream = self->record_monitor(self->options_.sink_name + ".monitor",
          "FluidEQ local origin", on_origin_read, info->index);
    }
    return;
  }
  for (auto it = self->origins_.begin(); it != self->origins_.end();) {
    if (it->second.seen) {
      ++it;
      continue;
    }
    if (auto* stream = it->second.stream) {
      self->api_.stream_set_read_callback(stream, nullptr, nullptr);
      self->api_.stream_set_state_callback(stream, nullptr, nullptr);
      self->api_.stream_disconnect(stream);
      self->api_.stream_unref(stream);
    }
    it = self->origins_.erase(it);
  }
  self->origins_reading_ = false;
  if (self->origins_again_) {
    self->origins_again_ = false;
    self->refresh_origins();
  }
}

void PulseRouter::close_origins() noexcept {
  for (auto& [id, origin] : origins_) {
    (void)id;
    if (origin.stream == nullptr) continue;
    api_.stream_set_read_callback(origin.stream, nullptr, nullptr);
    api_.stream_set_state_callback(origin.stream, nullptr, nullptr);
    api_.stream_disconnect(origin.stream);
    api_.stream_unref(origin.stream);
  }
  origins_.clear();
}

void PulseRouter::on_origin_read(pa::stream* stream, size_t, void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  auto it = std::find_if(self->origins_.begin(), self->origins_.end(),
      [stream](const auto& item) { return item.second.stream == stream; });
  if (it == self->origins_.end()) return;
  auto& fifo = it->second.fifo;
  const size_t keep =
      static_cast<size_t>(self->rate_) * self->layout_.channels * 60 / 1000;
  for (;;) {
    const void* chunk = nullptr;
    size_t size = 0;
    if (self->api_.stream_peek(stream, &chunk, &size) < 0 || size == 0) break;
    const size_t samples = size / sizeof(float);
    if (chunk != nullptr) {
      const auto* from = static_cast<const float*>(chunk);
      fifo.insert(fifo.end(), from, from + samples);
    } else {
      fifo.resize(fifo.size() + samples, 0.0f);
    }
    self->api_.stream_drop(stream);
  }
  if (fifo.size() > keep) fifo.erase(fifo.begin(), fifo.end() - keep);
  self->drain_origins();
}

void PulseRouter::drain_origins() {
  if (layout_.channels == 0 || rate_ == 0) return;
  const uint32_t block = std::max(1u, rate_ * 10 / 1000);
  while (clock_frames_ >= block) {
    // Direct monitors and the clock arrive in separate protocol messages.
    // Wait for this quantum's origins rather than inserting silence just
    // because its clock message arrived first. A paused/disappearing app
    // may not deliver; bound that wait to the same 60 ms as each input FIFO.
    const bool waiting = std::any_of(origins_.begin(), origins_.end(),
        [&](const auto& item) {
          const auto& origin = item.second;
          return origin.stream != nullptr &&
              api_.stream_get_state(origin.stream) == pa::kStreamReady &&
              origin.fifo.size() / layout_.channels < block;
        });
    if (waiting && clock_frames_ < rate_ * 60 / 1000) return;
    clock_frames_ -= block;
    process(block);
  }
}

void PulseRouter::mix_origins(float* const* planes, uint32_t channels,
                              uint32_t frames) {
  const auto mix = [&](std::vector<float>& fifo) {
    const size_t take = std::min<size_t>(frames, fifo.size() / channels);
    for (size_t f = 0; f < take; ++f)
      for (uint32_t c = 0; c < channels; ++c)
        planes[c][f] += fifo[f * channels + c];
    fifo.erase(fifo.begin(), fifo.begin() + take * channels);
  };
  if (pipewire_server_) {
    mix(monitor_fifo_);
    return;
  }
  for (auto& [id, origin] : origins_) {
    (void)id;
    mix(origin.fifo);
  }
}

void PulseRouter::on_send_bus_loaded(pa::context* context, uint32_t index,
                                     void* data) {
  auto* self = static_cast<PulseRouter*>(data);
  if (index == UINT32_MAX) {
    self->log_->write("PulseAudio could not open the pre-volume Send bus");
    return;
  }
  if (self->shut_) {
    self->release(
        self->api_.context_unload_module(context, index, nullptr, nullptr));
    return;
  }
  self->send_bus_module_ = index;
  const std::string args =
      "source_name=fluideq_send master=fluideq_send_bus.monitor "
      "source_properties=\"device.description='" +
      std::string(kSendSourceDescription) + "'\"";
  self->release(self->api_.context_load_module(context, "module-remap-source",
      args.c_str(), on_send_loaded, self));
  self->open_send();
}

void PulseRouter::open_send() {
  if (shut_ || send_playback_ != nullptr || send_bus_module_ == UINT32_MAX) return;
  pa::sample_spec spec{pa::kSampleFloat32Le, rate_,
                       static_cast<uint8_t>(layout_.channels)};
  send_playback_ =
      api_.stream_new(context_, "FluidEQ Send origin", &spec, &channel_map_);
  if (send_playback_ == nullptr) return;
  const uint32_t bytes = rate_ * layout_.channels * sizeof(float) * 80 / 1000;
  pa::buffer_attr attr{UINT32_MAX, bytes, UINT32_MAX, UINT32_MAX, UINT32_MAX};
  // Stream restore can remember the engine's last local master under this
  // application's name. The internal Send stream must explicitly start at
  // unity and unmuted, including when reopened during a muted output switch.
  pa::cvolume unity{};
  unity.channels = static_cast<uint8_t>(layout_.channels);
  std::fill_n(unity.values, unity.channels, 0x10000u);
  if (api_.stream_connect_playback(send_playback_, "fluideq_send_bus", &attr,
      pa::kStreamAdjustLatency | pa::kStreamStartUnmuted | 0x200,
      &unity, nullptr) < 0) {
    api_.stream_unref(send_playback_);
    send_playback_ = nullptr;
  }
}

void PulseRouter::write_send(float* const* planes, uint32_t channels,
                             uint32_t frames) {
  if (send_playback_ == nullptr ||
      api_.stream_get_state(send_playback_) != pa::kStreamReady) return;
  for (uint32_t f = 0; f < frames; ++f)
    for (uint32_t c = 0; c < channels; ++c)
      interleaved_[static_cast<size_t>(f) * channels + c] = planes[c][f];
  api_.stream_write(send_playback_, interleaved_.data(),
      static_cast<size_t>(frames) * channels * sizeof(float), nullptr, 0,
      pa::kSeekRelative);
}

}  // namespace fluideq_linux

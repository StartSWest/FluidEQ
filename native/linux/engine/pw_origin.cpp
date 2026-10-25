/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "pw_router.h"

#include <spa/param/props.h>
#include <spa/pod/builder.h>

#include <algorithm>

namespace fluideq_linux {

bool PipeWireRouter::open_origin(const ChannelLayout& layout) {
  // Sink monitor ports precede its software volume and mute. Reading the
  // sink's own process buffer loses that information at zero/mute forever.
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CATEGORY, "Capture",
      PW_KEY_NODE_NAME, "fluideq_origin", "target.object",
      options_.sink_name.c_str(), "node.target", options_.sink_name.c_str(),
      "stream.capture.sink", "true", "node.dont-fallback", "true",
      "node.dont-reconnect", "true", "node.loop.name", "data-loop.0", nullptr);
  origin_.stream = api_.stream_new(core_, "FluidEQ local origin", props);
  if (origin_.stream == nullptr) return false;
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_origin_process;
    e.state_changed = &PipeWireRouter::on_capture_state;
    return e;
  }();
  api_.stream_add_listener(origin_.stream, &origin_.listener, &events, this);
  origin_ring_ = std::make_unique<ShareRing>(layout.channels);
  run_on_data_thread([](PipeWireRouter* self, void*) {
    self->rt_origin_ = self->origin_.stream;
    self->rt_origin_ring_ = self->origin_ring_.get();
  }, nullptr);
  uint8_t bytes[1024];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(bytes, sizeof(bytes));
  const spa_pod* params[] = {pw_format_of(&builder, layout)};
  if (api_.stream_connect(origin_.stream, PW_DIRECTION_INPUT, PW_ID_ANY,
      static_cast<pw_stream_flags>(PW_STREAM_FLAG_AUTOCONNECT |
          PW_STREAM_FLAG_MAP_BUFFERS | PW_STREAM_FLAG_RT_PROCESS), params, 1) < 0) {
    log_->write("could not connect the pre-volume local origin capture");
    close_origin();
    return false;
  }
  return true;
}

void PipeWireRouter::close_origin() noexcept {
  if (origin_.stream == nullptr) return;
  run_on_data_thread([](PipeWireRouter* self, void*) {
    self->rt_origin_ = nullptr;
    self->rt_origin_ring_ = nullptr;
  }, nullptr);
  api_.stream_disconnect(origin_.stream);
  spa_hook_remove(&origin_.listener);
  api_.stream_destroy(origin_.stream);
  origin_.stream = nullptr;
  origin_ring_.reset();
  capture_streaming_.store(false, std::memory_order_release);
}

void PipeWireRouter::on_origin_process(void* data) {
  auto* self = static_cast<PipeWireRouter*>(data);
  pw_stream* const stream = self->rt_origin_;
  if (stream == nullptr) return;
  while (pw_buffer* buffer = self->api_.stream_dequeue_buffer(stream)) {
    const spa_buffer& from = *buffer->buffer;
    const uint32_t channels = std::min<uint32_t>(from.n_datas, 8);
    const float* planes[8] = {};
    uint32_t frames = channels > 0 ? UINT32_MAX : 0;
    for (uint32_t c = 0; c < channels; ++c) {
      const spa_data& plane = from.datas[c];
      if (plane.chunk == nullptr || plane.data == nullptr) {
        frames = 0;
        break;
      }
      const uint32_t offset = std::min(plane.chunk->offset, plane.maxsize);
      frames = std::min(frames,
          std::min(plane.chunk->size, plane.maxsize - offset) /
              static_cast<uint32_t>(sizeof(float)));
      planes[c] = reinterpret_cast<const float*>(
          static_cast<const uint8_t*>(plane.data) + offset);
    }
    if (frames > 0 && self->rt_origin_ring_ != nullptr) {
      self->rt_origin_ring_->write(planes, channels, frames);
    }
    self->api_.stream_queue_buffer(stream, buffer);
  }
  if (self->rt_playback_ != nullptr) {
    self->api_.stream_trigger_process(self->rt_playback_);
  }
}

void PipeWireRouter::on_volume_control(void* data, uint32_t id,
                                       const pw_stream_control* control) {
  auto* self = static_cast<PipeWireRouter*>(data);
  if (control == nullptr || control->n_values == 0) return;
  if (id == SPA_PROP_channelVolumes) {
    self->master_channels_ = std::min<uint32_t>(control->n_values, 8);
    std::copy_n(control->values, self->master_channels_, self->master_volumes_);
  } else if (id == SPA_PROP_mute) {
    self->master_mute_ = control->values[0];
  } else {
    return;
  }
  self->apply_playback_volume();
}

void PipeWireRouter::apply_playback_volume() {
  if (playback_.stream == nullptr) return;
  // One system master, after the local/received mix and DSP. The Send tap
  // contains only origin samples; it never sees either master control.
  api_.stream_set_control(playback_.stream, SPA_PROP_channelVolumes,
      master_channels_ > 0 ? master_channels_ : layout_.channels,
      master_volumes_, SPA_PROP_mute, 1u, &master_mute_, 0u);
}

}  // namespace fluideq_linux

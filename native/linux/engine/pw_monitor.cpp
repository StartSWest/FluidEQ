/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "FluidEQ Monitor": what the engine plays, offered as an input.
 *
 * FluidEQ's window draws its live graph, top wave and output meter from a
 * capture of what the output is playing. On Windows that is the endpoint's
 * loopback. Chromium on Linux has none, and hides every sound-server monitor
 * from its input list, so the window found nothing to capture and nothing
 * moved. This source is an ordinary input as far as Chromium is concerned,
 * carrying exactly what the engine hands the real output — after the EQ, as
 * Windows' loopback is after the engine's effect — and the window opens it
 * by its name (`src/renderer/graph/linuxOutputCapture.ts`).
 *
 * It is a source node of the engine's own group, fed from the playback's
 * cycle through `MonitorRing`, and it runs only while something listens.
 * Lowest priority, so the system never picks it as the default microphone.
 */

#include <spa/param/audio/format-utils.h>
#include <spa/pod/builder.h>
#include <unistd.h>

#include <algorithm>
#include <string>

#include "pw_router.h"

namespace fluideq_linux {

namespace {

constexpr uint32_t kRingFrames = 16384;  // A third of a second at 48 kHz.

uint32_t spa_position_of(Speaker speaker, uint32_t index) {
  switch (speaker) {
    case 0x1: return SPA_AUDIO_CHANNEL_FL;
    case 0x2: return SPA_AUDIO_CHANNEL_FR;
    case 0x4: return SPA_AUDIO_CHANNEL_FC;
    case 0x8: return SPA_AUDIO_CHANNEL_LFE;
    case 0x10: return SPA_AUDIO_CHANNEL_RL;
    case 0x20: return SPA_AUDIO_CHANNEL_RR;
    case 0x40: return SPA_AUDIO_CHANNEL_FLC;
    case 0x80: return SPA_AUDIO_CHANNEL_FRC;
    case 0x100: return SPA_AUDIO_CHANNEL_RC;
    case 0x200: return SPA_AUDIO_CHANNEL_SL;
    case 0x400: return SPA_AUDIO_CHANNEL_SR;
    default: return SPA_AUDIO_CHANNEL_AUX0 + index;
  }
}

}  // namespace

bool PipeWireRouter::open_monitor(const ChannelLayout& layout) {
  const std::string group = "fluideq-engine-" + std::to_string(getpid());
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CLASS, "Audio/Source",
      PW_KEY_NODE_NAME, "fluideq_monitor", PW_KEY_NODE_DESCRIPTION,
      "FluidEQ Monitor", PW_KEY_NODE_GROUP, group.c_str(),
      PW_KEY_NODE_VIRTUAL, "true", "priority.session", "0",
      "priority.driver", "0", "node.loop.name", "data-loop.0", nullptr);
  monitor_.stream = api_.stream_new(core_, "FluidEQ Monitor", props);
  if (monitor_.stream == nullptr) {
    log_->write("could not create the FluidEQ Monitor; the window's live "
                "displays will not move");
    return false;
  }
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_monitor_process;
    return e;
  }();
  api_.stream_add_listener(monitor_.stream, &monitor_.listener, &events, this);
  monitor_ring_ = std::make_unique<MonitorRing>(layout.channels, kRingFrames);
  run_on_data_thread(
      [](PipeWireRouter* self, void* stream) {
        self->rt_monitor_ = static_cast<pw_stream*>(stream);
        self->rt_monitor_ring_ = self->monitor_ring_.get();
      },
      monitor_.stream);
  spa_audio_info_raw info{};
  info.format = SPA_AUDIO_FORMAT_F32P;
  info.channels = layout.channels;
  info.rate = 0;
  for (uint32_t at = 0; at < layout.channels; ++at) {
    info.position[at] = spa_position_of(layout.speakers[at], at);
  }
  uint8_t buffer[1024];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  const spa_pod* params[1] = {
      spa_format_audio_raw_build(&builder, SPA_PARAM_EnumFormat, &info)};
  if (api_.stream_connect(monitor_.stream, PW_DIRECTION_OUTPUT, PW_ID_ANY,
                          static_cast<pw_stream_flags>(
                              PW_STREAM_FLAG_MAP_BUFFERS |
                              PW_STREAM_FLAG_RT_PROCESS),
                          params, 1) < 0) {
    log_->write("could not connect the FluidEQ Monitor");
    close_monitor();
    return false;
  }
  return true;
}

void PipeWireRouter::close_monitor() noexcept {
  if (monitor_.stream == nullptr) return;
  run_on_data_thread(
      [](PipeWireRouter* self, void*) {
        self->rt_monitor_ = nullptr;
        self->rt_monitor_ring_ = nullptr;
      },
      nullptr);
  api_.stream_disconnect(monitor_.stream);
  spa_hook_remove(&monitor_.listener);
  api_.stream_destroy(monitor_.stream);
  monitor_.stream = nullptr;
  monitor_ring_.reset();
}

void PipeWireRouter::on_monitor_process(void* data) {
  auto* self = static_cast<PipeWireRouter*>(data);
  pw_stream* const stream = self->rt_monitor_;
  MonitorRing* const ring = self->rt_monitor_ring_;
  if (stream == nullptr) return;
  pw_buffer* out = self->api_.stream_dequeue_buffer(stream);
  if (out == nullptr) return;
  spa_buffer* const buffer = out->buffer;
  const uint32_t channels = std::min<uint32_t>(buffer->n_datas, 8);
  uint32_t room = UINT32_MAX;
  float* planes[8] = {};
  for (uint32_t c = 0; c < channels; ++c) {
    planes[c] = static_cast<float*>(buffer->datas[c].data);
    room = std::min<uint32_t>(room, buffer->datas[c].maxsize / sizeof(float));
    if (planes[c] == nullptr) room = 0;
  }
  if (channels == 0) room = 0;
  uint32_t frames = room;
  if (self->api_.has_requested && out->requested > 0) {
    frames = std::min<uint32_t>(frames, static_cast<uint32_t>(out->requested));
  }
  if (frames > 0) {
    if (ring != nullptr) {
      ring->read(planes, channels, frames);
    } else {
      for (uint32_t c = 0; c < channels; ++c) {
        std::fill(planes[c], planes[c] + frames, 0.0f);
      }
    }
  }
  for (uint32_t c = 0; c < channels; ++c) {
    buffer->datas[c].chunk->offset = 0;
    buffer->datas[c].chunk->stride = sizeof(float);
    buffer->datas[c].chunk->size = frames * sizeof(float);
  }
  self->api_.stream_queue_buffer(stream, out);
}

}  // namespace fluideq_linux

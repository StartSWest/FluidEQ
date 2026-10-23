/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's two taps, each offered as an input: "FluidEQ Monitor", what
 * the engine plays, and "FluidEQ Send", what this computer plays before the
 * engine and without the sound other computers send here (Share Audio).
 *
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
 * "FluidEQ Send": Share Audio sends this computer's sound untouched, and
 * the computer that hears it applies its own EQ. The window used to send the
 * Monitor, so the sound left with this computer's EQ on it and was EQ'd a
 * second time over there, and with the other computer's sound in it, which
 * is why a link off Windows could only run one way. This tap is taken from
 * what applications played into "FluidEQ" before anything else touches it;
 * the other computers' sound arrives on "FluidEQ Share In" and is mixed in
 * after it (`pw_share.cpp`).
 *
 * Each is a source node of the engine's own group, fed from the playback's
 * cycle through a `MonitorRing`, and runs only while something listens.
 * Lowest priority, so the system never picks one as the default microphone.
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

bool PipeWireRouter::open_tap(Tap& tap, const ChannelLayout& layout,
                              const char* node_name,
                              const char* description) {
  const std::string group = "fluideq-engine-" + std::to_string(getpid());
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CLASS, "Audio/Source",
      PW_KEY_NODE_NAME, node_name, PW_KEY_NODE_DESCRIPTION, description,
      PW_KEY_NODE_GROUP, group.c_str(), PW_KEY_NODE_VIRTUAL, "true",
      "priority.session", "0", "priority.driver", "0", "node.loop.name",
      "data-loop.0", nullptr);
  tap.router = this;
  tap.stream.stream = api_.stream_new(core_, description, props);
  if (tap.stream.stream == nullptr) {
    log_->write(std::string("could not create ") + description);
    return false;
  }
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_tap_process;
    return e;
  }();
  api_.stream_add_listener(tap.stream.stream, &tap.stream.listener, &events,
                           &tap);
  tap.ring = std::make_unique<MonitorRing>(layout.channels, kRingFrames);
  run_on_data_thread(
      [](PipeWireRouter*, void* arg) {
        Tap* const opened = static_cast<Tap*>(arg);
        opened->rt_stream = opened->stream.stream;
        opened->rt_ring = opened->ring.get();
      },
      &tap);
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
  if (api_.stream_connect(tap.stream.stream, PW_DIRECTION_OUTPUT, PW_ID_ANY,
                          static_cast<pw_stream_flags>(
                              PW_STREAM_FLAG_MAP_BUFFERS |
                              PW_STREAM_FLAG_RT_PROCESS),
                          params, 1) < 0) {
    log_->write(std::string("could not connect ") + description);
    close_tap(tap);
    return false;
  }
  return true;
}

void PipeWireRouter::close_tap(Tap& tap) noexcept {
  if (tap.stream.stream == nullptr) return;
  run_on_data_thread(
      [](PipeWireRouter*, void* arg) {
        Tap* const closed = static_cast<Tap*>(arg);
        closed->rt_stream = nullptr;
        closed->rt_ring = nullptr;
      },
      &tap);
  api_.stream_disconnect(tap.stream.stream);
  spa_hook_remove(&tap.stream.listener);
  api_.stream_destroy(tap.stream.stream);
  tap.stream.stream = nullptr;
  tap.ring.reset();
}

void PipeWireRouter::on_tap_process(void* data) {
  Tap* const tap = static_cast<Tap*>(data);
  const PwApi& api = tap->router->api_;
  pw_stream* const stream = tap->rt_stream;
  MonitorRing* const ring = tap->rt_ring;
  if (stream == nullptr) return;
  pw_buffer* out = api.stream_dequeue_buffer(stream);
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
  if (api.has_requested && out->requested > 0) {
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
  api.stream_queue_buffer(stream, out);
}

}  // namespace fluideq_linux

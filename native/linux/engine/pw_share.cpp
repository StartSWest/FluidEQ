/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "FluidEQ Share In": a second sink of the engine's own, where the window
 * plays the sound other computers send here (Share Audio).
 *
 * Played into "FluidEQ" with everything else, another computer's sound was
 * in the window's capture of this computer and went straight back to it, so
 * a link off Windows could only run one way, and played straight to the real
 * output instead, it got none of this computer's EQ. Here it is mixed in by
 * the playback's cycle after "FluidEQ Send" has taken what this computer
 * played (`pw_streams.cpp`), so it is EQ'd like anything else this computer
 * plays and is never in what this computer sends.
 *
 * It is one more stream of the engine's node group, in the same cycle as
 * "FluidEQ" itself, so it shares that sink's clock: nothing drifts and
 * nothing is resampled. "FluidEQ"'s cycle triggers the playback; while
 * nothing plays into "FluidEQ" its node is not running, and this sink's
 * cycle triggers the playback instead, or other computers' sound would play
 * only while this computer played something too.
 */

#include <spa/param/audio/format-utils.h>
#include <spa/pod/builder.h>
#include <unistd.h>

#include <algorithm>
#include <string>

#include "pw_router.h"

namespace fluideq_linux {

namespace {

// `pw_streams.cpp` says why each of these is what it is.
constexpr const char* kDataLoop = "data-loop.0";
constexpr uint32_t kStreamAsync = 1u << 10;

}  // namespace

bool PipeWireRouter::open_share(const ChannelLayout& layout) {
  const std::string group = "fluideq-engine-" + std::to_string(getpid());
  // Lowest priority: the system never makes it the default output.
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CLASS, "Audio/Sink",
      PW_KEY_NODE_NAME, kShareSinkName, PW_KEY_NODE_DESCRIPTION,
      kShareSinkDescription, PW_KEY_NODE_GROUP, group.c_str(), "node.link-group",
      group.c_str(), "node.loop.name", kDataLoop, PW_KEY_NODE_VIRTUAL, "true",
      "priority.session", "0", "priority.driver", "0", "resample.prefill",
      "true", nullptr);
  share_.stream = api_.stream_new(core_, kShareSinkDescription, props);
  if (share_.stream == nullptr) {
    log_->write("could not create FluidEQ Share In; Share Audio runs one way");
    return false;
  }
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_share_process;
    e.state_changed = &PipeWireRouter::on_stream_state;
    return e;
  }();
  api_.stream_add_listener(share_.stream, &share_.listener, &events, this);
  share_ring_ = std::make_unique<ShareRing>(layout.channels);
  run_on_data_thread(
      [](PipeWireRouter* self, void* stream) {
        self->rt_share_ = static_cast<pw_stream*>(stream);
        self->rt_share_ring_ = self->share_ring_.get();
      },
      share_.stream);
  uint8_t buffer[1024];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  const spa_pod* params[1] = {pw_format_of(&builder, layout)};
  if (api_.stream_connect(
          share_.stream, PW_DIRECTION_INPUT, PW_ID_ANY,
          static_cast<pw_stream_flags>(
              PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS |
              PW_STREAM_FLAG_RT_PROCESS | kStreamAsync),
          params, 1) < 0) {
    log_->write("could not connect FluidEQ Share In");
    close_share();
    return false;
  }
  return true;
}

void PipeWireRouter::close_share() noexcept {
  if (share_.stream == nullptr) return;
  run_on_data_thread(
      [](PipeWireRouter* self, void*) {
        self->rt_share_ = nullptr;
        self->rt_share_ring_ = nullptr;
      },
      nullptr);
  api_.stream_disconnect(share_.stream);
  spa_hook_remove(&share_.listener);
  api_.stream_destroy(share_.stream);
  share_.stream = nullptr;
  share_ring_.reset();
}

void PipeWireRouter::on_capture_state(void* data, pw_stream_state old,
                                      pw_stream_state state,
                                      const char* error) {
  auto* self = static_cast<PipeWireRouter*>(data);
  self->capture_streaming_.store(state == PW_STREAM_STATE_STREAMING,
                                 std::memory_order_release);
  on_stream_state(data, old, state, error);
}

void PipeWireRouter::on_share_process(void* data) {
  auto* self = static_cast<PipeWireRouter*>(data);
  pw_stream* const share = self->rt_share_;
  if (share == nullptr) return;
  // Into the ring at once, whatever the order of this cycle: the playback's
  // cycle often runs before this sink has its buffer, and taking the buffer
  // there dropped every such quantum — other computers' sound came through
  // in pieces. Read from the ring, a late buffer only costs one quantum of
  // delay, and is never lost.
  while (pw_buffer* buffer = self->api_.stream_dequeue_buffer(share)) {
    if (ShareRing* const ring = self->rt_share_ring_; ring != nullptr) {
      const spa_buffer& from = *buffer->buffer;
      const uint32_t channels = std::min<uint32_t>(from.n_datas, 8);
      const float* planes[8] = {};
      uint32_t frames = channels > 0 ? UINT32_MAX : 0;
      for (uint32_t c = 0; c < channels; ++c) {
        const spa_data& data = from.datas[c];
        if (data.chunk == nullptr || data.data == nullptr) {
          frames = 0;
          break;
        }
        // A chunk is the producer's word, and is held to the memory behind it.
        const uint32_t offset = std::min(data.chunk->offset, data.maxsize);
        const uint32_t bytes = std::min(data.chunk->size, data.maxsize - offset);
        frames = std::min<uint32_t>(frames, bytes / sizeof(float));
        planes[c] = reinterpret_cast<const float*>(
            static_cast<const uint8_t*>(data.data) + offset);
      }
      if (frames > 0) ring->write(planes, channels, frames);
    }
    self->api_.stream_queue_buffer(share, buffer);
  }
  // "FluidEQ" running triggers the playback itself; a second trigger would
  // run a second cycle.
  if (self->capture_streaming_.load(std::memory_order_acquire)) return;
  if (pw_stream* const playback = self->rt_playback_; playback != nullptr) {
    self->api_.stream_trigger_process(playback);
  }
}

}  // namespace fluideq_linux

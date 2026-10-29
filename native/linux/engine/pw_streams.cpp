/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The FluidEQ sink mirrors the selected output's OS master. Its raw monitor ports feed
 * the origin capture, ahead of volume/mute; the sink's post-master process
 * buffers are discarded. The origin capture triggers playback, which taps
 * Send before mixing received audio and running DSP. The OS master applies
 * only at the real output. All audio callbacks share one data loop.
 */

#include <spa/param/audio/format-utils.h>
#include <spa/param/audio/raw-types.h>
#include <spa/param/latency-utils.h>
#include <spa/pod/builder.h>
#include <spa/debug/types.h>

#include <algorithm>
#include <cstring>
#include <exception>
#include <unistd.h>
#include <string>

#include "../compat/wide_path.h"
#include "pw_router.h"

namespace fluideq_linux {

namespace {

// The largest block the engine processes in one piece. PipeWire's default
// ceiling for a quantum is 8192 frames; a larger one is split, never refused.
constexpr uint32_t kMaxFrames = 8192;
constexpr const char* kDataLoop = "data-loop.0";
// The sink and Share In are asynchronous members of the playback's node
// group. Their process callbacks return buffers; the origin stream triggers
// playback after taking the raw monitor ports (also on older 0.3 headers).
constexpr uint32_t kStreamAsync = 1u << 10;

uint32_t spa_channel_of(Speaker speaker, uint32_t index) {
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
    case 0x800: return SPA_AUDIO_CHANNEL_TC;
    case 0x1000: return SPA_AUDIO_CHANNEL_TFL;
    case 0x2000: return SPA_AUDIO_CHANNEL_TFC;
    case 0x4000: return SPA_AUDIO_CHANNEL_TFR;
    case 0x8000: return SPA_AUDIO_CHANNEL_TRL;
    case 0x10000: return SPA_AUDIO_CHANNEL_TRC;
    case 0x20000: return SPA_AUDIO_CHANNEL_TRR;
    default: return SPA_AUDIO_CHANNEL_AUX0 + index;
  }
}

}  // namespace

const spa_pod* pw_format_of(spa_pod_builder* builder,
                            const ChannelLayout& layout) {
  spa_audio_info_raw info{};
  info.format = SPA_AUDIO_FORMAT_F32P;
  info.channels = layout.channels;
  // No rate: the sink and the playback both take the graph's, which is the
  // real output's, so nothing in between resamples.
  info.rate = 0;
  for (uint32_t at = 0; at < layout.channels; ++at) {
    info.position[at] = spa_channel_of(layout.speakers[at], at);
  }
  return spa_format_audio_raw_build(builder, SPA_PARAM_EnumFormat, &info);
}

namespace {

struct DataCall {
  void (*fn)(PipeWireRouter*, void*);
  PipeWireRouter* self;
  void* arg;
};

int run_call(spa_loop* loop, bool async, uint32_t seq, const void* data,
             size_t size, void* user_data) {
  (void)loop;
  (void)async;
  (void)seq;
  (void)size;
  (void)user_data;
  DataCall call{};
  std::memcpy(&call, data, sizeof(call));
  call.fn(call.self, call.arg);
  return 0;
}

const char* state_name(pw_stream_state state) {
  switch (state) {
    case PW_STREAM_STATE_ERROR: return "error";
    case PW_STREAM_STATE_UNCONNECTED: return "unconnected";
    case PW_STREAM_STATE_CONNECTING: return "connecting";
    case PW_STREAM_STATE_PAUSED: return "paused";
    case PW_STREAM_STATE_STREAMING: return "streaming";
  }
  return "?";
}

}  // namespace

void PipeWireRouter::run_on_data_thread(void (*fn)(PipeWireRouter*, void*),
                                        void* arg) noexcept {
  // With no stream of ours on it, the data thread runs none of our code,
  // and may not be running at all (a blocking invoke would never return).
  if (capture_.stream == nullptr && playback_.stream == nullptr &&
      monitor_.stream.stream == nullptr && send_.stream.stream == nullptr &&
      share_.stream == nullptr && origin_.stream == nullptr) {
    fn(this, arg);
    return;
  }
  const DataCall call{fn, this, arg};
  pw_loop_invoke(data_loop_, &run_call, 0, &call, sizeof(call), true, nullptr);
}

void PipeWireRouter::retarget(const Sink& sink) {
  const bool carry_volume = volume_initialised_;
  const ChannelLayout layout = layout_for(sink.channels, sink.positions);
  const bool relayout = capture_.stream == nullptr || !(layout == layout_);
  log_->write("playing to \"" + sink.description + "\" (" + sink.name + "), " +
              std::to_string(layout.channels) + " ch");
  close_stream(playback_, true);
  target_name_ = sink.name;
  volume_initialised_ = false;
  layout_ = layout;
  if (carry_volume) write_target_volume();
  if (relayout) {
    close_origin();
    close_tap(monitor_);
    close_tap(send_);
    close_share();
    close_stream(capture_, false);
    swap_engine(nullptr);
    capture_rate_ = 0;
  }
  // The playback first, as `module-loopback` does: the sink's first cycle
  // triggers it, and it has to be active by then.
  if (!open_playback(sink, layout)) return;
  if (relayout) {
    if (!open_capture(layout)) return;
    // The window's live displays and Share Audio; the audio needs none of it.
    open_tap(monitor_, layout, "fluideq_monitor", "FluidEQ Monitor");
    open_tap(send_, layout, "fluideq_send", kSendSourceDescription);
    open_share(layout);
    if (!open_origin(layout)) return;
  }
  apply_playback_volume();
  sync_source_volume();
  ensure_engine();
}

bool PipeWireRouter::open_capture(const ChannelLayout& layout) {
  source_volume_seen_ = false;
  source_mute_seen_ = false;
  const std::string group = "fluideq-engine-" + std::to_string(getpid());
  const std::string channels = std::to_string(layout.channels);
  std::string positions = "[ ";
  for (uint32_t at = 0; at < layout.channels; ++at) {
    const char* name = spa_debug_type_find_short_name(spa_type_audio_channel,
        spa_channel_of(layout.speakers[at], at));
    positions += name != nullptr ? name : "UNKNOWN";
    positions += ' ';
  }
  positions += ']';
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CLASS, "Audio/Sink",
      PW_KEY_NODE_NAME, options_.sink_name.c_str(), PW_KEY_NODE_DESCRIPTION,
      options_.sink_description.c_str(), PW_KEY_NODE_GROUP, group.c_str(),
      "node.link-group", group.c_str(), "node.loop.name", kDataLoop,
      PW_KEY_NODE_VIRTUAL, "true", "resample.prefill", "true",
      "monitor.channel-volumes", "false",
      "state.restore-props", "false",
      "audio.channels", channels.c_str(), "audio.position", positions.c_str(),
      "device.icon-name", "audio-card", nullptr);
  capture_.stream = api_.stream_new(core_, "FluidEQ", props);
  latency_reported_ = UINT32_MAX;  // A new stream has reported nothing.
  if (capture_.stream == nullptr) {
    log_->write("could not create the FluidEQ output");
    return false;
  }
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_capture_process;
    e.param_changed = &PipeWireRouter::on_capture_param;
    e.state_changed = &PipeWireRouter::on_stream_state;
    return e;
  }();
  api_.stream_add_listener(capture_.stream, &capture_.listener, &events, this);
  run_on_data_thread(
      [](PipeWireRouter* self, void* stream) {
        self->rt_capture_ = static_cast<pw_stream*>(stream);
        self->rt_channels_ = self->layout_.channels;
      },
      capture_.stream);
  uint8_t buffer[1024];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  const spa_pod* params[1] = {pw_format_of(&builder, layout)};
  const int connected = api_.stream_connect(
      capture_.stream, PW_DIRECTION_INPUT, PW_ID_ANY,
      static_cast<pw_stream_flags>(PW_STREAM_FLAG_AUTOCONNECT |
                                   PW_STREAM_FLAG_MAP_BUFFERS |
                                   PW_STREAM_FLAG_RT_PROCESS | kStreamAsync),
      params, 1);
  if (connected < 0) {
    log_->write("could not connect the FluidEQ output (" +
                std::to_string(connected) + ")");
    close_stream(capture_, false);
    return false;
  }
  return true;
}

bool PipeWireRouter::open_playback(const Sink& sink,
                                   const ChannelLayout& layout) {
  const std::string group = "fluideq-engine-" + std::to_string(getpid());
  // Pinned to the chosen output and never moved: a playback that fell back
  // to the default would land in the FluidEQ sink itself, a loop. Named
  // twice: `target.object` from PipeWire 0.3.64, `node.target` before it
  // (Ubuntu 22.04's PipeWire is 0.3.48), each ignored by the other.
  pw_properties* props = api_.properties_new(
      PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CATEGORY, "Playback",
      PW_KEY_NODE_NAME, "fluideq_output", PW_KEY_NODE_DESCRIPTION,
      "FluidEQ Engine", "target.object", sink.name.c_str(), "node.target",
      sink.name.c_str(),
      PW_KEY_NODE_DONT_RECONNECT, "true", "node.dont-fallback", "true",
      "node.dont-move", "true", PW_KEY_STREAM_DONT_REMIX, "true",
      "state.restore-props", "false",
      // Passive: with nothing playing into FluidEQ the real output may
      // suspend, as it would without the engine.
      PW_KEY_NODE_PASSIVE, "true", PW_KEY_NODE_GROUP, group.c_str(),
      "node.link-group", group.c_str(), "node.loop.name", kDataLoop,
      PW_KEY_NODE_VIRTUAL, "true", "resample.prefill", "true", nullptr);
  playback_.stream = api_.stream_new(core_, "FluidEQ Engine", props);
  if (playback_.stream == nullptr) {
    log_->write("could not create the playback to " + sink.name);
    return false;
  }
  static const pw_stream_events events = [] {
    pw_stream_events e{};
    e.version = PW_VERSION_STREAM_EVENTS;
    e.process = &PipeWireRouter::on_playback_process;
    e.state_changed = &PipeWireRouter::on_playback_state;
    return e;
  }();
  api_.stream_add_listener(playback_.stream, &playback_.listener, &events,
                           this);
  uint8_t buffer[1024];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  const spa_pod* params[1] = {pw_format_of(&builder, layout)};
  const int connected = api_.stream_connect(
      playback_.stream, PW_DIRECTION_OUTPUT, PW_ID_ANY,
      static_cast<pw_stream_flags>(
          PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS |
          PW_STREAM_FLAG_RT_PROCESS | PW_STREAM_FLAG_TRIGGER),
      params, 1);
  if (connected < 0) {
    log_->write("could not connect the playback to " + sink.name + " (" +
                std::to_string(connected) + ")");
    close_stream(playback_, true);
    return false;
  }
  // Only now is it reachable from the sink's cycle: a playback still
  // connecting has no buffers to dequeue, which the cycle handles.
  run_on_data_thread(
      [](PipeWireRouter* self, void* stream) {
        self->rt_playback_ = static_cast<pw_stream*>(stream);
      },
      playback_.stream);
  return true;
}

void PipeWireRouter::close_stream(Stream& stream, bool playback) noexcept {
  if (stream.stream == nullptr) return;
  run_on_data_thread(
      playback ? +[](PipeWireRouter* self, void*) { self->rt_playback_ = nullptr; }
               : +[](PipeWireRouter* self, void*) { self->rt_capture_ = nullptr; },
      nullptr);
  api_.stream_disconnect(stream.stream);
  spa_hook_remove(&stream.listener);
  api_.stream_destroy(stream.stream);
  stream.stream = nullptr;
}

void PipeWireRouter::on_stream_state(void* data, pw_stream_state old,
                                     pw_stream_state state, const char* error) {
  auto* self = static_cast<PipeWireRouter*>(data);
  (void)old;
  if (state == PW_STREAM_STATE_PAUSED || state == PW_STREAM_STATE_STREAMING) {
    self->apply_playback_volume();
  }
  if (state == PW_STREAM_STATE_ERROR) {
    self->log_->write(std::string("stream error: ") +
                      (error != nullptr ? error : "unknown"));
  } else if (state == PW_STREAM_STATE_STREAMING ||
             state == PW_STREAM_STATE_UNCONNECTED) {
    self->log_->write(std::string("stream ") + state_name(state));
  }
}

void PipeWireRouter::on_capture_param(void* data, uint32_t id,
                                      const spa_pod* param) {
  auto* self = static_cast<PipeWireRouter*>(data);
  if (id != SPA_PARAM_Format || param == nullptr) return;
  spa_audio_info_raw info{};
  if (spa_format_audio_raw_parse(param, &info) < 0) return;
  self->capture_rate_ = info.rate;
  self->capture_channels_ = info.channels;
  self->ensure_engine();
}

void PipeWireRouter::ensure_engine() {
  if (shut_ || target_name_.empty() || capture_rate_ == 0) return;
  const Sink* sink = sink_named(target_name_);
  if (sink == nullptr) return;
  fluideq_engine::Endpoint endpoint{widen(endpoint_id_for(sink->name)),
                                    widen(sink->description)};
  const OutputFormat format{capture_rate_, layout_.channels, layout_.mask,
                            kMaxFrames};
  if (capture_channels_ != layout_.channels) {
    log_->write("the FluidEQ output runs " + std::to_string(capture_channels_) +
                " channels, not " + std::to_string(layout_.channels) +
                "; passing it through");
    swap_engine(nullptr);
    return;
  }
  if (engine_ && engine_->endpoint().guid == endpoint.guid &&
      engine_->format().rate == format.rate &&
      engine_->format().channels == format.channels &&
      engine_->format().channel_mask == format.channel_mask) {
    return;
  }
  try {
    pw_loop* const main_loop = api_.thread_loop_get_loop(loop_);
    spa_source* const event = latency_event_;
    // From the watcher thread: one signal, the loop thread does the rest.
    swap_engine(std::make_unique<OutputEngine>(
        endpoint, format,
        [main_loop, event] { pw_loop_signal_event(main_loop, event); }));
  } catch (const std::exception& error) {
    log_->write(std::string("could not start the engine: ") + error.what() +
                "; passing the sound through");
    swap_engine(nullptr);
  }
  report_latency();
}

void PipeWireRouter::on_latency_event(void* data, uint64_t count) {
  (void)count;
  static_cast<PipeWireRouter*>(data)->report_latency();
}

void PipeWireRouter::report_latency() {
  if (shut_ || capture_.stream == nullptr) return;
  const uint32_t frames = engine_ ? engine_->latency_frames() : 0;
  if (frames == latency_reported_) return;
  latency_reported_ = frames;
  // The engine's delay as the sink's own processing latency, which PipeWire
  // adds to what applications are told: a video player delays its picture
  // by it, as Windows players do by what the engine's `GetLatency` says.
  spa_process_latency_info info{};
  info.rate = static_cast<int32_t>(frames);
  uint8_t buffer[256];
  spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
  const spa_pod* params[1] = {
      spa_process_latency_build(&builder, SPA_PARAM_ProcessLatency, &info)};
  api_.stream_update_params(capture_.stream, params, 1);
}

void PipeWireRouter::swap_engine(std::unique_ptr<OutputEngine> next) noexcept {
  run_on_data_thread(
      [](PipeWireRouter* self, void* engine) {
        self->rt_engine_ = static_cast<OutputEngine*>(engine);
      },
      next.get());
  // The data thread has finished every cycle that could hold the old one.
  std::unique_ptr<OutputEngine> old = std::move(engine_);
  engine_ = std::move(next);
  if (old) old->retire();
}

void PipeWireRouter::on_capture_process(void* data) {
  auto* self = static_cast<PipeWireRouter*>(data);
  // These buffers already contain the virtual sink's software volume/mute.
  // Only its unmodified monitor ports may feed the Send tap and engine.
  pw_stream* const capture = self->rt_capture_;
  if (capture == nullptr) return;
  while (pw_buffer* buffer = self->api_.stream_dequeue_buffer(capture)) {
    self->api_.stream_queue_buffer(capture, buffer);
  }
}

void PipeWireRouter::on_playback_process(void* data) {
  static_cast<PipeWireRouter*>(data)->playback_cycle();
}

void PipeWireRouter::playback_cycle() noexcept {
  pw_stream* const playback = rt_playback_;
  if (playback == nullptr) return;
  ShareRing* const origin = rt_origin_ring_;
  ShareRing* const shared = rt_share_ring_;
  pw_buffer* out = api_.stream_dequeue_buffer(playback);
  if (out == nullptr) {
    return;
  }
  spa_buffer* const target = out->buffer;
  const uint32_t channels = std::min(rt_channels_, target->n_datas);
  uint32_t room = UINT32_MAX;
  for (uint32_t c = 0; c < channels; ++c) {
    room = std::min<uint32_t>(room, target->datas[c].maxsize / sizeof(float));
  }
  uint32_t frames = origin != nullptr ? origin->available() : 0;
  if (frames == 0 && shared != nullptr) frames = shared->available();
  if (api_.has_requested && out->requested > 0) {
    frames = static_cast<uint32_t>(out->requested);
  }
  frames = channels > 0 ? std::min(frames, room) : 0;

  float* planes[8] = {};
  bool mapped = channels > 0;
  for (uint32_t c = 0; c < channels; ++c) {
    planes[c] = static_cast<float*>(target->datas[c].data);
    if (planes[c] == nullptr) {
      mapped = false;
      continue;
    }
    std::memset(planes[c], 0, frames * sizeof(float));
  }
  if (origin != nullptr && mapped) origin->add_into(planes, channels, frames);
  // What this computer played, untouched, for Share Audio; then the sound
  // other computers send here joins it, so it is EQ'd here and never sent
  // back to them.
  if (MonitorRing* const ring = send_.rt_ring; ring != nullptr && mapped) {
    ring->write(planes, channels, frames);
  }
  if (shared != nullptr && mapped) shared->add_into(planes, channels, frames);
  OutputEngine* const engine = rt_engine_;
  if (engine != nullptr && mapped && frames > 0 &&
      engine->format().channels == channels) {
    engine->process(planes, frames);
  }
  // What the output is about to play, for the window's live displays.
  if (MonitorRing* const ring = monitor_.rt_ring; ring != nullptr && mapped) {
    ring->write(planes, channels, frames);
  }
  for (uint32_t c = 0; c < channels; ++c) {
    spa_chunk* chunk = target->datas[c].chunk;
    chunk->offset = 0;
    chunk->stride = sizeof(float);
    chunk->size = frames * sizeof(float);
  }
  api_.stream_queue_buffer(playback, out);
}

}  // namespace fluideq_linux

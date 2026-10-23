/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP host's output on Linux, through PipeWire.
 *
 * One playback stream, planar float, stereo (the host's engine is two
 * channels; PipeWire maps them onto whatever the output has), at the graph's
 * own rate so nothing on our side resamples. No target: it plays to the
 * default output, which under the FluidEQ Engine is the FluidEQ sink — the
 * same path the Windows host takes through the endpoint's effects — and
 * PipeWire moves it when the default changes, so a change of output needs
 * no reopen here at all. What does need one is the stream being taken away
 * (its output gone, the server restarted), which raises `needs_reopen`; and
 * while one is awaited, an output appearing raises it again
 * (`await_endpoint`), so the host waits for a device, never for a clock.
 */

#include "pipewire_backend.h"

#include <pipewire/extensions/metadata.h>
#include <spa/param/audio/format-utils.h>
#include <spa/pod/builder.h>

#include <algorithm>
#include <atomic>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <vector>

namespace fluideq_linux {

namespace {

// The largest block handed to the host's render in one call; a larger
// quantum is rendered in pieces. PipeWire's default ceiling.
constexpr uint32_t kMaxBlock = 8192;
constexpr uint32_t kChannels = 2;

class PipeWireBackend final : public IAudioOutputBackend {
 public:
  PipeWireBackend(const PwApi& api, const FeqBackendHooks& hooks)
      : api_(api), hooks_(hooks) {}

  ~PipeWireBackend() override {
    close();
    disconnect();
  }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    if (!connected() && !connect(error)) return false;
    api_.thread_loop_lock(loop_);
    if (stream_ != nullptr) close_locked();
    if (sinks_ == 0) {
      api_.thread_loop_unlock(loop_);
      error = "no audio output is available";
      return false;
    }
    failed_ = false;
    // The graph's own rate, from PipeWire's settings, asked for exactly: the
    // engine is built around it before the first period, and nothing on our
    // side resamples. Waiting for the stream to negotiate instead never
    // ends while it is inactive — PipeWire links an inactive stream but
    // negotiates nothing on the link until it is started.
    rate_ = graph_rate();
    pw_properties* props = api_.properties_new(
        PW_KEY_MEDIA_TYPE, "Audio", PW_KEY_MEDIA_CATEGORY, "Playback",
        PW_KEY_MEDIA_ROLE, "Music", PW_KEY_NODE_NAME, "fluideq_library",
        PW_KEY_NODE_DESCRIPTION, "FluidEQ Library", PW_KEY_APP_NAME, "FluidEQ",
        nullptr);
    stream_ = api_.stream_new(core_, "FluidEQ Library", props);
    if (stream_ == nullptr) {
      api_.thread_loop_unlock(loop_);
      error = "could not create a PipeWire stream";
      return false;
    }
    static const pw_stream_events events = [] {
      pw_stream_events e{};
      e.version = PW_VERSION_STREAM_EVENTS;
      e.process = &PipeWireBackend::on_process;
      e.param_changed = &PipeWireBackend::on_param;
      e.state_changed = &PipeWireBackend::on_state;
      return e;
    }();
    api_.stream_add_listener(stream_, &stream_listener_, &events, this);
    spa_audio_info_raw info{};
    info.format = SPA_AUDIO_FORMAT_F32P;
    info.channels = kChannels;
    info.rate = rate_;
    info.position[0] = SPA_AUDIO_CHANNEL_FL;
    info.position[1] = SPA_AUDIO_CHANNEL_FR;
    uint8_t buffer[512];
    spa_pod_builder builder = SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));
    const spa_pod* params[1] = {
        spa_format_audio_raw_build(&builder, SPA_PARAM_EnumFormat, &info)};
    // Inactive until `start`: the rate is known, and the engine rebuilt
    // around it, before the first period asks for audio.
    const int connected = api_.stream_connect(
        stream_, PW_DIRECTION_OUTPUT, PW_ID_ANY,
        static_cast<pw_stream_flags>(
            PW_STREAM_FLAG_AUTOCONNECT | PW_STREAM_FLAG_MAP_BUFFERS |
            PW_STREAM_FLAG_RT_PROCESS | PW_STREAM_FLAG_INACTIVE),
        params, 1);
    if (connected < 0) {
      close_locked();
      api_.thread_loop_unlock(loop_);
      error = "could not connect the PipeWire stream";
      return false;
    }
    negotiated.sample_rate = rate_;
    negotiated.channels = kChannels;
    negotiated.max_block_frames = kMaxBlock;
    open_ = true;
    api_.thread_loop_unlock(loop_);
    return true;
  }

  bool endpoint_absent() const override { return connected() && sinks_ == 0; }

  bool start(std::string& error) override {
    if (!connected()) {
      error = "PipeWire is not connected";
      return false;
    }
    api_.thread_loop_lock(loop_);
    const bool ok = stream_ != nullptr && api_.stream_set_active(stream_, true) >= 0;
    running_.store(ok, std::memory_order_release);
    api_.thread_loop_unlock(loop_);
    if (!ok) error = "could not start the PipeWire stream";
    return ok;
  }

  void close() override {
    if (!connected()) return;
    api_.thread_loop_lock(loop_);
    close_locked();
    api_.thread_loop_unlock(loop_);
  }

  bool is_open() const override { return open_; }
  bool is_running() const override {
    return running_.load(std::memory_order_acquire);
  }

  FeqBackendStats stats() const override {
    FeqBackendStats out;
    out.underruns = underruns_.load(std::memory_order_relaxed);
    out.periods = periods_.load(std::memory_order_relaxed);
    out.buffer_frames = open_ ? quantum_.load(std::memory_order_relaxed) : 0;
    return out;
  }

  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_acquire);
  }
  void clear_reopen() override {
    reopen_.store(false, std::memory_order_release);
  }
  void await_endpoint() override {
    awaiting_.store(true, std::memory_order_release);
  }

  const char* name() const override { return "pipewire"; }

 private:
  bool connected() const { return loop_ != nullptr && core_ != nullptr; }

  bool connect(std::string& error) {
    disconnect();
    loop_ = api_.thread_loop_new("fluideq-dsp-host", nullptr);
    if (loop_ == nullptr) {
      error = "could not create PipeWire's loop";
      return false;
    }
    context_ = api_.context_new(api_.thread_loop_get_loop(loop_), nullptr, 0);
    if (context_ == nullptr || api_.thread_loop_start(loop_) < 0) {
      error = "could not start PipeWire";
      disconnect();
      return false;
    }
    api_.thread_loop_lock(loop_);
    lost_ = false;
    core_ = api_.context_connect(
        context_, api_.properties_new(PW_KEY_APP_NAME, "FluidEQ", nullptr), 0);
    if (core_ == nullptr) {
      api_.thread_loop_unlock(loop_);
      error = "PipeWire is not running for this user";
      disconnect();
      return false;
    }
    static const pw_core_events core_events = [] {
      pw_core_events e{};
      e.version = PW_VERSION_CORE_EVENTS;
      e.done = &PipeWireBackend::on_done;
      e.error = &PipeWireBackend::on_error;
      return e;
    }();
    pw_core_add_listener(core_, &core_listener_, &core_events, this);
    registry_ = pw_core_get_registry(core_, PW_VERSION_REGISTRY, 0);
    static const pw_registry_events registry_events = [] {
      pw_registry_events e{};
      e.version = PW_VERSION_REGISTRY_EVENTS;
      e.global = &PipeWireBackend::on_global;
      e.global_remove = &PipeWireBackend::on_global_remove;
      return e;
    }();
    pw_registry_add_listener(registry_, &registry_listener_, &registry_events,
                             this);
    // Twice: the first answers with the outputs and the settings object,
    // the second with the settings' values, which binding it asked for.
    for (int pass = 0; pass < 2 && !lost_; ++pass) {
      synced_ = false;
      sync_seq_ = pw_core_sync(core_, PW_ID_CORE, sync_seq_);
      while (!synced_ && !lost_) api_.thread_loop_wait(loop_);
    }
    api_.thread_loop_unlock(loop_);
    return true;
  }

  /** `clock.force-rate` when set, else `clock.rate`, else PipeWire's default. */
  uint32_t graph_rate() const {
    if (force_rate_ > 0) return force_rate_;
    return clock_rate_ > 0 ? clock_rate_ : 48000;
  }

  static int on_setting(void* data, uint32_t subject, const char* key,
                        const char* type, const char* value) {
    (void)type;
    auto* self = static_cast<PipeWireBackend*>(data);
    if (subject != PW_ID_CORE || key == nullptr) return 0;
    const uint32_t number =
        value != nullptr ? static_cast<uint32_t>(std::strtoul(value, nullptr, 10))
                         : 0;
    if (std::strcmp(key, "clock.rate") == 0) self->clock_rate_ = number;
    if (std::strcmp(key, "clock.force-rate") == 0) self->force_rate_ = number;
    return 0;
  }

  void disconnect() {
    if (loop_ == nullptr) return;
    api_.thread_loop_stop(loop_);
    if (stream_ != nullptr) {
      spa_hook_remove(&stream_listener_);
      api_.stream_destroy(stream_);
      stream_ = nullptr;
    }
    if (settings_ != nullptr) {
      spa_hook_remove(&settings_listener_);
      api_.proxy_destroy(reinterpret_cast<pw_proxy*>(settings_));
      settings_ = nullptr;
    }
    if (registry_ != nullptr) {
      spa_hook_remove(&registry_listener_);
      api_.proxy_destroy(reinterpret_cast<pw_proxy*>(registry_));
      registry_ = nullptr;
    }
    if (core_ != nullptr) {
      spa_hook_remove(&core_listener_);
      api_.core_disconnect(core_);
      core_ = nullptr;
    }
    if (context_ != nullptr) api_.context_destroy(context_);
    context_ = nullptr;
    api_.thread_loop_destroy(loop_);
    loop_ = nullptr;
    sink_ids_.clear();
    sinks_ = 0;
  }

  void close_locked() {
    running_.store(false, std::memory_order_release);
    open_ = false;
    if (stream_ == nullptr) return;
    spa_hook_remove(&stream_listener_);
    api_.stream_disconnect(stream_);
    api_.stream_destroy(stream_);
    stream_ = nullptr;
  }

  /** The stream was taken away, or an output came while one was awaited. */
  void want_reopen() {
    reopen_.store(true, std::memory_order_release);
    if (hooks_.reopen_wanted != nullptr) hooks_.reopen_wanted(hooks_.context);
  }

  static void on_done(void* data, uint32_t id, int seq) {
    auto* self = static_cast<PipeWireBackend*>(data);
    if (id == PW_ID_CORE && seq == self->sync_seq_) {
      self->synced_ = true;
      self->api_.thread_loop_signal(self->loop_, false);
    }
  }

  static void on_error(void* data, uint32_t id, int seq, int res,
                       const char* message) {
    (void)seq;
    (void)message;
    auto* self = static_cast<PipeWireBackend*>(data);
    if (id == PW_ID_CORE && res == -EPIPE) {
      self->lost_ = true;
      self->failed_ = true;
      self->api_.thread_loop_signal(self->loop_, false);
      self->want_reopen();
    }
  }

  static void on_global(void* data, uint32_t id, uint32_t permissions,
                        const char* type, uint32_t version,
                        const spa_dict* props) {
    (void)permissions;
    (void)version;
    auto* self = static_cast<PipeWireBackend*>(data);
    if (props == nullptr) return;
    if (std::strcmp(type, PW_TYPE_INTERFACE_Metadata) == 0) {
      const char* name = spa_dict_lookup(props, PW_KEY_METADATA_NAME);
      if (name == nullptr || std::strcmp(name, "settings") != 0 ||
          self->settings_ != nullptr) {
        return;
      }
      self->settings_ = static_cast<pw_metadata*>(pw_registry_bind(
          self->registry_, id, PW_TYPE_INTERFACE_Metadata, PW_VERSION_METADATA,
          0));
      static const pw_metadata_events events = [] {
        pw_metadata_events e{};
        e.version = PW_VERSION_METADATA_EVENTS;
        e.property = &PipeWireBackend::on_setting;
        return e;
      }();
      if (self->settings_ != nullptr) {
        pw_metadata_add_listener(self->settings_, &self->settings_listener_,
                                 &events, self);
      }
      return;
    }
    if (std::strcmp(type, PW_TYPE_INTERFACE_Node) != 0) return;
    const char* media_class = spa_dict_lookup(props, PW_KEY_MEDIA_CLASS);
    if (media_class == nullptr || std::strcmp(media_class, "Audio/Sink") != 0) {
      return;
    }
    self->sink_ids_.push_back(id);
    self->sinks_ = static_cast<uint32_t>(self->sink_ids_.size());
    if (self->awaiting_.exchange(false, std::memory_order_acq_rel)) {
      self->want_reopen();
    }
  }

  static void on_global_remove(void* data, uint32_t id) {
    auto* self = static_cast<PipeWireBackend*>(data);
    auto& ids = self->sink_ids_;
    ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
    self->sinks_ = static_cast<uint32_t>(ids.size());
  }

  static void on_param(void* data, uint32_t id, const spa_pod* param) {
    auto* self = static_cast<PipeWireBackend*>(data);
    if (id != SPA_PARAM_Format || param == nullptr) return;
    spa_audio_info_raw info{};
    if (spa_format_audio_raw_parse(param, &info) < 0 || info.rate == 0) return;
    // The rate was asked for exactly; a stream fixed at another one is
    // playing an engine built for the wrong rate, so it is rebuilt.
    if (info.rate != self->rate_) self->want_reopen();
  }

  static void on_state(void* data, pw_stream_state old, pw_stream_state state,
                       const char* error) {
    (void)old;
    (void)error;
    auto* self = static_cast<PipeWireBackend*>(data);
    if (state == PW_STREAM_STATE_ERROR) {
      self->failed_ = true;
      self->api_.thread_loop_signal(self->loop_, false);
    }
    // Taken away while it was meant to play: its output went, or the
    // server dropped it. The host closes, awaits and opens again.
    if ((state == PW_STREAM_STATE_ERROR ||
         state == PW_STREAM_STATE_UNCONNECTED) &&
        self->running_.load(std::memory_order_acquire)) {
      self->running_.store(false, std::memory_order_release);
      self->want_reopen();
    }
  }

  static void on_process(void* data) {
    static_cast<PipeWireBackend*>(data)->render();
  }

  void render() noexcept {
    pw_buffer* out = api_.stream_dequeue_buffer(stream_);
    if (out == nullptr) {
      underruns_.fetch_add(1, std::memory_order_relaxed);
      return;
    }
    spa_buffer* const buffer = out->buffer;
    const uint32_t channels = std::min(kChannels, buffer->n_datas);
    uint32_t room = UINT32_MAX;
    float* planes[kChannels] = {};
    for (uint32_t c = 0; c < channels; ++c) {
      planes[c] = static_cast<float*>(buffer->datas[c].data);
      room = std::min<uint32_t>(room, buffer->datas[c].maxsize / sizeof(float));
      if (planes[c] == nullptr) room = 0;
    }
    if (channels == 0) room = 0;
    uint32_t frames = room;
    if (api_.has_requested && out->requested > 0) {
      frames = std::min<uint32_t>(frames, static_cast<uint32_t>(out->requested));
    }
    for (uint32_t done = 0; done < frames;) {
      const uint32_t piece = std::min(frames - done, kMaxBlock);
      float* pieces[kChannels] = {};
      for (uint32_t c = 0; c < channels; ++c) {
        pieces[c] = planes[c] + done;
        std::memset(pieces[c], 0, piece * sizeof(float));
      }
      if (hooks_.render != nullptr) hooks_.render(hooks_.context, pieces, piece);
      done += piece;
    }
    for (uint32_t c = 0; c < channels; ++c) {
      buffer->datas[c].chunk->offset = 0;
      buffer->datas[c].chunk->stride = sizeof(float);
      buffer->datas[c].chunk->size = frames * sizeof(float);
    }
    api_.stream_queue_buffer(stream_, out);
    quantum_.store(frames, std::memory_order_relaxed);
    periods_.fetch_add(1, std::memory_order_relaxed);
    if (hooks_.period_done != nullptr) hooks_.period_done(hooks_.context);
  }

  const PwApi& api_;
  const FeqBackendHooks hooks_;
  pw_thread_loop* loop_ = nullptr;
  pw_context* context_ = nullptr;
  pw_core* core_ = nullptr;
  spa_hook core_listener_{};
  pw_registry* registry_ = nullptr;
  spa_hook registry_listener_{};
  pw_stream* stream_ = nullptr;
  spa_hook stream_listener_{};
  std::vector<uint32_t> sink_ids_;
  // Loop-thread state, read by callers under the loop lock or as a hint.
  std::atomic<uint32_t> sinks_{0};
  int sync_seq_ = 0;
  bool synced_ = false;
  pw_metadata* settings_ = nullptr;
  spa_hook settings_listener_{};
  uint32_t clock_rate_ = 0;
  uint32_t force_rate_ = 0;
  bool failed_ = false;
  bool lost_ = false;
  bool open_ = false;
  uint32_t rate_ = 0;
  std::atomic<bool> running_{false};
  std::atomic<bool> reopen_{false};
  std::atomic<bool> awaiting_{false};
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
  std::atomic<uint32_t> quantum_{0};
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> make_pipewire_backend(
    const FeqBackendHooks& hooks, std::string& error) {
  const PwApi* api = pw_api(error);
  if (api == nullptr) return nullptr;
  return std::make_unique<PipeWireBackend>(*api, hooks);
}

}  // namespace fluideq_linux

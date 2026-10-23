/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The router's connection, the outputs PipeWire announces, the default
 * output, and the choice of which real output to play to.
 */

#include "pw_router.h"

#include <sys/eventfd.h>
#include <unistd.h>

#include <cstring>
#include <utility>

#include "../compat/wide_path.h"
#include "log.h"

namespace fluideq_linux {

namespace {

constexpr const char* kConfiguredSink = "default.configured.audio.sink";
constexpr const char* kEffectiveSink = "default.audio.sink";

const char* lookup(const spa_dict* props, const char* key) {
  return props != nullptr ? spa_dict_lookup(props, key) : nullptr;
}

/** The node name out of a default's JSON value: `{ "name": "…" }`. */
std::string name_in(const char* json) {
  if (json == nullptr) return {};
  const char* key = std::strstr(json, "\"name\"");
  if (key == nullptr) return {};
  const char* open = std::strchr(key + 6, '"');
  if (open == nullptr) return {};
  const char* close = std::strchr(open + 1, '"');
  if (close == nullptr) return {};
  return std::string(open + 1, static_cast<size_t>(close - open - 1));
}

const pw_registry_events kRegistryEvents = [] {
  pw_registry_events events{};
  events.version = PW_VERSION_REGISTRY_EVENTS;
  return events;
}();

}  // namespace

std::unique_ptr<PipeWireRouter> PipeWireRouter::create(
    const RouterOptions& options, std::string& error) {
  const PwApi* api = pw_api(error);
  if (api == nullptr) return nullptr;
  std::unique_ptr<PipeWireRouter> router(new PipeWireRouter(*api, options));
  if (!router->connect(error)) return nullptr;
  return router;
}

PipeWireRouter::PipeWireRouter(const PwApi& api, RouterOptions options)
    : api_(api), options_(std::move(options)) {
  log_ = std::make_unique<fluideq_engine::Log>(fluideq_engine::no_endpoint());
}

PipeWireRouter::~PipeWireRouter() {
  shutdown();
  if (loop_ != nullptr) {
    api_.thread_loop_stop(loop_);
    if (core_ != nullptr) api_.core_disconnect(core_);
    if (context_ != nullptr) api_.context_destroy(context_);
    api_.thread_loop_destroy(loop_);
  }
  if (lost_fd_ >= 0) ::close(lost_fd_);
}

bool PipeWireRouter::connect(std::string& error) {
  lost_fd_ = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  loop_ = api_.thread_loop_new("fluideq-engine", nullptr);
  if (loop_ == nullptr || lost_fd_ < 0) {
    error = "could not create PipeWire's loop";
    return false;
  }
  context_ = api_.context_new(api_.thread_loop_get_loop(loop_), nullptr, 0);
  if (context_ == nullptr) {
    error = "could not create a PipeWire context";
    return false;
  }
  data_loop_ = api_.data_loop_get_loop(api_.context_get_data_loop(context_));
  latency_event_ = pw_loop_add_event(api_.thread_loop_get_loop(loop_),
                                     &PipeWireRouter::on_latency_event, this);
  if (api_.thread_loop_start(loop_) < 0) {
    error = "could not start PipeWire's loop thread";
    return false;
  }
  api_.thread_loop_lock(loop_);
  core_ = api_.context_connect(
      context_,
      api_.properties_new(PW_KEY_APP_NAME, "FluidEQ Engine", nullptr), 0);
  if (core_ == nullptr) {
    api_.thread_loop_unlock(loop_);
    error = "PipeWire is installed but not running for this user";
    return false;
  }
  static const pw_core_events core_events = [] {
    pw_core_events events{};
    events.version = PW_VERSION_CORE_EVENTS;
    events.done = &PipeWireRouter::on_core_done;
    events.error = &PipeWireRouter::on_core_error;
    return events;
  }();
  pw_core_add_listener(core_, &core_listener_, &core_events, this);
  registry_ = pw_core_get_registry(core_, PW_VERSION_REGISTRY, 0);
  static const pw_registry_events registry_events = [] {
    pw_registry_events events = kRegistryEvents;
    events.global = &PipeWireRouter::on_global;
    events.global_remove = &PipeWireRouter::on_global_remove;
    return events;
  }();
  pw_registry_add_listener(registry_, &registry_listener_, &registry_events,
                           this);
  // Every output, its description and the defaults are known before the
  // first choice: two round trips, the second for the node infos and
  // metadata the first one's globals asked for.
  roundtrip();
  roundtrip();
  log_->write("PipeWire " + std::string(api_.get_library_version()) +
              ": " + std::to_string(sinks_.size()) + " output(s)");
  choose_target();
  api_.thread_loop_unlock(loop_);
  return true;
}

void PipeWireRouter::roundtrip() {
  synced_ = false;
  pending_seq_ = pw_core_sync(core_, PW_ID_CORE, pending_seq_);
  while (!synced_ && !lost_) api_.thread_loop_wait(loop_);
}

void PipeWireRouter::on_core_done(void* data, uint32_t id, int seq) {
  auto* self = static_cast<PipeWireRouter*>(data);
  if (id == PW_ID_CORE && seq == self->pending_seq_) {
    self->synced_ = true;
    self->api_.thread_loop_signal(self->loop_, false);
  }
}

void PipeWireRouter::on_core_error(void* data, uint32_t id, int seq, int res,
                                   const char* message) {
  auto* self = static_cast<PipeWireRouter*>(data);
  self->log_->write("PipeWire error on " + std::to_string(id) + ": " +
                    (message != nullptr ? message : "?") + " (" +
                    std::to_string(res) + ")");
  (void)seq;
  // The connection itself: the server went away, so does everything here.
  if (id == PW_ID_CORE && res == -EPIPE) {
    self->lost_ = true;
    const uint64_t one = 1;
    const ssize_t wrote = ::write(self->lost_fd_, &one, sizeof(one));
    (void)wrote;
    self->api_.thread_loop_signal(self->loop_, false);
  }
}

void PipeWireRouter::on_global(void* data, uint32_t id, uint32_t permissions,
                               const char* type, uint32_t version,
                               const spa_dict* props) {
  (void)permissions;
  (void)version;
  auto* self = static_cast<PipeWireRouter*>(data);
  if (std::strcmp(type, PW_TYPE_INTERFACE_Metadata) == 0) {
    const char* name = lookup(props, PW_KEY_METADATA_NAME);
    if (name == nullptr || std::strcmp(name, "default") != 0 ||
        self->metadata_ != nullptr) {
      return;
    }
    self->metadata_ = static_cast<pw_metadata*>(pw_registry_bind(
        self->registry_, id, PW_TYPE_INTERFACE_Metadata, PW_VERSION_METADATA, 0));
    self->metadata_id_ = id;
    static const pw_metadata_events events = [] {
      pw_metadata_events e{};
      e.version = PW_VERSION_METADATA_EVENTS;
      e.property = &PipeWireRouter::on_metadata_property;
      return e;
    }();
    pw_metadata_add_listener(self->metadata_, &self->metadata_listener_,
                             &events, self);
    return;
  }
  if (std::strcmp(type, PW_TYPE_INTERFACE_Node) != 0) return;
  const char* media_class = lookup(props, PW_KEY_MEDIA_CLASS);
  const char* name = lookup(props, PW_KEY_NODE_NAME);
  if (media_class == nullptr || name == nullptr ||
      std::strcmp(media_class, "Audio/Sink") != 0) {
    return;
  }
  if (self->options_.sink_name == name) {
    self->own_sink_id_ = id;
    self->own_sink_seen_ = true;
    self->claim_default();
    return;
  }
  auto sink = std::make_unique<Sink>();
  sink->id = id;
  sink->name = name;
  const char* description = lookup(props, PW_KEY_NODE_DESCRIPTION);
  sink->description = description != nullptr ? description : name;
  if (const char* priority = lookup(props, PW_KEY_PRIORITY_SESSION)) {
    sink->priority = std::atoi(priority);
  }
  sink->router = self;
  // Its channels are in the node's info, not the global: bind to read them.
  sink->proxy = static_cast<pw_proxy*>(pw_registry_bind(
      self->registry_, id, PW_TYPE_INTERFACE_Node, PW_VERSION_NODE, 0));
  if (sink->proxy != nullptr) {
    static const pw_node_events events = [] {
      pw_node_events e{};
      e.version = PW_VERSION_NODE_EVENTS;
      e.info = &PipeWireRouter::on_node_info;
      return e;
    }();
    pw_node_add_listener(reinterpret_cast<pw_node*>(sink->proxy),
                         &sink->listener, &events, sink.get());
  }
  self->sinks_[id] = std::move(sink);
}

void PipeWireRouter::on_node_info(void* data, const pw_node_info* info) {
  auto* sink = static_cast<Sink*>(data);
  if (info == nullptr || (info->change_mask & PW_NODE_CHANGE_MASK_PROPS) == 0) {
    return;
  }
  if (const char* channels = lookup(info->props, PW_KEY_AUDIO_CHANNELS)) {
    sink->channels = static_cast<uint32_t>(std::atoi(channels));
  }
  if (const char* positions = lookup(info->props, "audio.position")) {
    sink->positions = parse_positions(positions);
  }
  const bool first = !sink->described;
  sink->described = true;
  PipeWireRouter* self = sink->router;
  if (first && self->synced_) self->choose_target();
}

int PipeWireRouter::on_metadata_property(void* data, uint32_t subject,
                                         const char* key, const char* type,
                                         const char* value) {
  (void)type;
  auto* self = static_cast<PipeWireRouter*>(data);
  if (subject != PW_ID_CORE) return 0;
  if (key == nullptr) {  // Everything was cleared.
    self->configured_default_.clear();
    self->effective_default_.clear();
  } else if (std::strcmp(key, kConfiguredSink) == 0) {
    self->configured_default_ = name_in(value);
  } else if (std::strcmp(key, kEffectiveSink) == 0) {
    self->effective_default_ = name_in(value);
  } else {
    return 0;
  }
  if (self->synced_) self->choose_target();
  return 0;
}

void PipeWireRouter::on_global_remove(void* data, uint32_t id) {
  auto* self = static_cast<PipeWireRouter*>(data);
  if (self->own_sink_seen_ && id == self->own_sink_id_) {
    self->own_sink_seen_ = false;
    return;
  }
  if (self->metadata_ != nullptr && id == self->metadata_id_) {
    spa_hook_remove(&self->metadata_listener_);
    self->api_.proxy_destroy(reinterpret_cast<pw_proxy*>(self->metadata_));
    self->metadata_ = nullptr;
    return;
  }
  if (self->sinks_.count(id) == 0) return;
  self->forget_sink(id);
  self->choose_target();
}

void PipeWireRouter::forget_sink(uint32_t id) {
  const auto found = sinks_.find(id);
  if (found == sinks_.end()) return;
  Sink& sink = *found->second;
  if (sink.proxy != nullptr) {
    spa_hook_remove(&sink.listener);
    api_.proxy_destroy(sink.proxy);
  }
  sinks_.erase(found);
}

const PipeWireRouter::Sink* PipeWireRouter::sink_named(
    const std::string& name) const {
  if (name.empty()) return nullptr;
  for (const auto& [id, sink] : sinks_) {
    if (sink->name == name) return sink.get();
  }
  return nullptr;
}

void PipeWireRouter::choose_target() {
  if (shut_) return;
  const Sink* chosen = nullptr;
  if (!options_.target.empty()) {
    chosen = sink_named(options_.target);
  } else {
    // The listener's own pick first; then whatever is playing now, if it is
    // still here; then what PipeWire falls back to; then the likeliest.
    chosen = sink_named(configured_default_);
    if (chosen == nullptr) chosen = sink_named(target_name_);
    if (chosen == nullptr) chosen = sink_named(effective_default_);
    if (chosen == nullptr) {
      for (const auto& [id, sink] : sinks_) {
        if (chosen == nullptr || sink->priority > chosen->priority) {
          chosen = sink.get();
        }
      }
    }
  }
  if (chosen == nullptr) {
    if (!target_name_.empty()) {
      log_->write("no output to play to; waiting for one");
      close_stream(playback_, true);
      target_name_.clear();
    }
    write_outputs();
    return;
  }
  // Its channels are needed before its streams; the info is on its way.
  if (!chosen->described && chosen->proxy != nullptr) return;
  const ChannelLayout layout = layout_for(chosen->channels, chosen->positions);
  if (chosen->name != target_name_ || !(layout == layout_)) {
    retarget(*chosen);
  }
  claim_default();
  write_outputs();
}

void PipeWireRouter::claim_default() {
  if (!options_.take_default || shut_ || !own_sink_seen_ ||
      metadata_ == nullptr || target_name_.empty()) {
    return;
  }
  if (configured_default_ == options_.sink_name) {
    // Left by an engine that did not get to give it back (killed, power
    // cut): ours to clear on exit, as if this engine had taken it.
    if (!default_taken_) {
      default_taken_ = true;
      target_at_claim_ = target_name_;
    }
    return;
  }
  if (!default_taken_) {
    configured_before_ = configured_default_;
    target_at_claim_ = target_name_;
  }
  set_configured_default(options_.sink_name);
  default_taken_ = true;
}

void PipeWireRouter::set_configured_default(const std::string& name) {
  if (metadata_ == nullptr) return;
  if (name.empty()) {  // No value removes the key: PipeWire chooses again.
    pw_metadata_set_property(metadata_, PW_ID_CORE, kConfiguredSink, nullptr,
                             nullptr);
    return;
  }
  const std::string value = "{ \"name\": \"" + name + "\" }";
  pw_metadata_set_property(metadata_, PW_ID_CORE, kConfiguredSink,
                           "Spa:String:JSON", value.c_str());
}

void PipeWireRouter::write_outputs() noexcept {
  try {
    std::vector<OutputEntry> outputs;
    for (const auto& [id, sink] : sinks_) {
      outputs.push_back(OutputEntry{endpoint_id_for(sink->name), sink->name,
                                    sink->description,
                                    sink->channels > 0
                                        ? sink->channels
                                        : static_cast<uint32_t>(sink->positions.size()),
                                    sink->name == target_name_});
    }
    std::string why;
    if (!write_outputs_file("pipewire", options_.sink_name, outputs, &why)) {
      log_->write("could not write outputs.json (" + why + ")");
    }
  } catch (...) {
    // The app then lists what it last read; the audio is unaffected.
  }
}

void PipeWireRouter::shutdown() noexcept {
  if (loop_ == nullptr || shut_) return;
  api_.thread_loop_lock(loop_);
  shut_ = true;
  // The listener's output becomes the default again before the FluidEQ sink
  // goes, so applications move straight to it rather than to a fallback.
  if (default_taken_ && !lost_) {
    const bool untouched =
        configured_before_.empty() && target_name_ == target_at_claim_;
    set_configured_default(untouched ? std::string() : target_name_);
    roundtrip();
  }
  close_stream(playback_, true);
  close_monitor();
  close_stream(capture_, false);
  swap_engine(nullptr);
  // After the engine: its watcher thread is joined, so nothing signals it.
  if (latency_event_ != nullptr) {
    pw_loop_destroy_source(api_.thread_loop_get_loop(loop_), latency_event_);
    latency_event_ = nullptr;
  }
  if (!lost_) roundtrip();
  for (auto it = sinks_.begin(); it != sinks_.end();) {
    const uint32_t id = it->first;
    ++it;
    forget_sink(id);
  }
  if (metadata_ != nullptr) {
    spa_hook_remove(&metadata_listener_);
    api_.proxy_destroy(reinterpret_cast<pw_proxy*>(metadata_));
    metadata_ = nullptr;
  }
  api_.thread_loop_unlock(loop_);
}

}  // namespace fluideq_linux

namespace fluideq_linux {

void PipeWireRouter::select_output(const std::string& name) noexcept {
  if (!options_.target.empty() || loop_ == nullptr) return;
  api_.thread_loop_lock(loop_);
  // The listener's pick, as the desktop's sound settings would make it: the
  // metadata comes back, `choose_target` follows it and `claim_default`
  // makes FluidEQ the default again.
  if (!shut_ && !lost_ && sink_named(name) != nullptr) {
    set_configured_default(name);
  }
  api_.thread_loop_unlock(loop_);
}

}  // namespace fluideq_linux

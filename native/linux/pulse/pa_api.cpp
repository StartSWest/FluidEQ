/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "pa_api.h"

#include <dlfcn.h>

#include <mutex>
#include <type_traits>

namespace fluideq_linux::pa {

namespace {

struct Loaded {
  Api api{};
  bool ok = false;
  std::string error;
};

Loaded load() {
  Loaded out;
  // Never unloaded, for the reason PipeWire is not: its threads outlive us.
  void* library = dlopen("libpulse.so.0", RTLD_NOW | RTLD_LOCAL);
  if (library == nullptr) {
    out.error = "PulseAudio's client library (libpulse.so.0) is not installed";
    return out;
  }
  Api& a = out.api;
  const auto bind = [&](const char* name, auto& slot) {
    void* symbol = dlsym(library, name);
    slot = reinterpret_cast<std::remove_reference_t<decltype(slot)>>(symbol);
    if (symbol == nullptr && out.error.empty()) {
      out.error = std::string("libpulse has no ") + name;
    }
    return symbol != nullptr;
  };
  const bool ok =
      bind("pa_threaded_mainloop_new", a.mainloop_new) &&
      bind("pa_threaded_mainloop_free", a.mainloop_free) &&
      bind("pa_threaded_mainloop_start", a.mainloop_start) &&
      bind("pa_threaded_mainloop_stop", a.mainloop_stop) &&
      bind("pa_threaded_mainloop_lock", a.mainloop_lock) &&
      bind("pa_threaded_mainloop_unlock", a.mainloop_unlock) &&
      bind("pa_threaded_mainloop_wait", a.mainloop_wait) &&
      bind("pa_threaded_mainloop_signal", a.mainloop_signal) &&
      bind("pa_threaded_mainloop_get_api", a.mainloop_get_api) &&
      bind("pa_context_new", a.context_new) &&
      bind("pa_context_unref", a.context_unref) &&
      bind("pa_context_connect", a.context_connect) &&
      bind("pa_context_disconnect", a.context_disconnect) &&
      bind("pa_context_set_state_callback", a.context_set_state_callback) &&
      bind("pa_context_get_state", a.context_get_state) &&
      bind("pa_context_set_subscribe_callback", a.context_set_subscribe_callback) &&
      bind("pa_context_subscribe", a.context_subscribe) &&
      bind("pa_context_get_server_info", a.context_get_server_info) &&
      bind("pa_context_get_sink_info_list", a.context_get_sink_info_list) &&
      bind("pa_context_get_sink_input_info_list",
           a.context_get_sink_input_info_list) &&
      bind("pa_context_load_module", a.context_load_module) &&
      bind("pa_context_unload_module", a.context_unload_module) &&
      bind("pa_context_set_default_sink", a.context_set_default_sink) &&
      bind("pa_context_move_sink_input_by_name",
           a.context_move_sink_input_by_name) &&
      bind("pa_context_errno", a.context_errno) &&
      bind("pa_strerror", a.strerror) &&
      bind("pa_operation_unref", a.operation_unref) &&
      bind("pa_operation_get_state", a.operation_get_state) &&
      bind("pa_stream_new", a.stream_new) &&
      bind("pa_stream_unref", a.stream_unref) &&
      bind("pa_stream_connect_record", a.stream_connect_record) &&
      bind("pa_stream_connect_playback", a.stream_connect_playback) &&
      bind("pa_stream_disconnect", a.stream_disconnect) &&
      bind("pa_stream_peek", a.stream_peek) &&
      bind("pa_stream_drop", a.stream_drop) &&
      bind("pa_stream_write", a.stream_write) &&
      bind("pa_stream_set_read_callback", a.stream_set_read_callback) &&
      bind("pa_stream_set_state_callback", a.stream_set_state_callback) &&
      bind("pa_stream_set_underflow_callback", a.stream_set_underflow_callback) &&
      bind("pa_stream_get_state", a.stream_get_state) &&
      bind("pa_stream_get_index", a.stream_get_index) &&
      bind("pa_stream_update_sample_rate", a.stream_update_sample_rate) &&
      bind("pa_stream_get_latency", a.stream_get_latency);
  out.ok = ok;
  return out;
}

}  // namespace

const Api* api(std::string& error) {
  static std::once_flag once;
  static Loaded loaded;
  std::call_once(once, [] { loaded = load(); });
  if (!loaded.ok) {
    error = loaded.error;
    return nullptr;
  }
  return &loaded.api;
}

}  // namespace fluideq_linux::pa

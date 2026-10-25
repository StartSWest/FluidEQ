/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "pw_api.h"

#include <dlfcn.h>

#include <cstdio>
#include <mutex>

namespace fluideq_linux {

namespace {

struct Loaded {
  PwApi api{};
  bool ok = false;
  std::string error;
};

template <typename Fn>
bool bind(void* library, const char* name, Fn& slot, std::string& error) {
  void* symbol = dlsym(library, name);
  if (symbol == nullptr) {
    error = std::string("PipeWire library has no ") + name;
    return false;
  }
  // POSIX guarantees a data pointer from dlsym converts to a function
  // pointer; the cast is the documented way to spell it.
  slot = reinterpret_cast<Fn>(symbol);
  return true;
}

/** "1.6.2" → 10602; anything unreadable as 0, which is the oldest. */
unsigned version_number(const char* text) {
  unsigned major = 0;
  unsigned minor = 0;
  unsigned micro = 0;
  if (text == nullptr ||
      std::sscanf(text, "%u.%u.%u", &major, &minor, &micro) < 2) {
    return 0;
  }
  return major * 10000 + minor * 100 + micro;
}

Loaded load() {
  Loaded out;
  // Never unloaded: PipeWire keeps threads and module handles of its own,
  // and `dlclose` under them is a crash at exit.
  void* library = dlopen("libpipewire-0.3.so.0", RTLD_NOW | RTLD_LOCAL);
  if (library == nullptr) {
    const char* why = dlerror();
    out.error = std::string("PipeWire is not installed (") +
                (why != nullptr ? why : "libpipewire-0.3.so.0 not found") + ")";
    return out;
  }
  PwApi& api = out.api;
  std::string& error = out.error;
  const bool bound =
      bind(library, "pw_init", api.init, error) &&
      bind(library, "pw_get_library_version", api.get_library_version, error) &&
      bind(library, "pw_thread_loop_new", api.thread_loop_new, error) &&
      bind(library, "pw_thread_loop_destroy", api.thread_loop_destroy, error) &&
      bind(library, "pw_thread_loop_start", api.thread_loop_start, error) &&
      bind(library, "pw_thread_loop_stop", api.thread_loop_stop, error) &&
      bind(library, "pw_thread_loop_lock", api.thread_loop_lock, error) &&
      bind(library, "pw_thread_loop_unlock", api.thread_loop_unlock, error) &&
      bind(library, "pw_thread_loop_signal", api.thread_loop_signal, error) &&
      bind(library, "pw_thread_loop_wait", api.thread_loop_wait, error) &&
      bind(library, "pw_thread_loop_get_loop", api.thread_loop_get_loop, error) &&
      bind(library, "pw_context_new", api.context_new, error) &&
      bind(library, "pw_context_destroy", api.context_destroy, error) &&
      bind(library, "pw_context_connect", api.context_connect, error) &&
      bind(library, "pw_context_get_data_loop", api.context_get_data_loop, error) &&
      bind(library, "pw_data_loop_get_loop", api.data_loop_get_loop, error) &&
      bind(library, "pw_core_disconnect", api.core_disconnect, error) &&
      bind(library, "pw_properties_new", api.properties_new, error) &&
      bind(library, "pw_properties_set", api.properties_set, error) &&
      bind(library, "pw_stream_new", api.stream_new, error) &&
      bind(library, "pw_stream_add_listener", api.stream_add_listener, error) &&
      bind(library, "pw_stream_connect", api.stream_connect, error) &&
      bind(library, "pw_stream_disconnect", api.stream_disconnect, error) &&
      bind(library, "pw_stream_destroy", api.stream_destroy, error) &&
      bind(library, "pw_stream_dequeue_buffer", api.stream_dequeue_buffer, error) &&
      bind(library, "pw_stream_queue_buffer", api.stream_queue_buffer, error) &&
      bind(library, "pw_stream_trigger_process", api.stream_trigger_process, error) &&
      bind(library, "pw_stream_update_params", api.stream_update_params, error) &&
      bind(library, "pw_stream_set_active", api.stream_set_active, error) &&
      bind(library, "pw_stream_get_node_id", api.stream_get_node_id, error) &&
      bind(library, "pw_stream_set_control", api.stream_set_control, error) &&
      bind(library, "pw_proxy_destroy", api.proxy_destroy, error);
  if (!bound) return out;
  api.init(nullptr, nullptr);
  api.has_requested = version_number(api.get_library_version()) >= 349;
  out.ok = true;
  return out;
}

}  // namespace

const PwApi* pw_api(std::string& error) {
  static std::once_flag once;
  static Loaded loaded;
  std::call_once(once, [] { loaded = load(); });
  if (!loaded.ok) {
    error = loaded.error;
    return nullptr;
  }
  return &loaded.api;
}

}  // namespace fluideq_linux

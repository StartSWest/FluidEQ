/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * PipeWire, opened at run time rather than linked.
 *
 * One binary has to start on any distribution — Ubuntu, Debian, Fedora,
 * Arch, whatever — and a linked `libpipewire-0.3.so.0` makes the dynamic
 * loader refuse to start the process at all on a machine without it, before
 * a line of ours runs and with nothing in the app's log to say why. Opened
 * here instead, a machine without PipeWire gets a sentence from `pw_api`
 * and the caller decides what to do about it (the engine falls back to
 * PulseAudio, the DSP host to ALSA).
 *
 * The headers are only declarations: every exported function is called
 * through this table, and nothing links against the library, so a direct
 * call that slipped in fails the link by name. The SPA helpers the headers
 * define inline (format builders, the registry and metadata methods,
 * `pw_loop_invoke`) go through the objects' own method tables and need no
 * symbol at all.
 *
 * Every function used here is in PipeWire 0.3.x and every 1.x; the newest,
 * `pw_stream_trigger_process`, is from 0.3.34 (2021).
 */
#ifndef FLUIDEQ_LINUX_PW_API_H
#define FLUIDEQ_LINUX_PW_API_H

#include <pipewire/pipewire.h>

#include <string>

namespace fluideq_linux {

struct PwApi {
  void (*init)(int* argc, char** argv[]);
  const char* (*get_library_version)();
  pw_thread_loop* (*thread_loop_new)(const char* name, const spa_dict* props);
  void (*thread_loop_destroy)(pw_thread_loop* loop);
  int (*thread_loop_start)(pw_thread_loop* loop);
  void (*thread_loop_stop)(pw_thread_loop* loop);
  void (*thread_loop_lock)(pw_thread_loop* loop);
  void (*thread_loop_unlock)(pw_thread_loop* loop);
  void (*thread_loop_signal)(pw_thread_loop* loop, bool wait_for_accept);
  void (*thread_loop_wait)(pw_thread_loop* loop);
  pw_loop* (*thread_loop_get_loop)(pw_thread_loop* loop);
  pw_context* (*context_new)(pw_loop* main_loop, pw_properties* props,
                             size_t user_data_size);
  void (*context_destroy)(pw_context* context);
  pw_core* (*context_connect)(pw_context* context, pw_properties* props,
                              size_t user_data_size);
  pw_data_loop* (*context_get_data_loop)(pw_context* context);
  pw_loop* (*data_loop_get_loop)(pw_data_loop* loop);
  int (*core_disconnect)(pw_core* core);
  pw_properties* (*properties_new)(const char* key, ...);
  int (*properties_set)(pw_properties* props, const char* key,
                        const char* value);
  pw_stream* (*stream_new)(pw_core* core, const char* name,
                           pw_properties* props);
  void (*stream_add_listener)(pw_stream* stream, spa_hook* listener,
                              const pw_stream_events* events, void* data);
  int (*stream_connect)(pw_stream* stream, enum pw_direction direction,
                        uint32_t target_id, enum pw_stream_flags flags,
                        const spa_pod** params, uint32_t n_params);
  int (*stream_disconnect)(pw_stream* stream);
  void (*stream_destroy)(pw_stream* stream);
  pw_buffer* (*stream_dequeue_buffer)(pw_stream* stream);
  int (*stream_queue_buffer)(pw_stream* stream, pw_buffer* buffer);
  int (*stream_trigger_process)(pw_stream* stream);
  int (*stream_set_active)(pw_stream* stream, bool active);
  int (*stream_update_params)(pw_stream* stream, const spa_pod** params,
                              uint32_t n_params);
  uint32_t (*stream_get_node_id)(pw_stream* stream);
  void (*proxy_destroy)(pw_proxy* proxy);

  /** `pw_buffer::requested` exists from 0.3.49; reading it earlier is past the end. */
  bool has_requested = false;
};

/**
 * The table, loaded and `pw_init`ed on first use; null with `error` set when
 * this machine has no usable PipeWire client library. Thread-safe.
 */
const PwApi* pw_api(std::string& error);

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_PW_API_H

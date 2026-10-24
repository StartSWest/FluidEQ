/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * PulseAudio's client library, opened at run time and declared here by hand.
 *
 * The engine's fallback for desktops where PipeWire does not run (Ubuntu
 * 22.04, Debian 11, Mint 21 and their kind); the volume helper also uses
 * this API on pipewire-pulse, alongside the desktop's own mixer controls.
 * Declared rather than included because the declarations are
 * PulseAudio's frozen 0.9-era ABI — every struct below is the leading part
 * of the library's own, in its own order, and every enum value is fixed by
 * its protocol — and because a build machine should not need a header
 * package for a library the user's machine may not have at all.
 *
 * Only leading fields are declared for the info structs the library
 * allocates and hands back (`pa_sink_info` and friends): they are read
 * through pointers and never sized or copied here, so a newer library with
 * fields added at the end reads the same.
 */
#ifndef FLUIDEQ_LINUX_PA_API_H
#define FLUIDEQ_LINUX_PA_API_H

#include <cstddef>
#include <cstdint>
#include <string>

namespace fluideq_linux::pa {

struct mainloop;  // pa_threaded_mainloop
struct mainloop_api;
struct context;
struct stream;
struct operation;
struct proplist;

using usec_t = uint64_t;

constexpr int kSampleFloat32Le = 5;
constexpr int kChannelsMax = 32;

struct sample_spec {
  int format;
  uint32_t rate;
  uint8_t channels;
};

struct channel_map {
  uint8_t channels;
  int map[kChannelsMax];
};

struct buffer_attr {
  uint32_t maxlength;
  uint32_t tlength;
  uint32_t prebuf;
  uint32_t minreq;
  uint32_t fragsize;
};

struct cvolume {
  uint8_t channels;
  uint32_t values[kChannelsMax];
};

struct server_info {
  const char* user_name;
  const char* host_name;
  const char* server_version;
  const char* server_name;
  sample_spec spec;
  const char* default_sink_name;
  const char* default_source_name;
};

struct sink_info {
  const char* name;
  uint32_t index;
  const char* description;
  sample_spec spec;
  channel_map map;
  uint32_t owner_module;
  cvolume volume;
  int mute;
};

struct sink_input_info {
  uint32_t index;
  const char* name;
  uint32_t owner_module;
  uint32_t client;
  uint32_t sink;
};

// Channel positions (pa_channel_position_t).
enum : int {
  kMono = 0, kFrontLeft = 1, kFrontRight = 2, kFrontCenter = 3,
  kRearCenter = 4, kRearLeft = 5, kRearRight = 6, kLfe = 7,
  kFrontLeftOfCenter = 8, kFrontRightOfCenter = 9, kSideLeft = 10,
  kSideRight = 11, kAux0 = 12, kTopCenter = 44, kTopFrontLeft = 45,
  kTopFrontRight = 46, kTopFrontCenter = 47, kTopRearLeft = 48,
  kTopRearRight = 49, kTopRearCenter = 50,
};

// pa_context_state_t / pa_stream_state_t.
constexpr int kContextReady = 4;
constexpr int kContextFailed = 5;
constexpr int kContextTerminated = 6;
constexpr int kStreamReady = 2;
constexpr int kStreamFailed = 3;
constexpr int kStreamTerminated = 4;

// pa_context_flags_t / pa_stream_flags_t / pa_seek_mode_t.
constexpr int kNoAutospawn = 0x1;
constexpr int kStreamInterpolateTiming = 0x2;
constexpr int kStreamAutoTimingUpdate = 0x8;
constexpr int kStreamVariableRate = 0x400;
constexpr int kStreamAdjustLatency = 0x2000;
constexpr int kStreamStartUnmuted = 0x10000;
constexpr int kSeekRelative = 0;

// pa_subscription_mask_t and the facility/type bits of an event.
constexpr int kSubscribeSink = 0x1;
constexpr int kSubscribeSinkInput = 0x4;
constexpr int kSubscribeServer = 0x80;
constexpr int kEventFacilityMask = 0x0F;
constexpr int kEventSink = 0x0;
constexpr int kEventSinkInput = 0x2;
constexpr int kEventServer = 0x7;

using context_notify_cb = void (*)(context*, void*);
using context_success_cb = void (*)(context*, int, void*);
using context_subscribe_cb = void (*)(context*, int, uint32_t, void*);
using context_index_cb = void (*)(context*, uint32_t, void*);
using server_info_cb = void (*)(context*, const server_info*, void*);
using sink_info_cb = void (*)(context*, const sink_info*, int, void*);
using sink_input_info_cb = void (*)(context*, const sink_input_info*, int, void*);
using stream_request_cb = void (*)(stream*, size_t, void*);
using stream_notify_cb = void (*)(stream*, void*);
using stream_success_cb = void (*)(stream*, int, void*);
using free_cb = void (*)(void*);

struct Api {
  mainloop* (*mainloop_new)();
  void (*mainloop_free)(mainloop*);
  int (*mainloop_start)(mainloop*);
  void (*mainloop_stop)(mainloop*);
  void (*mainloop_lock)(mainloop*);
  void (*mainloop_unlock)(mainloop*);
  void (*mainloop_wait)(mainloop*);
  void (*mainloop_signal)(mainloop*, int wait_for_accept);
  mainloop_api* (*mainloop_get_api)(mainloop*);

  context* (*context_new)(mainloop_api*, const char* name);
  void (*context_unref)(context*);
  int (*context_connect)(context*, const char* server, int flags,
                         const void* spawn_api);
  void (*context_disconnect)(context*);
  void (*context_set_state_callback)(context*, context_notify_cb, void*);
  int (*context_get_state)(context*);
  uint32_t (*context_get_index)(context*);
  void (*context_set_subscribe_callback)(context*, context_subscribe_cb, void*);
  operation* (*context_subscribe)(context*, int mask, context_success_cb, void*);
  operation* (*context_get_server_info)(context*, server_info_cb, void*);
  operation* (*context_get_sink_info_list)(context*, sink_info_cb, void*);
  operation* (*context_get_sink_info_by_name)(context*, const char*,
                                              sink_info_cb, void*);
  operation* (*context_set_sink_volume_by_index)(context*, uint32_t,
                                                 const cvolume*,
                                                 context_success_cb, void*);
  operation* (*context_set_sink_mute_by_index)(context*, uint32_t, int,
                                               context_success_cb, void*);
  cvolume* (*cvolume_scale)(cvolume*, uint32_t);
  operation* (*context_get_sink_input_info_list)(context*, sink_input_info_cb,
                                                 void*);
  operation* (*context_set_sink_input_volume)(context*, uint32_t,
                                              const cvolume*,
                                              context_success_cb, void*);
  operation* (*context_set_sink_input_mute)(context*, uint32_t, int,
                                            context_success_cb, void*);
  operation* (*context_load_module)(context*, const char* name,
                                    const char* argument, context_index_cb,
                                    void*);
  operation* (*context_unload_module)(context*, uint32_t index,
                                      context_success_cb, void*);
  operation* (*context_set_default_sink)(context*, const char* name,
                                         context_success_cb, void*);
  operation* (*context_move_sink_input_by_name)(context*, uint32_t index,
                                                const char* sink_name,
                                                context_success_cb, void*);
  int (*context_errno)(context*);
  const char* (*strerror)(int);
  void (*operation_unref)(operation*);
  int (*operation_get_state)(operation*);

  stream* (*stream_new)(context*, const char* name, const sample_spec*,
                        const channel_map*);
  void (*stream_unref)(stream*);
  int (*stream_set_monitor_stream)(stream*, uint32_t);
  int (*stream_connect_record)(stream*, const char* device, const buffer_attr*,
                               int flags);
  int (*stream_connect_playback)(stream*, const char* device,
                                 const buffer_attr*, int flags,
                                 const cvolume*, stream* sync);
  int (*stream_disconnect)(stream*);
  int (*stream_peek)(stream*, const void** data, size_t* bytes);
  int (*stream_drop)(stream*);
  int (*stream_write)(stream*, const void* data, size_t bytes, free_cb,
                      int64_t offset, int seek);
  void (*stream_set_read_callback)(stream*, stream_request_cb, void*);
  void (*stream_set_state_callback)(stream*, stream_notify_cb, void*);
  void (*stream_set_underflow_callback)(stream*, stream_notify_cb, void*);
  int (*stream_get_state)(stream*);
  uint32_t (*stream_get_index)(stream*);
  operation* (*stream_update_sample_rate)(stream*, uint32_t rate,
                                          stream_success_cb, void*);
  int (*stream_get_latency)(stream*, usec_t* latency, int* negative);
};

/** pa_operation_state_t: still waiting for the server's answer. */
constexpr int kOperationRunning = 0;

/** Loaded once; null with `error` set when libpulse.so.0 is not there. */
const Api* api(std::string& error);

}  // namespace fluideq_linux::pa

#endif  // FLUIDEQ_LINUX_PA_API_H

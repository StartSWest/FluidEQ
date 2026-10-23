/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The FluidEQ Engine's place in PipeWire.
 *
 * Windows puts the engine inside every output's own effect chain. PipeWire
 * has no such slot for a separate program, so the engine is an output of its
 * own — a sink named "FluidEQ" that every application plays into — and a
 * playback stream from it to the real output the listener chose. Both are
 * one `node.group`, so PipeWire runs them in the same cycle off the real
 * output's clock: no second clock, no drift, no resampling of our own, and
 * the delay is the graph's, not a buffer's.
 *
 * The output the listener chose is followed, not fixed. Picking another
 * output in the desktop's sound settings makes that output the configured
 * default; the router moves its playback there (that output's profile then
 * applies, by its own id) and makes "FluidEQ" the default again, so every
 * application keeps going through the EQ. On exit the chosen output is made
 * the default again, so nothing is left playing into a sink that is gone.
 *
 * Threads: everything here runs on PipeWire's own loop thread except the two
 * process callbacks, which run on its real-time data thread and touch only
 * the streams' buffers and the engine's `process`. Anything the data thread
 * reads is changed through `pw_loop_invoke` on the data loop, which returns
 * once the data thread has run it between two cycles.
 */
#ifndef FLUIDEQ_LINUX_PW_ROUTER_H
#define FLUIDEQ_LINUX_PW_ROUTER_H

#include <pipewire/extensions/metadata.h>
#include <pipewire/pipewire.h>

#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "../pipewire/pw_api.h"
#include "output_engine.h"
#include "outputs_file.h"
#include "router.h"

namespace fluideq_linux {

class PipeWireRouter final : public SoundRouter {
 public:
  /** Connects and starts PipeWire's loop thread; null with `error` set. */
  static std::unique_ptr<PipeWireRouter> create(const RouterOptions& options,
                                                std::string& error);
  ~PipeWireRouter() override;

  PipeWireRouter(const PipeWireRouter&) = delete;
  PipeWireRouter& operator=(const PipeWireRouter&) = delete;

  void shutdown() noexcept override;
  int lost_fd() const noexcept override { return lost_fd_; }

 private:
  struct Sink {
    uint32_t id = 0;
    std::string name;
    std::string description;
    int priority = 0;
    uint32_t channels = 0;
    std::vector<Speaker> positions;
    bool described = false;
    pw_proxy* proxy = nullptr;
    spa_hook listener{};
    PipeWireRouter* router = nullptr;
  };

  struct Stream {
    pw_stream* stream = nullptr;
    spa_hook listener{};
  };

  explicit PipeWireRouter(const PwApi& api, RouterOptions options);
  bool connect(std::string& error);

  // Registry, metadata and the choice of output (pw_router.cpp).
  static void on_global(void* data, uint32_t id, uint32_t permissions,
                        const char* type, uint32_t version,
                        const spa_dict* props);
  static void on_global_remove(void* data, uint32_t id);
  static void on_node_info(void* data, const pw_node_info* info);
  static int on_metadata_property(void* data, uint32_t subject, const char* key,
                                  const char* type, const char* value);
  static void on_core_done(void* data, uint32_t id, int seq);
  static void on_core_error(void* data, uint32_t id, int seq, int res,
                            const char* message);
  void forget_sink(uint32_t id);
  void choose_target();
  void claim_default();
  void set_configured_default(const std::string& name);
  void roundtrip();
  void write_outputs() noexcept;
  const Sink* sink_named(const std::string& name) const;

  // The two streams and the engine between them (pw_streams.cpp).
  static void on_capture_process(void* data);
  static void on_playback_process(void* data);
  static void on_capture_param(void* data, uint32_t id, const spa_pod* param);
  static void on_latency_event(void* data, uint64_t count);
  void report_latency();
  static void on_stream_state(void* data, pw_stream_state old,
                              pw_stream_state state, const char* error);
  void retarget(const Sink& sink);
  bool open_capture(const ChannelLayout& layout);
  bool open_playback(const Sink& sink, const ChannelLayout& layout);
  void close_stream(Stream& stream, bool playback) noexcept;
  void ensure_engine();
  void swap_engine(std::unique_ptr<OutputEngine> next) noexcept;
  void run_on_data_thread(void (*fn)(PipeWireRouter*, void*), void* arg) noexcept;
  void playback_cycle() noexcept;

  const PwApi& api_;
  const RouterOptions options_;
  pw_thread_loop* loop_ = nullptr;
  pw_context* context_ = nullptr;
  pw_core* core_ = nullptr;
  spa_hook core_listener_{};
  pw_registry* registry_ = nullptr;
  spa_hook registry_listener_{};
  pw_metadata* metadata_ = nullptr;
  spa_hook metadata_listener_{};
  uint32_t metadata_id_ = 0;
  pw_loop* data_loop_ = nullptr;
  int pending_seq_ = 0;
  bool synced_ = false;

  std::map<uint32_t, std::unique_ptr<Sink>> sinks_;
  /** Our own sink's global id, once PipeWire has announced it. */
  uint32_t own_sink_id_ = 0;
  bool own_sink_seen_ = false;
  std::string configured_default_;
  std::string effective_default_;
  /** The real output being played to, by node.name, and its layout. */
  std::string target_name_;
  ChannelLayout layout_{};
  /** Whether this engine set the configured default, and so owes it back. */
  bool default_taken_ = false;
  /**
   * The configured default when it was first taken, and the output played
   * to then. A machine with no configured default (PipeWire choosing by
   * priority) gets none back if the listener never picked another output,
   * rather than one pinned on their behalf.
   */
  std::string configured_before_;
  std::string target_at_claim_;

  Stream capture_;
  Stream playback_;
  uint32_t capture_rate_ = 0;
  uint32_t capture_channels_ = 0;
  // Read on the data thread; changed only through `run_on_data_thread`.
  pw_stream* rt_playback_ = nullptr;
  pw_stream* rt_capture_ = nullptr;
  OutputEngine* rt_engine_ = nullptr;
  uint32_t rt_channels_ = 0;
  std::unique_ptr<OutputEngine> engine_;

  bool shut_ = false;
  bool lost_ = false;
  int lost_fd_ = -1;
  // Signalled from a watcher thread when a graph with another delay is
  // published; handled on the loop thread (`report_latency`).
  spa_source* latency_event_ = nullptr;
  uint32_t latency_reported_ = UINT32_MAX;
  std::unique_ptr<fluideq_engine::Log> log_;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_PW_ROUTER_H

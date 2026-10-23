/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The FluidEQ Engine on a PulseAudio desktop.
 *
 * PulseAudio cannot run a client's code inside its graph, so the engine
 * loads a null sink named "FluidEQ" (`module-null-sink`), records what
 * applications play into it from its monitor, runs the engine over it and
 * plays the result to the real output. The null sink keeps its own time and
 * the output keeps the sound card's, so the two drift apart by a few samples
 * a second; the playback stream's rate is nudged by the backlog it holds
 * (PulseAudio's `VARIABLE_RATE`), as PulseAudio's own `module-loopback`
 * does, so the delay stays where it started instead of creeping for hours.
 *
 * The rest is the PipeWire router's behaviour: the listener's chosen output
 * is followed (picking another one makes it the default; the router plays
 * there and makes "FluidEQ" the default again, bringing the streams with
 * it), and on exit the chosen output is made the default and the streams go
 * back to it before the null sink is unloaded.
 *
 * Everything here runs on PulseAudio's mainloop thread, under its lock —
 * the record callback included, which is where the engine processes.
 */
#ifndef FLUIDEQ_LINUX_PULSE_ROUTER_H
#define FLUIDEQ_LINUX_PULSE_ROUTER_H

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "../pulse/pa_api.h"
#include "log.h"
#include "output_engine.h"
#include "outputs_file.h"
#include "router.h"

namespace fluideq_linux {

class PulseRouter final : public SoundRouter {
 public:
  /** Connects to the PulseAudio server; null with `error` set. */
  static std::unique_ptr<PulseRouter> create(const RouterOptions& options,
                                             std::string& error);
  ~PulseRouter() override;

  PulseRouter(const PulseRouter&) = delete;
  PulseRouter& operator=(const PulseRouter&) = delete;

  void shutdown() noexcept override;
  int lost_fd() const noexcept override { return lost_fd_; }

 private:
  struct Sink {
    uint32_t index = 0;
    std::string name;
    std::string description;
    uint32_t rate = 0;
    ChannelLayout layout{};
  };

  PulseRouter(const pa::Api& api, RouterOptions options);
  bool connect(std::string& error);
  /** Waits for `op` under the lock, then lets it go. */
  void wait(pa::operation* op);
  void release(pa::operation* op);

  static void on_context_state(pa::context* context, void* data);
  static void on_event(pa::context* context, int event, uint32_t index,
                       void* data);
  static void on_server_info(pa::context* context, const pa::server_info* info,
                             void* data);
  static void on_sink_info(pa::context* context, const pa::sink_info* info,
                           int eol, void* data);
  static void on_module_loaded(pa::context* context, uint32_t index, void* data);
  static void on_record_state(pa::stream* stream, void* data);
  static void on_playback_state(pa::stream* stream, void* data);
  static void on_read(pa::stream* stream, size_t bytes, void* data);
  static void on_rate_set(pa::stream* stream, int success, void* data);
  static void on_done(pa::context* context, int success, void* data);

  void refresh();
  void choose_target();
  void retarget(const Sink& sink);
  void load_sink(const Sink& sink);
  void open_record();
  bool open_playback(const Sink& sink);
  void close_streams() noexcept;
  void unload_sink() noexcept;
  void claim_default();
  void move_inputs(uint32_t from_sink, const std::string& to);
  void ensure_engine();
  void process(const float* interleaved, uint32_t frames);
  void follow_drift();
  void write_outputs() noexcept;
  const Sink* sink_named(const std::string& name) const;

  const pa::Api& api_;
  const RouterOptions options_;
  pa::mainloop* loop_ = nullptr;
  pa::context* context_ = nullptr;
  bool ready_ = false;
  bool shut_ = false;
  int lost_fd_ = -1;
  std::unique_ptr<fluideq_engine::Log> log_;

  // The server's picture, rebuilt whole on each refresh.
  std::string default_sink_;
  std::vector<Sink> sinks_;
  std::vector<Sink> collecting_;
  bool refreshing_ = false;
  bool refresh_again_ = false;
  uint32_t own_sink_index_ = UINT32_MAX;

  // What is playing where.
  std::string target_name_;
  uint32_t target_index_ = UINT32_MAX;
  uint32_t module_index_ = UINT32_MAX;
  uint32_t module_rate_ = 0;
  ChannelLayout module_layout_{};
  bool loading_ = false;
  pa::stream* record_ = nullptr;
  pa::stream* playback_ = nullptr;
  uint32_t rate_ = 0;
  ChannelLayout layout_{};
  bool default_taken_ = false;

  // The playback's rate as last set, the one it was opened at, and whether
  // a change is still on its way (one at a time).
  uint32_t playback_rate_ = 0;
  bool rate_pending_ = false;
  // The backlog the playback settled at, which the rate holds it to.
  uint32_t settle_count_ = 0;
  double mark_ms_ = 0.0;
  double average_ms_ = 0.0;
  int nudge_ = 0;  // -1 slow, 0 its own rate, +1 fast.
  // One move of streams at a time: from which sink, to which, and our own
  // playback, which never moves.
  uint32_t move_from_ = UINT32_MAX;
  uint32_t move_skip_ = UINT32_MAX;
  std::string move_to_;
  bool own_seen_ = false;
  uint64_t underflows_ = 0;
  uint64_t hole_frames_ = 0;
  // Frames gathered toward the next block (`process`).
  uint32_t pending_frames_ = 0;

  std::unique_ptr<OutputEngine> engine_;
  std::vector<float> planes_;
  std::vector<float> interleaved_;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_PULSE_ROUTER_H

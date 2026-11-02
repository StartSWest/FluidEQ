/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The Share Audio service's answer to main (`shareAudio/runtime.ts`): each
 * request run and answered, the link's and the players' events sent with
 * the telemetry's credit, the book of linked and unlinked computers kept
 * and told, and the sound routed — this computer's capture to every
 * computer it sends to, every other computer's sound to the player at its
 * own volume.
 */

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "main_wire.h"
#include "runtime_parts.h"
#include "share_ports.h"

namespace feq::share::service {

class ShareRuntime {
 public:
  struct Deps {
    std::function<void(WireMessage)> post;
    /** The service cannot go on (its event queue overflowed). */
    std::function<void()> on_fatal;
    bool scheduling = false;
    RuntimePorts ports;
  };

  explicit ShareRuntime(Deps deps);
  ~ShareRuntime();
  ShareRuntime(const ShareRuntime&) = delete;
  ShareRuntime& operator=(const ShareRuntime&) = delete;

  /** A request or a credit from main. */
  void handle(const WireMessage& message);

 private:
  using Answer = Future<std::optional<json::Value>>;

  Answer execute(const std::string& method, const json::Value& args,
                 const WireMessage& message);
  void event(WireMessage message);
  void event(json::Value json);
  std::shared_ptr<Lan> network();
  void link_signal(const json::Value& message);
  void arriving(const lan::AudioChunk& chunk);
  void captured(const lan::AudioChunk& chunk, const std::vector<int>& active);
  void fail_capture(const std::vector<int>& ids);
  void fail_player(const std::vector<int>& ids);
  void remove_from_player(const std::string& peer_id);
  Answer helper_lease();
  Answer helper_request(const json::Value& args, const WireMessage& message);
  void helper_pid_event();

  Deps deps_;
  AudioTelemetry telemetry_;
  AudioLevels levels_;
  std::map<std::string, double> receive_;
  std::map<std::string, bool> remote_sends_;
  std::map<std::string, bool> remote_plays_;
  std::set<std::string> streaming_;
  std::map<int, std::shared_ptr<HelperLease>> leases_;
  std::map<int, std::shared_ptr<std::map<std::uint32_t, std::uint32_t>>> aliases_;
  /** Unlinked computers, oldest first. */
  std::vector<std::string> revoked_;
  std::vector<json::Value> links_;
  std::vector<std::string> targets_;
  int next_id_ = 0;
  int playing_ = 0;
  std::shared_ptr<Lan> lan_;
  bool saved_book_loaded_ = false;
  SmoothLinks smooth_links_;
  LeasePool<std::shared_ptr<NetworkCapture>> captures_;
  LeasePool<std::shared_ptr<Playback>> players_;
  AudioPreview preview_;
  double last_meter_at_ = 0;
};

}  // namespace feq::share::service

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Every authenticated link, by peer id: `remoteAudioTransport.ts`. Packets
 * in are opened and handed on as control messages or sound; sound out goes
 * raw, at once, and a link whose sends pile up past what it may hold is
 * called stuck and closed. With it, `remoteAudioNetworkMeter.ts`.
 *
 * One difference, on purpose: the TypeScript decoded sound on Node's pool
 * and handed it on a turn later, so a control message that followed a
 * chunk in the same read could be handed on before that chunk. Here a
 * chunk is decoded where it is read, and everything leaves in the order it
 * came.
 */

#include <chrono>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>

#include "fluideq/share/json.h"
#include "fluideq/share/lan_protocol.h"
#include "websocket.h"

namespace feq::share::service {

namespace json = feq::share::json;
namespace lan = feq::share::lan;

/** `remoteAudioNetworkMeter.ts`: a report every quarter second per lane. */
class NetworkMeter {
 public:
  using Clock = std::chrono::steady_clock;

  explicit NetworkMeter(std::function<void(const json::Value&)> emit,
                        std::function<Clock::time_point()> now = Clock::now)
      : emit_(std::move(emit)), now_(std::move(now)) {}

  void record(const std::string& peer_id, const std::string& direction,
              double bytes, double queued_bytes,
              double queued_audio_milliseconds = 0);
  void clear() { windows_.clear(); }

 private:
  struct Window {
    double bytes = 0;
    Clock::time_point started_at;
  };
  std::function<void(const json::Value&)> emit_;
  std::function<Clock::time_point()> now_;
  std::map<std::string, Window> windows_;
};

class LanTransport {
 public:
  struct Options {
    std::function<void(const lan::AudioChunk&)> emit_audio;
    std::function<void(const json::Value&)> emit_network;
    std::function<void(const json::Value&)> emit_signal;
  };

  explicit LanTransport(Options options);
  /** Every link's listeners go with it: none may outlive what they call. */
  ~LanTransport() { close_all(); }
  LanTransport(const LanTransport&) = delete;
  LanTransport& operator=(const LanTransport&) = delete;

  /**
   * `computer` names the machine at the other end; a link from the same
   * machine still open is the dead one and is ended (see the TypeScript).
   */
  void attach(const std::string& peer_id,
              const std::shared_ptr<WebSocket>& socket, const lan::Key& key,
              const std::optional<std::string>& computer = std::nullopt);
  /** Ends one link; its close announces it gone like any other. */
  void close(const std::string& peer_id);
  void close_all();
  bool has(const std::string& peer_id) const {
    return sockets_.contains(peer_id);
  }
  /** Throws `LinkError` for a chunk that is not one, or a link not open. */
  void send_audio(const lan::AudioChunk& chunk);
  /** Throws `LinkError` for a link not open. */
  void send_signal(const json::Value& message);
  /** Sending is always raw; music only lets more wait in it. */
  void set_stream_mode(const std::string& peer_id, bool music);
  std::size_t size() const { return sockets_.size(); }

 private:
  struct Connection {
    lan::Key key;
    std::shared_ptr<WebSocket> socket;
    std::optional<std::string> computer;
  };

  void received(const std::string& peer_id,
                const std::shared_ptr<WebSocket>& socket, const lan::Key& key,
                const Bytes& data);
  void closed(const std::string& peer_id,
              const std::shared_ptr<WebSocket>& socket);

  Options options_;
  std::map<std::string, Connection> sockets_;
  NetworkMeter meter_;
  std::set<std::string> smooth_;
  bool stopping_ = false;
};

}  // namespace feq::share::service

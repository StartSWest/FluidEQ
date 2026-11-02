/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Share Audio's network (`remoteAudioLan.ts`): this computer listening on
 * its own code, and joined to every computer whose code was pasted here,
 * all at once. Every computer is a listener and a joiner at the same time;
 * the code a computer shows is its own and never changes, and unlinking one
 * computer leaves every other link alone.
 *
 * Local certificates cannot prove which PC created them, so the WebSocket
 * is plain `ws://` and every packet inside it is authenticated and
 * encrypted with AES-256-GCM using the pairing secret.
 */

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>

#include "fluideq/share/json.h"
#include "fluideq/share/lan_protocol.h"
#include "lan_book.h"
#include "lan_group.h"
#include "lan_joins.h"
#include "lan_transport.h"
#include "io.h"
#include "share_ports.h"
#include "udp.h"
#include "websocket.h"

namespace feq::share::service {

class RemoteAudioLan : public Lan,
                       public std::enable_shared_from_this<RemoteAudioLan> {
 public:
  RemoteAudioLan(LanEvents events, LinkBook book);
  ~RemoteAudioLan() override;
  RemoteAudioLan(const RemoteAudioLan&) = delete;
  RemoteAudioLan& operator=(const RemoteAudioLan&) = delete;

  /** Listens on this computer's code; the same session if it already is. */
  Future<json::Value> start(
      const std::optional<HostCredentials>& credentials) override;
  /** Throws `LinkError` on a code that is not one, or is this computer's. */
  void join(const json::Value& code, bool fresh) override;
  void unlink(const std::optional<std::string>& peer_id,
              const std::optional<std::string>& computer_id) override;
  Future<bool> reconnect(const std::optional<std::string>& peer_id,
                         const std::optional<std::string>& computer_id) override;
  void retry() override;
  /** Throws `LinkError` for a message that is not one, or a link not open. */
  void send_signal(const json::Value& message) override;
  void send_audio(const lan::AudioChunk& chunk) override;
  void set_stream_mode(const std::string& peer_id, bool music) override;
  void stop() override;

 private:
  struct Peer {
    std::optional<std::string> computer_id;
    bool joined = false;
  };

  std::string own_id() const;
  void forget_peer(const std::string& peer_id);
  void restore_group_link(const json::Value& link);
  void transport_signal(const json::Value& message);
  void joins_signal(const json::Value& message);
  void ask_who_is_there(const std::string& secret);
  void ask_round(const std::shared_ptr<UdpSocket>& socket,
                 const std::vector<std::uint8_t>& query, int asked);
  void announce_self();
  void send_to_each(const std::shared_ptr<UdpSocket>& socket,
                    std::vector<std::uint8_t> data,
                    std::vector<std::string> targets,
                    std::function<void()> done);
  json::Value describe(const HostCredentials& credentials) const;
  std::optional<int> admit(const std::optional<std::string>& computer_id,
                           bool fresh);
  std::vector<std::string> links_of(const std::optional<std::string>& peer_id,
                                    const std::optional<std::string>& computer_id);
  void heard_on_discovery(std::span<const std::uint8_t> data,
                          const std::string& address, int port);

  LanEvents events_;
  LinkBook book_;
  std::unique_ptr<LanTransport> transport_;
  std::shared_ptr<LanJoins> joins_;
  std::unique_ptr<LanGroup> group_;
  std::shared_ptr<WebSocketServer> server_;
  std::shared_ptr<UdpSocket> discovery_socket_;
  std::optional<HostCredentials> session_;
  int lifecycle_generation_ = 0;
  std::map<std::string, json::Value> announced_;
  std::map<std::string, Peer> peers_;
  /** Connections from each computer to this one, while they are open. */
  std::map<std::string, std::shared_ptr<std::set<std::shared_ptr<WebSocket>>>>
      inbound_;
};

/** `os.hostname().trim() || 'FluidEQ'`. */
std::string device_name_of();

}  // namespace feq::share::service

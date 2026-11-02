/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The listening half of `lan.h`: the session this computer's code names,
// who is let in, and the answers to "who is there?".

#include <array>

#include "fluideq/share/crypto.h"
#include "fluideq/share/discovery.h"
#include "lan.h"
#include "lan_internal.h"
#include "lan_join.h"
#include "lan_peers.h"

namespace feq::share::service {

using lan_detail::lan_addresses;
using lan_detail::signal_message;
using lan_detail::text_at;

json::Value RemoteAudioLan::describe(const HostCredentials& credentials) const {
  const auto addresses = lan_addresses();
  const std::string device_name = device_name_of();
  json::Value details = json::Value::object({
      {"deviceName", json::Value::string(device_name)},
      {"computerId", json::Value::string(lan::computer_id_of(credentials.secret))},
  });
  if (!addresses.empty()) {
    details.set("code", json::Value::string(lan::encode_pairing_code(
                            addresses, credentials.port, credentials.secret,
                            device_name)));
  }
  return json::Value::object({
      {"credentials", json::Value::object({
                          {"port", json::Value::number(credentials.port)},
                          {"secret", json::Value::string(credentials.secret)},
                      })},
      {"details", std::move(details)},
  });
}

std::optional<int> RemoteAudioLan::admit(
    const std::optional<std::string>& computer_id, bool fresh) {
  if (!computer_id) {
    return std::nullopt;
  }
  if (*computer_id == own_id()) {
    return 1008;
  }
  if (book_.is_revoked(*computer_id)) {
    if (!fresh) {
      return kCloseForget;
    }
    book_.unrevoke(*computer_id);
  }
  return joins_->inbound_arrived(*computer_id)
             ? std::nullopt
             : std::optional<int>(kCloseAlreadyLinked);
}

void RemoteAudioLan::heard_on_discovery(std::span<const std::uint8_t> data,
                                        const std::string& address, int port) {
  if (!session_ || !discovery_socket_) {
    return;
  }
  std::optional<std::string> discovered;
  if (discovery::is_query(data, session_->secret)) {
    discovered = session_->secret;
  } else {
    for (const auto& link : book_.group_links()) {
      const std::string secret = text_at(link, "secret");
      if (discovery::is_query(data, secret)) {
        discovered = secret;
        break;
      }
    }
  }
  if (discovered) {
    discovery_socket_->send(discovery::encode_announcement(
                                *discovered, session_->port, device_name_of()),
                            port, address);
    return;
  }
  joins_->heard(data, address);
}

Future<json::Value> RemoteAudioLan::start(
    const std::optional<HostCredentials>& credentials) {
  if (session_ && server_ &&
      (!credentials || credentials->secret == session_->secret)) {
    // Already listening on this code: the links stay up, and the code is
    // made again from the addresses this computer has now.
    return Future<json::Value>::resolved(describe(*session_));
  }
  stop();
  const int operation = lifecycle_generation_;
  std::string secret;
  if (credentials) {
    secret = credentials->secret;
  } else {
    std::array<std::uint8_t, 32> bytes{};
    crypto::random_bytes(bytes);
    secret = crypto::base64url(bytes);
  }
  auto listening = WebSocketServer::listen(
      "0.0.0.0", credentials ? credentials->port : 0, lan::kMaxPacketBytes);
  if (listening.index() == 1) {
    if (lifecycle_generation_ == operation) {
      stop();
    }
    return Future<json::Value>::rejected(std::get<1>(listening));
  }
  const auto next_server = std::get<0>(listening);
  server_ = next_server;
  std::weak_ptr<RemoteAudioLan> weak = shared_from_this();
  PeersDeps peers;
  peers.current = [weak, operation, next_server] {
    const auto self = weak.lock();
    return self && self->lifecycle_generation_ == operation &&
           self->server_ == next_server;
  };
  peers.pairing_key = lan::key_from_secret(secret);
  peers.book = book_;
  peers.admit = [weak](const std::optional<std::string>& computer_id,
                       bool fresh) -> std::optional<int> {
    const auto self = weak.lock();
    return self ? self->admit(computer_id, fresh) : std::optional<int>(1008);
  };
  peers.arriving = [weak](const std::string& computer_id,
                          const std::shared_ptr<WebSocket>& candidate) {
    const auto self = weak.lock();
    if (!self) {
      return;
    }
    auto& open = self->inbound_[computer_id];
    if (!open) {
      open = std::make_shared<std::set<std::shared_ptr<WebSocket>>>();
    }
    open->insert(candidate);
    const auto set = open;
    std::weak_ptr<WebSocket> weak_candidate = candidate;
    candidate->on_close.once([weak, set, computer_id, weak_candidate](int) {
      const auto alive = weak.lock();
      if (const auto gone = weak_candidate.lock()) {
        set->erase(gone);
      }
      if (!alive || !set->empty()) {
        return;
      }
      const auto found = alive->inbound_.find(computer_id);
      if (found != alive->inbound_.end() && found->second == set) {
        alive->inbound_.erase(found);
        alive->joins_->inbound_closed(computer_id);
      }
    });
  };
  peers.ready = [weak](const std::shared_ptr<WebSocket>& candidate,
                       const lan::Key& session_key,
                       const lan::AuthReady& message,
                       const std::string& address, bool introduced) {
    const auto self = weak.lock();
    if (!self) {
      return;
    }
    const std::optional<std::string> computer_id =
        message.computer_id && !message.computer_id->empty()
            ? message.computer_id
            : std::nullopt;
    self->transport_->attach(
        message.peer_id, candidate, session_key,
        computer_id ? "in:" + *computer_id
                    : address + "\n" + message.device_name);
    self->peers_[message.peer_id] = Peer{computer_id, false};
    json::Value signal = json::Value::object({
        {"kind", json::Value::string("peer-ready")},
        {"address", json::Value::string(address)},
        {"deviceName", json::Value::string(message.device_name)},
    });
    if (computer_id) {
      signal.set("computerId", json::Value::string(*computer_id));
    }
    if (introduced) {
      signal.set("introduced", json::Value::boolean(true));
    }
    self->events_.emit_signal(signal_message(message.peer_id, std::move(signal)));
    self->group_->connected(message.peer_id, computer_id);
  };
  register_lan_peers(next_server, std::move(peers));
  next_server->on_error.on([weak, next_server](const Failure&) {
    const auto self = weak.lock();
    if (self && self->server_ == next_server) {
      self->stop();
      self->events_.emit_error();
    }
  });
  next_server->start();
  const int port = next_server->port();

  auto bound = UdpSocket::bind(discovery::kPort);
  if (bound.index() == 1) {
    if (lifecycle_generation_ == operation) {
      stop();
    }
    return Future<json::Value>::rejected(std::get<1>(bound));
  }
  const auto next_discovery = std::get<0>(bound);
  discovery_socket_ = next_discovery;
  next_discovery->set_broadcast(true);
  next_discovery->start([weak](std::span<const std::uint8_t> data,
                               const std::string& address, int from_port) {
    if (const auto self = weak.lock()) {
      self->heard_on_discovery(data, address, from_port);
    }
  });
  session_ = HostCredentials{port, secret};
  for (const auto& link : book_.group_links()) {
    restore_group_link(link);
  }
  announce_self();
  return Future<json::Value>::resolved(describe(*session_));
}

}  // namespace feq::share::service

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan.h"

#include <algorithm>

#include "fluideq/share/discovery.h"
#include "fluideq/share/signals.h"
#include "lan_internal.h"
#include "lan_join.h"
#include "link_error.h"

namespace feq::share::service {
namespace {

/**
 * How many times the network is asked who is there, each sent once the
 * last has left the socket. A datagram can be dropped; a computer that comes
 * up later announces itself and is heard without being asked again.
 */
constexpr int kDiscoveryQueries = 3;

}  // namespace

using lan_detail::discovery_targets;
using lan_detail::lan_addresses;
using lan_detail::signal_message;
using lan_detail::strings;
using lan_detail::text_at;

std::string device_name_of() {
  const std::string name = json::trim(host_name());
  return name.empty() ? "FluidEQ" : name;
}

RemoteAudioLan::RemoteAudioLan(LanEvents events, LinkBook book)
    : events_(std::move(events)), book_(std::move(book)) {
  transport_ = std::make_unique<LanTransport>(LanTransport::Options{
      [this](const lan::AudioChunk& chunk) { events_.emit_audio(chunk); },
      [this](const json::Value& stats) { events_.emit_network(stats); },
      [this](const json::Value& message) { transport_signal(message); }});
  joins_ = std::make_shared<LanJoins>(LanJoins::Deps{
      [this](const std::string& peer_id,
             const std::shared_ptr<WebSocket>& socket, const lan::Key& key) {
        transport_->attach(peer_id, socket, key);
      },
      [this](const json::Value& message) { joins_signal(message); },
      [this] { return std::make_pair(own_id(), device_name_of()); },
      [this](const std::string& secret) { ask_who_is_there(secret); },
      [this](const std::string& computer_id) {
        const auto found = inbound_.find(computer_id);
        return found != inbound_.end() && !found->second->empty();
      }});
  group_ = std::make_unique<LanGroup>(GroupDeps{
      [this]() -> std::optional<GroupSelf> {
        if (!session_) {
          return std::nullopt;
        }
        return GroupSelf{
            json::Value::object({
                {"computerId", json::Value::string(own_id())},
                {"deviceName", json::Value::string(device_name_of())},
                {"addresses", strings(lan_addresses())},
                {"port", json::Value::number(session_->port)},
            }),
            session_->secret};
      },
      [this] { return book_.group_links(); },
      [this] {
        std::vector<std::string> known;
        for (const auto& link : book_.group_links()) {
          known.push_back(text_at(link, "computerId"));
        }
        return known;
      },
      [this](const std::string& id) { return book_.is_revoked(id); },
      [this](const json::Value& link) { book_.save_group_link(link); },
      [this](const json::Value& link) { restore_group_link(link); },
      [this](const json::Value& message) {
        // Repeat the current duplex description with the group handshake.
        // A capability-only stream-mode would replace the replay snapshot
        // and could lose Receive/Send state after a renderer reload.
        const json::Value* signal = message.get("signal");
        const auto previous = announced_.find(text_at(message, "peerId"));
        if (signal != nullptr && text_at(*signal, "kind") == "stream-mode" &&
            previous != announced_.end()) {
          json::Value replaced = *signal;
          if (const json::Value* mode = previous->second.get("mode")) {
            replaced.set("mode", *mode);
          }
          if (const json::Value* duplex = previous->second.get("duplex")) {
            replaced.set("duplex", *duplex);
          } else {
            replaced.erase("duplex");
          }
          json::Value sent = message;
          sent.set("signal", std::move(replaced));
          transport_->send_signal(sent);
          return;
        }
        transport_->send_signal(message);
      }});
}

RemoteAudioLan::~RemoteAudioLan() { stop(); }

std::string RemoteAudioLan::own_id() const {
  return session_ ? lan::computer_id_of(session_->secret) : std::string();
}

void RemoteAudioLan::forget_peer(const std::string& peer_id) {
  peers_.erase(peer_id);
  announced_.erase(peer_id);
  group_->disconnected(peer_id);
}

void RemoteAudioLan::restore_group_link(const json::Value& link) {
  const std::string computer_id = text_at(link, "computerId");
  if (book_.is_revoked(computer_id)) {
    return;
  }
  JoinPairing pairing;
  pairing.computer_id = computer_id;
  const json::Value* introduced = link.get("introduced");
  pairing.introduced =
      introduced != nullptr && introduced->is_bool() && introduced->as_bool();
  if (const json::Value* addresses = link.get("addresses");
      addresses != nullptr && addresses->is_array()) {
    for (const auto& address : addresses->items()) {
      if (address.is_string()) {
        pairing.addresses.push_back(address.as_string());
      }
    }
  }
  pairing.address = pairing.addresses.empty() ? "" : pairing.addresses[0];
  pairing.device_name = text_at(link, "deviceName");
  const auto port = json::integer_at(link, "port");
  pairing.port = port ? static_cast<int>(*port) : 0;
  pairing.secret = text_at(link, "secret");
  joins_->join(pairing, false);
}

void RemoteAudioLan::transport_signal(const json::Value& message) {
  if (group_->receive(message)) {
    return;
  }
  const std::string peer_id = text_at(message, "peerId");
  const json::Value* signal = message.get("signal");
  if (signal != nullptr && text_at(*signal, "kind") == "stop") {
    const auto peer = peers_.find(peer_id);
    const std::optional<std::string> computer_id =
        peer != peers_.end() ? peer->second.computer_id : std::nullopt;
    const json::Value* forget = signal->get("forget");
    // Unlinked over there: a code this computer holds for it is not to be
    // used again (a FluidEQ from before all to all never says so).
    if (forget != nullptr && forget->is_bool() && forget->as_bool() &&
        computer_id && !computer_id->empty()) {
      book_.revoke(*computer_id);
      if (joins_->has(*computer_id)) {
        joins_->leave(*computer_id);
      }
      book_.forget_join(*computer_id);
    }
    forget_peer(peer_id);
  }
  events_.emit_signal(message);
}

void RemoteAudioLan::joins_signal(const json::Value& message) {
  const std::string peer_id = text_at(message, "peerId");
  const json::Value* signal = message.get("signal");
  const bool ready =
      signal != nullptr && text_at(*signal, "kind") == "peer-ready";
  std::optional<std::string> computer_id;
  if (ready) {
    if (const std::string* id = json::string_at(*signal, "computerId")) {
      computer_id = *id;
    }
    peers_[peer_id] = Peer{computer_id, true};
  }
  events_.emit_signal(message);
  if (ready) {
    group_->connected(peer_id, computer_id);
  }
}

void RemoteAudioLan::send_to_each(const std::shared_ptr<UdpSocket>& socket,
                                  std::vector<std::uint8_t> data,
                                  std::vector<std::string> targets,
                                  std::function<void()> done) {
  if (targets.empty()) {
    if (done) {
      done();
    }
    return;
  }
  const std::string target = targets.front();
  targets.erase(targets.begin());
  std::weak_ptr<RemoteAudioLan> weak = shared_from_this();
  std::vector<std::uint8_t> copy = data;
  socket->send(std::move(copy), discovery::kPort, target,
               [weak, socket, data = std::move(data),
                targets = std::move(targets), done = std::move(done)] {
                 if (const auto self = weak.lock()) {
                   self->send_to_each(socket, data, targets, done);
                 }
               });
}

void RemoteAudioLan::ask_who_is_there(const std::string& secret) {
  if (discovery_socket_) {
    ask_round(discovery_socket_, discovery::encode_query(secret), 0);
  }
}

void RemoteAudioLan::ask_round(const std::shared_ptr<UdpSocket>& socket,
                               const std::vector<std::uint8_t>& query,
                               int asked) {
  if (asked >= kDiscoveryQueries || discovery_socket_ != socket) {
    return;
  }
  std::weak_ptr<RemoteAudioLan> weak = shared_from_this();
  send_to_each(socket, query, discovery_targets(),
               [weak, socket, query, asked] {
                 if (const auto self = weak.lock()) {
                   self->ask_round(socket, query, asked + 1);
                 }
               });
}

void RemoteAudioLan::announce_self() {
  if (!session_ || !discovery_socket_) {
    return;
  }
  std::vector<std::string> secrets{session_->secret};
  for (const auto& link : book_.group_links()) {
    const std::string secret = text_at(link, "secret");
    if (std::find(secrets.begin(), secrets.end(), secret) == secrets.end()) {
      secrets.push_back(secret);
    }
  }
  const std::string device_name = device_name_of();
  for (const auto& secret : secrets) {
    send_to_each(discovery_socket_,
                 discovery::encode_announcement(secret, session_->port,
                                                device_name),
                 discovery_targets(), {});
  }
}

void RemoteAudioLan::join(const json::Value& code, bool fresh) {
  const auto pairing =
      code.is_string() ? lan::decode_pairing_code(code.as_string())
                       : std::nullopt;
  if (!pairing) {
    throw LinkError("Invalid LAN pairing code.");
  }
  const std::string computer_id = lan::computer_id_of(pairing->secret);
  if (session_ && computer_id == own_id()) {
    throw LinkError("That is this computer’s own code.");
  }
  if (fresh) {
    book_.unrevoke(computer_id);
  }
  JoinPairing join;
  join.address = pairing->address;
  join.addresses = pairing->addresses;
  join.device_name = pairing->device_name;
  join.port = pairing->port;
  join.secret = pairing->secret;
  joins_->join(join, fresh);
}

std::vector<std::string> RemoteAudioLan::links_of(
    const std::optional<std::string>& peer_id,
    const std::optional<std::string>& computer_id) {
  if (!computer_id) {
    return peer_id ? std::vector<std::string>{*peer_id}
                   : std::vector<std::string>{};
  }
  std::vector<std::string> links;
  for (const auto& [id, peer] : peers_) {
    if (peer.computer_id == computer_id) {
      links.push_back(id);
    }
  }
  return links;
}

void RemoteAudioLan::unlink(const std::optional<std::string>& peer_id,
                            const std::optional<std::string>& named) {
  std::optional<std::string> computer_id = named;
  if (!computer_id && peer_id) {
    const auto peer = peers_.find(*peer_id);
    if (peer != peers_.end()) {
      computer_id = peer->second.computer_id;
    }
  }
  const auto links = links_of(peer_id, computer_id);
  for (const auto& id : links) {
    try {
      transport_->send_signal(signal_message(
          id, json::Value::object({
                  {"kind", json::Value::string("stop")},
                  {"forget", json::Value::boolean(true)},
              })));
    } catch (const LinkError&) {
      // Already gone; its own close says so.
    }
  }
  if (computer_id) {
    // Refused if it comes back on its own, with word to forget this code;
    // let in again only if somebody pastes the code there by hand.
    book_.revoke(*computer_id);
    if (joins_->has(*computer_id)) {
      joins_->leave(*computer_id);
      book_.forget_join(*computer_id);
    }
  }
  for (const auto& id : links) {
    transport_->close(id);
  }
}

Future<bool> RemoteAudioLan::reconnect(
    const std::optional<std::string>& peer_id,
    const std::optional<std::string>& named) {
  std::optional<std::string> computer_id = named;
  if (!computer_id && peer_id) {
    const auto peer = peers_.find(*peer_id);
    if (peer != peers_.end()) {
      computer_id = peer->second.computer_id;
    }
  }
  const auto links = links_of(peer_id, computer_id);
  // Waited for before the links close, so the round their close starts is
  // the one that answers.
  const Future<bool> outcome =
      computer_id && joins_->has(*computer_id)
          ? joins_->reconnect(*computer_id)
          : Future<bool>::resolved(!links.empty());
  announce_self();
  for (const auto& id : links) {
    transport_->close(id);
  }
  return outcome;
}

void RemoteAudioLan::retry() {
  announce_self();
  joins_->retry();
}

void RemoteAudioLan::send_signal(const json::Value& message) {
  if (!signals::is_lan_signal(&message)) {
    throw LinkError("Invalid remote audio control message.");
  }
  const json::Value* signal = message.get("signal");
  if (text_at(*signal, "kind") == "stream-mode") {
    announced_[text_at(message, "peerId")] = *signal;
  }
  transport_->send_signal(message);
}

void RemoteAudioLan::send_audio(const lan::AudioChunk& chunk) {
  transport_->send_audio(chunk);
}

void RemoteAudioLan::set_stream_mode(const std::string& peer_id, bool music) {
  transport_->set_stream_mode(peer_id, music);
}

void RemoteAudioLan::stop() {
  lifecycle_generation_ += 1;
  const auto server = std::move(server_);
  server_.reset();
  const auto discovery_socket = std::move(discovery_socket_);
  discovery_socket_.reset();
  session_.reset();
  joins_->close_all();
  transport_->close_all();
  peers_.clear();
  announced_.clear();
  group_->reset();
  inbound_.clear();
  if (discovery_socket) {
    discovery_socket->close();
  }
  if (server) {
    for (const auto& client : server->clients()) {
      client->remove_all_listeners();
      close_web_socket_safely(client);
    }
    server->close();
  }
}

}  // namespace feq::share::service

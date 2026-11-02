/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan_peers.h"

#include <algorithm>
#include <list>
#include <map>
#include <set>

#include "lan_join.h"

namespace feq::share::service {
namespace {

constexpr std::size_t kMaxPendingSockets = 64;
constexpr std::size_t kMaxPendingSocketsPerAddress = 8;
constexpr std::size_t kMaxAuthenticatedSockets = 32;

int hex_digit(char c) {
  if (c >= '0' && c <= '9') {
    return c - '0';
  }
  if (c >= 'a' && c <= 'f') {
    return c - 'a' + 10;
  }
  if (c >= 'A' && c <= 'F') {
    return c - 'A' + 10;
  }
  return -1;
}

/** The URL form decoding URLSearchParams applies to a name or a value. */
std::string form_decoded(std::string_view text) {
  std::string bytes;
  for (std::size_t at = 0; at < text.size(); at += 1) {
    const char c = text[at];
    if (c == '+') {
      bytes.push_back(' ');
    } else if (c == '%' && at + 2 < text.size() &&
               hex_digit(text[at + 1]) >= 0 && hex_digit(text[at + 2]) >= 0) {
      bytes.push_back(static_cast<char>(hex_digit(text[at + 1]) * 16 +
                                        hex_digit(text[at + 2])));
      at += 2;
    } else {
      bytes.push_back(c);
    }
  }
  return share::json::well_formed(bytes);
}

struct Candidate {
  std::shared_ptr<WebSocket> socket;
  std::string address;
  bool pending = true;
  int on_close_release = 0;
  int on_error_pending = 0;
  int on_message_authenticate = 0;
};

struct PeersState {
  PeersDeps deps;
  std::set<std::string> used_peer_ids;
  /** Not yet authenticated, oldest first, over all and per address. */
  std::list<std::shared_ptr<Candidate>> pending;
  std::map<std::string, std::list<std::shared_ptr<Candidate>>> by_address;

  void release(const std::shared_ptr<Candidate>& candidate) {
    if (!candidate->pending) {
      return;
    }
    candidate->pending = false;
    pending.remove(candidate);
    const auto found = by_address.find(candidate->address);
    if (found != by_address.end()) {
      found->second.remove(candidate);
      if (found->second.empty()) {
        by_address.erase(found);
      }
    }
  }

  void make_room(const std::shared_ptr<Candidate>& oldest) {
    release(oldest);
    close_web_socket_safely(oldest->socket, 1008,
                            "Too many unauthenticated connections");
  }
};

void authenticate(const std::shared_ptr<PeersState>& state,
                  const std::shared_ptr<Candidate>& candidate,
                  const lan::Key& auth_key, const std::string& challenge,
                  const std::optional<share::json::Value>& ticket,
                  const Bytes& data) {
  const auto& socket = candidate->socket;
  const auto refuse = [&socket] {
    close_web_socket_safely(socket, 1008, "Authentication failed");
  };
  const auto packet = lan::open_packet(data, auth_key);
  if (!packet) {
    refuse();
    return;
  }
  const auto message = packet->kind == lan::kPacketAuthReady
                           ? lan::open_auth_ready(packet->clear)
                           : std::nullopt;
  const std::string* ticket_computer =
      ticket ? share::json::string_at(*ticket, "computerId") : nullptr;
  if (!message || message->challenge != challenge ||
      state->used_peer_ids.contains(message->peer_id) ||
      state->used_peer_ids.size() >= kMaxAuthenticatedSockets ||
      (ticket && (!message->computer_id || ticket_computer == nullptr ||
                  *message->computer_id != *ticket_computer))) {
    refuse();
    return;
  }
  socket->on_message.off(candidate->on_message_authenticate);
  const std::optional<std::string> computer_id = message->computer_id;
  const auto refusal =
      state->deps.admit(computer_id, !ticket && message->fresh);
  if (refusal) {
    close_web_socket_safely(socket, *refusal, "Not linked");
    return;
  }
  if (computer_id && !computer_id->empty()) {
    state->deps.arriving(*computer_id, socket);
  }
  const lan::Key session_key =
      lan::derive_session_key(auth_key, challenge, message->peer_id);
  // Reserve the peer identity before the asynchronous send callback, or two
  // simultaneous responses using the same peer id could both pass the
  // duplicate check and race to replace one transport.
  const std::string peer_id = message->peer_id;
  state->used_peer_ids.insert(peer_id);
  std::weak_ptr<PeersState> weak_state = state;
  socket->on_close.once([weak_state, peer_id](int) {
    if (const auto alive = weak_state.lock()) {
      alive->used_peer_ids.erase(peer_id);
    }
  });
  const bool introduced = ticket && ticket->get("introduced") != nullptr &&
                          ticket->get("introduced")->is_bool() &&
                          ticket->get("introduced")->as_bool();
  const lan::AuthReady ready = *message;
  socket->send(
      lan::seal_auth_accepted(lan::AuthAccepted{challenge, peer_id}, auth_key),
      [weak_state, candidate, session_key, ready,
       introduced](const std::optional<Failure>& error) {
        const auto alive = weak_state.lock();
        const auto& socket = candidate->socket;
        if (!alive || error || !candidate->pending || !socket->is_open()) {
          close_web_socket_safely(socket, 1008, "Authentication failed");
          return;
        }
        socket->on_close.off(candidate->on_close_release);
        alive->release(candidate);
        socket->on_error.off(candidate->on_error_pending);
        alive->deps.ready(socket, session_key, ready, candidate->address,
                          introduced);
      });
}

}  // namespace

std::optional<std::string> query_value(const std::string& url,
                                       const std::string& name) {
  // `split('?')[1]`: what lies between the first question mark and the
  // second, if there is a second.
  const std::size_t first = url.find('?');
  if (first == std::string::npos) {
    return std::nullopt;
  }
  const std::size_t second = url.find('?', first + 1);
  const std::string_view query =
      std::string_view(url).substr(first + 1, second == std::string::npos
                                                  ? std::string::npos
                                                  : second - first - 1);
  std::size_t at = 0;
  while (at <= query.size()) {
    const std::size_t end = std::min(query.find('&', at), query.size());
    const std::string_view pair = query.substr(at, end - at);
    if (!pair.empty()) {
      const std::size_t equals = pair.find('=');
      const std::string key = form_decoded(pair.substr(0, equals));
      if (key == name) {
        return equals == std::string_view::npos
                   ? std::string()
                   : form_decoded(pair.substr(equals + 1));
      }
    }
    at = end + 1;
  }
  return std::nullopt;
}

void register_lan_peers(const std::shared_ptr<WebSocketServer>& server,
                        PeersDeps deps) {
  auto state = std::make_shared<PeersState>();
  state->deps = std::move(deps);
  server->on_connection.on([state](const std::shared_ptr<WebSocket>& socket,
                                   const UpgradeRequest& request) {
    const PeersDeps& deps = state->deps;
    if (!deps.current()) {
      close_web_socket_safely(socket);
      return;
    }
    const std::string& address = request.remote_address;
    if (address.empty() || !lan::is_private_ipv4(address)) {
      close_web_socket_safely(socket, 1008,
                              "Only private LAN connections are allowed");
      return;
    }
    socket->keep_alive(kLinkQuietBeforeProbeSeconds);
    const std::optional<std::string> ticket_id =
        query_value(request.url, "computer");
    std::optional<share::json::Value> ticket;
    if (ticket_id) {
      for (const auto& link : deps.book.group_links()) {
        const std::string* id = share::json::string_at(link, "computerId");
        if (id != nullptr && *id == *ticket_id) {
          ticket = link;
          break;
        }
      }
      if (!ticket || deps.book.is_revoked(*ticket_id)) {
        close_web_socket_safely(
            socket,
            deps.book.is_revoked(*ticket_id) ? kCloseForget : 1008,
            "Not linked");
        return;
      }
    }
    const std::string* ticket_secret =
        ticket ? share::json::string_at(*ticket, "secret") : nullptr;
    const lan::Key auth_key = ticket_secret != nullptr
                                  ? lan::key_from_secret(*ticket_secret)
                                  : deps.pairing_key;
    auto candidate = std::make_shared<Candidate>();
    candidate->socket = socket;
    candidate->address = address;
    const auto from = state->by_address.find(address);
    if (from != state->by_address.end() &&
        from->second.size() >= kMaxPendingSocketsPerAddress) {
      state->make_room(from->second.front());
    }
    if (state->pending.size() >= kMaxPendingSockets) {
      state->make_room(state->pending.front());
    }
    state->by_address[address].push_back(candidate);
    state->pending.push_back(candidate);
    std::weak_ptr<PeersState> weak_state = state;
    candidate->on_close_release =
        socket->on_close.once([weak_state, candidate](int) {
          if (const auto alive = weak_state.lock()) {
            alive->release(candidate);
          }
        });
    const std::string challenge = lan::create_auth_challenge();
    std::weak_ptr<WebSocket> weak_socket = socket;
    candidate->on_error_pending =
        socket->on_error.once([weak_socket](const Failure&) {
          if (const auto open = weak_socket.lock()) {
            close_web_socket_safely(open, 1008, "Authentication failed");
          }
        });
    candidate->on_message_authenticate = socket->on_message.on(
        [weak_state, candidate, auth_key, challenge, ticket](const Bytes& data) {
          const auto alive = weak_state.lock();
          if (!alive) {
            return;
          }
          try {
            authenticate(alive, candidate, auth_key, challenge, ticket, data);
          } catch (const std::exception&) {
            close_web_socket_safely(candidate->socket, 1008,
                                    "Authentication failed");
          }
        });
    socket->send(lan::seal_auth_challenge(challenge, auth_key),
                 [weak_socket](const std::optional<Failure>& error) {
                   const auto open = weak_socket.lock();
                   if (error && open) {
                     close_web_socket_safely(open, 1008,
                                             "Authentication failed");
                   }
                 });
  });
}

}  // namespace feq::share::service

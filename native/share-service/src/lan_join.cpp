/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan_join.h"

#include "link_error.h"
#include "service_log.h"

namespace feq::share::service {

void close_web_socket_safely(const std::shared_ptr<WebSocket>& socket,
                             std::optional<int> code,
                             const std::string& reason) {
  if (socket->state() == WebSocket::State::kClosed) {
    return;
  }
  socket->close(code, reason);
}

Failure join_closed(int code) {
  Failure failure;
  failure.message = "LAN connection closed (" + std::to_string(code) + ").";
  failure.close_code = code;
  return failure;
}

JoinAttempt join_at(const JoinHandshake& handshake) {
  const std::string path =
      handshake.ticket
          ? "/?computer=" + encode_uri_component(handshake.computer_id)
          : "/";
  const auto socket = WebSocket::connect(handshake.address, handshake.port,
                                         path, lan::kMaxPacketBytes);
  std::weak_ptr<WebSocket> weak = socket;
  socket->on_open.once([weak] {
    if (const auto open = weak.lock()) {
      open->keep_alive(kLinkQuietBeforeProbeSeconds);
    }
  });

  struct State {
    bool settled = false;
    bool cancelled = false;
    std::optional<std::string> challenge;
    int on_close = 0;
    int on_error = 0;
    int on_message = 0;
  };
  auto state = std::make_shared<State>();
  Future<JoinedSocket> joined;

  const auto cleanup = [state, weak] {
    if (const auto open = weak.lock()) {
      open->on_close.off(state->on_close);
      open->on_error.off(state->on_error);
      open->on_message.off(state->on_message);
    }
  };
  const auto fail = [state, joined, cleanup](const Failure& failure) {
    if (state->settled) {
      return;
    }
    state->settled = true;
    cleanup();
    joined.reject(failure);
  };
  state->on_error = socket->on_error.once(fail);
  state->on_close =
      socket->on_close.once([fail](int code) { fail(join_closed(code)); });
  state->on_message = socket->on_message.on(
      [state, joined, cleanup, fail, weak, handshake](const Bytes& data) {
        const auto open = weak.lock();
        if (!open) {
          return;
        }
        try {
          const auto packet = lan::open_packet(data, handshake.pairing_key);
          if (!packet) {
            throw LinkError("Invalid encrypted LAN packet.");
          }
          if (!state->challenge) {
            if (packet->kind != lan::kPacketAuthChallenge) {
              throw LinkError("LAN listener did not send a challenge.");
            }
            const auto challenge = lan::open_auth_challenge(packet->clear);
            if (!challenge) {
              throw LinkError("Invalid LAN authentication message.");
            }
            state->challenge = *challenge;
            if (handshake.on_challenge) {
              handshake.on_challenge();
            }
            lan::AuthReady ready;
            ready.challenge = *challenge;
            ready.device_name = handshake.device_name;
            ready.peer_id = handshake.peer_id;
            ready.computer_id = handshake.computer_id;
            ready.fresh = handshake.fresh;
            open->send(lan::seal_auth_ready(ready, handshake.pairing_key));
            return;
          }
          if (packet->kind != lan::kPacketAuthAccepted) {
            throw LinkError("LAN listener did not accept authentication.");
          }
          const auto accepted = lan::open_auth_accepted(packet->clear);
          if (!accepted || accepted->challenge != *state->challenge ||
              accepted->peer_id != handshake.peer_id) {
            throw LinkError("LAN authentication acknowledgement changed.");
          }
          if (state->cancelled) {
            throw LinkError("LAN connection was stopped.");
          }
          state->settled = true;
          cleanup();
          joined.resolve(JoinedSocket{
              handshake.address, open,
              lan::derive_session_key(handshake.pairing_key, *state->challenge,
                                      handshake.peer_id)});
        } catch (const LinkError& error) {
          fail(error.failure());
          close_web_socket_safely(open, 1008, "Authentication failed");
        } catch (const std::exception&) {
          fail(failure_with("LAN authentication failed."));
          close_web_socket_safely(open, 1008, "Authentication failed");
        }
      });
  return JoinAttempt{joined, [state, socket] {
                       state->cancelled = true;
                       if (!state->settled) {
                         close_web_socket_safely(socket);
                       }
                     }};
}

}  // namespace feq::share::service

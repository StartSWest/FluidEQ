/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * One try at one address (`remoteAudioLanJoin.ts`): connect, answer the
 * listener's challenge, and hand back the authenticated socket. No
 * deadline: it ends on the socket's own close or error — an address nobody
 * answers fails to connect — or on `cancel`.
 */

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "fluideq/share/lan_protocol.h"
#include "io.h"
#include "websocket.h"

namespace feq::share::service {

/**
 * Close codes a listener answers a join with, beside the protocol's own.
 *
 * FORGET: this computer was unlinked there; old builds also used it for a
 * duplicate. The close code alone never removes credentials: only the
 * authenticated stop/forget signal does. ALREADY_LINKED: the two computers
 * each pasted the other's code and the other connection is the one kept;
 * the code stays, asleep, for when that connection ends.
 */
inline constexpr int kCloseForget = 4001;
inline constexpr int kCloseAlreadyLinked = 4003;

/** How long a link carries nothing before the system probes the other end. */
inline constexpr int kLinkQuietBeforeProbeSeconds = 5;

/**
 * Closes a socket in whatever state it is in. `ws` needed an error sink
 * for a socket closed while connecting; here an unheard error harms
 * nothing, so this is the close and the guard against a closed socket.
 */
void close_web_socket_safely(const std::shared_ptr<WebSocket>& socket,
                             std::optional<int> code = std::nullopt,
                             const std::string& reason = {});

/** The failure a join ends with when the listener closed it. */
Failure join_closed(int code);

struct JoinHandshake {
  std::string address;
  int port = 0;
  lan::Key pairing_key{};
  std::string peer_id;
  std::string device_name;
  std::string computer_id;
  bool fresh = false;
  bool ticket = false;
  /** The remote endpoint proved it knows the pairing key. */
  std::function<void()> on_challenge;
};

struct JoinedSocket {
  std::string address;
  std::shared_ptr<WebSocket> socket;
  lan::Key session_key{};
};

struct JoinAttempt {
  Future<JoinedSocket> joined;
  std::function<void()> cancel;
};

JoinAttempt join_at(const JoinHandshake& handshake);

}  // namespace feq::share::service

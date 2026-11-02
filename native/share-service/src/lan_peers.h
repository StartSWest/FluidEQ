/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The listener's half of a link (`remoteAudioLanServer.ts`): authenticate
 * bounded inbound candidates before exposing any transport. A connection
 * arriving to a full room makes room by closing the one that has waited
 * longest — never a timer: an honest peer answers its challenge in one
 * round trip, a silent one is the one let go.
 */

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "fluideq/share/lan_protocol.h"
#include "lan_book.h"
#include "websocket.h"

namespace feq::share::service {

struct PeersDeps {
  std::function<bool()> current;
  lan::Key pairing_key{};
  LinkBook book;
  /** A close code to refuse the computer with, or nothing to let it in. */
  std::function<std::optional<int>(const std::optional<std::string>& computer_id,
                                   bool fresh)>
      admit;
  std::function<void(const std::string& computer_id,
                     const std::shared_ptr<WebSocket>& candidate)>
      arriving;
  std::function<void(const std::shared_ptr<WebSocket>& candidate,
                     const lan::Key& session_key, const lan::AuthReady& message,
                     const std::string& address, bool introduced)>
      ready;
};

void register_lan_peers(const std::shared_ptr<WebSocketServer>& server,
                        PeersDeps deps);

/** `new URLSearchParams(url.split('?')[1] ?? '').get(name)`. */
std::optional<std::string> query_value(const std::string& url,
                                       const std::string& name);

}  // namespace feq::share::service

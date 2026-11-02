/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Trusted introductions, then direct encrypted audio
 * (`remoteAudioGroup.ts`). There is no relay or permanent host secret in
 * the roster. Losing the introducing PC leaves the other pairs connected.
 * Revoking a pair blocks every automatic introduction. The lowest issuer id
 * wins concurrent introductions, so both ends retain the same credential.
 * Its HMAC is stable across issuer restarts, and one pair's derived key
 * gives no authority over any other pair.
 *
 * Endpoints, hellos and links stay JSON, spread and passed on exactly as
 * the TypeScript spreads them, and the peers keep the order they came in:
 * the `known` list a hello carries is that order, cut at 32.
 */

#include <functional>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "fluideq/share/json.h"

namespace feq::share::service {

struct GroupSelf {
  /** `IAudioGroupEndpoint`: computerId, deviceName, addresses, port. */
  share::json::Value endpoint;
  std::string secret;
};

struct GroupDeps {
  std::function<std::optional<GroupSelf>()> self;
  std::function<std::vector<share::json::Value>()> saved;
  std::function<std::vector<std::string>()> known;
  std::function<bool(const std::string& computer_id)> revoked;
  std::function<void(const share::json::Value& link)> save;
  std::function<void(const share::json::Value& link)> join;
  std::function<void(const share::json::Value& message)> send;
};

class LanGroup {
 public:
  explicit LanGroup(GroupDeps deps) : deps_(std::move(deps)) {}

  void connected(const std::string& peer_id,
                 const std::optional<std::string>& computer_id);
  void disconnected(const std::string& peer_id);
  /** True when the message was the group's own and goes no further. */
  bool receive(const share::json::Value& message);
  void reset();

 private:
  struct Peer {
    std::string computer_id;
    std::optional<share::json::Value> hello;
  };

  Peer* find(const std::string& peer_id);
  void send(const std::string& peer_id, share::json::Value signal);
  void hello(const std::string& peer_id);
  void remember(const share::json::Value& link);
  std::string secret_for(const std::string& first, const std::string& second);
  void introduce();

  GroupDeps deps_;
  std::vector<std::pair<std::string, Peer>> peers_;
  std::set<std::string> introduced_;
};

}  // namespace feq::share::service

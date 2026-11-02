/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan_joins.h"

#include <algorithm>
#include <cctype>

#include "fluideq/share/discovery.h"
#include "service_log.h"

namespace feq::share::service {
namespace {

/** /^[A-Z][A-Z0-9_]{0,39}$/: a system code worth putting in the log. */
bool loggable_code(const std::string& code) {
  if (code.empty() || code.size() > 40 || code[0] < 'A' || code[0] > 'Z') {
    return false;
  }
  return std::all_of(code.begin(), code.end(), [](char c) {
    return (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
  });
}

std::string where(const std::string& address, int port) {
  return address + ":" + std::to_string(port);
}

}  // namespace

bool LanJoins::current(const JoinPointer& join) const {
  const auto found = joins_.find(join->computer_id);
  return found != joins_.end() && found->second == join;
}

void LanJoins::settle(const JoinPointer& join, bool linked) {
  auto waiting = std::move(join->waiters);
  join->waiters.clear();
  for (const auto& waiter : waiting) {
    waiter.resolve(linked);
  }
}

void LanJoins::cancel_attempts(const JoinPointer& join) {
  auto attempts = std::move(join->attempts);
  join->attempts.clear();
  for (auto& [at, cancel] : attempts) {
    cancel();
  }
  join->authenticating.clear();
  join->rediscovered.clear();
}

void LanJoins::leave(const std::string& computer_id) {
  const auto found = joins_.find(computer_id);
  if (found == joins_.end()) {
    return;
  }
  const JoinPointer join = found->second;
  joins_.erase(found);
  cancel_attempts(join);
  settle(join, false);
  if (join->socket) {
    close_web_socket_safely(join->socket);
  }
}

void LanJoins::sleep(const JoinPointer& join) {
  join->state = State::kAsleep;
  cancel_attempts(join);
  // Asleep is linked: the other computer's connection is the one kept.
  settle(join, true);
  const auto socket = std::move(join->socket);
  join->socket.reset();
  if (socket) {
    close_web_socket_safely(socket);
  }
}

void LanJoins::try_address(const JoinPointer& join, const std::string& address,
                           int port) {
  const std::string at = where(address, port);
  if (!current(join) || join->state != State::kLooking ||
      join->attempts.contains(at)) {
    return;
  }
  const std::string peer_id = join->peer_id;
  const auto [computer_id, device_name] = deps_.self();
  std::weak_ptr<LanJoins> weak = shared_from_this();
  JoinHandshake handshake;
  handshake.address = address;
  handshake.port = port;
  handshake.pairing_key = join->pairing_key;
  handshake.peer_id = peer_id;
  handshake.device_name = device_name;
  handshake.computer_id = computer_id;
  handshake.fresh = join->fresh;
  handshake.ticket = join->pairing.computer_id.has_value();
  handshake.on_challenge = [weak, join, peer_id, at] {
    const auto self = weak.lock();
    if (self && self->current(join) && join->state == State::kLooking &&
        join->peer_id == peer_id) {
      join->authenticating.insert(at);
    }
  };
  const JoinAttempt attempt = deps_.join_at(handshake);
  join->attempts[at] = attempt.cancel;
  attempt.joined.then([weak, join, at, address, port,
                       peer_id](const Future<JoinedSocket>::Result& result) {
    const auto self = weak.lock();
    if (!self) {
      if (result.index() == 0) {
        close_web_socket_safely(std::get<0>(result).socket);
      }
      return;
    }
    if (result.index() == 0) {
      self->joined(join, at, peer_id, port, std::get<0>(result));
    } else {
      self->failed(join, at, address, port, peer_id, std::get<1>(result));
    }
  });
}

void LanJoins::joined(const JoinPointer& join, const std::string& at,
                      const std::string& peer_id, int port,
                      const JoinedSocket& result) {
  const auto socket = result.socket;
  if (!current(join) || join->state != State::kLooking ||
      join->peer_id != peer_id) {
    close_web_socket_safely(socket);
    return;
  }
  join->attempts.erase(at);
  join->authenticating.erase(at);
  cancel_attempts(join);
  join->state = State::kConnected;
  join->socket = socket;
  join->last_address = result.address;
  join->port = port;
  join->fresh = false;
  settle(join, true);
  std::weak_ptr<LanJoins> weak = shared_from_this();
  std::weak_ptr<WebSocket> weak_socket = socket;
  socket->on_close.once([weak, join, weak_socket](int code) {
    const auto self = weak.lock();
    const auto closed = weak_socket.lock();
    if (self && closed && self->current(join) && join->socket == closed) {
      log_info("Share Audio connection closed; keeping pairing",
               json::Value::object({
                   {"computerId", json::Value::string(join->computer_id)},
                   {"code", json::Value::number(code)},
               }));
      join->socket.reset();
      self->look(join);
    }
  });
  deps_.attach(peer_id, socket, result.session_key);
  json::Value signal = json::Value::object({
      {"kind", json::Value::string("peer-ready")},
      {"address", json::Value::string(result.address)},
      {"computerId", json::Value::string(join->computer_id)},
      {"deviceName", json::Value::string(join->pairing.device_name)},
      {"joined", json::Value::boolean(true)},
  });
  if (join->pairing.introduced) {
    signal.set("introduced", json::Value::boolean(true));
  }
  deps_.emit_signal(json::Value::object({
      {"peerId", json::Value::string(peer_id)},
      {"signal", std::move(signal)},
  }));
}

void LanJoins::failed(const JoinPointer& join, const std::string& at,
                      const std::string& address, int port,
                      const std::string& peer_id, const Failure& failure) {
  if (!current(join) || join->state != State::kLooking ||
      join->peer_id != peer_id) {
    return;
  }
  // A cancelled round may finish after a retry has opened the same address
  // again. It must not remove or put that newer round to sleep.
  const bool rediscovered = join->rediscovered.erase(at) > 0;
  const bool authenticating = join->authenticating.erase(at) > 0;
  join->attempts.erase(at);
  const bool closed = failure.close_code != 0;
  json::Value detail = json::Value::object({
      {"computerId", json::Value::string(join->computer_id)},
      {"address", json::Value::string(address)},
      {"port", json::Value::number(port)},
      {"stage", json::Value::string(authenticating ? "authentication"
                                                   : "connection")},
  });
  if (closed) {
    detail.set("closeCode", json::Value::number(failure.close_code));
  }
  if (loggable_code(failure.code)) {
    detail.set("code", json::Value::string(failure.code));
  }
  log_info("Share Audio peer connection failed; saved pairing retained",
           detail);
  // Old builds used 4001 for duplicate connections as well as unlink. A
  // bare WebSocket close is not an authenticated unlink instruction: keep
  // the pairing; only an encrypted stop/forget removes it.
  if (closed &&
      (failure.close_code == kCloseForget ||
       failure.close_code == kCloseAlreadyLinked) &&
      deps_.inbound_live(join->computer_id)) {
    sleep(join);
    return;
  }
  // A peer can announce its return before an older connect error is
  // delivered. Consume one hint after failure, without a timed retry loop
  // or retrying an explicit authentication refusal.
  const bool refused =
      closed && (failure.close_code == 1008 ||
                 failure.close_code == kCloseForget ||
                 failure.close_code == kCloseAlreadyLinked);
  if (rediscovered && !refused) {
    try_address(join, address, port);
  }
  if (join->attempts.empty()) {
    // Every address of this round has answered no. A later announcement
    // still starts another attempt; a reconnect asked for by hand is told
    // now that this one found nobody.
    settle(join, false);
  }
}

void LanJoins::probe(const JoinPointer& join) {
  std::vector<std::string> candidates;
  const auto add = [&candidates](const std::string& address) {
    if (std::find(candidates.begin(), candidates.end(), address) ==
        candidates.end()) {
      candidates.push_back(address);
    }
  };
  if (join->last_address) {
    add(*join->last_address);
  }
  for (const auto& address : join->pairing.addresses) {
    add(address);
  }
  for (const auto& address : candidates) {
    try_address(join, address, join->port);
  }
  if (join->restored) {
    const Restored restored = *join->restored;
    for (const auto& address : restored.addresses) {
      try_address(join, address, restored.port);
    }
  }
  deps_.ask_who_is_there(join->pairing.secret);
}

void LanJoins::look(const JoinPointer& join) {
  cancel_attempts(join);
  join->state = State::kLooking;
  join->peer_id = random_uuid();
  probe(join);
  if (join->attempts.empty()) {
    settle(join, false);
  }
}

std::string LanJoins::join(const JoinPairing& pairing, bool fresh) {
  const std::string computer_id =
      pairing.computer_id.value_or(lan::computer_id_of(pairing.secret));
  const auto found = joins_.find(computer_id);
  if (found != joins_.end()) {
    const JoinPointer existing = found->second;
    existing->fresh = existing->fresh || fresh;
    if (fresh) {
      existing->restored.reset();
    } else if (!pairing.computer_id) {
      existing->restored = Restored{pairing.addresses, pairing.port};
    }
    const bool credential_changed = existing->pairing.computer_id.has_value() &&
                                    existing->pairing.secret != pairing.secret;
    // Startup replays the originally pasted code after loading the pair
    // book. Its old address/port must not replace a newer saved endpoint. A
    // deliberate paste or an authenticated scoped link can refresh it.
    const JoinPairing endpoint =
        fresh || pairing.computer_id ? pairing : existing->pairing;
    const bool endpoint_changed =
        existing->pairing.port != endpoint.port ||
        existing->pairing.addresses != endpoint.addresses;
    if (credential_changed) {
      // A concurrent introduction chose another scoped credential. Keep the
      // authenticated session alive while both computers learn it.
      existing->pairing_key = lan::key_from_secret(pairing.secret);
    }
    JoinPairing next = credential_changed ? pairing : existing->pairing;
    next.address = endpoint.address;
    next.addresses = endpoint.addresses;
    next.port = endpoint.port;
    next.device_name = endpoint.device_name;
    existing->pairing = std::move(next);
    if (endpoint_changed) {
      existing->port = endpoint.port;
    }
    if (existing->state == State::kLooking) {
      // Re-pasting today's code must replace yesterday's endpoint and
      // pending handshake; the row used to stay offline on its old port.
      if (credential_changed || endpoint_changed || fresh) {
        look(existing);
      } else {
        probe(existing);
      }
    }
    return computer_id;
  }
  auto join = std::make_shared<Join>();
  join->computer_id = computer_id;
  join->pairing = pairing;
  join->pairing_key = lan::key_from_secret(pairing.secret);
  join->fresh = fresh;
  join->port = pairing.port;
  joins_[computer_id] = join;
  if (deps_.inbound_live(computer_id)) {
    join->state = State::kAsleep;
  } else {
    look(join);
  }
  return computer_id;
}

Future<bool> LanJoins::reconnect(const std::string& computer_id) {
  const auto found = joins_.find(computer_id);
  if (found == joins_.end()) {
    return Future<bool>::resolved(false);
  }
  const JoinPointer join = found->second;
  Future<bool> outcome;
  join->waiters.push_back(outcome);
  if (join->state == State::kLooking) {
    look(join);
  }
  return outcome;
}

std::optional<std::string> LanJoins::peer_of(
    const std::string& computer_id) const {
  const auto found = joins_.find(computer_id);
  if (found != joins_.end() && found->second->state == State::kConnected) {
    return found->second->peer_id;
  }
  return std::nullopt;
}

bool LanJoins::inbound_arrived(const std::string& computer_id) {
  const auto found = joins_.find(computer_id);
  if (found == joins_.end()) {
    return true;
  }
  const JoinPointer join = found->second;
  // Rank a pending outbound connection only once its peer has answered with
  // an authenticated challenge. A stale IP/port that never answers must not
  // prevent a reachable peer reconnecting in the other direction.
  if ((join->state == State::kConnected || !join->authenticating.empty()) &&
      deps_.self().first < computer_id) {
    return false;
  }
  sleep(join);
  return true;
}

void LanJoins::inbound_closed(const std::string& computer_id) {
  const auto found = joins_.find(computer_id);
  if (found != joins_.end() && found->second->state == State::kAsleep) {
    look(found->second);
  }
}

void LanJoins::heard(std::span<const std::uint8_t> data,
                     const std::string& address) {
  if (!lan::is_private_ipv4(address)) {
    return;
  }
  std::vector<JoinPointer> looking;
  for (const auto& [computer_id, join] : joins_) {
    if (join->state == State::kLooking) {
      looking.push_back(join);
    }
  }
  for (const auto& join : looking) {
    const auto announcement =
        discovery::decode_announcement(data, join->pairing.secret);
    if (!announcement) {
      continue;
    }
    const std::string at = where(address, announcement->port);
    if (join->attempts.contains(at)) {
      join->rediscovered.insert(at);
    } else {
      try_address(join, address, announcement->port);
    }
  }
}

void LanJoins::retry() {
  std::vector<JoinPointer> looking;
  for (const auto& [computer_id, join] : joins_) {
    if (join->state == State::kLooking) {
      looking.push_back(join);
    }
  }
  for (const auto& join : looking) {
    look(join);
  }
}

void LanJoins::close_all() {
  std::vector<std::string> ids;
  for (const auto& [computer_id, join] : joins_) {
    ids.push_back(computer_id);
  }
  for (const auto& computer_id : ids) {
    leave(computer_id);
  }
}

}  // namespace feq::share::service

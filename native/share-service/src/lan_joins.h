/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * Every computer whose code was pasted here, kept linked for good
 * (`remoteAudioLanJoins.ts`, whose comment says the whole of it):
 *
 *  - LOOKING: every address the code names is tried at once, and so is any
 *    address the computer is heard announcing itself from. The first
 *    connection to authenticate is kept and the rest are dropped. Nothing
 *    is tried again on a timer: a computer that is away is found when it
 *    announces itself.
 *  - CONNECTED: until that connection closes, then LOOKING again.
 *  - ASLEEP: the two computers each pasted the other's code and the other
 *    computer's connection is the one kept (`inbound_arrived`). It wakes
 *    when that connection ends.
 */

#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include "fluideq/share/json.h"
#include "fluideq/share/lan_protocol.h"
#include "lan_join.h"
#include "loop.h"

namespace feq::share::service {

namespace json = feq::share::json;

/** `ILanPairingPayload`: a code, or a saved link standing in for one. */
struct JoinPairing {
  /** Introduced pair: the stable id belongs to the endpoint, not this
   * scoped secret. Never encoded in a public pairing code. */
  std::optional<std::string> computer_id;
  bool introduced = false;
  std::string address;
  std::vector<std::string> addresses;
  std::string device_name;
  int port = 0;
  std::string secret;
};

class LanJoins : public std::enable_shared_from_this<LanJoins> {
 public:
  struct Deps {
    std::function<void(const std::string& peer_id,
                       const std::shared_ptr<WebSocket>& socket,
                       const lan::Key& session_key)>
        attach;
    std::function<void(const json::Value& message)> emit_signal;
    /** This computer's own id and name, as it gives them when it joins. */
    std::function<std::pair<std::string, std::string>()> self;
    /** Sends a "who is there?" for one secret; nothing without a network. */
    std::function<void(const std::string& secret)> ask_who_is_there;
    /** A connection from that computer to this one is open. */
    std::function<bool(const std::string& computer_id)> inbound_live;
    /** One try at one address: `join_at`, unless a test answers instead. */
    std::function<JoinAttempt(const JoinHandshake& handshake)> join_at =
        service::join_at;
  };

  explicit LanJoins(Deps deps) : deps_(std::move(deps)) {}

  /** Keeps a link to the computer whose code this is; its id. */
  std::string join(const JoinPairing& pairing, bool fresh);
  void leave(const std::string& computer_id);
  bool has(const std::string& computer_id) const {
    return joins_.contains(computer_id);
  }
  /** True once it is linked again, false when no address answered. */
  Future<bool> reconnect(const std::string& computer_id);
  /** The peer id of the open connection to that computer, if any. */
  std::optional<std::string> peer_of(const std::string& computer_id) const;
  /**
   * A computer this one also joined has connected to it. Of the two
   * connections between one pair, the one whose JOINING computer has the
   * smaller id is kept. `false` means refuse it (`CLOSE_ALREADY_LINKED`).
   */
  bool inbound_arrived(const std::string& computer_id);
  /** The last connection from that computer closed. */
  void inbound_closed(const std::string& computer_id);
  /** A datagram on the discovery port: perhaps one we are looking for. */
  void heard(std::span<const std::uint8_t> data, const std::string& address);
  /** The network is back: every computer still away is looked for now. */
  void retry();
  void close_all();

 private:
  enum class State { kLooking, kConnected, kAsleep };

  struct Restored {
    std::vector<std::string> addresses;
    int port = 0;
  };

  struct Join {
    std::string computer_id;
    JoinPairing pairing;
    lan::Key pairing_key{};
    /** The first connection after a paste says so, once. */
    bool fresh = false;
    int port = 0;
    State state = State::kLooking;
    /** One per round of looking: a listener reached on two addresses at
     * once accepts only one of them. */
    std::string peer_id;
    std::map<std::string, std::function<void()>> attempts;
    std::set<std::string> authenticating;
    /** A newer authenticated announcement arrived during this attempt. */
    std::set<std::string> rediscovered;
    /** One saved public code can name another reachable endpoint than the
     * pair book; both bounded candidate sets are kept. */
    std::optional<Restored> restored;
    std::shared_ptr<WebSocket> socket;
    std::optional<std::string> last_address;
    /** Who asked by hand to reconnect, told how the round ends. */
    std::vector<Future<bool>> waiters;
  };

  using JoinPointer = std::shared_ptr<Join>;

  bool current(const JoinPointer& join) const;
  void settle(const JoinPointer& join, bool linked);
  void cancel_attempts(const JoinPointer& join);
  void sleep(const JoinPointer& join);
  void try_address(const JoinPointer& join, const std::string& address,
                   int port);
  void joined(const JoinPointer& join, const std::string& at,
              const std::string& peer_id, int port,
              const JoinedSocket& result);
  void failed(const JoinPointer& join, const std::string& at,
              const std::string& address, int port,
              const std::string& peer_id, const Failure& failure);
  void probe(const JoinPointer& join);
  void look(const JoinPointer& join);

  Deps deps_;
  std::map<std::string, JoinPointer> joins_;
};

}  // namespace feq::share::service

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The joins, case for case as the TypeScript's were held to them
// (`remoteAudioLanJoins.test.ts`), with each try at an address answered by
// the test: every address tried at once, the first to answer kept, one link
// per pair chosen the same way at both ends, asleep while the other's link
// stands, a refusal that keeps the code, a newer round never undone by an
// older one's answer, a fresh hint worth one try and a forged one none, and
// a failure logged by its system code and never its words.

#include <algorithm>
#include <cstdio>
#include <memory>
#include <set>
#include <string>
#include <vector>

#include "fluideq/share/discovery.h"
#include "fluideq/share/lan_protocol.h"
#include "lan_joins.h"
#include "io.h"
#include "service_log.h"

namespace {

namespace service = feq::share::service;
namespace lan = feq::share::lan;
namespace discovery = feq::share::discovery;
namespace json = feq::share::json;
using service::Failure;
using service::Future;
using service::JoinedSocket;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

service::JoinPairing pairing(const std::string& secret) {
  const auto decoded = lan::decode_pairing_code(lan::encode_pairing_code(
      {"192.168.1.20", "10.0.0.20"}, 49100, secret, "OTHER"));
  service::JoinPairing out;
  out.address = decoded->address;
  out.addresses = decoded->addresses;
  out.device_name = decoded->device_name;
  out.port = decoded->port;
  out.secret = decoded->secret;
  return out;
}

/** Each try the joins made, and the means to answer it. */
struct Attempt {
  service::JoinHandshake handshake;
  Future<JoinedSocket> joined;
  int cancels = 0;
};

struct Fixture {
  service::Loop loop;
  std::vector<std::shared_ptr<Attempt>> attempts;
  std::vector<std::string> attached;
  std::vector<json::Value> signals;
  std::vector<std::string> asked;
  bool inbound_live = false;
  std::shared_ptr<service::LanJoins> joins;

  explicit Fixture(const std::string& self_id, bool live = false)
      : inbound_live(live) {
    service::set_loop(&loop);
    service::LanJoins::Deps deps;
    deps.attach = [this](const std::string& peer_id,
                         const std::shared_ptr<service::WebSocket>&,
                         const lan::Key&) { attached.push_back(peer_id); };
    deps.emit_signal = [this](const json::Value& message) {
      signals.push_back(message);
    };
    deps.self = [self_id] { return std::make_pair(self_id, std::string("ME")); };
    deps.ask_who_is_there = [this](const std::string& secret) {
      asked.push_back(secret);
    };
    deps.inbound_live = [this](const std::string&) { return inbound_live; };
    deps.join_at = [this](const service::JoinHandshake& handshake) {
      auto attempt = std::make_shared<Attempt>();
      attempt->handshake = handshake;
      attempts.push_back(attempt);
      return service::JoinAttempt{attempt->joined,
                                  [attempt] { attempt->cancels += 1; }};
    };
    joins = std::make_shared<service::LanJoins>(std::move(deps));
  }

  /** A socket for an answered try: never connected, closed by the test. */
  static std::shared_ptr<service::WebSocket> socket() {
    return std::make_shared<service::WebSocket>(false, 1024);
  }

  void answer(std::size_t at, const std::string& address) {
    attempts[at]->joined.resolve(JoinedSocket{address, socket(), {}});
    loop.drain_deferred();
  }

  void refuse(std::size_t at, int close_code = 0, const std::string& code = {}) {
    Failure failure;
    failure.message = "refused";
    failure.close_code = close_code;
    failure.code = code;
    attempts[at]->joined.reject(failure);
    loop.drain_deferred();
  }
};

const std::string kOther = std::string(43, 'b');

/** The joins log every failure; the cases here fail on purpose. */
void quiet(const std::string&) {}

void every_address_at_once() {
  Fixture fixture(std::string(32, 'm'));
  fixture.joins->join(pairing(std::string(43, 'a')), true);
  std::vector<std::string> addresses;
  std::set<std::string> peers;
  for (const auto& attempt : fixture.attempts) {
    addresses.push_back(attempt->handshake.address);
    peers.insert(attempt->handshake.peer_id);
  }
  std::sort(addresses.begin(), addresses.end());
  check(addresses == std::vector<std::string>{"10.0.0.20", "192.168.1.20"},
        "every address in the code is tried at once");
  check(fixture.attempts[0]->handshake.fresh, "a paste says it is fresh");
  check(peers.size() == 1, "one peer id for the round");
  check(fixture.asked == std::vector<std::string>{std::string(43, 'a')},
        "and the network is asked who is there");
}

void first_to_answer() {
  Fixture fixture(std::string(32, 'm'));
  const std::string id = fixture.joins->join(pairing(std::string(43, 'a')), true);
  fixture.answer(0, "192.168.1.20");
  check(fixture.attempts[1]->cancels == 1, "the slower try is dropped");
  check(fixture.attached.size() == 1, "the first answer is attached");
  check(fixture.joins->peer_of(id).has_value(), "and is the link");
  const json::Value* signal =
      fixture.signals.empty() ? nullptr : fixture.signals[0].get("signal");
  check(signal != nullptr && *json::string_at(*signal, "kind") == "peer-ready" &&
            signal->get("joined") != nullptr && signal->get("joined")->as_bool(),
        "a joined link is announced as joined");
}

void one_link_per_pair() {
  const std::string small(32, '-');
  const std::string large(32, 'z');
  const std::string their_id = lan::computer_id_of(kOther);
  const auto connected = [](Fixture& fixture) {
    fixture.joins->join(pairing(kOther), false);
    fixture.answer(0, "192.168.1.20");
  };
  Fixture below(small);
  connected(below);
  Fixture above(large);
  connected(above);
  check(!below.joins->inbound_arrived(their_id),
        "below them, this computer's own link is kept and theirs refused");
  service::set_loop(&above.loop);
  check(above.joins->inbound_arrived(their_id),
        "above them, theirs is let in");
  check(!above.joins->peer_of(their_id).has_value(),
        "and this one's own goes to sleep");
}

void asleep_until_theirs_ends() {
  Fixture fixture(std::string(32, 'm'), true);
  fixture.joins->join(pairing(std::string(43, 'c')), false);
  check(fixture.attempts.empty(), "nothing is tried while their link stands");
  fixture.joins->inbound_closed(lan::computer_id_of(std::string(43, 'c')));
  check(!fixture.attempts.empty(), "and it looks again once it ends");
}

void direction_chosen_early() {
  {
    Fixture below(std::string(32, '-'));
    below.joins->join(pairing(kOther), false);
    below.attempts[0]->handshake.on_challenge();
    check(!below.joins->inbound_arrived(lan::computer_id_of(kOther)),
          "an answered challenge below them keeps this one's try");
    check(std::all_of(below.attempts.begin(), below.attempts.end(),
                      [](const auto& attempt) { return attempt->cancels == 0; }),
          "and cancels none of it");
  }
  Fixture above(std::string(32, 'z'));
  above.joins->join(pairing(kOther), false);
  above.attempts[0]->handshake.on_challenge();
  check(above.joins->inbound_arrived(lan::computer_id_of(kOther)),
        "above them, theirs is let in");
  check(std::all_of(above.attempts.begin(), above.attempts.end(),
                    [](const auto& attempt) { return attempt->cancels == 1; }),
        "and every try of this one's is cancelled");
}

void stale_address_does_not_block() {
  Fixture fixture(std::string(32, '-'));
  fixture.joins->join(pairing(kOther), false);
  check(fixture.joins->inbound_arrived(lan::computer_id_of(kOther)),
        "a peer whose old address never answered is let in");
  check(std::all_of(fixture.attempts.begin(), fixture.attempts.end(),
                    [](const auto& attempt) { return attempt->cancels == 1; }),
        "and the silent tries are dropped");
}

void refusal_keeps_the_code() {
  Fixture fixture(std::string(32, 'm'));
  const std::string id = fixture.joins->join(pairing(kOther), false);
  fixture.refuse(0, service::kCloseForget);
  fixture.refuse(1, service::kCloseForget);
  check(fixture.joins->has(id), "a bare close is no unlink: the code stays");
  const std::size_t before = fixture.attempts.size();
  fixture.joins->retry();
  check(fixture.attempts.size() == before + 2, "and it can be tried again");
}

void newer_round_not_undone() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  fixture.joins->retry();
  fixture.inbound_live = true;
  fixture.refuse(0, service::kCloseAlreadyLinked);
  check(fixture.attempts[2]->cancels == 0 && fixture.attempts[3]->cancels == 0,
        "an older round's refusal leaves the newer round alone");
  fixture.joins->join(target, false);
  check(fixture.attempts.size() == 4, "and adds no try of its own");
}

void endpoint_refreshed(bool scoped) {
  Fixture fixture(std::string(32, 'm'));
  auto first = pairing(kOther);
  if (scoped) {
    first.computer_id = lan::computer_id_of(kOther);
  }
  fixture.joins->join(first, false);
  auto moved = first;
  moved.address = "192.168.1.99";
  moved.addresses = {"192.168.1.99"};
  moved.port = 49900;
  fixture.joins->join(moved, true);
  check(fixture.attempts[0]->cancels == 1 && fixture.attempts[1]->cancels == 1,
        "today's code replaces yesterday's tries");
  check(fixture.attempts.size() == 3 &&
            fixture.attempts[2]->handshake.address == "192.168.1.99" &&
            fixture.attempts[2]->handshake.port == 49900 &&
            fixture.attempts[2]->handshake.fresh &&
            fixture.attempts[2]->handshake.ticket == scoped,
        std::string("the new endpoint is tried at once (scoped: ") +
            (scoped ? "yes)" : "no)"));
  fixture.joins->close_all();
}

void repairing_starts_a_new_round() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  fixture.joins->join(target, true);
  check(fixture.attempts.size() == 4 && fixture.attempts[2]->handshake.fresh &&
            fixture.attempts[2]->handshake.peer_id !=
                fixture.attempts[0]->handshake.peer_id,
        "a deliberate re-pairing is a new handshake, even to the same place");
  fixture.joins->close_all();
}

void both_endpoint_sources(bool scoped) {
  Fixture fixture(std::string(32, 'm'));
  const auto original = pairing(kOther);
  auto current = original;
  current.address = "192.168.1.99";
  current.addresses = {"192.168.1.99"};
  current.port = 49900;
  if (scoped) {
    current.computer_id = lan::computer_id_of(original.secret);
    current.secret = std::string(43, 'c');
  }
  fixture.joins->join(current, false);
  fixture.joins->join(original, false);
  const std::size_t before = fixture.attempts.size();
  fixture.joins->retry();
  std::vector<std::shared_ptr<Attempt>> round(fixture.attempts.begin() +
                                                  static_cast<std::ptrdiff_t>(before),
                                              fixture.attempts.end());
  check(round.size() == 3 && round[0]->handshake.address == current.address &&
            round[0]->handshake.port == current.port &&
            !round[0]->handshake.fresh && !round[0]->handshake.ticket,
        "the saved endpoint is tried first");
  check(std::any_of(round.begin(), round.end(),
                    [&original](const auto& attempt) {
                      return attempt->handshake.address == original.address &&
                             attempt->handshake.port == original.port &&
                             !attempt->handshake.fresh &&
                             !attempt->handshake.ticket;
                    }),
        "and the code's own is kept beside it");
  check(fixture.joins->has(lan::computer_id_of(original.secret)),
        "the pair book's link stays");
  fixture.joins->close_all();
}

void live_link_learns_its_next_endpoint() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  const std::string id = fixture.joins->join(target, false);
  const auto socket = Fixture::socket();
  fixture.attempts[0]->joined.resolve(JoinedSocket{target.address, socket, {}});
  fixture.loop.drain_deferred();
  auto moved = target;
  moved.port = 49900;
  fixture.joins->join(moved, true);
  check(fixture.joins->peer_of(id).has_value(), "the live link is kept");
  check(fixture.attached.size() == 1, "and not attached twice");
  check(fixture.attempts.size() == 2, "nothing new is tried while it stands");
  socket->on_close.emit(1006);
  fixture.loop.drain_deferred();
  check(fixture.attempts.size() > 2 && fixture.attempts[2]->handshake.port == 49900,
        "when it ends, the endpoint learned is tried");
  fixture.joins->close_all();
}

std::vector<std::uint8_t> announcement(const service::JoinPairing& target,
                                       const std::string& secret) {
  return discovery::encode_announcement(secret, target.port, target.device_name);
}

void one_hint_one_try() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  const auto heard = announcement(target, target.secret);
  fixture.joins->heard(heard, target.address);
  fixture.joins->heard(heard, target.address);
  fixture.refuse(0, 0, "ECONNREFUSED");
  check(fixture.attempts.size() == 3 &&
            fixture.attempts[2]->handshake.address == target.address,
        "an announcement heard while a try fails buys one more try");
  check(fixture.signals.empty(), "and announces nothing");
  fixture.refuse(2);
  check(fixture.attempts.size() == 3, "one, not a loop");
  fixture.joins->close_all();
}

void forged_hint_no_try() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  fixture.joins->heard(announcement(target, "wrong-secret"), target.address);
  fixture.refuse(0);
  fixture.refuse(1);
  check(fixture.attempts.size() == 2, "a forged announcement buys nothing");
  fixture.joins->close_all();
}

void public_announcement_ignored() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  const auto genuine = announcement(target, target.secret);
  fixture.joins->heard(genuine, "8.8.8.8");
  check(fixture.attempts.size() == 2,
        "a genuine announcement from a public address is not followed");
  fixture.joins->heard(genuine, "192.168.1.77");
  check(fixture.attempts.size() == 3 &&
            fixture.attempts[2]->handshake.address == "192.168.1.77",
        "the control: the same announcement from a private one is");
  fixture.joins->close_all();
}

void refusal_beats_a_hint(int code) {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  const std::string id = fixture.joins->join(target, false);
  fixture.joins->heard(announcement(target, target.secret), target.address);
  fixture.refuse(0, code);
  check(fixture.attempts.size() == 2 && fixture.joins->has(id) &&
            !fixture.joins->peer_of(id).has_value(),
        "an explicit refusal (" + std::to_string(code) +
            ") is not retried on a hint");
  fixture.joins->close_all();
}

void cancelled_round_hints_discarded() {
  Fixture fixture(std::string(32, 'm'));
  const auto target = pairing(kOther);
  fixture.joins->join(target, false);
  fixture.joins->heard(announcement(target, target.secret), target.address);
  fixture.joins->retry();
  fixture.refuse(0);
  fixture.refuse(2);
  check(fixture.attempts.size() == 4,
        "a hint from a cancelled round buys the new round nothing");
  fixture.joins->close_all();
}

void logged_without_words() {
  std::vector<std::string> lines;
  service::set_log_sink([&lines](const std::string& line) { lines.push_back(line); });
  {
    Fixture fixture(std::string(32, 'm'));
    const auto target = pairing(kOther);
    const std::string id = fixture.joins->join(target, false);
    Failure failure;
    failure.message = "Secret error: " + target.secret;
    failure.code = "ECONNREFUSED";
    fixture.attempts[0]->joined.reject(failure);
    fixture.loop.drain_deferred();
    const std::string expected =
        "{\"message\":\"Share Audio peer connection failed; saved pairing "
        "retained\",\"detail\":{\"computerId\":\"" +
        id + "\",\"address\":\"" + target.address +
        "\",\"port\":49100,\"stage\":\"connection\",\"code\":\"ECONNREFUSED\"}}";
    check(std::find(lines.begin(), lines.end(), expected) != lines.end(),
          "a failure is logged by where and its system code");
    check(std::none_of(lines.begin(), lines.end(),
                       [&target](const std::string& line) {
                         return line.find(target.secret) != std::string::npos;
                       }),
          "never by its words");
    fixture.joins->close_all();
  }
  service::set_log_sink(quiet);
}

}  // namespace

int main() {
  service::set_log_sink(quiet);
  every_address_at_once();
  first_to_answer();
  one_link_per_pair();
  asleep_until_theirs_ends();
  direction_chosen_early();
  stale_address_does_not_block();
  refusal_keeps_the_code();
  newer_round_not_undone();
  endpoint_refreshed(false);
  endpoint_refreshed(true);
  repairing_starts_a_new_round();
  both_endpoint_sources(false);
  both_endpoint_sources(true);
  live_link_learns_its_next_endpoint();
  one_hint_one_try();
  forged_hint_no_try();
  public_announcement_ignored();
  refusal_beats_a_hint(1008);
  refusal_beats_a_hint(service::kCloseForget);
  refusal_beats_a_hint(service::kCloseAlreadyLinked);
  cancelled_round_hints_discarded();
  logged_without_words();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("share joins: the TypeScript joins' rules, in C++\n");
  return 0;
}

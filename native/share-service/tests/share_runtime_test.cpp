/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The Share Audio service's runtime with stand-ins for the network, the
// capture, the player and the LAN audio helper — each case the one the
// TypeScript runtime was held to (`shareAudioRuntime.test.ts`,
// `shareAudioHelperRouting.test.ts`, `shareAudioLeasePool.test.ts`), so
// the C++ that replaced it keeps every rule it kept: PCM never waits for a
// meter's credit, a stalled page bounds what waits, a reopened page's older
// snapshot loses nothing, each computer plays at its own volume, a remote
// pause holds before main hears of it, a failed player or capture recovers
// alone, and a failure leaves with its system code and never its words.

#include "runtime_fixture.h"

namespace {

using namespace runtime_fixture;

void pcm_stays_inside() {
  Fixture fixture;
  fixture.start_lan();
  fixture.request("playback.start");
  fixture.routing({"one", "two"}, {{"one", 1}});
  fixture.request("capture.start");
  for (std::uint32_t sequence = 0; sequence < 600; sequence += 1) {
    fixture.captured(chunk("", sequence));
    fixture.arrive(chunk("one", sequence));
  }
  check(fixture.lan->sent.size() == 1200,
        "every capture goes to both computers while no meter credit returns");
  check(fixture.player->pushed.size() == 600 &&
            fixture.player->pushed[599].sequence == 599,
        "every arriving chunk plays, in order");
  check(fixture.events("capture") == 1,
        "one meter sample in flight while the page withholds its credit");
  check(fixture.events("streaming") == 1, "streaming is said once");
}

void older_snapshot_keeps_the_book() {
  Fixture fixture;
  fixture.start_lan();
  const json::Value link = json::Value::object({
      {"computerId", json::Value::string(std::string(32, 'a'))},
      {"issuer", json::Value::string(std::string(32, 'b'))},
      {"secret", json::Value::string("public-fixture-only________________________")},
      {"deviceName", json::Value::string("Fixture peer")},
      {"port", json::Value::number(9001)},
      {"addresses", json::Value::array({json::Value::string("127.0.0.1")})},
  });
  fixture.book->revoke("old-computer");
  fixture.book->save_group_link(link);
  fixture.loop.drain_deferred();
  fixture.start_lan();
  check(fixture.book->is_revoked("old-computer"),
        "a revocation survives an older snapshot");
  const auto links = fixture.book->group_links();
  check(links.size() == 1 && json::stringify(links[0]) == json::stringify(link),
        "a saved link survives an older snapshot");
  check(fixture.lan->stops == 0, "starting again keeps the link up");
}

void independent_gains() {
  Fixture fixture;
  fixture.start_lan();
  fixture.request("playback.start");
  fixture.routing({}, {{"one", 0.5}, {"two", 1}});
  const lan::AudioChunk audio = chunk();
  fixture.arrive(audio);
  fixture.arrive(chunk("two"));
  fixture.arrive(chunk("three"));
  check(fixture.player->pushed.size() == 2, "a computer not listened to is not played");
  check(first_sample(fixture.player->pushed[0]) == 0.125f,
        "one plays at half volume");
  check(first_sample(fixture.player->pushed[1]) == 0.25f,
        "two plays at full volume, untouched");
  check(first_sample(audio) == 0.25f, "the arriving chunk itself is not changed");
  fixture.routing({}, {{"two", 1}});
  fixture.arrive(chunk());
  check(fixture.player->removed == std::vector<std::string>{"one"},
        "a computer no longer listened to leaves the player");
  check(fixture.player->pushed.size() == 2, "and its sound is not played");
  fixture.request("streams.replay");
  fixture.arrive(chunk("two"));
  check(fixture.events("streaming") == 3,
        "a reloaded window hears streaming said again");
}

void revocation_limit() {
  Fixture fixture;
  fixture.start_lan();
  for (int index = 0; index < 64; index += 1) {
    fixture.book->revoke(std::to_string(index));
    fixture.loop.drain_deferred();
  }
  fixture.book->revoke("0");
  fixture.loop.drain_deferred();
  fixture.book->revoke("64");
  fixture.loop.drain_deferred();
  check(fixture.book->is_revoked("0"), "a repeated unlink is refreshed");
  check(!fixture.book->is_revoked("1"), "the oldest goes past 64");
  check(fixture.book->is_revoked("64"), "the newest is kept");
}

void capture_failing_while_opening() {
  Fixture fixture;
  fixture.fail_next_capture_open = true;
  check(fixture.failed(fixture.request("capture.start")),
        "a capture that fails while it opens is refused");
  fixture.start_lan();
  fixture.routing({"one"}, {});
  check(!fixture.failed(fixture.request("capture.start")),
        "and a fresh one opens cleanly");
  fixture.captured(chunk());
  check(fixture.capture_opens == 2, "two opens");
  check(fixture.capture_closes == 1, "the failed one was closed");
  check(fixture.lan->sent.size() == 1, "the fresh one sends");
}

void remote_pause_first() {
  Fixture fixture;
  fixture.start_lan();
  fixture.request("playback.start");
  fixture.routing({}, {{"one", 1}, {"two", 1}});
  fixture.signal(json::Value::object({
      {"peerId", json::Value::string("one")},
      {"signal", json::Value::object({
                     {"kind", json::Value::string("stream-mode")},
                     {"mode", json::Value::string("video")},
                     {"duplex", json::Value::object(
                                    {{"sends", json::Value::boolean(false)},
                                     {"plays", json::Value::boolean(true)}})},
                 })},
  }));
  fixture.arrive(chunk());
  fixture.arrive(chunk("two"));
  check(fixture.player->pushed.size() == 1 &&
            fixture.player->pushed[0].peer_id == "two",
        "a computer that paused is not played, the other is");
  fixture.routing({}, {{"one", 1}, {"two", 1}});
  fixture.arrive(chunk());
  check(fixture.player->pushed.size() == 1,
        "main routing it again does not override its pause");
}

void preview_cadence() {
  Fixture fixture;
  const double id = fixture.value_of(fixture.request("capture.start"));
  std::vector<double> emitted_at;
  std::size_t seen = 0;
  for (std::uint32_t sequence = 0; sequence < 200; sequence += 1) {
    fixture.captured(chunk("", sequence));
    const std::size_t captures = fixture.events("capture");
    if (captures > seen) {
      emitted_at.push_back((sequence + 1) * 5.0);
      seen = captures;
      fixture.credit_back("capture:" + json::number_text(id));
    }
  }
  bool close_enough = true;
  for (std::size_t at = 1; at < emitted_at.size(); at += 1) {
    close_enough = close_enough && emitted_at[at] - emitted_at[at - 1] <= 20;
  }
  check(emitted_at.size() > 40, "a full preview often enough");
  check(close_enough, "never more than 20 ms apart");
}

void old_player_close() {
  Fixture fixture;
  fixture.start_lan();
  const double old = fixture.value_of(fixture.request("playback.start"));
  const double current = fixture.value_of(fixture.request("playback.start"));
  fixture.request("capture.start");
  fixture.routing({"one"}, {{"one", 1}});
  fixture.request("playback.close", {json::Value::number(old)});
  fixture.captured(chunk());
  fixture.arrive(chunk());
  check(fixture.lan->sent.size() == 1, "the capture still sends");
  check(fixture.player->pushed.size() == 1, "the replacement still plays");
  check(fixture.capture_closes == 0, "the capture was not stopped");
  check(!fixture.failed(fixture.request("playback.close", {json::Value::number(current)})),
        "the replacement closes by itself");
}

void failed_player_recovers() {
  Fixture fixture;
  fixture.start_lan();
  fixture.request("playback.start");
  fixture.request("capture.start");
  fixture.routing({"two"}, {{"one", 1}});
  fixture.player_failed();
  fixture.loop.drain_deferred();
  fixture.signal(json::Value::object(
      {{"peerId", json::Value::string("one")},
       {"signal", json::Value::object({{"kind", json::Value::string("stop")}})}}));
  fixture.captured(chunk("", 0));
  check(fixture.lan->sent.size() == 1, "the capture keeps sending");
  check(fixture.lan->stops == 0, "the network keeps running");
  check(fixture.capture_closes == 0, "the capture keeps running");
  fixture.request("playback.start");
  fixture.routing({"two"}, {{"one", 1}});
  fixture.arrive(chunk());
  check(fixture.player->pushed.size() == 1, "a new player plays");
}

void failure_words() {
  Fixture fixture;
  Failure taken;
  taken.message = "listen EADDRINUSE pairing secret s3cr3t";
  taken.code = "EADDRINUSE";
  taken.syscall = "listen";
  fixture.lan->fail_start = taken;
  const WireMessage first = fixture.request(
      "lan.start", {json::Value::null(),
                    json::Value::object({{"revoked", json::Value::array()},
                                         {"links", json::Value::array()}})});
  const std::string first_text = json::stringify(first.json);
  check(fixture.failed(first) &&
            first_text.find("\"code\":\"EADDRINUSE\"") != std::string::npos &&
            first_text.find("\"syscall\":\"listen\"") != std::string::npos,
        "a failed start carries the system's code and call");
  check(first_text.find("s3cr3t") == std::string::npos, "never its words");
  Failure plain;
  plain.message = "pairing secret s3cr3t";
  plain.code = "not a code: s3cr3t";
  fixture.lan->fail_start = plain;
  const WireMessage second = fixture.request(
      "lan.start", {json::Value::null(),
                    json::Value::object({{"revoked", json::Value::array()},
                                         {"links", json::Value::array()}})});
  const std::string second_text = json::stringify(second.json);
  check(fixture.failed(second) && second.json.get("code") == nullptr &&
            second.json.get("syscall") == nullptr,
        "a code that could carry text is not forwarded");
  check(second_text.find("s3cr3t") == std::string::npos, "nor its words");
}

struct FakeLease : service::HelperLease {
  std::uint32_t native_id = 20;
  std::optional<Failure> fail_next;
  int sends = 0;
  int releases = 0;
  Request request(std::uint32_t, const std::optional<service::Bytes>&) override {
    native_id += 1;
    if (fail_next) {
      const Failure failure = *fail_next;
      fail_next.reset();
      return Request{native_id, Future<Nothing>::rejected(failure)};
    }
    return Request{native_id, Future<Nothing>::resolved(Nothing{})};
  }
  void send(const service::Bytes&) override { sends += 1; }
  std::uint32_t version() const override { return 2; }
  void release() override { releases += 1; }
};

void helper_routing() {
  Fixture fixture;
  auto lease = std::make_shared<FakeLease>();
  std::vector<std::shared_ptr<service::AudioClient>> clients;
  // Not possible through the fixture's ports once built: a runtime of its
  // own, with a helper and no network.
  service::RuntimePorts ports;
  ports.lease_helper = [&clients, lease](std::shared_ptr<service::AudioClient> client) {
    clients.push_back(client);
    return Future<std::shared_ptr<service::HelperLease>>::resolved(lease);
  };
  ports.helper_pid = [] { return std::optional<std::uint32_t>(12345); };
  ports.now = [] { return 0.0; };
  fixture.runtime = std::make_unique<service::ShareRuntime>(service::ShareRuntime::Deps{
      [&fixture](WireMessage message) {
        const std::string* type = json::string_at(message.json, "type");
        const std::string* credit = json::string_at(message.json, "credit");
        if (type != nullptr && *type == "answer") {
          fixture.answers[*json::integer_at(message.json, "id")] = message;
        }
        if (credit != nullptr) {
          const std::string key = *credit;
          fixture.loop.defer([&fixture, key] { fixture.credit_back(key); });
        }
        fixture.messages.push_back(std::move(message));
      },
      [] {},
      false,
      std::move(ports)});
  const WireMessage first = fixture.request("helper.lease");
  const WireMessage second = fixture.request("helper.lease");
  const double first_id = *json::integer_at(*first.json.get("value"), "id");
  const double second_id = *json::integer_at(*second.json.get("value"), "id");
  fixture.request("helper.request", {json::Value::number(first_id), json::Value::number(99),
                                     json::Value::number(8), json::Value::null()});
  service::PlaybackReply reply;
  reply.kind = 9;
  reply.id = 21;
  for (const auto& client : clients) {
    client->reply(reply);
  }
  fixture.loop.drain_deferred();
  std::vector<const WireMessage*> exits;
  for (const auto& message : fixture.messages) {
    const json::Value* event = message.json.get("event");
    const std::string* kind =
        event != nullptr ? json::string_at(*event, "type") : nullptr;
    if (kind != nullptr && *kind == "helper-reply") {
      exits.push_back(&message);
    }
  }
  const json::Value* exit_event =
      exits.size() == 1 ? exits[0]->json.get("event") : nullptr;
  check(exit_event != nullptr &&
            json::integer_at(*exit_event, "id") == first_id &&
            json::integer_at(*exit_event->get("reply"), "id") == 99,
        "a capture's exit reaches only its own lease, under main's own id");
  Failure refused;
  refused.message = "Capture could not start";
  lease->fail_next = refused;
  check(fixture.failed(fixture.request(
            "helper.request", {json::Value::number(first_id), json::Value::number(100),
                               json::Value::number(8), json::Value::null()})),
        "a capture that could not start is refused");
  reply.id = 22;
  for (const auto& client : clients) {
    client->reply(reply);
  }
  fixture.loop.drain_deferred();
  check(fixture.events("helper-reply") == 1,
        "the exit of a capture that never started reaches nobody");
  fixture.request("helper.release", {json::Value::number(first_id)});
  fixture.request("helper.send", {json::Value::number(second_id),
                                  json::Value::object({{"$bin", json::Value::number(0)},
                                                       {"$as", json::Value::string("Uint8Array")}})},
                  {service::Bytes{1}});
  check(lease->sends == 1, "a packet goes to its lease");
  check(lease->releases == 1, "a release reaches its lease");
}

}  // namespace

int main() {
  pcm_stays_inside();
  older_snapshot_keeps_the_book();
  independent_gains();
  revocation_limit();
  capture_failing_while_opening();
  remote_pause_first();
  preview_cadence();
  old_player_close();
  failed_player_recovers();
  failure_words();
  helper_routing();
  return verdict("share runtime: the TypeScript runtime's rules, in C++");
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The runtime's parts on their own, as the TypeScript's were held to them
// (`shareAudioRuntime.test.ts`, `shareAudioLeasePool.test.ts`): a stalled
// page bounds what waits for it, control events keep their order and end
// the service past 128, and the lease pool shares one owner, finishes a
// close before a replacement opens and recovers from a failed open.

#include "runtime_fixture.h"

namespace {

using namespace runtime_fixture;

void telemetry_bounds() {
  service::Loop loop;
  service::set_loop(&loop);
  std::vector<WireMessage> posted;
  service::AudioTelemetry telemetry(
      [&posted](WireMessage message) { posted.push_back(std::move(message)); },
      [] {});
  for (std::uint32_t sequence = 0; sequence < 10000; sequence += 1) {
    telemetry.send("capture:1",
                   WireMessage{json::Value::object(
                                   {{"type", json::Value::string("capture")},
                                    {"sequence", json::Value::number(sequence)}}),
                               {}});
  }
  check(posted.size() == 1, "one sample in flight while no credit returns");
  telemetry.credit("capture:1");
  const json::Value* event =
      posted.size() == 2 ? posted[1].json.get("event") : nullptr;
  check(event != nullptr && json::integer_at(*event, "sequence") == 9999,
        "the credit sends the newest sample, and only that");
  telemetry.credit("capture:1");
  check(posted.size() == 2, "nothing waits after it");
}

void reliable_bounds() {
  service::Loop loop;
  service::set_loop(&loop);
  std::vector<WireMessage> posted;
  bool overflowed = false;
  service::AudioTelemetry telemetry(
      [&posted](WireMessage message) { posted.push_back(std::move(message)); },
      [&overflowed] { overflowed = true; });
  for (int index = 0; index < 129; index += 1) {
    telemetry.send_reliable(WireMessage{
        json::Value::object({{"type", json::Value::string("book")},
                             {"value", json::Value::string(std::to_string(index))}}),
        {}});
  }
  check(posted.size() == 1, "one control event in flight");
  bool threw = false;
  try {
    telemetry.send_reliable(WireMessage{
        json::Value::object({{"type", json::Value::string("lan-failed")}}), {}});
  } catch (const service::LinkError& error) {
    threw = std::string(error.what()).find("queue is full") != std::string::npos;
  }
  check(threw && overflowed, "past 128 waiting the service ends");
  for (int index = 0; index < 129; index += 1) {
    telemetry.credit("control");
  }
  bool in_order = posted.size() == 129;
  for (std::size_t at = 0; in_order && at < posted.size(); at += 1) {
    const json::Value* event = posted[at].json.get("event");
    in_order = event != nullptr &&
               *json::string_at(*event, "value") == std::to_string(at);
  }
  check(in_order, "control events keep their order");
}

void lease_pool() {
  service::Loop loop;
  service::set_loop(&loop);
  {
    int starts = 0;
    int closes = 0;
    service::LeasePool<int> pool(
        [&starts](auto) {
          starts += 1;
          return Future<int>::resolved(7);
        },
        [&closes](const int&) {
          closes += 1;
          return Future<Nothing>::resolved(Nothing{});
        });
    pool.acquire(1);
    pool.acquire(2);
    loop.drain_deferred();
    check(starts == 1 && pool.get(2) == 7, "overlapping leases share one owner");
    pool.release(1);
    loop.drain_deferred();
    check(closes == 0, "the owner stays while a lease holds it");
    pool.release(2);
    loop.drain_deferred();
    check(closes == 1, "the last lease closes it");
  }
  {
    int starts = 0;
    Future<Nothing> closed;
    service::LeasePool<int> pool(
        [&starts](auto) {
          starts += 1;
          return Future<int>::resolved(1);
        },
        [closed](const int&) { return closed; });
    pool.acquire(1);
    loop.drain_deferred();
    pool.release(1);
    pool.acquire(2);
    loop.drain_deferred();
    check(starts == 1, "a replacement waits for the old close");
    closed.resolve(Nothing{});
    loop.drain_deferred();
    check(starts == 2, "and opens once it has finished");
  }
  {
    int starts = 0;
    service::LeasePool<int> pool(
        [&starts](auto) {
          starts += 1;
          if (starts == 1) {
            Failure failure;
            failure.message = "device unavailable";
            return Future<int>::rejected(failure);
          }
          return Future<int>::resolved(1);
        },
        [](const int&) { return Future<Nothing>::resolved(Nothing{}); });
    bool refused = false;
    pool.acquire(1).then([&refused](const Future<Nothing>::Result& result) {
      refused = result.index() == 1 &&
                std::get<1>(result).message == "device unavailable";
    });
    loop.drain_deferred();
    check(refused, "a failed open is reported");
    for (int id = 2; id < 18; id += 1) {
      pool.acquire(id);
    }
    loop.drain_deferred();
    bool limited = false;
    pool.acquire(99).then([&limited](const Future<Nothing>::Result& result) {
      limited = result.index() == 1;
    });
    loop.drain_deferred();
    check(limited, "no more than 16 leases");
    bool closed = false;
    try {
      pool.get(1);
    } catch (const service::LinkError&) {
      closed = true;
    }
    check(closed, "the failed lease holds nothing");
  }
}

}  // namespace

int main() {
  telemetry_bounds();
  reliable_bounds();
  lease_pool();
  return verdict("share runtime parts: the TypeScript's bounds, in C++");
}

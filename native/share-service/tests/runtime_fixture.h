/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

// The runtime with stand-ins for its network, capture and player, as the
// TypeScript runtime's tests built it (`share_runtime_test.cpp`).

#include <cstdio>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "link_error.h"
#include "loop.h"
#include "runtime_parts.h"
#include "share_ports.h"
#include "share_runtime.h"

namespace runtime_fixture {

namespace service = feq::share::service;
namespace json = feq::share::json;
namespace lan = feq::share::lan;
using service::Failure;
using service::Future;
using service::Nothing;
using service::WireMessage;

inline int failures = 0;

inline void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

/** The test's exit: 0 when every check held. */
inline int verdict(const char* passed) {
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("%s\n", passed);
  return 0;
}

lan::AudioChunk chunk(const std::string& peer_id = "one",
                      std::uint32_t sequence = 0) {
  lan::AudioChunk value;
  value.peer_id = peer_id;
  value.sequence = sequence;
  value.channels = 2;
  value.frames = 240;
  value.sample_rate = 48000;
  value.pcm.resize(480 * 4);
  for (std::size_t at = 0; at < 480; at += 1) {
    const float sample = 0.25f;
    std::memcpy(value.pcm.data() + at * 4, &sample, 4);
  }
  return value;
}

float first_sample(const lan::AudioChunk& value) {
  float sample = 0;
  std::memcpy(&sample, value.pcm.data(), 4);
  return sample;
}

struct FakeLan : service::Lan {
  std::vector<lan::AudioChunk> sent;
  int stops = 0;
  std::optional<Failure> fail_start;
  Future<json::Value> start(const std::optional<service::HostCredentials>&) override {
    if (fail_start) {
      const Failure failure = *fail_start;
      fail_start.reset();
      return Future<json::Value>::rejected(failure);
    }
    return Future<json::Value>::resolved(json::Value::object({
        {"credentials", json::Value::object({{"port", json::Value::number(9000)},
                                             {"secret", json::Value::string("fixture")}})},
    }));
  }
  void join(const json::Value&, bool) override {}
  void unlink(const std::optional<std::string>&,
              const std::optional<std::string>&) override {}
  Future<bool> reconnect(const std::optional<std::string>&,
                         const std::optional<std::string>&) override {
    return Future<bool>::resolved(false);
  }
  void retry() override {}
  void send_signal(const json::Value&) override {}
  void send_audio(const lan::AudioChunk& value) override { sent.push_back(value); }
  void set_stream_mode(const std::string&, bool) override {}
  void stop() override { stops += 1; }
};

struct FakePlayer : service::Playback {
  std::vector<lan::AudioChunk> pushed;
  std::vector<std::string> removed;
  void push(const lan::AudioChunk& value) override { pushed.push_back(value); }
  void remove(const std::string& peer_id) override { removed.push_back(peer_id); }
  void reset() override {}
  void set_volume(double) override {}
  void set_smooth(const std::string&, bool) override {}
  Future<Nothing> set_output(const std::string&) override {
    return Future<Nothing>::resolved(Nothing{});
  }
  Future<Nothing> close() override { return Future<Nothing>::resolved(Nothing{}); }
};

struct FakeCapture : service::NetworkCapture {
  int* closes;
  explicit FakeCapture(int* counter) : closes(counter) {}
  void close() override { *closes += 1; }
};

struct Fixture {
  service::Loop loop;
  std::vector<WireMessage> messages;
  std::map<double, WireMessage> answers;
  double clock = 0;
  std::shared_ptr<FakeLan> lan = std::make_shared<FakeLan>();
  std::shared_ptr<FakePlayer> player = std::make_shared<FakePlayer>();
  int capture_opens = 0;
  int capture_closes = 0;
  bool fail_next_capture_open = false;
  std::function<void(const lan::AudioChunk&)> capture;
  std::function<void()> player_failed;
  service::LanEvents lan_events;
  std::optional<service::LinkBook> book;
  std::unique_ptr<service::ShareRuntime> runtime;
  double next_id = 0;

  Fixture() {
    service::set_loop(&loop);
    service::RuntimePorts ports;
    ports.create_lan = [this](service::LanEvents events, service::LinkBook given) {
      lan_events = std::move(events);
      book = std::move(given);
      return std::static_pointer_cast<service::Lan>(lan);
    };
    ports.start_capture = [this](std::function<void(const lan::AudioChunk&)> audio,
                                 std::function<void()> failed) {
      capture_opens += 1;
      capture = std::move(audio);
      if (fail_next_capture_open) {
        fail_next_capture_open = false;
        failed();
      }
      return Future<std::shared_ptr<service::NetworkCapture>>::resolved(
          std::make_shared<FakeCapture>(&capture_closes));
    };
    ports.start_playback = [this](std::function<void(const service::PlaybackMeter&)>,
                                  std::function<void()> failed) {
      player_failed = std::move(failed);
      return Future<std::shared_ptr<service::Playback>>::resolved(player);
    };
    ports.helper_pid = [] { return std::optional<std::uint32_t>(); };
    ports.now = [this] { return clock; };
    runtime = std::make_unique<service::ShareRuntime>(service::ShareRuntime::Deps{
        [this](WireMessage message) {
          const std::string* type = json::string_at(message.json, "type");
          const std::string* credit = json::string_at(message.json, "credit");
          if (type != nullptr && *type == "answer") {
            answers[*json::integer_at(message.json, "id")] = message;
          }
          if (credit != nullptr && *credit == "control") {
            loop.defer([this] { credit_back("control"); });
          }
          messages.push_back(std::move(message));
        },
        [] {},
        false,
        std::move(ports)});
  }

  void credit_back(const std::string& key) {
    runtime->handle(WireMessage{
        json::Value::object({{"type", json::Value::string("credit")},
                             {"key", json::Value::string(key)}}),
        {}});
  }

  /** A request, answered once every microtask it started has run. */
  WireMessage request(const std::string& method, std::vector<json::Value> args = {},
                      std::vector<service::Bytes> parts = {}) {
    next_id += 1;
    const double id = next_id;
    runtime->handle(WireMessage{
        json::Value::object({{"type", json::Value::string("request")},
                             {"id", json::Value::number(id)},
                             {"method", json::Value::string(method)},
                             {"args", json::Value::array(std::move(args))}}),
        std::move(parts)});
    loop.drain_deferred();
    const auto found = answers.find(id);
    return found != answers.end() ? found->second : WireMessage{};
  }

  bool failed(const WireMessage& answer) const {
    return answer.json.get("error") != nullptr;
  }

  double value_of(const WireMessage& answer) const {
    const json::Value* value = answer.json.get("value");
    return value != nullptr && value->is_number() ? value->as_number() : -1;
  }

  void start_lan() {
    request("lan.start",
            {json::Value::null(),
             json::Value::object({{"revoked", json::Value::array()},
                                  {"links", json::Value::array()}})});
  }

  void routing(std::vector<std::string> targets,
               std::vector<std::pair<std::string, double>> receive) {
    std::vector<json::Value> target_list;
    for (const auto& target : targets) {
      target_list.push_back(json::Value::string(target));
    }
    std::vector<json::Value> receive_list;
    for (const auto& [peer_id, volume] : receive) {
      receive_list.push_back(json::Value::object(
          {{"peerId", json::Value::string(peer_id)},
           {"volume", json::Value::number(volume)}}));
    }
    request("routing", {json::Value::object(
                           {{"targets", json::Value::array(std::move(target_list))},
                            {"receive", json::Value::array(std::move(receive_list))},
                            {"smooth", json::Value::boolean(false)}})});
  }

  void captured(const lan::AudioChunk& value) {
    clock += 5;
    capture(value);
    loop.drain_deferred();
  }

  void arrive(const lan::AudioChunk& value) {
    lan_events.emit_audio(value);
    loop.drain_deferred();
  }

  void signal(const json::Value& message) {
    lan_events.emit_signal(message);
    loop.drain_deferred();
  }

  std::size_t events(const std::string& type) const {
    std::size_t count = 0;
    for (const auto& message : messages) {
      const json::Value* event = message.json.get("event");
      const std::string* kind =
          event != nullptr ? json::string_at(*event, "type") : nullptr;
      if (kind != nullptr && *kind == type) {
        count += 1;
      }
    }
    return count;
  }
};

}  // namespace runtime_fixture

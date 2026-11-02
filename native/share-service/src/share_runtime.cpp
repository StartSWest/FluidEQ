/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The runtime's events and sound: the link's and the players' events sent
// with the telemetry's credit, the book kept and told, this computer's
// capture sent to every computer it sends to, and every other computer's
// sound played at its own volume. Its requests are
// `share_runtime_requests.cpp`.

#include "share_runtime.h"

#include <algorithm>
#include <cctype>
#include <cstring>

#include "fluideq/share/signals.h"
#include "link_error.h"
#include "share_runtime_internal.h"

namespace feq::share::service {
namespace {

using runtime_detail::number;
using runtime_detail::optional_text;
using runtime_detail::text;

/** /^[A-Za-z][A-Za-z0-9_]{0,39}$/: a system word, never a message. */
bool system_word(const std::string& word) {
  if (word.empty() || word.size() > 40 ||
      std::isalpha(static_cast<unsigned char>(word[0])) == 0) {
    return false;
  }
  return std::all_of(word.begin(), word.end(), [](char c) {
    return std::isalnum(static_cast<unsigned char>(c)) != 0 || c == '_';
  });
}

/** `{peerId, sequence, sampleRate, channels, frames, pcm}` for main. */
json::Value chunk_json(WireMessage& message, const lan::AudioChunk& chunk) {
  return json::Value::object({
      {"peerId", text(chunk.peer_id)},
      {"sampleRate", number(chunk.sample_rate)},
      {"channels", number(chunk.channels)},
      {"frames", number(chunk.frames)},
      {"sequence", number(chunk.sequence)},
      {"pcm", message.attach(chunk.pcm, "ArrayBuffer")},
  });
}

}  // namespace

ShareRuntime::ShareRuntime(Deps deps)
    : deps_(std::move(deps)),
      telemetry_(deps_.post, deps_.on_fatal),
      // A smooth link may queue more on its way out before it is called
      // stuck; its sound here plays with the smooth cushion (`arriving`).
      smooth_links_([this](const std::string& peer_id, bool smooth) {
        if (lan_) {
          lan_->set_stream_mode(peer_id, smooth);
        }
      }),
      captures_(
          [this](LeasePool<std::shared_ptr<NetworkCapture>>::Ids ids) {
            last_meter_at_ = 0;
            preview_ = AudioPreview{};
            return deps_.ports.start_capture(
                [this, ids](const lan::AudioChunk& chunk) {
                  const std::vector<int> active = ids();
                  if (!active.empty()) {
                    captured(chunk, active);
                  }
                },
                [this, ids] { fail_capture(ids()); });
          },
          [](const std::shared_ptr<NetworkCapture>& capture) {
            capture->close();
            return Future<Nothing>::resolved(Nothing{});
          }),
      players_(
          [this](LeasePool<std::shared_ptr<Playback>>::Ids ids) {
            return deps_.ports.start_playback(
                [this, ids](const PlaybackMeter& meter) {
                  for (const int id : ids()) {
                    WireMessage message;
                    std::vector<std::uint8_t> waveform(meter.waveform.size() * 4);
                    std::memcpy(waveform.data(), meter.waveform.data(),
                                waveform.size());
                    json::Value meter_json = json::Value::object({
                        {"sourceId", text(meter.source_id)},
                        {"bufferedMs", number(meter.buffered_ms)},
                        {"peak", number(meter.peak)},
                        {"rms", number(meter.rms)},
                        {"waveform", message.attach(std::move(waveform),
                                                    "Float32Array")},
                    });
                    message.json = json::Value::object({
                        {"type", text("meter")},
                        {"id", number(id)},
                        {"meter", std::move(meter_json)},
                    });
                    telemetry_.send("meter:" + std::to_string(id) + ":" +
                                        meter.source_id,
                                    std::move(message));
                  }
                },
                [this, ids] { fail_player(ids()); });
          },
          [](const std::shared_ptr<Playback>& player) {
            return player->close();
          }) {}

ShareRuntime::~ShareRuntime() {
  if (lan_) {
    lan_->stop();
  }
}

void ShareRuntime::event(WireMessage message) {
  telemetry_.send_reliable(std::move(message));
}

void ShareRuntime::event(json::Value json) {
  event(WireMessage{std::move(json), {}});
}

void ShareRuntime::helper_pid_event() {
  json::Value message = json::Value::object({{"type", text("helper-pid")}});
  if (const auto pid = deps_.ports.helper_pid()) {
    message.set("pid", number(*pid));
  }
  event(std::move(message));
}

void ShareRuntime::fail_capture(const std::vector<int>& ids) {
  for (const int id : ids) {
    event(json::Value::object(
        {{"type", text("capture-failed")}, {"id", number(id)}}));
    telemetry_.forget("capture:" + std::to_string(id));
    captures_.release(id);
  }
}

void ShareRuntime::fail_player(const std::vector<int>& ids) {
  for (const int id : ids) {
    event(json::Value::object(
        {{"type", text("playback-failed")}, {"id", number(id)}}));
    players_.release(id);
    if (playing_ == id) {
      playing_ = 0;
    }
  }
}

void ShareRuntime::remove_from_player(const std::string& peer_id) {
  if (playing_ == 0) {
    return;
  }
  try {
    players_.get(playing_)->remove(peer_id);
  } catch (const LinkError&) {
    fail_player({playing_});
  }
}

void ShareRuntime::captured(const lan::AudioChunk& chunk,
                            const std::vector<int>& active) {
  for (const auto& peer_id : targets_) {
    const auto plays = remote_plays_.find(peer_id);
    if (plays != remote_plays_.end() && !plays->second) {
      continue;
    }
    try {
      if (lan_) {
        lan::AudioChunk addressed = chunk;
        addressed.peer_id = peer_id;
        lan_->send_audio(addressed);
      }
    } catch (const LinkError&) {
      // Its close signal removes a link that has just gone.
    }
  }
  preview_.push(chunk);
  const double at = deps_.ports.now();
  // Feed analysis faster than its 33 ms display pulls. At 35 ms a healthy
  // stream could otherwise be mistaken for stopped audio.
  if (at - last_meter_at_ < 16) {
    return;
  }
  const auto frame = preview_.read();
  if (!frame) {
    return;
  }
  last_meter_at_ = at;
  for (const int id : active) {
    WireMessage message;
    json::Value chunk_value = chunk_json(message, *frame);
    message.json = json::Value::object({
        {"type", text("capture")},
        {"id", number(id)},
        {"chunk", std::move(chunk_value)},
    });
    telemetry_.send("capture:" + std::to_string(id), std::move(message));
  }
}

void ShareRuntime::arriving(const lan::AudioChunk& chunk) {
  const auto volume = receive_.find(chunk.peer_id);
  const auto sends = remote_sends_.find(chunk.peer_id);
  if (volume == receive_.end() || playing_ == 0 ||
      (sends != remote_sends_.end() && !sends->second)) {
    return;
  }
  try {
    const auto& player = players_.get(playing_);
    // Told with every chunk, so a player opened after the switch moved
    // learns it before the sound it plays; the player keeps only changes.
    player->set_smooth(chunk.peer_id, smooth_links_.smooth(chunk.peer_id));
    player->push(levels_.apply(chunk, volume->second));
    if (!streaming_.contains(chunk.peer_id)) {
      streaming_.insert(chunk.peer_id);
      event(json::Value::object(
          {{"type", text("streaming")}, {"peerId", text(chunk.peer_id)}}));
    }
  } catch (const LinkError&) {
    fail_player({playing_});
  }
}

void ShareRuntime::link_signal(const json::Value& message) {
  const std::string peer_id = optional_text(message, "peerId").value_or("");
  const json::Value* signal = message.get("signal");
  const std::string kind =
      signal != nullptr ? optional_text(*signal, "kind").value_or("") : "";
  const json::Value* duplex =
      signal != nullptr ? signal->get("duplex") : nullptr;
  const auto duplex_flag = [duplex](std::string_view key) -> std::optional<bool> {
    const json::Value* flag =
        duplex != nullptr && duplex->is_object() ? duplex->get(key) : nullptr;
    return flag != nullptr && flag->is_bool() ? std::optional(flag->as_bool())
                                              : std::nullopt;
  };
  if (kind == "stop") {
    remote_sends_.erase(peer_id);
    remote_plays_.erase(peer_id);
    smooth_links_.forget(peer_id);
  } else if (kind == "stream-mode") {
    smooth_links_.heard(peer_id, optional_text(*signal, "mode").value_or(""));
  }
  if (kind == "stream-mode" && duplex != nullptr && duplex->is_object()) {
    if (const auto sends = duplex_flag("sends")) {
      remote_sends_[peer_id] = *sends;
    }
    if (const auto plays = duplex_flag("plays")) {
      remote_plays_[peer_id] = *plays;
    }
  }
  if (kind == "stop" ||
      (kind == "stream-mode" && duplex_flag("plays") == false)) {
    std::erase(targets_, peer_id);
  }
  if (kind == "stop" ||
      (kind == "stream-mode" && duplex_flag("sends") == false)) {
    receive_.erase(peer_id);
    streaming_.erase(peer_id);
    levels_.forget(peer_id);
    remove_from_player(peer_id);
  }
  event(json::Value::object({{"type", text("signal")}, {"message", message}}));
}

std::shared_ptr<Lan> ShareRuntime::network() {
  if (lan_) {
    return lan_;
  }
  LinkBook book;
  book.group_links = [this] { return links_; };
  book.save_group_link = [this](const json::Value& link) {
    const std::string id = optional_text(link, "computerId").value_or("");
    std::erase_if(links_, [&id](const json::Value& kept) {
      return optional_text(kept, "computerId").value_or("") == id;
    });
    links_.push_back(link);
    if (links_.size() > signals::kMaxGroupComputers) {
      links_.erase(links_.begin(),
                   links_.end() - static_cast<std::ptrdiff_t>(
                                      signals::kMaxGroupComputers));
    }
    event(json::Value::object({{"type", text("book-link")}, {"link", link}}));
  };
  book.is_revoked = [this](const std::string& id) {
    return std::find(revoked_.begin(), revoked_.end(), id) != revoked_.end();
  };
  book.revoke = [this](const std::string& id) {
    std::erase(revoked_, id);
    revoked_.push_back(id);
    if (revoked_.size() > signals::kMaxRevokedComputers) {
      revoked_.erase(revoked_.begin());
    }
    event(json::Value::object({{"type", text("book")},
                               {"operation", text("revoke")},
                               {"value", text(id)}}));
  };
  book.unrevoke = [this](const std::string& id) {
    std::erase(revoked_, id);
    event(json::Value::object({{"type", text("book")},
                               {"operation", text("unrevoke")},
                               {"value", text(id)}}));
  };
  book.forget_join = [this](const std::string& id) {
    std::erase_if(links_, [&id](const json::Value& link) {
      return optional_text(link, "computerId").value_or("") == id;
    });
    event(json::Value::object({{"type", text("book")},
                               {"operation", text("forget")},
                               {"value", text(id)}}));
  };
  lan_ = deps_.ports.create_lan(
      LanEvents{
          [this](const json::Value& message) { link_signal(message); },
          [this](const lan::AudioChunk& chunk) { arriving(chunk); },
          [this] { event(json::Value::object({{"type", text("lan-failed")}})); },
          [this](const json::Value& stats) {
            telemetry_.send(
                "network:" + optional_text(stats, "direction").value_or("") +
                    ":" + optional_text(stats, "peerId").value_or(""),
                WireMessage{json::Value::object({{"type", text("network")},
                                                 {"stats", stats}}),
                            {}});
          }},
      std::move(book));
  return lan_;
}

void ShareRuntime::handle(const WireMessage& message) {
  const std::string type = optional_text(message.json, "type").value_or("");
  if (type == "credit") {
    telemetry_.credit(optional_text(message.json, "key").value_or(""));
    return;
  }
  const auto id = json::integer_at(message.json, "id");
  if (type != "request" || !id) {
    return;
  }
  const double request_id = *id;
  Answer answer;
  try {
    answer = execute(optional_text(message.json, "method").value_or(""),
                     message.json.get("args") != nullptr
                         ? *message.json.get("args")
                         : json::Value::array(),
                     message);
  } catch (const LinkError& error) {
    answer = Answer::rejected(error.failure());
  }
  const auto post = deps_.post;
  answer.then([post, request_id](const Answer::Result& result) {
    json::Value reply = json::Value::object({
        {"type", text("answer")},
        {"id", number(request_id)},
    });
    if (result.index() == 0) {
      if (std::get<0>(result)) {
        reply.set("value", *std::get<0>(result));
      }
    } else {
      // Never forward the failure's own words: pairing and authentication
      // parsing can fill them with secrets. The system's code is not one.
      const Failure& failure = std::get<1>(result);
      reply.set("error", text("Share Audio operation failed."));
      if (system_word(failure.code)) {
        reply.set("code", text(failure.code));
      }
      if (system_word(failure.syscall)) {
        reply.set("syscall", text(failure.syscall));
      }
    }
    post(WireMessage{std::move(reply), {}});
  });
}

}  // namespace feq::share::service

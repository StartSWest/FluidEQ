/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The runtime's requests (`execute` in `shareAudio/runtime.ts`): each of
// main's calls run, and the LAN audio helper's leases kept apart by the
// id main gave them.

#include <algorithm>
#include <cmath>

#include "fluideq/share/signals.h"
#include "link_error.h"
#include "share_runtime.h"
#include "share_runtime_internal.h"

namespace feq::share::service {
namespace {

using runtime_detail::number;
using runtime_detail::optional_text;
using runtime_detail::text;

using Answer = Future<std::optional<json::Value>>;

const json::Value& arg(const json::Value& args, std::size_t index) {
  static const json::Value kNull;
  if (!args.is_array() || index >= args.items().size()) {
    return kNull;
  }
  return args.items()[index];
}

int id_arg(const json::Value& args, std::size_t index) {
  const json::Value& value = arg(args, index);
  if (!value.is_number() || std::trunc(value.as_number()) != value.as_number()) {
    throw LinkError("Invalid Share Audio command.");
  }
  return static_cast<int>(value.as_number());
}

std::string string_arg(const json::Value& args, std::size_t index) {
  const json::Value& value = arg(args, index);
  if (!value.is_string()) {
    throw LinkError("Invalid Share Audio command.");
  }
  return value.as_string();
}

/** A chunk main sent, with its samples beside it in the frame. */
lan::AudioChunk chunk_of(const json::Value& value, const WireMessage& message) {
  const Bytes* pcm = message.part(value.get("pcm"));
  const auto sequence = json::integer_at(value, "sequence");
  const auto rate = json::integer_at(value, "sampleRate");
  const auto channels = json::integer_at(value, "channels");
  const auto frames = json::integer_at(value, "frames");
  const std::string* peer = json::string_at(value, "peerId");
  if (pcm == nullptr || !sequence || !rate || !channels || !frames ||
      peer == nullptr || *sequence < 0 || *sequence > 0xFFFFFFFFu ||
      *rate < 0 || *rate > 0xFFFFFFFFu || *channels < 1 || *channels > 8 ||
      *frames < 1 || *frames > 8192 ||
      pcm->size() != static_cast<std::size_t>(*frames * *channels * 4)) {
    throw LinkError("Invalid LAN audio chunk.");
  }
  lan::AudioChunk chunk;
  chunk.peer_id = *peer;
  chunk.sequence = static_cast<std::uint32_t>(*sequence);
  chunk.sample_rate = static_cast<std::uint32_t>(*rate);
  chunk.channels = static_cast<std::uint8_t>(*channels);
  chunk.frames = static_cast<std::uint16_t>(*frames);
  chunk.pcm = *pcm;
  return chunk;
}

Answer done(std::optional<json::Value> value = std::nullopt) {
  return Answer::resolved(std::move(value));
}

/** An answer that settles as `future` does, with nothing in it. */
Answer settled(const Future<Nothing>& future) {
  Answer answer;
  future.then([answer](const Future<Nothing>::Result& result) {
    if (result.index() == 0) {
      answer.resolve(std::nullopt);
    } else {
      answer.reject(std::get<1>(result));
    }
  });
  return answer;
}

}  // namespace

ShareRuntime::Answer ShareRuntime::helper_lease() {
  if (leases_.size() >= 16 || aliases_.size() >= 16) {
    throw LinkError("Share Audio helper lease limit reached.");
  }
  next_id_ += 1;
  const int id = next_id_;
  auto requests = std::make_shared<std::map<std::uint32_t, std::uint32_t>>();
  aliases_[id] = requests;
  auto client = std::make_shared<AudioClient>(AudioClient{
      [this, id, requests](const PlaybackReply& reply) {
        std::optional<std::uint32_t> alias;
        if (reply.kind == 9) {
          const auto found = requests->find(reply.id);
          // Child exits are broadcast by the native helper. Only the lease
          // that started that child can translate its native id back.
          if (found == requests->end()) {
            return;
          }
          alias = found->second;
          requests->erase(found);
        }
        WireMessage message;
        json::Value reply_json = json::Value::object({
            {"kind", number(reply.kind)},
            {"id", number(alias.value_or(reply.id))},
            {"rate", number(reply.rate)},
            {"frames", number(reply.frames)},
        });
        if (reply.channels) {
          reply_json.set("channels", number(*reply.channels));
        }
        reply_json.set("payload", message.attach(reply.payload, "Uint8Array"));
        message.json = json::Value::object({
            {"type", text("helper-reply")},
            {"id", number(id)},
            {"reply", std::move(reply_json)},
        });
        if (reply.kind == 5) {
          telemetry_.send("helper:" + std::to_string(id) + ":" +
                              std::to_string(reply.id),
                          std::move(message));
        } else {
          event(std::move(message));
        }
      },
      [this, id](const Failure&) {
        leases_.erase(id);
        aliases_.erase(id);
        event(json::Value::object(
            {{"type", text("helper-stopped")}, {"id", number(id)}}));
      }});
  Answer answer;
  deps_.ports.lease_helper(client).then(
      [this, id, answer](const Future<std::shared_ptr<HelperLease>>::Result& leased) {
        if (leased.index() == 1) {
          aliases_.erase(id);
          answer.reject(std::get<1>(leased));
          return;
        }
        const auto lease = std::get<0>(leased);
        leases_[id] = lease;
        helper_pid_event();
        json::Value value = json::Value::object({{"id", number(id)}});
        if (const auto pid = deps_.ports.helper_pid()) {
          value.set("pid", number(*pid));
        }
        value.set("version", number(lease->version()));
        answer.resolve(std::move(value));
      });
  return answer;
}

ShareRuntime::Answer ShareRuntime::helper_request(const json::Value& args,
                                                  const WireMessage& message) {
  const int id = id_arg(args, 0);
  const auto alias = static_cast<std::uint32_t>(id_arg(args, 1));
  const auto kind = static_cast<std::uint32_t>(id_arg(args, 2));
  const auto found = leases_.find(id);
  if (found == leases_.end()) {
    throw LinkError("The LAN audio helper stopped.");
  }
  const auto requests = aliases_[id];
  if (kind == 8 && requests && requests->size() >= 16) {
    throw LinkError("Share Audio capture request limit reached.");
  }
  const Bytes* payload = message.part(&arg(args, 3));
  const auto sent = found->second->request(
      kind, payload != nullptr ? std::optional<Bytes>(*payload) : std::nullopt);
  if (kind == 8 && requests) {
    (*requests)[sent.id] = alias;
  }
  Answer answer;
  const std::uint32_t native_id = sent.id;
  sent.answered.then([answer, requests, native_id](const Future<Nothing>::Result& result) {
    if (result.index() == 1) {
      if (requests) {
        requests->erase(native_id);
      }
      answer.reject(std::get<1>(result));
      return;
    }
    answer.resolve(std::nullopt);
  });
  return answer;
}

ShareRuntime::Answer ShareRuntime::execute(const std::string& method,
                                           const json::Value& args,
                                           const WireMessage& message) {
  if (method == "status") {
    return done(json::Value::object(
        {{"scheduling", json::Value::boolean(deps_.scheduling)}}));
  }
  if (method == "lan.start") {
    const json::Value& credentials = arg(args, 0);
    const json::Value& saved = arg(args, 1);
    // Opening the page again asks for today's addresses. Its main-side
    // snapshot can precede a queued pairing write, so only the first start
    // may seed this owner's current link/revocation state.
    if (!saved_book_loaded_) {
      if (const json::Value* revoked = saved.get("revoked");
          revoked != nullptr && revoked->is_array()) {
        const auto& items = revoked->items();
        const std::size_t from =
            items.size() > signals::kMaxRevokedComputers
                ? items.size() - signals::kMaxRevokedComputers
                : 0;
        for (std::size_t at = from; at < items.size(); at += 1) {
          if (items[at].is_string() &&
              std::find(revoked_.begin(), revoked_.end(),
                        items[at].as_string()) == revoked_.end()) {
            revoked_.push_back(items[at].as_string());
          }
        }
      }
      links_.clear();
      if (const json::Value* links = saved.get("links");
          links != nullptr && links->is_array()) {
        const auto& items = links->items();
        const std::size_t from =
            items.size() > signals::kMaxGroupComputers
                ? items.size() - signals::kMaxGroupComputers
                : 0;
        links_.assign(items.begin() + static_cast<std::ptrdiff_t>(from),
                      items.end());
      }
      saved_book_loaded_ = true;
    }
    std::optional<HostCredentials> given;
    if (credentials.is_object()) {
      const auto port = json::integer_at(credentials, "port");
      const std::string* secret = json::string_at(credentials, "secret");
      if (!port || secret == nullptr) {
        throw LinkError("Invalid Share Audio command.");
      }
      given = HostCredentials{static_cast<int>(*port), *secret};
    }
    return network()->start(given).map<std::optional<json::Value>>(
        [](const json::Value& session) { return std::optional(session); });
  }
  if (method == "lan.join") {
    const json::Value& fresh = arg(args, 1);
    network()->join(arg(args, 0), fresh.is_bool() && fresh.as_bool());
    return done();
  }
  if (method == "lan.unlink" || method == "lan.reconnect") {
    const json::Value& target = arg(args, 0);
    const auto peer_id = optional_text(target, "peerId");
    const auto computer_id = optional_text(target, "computerId");
    if (method == "lan.unlink") {
      network()->unlink(peer_id, computer_id);
      return done();
    }
    return network()->reconnect(peer_id, computer_id).map<std::optional<json::Value>>(
        [](const bool& linked) {
          return std::optional(json::Value::boolean(linked));
        });
  }
  if (method == "lan.signal") {
    network()->send_signal(arg(args, 0));
    return done();
  }
  if (method == "lan.audio") {
    network()->send_audio(chunk_of(arg(args, 0), message));
    return done();
  }
  if (method == "lan.retry") {
    if (lan_) {
      lan_->retry();
    }
    return done();
  }
  if (method == "streams.replay") {
    streaming_.clear();
    return done();
  }
  if (method == "lan.stop") {
    if (lan_) {
      lan_->stop();
    }
    lan_.reset();
    smooth_links_.clear();
    return done();
  }
  if (method == "routing") {
    const json::Value& routing = arg(args, 0);
    targets_.clear();
    if (const json::Value* targets = routing.get("targets");
        targets != nullptr && targets->is_array()) {
      for (const auto& target : targets->items()) {
        if (target.is_string()) {
          targets_.push_back(target.as_string());
        }
      }
    }
    const json::Value* smooth = routing.get("smooth");
    smooth_links_.set_local(smooth != nullptr && smooth->is_bool() &&
                            smooth->as_bool());
    std::vector<std::string> before;
    for (const auto& [peer_id, volume] : receive_) {
      before.push_back(peer_id);
    }
    receive_.clear();
    if (const json::Value* receive = routing.get("receive");
        receive != nullptr && receive->is_array()) {
      for (const auto& entry : receive->items()) {
        const auto peer_id = optional_text(entry, "peerId");
        const json::Value* volume = entry.get("volume");
        if (peer_id && volume != nullptr && volume->is_number()) {
          receive_[*peer_id] = volume->as_number();
        }
      }
    }
    for (const auto& peer_id : before) {
      if (!receive_.contains(peer_id)) {
        streaming_.erase(peer_id);
        remove_from_player(peer_id);
      }
    }
    return done();
  }
  if (method == "capture.start") {
    next_id_ += 1;
    const int id = next_id_;
    Answer answer;
    captures_.acquire(id).then([this, id, answer](const Future<Nothing>::Result& result) {
      if (result.index() == 1) {
        answer.reject(std::get<1>(result));
        return;
      }
      helper_pid_event();
      answer.resolve(json::Value::number(id));
    });
    return answer;
  }
  if (method == "capture.close") {
    const int id = id_arg(args, 0);
    Answer answer;
    captures_.release(id).then([this, id, answer](const Future<Nothing>::Result& result) {
      if (result.index() == 1) {
        answer.reject(std::get<1>(result));
        return;
      }
      helper_pid_event();
      telemetry_.forget("capture:" + std::to_string(id));
      answer.resolve(std::nullopt);
    });
    return answer;
  }
  if (method == "playback.start") {
    next_id_ += 1;
    const int id = next_id_;
    Answer answer;
    players_.acquire(id).then([this, id, answer](const Future<Nothing>::Result& result) {
      if (result.index() == 1) {
        answer.reject(std::get<1>(result));
        return;
      }
      helper_pid_event();
      playing_ = id;
      answer.resolve(json::Value::number(id));
    });
    return answer;
  }
  if (method == "playback.push") {
    players_.get(id_arg(args, 0))->push(chunk_of(arg(args, 1), message));
    return done();
  }
  if (method == "playback.remove") {
    players_.get(id_arg(args, 0))->remove(string_arg(args, 1));
    return done();
  }
  if (method == "playback.reset") {
    players_.get(id_arg(args, 0))->reset();
    streaming_.clear();
    return done();
  }
  if (method == "playback.volume") {
    const json::Value& volume = arg(args, 1);
    players_.get(id_arg(args, 0))
        ->set_volume(volume.is_number() ? volume.as_number() : -1);
    return done();
  }
  if (method == "playback.smooth") {
    const json::Value& smooth = arg(args, 2);
    players_.get(id_arg(args, 0))
        ->set_smooth(string_arg(args, 1), smooth.is_bool() && smooth.as_bool());
    return done();
  }
  if (method == "playback.output") {
    return settled(players_.get(id_arg(args, 0))->set_output(string_arg(args, 1)));
  }
  if (method == "playback.close") {
    const int id = id_arg(args, 0);
    if (playing_ == id) {
      playing_ = 0;
      streaming_.clear();
    }
    Answer answer;
    players_.release(id).then([this, answer](const Future<Nothing>::Result& result) {
      if (result.index() == 1) {
        answer.reject(std::get<1>(result));
        return;
      }
      helper_pid_event();
      answer.resolve(std::nullopt);
    });
    return answer;
  }
  if (method == "helper.lease") {
    return helper_lease();
  }
  if (method == "helper.request") {
    return helper_request(args, message);
  }
  if (method == "helper.send") {
    const int id = id_arg(args, 0);
    const auto found = leases_.find(id);
    const Bytes* packet = message.part(&arg(args, 1));
    if (found == leases_.end() || packet == nullptr) {
      throw LinkError("The LAN audio helper stopped.");
    }
    found->second->send(*packet);
    return done();
  }
  if (method == "helper.release") {
    const int id = id_arg(args, 0);
    const auto found = leases_.find(id);
    if (found != leases_.end()) {
      found->second->release();
    }
    leases_.erase(id);
    aliases_.erase(id);
    helper_pid_event();
    return done();
  }
  throw LinkError("Invalid Share Audio command.");
}

}  // namespace feq::share::service

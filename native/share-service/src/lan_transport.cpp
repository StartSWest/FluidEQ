/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lan_transport.h"

#include <cmath>
#include <vector>

#include "link_error.h"

namespace feq::share::service {
namespace {

constexpr auto kReportInterval = std::chrono::nanoseconds(250'000'000);
/**
 * How much may wait to go out before a link is called stuck: about 0.7 s
 * of 48 kHz stereo, and 2.7 s for a computer that asked for smooth
 * playback, whose cushion rides out a stall that long.
 */
constexpr std::size_t kMaxSocketBufferBytes = 256 * 1024;
constexpr std::size_t kMaxSmoothSocketBufferBytes = 1024 * 1024;

/** `Math.round`: halves go up, as JavaScript rounds them. */
double js_round(double value) { return std::floor(value + 0.5); }

}  // namespace

void NetworkMeter::record(const std::string& peer_id,
                          const std::string& direction, double bytes,
                          double queued_bytes,
                          double queued_audio_milliseconds) {
  const std::string key = direction + ":" + peer_id;
  const Clock::time_point recorded_at = now_();
  auto found = windows_.find(key);
  Window current = found != windows_.end() ? found->second
                                           : Window{0, recorded_at};
  current.bytes += bytes;
  const auto elapsed = std::chrono::duration_cast<std::chrono::nanoseconds>(
      recorded_at - current.started_at);
  if (elapsed < kReportInterval) {
    windows_[key] = current;
    return;
  }
  const double bytes_per_second = js_round(
      (current.bytes * 1'000'000'000.0) / static_cast<double>(elapsed.count()));
  emit_(json::Value::object({
      {"bytesPerSecond", json::Value::number(bytes_per_second)},
      {"direction", json::Value::string(direction)},
      {"peerId", json::Value::string(peer_id)},
      {"queuedBytes", json::Value::number(queued_bytes)},
      {"queuedMilliseconds",
       json::Value::number(js_round(
           queued_audio_milliseconds +
           (queued_bytes / std::max(1.0, bytes_per_second)) * 1000.0))},
  }));
  windows_[key] = Window{0, recorded_at};
}

LanTransport::LanTransport(Options options)
    : options_(std::move(options)), meter_(options_.emit_network) {}

void LanTransport::attach(const std::string& peer_id,
                          const std::shared_ptr<WebSocket>& socket,
                          const lan::Key& key,
                          const std::optional<std::string>& computer) {
  if (computer) {
    std::vector<std::shared_ptr<WebSocket>> stale;
    for (const auto& [other_id, other] : sockets_) {
      if (other.computer == computer && other_id != peer_id) {
        stale.push_back(other.socket);
      }
    }
    // Their own close announces them gone (`closed` below).
    for (const auto& old : stale) {
      old->terminate();
    }
  }
  sockets_[peer_id] = Connection{key, socket, computer};
  std::weak_ptr<WebSocket> weak = socket;
  socket->on_message.on([this, peer_id, weak, key](const Bytes& data) {
    if (const auto open = weak.lock()) {
      received(peer_id, open, key, data);
    }
  });
  const auto gone = [this, peer_id, weak] {
    if (const auto socket_gone = weak.lock()) {
      closed(peer_id, socket_gone);
    }
  };
  socket->on_close.on([gone](int) { gone(); });
  socket->on_error.on([gone](const Failure&) { gone(); });
}

void LanTransport::received(const std::string& peer_id,
                            const std::shared_ptr<WebSocket>& socket,
                            const lan::Key& key, const Bytes& data) {
  try {
    meter_.record(peer_id, "receive", static_cast<double>(data.size()), 0);
    const auto packet = lan::open_packet(data, key);
    if (!packet) {
      throw LinkError("Invalid encrypted LAN packet.");
    }
    if (packet->kind == lan::kPacketSignal) {
      const auto message = lan::open_signal(packet->clear);
      if (!message) {
        throw LinkError("Invalid LAN control message.");
      }
      const std::string* from = json::string_at(*message, "peerId");
      if (from == nullptr || *from != peer_id) {
        throw LinkError("Peer identity changed.");
      }
      // A link is announced by the LAN layer on this computer when it
      // authenticates. One arriving from the other end would be that
      // computer naming itself again, under any name it liked.
      const json::Value* signal = message->get("signal");
      const std::string* kind =
          signal != nullptr ? json::string_at(*signal, "kind") : nullptr;
      if (kind != nullptr && *kind == "peer-ready") {
        return;
      }
      options_.emit_signal(*message);
      return;
    }
    if (packet->kind != lan::kPacketAudio) {
      throw LinkError("Unexpected LAN packet after authentication.");
    }
    const auto chunk = lan::decode_audio(peer_id, packet->clear);
    if (!chunk) {
      throw LinkError("Invalid LAN audio packet.");
    }
    const auto current = sockets_.find(peer_id);
    if (current != sockets_.end() && current->second.socket == socket) {
      options_.emit_audio(*chunk);
    }
  } catch (const std::exception&) {
    socket->close(1008, "Invalid encrypted packet");
  }
}

void LanTransport::closed(const std::string& peer_id,
                          const std::shared_ptr<WebSocket>& socket) {
  const auto found = sockets_.find(peer_id);
  if (found == sockets_.end() || found->second.socket != socket) {
    return;
  }
  sockets_.erase(found);
  smooth_.erase(peer_id);
  if (!stopping_) {
    options_.emit_signal(json::Value::object({
        {"peerId", json::Value::string(peer_id)},
        {"signal",
         json::Value::object({{"kind", json::Value::string("stop")}})},
    }));
  }
}

void LanTransport::send_audio(const lan::AudioChunk& chunk) {
  const auto encoded = lan::encode_audio(chunk, false);
  if (!encoded) {
    throw LinkError("Invalid LAN audio chunk.");
  }
  const auto found = sockets_.find(chunk.peer_id);
  if (found == sockets_.end() || !found->second.socket->is_open()) {
    throw LinkError("That LAN computer is not connected.");
  }
  const auto socket = found->second.socket;
  // Capture already supplies float PCM. Always send it immediately; a
  // sound preset or a legacy Music/Video selection must not add an encoder
  // queue.
  const std::size_t queued = socket->buffered_amount();
  const std::size_t limit = smooth_.contains(chunk.peer_id)
                                ? kMaxSmoothSocketBufferBytes
                                : kMaxSocketBufferBytes;
  if (queued > limit) {
    socket->close(1013, "Network send buffer is overloaded");
    return;
  }
  Bytes packet = lan::seal_packet(lan::kPacketAudio, *encoded,
                                  found->second.key);
  const auto size = static_cast<double>(packet.size());
  socket->send(std::move(packet));
  meter_.record(chunk.peer_id, "send", size, static_cast<double>(queued));
}

void LanTransport::send_signal(const json::Value& message) {
  const std::string* peer_id = json::string_at(message, "peerId");
  const auto found =
      peer_id != nullptr ? sockets_.find(*peer_id) : sockets_.end();
  if (found == sockets_.end() || !found->second.socket->is_open()) {
    throw LinkError("That LAN computer is not connected.");
  }
  const std::string text = json::stringify(message);
  found->second.socket->send(lan::seal_packet(
      lan::kPacketSignal, crypto::bytes_of(text), found->second.key));
}

void LanTransport::close_all() {
  stopping_ = true;
  auto connections = std::move(sockets_);
  sockets_.clear();
  for (auto& [peer_id, connection] : connections) {
    connection.socket->remove_all_listeners();
    connection.socket->close();
  }
  smooth_.clear();
  meter_.clear();
  stopping_ = false;
}

void LanTransport::close(const std::string& peer_id) {
  const auto found = sockets_.find(peer_id);
  if (found != sockets_.end()) {
    found->second.socket->close(1000, "Unlinked");
  }
}

void LanTransport::set_stream_mode(const std::string& peer_id, bool music) {
  if (music) {
    smooth_.insert(peer_id);
  } else {
    smooth_.erase(peer_id);
  }
}

}  // namespace feq::share::service

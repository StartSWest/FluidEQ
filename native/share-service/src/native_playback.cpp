/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "native_playback.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstring>

#include "link_error.h"

namespace feq::share::service {
namespace {

double double_at(const Bytes& bytes, std::size_t at) {
  double value = 0;
  std::memcpy(&value, bytes.data() + at, sizeof value);
  return value;
}

/** /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i */
bool is_guid(const std::string& value) {
  if (value.size() != 38 || value.front() != '{' || value.back() != '}') {
    return false;
  }
  for (std::size_t at = 1; at < 37; at += 1) {
    const bool dash = at == 9 || at == 14 || at == 19 || at == 24;
    if (dash ? value[at] != '-'
             : std::isxdigit(static_cast<unsigned char>(value[at])) == 0) {
      return false;
    }
  }
  return true;
}

std::string output_guid(const std::string& value) {
  if (value.empty() || value == "default") {
    return {};
  }
  if (!is_guid(value)) {
    throw LinkError("Invalid native playback output.");
  }
  return value;
}

}  // namespace

NativePlayback::NativePlayback(OnMeter on_meter,
                               std::function<void()> on_failure)
    : on_meter_(std::move(on_meter)), on_failure_(std::move(on_failure)) {}

Future<std::shared_ptr<Playback>> NativePlayback::start(
    OnMeter on_meter, std::function<void()> on_failure) {
  auto playback =
      std::make_shared<NativePlayback>(std::move(on_meter), std::move(on_failure));
  std::weak_ptr<NativePlayback> weak = playback;
  auto client = std::make_shared<AudioClient>(AudioClient{
      [weak](const PlaybackReply& reply) {
        if (const auto self = weak.lock()) {
          self->reply(reply);
        }
      },
      [weak](const Failure&) {
        if (const auto self = weak.lock()) {
          self->fail();
        }
      }});
  Future<std::shared_ptr<Playback>> started;
  lease_audio_helper(client).then(
      [playback, started](
          const Future<std::shared_ptr<AudioLease>>::Result& leased) {
        if (leased.index() == 1) {
          started.reject(std::get<1>(leased));
          return;
        }
        playback->lease_ = std::get<0>(leased);
        try {
          // Whatever an earlier receiver left in the helper is not this one's.
          playback->write(playback_command(5));
          started.resolve(playback);
        } catch (const LinkError& error) {
          started.reject(error.failure());
        }
      });
  return started;
}

void NativePlayback::fail() {
  if (closed_ || failed_) {
    return;
  }
  failed_ = true;
  on_failure_();
}

void NativePlayback::reply(const PlaybackReply& reply) {
  if (closed_ || failed_) {
    return;
  }
  if (reply.kind == 4 && reply.id == 0) {
    fail();
    return;
  }
  if (reply.kind == 6 && reply.payload.size() == 8) {
    const double held = double_at(reply.payload, 0);
    output_ms_ = std::isfinite(held) && held >= 0 ? held : 0;
    return;
  }
  if (reply.kind != 5 || reply.payload.size() != 24) {
    return;
  }
  const double buffered_ms = double_at(reply.payload, 0);
  const double peak = double_at(reply.payload, 8);
  const double rms = double_at(reply.payload, 16);
  for (const auto& [peer_id, peer] : peers_) {
    if (peer.id != reply.id) {
      continue;
    }
    if (std::isfinite(buffered_ms) && buffered_ms >= 0 && std::isfinite(peak) &&
        peak >= 0 && std::isfinite(rms) && rms >= 0) {
      on_meter_(PlaybackMeter{peer_id, buffered_ms + output_ms_, peak, rms,
                              peer.waveform});
    }
    return;
  }
}

void NativePlayback::write(const Bytes& packet) {
  if (closed_ || failed_) {
    throw LinkError("Native playback has stopped.");
  }
  lease_->send(packet);
}

void NativePlayback::tell_smooth(std::uint32_t id, bool on) {
  // An unknown command ends the helper and every capture under it.
  if (lease_->version() >= kPlaybackSmoothSince) {
    write(playback_command(9, id, {}, on ? 1 : 0));
  }
}

void NativePlayback::push(const share::lan::AudioChunk& chunk) {
  auto found = peers_.find(chunk.peer_id);
  if (found == peers_.end()) {
    std::uint32_t id = 0;
    for (std::uint32_t candidate = 1; candidate <= 8 && id == 0; candidate += 1) {
      const bool used =
          std::any_of(peers_.begin(), peers_.end(), [candidate](const auto& entry) {
            return entry.second.id == candidate;
          });
      if (!used) {
        id = candidate;
      }
    }
    if (id == 0) {
      throw LinkError("Too many shared-audio sources.");
    }
    found = peers_.emplace(chunk.peer_id, Peer{id, {}}).first;
    if (smooth_.contains(chunk.peer_id)) {
      tell_smooth(id, true);
    }
  }
  Peer& peer = found->second;
  peer.waveform.fill(0);
  const std::size_t samples = chunk.pcm.size() / 4;
  for (std::uint32_t frame = 0; frame < chunk.frames; frame += 1) {
    const std::size_t point = (static_cast<std::size_t>(frame) * 64) / chunk.frames;
    const std::size_t at = static_cast<std::size_t>(frame) * chunk.channels;
    if (at >= samples) {
      break;
    }
    float sample = 0;
    std::memcpy(&sample, chunk.pcm.data() + at * 4, sizeof sample);
    if (std::isfinite(sample) &&
        std::fabs(sample) > std::fabs(peer.waveform[point])) {
      peer.waveform[point] = sample;
    }
  }
  Bytes payload(4 + chunk.pcm.size());
  for (int shift = 0; shift < 4; shift += 1) {
    payload[static_cast<std::size_t>(shift)] =
        static_cast<std::uint8_t>(chunk.sequence >> (8 * shift));
  }
  std::memcpy(payload.data() + 4, chunk.pcm.data(), chunk.pcm.size());
  write(playback_command(2, peer.id, payload, chunk.sample_rate, chunk.channels,
                         chunk.frames));
}

void NativePlayback::remove(const std::string& peer_id) {
  const auto found = peers_.find(peer_id);
  if (found != peers_.end()) {
    write(playback_command(3, found->second.id));
    peers_.erase(peer_id);
  }
}

void NativePlayback::reset() {
  write(playback_command(5));
  peers_.clear();
}

void NativePlayback::set_volume(double volume) {
  if (!std::isfinite(volume) || volume < 0 || volume > 1) {
    throw LinkError("Invalid shared-audio volume.");
  }
  const auto value = static_cast<float>(volume);
  Bytes bytes(4);
  std::memcpy(bytes.data(), &value, sizeof value);
  write(playback_command(4, 0, bytes));
}

void NativePlayback::set_smooth(const std::string& peer_id, bool on) {
  if (smooth_.contains(peer_id) == on) {
    return;
  }
  if (on) {
    smooth_.insert(peer_id);
  } else {
    smooth_.erase(peer_id);
  }
  const auto found = peers_.find(peer_id);
  if (found != peers_.end()) {
    tell_smooth(found->second.id, on);
  }
}

Future<Nothing> NativePlayback::set_output(const std::string& guid) {
  if (closed_ || failed_) {
    return Future<Nothing>::rejected(
        failure_with("Native playback has stopped."));
  }
  const std::string name = output_guid(guid);
  return lease_->request(1, Bytes(name.begin(), name.end())).answered;
}

Future<Nothing> NativePlayback::close() {
  if (closing_) {
    return *closing_;
  }
  closed_ = true;
  peers_.clear();
  Future<Nothing> given_back;
  closing_ = given_back;
  const auto lease = lease_;
  Future<Nothing> answered;
  try {
    lease->send(playback_command(5));
    answered = lease->request(7).answered;
  } catch (const LinkError& error) {
    answered = Future<Nothing>::rejected(error.failure());
  }
  // The helper may have gone: then there is no device left to give back.
  answered.then([lease, given_back](const Future<Nothing>::Result&) {
    lease->release();
    given_back.resolve(Nothing{});
  });
  return given_back;
}

}  // namespace feq::share::service

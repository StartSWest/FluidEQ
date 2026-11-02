/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The small pieces the runtime is built from, each the twin of a module of
 * its own: `telemetry.ts`, `leasePool.ts`, `remoteAudioLevels.ts`,
 * `createSmoothLinks` in `remoteAudioSmooth.ts`, and
 * `common/remoteAudioPreview.ts`.
 */

#include <cmath>
#include <cstring>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "fluideq/share/lan_protocol.h"
#include "link_error.h"
#include "io.h"
#include "main_wire.h"

namespace feq::share::service {

/**
 * A busy host gets one in-flight sample and the newest pending sample per
 * lane. Audio never waits for its meters, and a stalled UI cannot pile a
 * history up in this service.
 */
class AudioTelemetry {
 public:
  using Post = std::function<void(WireMessage)>;

  AudioTelemetry(Post post, std::function<void()> on_overflow)
      : post_(std::move(post)), on_overflow_(std::move(on_overflow)) {}

  void send(const std::string& key, WireMessage event) {
    if (in_flight_.contains(key)) {
      latest_[key] = std::move(event);
      return;
    }
    if (in_flight_.size() >= 256) {
      return;
    }
    in_flight_.insert(key);
    post_(wrapped(std::move(event), key));
  }

  /** Throws `LinkError` once 128 control events wait: the service ends. */
  void send_reliable(WireMessage event) {
    if (in_flight_.contains("control")) {
      if (reliable_.size() >= 128) {
        on_overflow_();
        throw LinkError("Share Audio event queue is full.");
      }
      reliable_.push_back(std::move(event));
      return;
    }
    in_flight_.insert("control");
    post_(wrapped(std::move(event), "control"));
  }

  void credit(const std::string& key) {
    in_flight_.erase(key);
    if (key == "control") {
      if (!reliable_.empty()) {
        WireMessage event = std::move(reliable_.front());
        reliable_.pop_front();
        send_reliable(std::move(event));
      }
      return;
    }
    const auto found = latest_.find(key);
    if (found != latest_.end()) {
      WireMessage event = std::move(found->second);
      latest_.erase(found);
      send(key, std::move(event));
    }
  }

  void forget(const std::string& key) { latest_.erase(key); }

 private:
  static WireMessage wrapped(WireMessage event, const std::string& key) {
    WireMessage message;
    message.parts = std::move(event.parts);
    message.json = share::json::Value::object({
        {"type", share::json::Value::string("event")},
        {"event", std::move(event.json)},
        {"credit", share::json::Value::string(key)},
    });
    return message;
  }

  Post post_;
  std::function<void()> on_overflow_;
  std::set<std::string> in_flight_;
  std::map<std::string, WireMessage> latest_;
  std::deque<WireMessage> reliable_;
};

/**
 * Control requests may overlap while a native device is opening. Share its
 * actual owner, and finish its close before a replacement can open: closing
 * an old UI session must never send reset/close to a newer native player.
 */
template <class T>
class LeasePool {
 public:
  using Ids = std::function<std::vector<int>()>;
  using Start = std::function<Future<T>(Ids ids)>;
  using Close = std::function<Future<Nothing>(const T& value)>;

  LeasePool(Start start, Close close)
      : start_(std::move(start)), close_(std::move(close)) {}

  Future<Nothing> acquire(int id) {
    if (current_ && current_->ids.size() >= 16) {
      return Future<Nothing>::rejected(failure_with("Share Audio lease limit reached."));
    }
    if (!current_) {
      auto session = std::make_shared<Session>();
      std::weak_ptr<Session> weak = session;
      const Ids ids = [weak] {
        const auto alive = weak.lock();
        return alive ? alive->ids : std::vector<int>{};
      };
      const Start start = start_;
      session->ready = chain<T>(closing_, std::function<Future<T>(
                                              const Future<Nothing>::Result&)>(
                                              [start, ids](const auto&) {
                                                return start(ids);
                                              }));
      session->ready.then([weak](const typename Future<T>::Result& result) {
        const auto alive = weak.lock();
        if (alive && result.index() == 0) {
          alive->value = std::get<0>(result);
        }
      });
      current_ = session;
    }
    const auto session = current_;
    session->ids.push_back(id);
    Future<Nothing> acquired;
    session->ready.then([this, session, id, acquired](
                            const typename Future<T>::Result& result) {
      const bool holds =
          std::find(session->ids.begin(), session->ids.end(), id) !=
          session->ids.end();
      if (result.index() == 0 && holds) {
        acquired.resolve(Nothing{});
        return;
      }
      // A failure or close may arrive while native startup is resolving. Do
      // not acknowledge an already released owner as a successful open.
      std::erase(session->ids, id);
      if (current_ == session && session->ids.empty()) {
        current_.reset();
      }
      acquired.reject(result.index() == 1 ? std::get<1>(result)
                                          : failure_with("Share Audio owner is closed."));
    });
    return acquired;
  }

  /** Throws `LinkError` when `id` holds no open owner. */
  const T& get(int id) const {
    if (!current_ ||
        std::find(current_->ids.begin(), current_->ids.end(), id) ==
            current_->ids.end() ||
        !current_->value) {
      throw LinkError("Share Audio owner is closed.");
    }
    return *current_->value;
  }

  Future<Nothing> release(int id) {
    const auto session = current_;
    if (!session) {
      return Future<Nothing>::resolved(Nothing{});
    }
    const auto found = std::find(session->ids.begin(), session->ids.end(), id);
    if (found == session->ids.end()) {
      return Future<Nothing>::resolved(Nothing{});
    }
    session->ids.erase(found);
    if (!session->ids.empty()) {
      return Future<Nothing>::resolved(Nothing{});
    }
    current_.reset();
    const Close close = close_;
    const Future<Nothing> finished = chain<Nothing>(
        session->ready,
        std::function<Future<Nothing>(const typename Future<T>::Result&)>(
            [close](const typename Future<T>::Result& result) {
              return result.index() == 0
                         ? close(std::get<0>(result))
                         : Future<Nothing>::resolved(Nothing{});
            }));
    // The caller still receives a close failure. Sequencing the next owner
    // must not leave a recoverable device poisoned by that error.
    Future<Nothing> next;
    finished.then([next](const Future<Nothing>::Result&) {
      next.resolve(Nothing{});
    });
    closing_ = next;
    return finished;
  }

 private:
  struct Session {
    std::vector<int> ids;
    Future<T> ready;
    std::optional<T> value;
  };

  Start start_;
  Close close_;
  std::shared_ptr<Session> current_;
  Future<Nothing> closing_ = Future<Nothing>::resolved(Nothing{});
};

/**
 * Each linked computer's own volume, applied to its sound as it arrives.
 * At full volume a chunk passes as it came, bit for bit; a change of
 * volume ramps across the chunk it lands on, as a fader does.
 */
class AudioLevels {
 public:
  share::lan::AudioChunk apply(const share::lan::AudioChunk& chunk,
                               double level) {
    const auto previous = playing_.find(chunk.peer_id);
    const double from = previous != playing_.end() ? previous->second : level;
    playing_[chunk.peer_id] = level;
    if (from == 1 && level == 1) {
      return chunk;
    }
    share::lan::AudioChunk out = chunk;
    const std::size_t samples = chunk.pcm.size() / 4;
    const double step =
        chunk.frames > 0 ? (level - from) / static_cast<double>(chunk.frames) : 0;
    for (std::uint32_t frame = 0; frame < chunk.frames; frame += 1) {
      const double gain = from + step * (static_cast<double>(frame) + 1);
      for (std::uint32_t channel = 0; channel < chunk.channels; channel += 1) {
        const std::size_t at = static_cast<std::size_t>(frame) * chunk.channels + channel;
        if (at >= samples) {
          break;
        }
        float sample = 0;
        std::memcpy(&sample, chunk.pcm.data() + at * 4, sizeof sample);
        const auto scaled = static_cast<float>(static_cast<double>(sample) * gain);
        std::memcpy(out.pcm.data() + at * 4, &scaled, sizeof scaled);
      }
    }
    return out;
  }

  /** A computer that left starts at its own level when it comes back. */
  void forget(const std::string& peer_id) { playing_.erase(peer_id); }

 private:
  std::map<std::string, double> playing_;
};

/**
 * Which links play smooth: all of them while this computer's switch is on,
 * and any whose other end said `music`. `apply` hears each link's answer
 * once, when it changes.
 */
class SmoothLinks {
 public:
  explicit SmoothLinks(std::function<void(const std::string&, bool)> apply)
      : apply_(std::move(apply)) {}

  bool smooth(const std::string& peer_id) const {
    const auto heard = heard_.find(peer_id);
    return local_ || (heard != heard_.end() && heard->second == "music");
  }
  void set_local(bool on) {
    local_ = on;
    std::vector<std::string> peers;
    for (const auto& [peer_id, mode] : heard_) {
      peers.push_back(peer_id);
    }
    for (const auto& peer_id : peers) {
      update(peer_id);
    }
  }
  void heard(const std::string& peer_id, const std::string& mode) {
    heard_[peer_id] = mode;
    update(peer_id);
  }
  void forget(const std::string& peer_id) {
    heard_.erase(peer_id);
    applied_.erase(peer_id);
  }
  void clear() {
    heard_.clear();
    applied_.clear();
  }

 private:
  void update(const std::string& peer_id) {
    const bool want = smooth(peer_id);
    const auto applied = applied_.find(peer_id);
    if (applied == applied_.end() || applied->second != want) {
      applied_[peer_id] = want;
      apply_(peer_id, want);
    }
  }

  std::function<void(const std::string&, bool)> apply_;
  bool local_ = false;
  std::map<std::string, std::string> heard_;
  std::map<std::string, bool> applied_;
};

/**
 * A complete contiguous analysis window for the page's meters, rather than
 * decimated fragments that never fill an FFT. A UI copy, never playback PCM.
 */
class AudioPreview {
 public:
  static constexpr std::uint16_t kFrames = 2048;

  void push(const share::lan::AudioChunk& chunk) {
    if (rate_ != chunk.sample_rate || channels_ != chunk.channels ||
        !expected_ || *expected_ != chunk.sequence) {
      rate_ = chunk.sample_rate;
      channels_ = chunk.channels;
      ring_.assign(static_cast<std::size_t>(kFrames) * channels_, 0.0f);
      cursor_ = 0;
      filled_ = 0;
    }
    expected_ = chunk.sequence == 0xFFFFFFFFu ? 0 : chunk.sequence + 1;
    const std::size_t count = chunk.pcm.size() / 4;
    std::vector<float> samples(count);
    std::memcpy(samples.data(), chunk.pcm.data(), count * 4);
    if (ring_.empty()) {
      return;
    }
    if (count >= ring_.size()) {
      std::copy(samples.end() - static_cast<std::ptrdiff_t>(ring_.size()),
                samples.end(), ring_.begin());
      cursor_ = 0;
      filled_ = ring_.size();
      return;
    }
    const std::size_t first = std::min(count, ring_.size() - cursor_);
    std::copy(samples.begin(), samples.begin() + static_cast<std::ptrdiff_t>(first),
              ring_.begin() + static_cast<std::ptrdiff_t>(cursor_));
    std::copy(samples.begin() + static_cast<std::ptrdiff_t>(first), samples.end(),
              ring_.begin());
    cursor_ = (cursor_ + count) % ring_.size();
    filled_ = std::min(ring_.size(), filled_ + count);
  }

  /** The window, oldest first, once it is full. */
  std::optional<share::lan::AudioChunk> read() {
    if (filled_ == 0 || filled_ < ring_.size()) {
      return std::nullopt;
    }
    share::lan::AudioChunk frame;
    frame.sample_rate = rate_;
    frame.channels = channels_;
    frame.frames = kFrames;
    frame.sequence = sequence_;
    frame.pcm.resize(ring_.size() * 4);
    const std::size_t tail = ring_.size() - cursor_;
    std::memcpy(frame.pcm.data(), ring_.data() + cursor_, tail * 4);
    std::memcpy(frame.pcm.data() + tail * 4, ring_.data(), cursor_ * 4);
    sequence_ = sequence_ == 0xFFFFFFFFu ? 0 : sequence_ + 1;
    return frame;
  }

 private:
  std::vector<float> ring_;
  std::uint32_t rate_ = 0;
  std::uint8_t channels_ = 0;
  std::size_t cursor_ = 0;
  std::size_t filled_ = 0;
  std::uint32_t sequence_ = 0;
  std::optional<std::uint32_t> expected_;
};

}  // namespace feq::share::service

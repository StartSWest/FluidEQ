/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What the runtime is handed rather than reaching for (`IAudioRuntimeDeps`
 * in the TypeScript it was ported from): the network, this computer's
 * capture, the player and the LAN audio helper, each behind the few calls
 * the runtime makes. The service hands it the real ones; its tests hand it
 * stand-ins, as the TypeScript's did, so every rule the runtime keeps is
 * checked without a socket, a device or a child process.
 */

#include <array>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "fluideq/share/json.h"
#include "fluideq/share/lan_protocol.h"
#include "lan_book.h"
#include "loop.h"

namespace feq::share::service {

using Bytes = std::vector<std::uint8_t>;

/** One reply of the LAN audio helper (`IPlaybackReply`). */
struct PlaybackReply {
  std::uint32_t kind = 0;
  std::uint32_t id = 0;
  std::uint32_t rate = 0;
  std::uint16_t frames = 0;
  /** Present on a system-audio capture frame (kind 10). */
  std::optional<std::uint16_t> channels;
  Bytes payload;
};

/** Who holds a lease on the helper (`ILanAudioClient`). */
struct AudioClient {
  std::function<void(const PlaybackReply&)> reply;
  std::function<void(const Failure&)> stopped;
};

struct HostCredentials {
  int port = 0;
  std::string secret;
};

struct LanEvents {
  std::function<void(const share::json::Value& message)> emit_signal;
  std::function<void(const share::lan::AudioChunk& chunk)> emit_audio;
  std::function<void()> emit_error;
  std::function<void(const share::json::Value& stats)> emit_network;
};

/** `IRemoteAudioLan`. Each call throws `LinkError` where the TypeScript's
 * throws. */
class Lan {
 public:
  virtual ~Lan() = default;
  /** The session as `ILanHostSession`: `{credentials, details}`. */
  virtual Future<share::json::Value> start(
      const std::optional<HostCredentials>& credentials) = 0;
  virtual void join(const share::json::Value& code, bool fresh) = 0;
  virtual void unlink(const std::optional<std::string>& peer_id,
                      const std::optional<std::string>& computer_id) = 0;
  virtual Future<bool> reconnect(
      const std::optional<std::string>& peer_id,
      const std::optional<std::string>& computer_id) = 0;
  virtual void retry() = 0;
  virtual void send_signal(const share::json::Value& message) = 0;
  virtual void send_audio(const share::lan::AudioChunk& chunk) = 0;
  virtual void set_stream_mode(const std::string& peer_id, bool music) = 0;
  virtual void stop() = 0;
};

class NetworkCapture {
 public:
  virtual ~NetworkCapture() = default;
  virtual void close() = 0;
};

/** `IRemotePlaybackMeter`. */
struct PlaybackMeter {
  std::string source_id;
  double buffered_ms = 0;
  double peak = 0;
  double rms = 0;
  std::array<float, 64> waveform{};
};

/** `INativeRemoteAudioPlayback`. */
class Playback {
 public:
  virtual ~Playback() = default;
  virtual void push(const share::lan::AudioChunk& chunk) = 0;
  virtual void remove(const std::string& peer_id) = 0;
  virtual void reset() = 0;
  virtual void set_volume(double volume) = 0;
  virtual void set_smooth(const std::string& peer_id, bool smooth) = 0;
  virtual Future<Nothing> set_output(const std::string& guid) = 0;
  virtual Future<Nothing> close() = 0;
};

/** `ILanAudioLease`. */
class HelperLease {
 public:
  struct Request {
    std::uint32_t id = 0;
    Future<Nothing> answered;
  };
  virtual ~HelperLease() = default;
  virtual Request request(std::uint32_t kind,
                          const std::optional<Bytes>& payload = std::nullopt) = 0;
  virtual void send(const Bytes& packet) = 0;
  virtual std::uint32_t version() const = 0;
  virtual void release() = 0;
};

struct RuntimePorts {
  std::function<std::shared_ptr<Lan>(LanEvents events, LinkBook book)>
      create_lan;
  std::function<Future<std::shared_ptr<NetworkCapture>>(
      std::function<void(const share::lan::AudioChunk&)> on_audio,
      std::function<void()> on_failure)>
      start_capture;
  std::function<Future<std::shared_ptr<Playback>>(
      std::function<void(const PlaybackMeter&)> on_meter,
      std::function<void()> on_failure)>
      start_playback;
  std::function<Future<std::shared_ptr<HelperLease>>(
      std::shared_ptr<AudioClient> client)>
      lease_helper;
  std::function<std::optional<std::uint32_t>()> helper_pid;
  /** Milliseconds on a steady clock (`performance.now()`). */
  std::function<double()> now;
};

/** The real ones: the link, the capture helper, the player, the helper. */
RuntimePorts system_ports();

}  // namespace feq::share::service

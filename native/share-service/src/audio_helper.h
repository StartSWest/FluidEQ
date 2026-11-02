/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * FluidEQ-LAN-Playback, as one process every part of LAN audio shares
 * (`lanAudioHelper.ts`, `nativeRemoteAudioPlaybackProtocol.ts`).
 *
 * It plays what other computers share with this one, and it is the PARENT
 * of every capture helper: the second output's and the network's. That is
 * the whole of Share Audio both ways' echo guard — the network's capture
 * leaves this process's tree out, so a computer's own sound never travels
 * back to it. So the process lives while anything holds a lease and is
 * started by whichever asks first; a lease is void when the process ends.
 *
 * Commands that answer (1 open output, 7 close output, 8 start a capture)
 * are `request`s, each under an id of its own; the rest are `send`s.
 * Replies nobody asked for go to every client: meters (5), the output
 * failing (4 with id 0) and a capture ending (9).
 */

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <vector>

#include "io.h"
#include "share_ports.h"

namespace feq::share::service {

inline constexpr std::uint32_t kPlaybackMagic = 0x31504c46;
inline constexpr std::size_t kPlaybackHeaderBytes = 24;
/** The helper protocol that has command 9, smooth playback for one peer. */
inline constexpr std::uint32_t kPlaybackSmoothSince = 2;

Bytes playback_command(std::uint32_t kind, std::uint32_t id = 0,
                       std::span<const std::uint8_t> payload = {},
                       std::uint32_t rate = 0, std::uint16_t channels = 0,
                       std::uint16_t frames = 0);

/** A partial pipe read is not a packet boundary. Throws `LinkError` on a
 * reply that is not one. */
class PlaybackReplyReader {
 public:
  void push(std::span<const std::uint8_t> bytes,
            const std::function<void(const PlaybackReply&)>& accept);

 private:
  Bytes pending_;
};

struct Helper;

class AudioLease : public HelperLease {
 public:
  AudioLease(std::shared_ptr<Helper> helper,
             std::shared_ptr<AudioClient> client);

  Request request(std::uint32_t kind,
                  const std::optional<Bytes>& payload = std::nullopt) override;
  /** Throws `LinkError` when the helper has stopped or is overloaded. */
  void send(const Bytes& packet) override;
  /**
   * The protocol version the helper said it speaks when it was ready: 0 for
   * every helper before smooth playback, 2 from it. A command the helper
   * does not know ends it, so a newer one is sent only where this says so.
   */
  std::uint32_t version() const override { return version_; }
  void release() override;

 private:
  std::shared_ptr<Helper> helper_;
  std::shared_ptr<AudioClient> client_;
  std::uint32_t version_ = 0;
  bool released_ = false;
};

/** Where the helper is: beside this service, unless a test says otherwise. */
void set_audio_helper_path(std::wstring path);

Future<std::shared_ptr<AudioLease>> lease_audio_helper(
    std::shared_ptr<AudioClient> client);

/** The helper's process id while it runs, for the Processes list. */
std::optional<std::uint32_t> audio_helper_pid();

}  // namespace feq::share::service

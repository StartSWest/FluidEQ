/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * This computer's sound for the network (`startNetworkCapture` in
 * `remoteAudioCapture.ts`, over `nativeCaptureProcess.ts`): everything it
 * plays, and none of what other computers send it or the second output
 * mirrors — the `lan` capture, which leaves the LAN audio helper's whole
 * tree out. Shared by every computer this one sends to; chunks carry no
 * peer, the link addresses each copy.
 *
 * The capture helper is a child of the LAN audio helper and reaches this
 * service through a named pipe served for it alone. A pipe name can be
 * listed by anyone on the machine, so the pipe's lock is the token on the
 * helper's command line: each of its two connections opens with it, and
 * any connection that does not — or that names a role already taken — is
 * dropped. Two connections, because the helper reads its commands
 * synchronously and writes its frames overlapped.
 */

#include <cstdint>
#include <functional>
#include <memory>
#include <span>

#include "fluideq/share/lan_protocol.h"
#include "io.h"
#include "share_ports.h"

namespace feq::share::service {

/** `createCaptureFrameReader`: the capture helpers' 24-byte-header wire. */
class CaptureFrameReader {
 public:
  struct Handlers {
    std::function<void()> ready;
    std::function<void(std::uint32_t kind, std::uint32_t id,
                       std::uint32_t result)>
        reply;
    std::function<void(const share::lan::AudioChunk& chunk)> audio;
    std::function<void(const Failure& failure)> invalid;
  };

  explicit CaptureFrameReader(Handlers handlers)
      : handlers_(std::move(handlers)) {}
  void push(std::span<const std::uint8_t> data);

 private:
  Handlers handlers_;
  std::vector<std::uint8_t> buffered_;
  bool ready_ = false;
  bool broken_ = false;
};

Future<std::shared_ptr<NetworkCapture>> start_network_capture(
    std::function<void(const share::lan::AudioChunk&)> on_audio,
    std::function<void()> on_failure);

}  // namespace feq::share::service

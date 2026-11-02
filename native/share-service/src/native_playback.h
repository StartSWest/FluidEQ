/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The sound other computers share with this one, played on a lease of the
 * LAN audio helper (`nativeRemoteAudioPlayback.ts`).
 *
 * Closing gives the output device back and the lease with it; the helper
 * itself may well carry on, because a capture holds it too. A device that
 * fails mid-song is the same failure as before — the receiver offers
 * Resume — but no longer the end of the process, so the captures under it,
 * the second output's among them, never stop with it.
 */

#include <array>
#include <functional>
#include <map>
#include <memory>
#include <set>
#include <string>

#include "audio_helper.h"
#include "fluideq/share/lan_protocol.h"
#include "share_ports.h"

namespace feq::share::service {

class NativePlayback : public Playback,
                       public std::enable_shared_from_this<NativePlayback> {
 public:
  using OnMeter = std::function<void(const PlaybackMeter&)>;

  static Future<std::shared_ptr<Playback>> start(
      OnMeter on_meter, std::function<void()> on_failure);

  NativePlayback(OnMeter on_meter, std::function<void()> on_failure);

  /** Each throws `LinkError` once playback has stopped. */
  void push(const share::lan::AudioChunk& chunk) override;
  void remove(const std::string& peer_id) override;
  void reset() override;
  void set_volume(double volume) override;
  /**
   * Smooth playback for the sound from one computer: a cushion of a third
   * of a second that rides out Wi-Fi stalls. A helper too old for it plays
   * on as before.
   */
  void set_smooth(const std::string& peer_id, bool smooth) override;
  Future<Nothing> set_output(const std::string& guid) override;
  Future<Nothing> close() override;

 private:
  struct Peer {
    std::uint32_t id = 0;
    std::array<float, 64> waveform{};
  };

  void reply(const PlaybackReply& reply);
  void fail();
  void write(const Bytes& packet);
  void tell_smooth(std::uint32_t id, bool on);

  OnMeter on_meter_;
  std::function<void()> on_failure_;
  std::shared_ptr<HelperLease> lease_;
  std::map<std::string, Peer> peers_;
  std::set<std::string> smooth_;
  /** The output device's own buffer in milliseconds (reply 6), added to
   * every peer's delay. */
  double output_ms_ = 0;
  bool closed_ = false;
  bool failed_ = false;
  std::optional<Future<Nothing>> closing_;
};

}  // namespace feq::share::service

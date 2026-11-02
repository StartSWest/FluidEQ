/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include <chrono>

#include "audio_helper.h"
#include "lan.h"
#include "native_playback.h"
#include "network_capture.h"
#include "share_ports.h"

namespace feq::share::service {

RuntimePorts system_ports() {
  RuntimePorts ports;
  ports.create_lan = [](LanEvents events,
                        LinkBook book) -> std::shared_ptr<Lan> {
    return std::make_shared<RemoteAudioLan>(std::move(events), std::move(book));
  };
  ports.start_capture = start_network_capture;
  ports.start_playback = NativePlayback::start;
  ports.lease_helper = [](std::shared_ptr<AudioClient> client) {
    return lease_audio_helper(std::move(client))
        .map<std::shared_ptr<HelperLease>>(
            [](const std::shared_ptr<AudioLease>& lease) {
              return std::shared_ptr<HelperLease>(lease);
            });
  };
  ports.helper_pid = audio_helper_pid;
  ports.now = [] {
    return std::chrono::duration<double, std::milli>(
               std::chrono::steady_clock::now().time_since_epoch())
        .count();
  };
  return ports;
}

}  // namespace feq::share::service

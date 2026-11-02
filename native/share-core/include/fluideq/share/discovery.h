/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>

#include "fluideq/share/crypto.h"

/*
 * "Who is there?" on the local network, and the answer: the C++ twin of
 * `src/main/remoteAudioDiscovery.ts`. A query names the listener it looks
 * for by an HMAC of that listener's secret, never the secret; an answer
 * carries a port and a name with an HMAC over both, so only a computer
 * holding the code can ask, and only the listener itself can answer.
 */

namespace feq::share::discovery {

inline constexpr std::uint16_t kPort = 49372;
inline constexpr std::size_t kMaxBytes = 1024;

struct Announcement {
  std::string device_name;
  int port = 0;
};

crypto::Bytes encode_query(std::string_view secret);
bool is_query(std::span<const std::uint8_t> data, std::string_view secret);
crypto::Bytes encode_announcement(std::string_view secret, int port,
                                  std::string_view device_name);
std::optional<Announcement> decode_announcement(
    std::span<const std::uint8_t> data, std::string_view secret);

}  // namespace feq::share::discovery

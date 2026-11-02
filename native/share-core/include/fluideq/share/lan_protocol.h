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
#include <vector>

#include "fluideq/share/crypto.h"
#include "fluideq/share/json.h"

/*
 * Share Audio's wire between two computers, byte for byte as
 * `src/main/remoteAudioLanProtocol.ts` writes and reads it: the pairing
 * code, the identity a secret gives a computer, the session key a challenge
 * gives a link, every packet sealed with AES-256-GCM under its kind, the
 * three authentication messages, and audio as Float32 behind a twelve-byte
 * header, squeezed with Zstandard at level 1 or not at all. Every reading
 * refuses what the TypeScript refuses; `share_wire_test.cpp` holds both to
 * the bytes the TypeScript wrote (`share_wire_fixture.h`).
 */

namespace feq::share::lan {

inline constexpr std::string_view kPairingPrefix = "FLUIDEQ-LAN-2.";
inline constexpr std::uint8_t kPacketSignal = 1;
inline constexpr std::uint8_t kPacketAudio = 2;
inline constexpr std::uint8_t kPacketAuthChallenge = 3;
inline constexpr std::uint8_t kPacketAuthReady = 4;
inline constexpr std::uint8_t kPacketAuthAccepted = 5;
inline constexpr std::size_t kSealedHeaderBytes = 1 + 12 + 16;
inline constexpr std::size_t kAudioHeaderBytes = 4 + 4 + 1 + 2 + 1;
inline constexpr std::size_t kMaxPacketBytes = 512 * 1024;
/** `MAX_CODE_ADDRESSES`: a code is pasted, not read. */
inline constexpr std::size_t kMaxCodeAddresses = 6;

using crypto::Bytes;
using Key = std::array<std::uint8_t, 32>;

struct PairingPayload {
  std::string address;
  std::vector<std::string> addresses;
  std::string device_name;
  int port = 0;
  std::string secret;
};

struct OpenedPacket {
  std::uint8_t kind = 0;
  Bytes clear;
};

struct AuthReady {
  std::string challenge;
  std::string device_name;
  std::string peer_id;
  std::optional<std::string> computer_id;
  bool fresh = false;
};

struct AuthAccepted {
  std::string challenge;
  std::string peer_id;
};

struct AudioChunk {
  std::string peer_id;
  std::uint32_t sequence = 0;
  std::uint32_t sample_rate = 0;
  std::uint8_t channels = 0;
  std::uint16_t frames = 0;
  /** Interleaved Float32, little-endian, `frames * channels * 4` bytes. */
  Bytes pcm;
};

/** `isPrivateIpv4`: canonical dotted IPv4 in 10/8, 172.16/12, 192.168/16, 169.254/16. */
bool is_private_ipv4(std::string_view address);

/** `computerIdOf`: a computer's name on the network, from its secret. */
std::string computer_id_of(std::string_view secret);
bool is_computer_id(std::string_view value);

std::string encode_pairing_code(const std::vector<std::string>& addresses,
                                int port, std::string_view secret,
                                std::string_view device_name);
/** Nothing where `decodePairingCode` throws. */
std::optional<PairingPayload> decode_pairing_code(std::string_view code);

Key key_from_secret(std::string_view secret);
std::string create_auth_challenge();
Key derive_session_key(const Key& pairing_key, std::string_view challenge,
                       std::string_view peer_id);

/** `sealPacket`, under a fresh IV unless one is given (the fixtures give one). */
Bytes seal_packet(std::uint8_t kind, std::span<const std::uint8_t> clear,
                  const Key& key,
                  std::optional<std::array<std::uint8_t, 12>> iv = std::nullopt);
std::optional<OpenedPacket> open_packet(std::span<const std::uint8_t> packet,
                                        const Key& key);

/** `openSignal`: the message, held to `isLanRemoteAudioSignal`. */
std::optional<json::Value> open_signal(std::span<const std::uint8_t> clear);

Bytes seal_auth_challenge(std::string_view challenge, const Key& key);
std::optional<std::string> open_auth_challenge(std::span<const std::uint8_t> clear);
Bytes seal_auth_ready(const AuthReady& ready, const Key& key);
std::optional<AuthReady> open_auth_ready(std::span<const std::uint8_t> clear);
Bytes seal_auth_accepted(const AuthAccepted& accepted, const Key& key);
std::optional<AuthAccepted> open_auth_accepted(std::span<const std::uint8_t> clear);

/** `encodeAudioAsync`: the header, then the samples squeezed or as they are. */
std::optional<Bytes> encode_audio(const AudioChunk& chunk, bool compress);
/** `decodeAudioAsync`: nothing for a packet that is not one. */
std::optional<AudioChunk> decode_audio(std::string_view peer_id,
                                       std::span<const std::uint8_t> clear);

}  // namespace feq::share::lan

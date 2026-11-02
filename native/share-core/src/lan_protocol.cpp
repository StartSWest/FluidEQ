/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/share/lan_protocol.h"

#include <zstd.h>

#include <algorithm>
#include <cmath>
#include <cstring>

#include "fluideq/share/signals.h"

namespace feq::share::lan {
namespace {

constexpr std::string_view kPacketAad = "FluidEQ encrypted LAN audio v2";
constexpr std::uint8_t kAudioRaw = 0;
constexpr std::uint8_t kAudioZstd = 1;

std::span<const std::uint8_t> span_of(const std::string& text) {
  return crypto::bytes_of(text);
}

std::string text_of(std::span<const std::uint8_t> bytes) {
  return std::string(reinterpret_cast<const char*>(bytes.data()), bytes.size());
}

Bytes aad_of(std::uint8_t kind) {
  Bytes aad(kPacketAad.begin(), kPacketAad.end());
  aad.push_back(kind);
  return aad;
}

/** `/^[A-Za-z0-9_-]{length}$/`. */
bool url_token(std::string_view text, std::size_t length) {
  return text.size() == length &&
         std::all_of(text.begin(), text.end(), [](char c) {
           return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                  (c >= '0' && c <= '9') || c == '_' || c == '-';
         });
}

/** `authValue`: a JSON object, or nothing. */
std::optional<json::Value> auth_value(std::span<const std::uint8_t> clear) {
  auto value = json::parse(text_of(clear));
  if (!value || !value->is_object()) {
    return std::nullopt;
  }
  return value;
}

/** A peer's id: a string, 1 to 128 long. */
bool is_peer_id(const json::Value* value) {
  return value != nullptr && value->is_string() && !value->as_string().empty() &&
         json::utf16_length(value->as_string()) <= 128;
}

Bytes seal_value(std::uint8_t kind, const json::Value& value, const Key& key) {
  return seal_packet(kind, span_of(json::stringify(value)), key);
}

void put_u32(Bytes& out, std::size_t at, std::uint32_t value) {
  for (std::size_t index = 0; index < 4; ++index) {
    out[at + index] = static_cast<std::uint8_t>(value >> (8 * index));
  }
}

std::uint32_t get_u32(std::span<const std::uint8_t> in, std::size_t at) {
  std::uint32_t value = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    value |= static_cast<std::uint32_t>(in[at + index]) << (8 * index);
  }
  return value;
}

}  // namespace

bool is_private_ipv4(std::string_view address) {
  // `/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/`, then each 0..255.
  std::array<int, 4> octets{};
  std::size_t at = 0;
  for (std::size_t index = 0; index < 4; ++index) {
    if (index > 0) {
      if (at >= address.size() || address[at] != '.') {
        return false;
      }
      ++at;
    }
    const std::size_t start = at;
    while (at < address.size() && address[at] >= '0' && address[at] <= '9' &&
           at - start < 3) {
      ++at;
    }
    const std::size_t digits = at - start;
    if (digits == 0 || (digits > 1 && address[start] == '0') ||
        (at < address.size() && address[at] >= '0' && address[at] <= '9')) {
      return false;
    }
    int value = 0;
    for (std::size_t d = start; d < at; ++d) {
      value = value * 10 + (address[d] - '0');
    }
    if (value > 255) {
      return false;
    }
    octets[index] = value;
  }
  if (at != address.size()) {
    return false;
  }
  return octets[0] == 10 ||
         (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) ||
         (octets[0] == 192 && octets[1] == 168) ||
         (octets[0] == 169 && octets[1] == 254);
}

std::string computer_id_of(std::string_view secret) {
  std::string input = "FluidEQ LAN computer";
  input.push_back('\0');
  input.append(secret);
  const auto digest = crypto::sha256(span_of(input));
  return crypto::base64url(digest).substr(0, 32);
}

bool is_computer_id(std::string_view value) { return url_token(value, 32); }

std::string encode_pairing_code(const std::vector<std::string>& addresses,
                                int port, std::string_view secret,
                                std::string_view device_name) {
  std::vector<json::Value> list;
  for (const std::string& address : addresses) {
    if (list.size() < kMaxCodeAddresses && is_private_ipv4(address)) {
      list.push_back(json::Value::string(address));
    }
  }
  const std::string first = list.empty() ? "0.0.0.0" : list.front().as_string();
  const json::Value payload = json::Value::object({
      {"address", json::Value::string(first)},
      {"addresses", json::Value::array(std::move(list))},
      {"deviceName", json::Value::string(std::string(device_name))},
      {"port", json::Value::number(port)},
      {"secret", json::Value::string(std::string(secret))},
  });
  return std::string(kPairingPrefix) +
         crypto::base64url(span_of(json::stringify(payload)));
}

std::optional<PairingPayload> decode_pairing_code(std::string_view code) {
  if (json::utf16_length(code) > 1024 || !code.starts_with(kPairingPrefix)) {
    return std::nullopt;
  }
  const Bytes decoded = crypto::from_base64(code.substr(kPairingPrefix.size()));
  const auto value = json::parse(text_of(decoded));
  if (!value || !value->is_object()) {
    return std::nullopt;
  }
  const json::Value* listed_value = value->get("addresses");
  const std::vector<json::Value> none;
  const std::vector<json::Value>& listed =
      listed_value != nullptr && listed_value->is_array() ? listed_value->items()
                                                          : none;
  std::vector<std::string> addresses;
  const auto consider = [&](const json::Value* address) {
    if (address != nullptr && address->is_string() &&
        is_private_ipv4(address->as_string()) &&
        std::find(addresses.begin(), addresses.end(), address->as_string()) ==
            addresses.end()) {
      addresses.push_back(address->as_string());
    }
  };
  consider(value->get("address"));
  for (const json::Value& address : listed) {
    consider(&address);
  }
  if (addresses.size() > kMaxCodeAddresses) {
    addresses.resize(kMaxCodeAddresses);
  }
  const auto port = json::integer_at(*value, "port");
  const std::string* secret = json::string_at(*value, "secret");
  const json::Value* device = value->get("deviceName");
  if (addresses.empty() || listed.size() > kMaxCodeAddresses || !port ||
      *port < 1 || *port > 65535 || secret == nullptr ||
      json::utf16_length(*secret) < 40 || json::utf16_length(*secret) > 64 ||
      (device != nullptr &&
       (!device->is_string() || json::trim(device->as_string()).empty() ||
        json::utf16_length(device->as_string()) > 128))) {
    return std::nullopt;
  }
  PairingPayload payload;
  payload.address = addresses.front();
  payload.addresses = addresses;
  const std::string trimmed =
      device != nullptr ? json::trim(device->as_string()) : std::string();
  payload.device_name = trimmed.empty() ? addresses.front() : trimmed;
  payload.port = static_cast<int>(*port);
  payload.secret = *secret;
  return payload;
}

Key key_from_secret(std::string_view secret) {
  return crypto::sha256(crypto::bytes_of(secret));
}

std::string create_auth_challenge() {
  std::array<std::uint8_t, 32> random{};
  crypto::random_bytes(random);
  return crypto::base64url(random);
}

Key derive_session_key(const Key& pairing_key, std::string_view challenge,
                       std::string_view peer_id) {
  std::string info = "FluidEQ LAN audio session ";
  info.append(peer_id);
  const Bytes okm = crypto::hkdf_sha256(pairing_key, crypto::bytes_of(challenge),
                                        span_of(info), 32);
  Key key{};
  std::copy(okm.begin(), okm.end(), key.begin());
  return key;
}

Bytes seal_packet(std::uint8_t kind, std::span<const std::uint8_t> clear,
                  const Key& key,
                  std::optional<std::array<std::uint8_t, 12>> iv) {
  std::array<std::uint8_t, 12> nonce{};
  if (iv) {
    nonce = *iv;
  } else {
    crypto::random_bytes(nonce);
  }
  Bytes cipher;
  std::array<std::uint8_t, 16> tag{};
  const Bytes aad = aad_of(kind);
  if (!crypto::aes256_gcm_seal(key, nonce, aad, clear, cipher, tag)) {
    return {};
  }
  Bytes packet;
  packet.reserve(kSealedHeaderBytes + cipher.size());
  packet.push_back(kind);
  packet.insert(packet.end(), nonce.begin(), nonce.end());
  packet.insert(packet.end(), tag.begin(), tag.end());
  packet.insert(packet.end(), cipher.begin(), cipher.end());
  return packet;
}

std::optional<OpenedPacket> open_packet(std::span<const std::uint8_t> packet,
                                        const Key& key) {
  if (packet.size() < kSealedHeaderBytes || packet.size() > kMaxPacketBytes) {
    return std::nullopt;
  }
  const std::uint8_t kind = packet[0];
  if (kind < kPacketSignal || kind > kPacketAuthAccepted) {
    return std::nullopt;
  }
  OpenedPacket opened;
  opened.kind = kind;
  if (!crypto::aes256_gcm_open(key, packet.subspan(1, 12), aad_of(kind),
                               packet.subspan(kSealedHeaderBytes),
                               packet.subspan(13, 16), opened.clear)) {
    return std::nullopt;
  }
  return opened;
}

std::optional<json::Value> open_signal(std::span<const std::uint8_t> clear) {
  auto message = json::parse(text_of(clear));
  if (!message || !signals::is_lan_signal(&*message)) {
    return std::nullopt;
  }
  return message;
}

Bytes seal_auth_challenge(std::string_view challenge, const Key& key) {
  return seal_value(kPacketAuthChallenge,
                    json::Value::object({{"challenge", json::Value::string(std::string(challenge))}}),
                    key);
}

std::optional<std::string> open_auth_challenge(std::span<const std::uint8_t> clear) {
  const auto value = auth_value(clear);
  const std::string* challenge = value ? json::string_at(*value, "challenge") : nullptr;
  if (challenge == nullptr || !url_token(*challenge, 43)) {
    return std::nullopt;
  }
  return *challenge;
}

Bytes seal_auth_ready(const AuthReady& ready, const Key& key) {
  // In the order the TypeScript's objects are written (`joinLanPeer`).
  json::Value value = json::Value::object({
      {"challenge", json::Value::string(ready.challenge)},
      {"deviceName", json::Value::string(ready.device_name)},
      {"peerId", json::Value::string(ready.peer_id)},
  });
  if (ready.computer_id) {
    value.set("computerId", json::Value::string(*ready.computer_id));
  }
  if (ready.fresh) {
    value.set("fresh", json::Value::boolean(true));
  }
  return seal_value(kPacketAuthReady, value, key);
}

std::optional<AuthReady> open_auth_ready(std::span<const std::uint8_t> clear) {
  const auto value = auth_value(clear);
  if (!value) {
    return std::nullopt;
  }
  const std::string* challenge = json::string_at(*value, "challenge");
  const std::string* device = json::string_at(*value, "deviceName");
  const json::Value* computer = value->get("computerId");
  const json::Value* fresh = value->get("fresh");
  if (challenge == nullptr || !url_token(*challenge, 43) ||
      !is_peer_id(value->get("peerId")) || device == nullptr ||
      json::trim(*device).empty() || json::utf16_length(*device) > 128 ||
      (computer != nullptr &&
       !(computer->is_string() && is_computer_id(computer->as_string()))) ||
      (fresh != nullptr && !fresh->is_bool())) {
    return std::nullopt;
  }
  AuthReady ready;
  ready.challenge = *challenge;
  ready.device_name = json::trim(*device);
  ready.peer_id = value->get("peerId")->as_string();
  if (computer != nullptr) {
    ready.computer_id = computer->as_string();
  }
  ready.fresh = fresh != nullptr && fresh->as_bool();
  return ready;
}

Bytes seal_auth_accepted(const AuthAccepted& accepted, const Key& key) {
  return seal_value(kPacketAuthAccepted,
                    json::Value::object({
                        {"challenge", json::Value::string(accepted.challenge)},
                        {"peerId", json::Value::string(accepted.peer_id)},
                    }),
                    key);
}

std::optional<AuthAccepted> open_auth_accepted(std::span<const std::uint8_t> clear) {
  const auto value = auth_value(clear);
  const std::string* challenge = value ? json::string_at(*value, "challenge") : nullptr;
  if (challenge == nullptr || !url_token(*challenge, 43) ||
      !is_peer_id(value->get("peerId"))) {
    return std::nullopt;
  }
  return AuthAccepted{*challenge, value->get("peerId")->as_string()};
}

std::optional<Bytes> encode_audio(const AudioChunk& chunk, bool compress) {
  if (chunk.peer_id.empty() || json::utf16_length(chunk.peer_id) > 128 ||
      chunk.sample_rate < 8000 || chunk.sample_rate > 384000 ||
      chunk.channels < 1 || chunk.channels > 8 || chunk.frames < 1 ||
      chunk.frames > 8192 ||
      chunk.pcm.size() != static_cast<std::size_t>(chunk.frames) * chunk.channels * 4) {
    return std::nullopt;
  }
  Bytes packet(kAudioHeaderBytes);
  put_u32(packet, 0, chunk.sequence);
  put_u32(packet, 4, chunk.sample_rate);
  packet[8] = chunk.channels;
  packet[9] = static_cast<std::uint8_t>(chunk.frames & 0xFF);
  packet[10] = static_cast<std::uint8_t>(chunk.frames >> 8);
  packet[11] = compress ? kAudioZstd : kAudioRaw;
  if (!compress) {
    packet.insert(packet.end(), chunk.pcm.begin(), chunk.pcm.end());
    return packet;
  }
  const std::size_t bound = ZSTD_compressBound(chunk.pcm.size());
  packet.resize(kAudioHeaderBytes + bound);
  const std::size_t written =
      ZSTD_compress(packet.data() + kAudioHeaderBytes, bound, chunk.pcm.data(),
                    chunk.pcm.size(), 1);
  if (ZSTD_isError(written) != 0) {
    return std::nullopt;
  }
  packet.resize(kAudioHeaderBytes + written);
  return packet;
}

std::optional<AudioChunk> decode_audio(std::string_view peer_id,
                                       std::span<const std::uint8_t> clear) {
  if (clear.size() < kAudioHeaderBytes) {
    return std::nullopt;
  }
  const std::uint8_t channels = clear[8];
  const auto frames = static_cast<std::uint16_t>(clear[9] | (clear[10] << 8));
  if (channels < 1 || channels > 8 || frames < 1 || frames > 8192) {
    return std::nullopt;
  }
  const std::size_t expected = static_cast<std::size_t>(channels) * frames * 4;
  const std::uint8_t encoding = clear[11];
  const auto payload = clear.subspan(kAudioHeaderBytes);
  AudioChunk chunk;
  if (encoding == kAudioRaw && payload.size() == expected) {
    chunk.pcm.assign(payload.begin(), payload.end());
  } else if (encoding == kAudioZstd) {
    // `maxOutputLength`: the frame must fit the samples it claims to hold;
    // one that says more, or not at all, is refused before it is unpacked.
    const unsigned long long declared =
        ZSTD_getFrameContentSize(payload.data(), payload.size());
    if (declared == ZSTD_CONTENTSIZE_ERROR ||
        (declared != ZSTD_CONTENTSIZE_UNKNOWN && declared > expected)) {
      return std::nullopt;
    }
    chunk.pcm.resize(expected);
    const std::size_t written = ZSTD_decompress(chunk.pcm.data(), expected,
                                                payload.data(), payload.size());
    if (ZSTD_isError(written) != 0) {
      return std::nullopt;
    }
    chunk.pcm.resize(written);
  } else {
    return std::nullopt;
  }
  chunk.peer_id = std::string(peer_id);
  chunk.sequence = get_u32(clear, 0);
  chunk.sample_rate = get_u32(clear, 4);
  chunk.channels = channels;
  chunk.frames = frames;
  if (chunk.peer_id.empty() || json::utf16_length(chunk.peer_id) > 128 ||
      chunk.sample_rate < 8000 || chunk.sample_rate > 384000 ||
      chunk.pcm.size() != expected) {
    return std::nullopt;
  }
  return chunk;
}

}  // namespace feq::share::lan

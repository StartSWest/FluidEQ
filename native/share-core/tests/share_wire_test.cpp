/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Share Audio's wire in C++ against what the TypeScript the app runs wrote
// (`share_wire_fixture.h`, from `src/main/shareAudio/shareWireFixture.ts`):
// the same ids, keys and session keys from the same secrets, the same codes
// made and the same codes read, packets sealed to the same bytes under the
// same IVs and opened again, every control message taken or refused as the
// TypeScript does, audio raw and squeezed read to the same samples, the same
// discovery datagrams, and the same addresses chosen.

#include <cstdio>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>

#include "fluideq/share/addresses.h"
#include "fluideq/share/discovery.h"
#include "fluideq/share/json.h"
#include "fluideq/share/lan_protocol.h"
#include "fluideq/share/signals.h"
#include "share_wire_fixture.h"

namespace {

namespace fixture = feq::share::fixture;
namespace lan = feq::share::lan;
namespace json = feq::share::json;
namespace crypto = feq::share::crypto;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

std::span<const std::uint8_t> bytes(const std::string& text) {
  return crypto::bytes_of(text);
}

std::vector<std::string> split(const std::string& text, char by) {
  std::vector<std::string> out;
  std::stringstream stream(text);
  std::string part;
  while (std::getline(stream, part, by)) {
    out.push_back(part);
  }
  return out;
}

/** A decoded code as the TypeScript's `JSON.stringify` writes it. */
std::string reads_as(const lan::PairingPayload& payload) {
  std::vector<json::Value> addresses;
  for (const std::string& address : payload.addresses) {
    addresses.push_back(json::Value::string(address));
  }
  return json::stringify(json::Value::object({
      {"address", json::Value::string(payload.address)},
      {"addresses", json::Value::array(std::move(addresses))},
      {"deviceName", json::Value::string(payload.device_name)},
      {"port", json::Value::number(payload.port)},
      {"secret", json::Value::string(payload.secret)},
  }));
}

lan::Key key_of(const fixture::Bytes& value) {
  lan::Key key{};
  std::memcpy(key.data(), value.value.data(), key.size());
  return key;
}

void identities() {
  for (std::size_t at = 0; at < std::size(fixture::kSecrets); ++at) {
    const std::string secret = fixture::kSecrets[at].value;
    check(lan::computer_id_of(secret) == fixture::kComputerIds[at].value,
          "computer id of secret " + std::to_string(at));
    check(lan::is_computer_id(lan::computer_id_of(secret)),
          "a computer id is one");
    const lan::Key key = lan::key_from_secret(secret);
    check(std::equal(key.begin(), key.end(), fixture::kKeys[at].value.begin()),
          "pairing key of secret " + std::to_string(at));
  }
  const lan::Key pairing = key_of(fixture::kKeys[0]);
  for (std::size_t at = 0; at < std::size(fixture::kPeerIds); ++at) {
    const lan::Key session = lan::derive_session_key(
        pairing, fixture::kChallenge, fixture::kPeerIds[at].value);
    check(std::equal(session.begin(), session.end(),
                     fixture::kSessionKeys[at].value.begin()),
          "session key for peer " + std::to_string(at));
  }
}

void codes() {
  for (const auto& made : fixture::kMadeCodes) {
    const std::string code = lan::encode_pairing_code(
        split(made.addresses, ','), made.port, fixture::kSecrets[made.secret].value,
        made.name);
    check(code == made.code, std::string("code made for ") + made.name);
  }
  int at = 0;
  for (const auto& entry : fixture::kCodeCases) {
    const auto payload = lan::decode_pairing_code(entry.code);
    const std::string got = payload ? reads_as(*payload) : std::string();
    if (got != entry.reads) {
      std::printf("  code %d: got [%s] want [%s]\n", at, got.c_str(), entry.reads);
    }
    check(got == entry.reads, "code read " + std::to_string(at));
    ++at;
  }
}

void packets() {
  const lan::Key key = key_of(fixture::kKeys[0]);
  for (const auto& entry : fixture::kSealCases) {
    std::array<std::uint8_t, 12> iv{};
    for (std::size_t index = 0; index < iv.size(); ++index) {
      iv[index] = static_cast<std::uint8_t>((entry.seed * 31 + index * 7) % 256);
    }
    const std::string clear = entry.clear;
    const auto sealed = lan::seal_packet(entry.kind, bytes(clear), key, iv);
    check(sealed == entry.packet.value,
          "sealed to the same bytes, kind " + std::to_string(entry.kind));
    const auto opened = lan::open_packet(entry.packet.value, key);
    check(opened && opened->kind == entry.kind &&
              std::string(opened->clear.begin(), opened->clear.end()) == clear,
          "the TypeScript's packet opens, kind " + std::to_string(entry.kind));
    // A packet bit-flipped anywhere, or under another key, is no packet.
    auto broken = entry.packet.value;
    broken.back() ^= 0x01;
    check(!lan::open_packet(broken, key), "a changed byte is refused");
    auto rekind = entry.packet.value;
    rekind[0] = rekind[0] == 1 ? 2 : 1;
    check(!lan::open_packet(rekind, key), "a packet's kind is sealed with it");
    check(!lan::open_packet(entry.packet.value, key_of(fixture::kKeys[1])),
          "another key opens nothing");
    rekind[0] = 9;
    check(!lan::open_packet(rekind, key), "a kind that is none is refused");
  }
  check(!lan::open_packet(std::vector<std::uint8_t>(28), key),
        "a packet shorter than its header is refused");
  // Sealed properly under a kind the wire does not have: still refused.
  check(!lan::open_packet(lan::seal_packet(9, bytes("{}"), key), key),
        "a kind that is none is refused even when sealed under it");
  // The authentication messages, read as the TypeScript reads them.
  const lan::Key pairing = key_of(fixture::kKeys[0]);
  const auto& ready_packet = fixture::kSealCases[2].packet.value;
  const auto ready_open = lan::open_packet(ready_packet, pairing);
  const auto ready = ready_open ? lan::open_auth_ready(ready_open->clear) : std::nullopt;
  check(ready && ready->device_name == "Den" &&
            ready->peer_id == fixture::kPeerIds[1].value &&
            ready->computer_id == std::string(fixture::kComputerIds[1].value) &&
            ready->fresh && ready->challenge == fixture::kChallenge,
        "the ready message reads as the TypeScript wrote it");
  const auto accepted_open = lan::open_packet(fixture::kSealCases[3].packet.value, pairing);
  const auto accepted =
      accepted_open ? lan::open_auth_accepted(accepted_open->clear) : std::nullopt;
  check(accepted && accepted->peer_id == fixture::kPeerIds[2].value,
        "the accepted message reads");
  const auto challenge_open = lan::open_packet(fixture::kSealCases[1].packet.value, pairing);
  check(challenge_open && lan::open_auth_challenge(challenge_open->clear) ==
                              std::optional<std::string>(fixture::kChallenge),
        "the challenge reads");
  // And what this side seals, it opens to the same message.
  lan::AuthReady mine{fixture::kChallenge, "Den", "peer-1", std::nullopt, false};
  const auto mine_open = lan::open_packet(lan::seal_auth_ready(mine, pairing), pairing);
  const auto mine_ready = mine_open ? lan::open_auth_ready(mine_open->clear) : std::nullopt;
  check(mine_ready && !mine_ready->computer_id && !mine_ready->fresh &&
            mine_ready->peer_id == "peer-1",
        "a ready message sealed here reads back");
}

void control_messages() {
  int at = 0;
  for (const auto& entry : fixture::kSignalCases) {
    const auto opened = lan::open_signal(bytes(entry.text));
    if (opened.has_value() != entry.taken) {
      std::printf("  signal %d: %s\n", at, entry.text);
    }
    check(opened.has_value() == entry.taken,
          "control message " + std::to_string(at) +
              (entry.taken ? " taken" : " refused"));
    ++at;
  }
}

void audio() {
  const auto raw = lan::decode_audio("p", fixture::kAudioRaw.value);
  check(raw && raw->pcm == fixture::kAudioPcm.value && raw->sequence == 77 &&
            raw->sample_rate == 48000 && raw->channels == 2 && raw->frames == 480,
        "raw audio reads to the same samples");
  const auto squeezed = lan::decode_audio("p", fixture::kAudioSqueezed.value);
  check(squeezed && squeezed->pcm == fixture::kAudioPcm.value,
        "Node's squeezed audio reads to the same samples");
  lan::AudioChunk chunk;
  chunk.peer_id = "p";
  chunk.sequence = 77;
  chunk.sample_rate = 48000;
  chunk.channels = 2;
  chunk.frames = 480;
  chunk.pcm = fixture::kAudioPcm.value;
  check(lan::encode_audio(chunk, false) == fixture::kAudioRaw.value,
        "raw audio written to the same bytes");
  const auto mine = lan::encode_audio(chunk, true);
  const auto back = mine ? lan::decode_audio("p", *mine) : std::nullopt;
  check(back && back->pcm == chunk.pcm && mine->size() < chunk.pcm.size(),
        "audio squeezed here reads back, and is smaller");
  auto short_raw = fixture::kAudioRaw.value;
  short_raw.pop_back();
  check(!lan::decode_audio("p", short_raw), "raw audio a byte short is refused");
  auto lying = fixture::kAudioSqueezed.value;
  lying[9] = 0x00;
  lying[10] = 0x01;  // 256 frames claimed: the samples do not fit.
  check(!lan::decode_audio("p", lying), "squeezed audio of another size is refused");
  auto unknown = fixture::kAudioRaw.value;
  unknown[11] = 7;
  check(!lan::decode_audio("p", unknown), "an encoding that is none is refused");
  chunk.frames = 8193;
  check(!lan::encode_audio(chunk, false), "a chunk past 8192 frames is refused");
}

void discovery_datagrams() {
  const std::string secret = fixture::kSecrets[0].value;
  check(feq::share::discovery::encode_query(secret) == fixture::kQuery.value,
        "the query, byte for byte");
  check(feq::share::discovery::encode_announcement(secret, 51234, "Den \xC3\xB1") ==
            fixture::kAnnouncement.value,
        "the announcement, byte for byte");
  int at = 0;
  for (const auto& entry : fixture::kDatagramCases) {
    const std::string text = entry.text;
    check(feq::share::discovery::is_query(bytes(text), secret) == entry.query,
          "datagram " + std::to_string(at) + " as a query");
    const auto read = feq::share::discovery::decode_announcement(bytes(text), secret);
    const std::string got =
        read ? std::to_string(read->port) + "\n" + read->device_name : std::string();
    check(got == entry.announces, "datagram " + std::to_string(at) + " as an answer");
    ++at;
  }
}

void adapters() {
  std::vector<feq::share::addresses::AdapterAddress> list;
  for (const auto& row : fixture::kAdapters) {
    list.push_back({row.name, row.address, row.netmask, row.internal});
  }
  const auto chosen = feq::share::addresses::lan_interfaces(list);
  check(chosen.size() == std::size(fixture::kChosen), "as many addresses chosen");
  for (std::size_t at = 0; at < std::min(chosen.size(), std::size(fixture::kChosen)); ++at) {
    check(chosen[at].address + " " + chosen[at].broadcast == fixture::kChosen[at].value,
          "address " + std::to_string(at) + " and its broadcast");
  }
  const auto targets = feq::share::addresses::discovery_targets(list);
  check(targets.size() == std::size(fixture::kTargets), "as many places asked");
  for (std::size_t at = 0; at < std::min(targets.size(), std::size(fixture::kTargets)); ++at) {
    check(targets[at] == fixture::kTargets[at].value, "place asked " + std::to_string(at));
  }
}

void json_numbers() {
  // `String(n)` for the shapes a message carries.
  const std::pair<double, const char*> cases[] = {
      {0.0, "0"},        {-0.0, "0"},        {4000.0, "4000"},
      {1200.5, "1200.5"}, {0.1, "0.1"},       {1e21, "1e+21"},
      {123456789012345680000.0, "123456789012345680000"},
      {1e-7, "1e-7"},    {0.000001, "0.000001"}, {-2.5e-10, "-2.5e-10"},
      {9007199254740991.0, "9007199254740991"}};
  for (const auto& [value, text] : cases) {
    check(json::number_text(value) == text, std::string("number ") + text);
  }
}

}  // namespace

int main() {
  identities();
  codes();
  packets();
  control_messages();
  audio();
  discovery_datagrams();
  adapters();
  json_numbers();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("share wire: the TypeScript's bytes, in C++\n");
  return 0;
}

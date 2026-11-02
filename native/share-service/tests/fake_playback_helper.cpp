/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// A stand-in for FluidEQ-LAN-Playback, for the Share Audio service's live
// test (`smoke-share-service.ts`): it speaks the helper's protocol and opens
// no device. Ready on start, protocol 2; every request answered as taken;
// and each chunk pushed for a computer answered at once with that
// computer's meter — its sequence as the buffered milliseconds and its first
// sample as the peak — so the test can see the sound that arrived over the
// link, at the volume the service applied, without a sound being made.

#include <windows.h>

#include <array>
#include <cstdint>
#include <cstring>
#include <vector>

namespace {

constexpr std::uint32_t kMagic = 0x31504c46;
constexpr std::size_t kHeader = 24;

void put_u32(std::uint8_t* at, std::uint32_t value) {
  std::memcpy(at, &value, 4);
}

std::uint32_t u32_at(const std::uint8_t* at) {
  std::uint32_t value = 0;
  std::memcpy(&value, at, 4);
  return value;
}

bool write_all(HANDLE out, const std::vector<std::uint8_t>& bytes) {
  std::size_t sent = 0;
  while (sent < bytes.size()) {
    DWORD written = 0;
    if (WriteFile(out, bytes.data() + sent,
                  static_cast<DWORD>(bytes.size() - sent), &written,
                  nullptr) == FALSE) {
      return false;
    }
    sent += written;
  }
  return true;
}

bool reply(HANDLE out, std::uint32_t kind, std::uint32_t id, std::uint32_t rate,
           const std::vector<std::uint8_t>& payload = {}) {
  std::vector<std::uint8_t> bytes(kHeader + payload.size());
  put_u32(bytes.data(), kMagic);
  put_u32(bytes.data() + 4, kind);
  put_u32(bytes.data() + 8, id);
  put_u32(bytes.data() + 12, rate);
  put_u32(bytes.data() + 20, static_cast<std::uint32_t>(payload.size()));
  std::memcpy(bytes.data() + kHeader, payload.data(), payload.size());
  return write_all(out, bytes);
}

}  // namespace

int main() {
  const HANDLE in = GetStdHandle(STD_INPUT_HANDLE);
  const HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
  if (!reply(out, 1, 0, 2)) {
    return 1;
  }
  std::vector<std::uint8_t> pending;
  std::array<std::uint8_t, 64 * 1024> chunk{};
  for (;;) {
    DWORD read = 0;
    if (ReadFile(in, chunk.data(), static_cast<DWORD>(chunk.size()), &read,
                 nullptr) == FALSE ||
        read == 0) {
      return 0;
    }
    pending.insert(pending.end(), chunk.begin(), chunk.begin() + read);
    while (pending.size() >= kHeader) {
      if (u32_at(pending.data()) != kMagic) {
        return 1;
      }
      const std::uint32_t kind = u32_at(pending.data() + 4);
      const std::uint32_t id = u32_at(pending.data() + 8);
      const std::uint32_t size = u32_at(pending.data() + 20);
      if (pending.size() < kHeader + size) {
        break;
      }
      const std::vector<std::uint8_t> payload(
          pending.begin() + kHeader, pending.begin() + kHeader + size);
      pending.erase(pending.begin(), pending.begin() + kHeader + size);
      if (kind == 6) {
        return 0;
      }
      if (kind == 1 || kind == 7 || kind == 8) {
        if (!reply(out, 3, id, 0)) {
          return 1;
        }
      } else if (kind == 2 && payload.size() >= 8) {
        float first = 0;
        std::memcpy(&first, payload.data() + 4, 4);
        const std::array<double, 3> meter{
            static_cast<double>(u32_at(payload.data())),
            static_cast<double>(first), 0.0};
        std::vector<std::uint8_t> bytes(sizeof meter);
        std::memcpy(bytes.data(), meter.data(), sizeof meter);
        if (!reply(out, 5, id, 0, bytes)) {
          return 1;
        }
      }
    }
  }
}

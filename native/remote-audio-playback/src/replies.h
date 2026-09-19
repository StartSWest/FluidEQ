/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <Windows.h>
#include <cstdint>
struct PlaybackHeader {
  std::uint32_t magic = 0x31504c46, kind = 0, id = 0, rate = 0;
  std::uint16_t channels = 0, frames = 0;
  std::uint32_t bytes = 0;
};
static_assert(sizeof(PlaybackHeader) == 24);
bool playback_read(void* data, std::uint32_t size);
bool playback_reply(std::uint32_t kind, std::uint32_t id = 0,
                    std::uint32_t result = 0, const void* data = nullptr,
                    std::uint32_t size = 0);

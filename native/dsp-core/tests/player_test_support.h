/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the player's tests share: a decoder that generates rather than reads,
 * a block to render into, and the check that counts failures.
 *
 * No file touches these tests. What is being checked is the transport — the
 * rings, the seek handshake, the fades and every change of track — and a real
 * file would only add a way for a test to fail for reasons that are not the
 * player's.
 */
#ifndef FLUIDEQ_PLAYER_TEST_SUPPORT_H
#define FLUIDEQ_PLAYER_TEST_SUPPORT_H

#include "fluideq/player.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

namespace player_test {

constexpr double kPi = 3.14159265358979323846;

inline int g_failures = 0;

inline void check(bool ok, const char* what) {
  std::printf("  %-4s %s\n", ok ? "ok" : "FAIL", what);
  if (!ok) {
    ++g_failures;
  }
}

/** The process's exit: every check passed, or how many did not. */
inline int finish() {
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

/**
 * A decoder whose files are described by their name.
 *
 * "tone:<rate>:<frames>:<hz>" is a sine; "ramp:<rate>:<frames>" counts upwards
 * so a test can name the exact frame it is looking at, which is what makes the
 * seek check possible at all; "dc:<rate>:<frames>:<level>" holds one value, so
 * a mix of tracks reads as the sum of their levels and says which is heard.
 */
struct Source {
  bool ramp = false;
  bool dc = false;
  uint32_t rate = 48000;
  uint64_t frames = 0;
  double hz = 0.0;
  uint64_t position = 0;
};

inline double sample_at(const Source& source, uint64_t frame) {
  if (source.ramp) {
    // One per frame, scaled so a whole track stays inside a float's exact
    // integer range and a test can read the frame number back out.
    return static_cast<double>(frame) / 1000000.0;
  }
  if (source.dc) {
    return source.hz;
  }
  return std::sin((2.0 * kPi * source.hz * static_cast<double>(frame)) /
                  static_cast<double>(source.rate));
}

/** Split on colons. Hand-rolled because MSVC rejects `sscanf` under /WX. */
inline std::vector<std::string> split(const std::string& text) {
  std::vector<std::string> parts;
  size_t at = 0;
  for (;;) {
    const size_t next = text.find(':', at);
    if (next == std::string::npos) {
      parts.push_back(text.substr(at));
      return parts;
    }
    parts.push_back(text.substr(at, next - at));
    at = next + 1;
  }
}

inline void* decoder_open(void* /*user*/, const char* path,
                          FeqDecoderInfo* info) {
  const std::vector<std::string> parts = split(std::string(path));
  if (parts.size() < 3) {
    return nullptr;
  }
  auto* source = new Source();
  source->ramp = parts[0] == "ramp";
  source->dc = parts[0] == "dc";
  if (!source->ramp &&
      ((parts[0] != "tone" && parts[0] != "dc") || parts.size() < 4)) {
    delete source;
    return nullptr;
  }
  source->rate = static_cast<uint32_t>(std::stoul(parts[1]));
  source->frames = std::stoull(parts[2]);
  source->hz = source->ramp ? 0.0 : std::stod(parts[3]);

  info->sample_rate = source->rate;
  info->channels = 2;
  info->total_frames = source->frames;
  return source;
}

inline void decoder_close(void* /*user*/, void* handle) {
  delete static_cast<Source*>(handle);
}

inline uint32_t decoder_read(void* /*user*/, void* handle,
                             float* const* channels, uint32_t frames) {
  auto* source = static_cast<Source*>(handle);
  uint32_t produced = 0;
  while (produced < frames && source->position < source->frames) {
    const double value = sample_at(*source, source->position);
    channels[0][produced] = static_cast<float>(value);
    channels[1][produced] = static_cast<float>(value);
    ++produced;
    ++source->position;
  }
  return produced;
}

inline int decoder_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* source = static_cast<Source*>(handle);
  if (frame > source->frames) {
    return 0;
  }
  source->position = frame;
  return 1;
}

inline FeqDecoderOps generating_ops() {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = decoder_open;
  ops.close = decoder_close;
  ops.read = decoder_read;
  ops.seek = decoder_seek;
  return ops;
}

struct Block {
  std::vector<float> storage;
  std::vector<float*> pointers;

  explicit Block(uint32_t frames) {
    storage.assign(static_cast<size_t>(2) * frames, 0.0f);
    pointers = {storage.data(), storage.data() + frames};
  }
};

}  // namespace player_test

#endif /* FLUIDEQ_PLAYER_TEST_SUPPORT_H */

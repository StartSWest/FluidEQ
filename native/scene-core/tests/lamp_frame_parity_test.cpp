/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The lamps' frames in C++ (`LampListener`) against the window's own frame
// maker run on the same song, fed the same way (`lamp_frame_fixture.h`,
// written by `src/renderer/lighting/lampFrameFixture.ts`): the energy
// fixture's song in blocks of a hop, silent for a second near its end and
// paused for a second and a half in the middle, past the hops a listener
// keeps. Every frame's timing, fade and
// music, and every sixth frame's spectrum and waveform texels.

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "fixture_song.h"
#include "fluideq/scene/lamp_listener.h"
#include "lamp_frame_fixture.h"

namespace {

namespace fixture = feq::scene::fixture;

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

struct Heard {
  std::array<double, 9> scalars{};
  std::array<std::uint8_t, 512> spectrum{};
  std::array<std::uint8_t, 128> waveform{};
};

std::vector<Heard> listen() {
  const double rate = fixture::kLampFrameRate;
  const auto quiet_from =
      static_cast<std::int64_t>(rate * fixture::kLampFrameSilentFrom);
  const auto quiet_to =
      static_cast<std::int64_t>(rate * fixture::kLampFrameSilentTo);
  const auto total =
      static_cast<std::int64_t>(rate * fixture::kLampFrameSongSeconds);
  const auto block = static_cast<std::size_t>(std::lround(rate * 10.0 / 1000.0));
  feq::scene::LampListener listener(rate, {0.0, 0.9, 0.8});
  std::vector<float> pcm(block * 2);
  std::vector<Heard> frames;
  std::int64_t n = 0;
  for (int index = 0; n < total; ++index) {
    for (std::size_t frame = 0; frame < block; ++frame) {
      double left = 0.0;
      double right = 0.0;
      const std::int64_t at = n + static_cast<std::int64_t>(frame);
      if (at < quiet_from || at >= quiet_to) {
        fixture::shaped_sample(at, rate, left, right);
      }
      pcm[frame * 2] = static_cast<float>(left);
      pcm[frame * 2 + 1] = static_cast<float>(right);
    }
    n += static_cast<std::int64_t>(block);
    listener.set_paused(index >= fixture::kLampFramePausedFrom &&
                        index < fixture::kLampFramePausedTo);
    listener.push(pcm.data(), block, 2, [&](const feq::scene::LampFrame& f) {
      Heard heard;
      const auto& s = f.scene;
      heard.scalars = {f.delta_ms, s.time_seconds, s.fade,     s.level,
                       s.beat,     s.bands[0],     s.bands[1], s.bands[2],
                       f.silent ? 1.0 : 0.0};
      heard.spectrum = s.spectrum;
      heard.waveform = s.waveform;
      frames.push_back(heard);
    });
  }
  return frames;
}

constexpr const char* kNames[9] = {"delta ms", "time s", "fade",
                                   "level",    "beat",   "bass",
                                   "mid",      "treble", "silent"};

}  // namespace

int main() {
  const auto frames = listen();
  const std::size_t want = std::size(fixture::kLampFrames);
  std::printf("frames: %zu here, %zu in the window\n", frames.size(), want);
  check(frames.size() == want, "as many frames as the window makes");
  const std::size_t count = std::min(frames.size(), want);

  std::array<double, 9> worst{};
  std::array<std::size_t, 9> worst_at{};
  for (std::size_t at = 0; at < count; ++at) {
    for (std::size_t field = 0; field < 9; ++field) {
      const double gap =
          std::abs(frames[at].scalars[field] - fixture::kLampFrames[at][field]);
      if (gap > worst[field]) {
        worst[field] = gap;
        worst_at[field] = at;
      }
    }
  }
  for (std::size_t field = 0; field < 9; ++field) {
    std::printf("%-9s worst %.3g at frame %zu\n", kNames[field], worst[field],
                worst_at[field]);
    if (worst[field] > 1e-9) {
      std::printf("FAIL: %s differs from the window\n", kNames[field]);
      ++failures;
    }
  }

  // The texels are bytes from a level rounded at the last step: a level a
  // hair either side of a step's edge may land one apart, and no further.
  std::size_t texels = 0;
  std::size_t apart = 0;
  int widest = 0;
  for (std::size_t kept = 0; kept * fixture::kLampFrameTexelsEvery < count;
       ++kept) {
    const auto& heard = frames[kept * fixture::kLampFrameTexelsEvery];
    for (std::size_t texel = 0; texel < 512; ++texel) {
      const int gap = std::abs(static_cast<int>(heard.spectrum[texel]) -
                               fixture::kLampSpectra[kept][texel]);
      ++texels;
      apart += gap != 0 ? 1U : 0U;
      widest = std::max(widest, gap);
    }
    for (std::size_t texel = 0; texel < 128; ++texel) {
      const int gap = std::abs(static_cast<int>(heard.waveform[texel]) -
                               fixture::kLampWaveforms[kept][texel]);
      ++texels;
      apart += gap != 0 ? 1U : 0U;
      widest = std::max(widest, gap);
    }
  }
  std::printf("texels: %zu of %zu apart, widest %d\n", apart, texels, widest);
  check(widest <= 1, "no texel more than one step from the window's");
  check(apart * 1000 <= texels, "at most one texel in a thousand a step off");

  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("lamp frames: the window's, in C++\n");
  return 0;
}

#ifndef FLUIDEQ_ROOM_LEGACY_TRANSITION_FIXTURE_H
#define FLUIDEQ_ROOM_LEGACY_TRANSITION_FIXTURE_H
#include <algorithm>
#include <cmath>
#include <vector>

#include "fluideq/room.h"
// C-API-only fixture shared with the frozen-source capture executable. Each
// case drives an audible history, disables Room during silence, then enables.
inline std::vector<float> legacy_room_transition(int scenario, bool low) {
  constexpr unsigned frames = 128, taps = 256, directions = 24;
  const unsigned width = scenario == 3 ? 6u : 2u;
  FeqRoom* room = feq_room_create(48000, width, frames);
  std::vector<float> left(directions * taps), right(directions * taps);
  for (unsigned d = 0; d < directions; ++d) {
    const double side =
        std::sin(double(d) * 6.28318530717958647692 / directions);
    const unsigned delay = scenario == 1 ? 200u : 0u;
    left[d * taps + delay] = static_cast<float>(1 + .25 * side);
    right[d * taps + delay] = static_cast<float>(1 - .25 * side);
  }
  int speakers[6] = {0, 1, 2, -1, 3, 4};
  feq_room_set_head(room, left.data(), right.data(), directions, taps, 0);
  feq_room_set_layout(room, speakers, scenario == 3 ? 3 : -1);
  feq_room_set_low_latency(room, low ? 1 : 0);
  FeqRoomSettings settings{};
  feq_room_settings_defaults(&settings);
  settings.enabled = 1;
  settings.walls = 1;
  settings.bass_management = scenario == 0 ? 1 : 0;
  settings.music_upmix = scenario == 2 ? 1 : 0;
  feq_room_configure(room, &settings);
  float data[6][frames] = {};
  float* channels[6];
  for (unsigned ch = 0; ch < width; ++ch) channels[ch] = data[ch];
  const unsigned source = scenario == 3 ? 3u : 0u;
  for (unsigned block = 0; block < 8; ++block) {
    for (unsigned ch = 0; ch < width; ++ch)
      std::fill(data[ch], data[ch] + frames, 0.0f);
    if (scenario != 1) std::fill(data[source], data[source] + frames, .3f);
    if (block == 7) data[source][frames - 1] = 1;
    feq_room_process(room, channels, frames);
  }
  settings.enabled = 0;
  feq_room_configure(room, &settings);
  for (unsigned block = 0; block < 16; ++block) {
    for (unsigned ch = 0; ch < width; ++ch)
      std::fill(data[ch], data[ch] + frames, 0.0f);
    feq_room_process(room, channels, frames);
  }
  settings.enabled = 1;
  feq_room_configure(room, &settings);
  std::vector<float> output(32 * frames * 2);
  for (unsigned block = 0; block < 32; ++block) {
    for (unsigned ch = 0; ch < width; ++ch)
      std::fill(data[ch], data[ch] + frames, 0.0f);
    feq_room_process(room, channels, frames);
    for (unsigned i = 0; i < frames; ++i) {
      output[(block * frames + i) * 2] = data[0][i];
      output[(block * frames + i) * 2 + 1] = data[1][i];
    }
  }
  feq_room_destroy(room);
  return output;
}
#endif

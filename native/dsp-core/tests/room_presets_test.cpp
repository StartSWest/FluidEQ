/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The eleven rooms the card offers, run through the engine's room.
 *
 * The table is the app's (`roomPresets.ts`, pinned by `dspRoomPresets.test.ts`
 * to these values): a room retuned there is retuned here in the same commit.
 * Each room is measured for what a listener would notice: nothing clips on a
 * loud programme, every sample is a number, the walls come back after the
 * direct sound exactly when the room says they should — later in a bigger
 * room, not at all in the open air — and a louder sub is a louder sub.
 */

#include "fluideq/room.h"

#include "fluideq/convolver.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"

namespace {

using feq_test::check;
using feq_test::finish;
using feq_test::kFrames;
using feq_test::kRate;
using feq_test::Pink;

constexpr uint32_t kDirections = 24;
constexpr uint32_t kTaps = 64;
constexpr uint32_t kChannels = 8;
constexpr size_t kBlocks = 40;
/** The speed of sound the room's reflections are timed with. */
constexpr double kSoundMetresPerSecond = 343.0;

struct Room {
  const char* id;
  double size_m;
  double walls;
  double distance_m;
  double centre_db;
  double sub_db;
};

/** The pinned table, in the app's order. */
const Room kRooms[] = {
    {"studio", 3.2, 0.8, 1.4, 0, 0},
    {"livingRoom", 4.2, 0.55, 1.8, 0, 0},
    {"frontStage", 4.2, 0.6, 2, 0, 0},
    {"homeTheatre", 5.5, 0.45, 2.6, 1, 1.5},
    {"cinema", 9, 0.35, 4, 1.5, 2},
    {"gaming", 4.5, 0.5, 1.8, 0, 1},
    {"concertHall", 12, 0.2, 5, 0, -2},
    {"jazzClub", 5, 0.4, 2.2, 0, 1},
    {"club", 6, 0.15, 2.5, 0, 4},
    {"nearField", 2.4, 0.9, 0.9, 0, 0},
    {"openAir", 12, 1, 3, 0, -1},
};

/** A head of unit impulses: every direction reaches both ears at once. */
std::vector<float> impulse_head() {
  std::vector<float> ring(kDirections * kTaps, 0.0f);
  for (uint32_t direction = 0; direction < kDirections; ++direction) {
    ring[direction * kTaps] = 1.0f;
  }
  return ring;
}

struct Fixture {
  FeqRoom* room;
  std::vector<float> head = impulse_head();
  explicit Fixture(const Room& shape) {
    room = feq_room_create(kRate, kChannels, kFrames);
    feq_room_set_head(room, head.data(), head.data(), kDirections, kTaps, 0);
    // 7.1: FL FR C LFE SL SR RL RR.
    const int speakers[kChannels] = {0, 1, 2, -1, 3, 4, 5, 6};
    feq_room_set_layout(room, speakers, 3);
    FeqRoomSettings settings{};
    feq_room_settings_defaults(&settings);
    settings.enabled = 1;
    settings.size_m = shape.size_m;
    settings.walls = shape.walls;
    settings.distance_m = shape.distance_m;
    settings.centre_db = shape.centre_db;
    settings.sub_db = shape.sub_db;
    feq_room_configure(room, &settings);
    feq_room_reset(room);
  }
  ~Fixture() { feq_room_destroy(room); }
};

using Planar = std::vector<std::vector<float>>;

Planar planar(size_t blocks = kBlocks) {
  return Planar(kChannels, std::vector<float>(blocks * kFrames, 0.0f));
}

void run(FeqRoom* room, Planar& b) {
  std::vector<float*> pointers(b.size());
  for (size_t block = 0; block * kFrames < b[0].size(); ++block) {
    for (size_t channel = 0; channel < b.size(); ++channel) {
      pointers[channel] = b[channel].data() + block * kFrames;
    }
    feq_room_process(room, pointers.data(), kFrames);
  }
}

double peak(const std::vector<float>& v) {
  double value = 0.0;
  for (const float sample : v) {
    value = std::max(value, std::fabs(static_cast<double>(sample)));
  }
  return value;
}

bool finite(const std::vector<float>& v) {
  for (const float sample : v) {
    if (!std::isfinite(sample)) {
      return false;
    }
  }
  return true;
}

double energy(const std::vector<float>& v, size_t from, size_t to) {
  double total = 0.0;
  for (size_t at = from; at < to && at < v.size(); ++at) {
    total += static_cast<double>(v[at]) * v[at];
  }
  return total;
}

/**
 * A single impulse on the front left: the direct sound arrives after the
 * convolver's partition, and the first wall comes back after the extra
 * path the nearest mirror image travels — computed here from the room's
 * own geometry (the speaker at -30° on its ring, the four walls at half
 * the side), so each room's first reflection is expected on one frame and
 * checked there, and dead walls send nothing back at all. The detection
 * starts past the head's longest interaural shift, which is the far ear's
 * copy of the direct sound and not a wall.
 */
void walls_come_back_when_and_only_when_the_room_says() {
  std::printf("walls come back when the room says\n");
  const uint32_t latency = feq_convolver_latency();
  constexpr double kFrontLeftDeg = -30.0;
  constexpr size_t kInterauralFrames = 40;
  for (const Room& shape : kRooms) {
    Fixture fixture(shape);
    auto b = planar();
    b[0][0] = 0.5f;
    run(fixture.room, b);
    const size_t direct = latency;
    const size_t after = direct + kInterauralFrames;
    const double tail = energy(b[0], after, b[0].size()) +
                        energy(b[1], after, b[1].size());
    std::printf("  %-12s tail energy %.3g\n", shape.id, tail);
    if (shape.walls >= 1.0) {
      check(tail < 1e-9, "open air: nothing comes back from the walls");
      continue;
    }
    check(tail > 1e-6, "a walled room sends something back");
    size_t first = b[0].size();
    for (size_t at = after; at < b[0].size(); ++at) {
      if (std::fabs(b[0][at]) > 1e-5f || std::fabs(b[1][at]) > 1e-5f) {
        first = at;
        break;
      }
    }
    // The nearest mirror image of the speaker across the four walls.
    const double radians = kFrontLeftDeg * feq_test::kPi / 180.0;
    const double x = shape.distance_m * std::sin(radians);
    const double y = shape.distance_m * std::cos(radians);
    const double h = shape.size_m / 2.0;
    const double images[4][2] = {
        {2.0 * h - x, y}, {-2.0 * h - x, y}, {x, 2.0 * h - y}, {x, -2.0 * h - y}};
    double nearest = 1e9;
    for (const auto& image : images) {
      nearest = std::min(nearest, std::hypot(image[0], image[1]));
    }
    const double extra_frames =
        (nearest - shape.distance_m) / kSoundMetresPerSecond * kRate;
    check(extra_frames > static_cast<double>(kInterauralFrames),
          "the first wall is past the head's own delay (precondition)");
    const auto expected = direct + static_cast<size_t>(std::lround(extra_frames));
    std::printf("    first reflection at +%zu frames, geometry says +%zu\n",
                first - direct, expected - direct);
    check(first + 1 >= expected && first <= expected + 1,
          "the first reflection lands where the room's geometry says");
  }
}

/**
 * A 7.1 programme — a different pink noise on every channel, each peaking
 * at -20 dBFS, which is where a loud film moment sits per channel — leaves
 * under full scale in every room, and every sample is a number. Not the
 * same noise on all eight: eight identical channels sum coherently to a
 * level no mix carries, and the rack's limiter, not the room, is what
 * stands behind the room for that case.
 */
void nothing_clips_and_everything_is_a_number() {
  std::printf("nothing clips\n");
  for (const Room& shape : kRooms) {
    Fixture fixture(shape);
    auto b = planar();
    for (uint32_t channel = 0; channel < kChannels; ++channel) {
      Pink source;
      source.noise.seed = 1000u + channel * 7919u;
      for (float& sample : b[channel]) {
        sample = static_cast<float>(source.next());
      }
      feq_test::normalise(b[channel], 0.1);
    }
    run(fixture.room, b);
    const double out = std::max(peak(b[0]), peak(b[1]));
    std::printf("  %-12s peak %.3f\n", shape.id, out);
    check(finite(b[0]) && finite(b[1]), "every sample is a number");
    check(out < 1.0, "a 7.1 programme at -20 dBFS a channel does not clip");
    check(out > 0.01, "the room passes the programme (control)");
  }
}

/** The sub dial: the club's +4 dB sub is louder than open air's -1 dB. */
void a_louder_sub_is_louder() {
  std::printf("a louder sub is louder\n");
  const auto sub_energy = [](const Room& shape) {
    Fixture fixture(shape);
    auto b = planar();
    for (size_t at = 0; at < b[3].size(); ++at) {
      b[3][at] = static_cast<float>(0.3 * std::sin(2.0 * feq_test::kPi * 60.0 *
                                                   static_cast<double>(at) /
                                                   kRate));
    }
    run(fixture.room, b);
    return energy(b[0], b[0].size() / 2, b[0].size());
  };
  const double club = sub_energy(kRooms[8]);
  const double open = sub_energy(kRooms[10]);
  std::printf("  club %.4g, open air %.4g\n", club, open);
  check(club > open * 2.0, "the club's sub carries more than open air's");
}

}  // namespace

int main() {
  std::printf("room presets\n\n");
  walls_come_back_when_and_only_when_the_room_says();
  nothing_clips_and_everything_is_a_number();
  a_louder_sub_is_louder();
  return finish();
}

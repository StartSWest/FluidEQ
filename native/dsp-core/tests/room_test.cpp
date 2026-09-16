/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room, through a synthetic head whose numbers are known: the near ear
 * gets a unit impulse, the far ear a half-height one delayed by the
 * interaural delay of the direction. So "the left speaker reaches the right
 * ear later by the head's delay" is a count of frames, not an impression.
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
using feq_test::kPi;
using feq_test::kRate;

constexpr uint32_t kDirections = 24;
constexpr uint32_t kTaps = 256;
constexpr size_t kBlocks = 8;

struct HeadRing {
  std::vector<float> left;
  std::vector<float> right;
};

uint32_t interaural_frames(double angle_deg) {
  return static_cast<uint32_t>(std::lround(
      0.00065 * std::fabs(std::sin(angle_deg * kPi / 180.0)) * kRate));
}

HeadRing synthetic_head() {
  HeadRing ring;
  ring.left.assign(kDirections * kTaps, 0.0f);
  ring.right.assign(kDirections * kTaps, 0.0f);
  for (uint32_t direction = 0; direction < kDirections; ++direction) {
    const double angle = direction * 15.0;
    const double sine = std::sin(angle * kPi / 180.0);
    float* left = ring.left.data() + direction * kTaps;
    float* right = ring.right.data() + direction * kTaps;
    if (std::fabs(sine) < 1e-9) {
      left[0] = 1.0f;
      right[0] = 1.0f;
      continue;
    }
    float* near = sine > 0.0 ? right : left;
    float* far = sine > 0.0 ? left : right;
    near[0] = 1.0f;
    far[interaural_frames(angle)] = 0.5f;
  }
  return ring;
}

struct Fixture {
  FeqRoom* room;
  FeqRoomSettings settings{};
  HeadRing head;
  Fixture(uint32_t channels, const int* speakers, int lfe) {
    room = feq_room_create(kRate, channels, kFrames);
    head = synthetic_head();
    feq_room_set_head(room, head.left.data(), head.right.data(), kDirections,
                      kTaps, 0);
    feq_room_set_layout(room, speakers, lfe);
    feq_room_settings_defaults(&settings);
    settings.enabled = 1;
    settings.walls = 1.0;
    feq_room_configure(room, &settings);
    feq_room_reset(room);
  }
  ~Fixture() { feq_room_destroy(room); }
};

using Planar = std::vector<std::vector<float>>;

Planar planar(uint32_t channels, size_t blocks = kBlocks) {
  return Planar(channels, std::vector<float>(blocks * kFrames, 0.0f));
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

double energy(const std::vector<float>& v, size_t from = 0) {
  double total = 0.0;
  for (size_t at = from; at < v.size(); ++at) {
    total += static_cast<double>(v[at]) * v[at];
  }
  return total;
}

size_t first_nonzero(const std::vector<float>& v) {
  for (size_t at = 0; at < v.size(); ++at) {
    if (std::fabs(v[at]) > 1e-6f) {
      return at;
    }
  }
  return v.size();
}

double worst_step(const std::vector<float>& v, size_t from) {
  double worst = 0.0;
  for (size_t at = from; at + 1 < v.size(); ++at) {
    worst = std::max(worst, static_cast<double>(std::fabs(v[at + 1] - v[at])));
  }
  return worst;
}

void off_is_pass_through() {
  std::printf("off is pass-through\n");
  const int speakers[2] = {0, 1};
  Fixture f(2, speakers, -1);
  f.settings.enabled = 0;
  feq_room_configure(f.room, &f.settings);
  Planar b = planar(2);
  b[0][100] = 0.7f;
  b[1][200] = -0.4f;
  const Planar in = b;
  run(f.room, b);
  check(b == in, "buffers untouched");
  check(feq_room_latency_frames(f.room) == 0, "no latency while off");
  check(feq_room_active(f.room) == 0, "not active");
}

void stereo_becomes_a_front_stage() {
  std::printf("stereo becomes a front stage\n");
  const int speakers[2] = {0, 1};
  Fixture f(2, speakers, -1);
  Planar b = planar(2);
  b[0][10] = 1.0f;  // The left speaker alone.
  run(f.room, b);
  check(feq_room_active(f.room) == 1, "active");
  check(feq_room_latency_frames(f.room) == feq_convolver_latency(),
        "latency is one partition");
  check(energy(b[0]) > energy(b[1]) * 2.0,
        "left ear louder than right for the left speaker (positive control)");
  const size_t left = first_nonzero(b[0]);
  const size_t right = first_nonzero(b[1]);
  std::printf("  left ear at %zu, right ear at %zu, head delay %u frames\n",
              left, right, interaural_frames(30.0));
  check(left == 10 + feq_convolver_latency(), "left ear on time");
  check(right > left && right - left == interaural_frames(30.0),
        "right ear hears the left speaker later by the head's delay");
}

void seven_one_folds_to_the_pair() {
  std::printf("7.1 folds to the pair\n");
  const int speakers[8] = {0, 1, 2, -1, 5, 6, 3, 4};
  Fixture f(8, speakers, 3);
  Planar b = planar(8);
  for (auto& channel : b) {
    channel[10] = 0.5f;
  }
  run(f.room, b);
  bool silent = true;
  for (uint32_t channel = 2; channel < 8; ++channel) {
    silent = silent && energy(b[channel]) == 0.0;
  }
  check(silent, "every channel beyond the pair leaves silent");
  check(energy(b[0]) > 0.0 && energy(b[1]) > 0.0, "both ears carry the room");
}

void the_sub_reaches_both_ears_equally() {
  std::printf("the sub reaches both ears equally\n");
  const int speakers[6] = {0, 1, 2, -1, 5, 6};
  Fixture f(6, speakers, 3);
  Planar b = planar(6);
  for (size_t at = 0; at < b[3].size(); ++at) {
    b[3][at] = static_cast<float>(std::sin(2.0 * kPi * 50.0 * at / kRate));
  }
  run(f.room, b);
  const double left = energy(b[0], kFrames);
  const double right = energy(b[1], kFrames);
  std::printf("  left %.3f right %.3f\n", left, right);
  check(left > 1.0, "the sub is heard (positive control)");
  check(std::fabs(left - right) / left < 1e-9,
        "the LFE lands in both ears the same, in phase");
}

void hard_walls_add_reflections_and_dead_walls_none() {
  std::printf("hard walls add reflections, dead walls none\n");
  const int speakers[2] = {0, 1};
  Fixture dead(2, speakers, -1);
  Fixture hard(2, speakers, -1);
  hard.settings.walls = 0.0;
  feq_room_configure(hard.room, &hard.settings);
  Planar a = planar(2);
  Planar b = planar(2);
  a[0][10] = 1.0f;
  b[0][10] = 1.0f;
  run(dead.room, a);
  run(hard.room, b);
  // Past the direct path and the far ear's delay.
  const size_t after = feq_convolver_latency() + 10 + kTaps;
  std::printf("  energy after the direct path: dead %.6f hard %.6f\n",
              energy(a[0], after), energy(b[0], after));
  check(energy(a[0], after) < 1e-9, "dead walls: nothing after the direct path");
  check(energy(b[0], after) > 1e-4,
        "hard walls: reflections after it (positive control)");
}

void a_dial_moves_without_a_step() {
  std::printf("a dial moves without a step\n");
  const int speakers[2] = {0, 1};
  Fixture dead(2, speakers, -1);
  Fixture hard(2, speakers, -1);
  Fixture moving(2, speakers, -1);
  hard.settings.walls = 0.0;
  feq_room_configure(hard.room, &hard.settings);
  constexpr size_t blocks = 40;
  Planar tone = planar(2, blocks);
  for (size_t at = 0; at < tone[0].size(); ++at) {
    const auto sample =
        static_cast<float>(0.5 * std::sin(2.0 * kPi * 440.0 * at / kRate));
    tone[0][at] = sample;
    tone[1][at] = sample;
  }
  Planar a = tone;
  Planar b = tone;
  Planar c = tone;
  run(dead.room, a);
  run(hard.room, b);
  std::vector<float*> pointers(2);
  for (size_t block = 0; block < blocks; ++block) {
    if (block == 20) {
      moving.settings.walls = 0.0;
      feq_room_configure(moving.room, &moving.settings);
    }
    for (size_t channel = 0; channel < 2; ++channel) {
      pointers[channel] = c[channel].data() + block * kFrames;
    }
    feq_room_process(moving.room, pointers.data(), kFrames);
  }
  const double steady = std::max(worst_step(a[0], kFrames * 4),
                                 worst_step(b[0], kFrames * 4));
  const double during = worst_step(c[0], kFrames * 4);
  std::printf("  worst step steady %.5f, while the walls change %.5f\n",
              steady, during);
  check(during <= steady * 1.05,
        "no jump beyond what either steady room has");
  // Positive control: the change did happen.
  check(energy(c[0], kFrames * 30) > energy(a[0], kFrames * 30) * 1.01,
        "the reflections arrived after the change");
}

}  // namespace

int main() {
  std::printf("room\n\n");
  off_is_pass_through();
  stereo_becomes_a_front_stage();
  seven_one_folds_to_the_pair();
  the_sub_reaches_both_ears_equally();
  hard_walls_add_reflections_and_dead_walls_none();
  a_dial_moves_without_a_step();
  return finish();
}

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
    // Off here: these tests count frames through the head and the walls,
    // and a crossover in the way would put its own ringing on every impulse.
    // The bass management test switches it on itself.
    settings.bass_management = 0;
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

/**
 * A speaker's own distance and its mute. Farther is later: the left
 * speaker moved from the ring's 1.8 m to 3 m arrives the extra path later,
 * frame for frame, and the right one on the ring does not move. Muted is
 * silent: the left muted leaves the left impulse nowhere while the right
 * speaker is still heard.
 */
void a_speaker_has_its_own_distance_and_can_be_muted() {
  std::printf("a speaker has its own distance and can be muted\n");
  const int speakers[2] = {0, 1};
  // One speaker fed at a time: the left ear hears the right speaker too,
  // and its crosstalk would be the first thing counted.
  const auto arrival = [&](double left_distance, int mute_left,
                           bool feed_right) {
    Fixture f(2, speakers, -1);
    f.settings.speaker_distance_m[0] = left_distance;
    f.settings.mute[0] = mute_left;
    feq_room_configure(f.room, &f.settings);
    Planar b = planar(2);
    b[0][10] = 1.0f;
    if (feed_right) {
      b[1][40] = 1.0f;
    }
    run(f.room, b);
    return b;
  };
  const Planar ring = arrival(0.0, 0, false);
  const Planar far = arrival(3.0, 0, false);
  const size_t ring_left = first_nonzero(ring[0]);
  const size_t far_left = first_nonzero(far[0]);
  const auto extra = static_cast<size_t>(
      std::lround((3.0 - 1.8) / 343.0 * kRate));
  std::printf("  left speaker at 1.8 m: %zu; at 3 m: %zu; extra %zu frames\n",
              ring_left, far_left, extra);
  check(far_left == ring_left + extra,
        "a farther speaker arrives later by its extra path");
  check(energy(far[0]) < energy(ring[0]) * 0.5,
        "and quieter: 3 m against 1.8 m is under half the power");
  const Planar muted = arrival(0.0, 1, true);
  std::printf("  left muted: left ear %.4g, right ear %.4g\n",
              energy(muted[0]), energy(muted[1]));
  check(first_nonzero(muted[0]) ==
            40 + feq_convolver_latency() + interaural_frames(30.0),
        "a muted speaker leaves nothing of its own: the left ear's first sound "
        "is the right speaker's crosstalk");
  check(energy(muted[1]) > 0.0, "the right speaker is still heard");
  {
    Fixture f(2, speakers, -1);
    f.settings.mute[0] = 1;
    f.settings.mute[1] = 1;
    feq_room_configure(f.room, &f.settings);
    check(feq_room_active(f.room) == 1,
          "a room with every speaker muted is a silent room, not one switched off");
  }
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

/**
 * Bass management: a 40 Hz tone on the front left leaves through the sub's
 * path — both ears the same, in phase — and not through the speaker, whose
 * head would have put it in one ear first; a 2 kHz tone on the same speaker
 * is untouched by the crossover and still lands in the near ear first. Off,
 * the 40 Hz tone goes the speaker's way like anything else.
 */
void bass_management_sends_the_bass_to_the_sub() {
  std::printf("bass management sends the bass to the sub\n");
  const int speakers[6] = {0, 1, 2, -1, 5, 6};
  const auto tone = [](Planar& b, uint32_t channel, double hz) {
    for (size_t at = 0; at < b[channel].size(); ++at) {
      b[channel][at] = static_cast<float>(std::sin(2.0 * kPi * hz * at / kRate));
    }
  };
  const auto settled = [](const std::vector<float>& v) {
    return energy(v, v.size() / 2);
  };
  {
    Fixture f(6, speakers, 3);
    f.settings.bass_management = 1;
    f.settings.crossover_hz = 80.0;
    feq_room_configure(f.room, &f.settings);
    Planar b = planar(6, 32);
    tone(b, 0, 40.0);
    run(f.room, b);
    const double left = settled(b[0]);
    const double right = settled(b[1]);
    double difference = 0.0;
    for (size_t at = b[0].size() / 2; at < b[0].size(); ++at) {
      difference = std::max(
          difference, static_cast<double>(std::fabs(b[0][at] - b[1][at])));
    }
    std::printf("  40 Hz managed: left %.3f right %.3f, ear difference %.4f\n",
                left, right, difference);
    check(left > 1.0, "the bass is heard (positive control)");
    // Within a tenth of each other: the sub's path is the same in both
    // ears, and what is left of 40 Hz above an 80 Hz crossover — 24 dB
    // down — is all the head can tell apart.
    check(std::fabs(left - right) < left * 0.1,
          "the bass lands in both ears alike: the sub's path");
  }
  {
    Fixture f(6, speakers, 3);
    f.settings.bass_management = 1;
    f.settings.crossover_hz = 80.0;
    feq_room_configure(f.room, &f.settings);
    Planar b = planar(6, 32);
    tone(b, 0, 2000.0);
    run(f.room, b);
    const double left = settled(b[0]);
    const double right = settled(b[1]);
    std::printf("  2 kHz managed: left %.3f right %.3f\n", left, right);
    check(left > 1.0, "the tone is heard (positive control)");
    check(right < left * 0.5,
          "a tone above the crossover still comes from the left speaker");
  }
  {
    Fixture f(6, speakers, 3);
    f.settings.bass_management = 0;
    feq_room_configure(f.room, &f.settings);
    Planar b = planar(6, 32);
    tone(b, 0, 40.0);
    run(f.room, b);
    const double left = settled(b[0]);
    const double right = settled(b[1]);
    std::printf("  40 Hz unmanaged: left %.3f right %.3f\n", left, right);
    check(right < left * 0.5,
          "without bass management the bass takes the speaker's way (control)");
  }
}

/**
 * The music upmix on a stereo stream. Dead walls and the synthetic head, so
 * the only thing after the direct sound is what the upmix adds: with it on,
 * an impulse on the left alone reaches the ears again later — the side
 * signal on the sides and the rears — where the front stage alone put
 * nothing; a mono impulse (left and right alike) has no side signal, so
 * only the centre joins it and the ears stay equal; and with the upmix off
 * the same left impulse leaves exactly one arrival per ear.
 */
void the_music_upmix_fills_the_ring() {
  std::printf("the music upmix fills the ring\n");
  const int speakers[2] = {0, 1};
  const uint32_t latency = feq_convolver_latency();
  const size_t after = latency + 10 + interaural_frames(30.0) + 4;
  const auto run_left = [&](int upmix, Planar& b) {
    Fixture f(2, speakers, -1);
    f.settings.music_upmix = upmix;
    f.settings.upmix_amount = 1.0;
    feq_room_configure(f.room, &f.settings);
    run(f.room, b);
  };
  Planar off = planar(2, 16);
  off[0][10] = 1.0f;
  run_left(0, off);
  Planar on = planar(2, 16);
  on[0][10] = 1.0f;
  run_left(1, on);
  const double off_tail = energy(off[0], after) + energy(off[1], after);
  const double on_tail = energy(on[0], after) + energy(on[1], after);
  std::printf("  after the direct sound: off %.4g, on %.4g\n", off_tail,
              on_tail);
  check(off_tail < 1e-9, "the front stage alone puts nothing after (control)");
  check(on_tail > 1e-3, "the upmix brings the sound back from the ring");
  // The rears trail the sides: the last arrival lands past the rear delay.
  size_t last = 0;
  for (size_t at = 0; at < on[0].size(); ++at) {
    if (std::fabs(on[0][at]) > 1e-4f || std::fabs(on[1][at]) > 1e-4f) {
      last = at;
    }
  }
  const auto rear = static_cast<size_t>(std::lround(0.022 * kRate));
  std::printf("  last arrival at %zu, rear delay %zu\n", last, latency + 10 + rear);
  check(last >= latency + 10 + rear, "the rears arrive after their delay");

  Planar mono = planar(2, 16);
  mono[0][10] = 1.0f;
  mono[1][10] = 1.0f;
  run_left(1, mono);
  double difference = 0.0;
  for (size_t at = 0; at < mono[0].size(); ++at) {
    difference = std::max(
        difference, static_cast<double>(std::fabs(mono[0][at] - mono[1][at])));
  }
  std::printf("  mono: ear difference %.4g\n", difference);
  check(difference < 1e-6, "a mono record makes no side signal: ears equal");
  check(energy(mono[0]) > 1.0, "the mono record is heard (control)");
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

/** A room that keeps playing across calls, so a tone stays one tone. */
struct Stream {
  FeqRoom* room;
  uint32_t channels;
  size_t clock = 0;

  /** `blocks` more of a 440 Hz tone on each channel in `fed`; both ears. */
  Planar play(const std::vector<uint32_t>& fed, size_t blocks) {
    Planar b = planar(channels, blocks);
    for (const uint32_t channel : fed) {
      for (size_t at = 0; at < b[channel].size(); ++at) {
        b[channel][at] = static_cast<float>(
            0.5 * std::sin(2.0 * kPi * 440.0 * (clock + at) / kRate));
      }
    }
    run(room, b);
    clock += blocks * kFrames;
    return b;
  }
};

/** Every speaker muted but `open`; -1 opens none. The sub is left alone. */
void solo(FeqRoomSettings& settings, int open) {
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    settings.mute[speaker] = speaker == open ? 0 : 1;
  }
}

/**
 * A MUTE OR A SOLO CHANGED WHILE THE ROOM PLAYS LANDS, WHATEVER IT LEAVES.
 *
 * A new set of kernels is faded in, and the fade's position was whatever the
 * one crossfade that ran handed back — so it only moved while some speaker
 * stood in BOTH sets. A solo moved from one speaker to another shares no
 * speaker with the set before it; neither does the last speaker muted, or
 * the first one opened again. The fade never moved, the new set was never
 * heard, and the page showed a solo the sound did not follow: the old
 * speaker played on, and a room muted to nothing stayed silent after it was
 * opened again. Every other test here sets its mutes before the first block,
 * which is a switch and not a fade, and so none of them saw it.
 *
 * In both of the room's forms: game mode renders a kernel's first partition
 * through a direct head beside the convolver, and the head has to follow the
 * same fade.
 */
void a_solo_moves_and_a_silent_room_comes_back(bool game_mode) {
  std::printf("a solo moves, and a silent room comes back%s\n",
              game_mode ? " (game mode)" : "");
  const int speakers[8] = {0, 1, 2, -1, 5, 6, 3, 4};
  Fixture f(8, speakers, 3);
  feq_room_set_low_latency(f.room, game_mode ? 1 : 0);
  solo(f.settings, 0);
  feq_room_configure(f.room, &f.settings);
  Stream stream{f.room, 8};
  constexpr size_t kSettle = 20;  // Warm-up and fade, several times over.
  const auto heard = [](const Planar& b) {
    return energy(b[0], b[0].size() / 2) + energy(b[1], b[1].size() / 2);
  };
  // The front right's channel alone is fed, all the way through.
  const double while_left_soloed = heard(stream.play({1}, kSettle));
  check(while_left_soloed < 1e-9,
        "the right speaker is silent while the left one is soloed");
  solo(f.settings, 1);
  feq_room_configure(f.room, &f.settings);
  const double right_soloed = heard(stream.play({1}, kSettle));
  std::printf("  right speaker: %.3g while the left is soloed, %.3g once it is\n",
              while_left_soloed, right_soloed);
  check(right_soloed > 1.0, "the solo moved: the right speaker is heard");
  solo(f.settings, -1);
  feq_room_configure(f.room, &f.settings);
  const double all_muted = heard(stream.play({1}, kSettle));
  check(all_muted < 1e-9, "the last speaker muted goes silent");
  f.settings.mute[1] = 0;
  feq_room_configure(f.room, &f.settings);
  const double opened = heard(stream.play({1}, kSettle));
  std::printf("  every speaker muted: %.3g; the right one opened again: %.3g\n",
              all_muted, opened);
  check(opened > 1.0, "a room muted to nothing comes back when one is opened");
  // To a hundredth: the two windows catch the tone at different phases.
  check(std::fabs(opened - right_soloed) / right_soloed < 0.01,
        "and as loud as it was");
}

/**
 * A MUTE FADES, IN AND OUT.
 *
 * A speaker the next set does not have played on at full level until the
 * sets were exchanged and stopped there, mid-wave; one only the next set has
 * was not run at all until the exchange and started there, cold. Both are a
 * step in the sound — a click on every press of Mute or Solo. Measured as the
 * largest jump between neighbouring samples, against the same tone playing
 * steadily.
 */
void a_mute_fades_in_and_out() {
  std::printf("a mute fades in and out\n");
  const int speakers[8] = {0, 1, 2, -1, 5, 6, 3, 4};
  Fixture f(8, speakers, 3);
  Stream stream{f.room, 8};
  constexpr size_t kSettle = 20;
  const Planar steady = stream.play({0, 1}, kSettle);
  const double usual = worst_step(steady[0], kFrames * 4);
  f.settings.mute[1] = 1;
  feq_room_configure(f.room, &f.settings);
  const Planar muting = stream.play({0, 1}, kSettle);
  f.settings.mute[1] = 0;
  feq_room_configure(f.room, &f.settings);
  const Planar opening = stream.play({0, 1}, kSettle);
  std::printf("  worst step: steady %.5f, muting %.5f, opening %.5f\n", usual,
              worst_step(muting[0], 0), worst_step(opening[0], 0));
  check(worst_step(muting[0], 0) <= usual * 1.05, "muting makes no step");
  check(worst_step(opening[0], 0) <= usual * 1.05, "opening makes no step");
  // POSITIVE CONTROL: the mute did land, and did lift.
  check(energy(muting[1], muting[1].size() / 2) <
            energy(steady[1], steady[1].size() / 2) * 0.6,
        "the right speaker left the right ear");
  check(energy(opening[1], opening[1].size() / 2) >
            energy(steady[1], steady[1].size() / 2) * 0.99,
        "and came back whole");
}

/** A solo as the wire spells it: the hush on every speaker but `on`. */
void hush_all_but(FeqRoomSettings& settings, int on) {
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    settings.mute[speaker] =
        (settings.mute[speaker] & FEQ_ROOM_MUTED) |
        (speaker == on ? 0 : FEQ_ROOM_HUSHED);
  }
}

/**
 * A SOLO HOLDS ONLY WHILE THE STREAM REACHES ITS SPEAKER.
 *
 * A stereo stream on the front stage feeds the front pair and nothing else.
 * A solo left on a side speaker — taken while a 7.1 game played, or while
 * stereo music filled the room — silenced those two to play one that nothing
 * fed: a room gone quiet with its switch on. The engine is the only thing
 * that knows what is playing, so it is the engine that drops the solo, and
 * the speakers' own mutes stand in its place.
 */
void a_solo_nothing_reaches_is_dropped() {
  std::printf("a solo nothing reaches is dropped\n");
  const auto ears = [](const Planar& b) { return energy(b[0]) + energy(b[1]); };
  {
    // Front stage: the right side speaker soloed, and the front right muted
    // for good measure. The left front is fed.
    const int speakers[2] = {0, 1};
    Fixture f(2, speakers, -1);
    f.settings.mute[1] = FEQ_ROOM_MUTED;
    hush_all_but(f.settings, 4);
    feq_room_configure(f.room, &f.settings);
    Planar left = planar(2);
    left[0][10] = 1.0f;
    run(f.room, left);
    Planar right = planar(2);
    right[1][10] = 1.0f;
    run(f.room, right);
    std::printf("  front stage, side right soloed: left front %.3g, "
                "right front (muted) %.3g\n",
                ears(left), ears(right));
    check(ears(left) > 0.1, "the front left still plays: the solo is dropped");
    check(ears(right) == 0.0, "and the front right's own mute still stands");
  }
  {
    // POSITIVE CONTROL: on the same front stage a solo the stream does reach
    // holds — the left front soloed silences the right.
    const int speakers[2] = {0, 1};
    Fixture f(2, speakers, -1);
    hush_all_but(f.settings, 0);
    feq_room_configure(f.room, &f.settings);
    Planar right = planar(2);
    right[1][10] = 1.0f;
    run(f.room, right);
    check(ears(right) == 0.0, "a solo on a fed speaker silences the others");
  }
  {
    // And under the music upmix every speaker is fed, so the side solo holds:
    // the fronts go, the side stays.
    const int speakers[2] = {0, 1};
    Fixture f(2, speakers, -1);
    f.settings.music_upmix = 1;
    f.settings.upmix_amount = 1.0;
    hush_all_but(f.settings, 4);
    feq_room_configure(f.room, &f.settings);
    Planar both = planar(2);
    both[0][10] = 1.0f;  // Left only: a side signal for the ring.
    run(f.room, both);
    Fixture whole(2, speakers, -1);
    whole.settings.music_upmix = 1;
    whole.settings.upmix_amount = 1.0;
    feq_room_configure(whole.room, &whole.settings);
    Planar all = planar(2);
    all[0][10] = 1.0f;
    run(whole.room, all);
    std::printf("  filled room: side right alone %.3g of the whole %.3g\n",
                ears(both), ears(all));
    check(ears(both) > 0.0 && ears(both) < ears(all) * 0.5,
          "with the room filled the side speaker is heard alone");
  }
  {
    // The soloed speaker plays whatever its own mute says.
    const int speakers[8] = {0, 1, 2, -1, 5, 6, 3, 4};
    Fixture f(8, speakers, 3);
    f.settings.mute[1] = FEQ_ROOM_MUTED;
    hush_all_but(f.settings, 1);
    feq_room_configure(f.room, &f.settings);
    Planar right = planar(8);
    right[1][10] = 1.0f;
    run(f.room, right);
    check(ears(right) > 0.1, "a soloed speaker is heard even if it is muted");
  }
}

/**
 * FILL THE ROOM ARRIVES AND LEAVES WITHOUT A STEP.
 *
 * Switched on over a stereo stream, the five speakers beyond the front pair
 * stand only in the replacement set: nothing fed them until the sets were
 * exchanged, so the whole ring started there at once, cold. Now the feeds
 * run from the moment the replacement is adopted, and the ring fades in; on
 * the way out it fades against silence like any speaker being muted.
 */
void fill_the_room_arrives_and_leaves_without_a_step() {
  std::printf("fill the room arrives and leaves without a step\n");
  const int speakers[2] = {0, 1};
  Fixture f(2, speakers, -1);
  Stream stream{f.room, 2};
  constexpr size_t kSettle = 20;
  // The left channel alone, so there is a side signal for the ring to carry.
  const Planar front = stream.play({0}, kSettle);
  f.settings.music_upmix = 1;
  f.settings.upmix_amount = 1.0;
  feq_room_configure(f.room, &f.settings);
  const Planar arriving = stream.play({0}, kSettle);
  const Planar filled = stream.play({0}, kSettle);
  f.settings.music_upmix = 0;
  feq_room_configure(f.room, &f.settings);
  const Planar leaving = stream.play({0}, kSettle);
  const double usual = std::max(worst_step(front[1], kFrames * 4),
                                worst_step(filled[1], 0));
  std::printf("  worst step: steady %.5f, arriving %.5f, leaving %.5f\n", usual,
              worst_step(arriving[1], 0), worst_step(leaving[1], 0));
  check(worst_step(arriving[1], 0) <= usual * 1.05, "the ring arrives smoothly");
  check(worst_step(leaving[1], 0) <= usual * 1.05, "and leaves smoothly");
  // POSITIVE CONTROL: the ring was there — the far ear hears more with it.
  const double without = energy(front[1], front[1].size() / 2);
  const double with = energy(filled[1], filled[1].size() / 2);
  std::printf("  right ear: front stage %.4g, filled %.4g\n", without, with);
  check(with > without * 1.2, "the ring is heard once it has arrived");
  check(std::fabs(energy(leaving[1], leaving[1].size() / 2) - without) / without <
            0.01,
        "and gone once it has left");
}

}  // namespace

int main() {
  std::printf("room\n\n");
  off_is_pass_through();
  stereo_becomes_a_front_stage();
  seven_one_folds_to_the_pair();
  the_sub_reaches_both_ears_equally();
  a_speaker_has_its_own_distance_and_can_be_muted();
  bass_management_sends_the_bass_to_the_sub();
  the_music_upmix_fills_the_ring();
  hard_walls_add_reflections_and_dead_walls_none();
  a_dial_moves_without_a_step();
  a_solo_moves_and_a_silent_room_comes_back(false);
  a_solo_moves_and_a_silent_room_comes_back(true);
  a_mute_fades_in_and_out();
  a_solo_nothing_reaches_is_dropped();
  fill_the_room_arrives_and_leaves_without_a_step();
  return finish();
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room at the four rates that used to have no head, rendering at its
 * head's rate between a converter's two halves (`room_rate.h`, whose own test
 * is `room_rate_test.cpp`): sample for sample the room at its head's rate
 * behind a converter of its own, on both renderers and in game mode, through
 * a chain handover and a switch off and back on.
 */

#include "../src/room_rate.h"
#include "../src/room_internal.h"
#include "dsp_test_support.h"
#include "room_rate_cases.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <iterator>
#include <vector>

using feq_test::block_of;
using feq_test::check;
using Case = feq_test::RateCase;

namespace {

// 5.1 as Windows orders it, FL FR C LFE SL SR, so the walls, the centre and
// the sub all have something to carry.
constexpr uint32_t kChannels = 6;
constexpr int kSpeakers[FEQ_ROOM_MAX_CHANNELS] = {0, 1, 2, -1, 3, 4, -1, -1};
constexpr int kLfe = 3;
constexpr uint32_t kDirections = 24;
constexpr uint32_t kTaps = 256;

using Planar = std::vector<std::vector<float>>;

/** Every direction and ear its own decaying noise: no two alike. */
struct Head {
  std::vector<float> left;
  std::vector<float> right;
};

Head noise_head() {
  Head head;
  head.left.resize(kDirections * kTaps);
  head.right.resize(kDirections * kTaps);
  feq_test::Noise noise{12345u};
  for (size_t at = 0; at < head.left.size(); ++at) {
    const double decay = std::exp(-static_cast<double>(at % kTaps) / 24.0);
    head.left[at] = static_cast<float>(0.5 * decay * noise.next());
    head.right[at] = static_cast<float>(0.5 * decay * noise.next());
  }
  return head;
}

/** A different pink noise on each channel, `seconds` long. */
Planar programme(const Case& c, double seconds) {
  Planar in(kChannels, std::vector<float>(static_cast<size_t>(c.stream * seconds)));
  for (uint32_t channel = 0; channel < kChannels; ++channel) {
    feq_test::Pink source;
    source.noise.seed = 1000u + channel * 7919u;
    for (float& sample : in[channel]) {
      sample = static_cast<float>(0.1 * source.next());
    }
  }
  return in;
}

FeqRoomSettings room_settings(int renderer) {
  FeqRoomSettings settings;
  feq_room_settings_defaults(&settings);
  settings.enabled = 1;
  settings.renderer_version = renderer;
  settings.walls = 0.2;
  settings.ambience_mix = 0.5;
  return settings;
}

FeqRoom* room_at(double rate, uint32_t max_frames, const Head& head,
                 const FeqRoomSettings& settings, bool game) {
  FeqRoom* room = feq_room_create(rate, kChannels, max_frames);
  if (room == nullptr) {
    return nullptr;
  }
  feq_room_set_head(room, head.left.data(), head.right.data(), kDirections,
                    kTaps, 0);
  feq_room_set_layout(room, kSpeakers, kLfe);
  feq_room_set_low_latency(room, game ? 1 : 0);
  feq_room_configure(room, &settings);
  feq_room_reset(room);
  return room;
}

/**
 * `step(at, frames)` for each block of `total` frames, in the blocks a driver
 * might hand over: the most, one frame, a prime, the factor less one, and
 * lengths no factor divides.
 */
template <typename Step>
void in_ragged_blocks(const Case& c, size_t total, Step&& step) {
  const uint32_t max = block_of(c);
  const uint32_t sizes[] = {max, 1u, 7u, c.factor - 1u, max - 1u, 333u};
  size_t at = 0;
  for (size_t turn = 0; at < total; ++turn) {
    const auto frames = static_cast<uint32_t>(
        std::min<size_t>(sizes[turn % std::size(sizes)], total - at));
    step(at, frames);
    at += frames;
  }
}

/** The room at the output's rate, processing `planes` in place at `at`. */
void process_at(FeqRoom* room, Planar& planes, size_t at, uint32_t frames) {
  std::vector<float*> channels(planes.size());
  for (size_t channel = 0; channel < planes.size(); ++channel) {
    channels[channel] = planes[channel].data() + at;
  }
  feq_room_process(room, channels.data(), frames);
}

/** A room at its head's rate behind a converter of its own. */
struct Between {
  FeqRoom* room;
  RoomRate rate;
  Planar planes;
  std::vector<float*> pointers;
  Between(const Case& c, uint32_t room_block, const Head& head,
          const FeqRoomSettings& settings, bool game)
      : room(room_at(c.room, room_block, head, settings, game)),
        planes(kChannels, std::vector<float>(room_block)),
        pointers(kChannels) {
    rate.prepare(c.room, c.factor, kChannels, block_of(c));
    for (uint32_t channel = 0; channel < kChannels; ++channel) {
      pointers[channel] = planes[channel].data();
    }
  }
  ~Between() { feq_room_destroy(room); }
  Between(const Between&) = delete;
  Between& operator=(const Between&) = delete;

  /** `frames` of `in` at `at`, its two ears written to `ears` at `at`. */
  void process(const Planar& in, Planar& ears, size_t at, uint32_t frames) {
    std::vector<const float*> source(kChannels);
    for (uint32_t channel = 0; channel < kChannels; ++channel) {
      source[channel] = in[channel].data() + at;
    }
    const uint32_t made = rate.decimate(source.data(), frames, pointers.data());
    if (made > 0u) {
      feq_room_process(room, pointers.data(), made);
    }
    float* out[2] = {ears[0].data() + at, ears[1].data() + at};
    rate.interpolate(pointers.data(), made, out, frames);
  }
};

bool ears_match(const Planar& heard, const Planar& expected, size_t from) {
  const auto start = static_cast<std::ptrdiff_t>(from);
  for (uint32_t ear = 0; ear < 2u; ++ear) {
    if (!std::equal(heard[ear].begin() + start, heard[ear].end(),
                    expected[ear].begin() + start)) {
      return false;
    }
  }
  return true;
}

double energy_from(const std::vector<float>& samples, size_t from) {
  double energy = 0.0;
  for (size_t at = from; at < samples.size(); ++at) {
    energy += static_cast<double>(samples[at]) * samples[at];
  }
  return energy;
}

/**
 * The room at the output's rate against the room at its head's rate between
 * a converter's two halves, fed the same 5.1 programme: the same samples, on
 * both renderers, buffered and in game mode. And against the same room with
 * other walls, which must not be the same (the control), or "the same" could
 * mean "silent".
 */
void the_room_is_its_heads_room_between_the_halves(const Case& c) {
  std::printf("%.1f kHz through %.1f kHz\n", c.stream / 1000.0, c.room / 1000.0);
  const Head head = noise_head();
  const Planar in = programme(c, 0.3);
  for (const int renderer : {1, 2}) {
    for (const bool game : {false, true}) {
      const FeqRoomSettings settings = room_settings(renderer);
      FeqRoomSettings other = settings;
      other.walls = 0.9;

      FeqRoom* fast = room_at(c.stream, block_of(c), head, settings, game);
      check(fast != nullptr && fast->sample_rate == c.room &&
                fast->rate.factor() == c.factor,
            "a room at the rate renders at its head's, through the converter");
      if (fast == nullptr) {
        continue;
      }
      check(feq_room_active(fast) == 1, "and is active, where it used to have no head");
      Between slow(c, fast->max_frames, head, settings, game);
      Between control(c, fast->max_frames, head, other, game);
      const uint32_t own = game ? 0u : feq_convolver_latency();
      check(feq_room_latency_frames(fast) == own * c.factor + slow.rate.latency(),
            "its delay is its own at the head's rate, and the converter's");

      Planar heard = in;
      Planar expected(2, std::vector<float>(in[0].size()));
      Planar walls = expected;
      in_ragged_blocks(c, in[0].size(), [&](size_t at, uint32_t frames) {
        process_at(fast, heard, at, frames);
        slow.process(in, expected, at, frames);
        control.process(in, walls, at, frames);
      });
      const double energy = energy_from(heard[0], 0);
      std::printf("  renderer %d, %s: left ear %.1f dB of energy\n", renderer,
                  game ? "game mode" : "buffered", 10.0 * std::log10(energy + 1e-30));
      check(ears_match(heard, expected, 0),
            "the same samples as the room at its head's rate between the halves");
      bool rest_silent = true;
      for (uint32_t channel = 2; channel < kChannels; ++channel) {
        rest_silent = rest_silent &&
                      std::all_of(heard[channel].begin(), heard[channel].end(),
                                  [](float sample) { return sample == 0.0f; });
      }
      check(rest_silent, "every channel past the two ears leaves silent");
      check(energy > 1.0, "a programme is heard (control)");
      check(!ears_match(heard, walls, 0),
            "and not those of a room with other walls (control)");
      feq_room_destroy(fast);
    }
  }
}

/**
 * A chain handover at the rate: half way through, a second room takes the
 * first's state (`feq_room_transfer`) and carries on — the converter's
 * histories and what it kept between blocks with the rest, or the new room
 * would play its filter's length of silence. Against the same handover
 * between two rooms at the head's rate, behind one converter that never
 * stopped.
 */
void a_room_handover_carries_the_converter(const Case& c) {
  const Head head = noise_head();
  const Planar in = programme(c, 0.3);
  const FeqRoomSettings settings = room_settings(1);
  FeqRoom* fast = room_at(c.stream, block_of(c), head, settings, false);
  FeqRoom* fast_next = room_at(c.stream, block_of(c), head, settings, false);
  if (fast == nullptr || fast_next == nullptr) {
    check(false, "two rooms are made at the rate");
    feq_room_destroy(fast);
    feq_room_destroy(fast_next);
    return;
  }
  Between slow(c, fast->max_frames, head, settings, false);
  FeqRoom* slow_next = room_at(c.room, fast->max_frames, head, settings, false);
  Planar heard = in;
  Planar expected(2, std::vector<float>(in[0].size()));
  size_t handed_at = 0;
  in_ragged_blocks(c, in[0].size(), [&](size_t at, uint32_t frames) {
    if (handed_at == 0 && at >= in[0].size() / 2u) {
      feq_room_transfer(fast_next, fast);
      std::swap(fast, fast_next);
      feq_room_transfer(slow_next, slow.room);
      std::swap(slow.room, slow_next);
      handed_at = at;
    }
    process_at(fast, heard, at, frames);
    slow.process(in, expected, at, frames);
  });
  std::printf("  handed over at frame %zu\n", handed_at);
  check(handed_at > 0 && ears_match(heard, expected, 0),
        "a room that takes another's state carries on its sound, converter and all");
  feq_room_destroy(fast);
  feq_room_destroy(fast_next);
  feq_room_destroy(slow_next);
}

/**
 * A room switched off and back on: off, the output is left as it came; back
 * on, the converter starts clean rather than replaying the last of what it
 * held when the room stopped. Against the room at the head's rate switched
 * the same way, behind a converter cleared at the same moment.
 */
void a_room_switched_back_on_starts_its_converter_clean(const Case& c) {
  const Head head = noise_head();
  const Planar in = programme(c, 0.45);
  const size_t total = in[0].size();
  for (const int renderer : {1, 2}) {
    const FeqRoomSettings on = room_settings(renderer);
    FeqRoomSettings off = on;
    off.enabled = 0;
    FeqRoom* fast = room_at(c.stream, block_of(c), head, on, false);
    if (fast == nullptr) {
      check(false, "a room is made at the rate");
      continue;
    }
    Between slow(c, fast->max_frames, head, on, false);
    Planar heard = in;
    Planar expected(2, std::vector<float>(total));
    size_t off_at = 0;
    size_t on_at = 0;
    bool left_alone = true;
    in_ragged_blocks(c, total, [&](size_t at, uint32_t frames) {
      if (off_at == 0 && at >= total / 3u) {
        feq_room_configure(fast, &off);
        feq_room_configure(slow.room, &off);
        off_at = at;
      } else if (off_at != 0 && on_at == 0 && at >= 2u * total / 3u) {
        feq_room_configure(fast, &on);
        feq_room_configure(slow.room, &on);
        slow.rate.reset();
        on_at = at;
      }
      process_at(fast, heard, at, frames);
      slow.process(in, expected, at, frames);
      if (off_at != 0 && on_at == 0) {
        const auto from = static_cast<std::ptrdiff_t>(at);
        for (uint32_t channel = 0; channel < kChannels; ++channel) {
          left_alone = left_alone &&
                       std::equal(heard[channel].begin() + from,
                                  heard[channel].begin() + from + frames,
                                  in[channel].begin() + from);
        }
      }
    });
    std::printf("  renderer %d: off at frame %zu, back on at %zu\n", renderer,
                off_at, on_at);
    check(off_at > 0 && left_alone, "switched off, the output is left as it came");
    check(on_at > 0 && ears_match(heard, expected, on_at) &&
              energy_from(heard[0], on_at) > 1.0,
          "back on, it plays as a room behind a clean converter");
    feq_room_destroy(fast);
  }
}

}  // namespace

int main() {
  std::printf("the room through its converter\n\n");
  for (const Case& c : feq_test::kRateCases) {
    the_room_is_its_heads_room_between_the_halves(c);
    a_room_handover_carries_the_converter(c);
    a_room_switched_back_on_starts_its_converter_clean(c);
  }
  return feq_test::finish();
}

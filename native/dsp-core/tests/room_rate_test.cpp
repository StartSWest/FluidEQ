/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The converter a room renders between on an output faster than its heads
 * (`room_rate.h`), measured alone, with the room replaced by a straight wire:
 * what comes out has to be what went in, delayed by exactly what it says and
 * flat to 20 kHz, whatever the blocks — and nothing that would fold under
 * 20 kHz may come through. And the table that sends each output rate to a
 * head. The room itself through the converter is `room_converted_test.cpp`.
 */

#include "../src/room_rate.h"
#include "../src/room_internal.h"
#include "dsp_test_support.h"
#include "room_rate_cases.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <vector>

using feq_test::block_of;
using feq_test::check;
using feq_test::kPi;
using Case = feq_test::RateCase;

namespace {

double db(double ratio) { return 20.0 * std::log10(std::max(ratio, 1e-12)); }

std::vector<float> tone(size_t frames, double hz, double rate, double delay) {
  std::vector<float> out(frames);
  for (size_t at = 0; at < frames; ++at) {
    out[at] = static_cast<float>(
        0.5 * std::sin(2.0 * kPi * hz * (static_cast<double>(at) - delay) / rate));
  }
  return out;
}

/**
 * Two channels through the converter and a wire where the room would be, in
 * blocks of `sizes` taken in turn; returns the left ear.
 */
std::vector<float> through(RoomRate& rate, const std::vector<float>& in,
                           const std::vector<uint32_t>& sizes) {
  std::vector<float> out(in.size(), 0.0f);
  std::vector<float> room_left(rate.max_room_frames());
  std::vector<float> room_right(rate.max_room_frames());
  float* room[2] = {room_left.data(), room_right.data()};
  std::vector<float> right_in(in.size());
  std::vector<float> right_out(in.size());
  size_t at = 0;
  size_t turn = 0;
  while (at < in.size()) {
    const auto frames = static_cast<uint32_t>(
        std::min<size_t>(sizes[turn++ % sizes.size()], in.size() - at));
    const float* source[2] = {in.data() + at, right_in.data() + at};
    const uint32_t made = rate.decimate(source, frames, room);
    float* sink[2] = {out.data() + at, right_out.data() + at};
    rate.interpolate(room, made, sink, frames);
    at += frames;
  }
  return out;
}

void the_table_names_a_head_for_every_rate_it_plays() {
  std::printf("the head block each output rate takes\n");
  struct Row {
    double stream;
    double head;
    int doubling;
  };
  constexpr Row kRows[] = {{44100.0, 44100.0, 0},  {48000.0, 48000.0, 0},
                           {96000.0, 96000.0, 0},  {192000.0, 96000.0, 1},
                           {88200.0, 44100.0, 0},  {176400.0, 44100.0, 0},
                           {352800.0, 44100.0, 0}, {384000.0, 96000.0, 0}};
  bool all = true;
  for (const Row& row : kRows) {
    int doubling = -1;
    const double head = feq_room_head_rate(row.stream, &doubling);
    std::printf("  %6.1f kHz: %.1f kHz%s\n", row.stream / 1000.0, head / 1000.0,
                doubling != 0 ? ", doubled" : "");
    all = all && head == row.head && doubling == row.doubling;
  }
  check(all, "44.1, 48 and 96 kHz their own, 192 the 96 doubled, 88.2 to "
             "352.8 the 44.1, 384 the 96");
  int doubling = -1;
  check(feq_room_head_rate(32000.0, &doubling) == 0.0 && doubling == 0 &&
            feq_room_head_rate(22050.0, nullptr) == 0.0 &&
            feq_room_head_rate(64000.0, nullptr) == 0.0,
        "and none for a rate no head reaches");
  // The rates with a head of their own keep their way to it: no converter.
  bool direct = true;
  for (const double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    FeqRoom* room = feq_room_create(rate, 2u, static_cast<uint32_t>(rate / 100.0));
    direct = direct && room != nullptr && room->rate.factor() == 0u &&
             room->sample_rate == rate;
    feq_room_destroy(room);
  }
  check(direct, "an output with a head of its rate renders at it, unconverted");
}

void the_delay_is_what_it_says(const Case& c) {
  std::printf("%.1f kHz through %.1f kHz\n", c.stream / 1000.0, c.room / 1000.0);
  RoomRate rate;
  rate.prepare(c.room, c.factor, 2u, block_of(c));
  check(rate.factor() == c.factor, "the converter took its factor");
  // The bottom of the band and its top: the same tone held back by exactly
  // the latency, at the same level, to well under anything a listener hears.
  for (const double hz : {1000.0, 19500.0}) {
    const auto frames = static_cast<size_t>(c.stream * 0.25);
    const auto out = through(rate, tone(frames, hz, c.stream, 0.0), {block_of(c)});
    const auto expected =
        tone(frames, hz, c.stream, static_cast<double>(rate.latency()));
    double worst = 0.0;
    for (size_t at = 2u * rate.latency(); at < frames; ++at) {
      worst = std::max(worst, std::fabs(static_cast<double>(out[at]) - expected[at]));
    }
    std::printf("  %5.0f Hz: latency %u frames, worst error %.1f dB\n", hz,
                rate.latency(), db(worst / 0.5));
    rate.reset();
    check(worst < 0.5e-4,
          "a tone comes out as it went in, delayed by the latency, 80 dB or closer");
  }
}

void any_block_is_the_same_sound(const Case& c) {
  RoomRate steady;
  RoomRate ragged;
  const uint32_t max = block_of(c);
  steady.prepare(c.room, c.factor, 2u, max);
  ragged.prepare(c.room, c.factor, 2u, max);
  const auto in = tone(static_cast<size_t>(c.stream * 0.1), 997.0, c.stream, 0.0);
  const auto one = through(steady, in, {max});
  // Blocks a driver might hand over: one frame, a prime, the factor less
  // one, the most a block may be.
  const auto other = through(ragged, in, {1u, 7u, c.factor - 1u, max, 3u, max - 1u});
  check(one == other, "blocks of any size give the same samples");
}

void nothing_folds_into_the_band(const Case& c) {
  RoomRate rate;
  const uint32_t max = block_of(c);
  rate.prepare(c.room, c.factor, 2u, max);
  // Just past where the stopband starts, the room's rate less 20 kHz: let
  // through, it would fold back to under 20 kHz.
  const double above = (c.room - 20000.0) * 1.02;
  const auto out = through(rate, tone(static_cast<size_t>(c.stream * 0.25), above,
                                      c.stream, 0.0),
                           {max});
  double peak = 0.0;
  for (size_t at = 4u * rate.latency(); at < out.size(); ++at) {
    peak = std::max(peak, std::fabs(static_cast<double>(out[at])));
  }
  std::printf("  %.1f kHz, which would fold to %.1f kHz: %.1f dB\n", above / 1000.0,
              (c.room - above) / 1000.0, db(peak / 0.5));
  check(db(peak / 0.5) < -90.0,
        "a tone that would fold under 20 kHz is stopped, 90 dB down or more");
}

void a_handover_carries_the_sound(const Case& c) {
  const uint32_t max = block_of(c);
  RoomRate whole;
  whole.prepare(c.room, c.factor, 2u, max);
  const auto in = tone(static_cast<size_t>(c.stream * 0.1), 440.0, c.stream, 0.0);
  const auto expected = through(whole, in, {max});

  // The same sound through one converter for half, then a fresh one that
  // took the first's state at the swap — a chain handover's way.
  RoomRate first;
  RoomRate second;
  first.prepare(c.room, c.factor, 2u, max);
  second.prepare(c.room, c.factor, 2u, max);
  const auto half = static_cast<std::ptrdiff_t>((in.size() / 2u / max) * max);
  const std::vector<float> head(in.begin(), in.begin() + half);
  const std::vector<float> tail(in.begin() + half, in.end());
  auto out = through(first, head, {max});
  second.swap_state(first);
  const auto rest = through(second, tail, {max});
  out.insert(out.end(), rest.begin(), rest.end());
  check(out == expected, "a converter that takes another's state carries on its sound");
}

}  // namespace

int main() {
  std::printf("room rate\n\n");
  the_table_names_a_head_for_every_rate_it_plays();
  for (const Case& c : feq_test::kRateCases) {
    the_delay_is_what_it_says(c);
    any_block_is_the_same_sound(c);
    nothing_folds_into_the_band(c);
    a_handover_carries_the_sound(c);
  }
  return feq_test::finish();
}

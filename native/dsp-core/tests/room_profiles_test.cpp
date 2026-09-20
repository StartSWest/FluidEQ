/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The six featured rooms, measured through the head that ships.
 *
 * The table is the app's own (`roomPresets.ts`), written into
 * `room_profiles_fixture.h` by `generate-room-profiles-fixture.ts` and held
 * to it by `dspRoomProfiles.test.ts`, so what is measured here is what the
 * card applies. Every room runs at the four stream rates, on a stereo, a 5.1
 * and a 7.1 stream, buffered and in game mode, and is held to what a listener
 * would notice: every sample a number, a film-loud programme under full
 * scale, the sub on time with the ears, the walls still there at 192 kHz,
 * no more colour on a speaker than a room puts there, and the rooms in the
 * order their names promise — no tail at all on Reference and Competitive,
 * the longest on Live Venue.
 *
 * "Off" is measured as a difference, never as a small number: a room whose
 * tail is off must render the same samples whatever the tail's decay is set
 * to, and a room beside it whose tail is on must not (the control). The bass
 * crossover rings for a while on every room, so a quiet window proves
 * nothing either way.
 */

#include "fluideq/room.h"

#include "fluideq/biquad.h"
#include "fluideq/convolver.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iterator>
#include <map>
#include <string>
#include <vector>

#include "../../system-apo/src/room_head.h"
#include "dsp_test_support.h"
#include "room_profiles_fixture.h"

namespace {

using feq_test::kPi;

// Thousands of checks across the matrix: only a failure is worth a line.
int g_checks = 0;
void check(bool condition, const char* what) {
  ++g_checks;
  if (!condition) {
    feq_test::check(false, what);
  }
}
using feq_test::Pink;

constexpr uint32_t kBlock = 512;
constexpr double kRates[] = {44100.0, 48000.0, 96000.0, 192000.0};

struct Layout {
  const char* name;
  uint32_t channels;
  int speaker[FEQ_ROOM_MAX_CHANNELS];
  int lfe;
};

/** Windows' channel orders: FL FR, FL FR C LFE SL SR, FL FR C LFE RL RR SL SR
 *  — the engine maps each to a speaker (`speaker_of_channel`); 7.1 here is the
 *  order the other room tests use. */
constexpr Layout kLayouts[] = {
    {"stereo", 2, {0, 1, -1, -1, -1, -1, -1, -1}, -1},
    {"5.1", 6, {0, 1, 2, -1, 3, 4, -1, -1}, 3},
    {"7.1", 8, {0, 1, 2, -1, 3, 4, 5, 6}, 3},
};

FeqRoomSettings settings_of(const RoomProfileFixture& profile) {
  FeqRoomSettings s{};
  feq_room_settings_defaults(&s);
  const double* v = profile.values;
  s.enabled = 1;
  s.size_m = v[0];
  s.walls = v[1];
  s.distance_m = v[2];
  s.centre_db = v[3];
  s.sub_db = v[4];
  for (int at = 0; at < FEQ_ROOM_SPEAKERS; ++at) {
    s.angle_deg[at] = v[5 + at];
    s.level_db[at] = v[12 + at];
    s.speaker_distance_m[at] = v[19 + at];
  }
  for (int at = 0; at < FEQ_ROOM_SPEAKERS + 1; ++at) {
    s.mute[at] = v[26 + at] != 0.0 ? FEQ_ROOM_MUTED : 0;
  }
  s.bass_management = v[34] != 0.0;
  s.crossover_hz = v[35];
  s.music_upmix = v[36] != 0.0;
  s.upmix_amount = v[37];
  s.renderer_version = static_cast<int>(v[38]);
  s.early_reflection_db = v[39];
  s.ambience_mix = v[40];
  s.ambience_decay_s = v[41];
  s.ambience_damping_hz = v[42];
  s.preserve_position = v[43] != 0.0;
  return s;
}

const fluideq_engine::RoomHead& head_at(double rate) {
  static std::map<double, fluideq_engine::RoomHead> heads;
  auto found = heads.find(rate);
  if (found == heads.end()) {
    std::ifstream file(std::string(FEQ_ROOM_HEAD_DIR) + "/medium.txt");
    const std::string text((std::istreambuf_iterator<char>(file)), {});
    auto head = fluideq_engine::parse_room_head(text, rate);
    check(head.has_value(), "the shipped medium head loads at this rate");
    found = heads.emplace(rate, head ? *head : fluideq_engine::RoomHead{}).first;
  }
  return found->second;
}

struct Rendering {
  FeqRoom* room;
  Rendering(const FeqRoomSettings& s, double rate, const Layout& layout,
            bool low) {
    room = feq_room_create(rate, layout.channels, kBlock);
    const auto& head = head_at(rate);
    feq_room_set_layout(room, layout.speaker, layout.lfe);
    feq_room_set_head(room, head.left.data(), head.right.data(),
                      head.directions, head.taps, head.needs_doubling ? 1 : 0);
    feq_room_set_low_latency(room, low ? 1 : 0);
    feq_room_configure(room, &s);
    feq_room_reset(room);
  }
  ~Rendering() { feq_room_destroy(room); }
  Rendering(const Rendering&) = delete;
  Rendering& operator=(const Rendering&) = delete;
};

using Planar = std::vector<std::vector<float>>;

Planar silence(const Layout& layout, size_t frames) {
  const size_t whole = (frames + kBlock - 1) / kBlock * kBlock;
  return Planar(layout.channels, std::vector<float>(whole, 0.0f));
}

void run(FeqRoom* room, Planar& b) {
  std::vector<float*> pointers(b.size());
  for (size_t at = 0; at < b[0].size(); at += kBlock) {
    for (size_t channel = 0; channel < b.size(); ++channel) {
      pointers[channel] = b[channel].data() + at;
    }
    feq_room_process(room, pointers.data(), kBlock);
  }
}

/** Both ears of one impulse on `channel`, `seconds` long. */
Planar impulse(const FeqRoomSettings& s, double rate, const Layout& layout,
               bool low, uint32_t channel, double seconds) {
  Rendering r(s, rate, layout, low);
  auto b = silence(layout, static_cast<size_t>(seconds * rate));
  b[channel][0] = 0.5f;
  run(r.room, b);
  b.resize(2);
  return b;
}

bool finite(const Planar& b) {
  for (const auto& channel : b) {
    for (const float sample : channel) {
      if (!std::isfinite(sample)) {
        return false;
      }
    }
  }
  return true;
}

double peak(const Planar& b) {
  double value = 0.0;
  for (const auto& channel : b) {
    for (const float sample : channel) {
      value = std::max(value, std::fabs(static_cast<double>(sample)));
    }
  }
  return value;
}

double energy(const Planar& b) {
  double total = 0.0;
  for (const auto& channel : b) {
    for (const float sample : channel) {
      total += static_cast<double>(sample) * sample;
    }
  }
  return total;
}

Planar minus(const Planar& a, const Planar& b) {
  Planar out = a;
  for (size_t channel = 0; channel < out.size(); ++channel) {
    for (size_t at = 0; at < out[channel].size(); ++at) {
      out[channel][at] -= b[channel][at];
    }
  }
  return out;
}

double db(double ratio) { return 10.0 * std::log10(std::max(ratio, 1e-30)); }

size_t first_sound(const std::vector<float>& v) {
  size_t at = 0;
  while (at < v.size() && std::fabs(v[at]) < 1e-9f) {
    ++at;
  }
  return at;
}

/** The energy of both ears in the third octave around `hz`, nine probes. */
double band_energy(const Planar& b, double hz, double rate, size_t frames) {
  double total = 0.0;
  for (int probe = -4; probe <= 4; ++probe) {
    const double f = hz * std::pow(2.0, probe / 24.0);
    const double omega = 2.0 * kPi * f / rate;
    for (const auto& channel : b) {
      double re = 0.0;
      double im = 0.0;
      const size_t count = std::min(frames, channel.size());
      for (size_t at = 0; at < count; ++at) {
        re += channel[at] * std::cos(omega * static_cast<double>(at));
        im -= channel[at] * std::sin(omega * static_cast<double>(at));
      }
      total += re * re + im * im;
    }
  }
  return total;
}

FeqRoomSettings without_tail(FeqRoomSettings s) {
  s.ambience_mix = 0.0;
  return s;
}

FeqRoomSettings without_walls(FeqRoomSettings s) {
  s.ambience_mix = 0.0;
  s.early_reflection_db = -60.0;
  return s;
}

bool has_tail(const RoomProfileFixture& p) { return p.values[40] > 0.0; }
bool has_walls(const RoomProfileFixture& p) { return p.values[39] > -60.0; }
bool is(const RoomProfileFixture& p, const char* id) {
  return std::strcmp(p.id, id) == 0;
}

/**
 * Every rate, stream and buffering: numbers, a loud film under full scale,
 * the delay the room reports, and the sub arriving with the ears.
 */
void every_room_everywhere() {
  std::printf("every room, every rate, stream and buffering\n");
  std::printf("  %-14s %-7s %-6s %-4s  peak@-20  lat  sub\n", "room", "rate",
              "stream", "mode");
  for (const auto& profile : kRoomProfiles) {
    const FeqRoomSettings s = settings_of(profile);
    for (const double rate : kRates) {
      for (const Layout& layout : kLayouts) {
        for (const bool low : {false, true}) {
          Rendering r(s, rate, layout, low);
          check(feq_room_active(r.room) == 1, "the room is active");
          const uint32_t latency = feq_room_latency_frames(r.room);
          check(latency == (low ? 0u : feq_convolver_latency()),
                "one partition buffered, none in game mode");
          // A different pink noise a channel, each peaking at -20 dBFS: where
          // a loud film moment sits per channel (`room_presets_test.cpp`).
          auto b = silence(layout, static_cast<size_t>(0.75 * rate));
          for (uint32_t channel = 0; channel < layout.channels; ++channel) {
            Pink source;
            source.noise.seed = 1000u + channel * 7919u;
            for (float& sample : b[channel]) {
              sample = static_cast<float>(source.next());
            }
            feq_test::normalise(b[channel], 0.1);
          }
          run(r.room, b);
          b.resize(2);
          const double out = peak(b);
          check(finite(b), "every sample is a number");
          check(out < 1.0, "a loud programme at -20 dBFS a channel fits");
          check(out > 0.01, "the room passes the programme (control)");
          size_t sub_at = latency;
          if (layout.lfe >= 0) {
            const auto sub = impulse(s, rate, layout, low,
                                     static_cast<uint32_t>(layout.lfe), 0.05);
            sub_at = first_sound(sub[0]);
            check(sub_at == latency, "the sub arrives with the ears");
            check(first_sound(sub[1]) == latency, "in both of them");
          }
          std::printf("  %-14s %-7.0f %-6s %-4s  %8.3f  %3u  %3zu\n",
                      profile.id, rate, layout.name, low ? "game" : "buf", out,
                      latency, sub_at);
        }
      }
    }
  }
}

struct Parts {
  double direct;
  double walls;
  double tail;
};

/** Both ears of a quarter second of pink noise on `channel`. */
Planar burst(const FeqRoomSettings& s, double rate, const Layout& layout,
             uint32_t channel, double seconds) {
  Rendering r(s, rate, layout, false);
  auto b = silence(layout, static_cast<size_t>(seconds * rate));
  Pink source;
  source.noise.seed = 4242u;
  const size_t length = static_cast<size_t>(0.25 * rate);
  // One noise sample held for the rate's multiple of 48 kHz: the same sound
  // at every rate, with nothing above what a record carries.
  const size_t hold = std::max<size_t>(1, static_cast<size_t>(rate / 48000.0));
  float held = 0.0f;
  for (size_t at = 0; at < length; ++at) {
    if (at % hold == 0) {
      held = static_cast<float>(0.25 * source.next());
    }
    b[channel][at] = held;
  }
  run(r.room, b);
  b.resize(2);
  return b;
}

/**
 * One front-left burst taken apart by difference: head, walls, tail. Noise
 * and not an impulse: a single sample is mostly ultrasound at 192 kHz, which
 * the tail's damping rightly removes and the head does not, so an impulse
 * calls the same room 12 dB drier at 192 kHz than at 48 kHz.
 */
Parts parts_of(const RoomProfileFixture& profile, double rate,
               const Layout& layout, double seconds) {
  const FeqRoomSettings s = settings_of(profile);
  const auto whole = burst(s, rate, layout, 0, seconds);
  const auto no_tail = burst(without_tail(s), rate, layout, 0, seconds);
  const auto bare = burst(without_walls(s), rate, layout, 0, seconds);
  return Parts{energy(bare), energy(minus(no_tail, bare)),
               energy(minus(whole, no_tail))};
}

/**
 * Off is off: the tail of Reference and Competitive, and Competitive's walls,
 * change nothing whatever they are set to — and do change a room where they
 * are on, which is what makes the first half mean something.
 */
void off_is_exactly_off() {
  std::printf("off is exactly off\n");
  const Layout& layout = kLayouts[2];
  for (const auto& profile : kRoomProfiles) {
    const FeqRoomSettings s = settings_of(profile);
    FeqRoomSettings longer = s;
    longer.ambience_decay_s = s.ambience_decay_s > 1.0 ? 0.4 : 1.6;
    longer.ambience_damping_hz = s.ambience_damping_hz > 6000 ? 2000 : 11000;
    const auto a = impulse(s, 48000.0, layout, false, 0, 1.0);
    const auto b = impulse(longer, 48000.0, layout, false, 0, 1.0);
    const bool same = a == b;
    std::printf("  %-14s tail %s\n", profile.id, same ? "off" : "on");
    check(same == !has_tail(profile),
          "the tail's dials are heard exactly where the tail is on");

    FeqRoomSettings other_room = s;
    other_room.size_m = s.size_m > 7.0 ? s.size_m - 3.0 : s.size_m + 3.0;
    other_room.walls = s.walls > 0.5 ? s.walls - 0.3 : s.walls + 0.3;
    const auto c = impulse(other_room, 48000.0, layout, false, 0, 1.0);
    const bool deaf_to_walls = a == c;
    std::printf("  %-14s walls %s\n", profile.id, deaf_to_walls ? "off" : "on");
    check(deaf_to_walls == !has_walls(profile),
          "the walls are heard exactly where Space is above its floor");
  }
  for (const auto& profile : kRoomProfiles) {
    if (is(profile, "referenceV2") || is(profile, "competitiveV2")) {
      check(!has_tail(profile), "Reference and Competitive have no tail");
    }
    if (is(profile, "competitiveV2")) {
      check(!has_walls(profile), "Competitive has no walls either");
    }
  }
}

/**
 * The rooms in the order their names promise, at 48 and at 192 kHz: walls
 * and tail relative to the head's own direct sound. The kernels scale with
 * the rate, so a wall that is there at 48 kHz is there at 192 kHz.
 */
void the_rooms_are_what_they_are_called() {
  std::printf("walls and tail against the direct sound, 7.1, front left\n");
  std::printf("  %-14s %-7s  walls dB  tail dB\n", "room", "rate");
  std::map<std::string, Parts> at48;
  for (const auto& profile : kRoomProfiles) {
    for (const double rate : {48000.0, 192000.0}) {
      const Parts parts = parts_of(profile, rate, kLayouts[2], 2.6);
      const double walls = db(parts.walls / parts.direct);
      const double tail = db(parts.tail / parts.direct);
      std::printf("  %-14s %-7.0f  %8.1f  %7.1f\n", profile.id, rate, walls,
                  tail);
      if (rate == 48000.0) {
        at48[profile.id] = parts;
        continue;
      }
      const Parts& low = at48[profile.id];
      if (has_walls(profile)) {
        check(std::fabs(walls - db(low.walls / low.direct)) < 3.0,
              "the walls are as loud at 192 kHz as at 48 kHz");
      }
      if (has_tail(profile)) {
        check(std::fabs(tail - db(low.tail / low.direct)) < 3.0,
              "and so is the tail");
      }
    }
  }
  const auto tail_of = [&](const char* id) {
    const Parts& p = at48[id];
    return p.tail / p.direct;
  };
  const auto walls_of = [&](const char* id) {
    const Parts& p = at48[id];
    return p.walls / p.direct;
  };
  check(tail_of("referenceV2") == 0.0 && tail_of("competitiveV2") == 0.0,
        "no tail on Reference or Competitive");
  check(walls_of("competitiveV2") == 0.0, "no walls on Competitive");
  check(tail_of("liveVenueV2") > tail_of("cinemaV2") &&
            tail_of("cinemaV2") > tail_of("musicSpaceV2") &&
            tail_of("musicSpaceV2") > tail_of("gameWorldV2") &&
            tail_of("gameWorldV2") > 0.0,
        "the tail grows from Game World to Live Venue");
  check(walls_of("liveVenueV2") > walls_of("cinemaV2") &&
            walls_of("cinemaV2") > walls_of("musicSpaceV2") &&
            walls_of("musicSpaceV2") > walls_of("gameWorldV2") &&
            walls_of("gameWorldV2") > walls_of("referenceV2") &&
            walls_of("referenceV2") > 0.0,
        "and so do the walls, from Reference up");
  // A room around a speaker, never louder than the speaker.
  for (const auto& profile : kRoomProfiles) {
    const Parts& p = at48[profile.id];
    check(p.walls + p.tail < p.direct,
          "walls and tail together stay under the direct sound");
  }
}

/**
 * Colour: what the walls and the tail add to the front-left speaker's
 * spectrum, third octave by third octave, against the same speaker with
 * neither. A room combs a little; one that moves a band by more than this is
 * an equaliser nobody asked for.
 */
void no_room_colours_a_speaker_much() {
  std::printf("colour added by the room, stereo front left, 100 Hz - 12.5 kHz\n");
  std::printf("  %-14s  level dB  lowest  highest\n", "room");
  constexpr double kSeconds = 0.6;
  const double rate = 48000.0;
  const size_t frames = static_cast<size_t>(kSeconds * rate);
  for (const auto& profile : kRoomProfiles) {
    FeqRoomSettings s = settings_of(profile);
    // The speaker alone: what stereo does with the other six is the upmix's,
    // measured below.
    s.music_upmix = 0;
    const auto whole = impulse(s, rate, kLayouts[0], false, 0, kSeconds);
    const auto bare =
        impulse(without_walls(s), rate, kLayouts[0], false, 0, kSeconds);
    double lowest = 100.0;
    double highest = -100.0;
    for (int band = 0; band <= 21; ++band) {
      const double hz = 100.0 * std::pow(2.0, band / 3.0);
      const double delta = db(band_energy(whole, hz, rate, frames) /
                              band_energy(bare, hz, rate, frames));
      lowest = std::min(lowest, delta);
      highest = std::max(highest, delta);
    }
    const double level = db(energy(whole) / energy(bare));
    std::printf("  %-14s  %8.2f  %6.2f  %7.2f\n", profile.id, level, lowest,
                highest);
    check(level < 2.0, "the room adds under 2 dB to a speaker");
    check(lowest > -3.0 && highest < 3.0,
          "and moves no third octave by 3 dB");
  }
}

/**
 * Stereo: the rooms that fill the ring from a stereo record do, the ones
 * that promise the front stage leave the record on the front pair, and a
 * full-scale record's peak is written down rather than hidden — the rack's
 * limiter stands behind the room, not inside it.
 */
void stereo_is_what_the_room_says() {
  std::printf("a stereo record, 48 kHz\n");
  std::printf("  %-14s  fills  peak of a full-scale record\n", "room");
  const double rate = 48000.0;
  for (const auto& profile : kRoomProfiles) {
    const FeqRoomSettings s = settings_of(profile);
    FeqRoomSettings front = s;
    front.music_upmix = 0;
    const auto record = [&](const FeqRoomSettings& with) {
      Rendering r(with, rate, kLayouts[0], false);
      auto b = silence(kLayouts[0], static_cast<size_t>(1.5 * rate));
      // Two thirds shared, one third each side's own: a record, not two
      // noises and not mono.
      Pink mid;
      Pink left;
      Pink right;
      mid.noise.seed = 11u;
      left.noise.seed = 23u;
      right.noise.seed = 37u;
      for (size_t at = 0; at < b[0].size(); ++at) {
        const double m = mid.next();
        b[0][at] = static_cast<float>(0.67 * m + 0.33 * left.next());
        b[1][at] = static_cast<float>(0.67 * m + 0.33 * right.next());
      }
      feq_test::normalise(b[0], 1.0);
      feq_test::normalise(b[1], 1.0);
      run(r.room, b);
      return b;
    };
    const auto filled = record(s);
    const auto staged = record(front);
    const bool fills = !(filled == staged);
    check(fills == (s.music_upmix != 0),
          "stereo fills the ring exactly where the room says it does");
    check(finite(filled), "every sample is a number");
    std::printf("  %-14s  %-5s  %.2f (%+.1f dBFS)\n", profile.id,
                fills ? "yes" : "no", peak(filled),
                20.0 * std::log10(peak(filled)));
  }
}

/** The energy of `b` between two frequencies, third octave by third octave. */
double span_energy(const Planar& b, double from_hz, double to_hz, double rate) {
  double total = 0.0;
  for (double hz = from_hz; hz <= to_hz * 1.01; hz *= std::pow(2.0, 1.0 / 3.0)) {
    total += band_energy(b, hz, rate, b[0].size());
  }
  return total;
}

/**
 * What tells one room from another, measured: the rooms were reported as
 * "sounding the same", and a list of rooms that differ only in numbers
 * nobody can hear is a list of one room. Four things a listener can point at
 * — how loud a stereo record leaves, how wide it is at the ears (side against
 * middle), how its top stands against its bottom, and on a 7.1 stream how
 * loud a sound behind stands against one in front — and every pair of rooms
 * has to differ by an audible step in at least one of them; the centre and
 * the sides of a 7.1 stream are the fifth and sixth, and the air the last:
 * walls 5 dB apart, or a tail 8 dB apart where the louder one is above
 * -30 dB. The 7.1 figures are taken above 250 Hz, because the managed bass
 * goes round a speaker's level and took two thirds of every difference with
 * it. Two things this measuring found that the table now respects: the sub
 * dial does nothing to a stereo record (it is the LFE's), and sending the
 * middle of a record to a raised centre makes it 5.8 dB darker, not closer.
 *
 * One pair is the same sound under two names, on purpose and by name below:
 * Reference and Competitive are both the driest room there is, the one filed
 * where somebody with a record looks and the other where somebody with a
 * game does.
 */
void no_two_rooms_are_one_room() {
  std::printf("what tells the rooms apart: a stereo record, and 7.1 rear "
              "against front\n");
  std::printf("  %-14s  level  width  top-bottom  centre  side  rear   walls  "
              "  tail   (dB)\n",
              "room");
  const double rate = 48000.0;
  struct Heard {
    const char* id;
    double level;
    double width;
    double tilt;
    double centre;
    double side;
    double rear;
    double walls;
    double tail;
  };
  std::vector<Heard> heard;
  // The record every room is given: two thirds shared, one third each
  // side's own, at a level nothing clips at.
  Planar source = silence(kLayouts[0], static_cast<size_t>(1.5 * rate));
  {
    Pink mid;
    Pink left;
    Pink right;
    mid.noise.seed = 11u;
    left.noise.seed = 23u;
    right.noise.seed = 37u;
    for (size_t at = 0; at < source[0].size(); ++at) {
      const double m = mid.next();
      source[0][at] = static_cast<float>(0.1 * (0.67 * m + 0.33 * left.next()));
      source[1][at] =
          static_cast<float>(0.1 * (0.67 * m + 0.33 * right.next()));
    }
  }
  const double source_top = span_energy(source, 4000.0, 10000.0, rate);
  const double source_bottom = span_energy(source, 125.0, 400.0, rate);
  for (const auto& profile : kRoomProfiles) {
    const FeqRoomSettings s = settings_of(profile);
    Rendering stereo(s, rate, kLayouts[0], false);
    Planar played = source;
    run(stereo.room, played);
    // Side against middle where the ear tells left from right by level,
    // 700 Hz to 4 kHz: over the whole band the figure is the bass, which
    // reaches both ears alike whatever the room, and every room read the
    // same to a decibel.
    Planar middle(1, std::vector<float>(played[0].size()));
    Planar side(1, std::vector<float>(played[0].size()));
    for (size_t at = 0; at < played[0].size(); ++at) {
      middle[0][at] = 0.5f * (played[0][at] + played[1][at]);
      side[0][at] = 0.5f * (played[0][at] - played[1][at]);
    }
    const double width = db(span_energy(side, 700.0, 4000.0, rate) /
                            span_energy(middle, 700.0, 4000.0, rate));
    const double tilt =
        db(span_energy(played, 4000.0, 10000.0, rate) / source_top) -
        db(span_energy(played, 125.0, 400.0, rate) / source_bottom);
    // 7.1: the same burst in the centre, at the side, behind on the left,
    // and in front, above the crossover.
    const auto above = [&](uint32_t channel) {
      return span_energy(burst(s, rate, kLayouts[2], channel, 0.6), 250.0,
                         8000.0, rate);
    };
    const double front = above(0);
    const double behind = above(6);
    const double beside = above(4);
    const double middle_speaker = above(2);
    const Parts parts = parts_of(profile, rate, kLayouts[2], 2.6);
    heard.push_back({profile.id, db(energy(played) / energy(source)),
                     width, tilt, db(middle_speaker / front),
                     db(beside / front), db(behind / front),
                     db(parts.walls / parts.direct),
                     db(parts.tail / parts.direct)});
    const Heard& h = heard.back();
    std::printf("  %-14s  %5.2f  %5.2f  %10.2f  %6.2f  %4.2f  %4.2f  %6.1f  %6.1f\n",
                h.id, h.level, h.width, h.tilt, h.centre, h.side, h.rear,
                h.walls, h.tail);
  }
  for (size_t a = 0; a < heard.size(); ++a) {
    for (size_t b = a + 1; b < heard.size(); ++b) {
      const bool named = std::strcmp(heard[a].id, "referenceV2") == 0 &&
                         std::strcmp(heard[b].id, "competitiveV2") == 0;
      const bool apart = named ||
                         std::fabs(heard[a].level - heard[b].level) >= 0.5 ||
                         std::fabs(heard[a].width - heard[b].width) >= 1.0 ||
                         std::fabs(heard[a].tilt - heard[b].tilt) >= 1.0 ||
                         std::fabs(heard[a].centre - heard[b].centre) >= 1.0 ||
                         std::fabs(heard[a].walls - heard[b].walls) >= 5.0 ||
                         (std::max(heard[a].tail, heard[b].tail) > -30.0 &&
                          std::fabs(heard[a].tail - heard[b].tail) >= 8.0) ||
                         std::fabs(heard[a].side - heard[b].side) >= 1.0 ||
                         std::fabs(heard[a].rear - heard[b].rear) >= 1.0;
      if (!apart) {
        std::printf("  the same room twice: %s and %s\n", heard[a].id,
                    heard[b].id);
      }
      check(apart, "every two rooms differ by a step somebody can hear");
    }
  }
}

/**
 * A Room copy of a chain keeps the chain's tone. The rack's Room copies add
 * five EQ bands in front of the Room (`roomTone.ts`, the same table here by
 * generation), and this runs a record through them and the room they were
 * made for: it leaves at the level it came, its top where it was against its
 * bottom, and no third octave far out. The control beside it is the same
 * record through the room alone, which has to show the fault — 2 dB louder
 * and its top 2 dB down — or "fixed" would mean nothing.
 *
 * The EQ is before the Room here as it is in the rack; both are linear and
 * the same on both channels, so it is the same sound as after it.
 */
void a_room_copy_keeps_its_chains_tone() {
  std::printf("a record through a Room copy's bands and its room, 48 kHz\n");
  std::printf("  %-14s %-9s  level dB  top-bottom dB  worst third octave dB\n",
              "room", "");
  const double rate = 48000.0;
  Planar source = silence(kLayouts[0], static_cast<size_t>(1.5 * rate));
  {
    Pink mid;
    Pink left;
    Pink right;
    mid.noise.seed = 11u;
    left.noise.seed = 23u;
    right.noise.seed = 37u;
    for (size_t at = 0; at < source[0].size(); ++at) {
      const double m = mid.next();
      source[0][at] = static_cast<float>(0.1 * (0.67 * m + 0.33 * left.next()));
      source[1][at] =
          static_cast<float>(0.1 * (0.67 * m + 0.33 * right.next()));
    }
  }
  std::vector<double> source_bands;
  for (int band = 0; band <= 20; ++band) {
    source_bands.push_back(band_energy(source, 100.0 * std::pow(2.0, band / 3.0),
                                       rate, source[0].size()));
  }
  struct Heard {
    double level;
    double tilt;
    double worst;
  };
  const auto hear = [&](const FeqRoomSettings& s, Planar played) {
    Rendering stereo(s, rate, kLayouts[0], false);
    run(stereo.room, played);
    Heard heard{db(energy(played) / energy(source)), 0.0, 0.0};
    double top = 0.0;
    double bottom = 0.0;
    for (int band = 0; band <= 20; ++band) {
      const double hz = 100.0 * std::pow(2.0, band / 3.0);
      const double delta =
          db(band_energy(played, hz, rate, played[0].size()) /
             source_bands[static_cast<size_t>(band)]);
      heard.worst = std::max(heard.worst, std::fabs(delta));
      if (band >= 16) top += delta / 5.0;                 // 4 to 10 kHz
      if (band >= 1 && band <= 6) bottom += delta / 6.0;  // 125 to 400 Hz
    }
    heard.tilt = top - bottom;
    return heard;
  };
  for (const auto& tone : kRoomTones) {
    const RoomProfileFixture* profile = nullptr;
    for (const auto& one : kRoomProfiles) {
      if (is(one, tone.room)) profile = &one;
    }
    check(profile != nullptr, "a Room copy stands in a featured room");
    if (profile == nullptr) continue;
    const FeqRoomSettings s = settings_of(*profile);
    Planar shaped = source;
    for (const auto& band : tone.bands) {
      const FeqBiquadCoefficients c = feq_biquad_coefficients(
          static_cast<FeqFilterType>(band.type), band.hz, band.gain_db, band.q,
          rate);
      for (auto& channel : shaped) {
        FeqBiquadState state{};
        feq_biquad_process(&state, channel.data(),
                           static_cast<uint32_t>(channel.size()), &c);
      }
    }
    const Heard alone = hear(s, source);
    const Heard held = hear(s, shaped);
    std::printf("  %-14s %-9s  %8.2f  %13.2f  %21.2f\n", tone.room, "room alone",
                alone.level, alone.tilt, alone.worst);
    std::printf("  %-14s %-9s  %8.2f  %13.2f  %21.2f\n", "", "the copy",
                held.level, held.tilt, held.worst);
    check(alone.level > 2.0 && alone.tilt < -2.0,
          "the room alone is louder and darker than the record: the control");
    check(std::fabs(held.level) < 1.0, "the copy leaves at the level it came");
    check(std::fabs(held.tilt) < 1.5, "with its top where it was");
    // Under 4 and not under 1: the dips at 1.6 and 8 kHz are the head telling
    // front from back, and the bands fill them half way on purpose.
    check(held.worst < 4.0 && held.worst < alone.worst - 2.0,
          "and no third octave far out, by much less than the room alone");
  }
}

/** How long a 128-frame 7.1 block takes, written down and not judged: the
 *  machine this runs on is doing other things. */
void what_a_block_costs() {
  std::printf("a 128-frame 7.1 block at 48 kHz, microseconds (budget 2667)\n");
  std::printf("  %-14s  median     p99\n", "room");
  constexpr uint32_t kSmall = 128;
  const Layout& layout = kLayouts[2];
  for (const auto& profile : kRoomProfiles) {
    const FeqRoomSettings s = settings_of(profile);
    FeqRoom* room = feq_room_create(48000.0, layout.channels, kSmall);
    const auto& head = head_at(48000.0);
    feq_room_set_layout(room, layout.speaker, layout.lfe);
    feq_room_set_head(room, head.left.data(), head.right.data(),
                      head.directions, head.taps, 0);
    feq_room_configure(room, &s);
    feq_room_reset(room);
    Planar b(layout.channels, std::vector<float>(kSmall));
    std::vector<float*> pointers(layout.channels);
    std::vector<double> micros;
    Pink source;
    for (int block = 0; block < 1500; ++block) {
      for (uint32_t channel = 0; channel < layout.channels; ++channel) {
        for (float& sample : b[channel]) {
          sample = static_cast<float>(0.05 * source.next());
        }
        pointers[channel] = b[channel].data();
      }
      const auto start = std::chrono::steady_clock::now();
      feq_room_process(room, pointers.data(), kSmall);
      const auto end = std::chrono::steady_clock::now();
      micros.push_back(
          std::chrono::duration<double, std::micro>(end - start).count());
    }
    feq_room_destroy(room);
    std::sort(micros.begin(), micros.end());
    std::printf("  %-14s  %6.0f  %6.0f\n", profile.id,
                micros[micros.size() / 2], micros[micros.size() * 99 / 100]);
  }
}

/**
 * A room is as loud at 96 and 192 kHz as at 48 kHz, on both renderers. It was
 * not: the heads had been resampled as sounds rather than as filters, and a
 * 1 kHz tone left the room 6 dB louder on a 96 kHz output and 12 dB louder on
 * a 192 kHz one. Measured on the head alone — no walls, no crossover.
 */
void a_room_is_as_loud_at_every_rate() {
  std::printf("a 1 kHz tone at 0.1 on the front left, left ear\n");
  for (int version = 1; version <= 2; ++version) {
    double lowest = 100.0;
    double highest = -100.0;
    for (const double rate : kRates) {
      FeqRoomSettings plain{};
      feq_room_settings_defaults(&plain);
      plain.enabled = 1;
      plain.renderer_version = version;
      plain.walls = 1.0;
      plain.bass_management = 0;
      Rendering r(plain, rate, kLayouts[0], false);
      auto b = silence(kLayouts[0], static_cast<size_t>(0.5 * rate));
      for (size_t at = 0; at < b[0].size(); ++at) {
        b[0][at] = static_cast<float>(
            0.1 *
            std::sin(2.0 * kPi * 1000.0 * static_cast<double>(at) / rate));
      }
      run(r.room, b);
      double top = 0.0;
      for (size_t at = b[0].size() / 2; at < b[0].size(); ++at) {
        top = std::max(top, std::fabs(static_cast<double>(b[0][at])));
      }
      const double gain = 20.0 * std::log10(top / 0.1);
      std::printf("  renderer %d  %-7.0f  %+.2f dB\n", version, rate, gain);
      lowest = std::min(lowest, gain);
      highest = std::max(highest, gain);
    }
    check(highest - lowest < 0.3, "the same tone is as loud at every rate");
  }
}

/**
 * At full Ambience the tail carries what the walls that feed it carry,
 * whatever its length: the rule its drive is calibrated to
 * (`room_ambience_parameters`). Under that and nobody hears it; over and the
 * slider's last third is a wash. A longer tail is as loud as a short one,
 * not quieter.
 */
void a_full_tail_is_level_with_its_walls() {
  std::printf("the tail at full Ambience against the walls, 7.1, 48 kHz\n");
  for (const auto& profile : kRoomProfiles) {
    if (!has_walls(profile)) {
      continue;
    }
    for (const double decay : {0.2, 0.5, 1.0, 1.8}) {
      FeqRoomSettings full = settings_of(profile);
      full.ambience_mix = 1.0;
      full.ambience_decay_s = decay;
      const auto whole = burst(full, 48000.0, kLayouts[2], 0, 3.0);
      const auto no_tail =
          burst(without_tail(full), 48000.0, kLayouts[2], 0, 3.0);
      const auto bare =
          burst(without_walls(full), 48000.0, kLayouts[2], 0, 3.0);
      const double level = db(energy(minus(whole, no_tail)) /
                              energy(minus(no_tail, bare)));
      std::printf("  %-14s decay %.1f s  %+.1f dB\n", profile.id, decay,
                  level);
      check(std::fabs(level) < 2.5, "the full tail is level with its walls");
    }
  }
}

}  // namespace

int main() {
  std::printf("room profiles\n\n");
  a_room_is_as_loud_at_every_rate();
  a_full_tail_is_level_with_its_walls();
  every_room_everywhere();
  off_is_exactly_off();
  the_rooms_are_what_they_are_called();
  no_room_colours_a_speaker_much();
  stereo_is_what_the_room_says();
  no_two_rooms_are_one_room();
  a_room_copy_keeps_its_chains_tone();
  what_a_block_costs();
  std::printf("\n%d checks\n", g_checks);
  return feq_test::finish();
}

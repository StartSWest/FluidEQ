/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A room's kernels from a head, a layout and the settings.
 *
 * Image-source, first order: the listener at the centre of a square room
 * of side `size_m`, each speaker at `distance_m` and its azimuth, and its
 * four mirror images across the four walls. The direct path is the head's
 * response for the speaker's direction; each image is the head's response
 * for the image's direction, later by the extra path at 343 m/s and quieter
 * by the distance ratio and the walls' absorption. Summed per ear, the
 * kernel is one convolution per channel per ear.
 */

#include "room_internal.h"

#include <algorithm>
#include <cmath>
#include <new>

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kSpeedOfSound = 343.0;
/** Woodworth's interaural delay for a head of 8.75 cm radius, at 90°. */
constexpr double kInterauralSeconds = 0.00065;

struct Arrival {
  double angle_deg;
  double gain;
  uint32_t delay;
};

double wrap_degrees(double angle) {
  double wrapped = std::fmod(angle, 360.0);
  if (wrapped < 0.0) {
    wrapped += 360.0;
  }
  return wrapped;
}

uint32_t nearest_direction(const FeqRoom* room, double angle_deg) {
  const double step = 360.0 / room->directions;
  const auto index = static_cast<uint32_t>(
      std::lround(wrap_degrees(angle_deg) / step));
  return index % room->directions;
}

/** The head's response for a direction, doubled by interpolation if needed. */
void head_response(const FeqRoom* room, uint32_t direction, int ear,
                   std::vector<float>& out) {
  const std::vector<float>& ring = ear == 0 ? room->head_left : room->head_right;
  const float* from = ring.data() + static_cast<size_t>(direction) * room->taps;
  if (!room->doubling) {
    out.assign(from, from + room->taps);
    return;
  }
  // Linear interpolation between taps: a 192 kHz stream on a 96 kHz head.
  // The octave it loses is above 24 kHz, which no head measurement carries.
  out.resize(static_cast<size_t>(room->taps) * 2);
  for (uint32_t tap = 0; tap < room->taps; ++tap) {
    const float here = from[tap];
    const float following = tap + 1 < room->taps ? from[tap + 1] : 0.0f;
    out[static_cast<size_t>(tap) * 2] = here;
    out[static_cast<size_t>(tap) * 2 + 1] = 0.5f * (here + following);
  }
}

/** A speaker's own distance, or the ring's where it has none. */
double speaker_distance(const FeqRoomSettings& s, int speaker) {
  const double own = speaker >= 0 && speaker < FEQ_ROOM_SPEAKERS
                         ? s.speaker_distance_m[speaker]
                         : 0.0;
  return own > 0.0 ? own : s.distance_m;
}

/**
 * The farthest a speaker's direct sound may be pushed down its kernel, in
 * frames: the head's taps, twice interpolated, still have to fit after it.
 * At 48 kHz that is 7.3 m of extra path — the whole 0.5 m to 6 m spread —
 * and at 192 kHz 1.8 m; a speaker beyond the cap arrives at the cap rather
 * than falling off the end of the kernel and going silent.
 */
constexpr uint32_t kDirectDelayCap = FEQ_ROOM_KERNEL_TAPS / 2;

/**
 * Direct path first, then the four wall images, for a speaker at ,
 *  metres away. The nearest speaker of the room is the
 * kernel's origin: it arrives at once and at unity, and every other speaker
 * arrives later by its extra path and quieter by its extra distance, the
 * way a receiver's distance settings sound. The reflections keep their
 * geometry from the same origin.
 */
void arrivals_for(const FeqRoom* room, double angle_deg, double distance,
                  double reference, Arrival* out, uint32_t* count) {
  const FeqRoomSettings& s = room->settings;
  const double radians = angle_deg * kPi / 180.0;
  const double x = distance * std::sin(radians);
  const double y = distance * std::cos(radians);
  const double half = s.size_m / 2.0;
  const auto frames_beyond = [&](double path) {
    const double extra = (path - reference) / kSpeedOfSound * room->sample_rate;
    return static_cast<uint32_t>(std::lround(std::max(0.0, extra)));
  };
  *count = 0;
  out[(*count)++] = Arrival{angle_deg, reference / distance,
                            std::min(kDirectDelayCap, frames_beyond(distance))};
  const double absorbed = s.walls < 0.0 ? 0.0 : (s.walls > 1.0 ? 1.0 : s.walls);
  if (absorbed >= 1.0) {
    return;
  }
  const double images[4][2] = {
      {2.0 * half - x, y}, {-2.0 * half - x, y},
      {x, 2.0 * half - y}, {x, -2.0 * half - y}};
  for (const auto& image : images) {
    const double r = std::sqrt(image[0] * image[0] + image[1] * image[1]);
    if (r <= distance) {
      continue;
    }
    out[(*count)++] = Arrival{std::atan2(image[0], image[1]) * 180.0 / kPi,
                              (1.0 - absorbed) * (reference / r),
                              frames_beyond(r)};
  }
}

/**
 * How much later the contralateral ear hears a speaker under the head
 * scale, in frames, never negative: a scale below one delays the near ear.
 */
void ear_shifts(const FeqRoom* room, double angle_deg, uint32_t* left_shift,
                uint32_t* right_shift) {
  *left_shift = 0;
  *right_shift = 0;
  const double sine = std::sin(angle_deg * kPi / 180.0);
  const double delta = (room->settings.head_scale - 1.0) * kInterauralSeconds *
                       std::fabs(sine) * room->sample_rate;
  const auto frames = static_cast<uint32_t>(std::lround(std::fabs(delta)));
  if (frames == 0) {
    return;
  }
  // The far ear for a speaker on the right is the left one.
  const bool far_is_left = sine > 0.0;
  const bool far_later = delta > 0.0;
  if (far_later == far_is_left) {
    *left_shift = frames;
  } else {
    *right_shift = frames;
  }
}

void add_arrival(const FeqRoom* room, const Arrival& arrival, double gain,
                 uint32_t shift_left, uint32_t shift_right,
                 std::vector<float>& response, float* left, float* right) {
  const uint32_t direction = nearest_direction(room, arrival.angle_deg);
  for (int ear = 0; ear < 2; ++ear) {
    head_response(room, direction, ear, response);
    const uint32_t start = arrival.delay + (ear == 0 ? shift_left : shift_right);
    float* into = ear == 0 ? left : right;
    for (size_t tap = 0; tap < response.size(); ++tap) {
      const size_t at = start + tap;
      if (at >= FEQ_ROOM_KERNEL_TAPS) {
        break;
      }
      into[at] += static_cast<float>(gain * arrival.gain * response[tap]);
    }
  }
}

double db_to_gain(double db) { return std::pow(10.0, db / 20.0); }

}  // namespace

FeqRoomKernels* room_build_kernels(const FeqRoom* room) {
  auto* set = new (std::nothrow) FeqRoomKernels();
  if (set == nullptr) {
    return nullptr;
  }
  set->sub_gain = room->settings.mute[FEQ_ROOM_SPEAKERS] != 0
                      ? 0.0
                      : db_to_gain(room->settings.sub_db);
  // Two cascaded Butterworth stages make one Linkwitz-Riley 4th order, whose
  // high-pass and low-pass sum flat: what leaves the speakers arrives at
  // the sub's path with nothing lost or doubled at the crossover.
  constexpr double kButterworthQ = 0.70710678118654752440;
  const double crossover =
      room->settings.crossover_hz < 40.0
          ? 40.0
          : (room->settings.crossover_hz > 200.0 ? 200.0
                                                  : room->settings.crossover_hz);
  set->bass_management = room->settings.bass_management != 0 ? 1 : 0;
  set->crossover_high = feq_biquad_coefficients(
      FEQ_FILTER_HPQ, crossover, 0.0, kButterworthQ, room->sample_rate);
  set->crossover_low = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, crossover, 0.0, kButterworthQ, room->sample_rate);
  const bool has_head = room->directions > 0 && room->taps > 0;
  if (room->settings.enabled == 0 || !has_head || room->channels < 2) {
    return set;
  }
  // The music upmix: a two-channel stream on the front pair gets a kernel
  // for every speaker, at the speaker's own index, and the five derived
  // feeds are shaped here so a dial lands with the set.
  const bool upmix = room->settings.music_upmix != 0 && room->channels == 2 &&
                     room->speaker[0] == 0 && room->speaker[1] == 1;
  if (upmix) {
    const double amount =
        room->settings.upmix_amount < 0.0
            ? 0.0
            : (room->settings.upmix_amount > 1.0 ? 1.0
                                                 : room->settings.upmix_amount);
    set->upmix = 1;
    set->centre_gain = 0.5 * amount;
    set->side_gain = 0.8 * amount;
    set->rear_gain = 0.6 * amount;
    set->side_frames =
        static_cast<uint32_t>(std::lround(0.010 * room->sample_rate));
    set->rear_frames =
        static_cast<uint32_t>(std::lround(0.022 * room->sample_rate));
    set->ambience_high = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, 150.0, 0.0, kButterworthQ, room->sample_rate);
    set->rear_low = feq_biquad_coefficients(FEQ_FILTER_LPQ, 6000.0, 0.0,
                                            kButterworthQ, room->sample_rate);
  }
  std::vector<float> left(FEQ_ROOM_KERNEL_TAPS);
  std::vector<float> right(FEQ_ROOM_KERNEL_TAPS);
  std::vector<float> response;
  Arrival arrivals[5];
  // Active from here: a room whose every speaker is muted is a silent room,
  // not a room switched off — the latency and the status stay the room's.
  set->active = 1;
  const uint32_t slots = upmix ? FEQ_ROOM_SPEAKERS : room->channels;
  // The nearest speaker that will be heard is on time; the ring where none.
  double nearest = room->settings.distance_m;
  bool any = false;
  for (uint32_t channel = 0; channel < slots; ++channel) {
    const int speaker = upmix ? static_cast<int>(channel) : room->speaker[channel];
    if (speaker < 0 || speaker >= FEQ_ROOM_SPEAKERS ||
        room->settings.mute[speaker] != 0) {
      continue;
    }
    const double own = speaker_distance(room->settings, speaker);
    nearest = any ? std::min(nearest, own) : own;
    any = true;
  }
  for (uint32_t channel = 0; channel < slots; ++channel) {
    const int speaker = upmix ? static_cast<int>(channel) : room->speaker[channel];
    if (speaker < 0 || speaker >= FEQ_ROOM_SPEAKERS ||
        room->settings.mute[speaker] != 0) {
      continue;
    }
    std::fill(left.begin(), left.end(), 0.0f);
    std::fill(right.begin(), right.end(), 0.0f);
    const double angle = room->settings.angle_deg[speaker];
    double gain = db_to_gain(room->settings.level_db[speaker]);
    if (speaker == 2) {
      gain *= db_to_gain(room->settings.centre_db);
    }
    uint32_t shift_left = 0;
    uint32_t shift_right = 0;
    ear_shifts(room, angle, &shift_left, &shift_right);
    uint32_t count = 0;
    arrivals_for(room, angle, speaker_distance(room->settings, speaker),
                 nearest, arrivals, &count);
    for (uint32_t at = 0; at < count; ++at) {
      add_arrival(room, arrivals[at], gain, shift_left, shift_right, response,
                  left.data(), right.data());
    }
    for (int ear = 0; ear < 2; ++ear) {
      const std::vector<float>& taps = ear == 0 ? left : right;
      FeqConvolverKernel* kernel =
          feq_convolver_kernel_create(taps.data(), FEQ_ROOM_KERNEL_TAPS);
      FeqConvolver* convolver =
          kernel != nullptr ? feq_convolver_create(kernel) : nullptr;
      if (kernel == nullptr || convolver == nullptr) {
        feq_convolver_kernel_destroy(kernel);
        room_destroy_kernels(set);
        return nullptr;
      }
      set->kernel[channel][ear] = kernel;
      set->convolver[channel][ear] = convolver;
    }
  }
  return set;
}

void room_destroy_kernels(FeqRoomKernels* kernels) {
  if (kernels == nullptr) {
    return;
  }
  for (auto& pair : kernels->convolver) {
    feq_convolver_destroy(pair[0]);
    feq_convolver_destroy(pair[1]);
  }
  for (auto& pair : kernels->kernel) {
    feq_convolver_kernel_destroy(pair[0]);
    feq_convolver_kernel_destroy(pair[1]);
  }
  delete kernels;
}

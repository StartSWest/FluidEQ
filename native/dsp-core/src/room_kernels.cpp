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

/** Direct path first, then the four wall images. */
void arrivals_for(const FeqRoom* room, double angle_deg, Arrival* out,
                  uint32_t* count) {
  const FeqRoomSettings& s = room->settings;
  const double radians = angle_deg * kPi / 180.0;
  const double x = s.distance_m * std::sin(radians);
  const double y = s.distance_m * std::cos(radians);
  const double half = s.size_m / 2.0;
  *count = 0;
  out[(*count)++] = Arrival{angle_deg, 1.0, 0};
  const double absorbed = s.walls < 0.0 ? 0.0 : (s.walls > 1.0 ? 1.0 : s.walls);
  if (absorbed >= 1.0) {
    return;
  }
  const double images[4][2] = {
      {2.0 * half - x, y}, {-2.0 * half - x, y},
      {x, 2.0 * half - y}, {x, -2.0 * half - y}};
  for (const auto& image : images) {
    const double r = std::sqrt(image[0] * image[0] + image[1] * image[1]);
    if (r <= s.distance_m) {
      continue;
    }
    const double extra = (r - s.distance_m) / kSpeedOfSound * room->sample_rate;
    out[(*count)++] = Arrival{
        std::atan2(image[0], image[1]) * 180.0 / kPi,
        (1.0 - absorbed) * (s.distance_m / r),
        static_cast<uint32_t>(std::lround(extra))};
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
  set->sub_gain = db_to_gain(room->settings.sub_db);
  const bool has_head = room->directions > 0 && room->taps > 0;
  if (room->settings.enabled == 0 || !has_head || room->channels < 2) {
    return set;
  }
  std::vector<float> left(FEQ_ROOM_KERNEL_TAPS);
  std::vector<float> right(FEQ_ROOM_KERNEL_TAPS);
  std::vector<float> response;
  Arrival arrivals[5];
  for (uint32_t channel = 0; channel < room->channels; ++channel) {
    const int speaker = room->speaker[channel];
    if (speaker < 0 || speaker >= FEQ_ROOM_SPEAKERS) {
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
    arrivals_for(room, angle, arrivals, &count);
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
    set->active = 1;
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

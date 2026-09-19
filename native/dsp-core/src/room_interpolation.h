/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_ROOM_INTERPOLATION_H
#define FLUIDEQ_ROOM_INTERPOLATION_H
#include <array>
#include <vector>
#include <cstdint>
struct FeqRoom;
struct RoomInterpolationMetrics {
  double negative_energy = 0;
  double late_energy = 0;
  double retained_energy = 0;
};
/** Control-thread-only, bounded by the validated head dimensions. */
class RoomInterpolation {
 public:
  explicit RoomInterpolation(const FeqRoom* room);
  void response(double degrees, int ear, double extra_delay,
                std::vector<float>& out, RoomInterpolationMetrics* metrics = nullptr) const;
 private:
  double sample_rate_;
  uint32_t directions_;
  uint32_t taps_;
  uint32_t budget_;
  std::array<std::vector<float>, 2> ring_;
  std::array<std::vector<double>, 2> onset_;
};
#endif

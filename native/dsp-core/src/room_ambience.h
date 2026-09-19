/* SPDX-License-Identifier: GPL-3.0-or-later
 * Original FluidEQ bounded late field; no external reverb code or data. */
#ifndef FLUIDEQ_ROOM_AMBIENCE_H
#define FLUIDEQ_ROOM_AMBIENCE_H
#include <array>
#include <cstdint>
#include <vector>
struct RoomReflection {
  uint32_t delay = 0;
  double gain = 0;
};
struct RoomAmbienceParameters {
  double mix = 0, damping = 0, wall_damping = 0;
  std::array<double, 4> feedback{};
  double injection = 0;
};
RoomAmbienceParameters room_ambience_parameters(double rate, double mix,
                                                double decay, double damping,
                                                double walls);
uint32_t room_physical_taps(double rate);
class RoomAmbience {
 public:
  void prepare(double rate);
  void reset();
  void tick(double input, const RoomAmbienceParameters& target, float& left,
            float& right);
  void swap_history(RoomAmbience& other);
  size_t samples() const;

 private:
  std::array<std::vector<double>, 4> lines_;
  std::array<size_t, 4> cursor_{};
  std::array<double, 4> low_{};
  RoomAmbienceParameters current_{};
  double wall_ = 0, slew_ = 0;
  bool running_ = false;
};
#endif

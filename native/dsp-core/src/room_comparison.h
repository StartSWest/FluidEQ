/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#ifndef FLUIDEQ_ROOM_COMPARISON_H
#define FLUIDEQ_ROOM_COMPARISON_H
#include <vector>

#include "fluideq/room.h"
struct FeqRoom;
struct FeqRoomKernels;
// Audio-owned state, including its preallocated reference delay. Compatible
// transfer swaps the whole state; a source/seek reset clears delay and
// learning. Only prepare allocates. Energy matching is a one-capture comparison
// aid, never a permanent wet-path normalizer.
struct RoomComparison {
  std::vector<float> line, reference;
  size_t cursor = 0;
  uint64_t key = 0, samples = 0;
  double wet_energy = 0, reference_energy = 0, blend = 0, gain_db = 0,
         target_db = 0;
  bool matched = false;
  FeqRoomReport report{};
  void prepare(uint32_t frames);
  void reset();
  void capture(FeqRoom* room, const FeqRoomKernels* set, float* const* channels,
               uint32_t frames);
  void process(FeqRoom* room, const FeqRoomKernels* set, uint32_t frames,
               bool stable);
};
uint64_t room_comparison_key(const FeqRoom* room);
#endif

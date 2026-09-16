/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The room's state, shared between `room.cpp` and `room_kernels.cpp`. */
#ifndef FLUIDEQ_ROOM_INTERNAL_H
#define FLUIDEQ_ROOM_INTERNAL_H

#include "fluideq/room.h"

#include "fluideq/convolver.h"

#include <atomic>
#include <vector>

/**
 * One set of kernels and the convolvers that run them: what the control
 * thread builds and the audio thread adopts, whole. A channel without a
 * speaker has null entries.
 */
struct FeqRoomKernels {
  FeqConvolverKernel* kernel[FEQ_ROOM_MAX_CHANNELS][2] = {};
  FeqConvolver* convolver[FEQ_ROOM_MAX_CHANNELS][2] = {};
  double sub_gain = 1.0;
  int active = 0;
};

struct FeqRoom {
  double sample_rate = 48000.0;
  uint32_t channels = 0;
  uint32_t max_frames = 0;
  FeqRoomSettings settings{};
  bool configured = false;
  int speaker[FEQ_ROOM_MAX_CHANNELS] = {-1, -1, -1, -1, -1, -1, -1, -1};
  int lfe_channel = -1;
  /* The head as handed over, direction-major, `directions * taps` each. */
  std::vector<float> head_left;
  std::vector<float> head_right;
  uint32_t directions = 0;
  uint32_t taps = 0;
  bool doubling = false;

  /* Control → audio: a set published, and the two the audio thread runs. */
  std::atomic<FeqRoomKernels*> handoff{nullptr};
  FeqRoomKernels* live = nullptr;
  FeqRoomKernels* next = nullptr;
  double blend = 1.0;
  /**
   * Frames the replacement runs unheard before the fade: a convolver started
   * cold fades in from an empty tail, which is a step, not a fade.
   */
  int64_t warmup = 0;
  std::atomic<int> active{0};
  /**
   * Audio → control: sets the audio thread has finished with, freed by the
   * control thread at its next publish or at destroy. Freeing is a lock the
   * audio thread may not take; four slots outlast any drag, and a fifth
   * retirement before the control thread comes round is freed in place —
   * the rare case, and the one that costs a lock rather than a leak.
   */
  static constexpr int kRetiredSlots = 4;
  std::atomic<FeqRoomKernels*> retired[kRetiredSlots] = {};
  int retired_at = 0;

  /* Scratch, sized at `create` for `max_frames`. */
  std::vector<float> mix_left;
  std::vector<float> mix_right;
  std::vector<float> copy;
  std::vector<float> scratch;
  std::vector<float> sub;
  double sub_state = 0.0;
  double sub_coefficient = 0.0;
};

/** Build a set from the room's head, layout and settings. Allocates. */
FeqRoomKernels* room_build_kernels(const FeqRoom* room);
void room_destroy_kernels(FeqRoomKernels* kernels);

#endif  // FLUIDEQ_ROOM_INTERNAL_H

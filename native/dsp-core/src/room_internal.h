/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The room's state, shared between `room.cpp` and `room_kernels.cpp`. */
#ifndef FLUIDEQ_ROOM_INTERNAL_H
#define FLUIDEQ_ROOM_INTERNAL_H

#include "fluideq/room.h"

#include "fluideq/biquad.h"
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
  /* Bass management, with the set so a crossover change lands atomically. */
  int bass_management = 0;
  FeqBiquadCoefficients crossover_high{};
  FeqBiquadCoefficients crossover_low{};
  /*
   * The music upmix: kernels for all seven speakers sit at the speaker's
   * own index (a stereo stream has slots to spare), and these are how the
   * five derived feeds are made from the pair.
   */
  int upmix = 0;
  double centre_gain = 0.0;
  double side_gain = 0.0;
  double rear_gain = 0.0;
  uint32_t side_frames = 0;
  uint32_t rear_frames = 0;
  FeqBiquadCoefficients ambience_high{};
  FeqBiquadCoefficients rear_low{};
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
  /* Bass management: a speaker's band above the crossover, and the filters'
   * histories — two high-pass stages per channel, two low-pass on the sum —
   * which outlive any kernel set and cross a chain handover. */
  std::vector<float> band;
  FeqBiquadState bass_high[FEQ_ROOM_MAX_CHANNELS][2] = {};
  FeqBiquadState bass_low[2] = {};
  /*
   * The music upmix: seven feeds of `max_frames` each, the side signal's
   * ring (long enough for the rears' delay plus a block) with its cursor,
   * and the ambience filters' histories.
   */
  std::vector<float> feeds;
  std::vector<float> ambience_line;
  size_t ambience_cursor = 0;
  FeqBiquadState ambience_high[2] = {};
  FeqBiquadState rear_low[2] = {};
};

/** The longest the rears trail the fronts by, in seconds; sizes the ring. */
constexpr double kRoomUpmixMaxDelaySeconds = 0.03;

/** Build a set from the room's head, layout and settings. Allocates. */
FeqRoomKernels* room_build_kernels(const FeqRoom* room);
void room_destroy_kernels(FeqRoomKernels* kernels);

#endif  // FLUIDEQ_ROOM_INTERNAL_H

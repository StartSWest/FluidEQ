/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The room's state, shared between `room.cpp` and `room_kernels.cpp`. */
#ifndef FLUIDEQ_ROOM_INTERNAL_H
#define FLUIDEQ_ROOM_INTERNAL_H

#include <atomic>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/convolver.h"
#include "fluideq/primitives.h"
#include "fluideq/room.h"
#include "room_ambience.h"
#include "room_comparison.h"

/**
 * One set of kernels and the convolvers that run them: what the control
 * thread builds and the audio thread adopts, whole. A channel without a
 * speaker has null entries.
 */
struct FeqRoomKernels {
  // Immutable prepared metadata: callback reset policy must not read settings
  // concurrently being changed by the control thread. Also set when inactive.
  int renderer_version = 1;
  uint64_t comparison_key = 0;
  int preserve_position = 0, compare_original = 0, source_already_spatial = 0;
  int speaker[FEQ_ROOM_MAX_CHANNELS] = {};
  int lfe_channel = -1;
  FeqConvolverKernel* kernel[FEQ_ROOM_MAX_CHANNELS][2] = {};
  FeqConvolver* convolver[FEQ_ROOM_MAX_CHANNELS][2] = {};
  /*
   * Game mode: each kernel's first partition, reversed for
   * `feq_convolver_head_run`, while the convolvers above hold the rest of it
   * one partition in. Empty, and `split` zero, when the whole kernel runs
   * through the convolvers and the room hands its output back a partition
   * late.
   */
  std::vector<float> head[FEQ_ROOM_MAX_CHANNELS][2];
  int split = 0;
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
  RoomReflection reflections[FEQ_ROOM_MAX_CHANNELS][4] = {};
  RoomAmbienceParameters late{};
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
  // Audio-owned handover replacement; never republished into control handoff.
  FeqRoomKernels* pending = nullptr;
  double blend = 1.0;
  /**
   * Frames the replacement runs unheard before the fade: a convolver started
   * cold fades in from an empty tail, which is a step, not a fade.
   */
  int64_t warmup = 0;
  std::atomic<int> active{0};
  // Single audio producer, single control consumer. Producer reserves empty
  // slots BEFORE taking ownership; full queue leaves the handoff published.
  // Control only clears slots. No callback deletes, leaks, or retry loops.
  static constexpr int kRetiredSlots = 4;
  std::atomic<FeqRoomKernels*> retired[kRetiredSlots] = {};
  RoomAmbience late;
  RoomComparison comparison;
  std::vector<float> reflection_history;
  std::vector<double> reflection_send;
  size_t reflection_length = 0, reflection_cursor = 0;
  double handover_gain = 1;

  /* Scratch, sized at `create` for `max_frames`. */
  std::vector<float> mix_left;
  std::vector<float> mix_right;
  std::vector<float> copy;
  std::vector<float> scratch;
  /*
   * Where the fade between two kernel sets stands at every sample of the
   * block being rendered: walked once, by the room, and read by every
   * speaker, both ears, the direct heads and the sub. It used to be whatever
   * the one crossfade that ran handed back, so a change that left no speaker
   * in both sets — a solo moved to another speaker, the last speaker muted,
   * the first one opened again — never faded at all, and was never heard.
   */
  std::vector<double> fade;
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
  /*
   * Game mode (`feq_room_set_low_latency`), and what the direct heads need:
   * the last partition less one of every source's input, which the head
   * reads back across the block boundary — per source, not per kernel, since
   * it is the input whatever kernel runs on it, so it outlives a set and
   * crosses a chain handover — and three blocks of scratch.
   */
  bool low_latency = false;
  std::vector<float> head_history;
  std::vector<float> head_input;
  std::vector<float> head_live;
  std::vector<float> head_next;
  /*
   * The bass the room does not convolve — the subwoofer feed and, under bass
   * management, everything below the crossover — gathered on one bus and held
   * back by the convolution's own latency before it joins the ears. Without
   * it the bass left a partition AHEAD of everything it was split from: 512
   * frames, 10.7 ms at 48 kHz, which at an 80 Hz crossover is most of half a
   * cycle, and a Linkwitz-Riley pair that far apart does not sum flat — it
   * digs a hole at the crossover. `chain_latency_test.cpp` found it, as the
   * difference between the room and game mode's room, which has no latency
   * for the bass to be ahead of.
   */
  std::vector<float> sub_bus;
  std::vector<float> sub_line_buffer;
  FeqDelayLine sub_line{};
};

/** The longest the rears trail the fronts by, in seconds; sizes the ring. */
constexpr double kRoomUpmixMaxDelaySeconds = 0.03;

/** Build a set from the room's head, layout and settings. Allocates. */
FeqRoomKernels* room_build_kernels(const FeqRoom* room);
void room_destroy_kernels(FeqRoomKernels* kernels);

#endif  // FLUIDEQ_ROOM_INTERNAL_H

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the voice cleaner hands the chain for one channel's block: the cleaned
 * block when the worker delivered it, and something that is never the raw
 * room when it did not.
 *
 * Apart from the module so it can be held to its numbers without a model or
 * a runtime library (`voice_blend_test.cpp`): everything here is the audio
 * thread's arithmetic on two buffers.
 *
 * A late block plays the delayed input at the gain the cleaner applied to the
 * last block it delivered — near unity while a voice speaks, far under it
 * while only the room is left — so a block the worker missed keeps the level
 * the listener was hearing. The step where a cleaned block and a late one
 * meet is leaned out over a millisecond, starting from the sample the
 * previous block ended on. A new stream's first cleaned sound comes in on a
 * raised cosine instead of a step out of the silence before it.
 */

#ifndef FLUIDEQ_DENOISE_VOICE_BLEND_H
#define FLUIDEQ_DENOISE_VOICE_BLEND_H

#include <cstdint>

/** How long the step between a cleaned block and a late one is leaned over. */
constexpr double kVoiceSeamMs = 1.0;
/** How long a new stream's first cleaned sound takes to come in. */
constexpr double kVoiceFadeInMs = 20.0;

/** One channel's blend state; audio thread only. */
struct VoiceBlend {
  /** What the cleaner did to the last block it delivered, never over 1. */
  double held_gain = 1.0;
  /** The sample the previous block ended on. */
  float last_out = 0.0f;
  bool was_late = false;
  /** Frames emitted since the stream started. */
  uint64_t emitted = 0;
  /** Where the fade-in begins: the frames of delay before any sound. */
  uint64_t fade_from = 0;
  uint32_t seam_frames = 1;
  uint32_t fade_in_frames = 1;
};

/** A new stream at `rate`, whose first sound arrives after `latency` frames. */
void voice_blend_reset(VoiceBlend& blend, double rate, uint32_t latency);

/**
 * One block into `out`. `delayed` is the input delayed by the cleaner's
 * latency; `cleaned` is the worker's block, or null when it was late.
 * `amount` mixes the two as the dial does (0 is the delayed input).
 */
void voice_blend_block(VoiceBlend& blend, float* out, const float* delayed,
                       const float* cleaned, uint32_t frames, double amount);

#endif /* FLUIDEQ_DENOISE_VOICE_BLEND_H */

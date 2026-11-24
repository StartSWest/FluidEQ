/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Voice level (engine 1.33): a mic's voice brought to a steady level, and
 * moved only while it speaks.
 *
 * Every stock mic profile used to take a headset voice 2 to 4 dB DOWN - the
 * compressor pressed, nothing gave the level back - so switching the mic's
 * processing on made it quieter (Ivan, 2026-11-24: "it lowers the volume
 * ... we need to really smooth and boost the mic"). A make-up gain or a
 * compressor's lift would have given it back by lifting the room between
 * words with it, which is what the profiles had already been measured doing
 * (+9 dB) and why they only press. This gain follows the voice instead.
 *
 * Heard after the cleaner and the gate, through the gate's 90 Hz to 7 kHz
 * band, as its power over 10 ms, risen to at once and let go over 300 ms.
 * A sound counts as
 * the voice while it stands 9 dB over the level the room has been lately
 * (followed down over a quarter second, up at 3 dB/s) and
 * over -65 dBFS, and is at its own level rather than a word's tail dying
 * away. Only then does the gain move toward the target: up at 18 dB/s,
 * down at 24 dB/s, never past the most lift or 12 dB of cut. Between
 * words it holds, so a syllable's tail is not pumped up and the room under
 * the voice keeps the level it had under the last word; after 10 s with no
 * voice it lets the lift go at 1.5 dB/s, so a mic left open over a quiet
 * room is never left lifted. A room on its own never moves it at all.
 *
 * No delay: the gain is decided from what has been heard and glides, so it
 * needs no look-ahead, and the limiter behind it catches what a glide is
 * too slow for.
 */
#ifndef FLUIDEQ_VOICE_LEVEL_H
#define FLUIDEQ_VOICE_LEVEL_H

#include <cstdint>

#include "fluideq/biquad.h"
#include "fluideq/voice.h"

struct VoiceLevel {
  // From the rate.
  FeqBiquadCoefficients listen_low{};
  FeqBiquadCoefficients listen_high{};
  double power_short = 0.0;
  double power_release = 0.0;
  double floor_fall = 0.0;
  double floor_rise_db = 0.0;
  double up_step_db = 0.0;
  double down_step_db = 0.0;
  double release_step_db = 0.0;
  uint32_t hold_samples = 0;
  uint32_t settle_samples = 1;

  // Running state, carried across a chain rebuilt for new settings.
  FeqBiquadState low_state{};
  FeqBiquadState high_state{};
  double short_power = 0.0;
  double power = 0.0;
  double floor_db = -150.0;
  bool floor_known = false;
  uint32_t settled = 0;
  double gain_db = 0.0;
  uint32_t quiet_samples = 0;

  // The block's report, written by the audio thread only.
  float report_level_db = -120.0f;
};

/** The rate-dependent coefficients. Control thread. */
void voice_level_derive(VoiceLevel& level, double sample_rate);

/** Back to silence: no lift, no room heard. */
void voice_level_reset(VoiceLevel& level);

/** The running state of the level a rebuilt chain replaces. */
void voice_level_transfer(VoiceLevel& into, const VoiceLevel& from);

/** One block, in place, every channel by one gain. Audio thread. */
void voice_level_process(VoiceLevel& level,
                         const FeqVoiceSettings& settings,
                         float* const* channels,
                         uint32_t count,
                         uint32_t frames);

#endif /* FLUIDEQ_VOICE_LEVEL_H */

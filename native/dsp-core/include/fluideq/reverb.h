/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reverb, for a microphone's rack (engine 1.33): the plate topology Jon
 * Dattorro published ("Effect Design, Part 1", JAES 1997) — four input
 * diffusers, then a figure-eight tank of two modulated decay-diffusion
 * all-passes, delays, damping and decay — our own code, its delays rescaled
 * from the paper's 29.8 kHz to the stream's rate and by each type's size.
 *
 * Wet only: the dry signal passes untouched and the stage adds no delay, so
 * the rack's latency and the delay readout do not move when it is switched
 * on. Pre-delay is on the wet side alone. It runs after Dynamics and before
 * the Maximizer, so the limiter holds the voice and its tail together.
 *
 * The Room's tail could not stand in for it: four delay lines of 30-44 ms,
 * whose repeats are what is heard once it is turned up (CLAUDE.md, the
 * featured rooms). A plate is dense from its first milliseconds.
 */
#ifndef FLUIDEQ_REVERB_H
#define FLUIDEQ_REVERB_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_REVERB_MAX_CHANNELS 8

/** The five voicings, in wire order: an index keeps its meaning for good. */
typedef enum FeqReverbType {
  FEQ_REVERB_PLATE = 0,
  FEQ_REVERB_VOCAL_PLATE = 1,
  FEQ_REVERB_ROOM = 2,
  FEQ_REVERB_CHAMBER = 3,
  FEQ_REVERB_HALL = 4,
} FeqReverbType;
#define FEQ_REVERB_TYPES 5

#define FEQ_REVERB_MIX_MIN_DB -40.0
#define FEQ_REVERB_MIX_MAX_DB 0.0
#define FEQ_REVERB_DECAY_MIN_S 0.2
#define FEQ_REVERB_DECAY_MAX_S 8.0
#define FEQ_REVERB_PREDELAY_MAX_MS 150.0
#define FEQ_REVERB_TONE_MIN_HZ 2000.0
#define FEQ_REVERB_TONE_MAX_HZ 16000.0
#define FEQ_REVERB_LOW_CUT_MIN_HZ 80.0
#define FEQ_REVERB_LOW_CUT_MAX_HZ 500.0
#define FEQ_REVERB_DUCK_MAX_DB 24.0

typedef struct FeqReverbSettings {
  int enabled;
  /** `FeqReverbType`. */
  int type;
  /** The tail's level against the dry voice, -40 to 0 dB. */
  double mix_db;
  /** RT60, 0.2 to 8 s. */
  double decay_s;
  /** 0 to 150 ms before the tail begins, on the wet side alone. */
  double predelay_ms;
  /** The tank's damping corner, 2 to 16 kHz: lower is darker. */
  double tone_hz;
  /** A 12 dB/oct high-pass on what feeds the tail, 80 to 500 Hz. */
  double low_cut_hz;
  /** 0 to 1: how far apart the tail's two sides are on a stereo stream. */
  double width;
  /** The tail comes down while the voice is heard and blooms in its gaps. */
  int duck;
  /** How far it comes down, 0 to 24 dB. */
  double duck_db;
} FeqReverbSettings;

typedef struct FeqReverb FeqReverb;

void feq_reverb_settings_defaults(FeqReverbSettings* settings);

/** Every buffer is sized here, for the largest type at this rate. */
FeqReverb* feq_reverb_create(double sample_rate, uint32_t channels);
void feq_reverb_destroy(FeqReverb* reverb);

/** Control thread. Nothing is allocated. */
void feq_reverb_configure(FeqReverb* reverb, const FeqReverbSettings* settings);

/** Audio thread: adds the tail to every channel in place. */
void feq_reverb_process(FeqReverb* reverb, float* const* channels,
                        uint32_t frames);

void feq_reverb_reset(FeqReverb* reverb);

/**
 * At a rack handover, on the audio thread: the tail in the tank goes on in
 * the prepared stage, so a turned knob does not cut it. A change of type
 * changes the tank's lengths, so the output crosses over 20 ms from the
 * tail read at the old places to the new ones rather than jumping.
 */
void feq_reverb_transfer(FeqReverb* prepared, FeqReverb* previous);

#ifdef __cplusplus
}
#endif

#endif  // FLUIDEQ_REVERB_H

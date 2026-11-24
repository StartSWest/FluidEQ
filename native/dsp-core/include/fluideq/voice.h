/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Voice: what a microphone needs that music never did.
 *
 * Two halves around the restoration. In front of it, the low cut (rumble,
 * desk knocks, the fan), a shelf for the proximity effect (the bass a voice
 * gains a few centimetres from the capsule) and the pop guard (a P or a B
 * is a burst under 150 Hz far louder than the voice's own low end). Behind
 * it, the gate: the room between words comes down by its range, and a gate
 * with a small range is a gentle downward expander. The cleaner first, then
 * the gate, so the gate's threshold is set against the floor the cleaner
 * left rather than the room.
 *
 * Neither half adds delay. A mic is always low lag (Ivan, 2026-11-20), so
 * the gate has no look-ahead of its own; it borrows the cleaner's. It hears
 * the voice as it enters the cleaner (`feq_voice_hear_ahead`), that delay
 * ahead of the block it turns down, and opens on a sound rising out of the
 * room there - a soft first consonant used to stay down by the gate's whole
 * range until the vowel behind it crossed the threshold.
 *
 * Every level is linked across the channels: a stereo mic or an array that
 * gated one side and not the other would move the voice in the image.
 */
#ifndef FLUIDEQ_VOICE_H
#define FLUIDEQ_VOICE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_VOICE_MAX_CHANNELS 8

/** The low cut's corner: 0 is off, otherwise 20 to 300 Hz. */
#define FEQ_VOICE_LOW_CUT_MIN_HZ 20.0
#define FEQ_VOICE_LOW_CUT_MAX_HZ 300.0
/** The proximity shelf's corner and its deepest cut. */
#define FEQ_VOICE_PROXIMITY_HZ 180.0
#define FEQ_VOICE_PROXIMITY_MAX_DB 12.0
/** Under this a burst is a plosive, over it a voice. */
#define FEQ_VOICE_PLOSIVE_HZ 150.0
/** The most the pop guard takes from a plosive's low band, at full amount. */
#define FEQ_VOICE_PLOSIVE_MAX_CUT_DB 18.0
/** Voice level's target and most lift (`voice_level.h`). */
#define FEQ_VOICE_LEVEL_TARGET_MIN_DB -30.0
#define FEQ_VOICE_LEVEL_TARGET_MAX_DB -10.0
#define FEQ_VOICE_LEVEL_MAX_LIFT_DB 24.0

typedef struct FeqVoiceSettings {
  int enabled;
  /** 0 is off, otherwise 20 to 300 Hz: a 12 dB/oct Butterworth high-pass. */
  double low_cut_hz;
  /** 0 to 12 dB taken off below 180 Hz ("Close to the mic"). */
  double proximity_db;
  /** 0 to 1: how much of a plosive's low burst is taken away. */
  double deplosive;
  int gate_enabled;
  /** -80 to -10 dBFS: over it the gate opens. */
  double gate_threshold_db;
  /** 0 to 80 dB: how far it closes. Under ~15 dB it is an expander. */
  double gate_range_db;
  /** 0 to 1000 ms: how long it stays open after the voice falls under. */
  double gate_hold_ms;
  /** 0.1 to 50 ms: how fast it opens all the way. */
  double gate_attack_ms;
  /** 5 to 2000 ms: how fast it closes all the way. */
  double gate_release_ms;
  /**
   * Voice level (engine 1.33): the voice brought to `level_target_db`
   * (-30 to -10 dBFS, the power of the voice over 300 ms) while it speaks,
   * lifted by at most `level_max_lift_db` (0 to 24 dB). After the gate.
   */
  int level_enabled;
  double level_target_db;
  double level_max_lift_db;
} FeqVoiceSettings;

/** Everything off; the gate's own values set to a speaking voice's. */
void feq_voice_settings_defaults(FeqVoiceSettings* settings);

/** What one block did, for the page's meters. */
typedef struct FeqVoiceReport {
  /** The gate's gain at the block's end: 0 open, down to minus the range. */
  float gate_gain_db;
  /** The deepest the pop guard cut in the block, never positive. */
  float plosive_cut_db;
  /** The level the gate heard, at the block's end. */
  float gate_level_db;
  uint32_t active;
  /** Voice level's gain at the block's end, and the level it heard. */
  float level_gain_db;
  float level_heard_db;
} FeqVoiceReport;

typedef struct FeqVoice FeqVoice;

/** Allocates everything the block loop touches. Null on a bad shape. */
FeqVoice* feq_voice_create(double sample_rate, uint32_t channels);
void feq_voice_destroy(FeqVoice* voice);

/**
 * New settings. Coefficients change; every history stays, so a dial moved
 * during speech keeps the filters running rather than starting from silence.
 */
void feq_voice_configure(FeqVoice* voice, const FeqVoiceSettings* settings);
void feq_voice_reset(FeqVoice* voice);
/** The histories, envelopes and the gate's gain, from the chain replaced. */
void feq_voice_transfer(FeqVoice* into, const FeqVoice* from);

/** The front half: low cut, proximity shelf, pop guard. In place, planar. */
void feq_voice_process_front(FeqVoice* voice, float* const* channels,
                             uint32_t frames);
/**
 * Room for the gate's look-ahead flags, one per frame of the largest block.
 * Control thread; without it the gate hears only what it gates.
 */
void feq_voice_set_max_frames(FeqVoice* voice, uint32_t max_frames);

/**
 * The block as it enters the cleaner, which is the cleaner's delay ahead of
 * the block the gate will turn down: the gate opens on a sound rising out of
 * the room here, so a soft first consonant arrives at an open gate instead of
 * one still opening. Between the front half and the cleaner, every block,
 * before `feq_voice_process_gate`. Not called, the gate decides as it did.
 */
void feq_voice_hear_ahead(FeqVoice* voice, const float* const* channels,
                          uint32_t frames);

/** The back half: the gate. In place, planar. */
void feq_voice_process_gate(FeqVoice* voice, float* const* channels,
                            uint32_t frames);

/** Voice level, after the gate. In place, planar; nothing while off. */
void feq_voice_process_level(FeqVoice* voice, float* const* channels,
                             uint32_t frames);

void feq_voice_block_report(const FeqVoice* voice, FeqVoiceReport* out);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_VOICE_H */

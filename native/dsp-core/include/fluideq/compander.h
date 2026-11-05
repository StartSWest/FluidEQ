/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamics: an upward and a downward compressor in three bands.
 *
 * The rack could only push loud sound down — the EQ's dynamic bands act over
 * their threshold, the Maximizer and the Master are limiters — and nothing
 * raised what is quiet as a whole: a game's distant voice, its ambience, a
 * film's whisper at night. This does both, per band:
 *
 * - **Upward** lifts what stands under `up_threshold_db` by `1 - 1/up_ratio`
 *   of the distance, never more than `up_max_db`. Nothing near silence is
 *   lifted: under -75 dBFS the lift fades out over 6 dB, so a paused game's
 *   hiss and a room's noise floor never come up.
 * - **Downward** holds down what stands over `down_threshold_db` by
 *   `1 - 1/down_ratio` of the distance.
 *
 * Three bands, split at 150 Hz and 4 kHz by first-order low-passes with the
 * rest taken as the difference, so low + mid + high is the input EXACTLY: at
 * ratios of one the stage is the input to the bit, and a band that does
 * nothing leaves its neighbours untouched. A blast's boom pulling the steps'
 * band down with it is what a single-band compressor does to a game, and is
 * why there are three.
 *
 * One level and one gain per band for every channel but the LFE — the
 * loudest channel's power — so a sound never moves: compression that differs
 * between the ears pulls an image toward the quieter one (the same rule as
 * Footsteps', `footsteps.h`). The LFE passes through untouched.
 *
 * The level is a 10 ms RMS of the band. The gain falls with `attack_ms` and
 * rises with `release_ms`, both in dB, so a blast after a quiet stretch
 * drops a lift at the attack's speed and a lift comes back at the release's.
 * No look-ahead and no delay: the stage fits game mode as it is.
 */
#ifndef FLUIDEQ_COMPANDER_H
#define FLUIDEQ_COMPANDER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Low (under 150 Hz), mid, high (over 4 kHz). */
#define FEQ_COMPANDER_BANDS 3
#define FEQ_COMPANDER_MAX_CHANNELS 8
#define FEQ_COMPANDER_LOW_SPLIT_HZ 150.0
#define FEQ_COMPANDER_HIGH_SPLIT_HZ 4000.0
/** Under this a band is silence or a noise floor and is never lifted. */
#define FEQ_COMPANDER_LIFT_FLOOR_DB (-75.0)

typedef struct FeqCompanderBand {
  /** dBFS: under it the band is lifted. */
  double up_threshold_db;
  /** 1 to 4: 1 lifts nothing. */
  double up_ratio;
  /** 0 to 18 dB: the most a band is ever lifted. */
  double up_max_db;
  /** dBFS: over it the band is held down. */
  double down_threshold_db;
  /** 1 to 20: 1 holds nothing. */
  double down_ratio;
} FeqCompanderBand;

typedef struct FeqCompanderSettings {
  int enabled;
  FeqCompanderBand bands[FEQ_COMPANDER_BANDS];
  /** 1 to 100 ms: how fast the gain falls. */
  double attack_ms;
  /** 20 to 1000 ms: how fast it rises. */
  double release_ms;
  /** 0 to 1: how much of the processed sound replaces the input. */
  double mix;
  /**
   * -12 to 12 dB on the processed sound, so a profile that holds more than it
   * lifts comes out as loud as it went in rather than winning or losing by
   * level. Applied with the bands' gains, so a mix of zero is still the
   * input exactly.
   */
  double makeup_db;
} FeqCompanderSettings;

/** Off, every ratio at one: the input exactly, whatever is switched on. */
void feq_compander_settings_defaults(FeqCompanderSettings* settings);

/** What the stage did since the report was last taken, per band, in dB. */
typedef struct FeqCompanderReport {
  /** The band's level, as the detector heard it, loudest in the block. */
  float level_db[FEQ_COMPANDER_BANDS];
  /** The largest lift in the block, never negative. */
  float lift_db[FEQ_COMPANDER_BANDS];
  /** The deepest hold in the block, never positive. */
  float hold_db[FEQ_COMPANDER_BANDS];
  /** Current applied gain, including make-up and the dry/wet blend. */
  float gain_db[FEQ_COMPANDER_BANDS];
  uint32_t active;
} FeqCompanderReport;

typedef struct FeqCompander FeqCompander;

FeqCompander* feq_compander_create(double sample_rate, uint32_t channels);
void feq_compander_destroy(FeqCompander* state);
void feq_compander_configure(FeqCompander* state,
                             const FeqCompanderSettings* settings);
/** Which channel is the LFE, or -1 for none. */
void feq_compander_set_lfe(FeqCompander* state, int channel);
void feq_compander_reset(FeqCompander* state);
/** Carries the split filters, levels and gains across a rebuilt chain. */
void feq_compander_transfer(FeqCompander* into, const FeqCompander* from);
void feq_compander_process(FeqCompander* state, float* const* channels,
                           uint32_t frames);
/** Takes the block's readings and starts the next block's. */
void feq_compander_block_report(FeqCompander* state,
                                FeqCompanderReport* report);
/** Whether the stage is changing anything at all, for the chain's skip. */
int feq_compander_active(const FeqCompander* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_COMPANDER_H */

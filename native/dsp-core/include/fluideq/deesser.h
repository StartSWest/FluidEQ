/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser: turns down a voice's S and leaves the cymbals alone.
 *
 * FluidEQ plays finished songs, so this is a de-esser for a whole mix, which
 * is the hard case: the singer's S and the hi-hat share the octave between
 * 4 and 10 kHz, and a detector that only asks "is there a lot of treble?"
 * dulls every cymbal on the record. The EQ's dynamic band asked exactly that
 * and nothing else (`dynamics.h`). This asks four things and weighs them
 * together on every S:
 *
 * - **Where it is.** A voice sits in the middle and hi-hats are usually
 *   panned, so the centre's share of the sibilance band is measured against
 *   the sides'. Only in Centre, where there is a pair to compare.
 * - **Its shape.** An S is a hump that falls away above about 11 kHz; a
 *   cymbal keeps going into the air band above it.
 * - **Its length.** An S rises like a syllable; a hi-hat arrives in one
 *   sample. A percussive onset holds the cut off for the length of a tick.
 * - **Against the song.** Each band is compared with the song's body below
 *   the sibilance and with its own recent bed, never with a fixed level — so
 *   a quiet song and a loud one are treated the same, and a ride cymbal that
 *   plays for seconds becomes the bed instead of a target.
 *
 * How sure it is that the sound is a voice (`keep_cymbals`) decides how much
 * of the cut is taken.
 *
 * The cut is made the way iZotope's spectral de-esser makes it: a bank of
 * third-octave bands, each with its own gain, so only the frequencies the S
 * is made of come down and the cut follows the voice from singer to singer.
 * Each band is added back as `x + (g - 1) * bandpass(x)`, which is the input
 * EXACTLY while nothing is being cut — the stage at rest changes no sample
 * but by its delay. Two other styles: Treble, everything above `low_hz`
 * (the classic split de-esser), and Whole voice, the whole processed signal
 * (radio's way, for speech).
 *
 * It looks ahead `FEQ_DEESSER_LOOK_AHEAD_MS`, so a cut is in place before the
 * S reaches the output, and keeps that delay whether it is on or off, the
 * way Bass Punch keeps its FIR's: switching it on never moves the audio.
 * Game mode with the stage off gives the delay up.
 */
#ifndef FLUIDEQ_DEESSER_H
#define FLUIDEQ_DEESSER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Third-octave bands across the widest listening range, 2 to 16 kHz. */
#define FEQ_DEESSER_MAX_BANDS 12
/** As many channels as a chain carries. */
#define FEQ_DEESSER_MAX_CHANNELS 8
/**
 * How far ahead it hears. Two milliseconds covers the fastest attack the dial
 * offers with room to spare, so a cut is complete when the S's first edge
 * plays; Pro-DS offers up to 15 ms, for vocal tracks with no music under them
 * to be held back.
 */
#define FEQ_DEESSER_LOOK_AHEAD_MS 2.0

/** How the cut is made. The wire carries this index. */
typedef enum FeqDeEsserMode {
  /** Only the bands the S is made of, each by its own amount. */
  FEQ_DEESSER_SPECTRAL = 0,
  /** Everything above `low_hz`, by the deepest band's amount. */
  FEQ_DEESSER_TREBLE = 1,
  /** The whole processed signal, by the deepest band's amount. */
  FEQ_DEESSER_WHOLE = 2
} FeqDeEsserMode;

typedef struct FeqDeEsserSettings {
  int enabled;
  /** Play only what the stage takes away, everything else silent. */
  int isolate;
  /** 0 to 1: how far an S has to stand out of the song before it is cut. */
  double sensitivity;
  /** The listening range, Hz. Structural: it lays the bands out. */
  double low_hz;
  double high_hz;
  /** The deepest cut, in dB, as a positive number. */
  double range_db;
  /** How far a band's cut spreads to its neighbours, in octaves. */
  double width_oct;
  /** `FeqDeEsserMode`. Structural. */
  int mode;
  double attack_ms;
  double release_ms;
  /** Listen and cut in the centre only. Structural. */
  int centre_only;
  /** 0 to 1: how much a sound that is not a voice is spared. */
  double keep_cymbals;
} FeqDeEsserSettings;

/** Dials at rest: off, and the Vocal music profile underneath. */
void feq_deesser_settings_defaults(FeqDeEsserSettings* settings);

/**
 * What the stage did since the report was last taken, for the page to draw.
 *
 * Levels are mean-square power in dB (a full-scale sine reads -3), cuts are
 * applied gain in dB, never positive. `confidence` is how sure the stage was
 * that the sound it cut deepest was a voice.
 */
typedef struct FeqDeEsserReport {
  /** The deepest cut since the last take, dB. 0 when nothing was cut. */
  float reduction_db;
  /** Where the S was, Hz, at that cut; 0 when nothing was cut. */
  float frequency_hz;
  /** 0 to 1, at the deepest cut, or at the loudest moment with none. */
  float confidence;
  /** The loudest band against the song's body, dB. */
  float sibilance_db;
  /**
   * The three tells `confidence` is made of, 0 to 1 each, read with it:
   * how much of the sibilance is in the centre, how little of it goes on
   * into the air, and how much it rose rather than struck.
   */
  float centre;
  float shape;
  float onset;
  uint32_t band_count;
  float band_hz[FEQ_DEESSER_MAX_BANDS];
  /** Each band's loudest level, dB. */
  float band_level_db[FEQ_DEESSER_MAX_BANDS];
  /** The level each band starts being cut at, as last measured, dB. */
  float band_threshold_db[FEQ_DEESSER_MAX_BANDS];
  /** Each band's deepest cut, dB, never positive. */
  float band_cut_db[FEQ_DEESSER_MAX_BANDS];
} FeqDeEsserReport;

typedef struct FeqDeEsser FeqDeEsser;

/** Allocates everything the audio thread will touch. Null on failure. */
FeqDeEsser* feq_deesser_create(double sample_rate, uint32_t channels);
void feq_deesser_destroy(FeqDeEsser* deesser);

/**
 * The preset curve's gain in dB at a frequency, or null for none.
 *
 * The rack runs before the preset's curve plays, so a bright preset would
 * lift every S the stage had just judged acceptable. Told the curve, each
 * band is heard as it will be heard: its power weighted by the curve's gain
 * there against the curve's gain at 1 kHz.
 */
typedef double (*FeqDeEsserToneGain)(const void* context, double hz);

/**
 * Adopt the dials. CONTROL thread; may be called while the audio thread
 * processes. The band layout is built here and published with one store;
 * the audio thread takes it at the top of a block, and a layout that moved
 * is taken only once the cut it was making has let go, so an edit never
 * steps the sound.
 */
void feq_deesser_configure(FeqDeEsser* deesser,
                           const FeqDeEsserSettings* settings,
                           FeqDeEsserToneGain tone_gain,
                           const void* tone_context);

/**
 * Which channel is the subwoofer feed and which the centre, or -1 for none,
 * as the host reads them from the stream's mask. CONTROL thread, before the
 * chain is published. The LFE is never cut; the centre is a lane of its own
 * in Centre, where film dialogue lives.
 */
void feq_deesser_set_layout(FeqDeEsser* deesser, int lfe_channel,
                            int centre_channel);

/**
 * One block, in place. AUDIO thread; allocates nothing, takes no lock.
 * `idle` is game mode with the stage off: nothing runs and nothing is
 * delayed.
 */
void feq_deesser_process(FeqDeEsser* deesser, float* const* channels,
                         uint32_t frames, int idle);

/** The delay the stage adds: its look-ahead, or none while `idle`. */
uint32_t feq_deesser_latency_frames(const FeqDeEsser* deesser, int idle);

/**
 * A handover: what `previous` was hearing and holding comes to `prepared`,
 * which keeps the layout it was configured with. Same rate and channels
 * only — the chain checks both before it calls this.
 */
void feq_deesser_transfer(FeqDeEsser* prepared, FeqDeEsser* previous);

/** A seek or a new programme: nothing of the last passage is kept. */
void feq_deesser_reset(FeqDeEsser* deesser);

/** What the last block did. AUDIO thread, after `process`. */
void feq_deesser_block_report(const FeqDeEsser* deesser,
                              FeqDeEsserReport* out);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_DEESSER_H */

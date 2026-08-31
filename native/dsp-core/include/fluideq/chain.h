/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The whole signal path, in the order the panels are stacked.
 *
 * Ported from `dspProcessor.worklet.ts`, which is one node rather than eleven
 * for a reason worth restating here: a crossover built out of separate filter
 * nodes puts each band on its own path through a graph, and any difference in
 * node latency between those paths misaligns the bands by samples when they
 * are summed. One path cannot have that class of bug.
 *
 * Every stage this calls already has its own parity fixtures. What those
 * cannot see is orchestration — a stage in the wrong order, a mid/side encode
 * wrapping the wrong span, a smoothing ramp that starts a block late — so the
 * chain is held to the real worklet running under `workletHarness.ts`.
 *
 * Settings are a resolved struct rather than the sparse parameter table. The
 * table addresses one control for a drag; a snapshot is the whole chain, and
 * arrays of bands do not survive a flat list of scalars without inventing an
 * indexing scheme that both sides would then have to agree about forever.
 */
#ifndef FLUIDEQ_CHAIN_H
#define FLUIDEQ_CHAIN_H

#include <stdint.h>

#include "fluideq/biquad.h"
#include "fluideq/crossfade.h"
#include "fluideq/denoise.h"
#include "fluideq/eq.h"
#include "fluideq/meters.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Matches `EQ_MAX_BAND_COUNT` in chain.ts. */
#define FEQ_CHAIN_MAX_EQ_BANDS 64
#define FEQ_CHAIN_EXCITER_BANDS 3
#define FEQ_CHAIN_COMPRESSOR_BANDS 3
/** Stereo. A third channel reuses the second one's filter state. */
#define FEQ_CHAIN_CHANNELS 2

/** `EQ_STEREO_MODES`, and the exciter's selector shares it. */
typedef enum FeqStereoMode {
  FEQ_STEREO_STEREO = 0,
  FEQ_STEREO_MID = 1,
  FEQ_STEREO_SIDE = 2
} FeqStereoMode;

/** `EQ_PHASE_MODES`. */
typedef enum FeqPhaseMode {
  FEQ_PHASE_MINIMUM = 0,
  FEQ_PHASE_LINEAR = 1
} FeqPhaseMode;

typedef struct FeqChainEqBand {
  int enabled;
  int dynamic;
  FeqFilterType type;
  double frequency;
  double gain_db;
  double quality;
  double threshold_db;
} FeqChainEqBand;

typedef struct FeqChainExciterBand {
  int enabled;
  double freq_hz;
  double range;
  double drive;
  double mix;
  double texture;
} FeqChainExciterBand;

typedef struct FeqChainCompressorBand {
  double threshold_db;
  double ratio;
  double attack_ms;
  double release_ms;
  double makeup_db;
} FeqChainCompressorBand;

typedef struct FeqChainExciterSettings {
  int enabled;
  int isolate;
  FeqStereoMode stereo;
  int align_enabled;
  double align_amount;
  int organic_enabled;
  double organic_amount;
  double organic_focus_hz;
  double organic_range;
  FeqChainExciterBand bands[FEQ_CHAIN_EXCITER_BANDS];
} FeqChainExciterSettings;

typedef struct FeqChainEqSettings {
  int enabled;
  int isolate;
  FeqEqModel model;
  double model_amount;
  FeqEqEngine engine;
  FeqPhaseMode phase;
  FeqStereoMode stereo;
  double mono_below_hz;
  /** 1, 2 or 4. Structural: changing it rebuilds the oversampler's views. */
  uint32_t oversample;
  double subsonic_hz;
  double fuzz_amount;
  uint32_t band_count;
  FeqChainEqBand bands[FEQ_CHAIN_MAX_EQ_BANDS];
} FeqChainEqSettings;

typedef struct FeqChainSettings {
  int enabled;
  /**
   * Restoration, below the input gain and above every creative stage.
   *
   * Below the input gain because that gain comes from a cached whole-file true
   * peak: changing the waveform above it makes the measurement describe a
   * signal that no longer exists and the ceiling stops holding silently.
   */
  FeqDenoiseSettings denoise;
  FeqChainExciterSettings exciter;
  FeqChainEqSettings eq;
  struct {
    int enabled;
    double crossover_hz[2];
    FeqChainCompressorBand bands[FEQ_CHAIN_COMPRESSOR_BANDS];
  } compressor;
  /**
   * Stereo width per band. Touches the side signal only, so the mono sum is
   * unchanged at every setting — `dimension_test.cpp` asserts that as equality.
   */
  struct {
    int enabled;
    double low_width;
    double mid_width;
    double high_width;
    double low_hz;
    double high_hz;
    double decorrelation;
  } dimension;
  /**
   * The two bass stages, carried as the chain's own copies of their settings.
   *
   * Not `FeqBassForgeSettings` and `FeqBassPunchSettings` directly: this header
   * is the wire's shape and including two stage headers into it would make
   * every consumer of a chain snapshot depend on them. The stage structs are
   * built from these in `chain_stages.cpp`, which is where the stage headers
   * already are.
   */
  struct {
    int enabled;
    /** Monitor what the stage adds, programme dropped. @see bass_forge.h */
    int isolate;
    /** Structural: it moves the crossover. */
    double split_hz;
    double drive_db;
    double sub_amount;
    double presence_amount;
    double texture;
    /** Zero is a bit-exact bypass, which is why the default can leave it on. */
    double mix;
  } bass_forge;
  struct {
    int enabled;
    /** Monitor what the stage adds, programme dropped. @see bass_punch.h */
    int isolate;
    /** Its own, not Forge's: the two stages do different jobs. */
    double split_hz;
    double attack;
    double sustain;
    double bloom_amount;
    double bloom_decay_ms;
    double duck;
  } bass_punch;
  struct {
    int enabled;
    /** Gain INTO the ceiling, which is what makes this a maximizer. */
    double drive_db;
    double ceiling_db;
    /** Structural: the look-ahead sets the limiter's buffer length. */
    double look_ahead_ms;
    double release_ms;
  } maximizer;
  struct {
    int enabled;
    double output_trim_db;
    int loudness_maximize;
    double loudness_target_lufs;
    double ceiling_db;
    double release_ms;
    /**
     * Play the maximized result at the loudness it had before maximizing.
     *
     * Auto Headroom still reserves the whole makeup, so the limiting is
     * identical and only the final level moves. That is what makes an A/B
     * against a bypassed Master a comparison of the sound rather than of the
     * volume, which is the oldest way to be wrong about a master.
     */
    int matched_bypass;
  } master;
  /**
   * The A/B that proves the safety net is the net and not the sound.
   *
   * A setting rather than a build flag because the whole value of it is
   * switching while the same audio plays.
   */
  int output_safety_enabled;
} FeqChainSettings;

/**
 * The flat-array layout, and the two numbers that define it.
 *
 * `encodeChainSettings` in `src/common/dsp/chainWire.ts` writes it — the only
 * thing that does, the fixture generator's `chainParams` being a one-line alias
 * to it — and `feq_chain_settings_decode` reads it. Everything before the band
 * array sits at a fixed offset, so adding a scalar cannot silently re-point
 * sixty-four bands: the decoder asserts the lead rather than trusting it.
 */
/*
 * 78 before Denoise added eighteen scalars, then 96 before Bass Forge and Bass
 * Punch added seven each. All of them are appended immediately before the band
 * count — which has to stay last, because both `isChainWirePayload` and the
 * decoder read the tail's length from `FEQ_CHAIN_PARAM_LEAD - 1`.
 */
#define FEQ_CHAIN_PARAM_LEAD 112
#define FEQ_CHAIN_BAND_PARAMS 7

/** Non-zero on success. Leaves `out` untouched on a layout it cannot read. */
int feq_chain_settings_decode(const double* values,
                              uint32_t count,
                              FeqChainSettings* out);

typedef struct FeqChain FeqChain;


/**
 * Everything the block loop touches is allocated here.
 *
 * `maximum_block_frames` is a ceiling and not a promise: a device hands over
 * partial blocks routinely, and the chain is written for that.
 */
FeqChain* feq_chain_create(double sample_rate,
                           uint32_t channels,
                           uint32_t maximum_block_frames);
void feq_chain_destroy(FeqChain* chain);

/** Defaults matching `DSP_DEFAULTS`, so a caller never starts from zeroes. */
void feq_chain_settings_defaults(FeqChainSettings* settings);

/**
 * Adopt a snapshot. May allocate; never call from the audio callback.
 *
 * Coefficients are rebuilt only when something they depend on moved, because
 * recomputing sixty-four biquads per block is 375 times a second for values
 * that change when a hand turns a knob.
 */
void feq_chain_configure(FeqChain* chain, const FeqChainSettings* settings);

/**
 * Hand over a linear-phase kernel, or null to leave linear phase.
 *
 * Built off the audio thread by `feq_build_linear_phase_kernel`: it costs two
 * 16k transforms, which is fine inside a frame and fatal inside a callback.
 * A kernel arriving while one is already running is cross-faded in rather than
 * swapped, because stepping the impulse response mid-tail is a click on every
 * curve change.
 */
void feq_chain_set_eq_kernel(FeqChain* chain,
                             const float* kernel,
                             uint32_t length);

/**
 * The whole-track gains, which arrive from analysis rather than from a dial.
 *
 * `snap` lands on them immediately — a direct load has no audible predecessor.
 * Without it the pair glides over two seconds, which is what a completed deck
 * handoff needs: it is already audible, so a step would be heard.
 */
void feq_chain_set_track_level_gains(FeqChain* chain,
                                     double input_gain_db,
                                     double master_loudness_gain_db,
                                     int snap);

/**
 * Hand the Denoise stage a measured floor, or null to drop the one it has.
 *
 * Its own call rather than a field in the snapshot, for the same reason
 * `set_eq_kernel` and `set_track_level_gains` are: it comes from analysis
 * rather than from a dial, it changes once per track rather than once per
 * knob-drag, and a second variable-length array inside the flat parameter
 * layout would be a decoder bug waiting to happen.
 *
 * May allocate. Never call from the audio callback.
 */
void feq_chain_set_noise_profile(FeqChain* chain,
                                 const FeqNoiseProfile* profile);

/** Point the neural module at a model file, or null to unload it. */
int feq_chain_load_voice_model(FeqChain* chain,
                               const char* model_path,
                               const char* runtime_path);

/** What the Denoise stage did with the last block. **Control thread.** */
void feq_chain_denoise_report(const FeqChain* chain, FeqDenoiseReport* out);

typedef enum FeqChainResetReason {
  FEQ_CHAIN_RESET_STREAM_START = 0,
  FEQ_CHAIN_RESET_SEEK = 1,
  FEQ_CHAIN_RESET_SOURCE_CHANGE = 2
} FeqChainResetReason;

void feq_chain_reset(FeqChain* chain, FeqChainResetReason reason);

/**
 * One block, in place. Planar, `channels` pointers.
 *
 * Real-time safe: allocates nothing, frees nothing, takes no lock, makes no OS
 * call. A block longer than the ceiling given to `create` is refused rather
 * than truncated — half a block of audio followed by whatever was in the
 * buffer is worse than a dropout, because it sounds like the material.
 */
void feq_chain_process(FeqChain* chain, float* const* channels,
                       uint32_t frames);

/** The chain's total added delay in samples, which linear phase dominates. */
uint32_t feq_chain_latency_frames(const FeqChain* chain);

/**
 * Hand the chain somewhere to report what the panel draws, or null for none.
 *
 * Borrowed, not owned: the host outlives the chain and keeps the meters across
 * a rebuild, so a display does not blank every time a band is added. The chain
 * taps three points into it — after the exciter, after the EQ, and at the very
 * end — because those are the three the renderer actually reads.
 *
 * Null is the ordinary state. Nothing in `feq_chain_process` costs anything
 * when the panel is closed, which is most of the time.
 */
void feq_chain_set_meters(FeqChain* chain, FeqMeters* meters);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_CHAIN_H */

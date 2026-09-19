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
 * chain is held to the final worklet output in the frozen parity corpus.
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
#include "fluideq/live_normalizer.h"
#include "fluideq/room.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Matches `EQ_MAX_BAND_COUNT` in chain.ts. */
#define FEQ_CHAIN_MAX_EQ_BANDS 64
#define FEQ_CHAIN_EXCITER_BANDS 3
#define FEQ_CHAIN_COMPRESSOR_BANDS 3
/**
 * The stereo pair: the two channels the width, bass and mid/side stages work
 * on, and the pair a Library track has.
 */
#define FEQ_CHAIN_CHANNELS 2
/**
 * How many channels one chain can carry — 7.1, which is what Windows hands a
 * system-wide effect on an output configured that way.
 *
 * Every channel gets the EQ, the exciter, the restoration's alignment and
 * every level stage, and the level stages make ONE decision for all of them:
 * the compressor, the maximizer, the headroom and the safety limiter each
 * listen across every channel and apply the same gain to each, so a surround
 * mix never pumps out of balance. The stages that are stereo by nature —
 * width, both bass stages, mid/side — work on the front pair and leave the
 * rest alone, and the rest are delayed to stay in step with it. A channel
 * count of one or two is bit-for-bit what it was.
 */
#define FEQ_CHAIN_MAX_CHANNELS 8

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
  FeqNormalizerSettings normalizer;
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
   * The Room: every channel a speaker around the head, rendered on the
   * front pair (`room.h`). The head itself is not a setting — the host hands
   * it over with `feq_chain_set_room_head` — and `head` names which of the
   * shipped ones the app wrote, so the engine can scale the interaural delay
   * to it. `preset` and `correct_headphones` are the app's, carried here so
   * the whole rack is one line on the wire.
   */
  struct {
    int enabled;
    int preset;
    double size_m;
    double walls;
    double distance_m;
    double centre_db;
    double sub_db;
    int head;
    int correct_headphones;
    /* Versioned Room rendering; absent wire trailer means legacy defaults. */
    int renderer_version;
    double early_reflection_db;
    double ambience_mix;
    double ambience_decay_s;
    double ambience_damping_hz;
    int preserve_position;
    int compare_original;
    int source_already_spatial;
    double angle_deg[FEQ_ROOM_SPEAKERS];
    double level_db[FEQ_ROOM_SPEAKERS];
    /* Bass management and its crossover — see `FeqRoomSettings`. */
    int bass_management;
    double crossover_hz;
    /* The music upmix and its amount — see `FeqRoomSettings`. */
    int music_upmix;
    double upmix_amount;
    /* Each speaker's own distance (0: the ring) and mutes, the sub last:
     * `FEQ_ROOM_MUTED`, `FEQ_ROOM_HUSHED` or both — see `FeqRoomSettings`. */
    double speaker_distance_m[FEQ_ROOM_SPEAKERS];
    int mute[FEQ_ROOM_SPEAKERS + 1];
  } room;
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
    double mix;
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
  /**
   * Whether a host with more than two channels runs the rack on all of them.
   *
   * The chain itself takes whatever width it is created with; this is the
   * host's instruction for how wide to create it — every channel Windows
   * hands over, or the front pair with the rest passed through. Carried in
   * the snapshot so it lives with the rack it belongs to.
   */
  int surround_all_channels;
  /**
   * Game mode: the rack gives up the delay it only carries for comfort.
   *
   * Two stages spend time on something a player does not want paid for.
   * Bass Punch keeps its FIR's alignment even when it is off, so that
   * switching it on never moves the audio — 549 frames, 11 ms at 48 kHz, on
   * every rack whether Punch runs or not. And the room's convolution is
   * partitioned, so it hands its output back one partition late — 512
   * frames. With this on, a Punch that is off costs nothing, and the room
   * runs its first partition as a direct FIR so the rest of it lands exactly
   * where it belongs: the same sound, with no delay of its own.
   *
   * The last value on the wire, after the normalizer's three, and only
   * written when it is on — so an engine that has never heard of it still
   * decodes every rack that does not ask for it.
   */
  int low_latency;
} FeqChainSettings;

/**
 * The flat-array layout, and the two numbers that define it.
 *
 * `encodeChainSettings` in `src/common/dsp/chainWire.ts` writes it — the only
 * thing that does — and `feq_chain_settings_decode` reads it. Everything
 * before the band array sits at a fixed offset, so adding a scalar cannot
 * silently re-point sixty-four bands: the decoder asserts the lead rather than
 * trusting it, and `dspChainWire.test.ts` holds the lead equal to the
 * encoder's `CHAIN_PARAM_LEAD`.
 *
 * What holds the decoder to the encoder's own output is `dsp_chain_test.cpp`
 * in system-apo, on a line frozen from the encoder, and
 * `preset_safety_test.cpp`, on the whole factory catalogue — never the
 * whole-chain parity fixtures, which are frozen in an older layout.
 */
/*
 * 78 before Denoise added nineteen scalars, then 97 before Bass Forge and Bass
 * Punch added seven each, then 114 before the surround switch added one, then
 * 115 before the room added twenty-three, then 138 before the room's bass
 * management added two, then 140 before the music upmix added two, then
 * 142 before each speaker's distance and the eight mutes added fifteen. All
 * of them are appended immediately before the
 * band count — which has to stay last, because both `isChainWirePayload`
 * and the decoder read the tail's length from `FEQ_CHAIN_PARAM_LEAD - 1`.
 */
#define FEQ_CHAIN_PARAM_LEAD 157
#define FEQ_CHAIN_BAND_PARAMS 7
/** ROOM tag, schema version, payload size, then eight Room values. */
#define FEQ_CHAIN_ROOM_TAG 1380929357
#define FEQ_CHAIN_ROOM_SCHEMA 1
#define FEQ_CHAIN_ROOM_FIELDS 8
#define FEQ_CHAIN_ROOM_TRAILER 11
/** Normalizer (3), explicit low latency (1), tagged Room (11). */
#define FEQ_CHAIN_MAX_TRAILER 15
#define FEQ_CHAIN_MAX_PARAMS (FEQ_CHAIN_PARAM_LEAD + FEQ_CHAIN_MAX_EQ_BANDS * FEQ_CHAIN_BAND_PARAMS + FEQ_CHAIN_MAX_TRAILER)

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
 *
 * `channels` is one to `FEQ_CHAIN_MAX_CHANNELS`; anything wider is refused.
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

int feq_chain_transfer_state(FeqChain* prepared, FeqChain* previous);

/**
 * Which channel is the subwoofer feed, or -1 for none — the LFE of a 2.1,
 * 5.1 or 7.1 stream, as the host reads it from the stream's channel mask.
 *
 * It gets the EQ and every level stage like any other channel, and not the
 * exciter: harmonics added to a subwoofer feed are heard as the subwoofer
 * buzzing, and the stage exists to add presence, which a subwoofer has none
 * of. Set before the chain is published; a chain that is never told has no
 * LFE, which is right for every stereo stream.
 */
void feq_chain_set_lfe_channel(FeqChain* chain, int channel);

/**
 * The room's head — see `feq_room_set_head`. Copied; the chain keeps it
 * across reconfigures. CONTROL thread. A null or empty head is "no head",
 * which leaves the room inactive whatever its switch says.
 */
void feq_chain_set_room_head(FeqChain* chain, const float* left,
                             const float* right, uint32_t directions,
                             uint32_t taps, int doubling);

/**
 * Which room speaker each channel feeds (`FEQ_CHAIN_MAX_CHANNELS` entries,
 * 0..6 or -1), as the host reads it from the stream's mask. CONTROL thread.
 */
void feq_chain_set_room_layout(FeqChain* chain, const int* speaker);

/** Whether the room is folding this chain's channels right now. */
int feq_chain_room_active(const FeqChain* chain);

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

/** Audio owner only. Clear Room's capture/delays at an external route boundary. */
void feq_chain_reset_room(FeqChain* chain);

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

/**
 * The chain's total added delay in samples: the sum of the parts below.
 *
 * What the engine hands Windows for video sync and what the DSP page shows a
 * listener as their lag, so it has to be the delay the audio actually has —
 * `chain_latency_test.cpp` measures every configuration with an impulse. It
 * was not, for a long time: the three limiters at the end hold the audio
 * back by their look-ahead whether or not they have anything to do, and
 * none of them was counted — 432 frames, 9 ms at 48 kHz, on every rack.
 */
uint32_t feq_chain_latency_frames(const FeqChain* chain);

/** What each stage adds to that delay, in samples. */
typedef struct FeqChainLatencyParts {
  /** The EQ under linear phase: its kernel's half length and a partition. */
  uint32_t linear_eq;
  /** The restoration's modules that are on. */
  uint32_t restoration;
  /** Live leveling's look-ahead. */
  uint32_t leveler;
  /** The room's convolution partition; nothing in game mode. */
  uint32_t room;
  /** Bass Punch's FIR, running or on standby; nothing in game mode when off. */
  uint32_t bass_punch;
  /** The Maximizer's look-ahead, which runs whether it is on or not. */
  uint32_t maximizer;
  /** The Master's auto headroom look-ahead, likewise. */
  uint32_t headroom;
  /** The output safety's look-ahead, while the safety is on. */
  uint32_t safety;
} FeqChainLatencyParts;

void feq_chain_latency_parts(const FeqChain* chain, FeqChainLatencyParts* out);

/** Active processors, including those with no fixed buffering. Bit order is
 * leveler, restoration, exciter, bass forge, EQ, bass punch, room, dimension,
 * compressor, maximizer, headroom, safety, master. CONTROL planning snapshot,
 * read before publishing a prepared chain. Room protection reflects the planned
 * configuration, not an audio-owned Room report during a handover. */
uint32_t feq_chain_active_stages(const FeqChain* chain);
/** AUDIO snapshot: Room and Dimension reflect the last actually processed block. */
uint32_t feq_chain_processed_stages(const FeqChain* chain);

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
/* Before playback: external streams have no whole-file analysis to apply. */
int feq_chain_enable_live_normalizer(FeqChain* chain);
/**
 * Give live leveling somewhere to keep what it learns beyond this chain, and to
 * hear which song is playing. After `feq_chain_enable_live_normalizer` and
 * before the chain is published; borrowed, and it must outlive the chain.
 */
void feq_chain_attach_leveling_memory(FeqChain* chain, FeqLevelingMemory* memory);
/** Audio-thread notification for host silence flags; no sample buffer is read. */
void feq_chain_notify_input_silence(FeqChain* chain, uint32_t frames);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_CHAIN_H */

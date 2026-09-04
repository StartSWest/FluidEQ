/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Restoration: four unrelated processors that happen to run at the same point.
 *
 * They share the place in the chain and the file scan that feeds them, and
 * nothing else. Hiss is a short-time transform, hum is a comb of biquads,
 * clicks are a time-domain outlier repair, and voice is a neural model behind
 * a worker thread. Four separate processors in series rather than one engine
 * with mode flags, because a listener with mains buzz must not pay the
 * spectral module's twenty-one milliseconds to remove it.
 *
 * Native only. There is no TypeScript twin and none is owed: the worklet is a
 * passthrough that stands down, so a second implementation would have no
 * consumer and would be kept in agreement with this one by hand. That also
 * means the whole stage is silent on the worklet fallback, which the panel
 * says out loud rather than leaving to be noticed.
 *
 * Order inside the stage is not arbitrary. Clicks are repaired FIRST, because
 * an impulse is broadband: left in place it smears across every bin of the
 * spectral module's window and is measured as signal at every frequency at
 * once. Hum is notched SECOND, so its partials are gone before a floor is
 * estimated and cannot be mistaken for one. Hiss runs THIRD against what is
 * left, and voice LAST, on a signal the cheap modules have already cleaned.
 */
#ifndef FLUIDEQ_DENOISE_H
#define FLUIDEQ_DENOISE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Matches `NOISE_PROFILE_BANDS` in `noiseProfile.ts`. */
#define FEQ_DENOISE_PROFILE_BANDS 40
/** Matches `NOISE_HUM_MAX_HARMONICS`. */
#define FEQ_DENOISE_MAX_HUM_PARTIALS 10
/** Stereo. A third channel would reuse the second one's state. */
#define FEQ_DENOISE_CHANNELS 2

/** Matches `DENOISE_PROFILE_SOURCES`; the wire carries the index. */
typedef enum FeqDenoiseProfileSource {
  FEQ_DENOISE_PROFILE_SCANNED = 0,
  FEQ_DENOISE_PROFILE_ADAPTIVE = 1
} FeqDenoiseProfileSource;

/** Matches `DENOISE_HUM_MODES`. */
typedef enum FeqDenoiseHumMode {
  FEQ_DENOISE_HUM_AUTO = 0,
  FEQ_DENOISE_HUM_FIFTY = 1,
  FEQ_DENOISE_HUM_SIXTY = 2
} FeqDenoiseHumMode;

/** Legacy wire values. The speech denoiser now ignores this slot. */
typedef enum FeqDenoiseVoiceMode {
  FEQ_DENOISE_VOICE_KEEP_VOICE = 0,
  FEQ_DENOISE_VOICE_KEEP_BACKGROUND = 1
} FeqDenoiseVoiceMode;

typedef struct FeqDenoiseSettings {
  int enabled;
  /** Emit what is being removed instead of what is kept. */
  int isolate;
  FeqDenoiseProfileSource profile_source;
  struct {
    int enabled;
    double amount;
    /** Reduction limit in dB, negative. Never attenuate a bin further. */
    double floor_db;
    double sensitivity_db;
    double smoothing;
  } hiss;
  struct {
    int enabled;
    FeqDenoiseHumMode mode;
    /** A ceiling on how many partials are notched, not a count. */
    double harmonics;
    double depth_db;
    double quality;
  } hum;
  struct {
    int enabled;
    double sensitivity;
    /** Structural: sizes the detector's lookahead. */
    double max_repair_samples;
  } click;
  struct {
    /** Structural: builds the session, its worker and the latency ring. */
    int enabled;
    FeqDenoiseVoiceMode mode;
    double amount;
  } voice;
} FeqDenoiseSettings;

/**
 * A measured floor, as it arrives from analysis rather than from a dial.
 *
 * Handed over by its own call for the same reason the linear-phase kernel and
 * the track level gains are: it comes from a scan, it changes once per track
 * rather than once per knob-drag, and a second variable-length array inside
 * the flat settings layout would be a decoder bug waiting to be written.
 *
 * `hum_hz` is a measured frequency and not a choice between 50 and 60. A notch
 * nailed to 50.0 misses hum sitting at 50.2, and widening it until it does not
 * is how a hum filter starts removing bass.
 */
typedef struct FeqNoiseProfile {
  /** Per-band floor in dBFS, quietest-percentile. */
  double bands_db[FEQ_DENOISE_PROFILE_BANDS];
  double floor_dbfs;
  double hum_hz;
  /**
   * Level ABOVE the surrounding floor, per partial — not absolute level.
   *
   * That is the number that decides whether a notch is worth placing. A
   * partial sitting at the floor is the floor, and notching it removes music
   * while removing no buzz.
   */
  double hum_partial_hz[FEQ_DENOISE_MAX_HUM_PARTIALS];
  double hum_partial_excess_db[FEQ_DENOISE_MAX_HUM_PARTIALS];
  uint32_t hum_partial_count;
} FeqNoiseProfile;

/** What the panel draws, measured rather than derived from the dials. */
typedef struct FeqDenoiseReport {
  /** Mean broadband attenuation over the block, dB. Never positive. */
  double reduction_db;
  /** The floor actually in use, whichever source produced it. */
  double noise_floor_db;
  uint32_t clicks_repaired;
  /**
   * Blocks the neural worker missed. Dry audio went through for each.
   *
   * Counted and published because the alternative is a module that
   * intermittently stops working and never says so.
   */
  uint32_t voice_underruns;
  int profile_ready;
  int voice_model_loaded;
  /**
   * The floor actually in use, per profile band, as a density in dB.
   *
   * Whichever source is live — the scanned profile or the adaptive tracker —
   * so the panel draws what the stage is subtracting rather than what it was
   * handed. In Adaptive those are not the same thing at all, and that mode's
   * entire behaviour is invisible without this: a tracker that never converges
   * and one that converges correctly are told apart by watching this move.
   *
   * Same units as `bands_db`, so one drawing path serves both sources.
   */
  double floor_bands_db[FEQ_DENOISE_PROFILE_BANDS];
  /** Actual per-band hiss gain in dB; zero means that band was unchanged. */
  double hiss_reduction_bands_db[FEQ_DENOISE_PROFILE_BANDS];
} FeqDenoiseReport;

typedef struct FeqDenoise FeqDenoise;

/**
 * Everything the block loop touches is allocated here.
 *
 * `maximum_block_frames` is a ceiling rather than a promise, as everywhere
 * else in this engine: a device hands over partial blocks routinely.
 */
FeqDenoise* feq_denoise_create(double sample_rate,
                               uint32_t channels,
                               uint32_t maximum_block_frames);
void feq_denoise_destroy(FeqDenoise* denoise);

/** Defaults matching `DSP_DEFAULTS.denoise`, so a caller starts somewhere real. */
void feq_denoise_settings_defaults(FeqDenoiseSettings* settings);

/**
 * Adopt a snapshot. May allocate; never call from the audio callback.
 *
 * The hum comb is rebuilt only when a term it depends on moved. Recomputing
 * ten biquads per block is 375 times a second for values that change when a
 * hand turns a knob.
 */
void feq_denoise_configure(FeqDenoise* denoise,
                           const FeqDenoiseSettings* settings);

/**
 * Hand over a measured profile, or null to fall back to the live tracker.
 *
 * Copied rather than borrowed: the caller's copy comes off an IPC buffer that
 * is reused, and the audio thread reads this for the length of a track.
 */
void feq_denoise_set_profile(FeqDenoise* denoise,
                             const FeqNoiseProfile* profile);

/**
 * Point the voice module at a model file, or null to unload it.
 *
 * `runtime_path` is the ONNX Runtime shared library, which is loaded by path
 * rather than linked: it already ships with the app, and asking the operating
 * system for it means the audio host gains no build dependency and a missing
 * runtime is an ordinary answer instead of a host that will not start.
 *
 * Builds a session and starts a worker, so this is a control-thread call.
 * Until it succeeds the module reports itself unavailable rather than passing
 * audio through a control that reads as on.
 */
int feq_denoise_load_voice_model(FeqDenoise* denoise,
                                 const char* model_path,
                                 const char* runtime_path);

void feq_denoise_reset(FeqDenoise* denoise);

/**
 * One block, in place. Planar, `channels` pointers.
 *
 * Real-time safe: allocates nothing, frees nothing, takes no lock, makes no OS
 * call. The neural module does its inference on a worker and reads the result
 * through a lock-free ring; when the worker has not finished in time this
 * passes the dry signal and counts an underrun. It never emits a partial
 * block — half a block of audio followed by whatever was in the buffer is
 * worse than a dropout, because it sounds like the material.
 */
void feq_denoise_process(FeqDenoise* denoise,
                         float* const* channels,
                         uint32_t frames);

/** Added delay in samples, which the spectral module dominates. */
uint32_t feq_denoise_latency_frames(const FeqDenoise* denoise);

/** What the last block did. **Control thread.** */
void feq_denoise_report(const FeqDenoise* denoise, FeqDenoiseReport* out);

/**
 * The geometric centre of one profile band, in Hz.
 *
 * Must agree with `noiseProfileBandHz` exactly. A profile interpolated onto
 * the wrong centres subtracts the wrong amount at every frequency and still
 * looks like a plot of a noise floor, so both sides derive the spacing from
 * the span rather than writing a rounded number down.
 */
double feq_denoise_band_hz(uint32_t index);

/** The profile level at one frequency, interpolated in dB between centres. */
double feq_denoise_profile_level_at(const double* bands_db, double hz);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_DENOISE_H */

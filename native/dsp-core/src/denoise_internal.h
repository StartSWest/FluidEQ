/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The four modules' state, shared between the files that implement them.
 *
 * Split across `denoise_spectral.cpp`, `denoise_hum.cpp`, `denoise_click.cpp`
 * and `denoise_voice.cpp` because they are four unrelated algorithms and one
 * file holding all of them would be past the point where it can be read.
 */
#ifndef FLUIDEQ_DENOISE_INTERNAL_H
#define FLUIDEQ_DENOISE_INTERNAL_H

#include <atomic>
#include <cstdint>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/denoise.h"

/**
 * The analysis window, in milliseconds rather than in bins.
 *
 * Held near 21 ms at every sample rate, which means the transform size changes
 * with the rate and the FREQUENCY resolution changes with it. That is the
 * right way round: a longer window smears transients, and transient smearing
 * is what a listener notices, while a noise floor is smooth enough that bin
 * spacing is not the binding constraint. Pinning the bin count instead would
 * make the stage sound different at 44.1 and 96 kHz for no reason anyone could
 * name.
 *
 * 1024 at 48 kHz, so 21.3 ms and 46.9 Hz bins.
 */
constexpr double kDenoiseWindowMs = 21.3;

/** Three-quarter overlap. Hann squared at hop N/4 sums to a constant. */
constexpr uint32_t kDenoiseOverlap = 4;

/** The neural module's frame, fixed by the model at 48 kHz. */
constexpr uint32_t kDenoiseVoiceFrame = 480;

/**
 * How many finished frames the audio thread stays behind the worker.
 *
 * Four frames is 40 ms. Fewer and an ordinary scheduling hiccup on a loaded
 * machine turns into an underrun; more is latency nobody asked for.
 */
constexpr uint32_t kDenoiseVoiceLatencyFrames = 4;

/** Floor shared with `NOISE_PROFILE_SILENCE_DB`. */
constexpr double kDenoiseSilenceDb = -120.0;

/**
 * The deepest delay every module together can add, at any supported rate.
 *
 * The spectral window is the largest term: held near 21 ms, it reaches 4096
 * samples at 192 kHz, of which a window less a hop is 3072. The neural module
 * adds its own window and latency ring at 2880, and the click repairer its
 * lookahead at 144. Six thousand and change, rounded up — this sizes Isolate's
 * dry delay once at construction so no module toggle ever reallocates a buffer
 * the callback is reading.
 */
constexpr uint32_t kDenoiseMaxLatencyFrames = 8192;

/**
 * One channel's short-time transform state.
 *
 * `input` and `output` are the overlap-add rings; `previous_gain` and
 * `previous_magnitude` carry the decision-directed estimator across frames,
 * which is the whole reason this sounds like restoration rather than like a
 * gate opening and closing.
 */
struct DenoiseSpectralChannel {
  std::vector<float> input;
  std::vector<float> output;
  uint32_t fill = 0;
  std::vector<double> real;
  std::vector<double> imaginary;
  std::vector<double> previous_gain;
  std::vector<double> previous_magnitude;
  /**
   * The live floor estimate, and the running minimum it is derived from.
   *
   * Minimum statistics: the quietest thing seen in a bin over the last couple
   * of seconds is the noise in that bin, because music stops and noise does
   * not. `minimum_age` is what stops a single quiet passage from pinning the
   * estimate forever once the music comes back.
   */
  std::vector<double> adaptive_db;
  std::vector<double> running_minimum;
  /**
   * The periodogram smoothed in time, which is what the minimum is taken of.
   *
   * Not the raw one. A raw bin's power is exponentially distributed, so over a
   * second and a half of noise its minimum lands ten to fifteen decibels under
   * its mean — while a steady tone, which barely fluctuates at all, has a
   * minimum equal to its own level. Taking minima of the raw periodogram
   * therefore estimates the noise far too low and the tone exactly right,
   * which is precisely backwards: it removed a 1 kHz tone by the full 30 dB
   * and left the noise floor within a decibel of where it started.
   *
   * Smoothing first collapses the noise's variance, so its minimum approaches
   * its mean and a small bias correction is enough.
   */
  std::vector<double> smoothed_power;
  uint32_t minimum_age = 0;
};

struct DenoiseHumChannel {
  /** One biquad per notched partial, in cascade. */
  std::vector<FeqBiquadState> states;
};

/**
 * One channel's click detector.
 *
 * `history` is the lookahead: a click is only repairable while the samples
 * after it are still in hand, because the repair interpolates across the
 * damaged run from both sides.
 */
struct DenoiseClickChannel {
  std::vector<float> history;
  /**
   * One flag per stored sample, set at the write head, consumed at the read.
   *
   * Detection and repair are deliberately at opposite ends of the buffer. A
   * click is repaired by interpolating ACROSS it, which needs good samples on
   * both sides — and the samples after a click have not arrived yet when the
   * click is detected. Delaying the repair until the sample reaches the read
   * head means both sides are always in hand.
   */
  std::vector<uint8_t> flags;
  uint32_t capacity = 0;
  uint32_t cursor = 0;
  /**
   * The scale the threshold is set on: a running median of |prediction error|.
   *
   * A MEDIAN, tracked by stepping up when the sample is above it and down when
   * below. That is what makes it robust: a click is rare, so it nudges the
   * estimate up by one step and the ordinary error level pulls it straight
   * back, where a mean would be dragged up by the very outliers it exists to
   * find.
   *
   * It was first written as a mean updated only from UNFLAGGED samples, which
   * cannot bootstrap: the scale starts at zero, so every sample is above the
   * threshold, so nothing is ever unflagged, so the scale stays at zero
   * forever and the detector flags the entire track and repairs none of it.
   */
  double median_error = 0.0;
  /**
   * Samples still to be seen before the tracker is trusted.
   *
   * A detector with no scale yet must not detect. Without this the threshold
   * sweeps up through the material's own error level on the way to converging,
   * and finds "clicks" in clean audio while it passes through.
   */
  uint32_t warmup = 0;
  /** Whether the previous read sample was flagged, so runs count once. */
  bool in_run = false;
};

struct FeqDenoise {
  double sample_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t max_frames = 0;

  FeqDenoiseSettings settings{};

  /** Structural, so they are read once at configure rather than per block. */
  uint32_t window = 0;
  uint32_t hop = 0;
  std::vector<double> window_shape;
  /**
   * The sum of the window's squares, which the profile contract needs.
   *
   * A stored floor has to mean the same thing whatever transform size reads
   * it: the scan runs at the file's rate and the engine at the device's, and
   * those are routinely different. So the profile is a DENSITY — power per
   * hertz — and converting it back to an expected bin power needs both this
   * and the bin width. Storing a per-bin magnitude instead would make a
   * profile measured at 44.1 kHz subtract the wrong amount at 48.
   */
  double window_energy = 0.0;

  std::vector<DenoiseSpectralChannel> spectral;
  std::vector<DenoiseHumChannel> hum;
  std::vector<DenoiseClickChannel> click;

  /** The notch coefficients, shared by both channels. */
  std::vector<FeqBiquadCoefficients> hum_coefficients;

  /**
   * The measured profile, and whether one has ever arrived.
   *
   * `profile_ready` is not the same question as "is Scanned selected": a track
   * that has never been analyzed has the control set to Scanned and no profile
   * behind it, and the card has to be able to say which one is running.
   */
  FeqNoiseProfile profile{};
  bool profile_ready = false;

  /** The per-bin floor the spectral module actually subtracts against. */
  std::vector<double> profile_bins_db;
  bool profile_bins_valid = false;

  /** Isolate's scratch: what the stage removed, kept to be emitted instead. */
  std::vector<std::vector<float>> residual;

  /**
   * The dry signal, delayed by exactly what the wet path costs.
   *
   * Isolate is `dry - wet`, and that is only the residual when the two are
   * aligned in time. They were not. The spectral module delays by a window
   * less a hop and the click repairer by its whole lookahead, so the
   * subtraction was the input minus a time-shifted copy of itself — which is a
   * comb filter, with a notch every 1/D Hz. At the sixteen-odd milliseconds
   * this stage actually adds, a comb filter is a slapback, and it was reported
   * as sounding like a chamber effect. It was one.
   *
   * A ring rather than one more copy of the block: the delay is longer than a
   * block and spans several of them.
   */
  std::vector<std::vector<float>> dry_delay;
  uint32_t dry_cursor = 0;

  /**
   * The neural module's runtime, session, worker and rings.
   *
   * Opaque here because its members are the ONNX Runtime C API and a platform
   * library handle, and nothing else in the core should have to see either.
   * Null until a model is loaded, which is the ordinary state.
   */
  void* voice = nullptr;

  /** Published for the panel; written by the audio thread, read by control. */
  std::atomic<double> reported_reduction_db{0.0};
  std::atomic<double> reported_floor_db{kDenoiseSilenceDb};
  std::atomic<uint32_t> reported_clicks{0};
  std::atomic<uint32_t> reported_voice_underruns{0};
  std::atomic<int> voice_model_loaded{0};
};

/** Rebuild the transform size and window for the current rate. */
void denoise_spectral_configure(FeqDenoise* denoise);
void denoise_spectral_reset(FeqDenoise* denoise);
/** Returns the mean attenuation applied over the block, in dB. */
double denoise_spectral_process(FeqDenoise* denoise,
                                float* const* channels,
                                uint32_t frames);

void denoise_hum_configure(FeqDenoise* denoise);
void denoise_hum_reset(FeqDenoise* denoise);
void denoise_hum_process(FeqDenoise* denoise,
                         float* const* channels,
                         uint32_t frames);

void denoise_click_configure(FeqDenoise* denoise);
void denoise_click_reset(FeqDenoise* denoise);
/** Returns how many impulses were repaired in this block. */
uint32_t denoise_click_process(FeqDenoise* denoise,
                               float* const* channels,
                               uint32_t frames);

void denoise_voice_configure(FeqDenoise* denoise);
void denoise_voice_reset(FeqDenoise* denoise);
/** Returns how many blocks the worker failed to deliver in time. */
uint32_t denoise_voice_process(FeqDenoise* denoise,
                               float* const* channels,
                               uint32_t frames);
int denoise_voice_load_model(FeqDenoise* denoise,
                             const char* model_path,
                             const char* runtime_path);
void denoise_voice_unload(FeqDenoise* denoise);
uint32_t denoise_voice_latency_frames(const FeqDenoise* denoise);

#endif /* FLUIDEQ_DENOISE_INTERNAL_H */

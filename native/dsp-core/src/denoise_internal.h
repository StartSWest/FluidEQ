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
#include <string>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/denoise.h"

/**
 * The analysis window, in milliseconds rather than in bins.
 *
 * Held at a fixed DURATION at every sample rate, so the transform size moves
 * with the rate rather than the time resolution moving. Pinning the bin count
 * instead would make the stage sound different at 44.1 and 96 kHz for no
 * reason anyone could name.
 *
 * 2048 at 48 kHz, so 42.7 ms and 23.4 Hz bins.
 *
 * It was half this. The argument for 21 ms was that a longer window smears
 * transients while a noise floor is smooth enough that bin spacing is not the
 * binding constraint. The first half is true; the second is only true above a
 * few hundred hertz. At 46.9 Hz bins there are four of them below 200 Hz, so
 * every gain decision down there was taken across a quarter of the bass
 * register at once and the floor could not be told apart from the note. That
 * is what was reported as no resolution. Restoration work is done at 40-90 ms
 * for this reason.
 */
constexpr double kDenoiseWindowMs = 42.7;

/**
 * Seven-eighths overlap. Hann squared at hop N/M sums to M x 3/8.
 *
 * Raised from four as the window doubled, and it had to be. At hop N/4 a
 * doubled window also halves the rate at which any gain is allowed to change,
 * and a gain that moves every 10.7 ms instead of every 5.3 ms is audibly
 * slower to let go of a transient — the doubling would have bought frequency
 * resolution by spending time resolution, which is a trade nobody asked for.
 * Eight keeps the hop at 256 samples, exactly where it was. The cost is one
 * transform twice as often, which for two channels is under a percent of a
 * core.
 */
constexpr uint32_t kDenoiseOverlap = 8;

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
 * The spectral window is the largest term: held at 42.7 ms, it reaches 8192
 * samples at 192 kHz. The 48 kHz neural module reaches 9600 after conversion
 * at 192 kHz, and the click repairer its lookahead at 144, for 17936 — so this
 * doubled when the window did, and it must move with it every time. It sizes
 * Isolate's dry delay once at construction so that no module toggle ever
 * reallocates a buffer the callback is reading; a value too small does not
 * fail loudly, it silently wraps the ring and returns the wrong sample.
 */
constexpr uint32_t kDenoiseMaxLatencyFrames = 32768;

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
   * The live floor estimate: minimum statistics over OVERLAPPING subwindows.
   *
   * The quietest thing seen in a bin over the last couple of seconds is the
   * noise in that bin, because music stops and noise does not. How that
   * look-back is organised is the difference between a floor that glides and
   * one that lurches, and it was organised the crude way: one running minimum
   * over a whole 1.5-second block, adopted and reset at the block boundary.
   *
   * That estimate is constant for 281 frames and then jumps. Worse, inside a
   * block a running minimum can only FALL, so when the noise rises the stage
   * over-suppresses for up to a second and a half and then snaps out of it.
   * Both halves were audible and both were reported: sticky, and digital.
   *
   * Martin's actual method keeps V shorter subwindows and takes the minimum
   * across them, retiring the oldest as each one closes. The estimate then
   * refreshes every U frames instead of every U x V, and it can rise as well
   * as fall, because a loud subwindow eventually ages out of the set.
   *
   * `subwindow_minimum` is the one still being filled, `subwindow_history`
   * holds the V that have closed (laid out bin-major, V per bin), and
   * `history_minimum` is their minimum — recomputed only when a subwindow
   * closes, so the per-frame cost stays at one comparison per bin.
   */
  std::vector<double> adaptive_db;
  std::vector<double> subwindow_minimum;
  std::vector<double> subwindow_history;
  std::vector<double> history_minimum;
  /**
   * A priori SNR before it is smoothed across neighbouring bins.
   *
   * Held per frame rather than per bin because the smoothing needs the
   * neighbours' UNsmoothed values; writing back in place would feed each bin's
   * result into the next one's input and turn a three-tap kernel into a
   * one-pole filter running up the spectrum.
   */
  std::vector<double> priori;
  /**
   * The a posteriori SNR, and the log of the noise power the frame settled on.
   *
   * Carried from the first pass to the second because both are needed there
   * and neither survives recomputation: the log-spectral gain is a function of
   * BOTH SNRs, and the whitened reduction limit needs each bin's noise against
   * the frame's geometric mean of them. Logarithmic because that mean is a
   * mean of logs and the limit is a ratio raised to a fractional power, both
   * of which are cheaper on that side.
   */
  std::vector<double> posterior;
  std::vector<double> log_noise;
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
  /** Frames into the subwindow currently being filled. */
  uint32_t subwindow_age = 0;
  /** Which of the V history slots the next closed subwindow overwrites. */
  uint32_t subwindow_slot = 0;
  /**
   * Whether any subwindow has closed yet.
   *
   * Until one has, the stage publishes no floor at all and passes the signal
   * through. The alternative is an estimate built from a few milliseconds of
   * whatever the track opens with, glided onto within a fraction of a second —
   * which is a stage that suppresses its own first note.
   */
  bool floor_ready = false;
  /**
   * Whether a first frame has been seen.
   *
   * `smoothed_power` starting at zero means the first several frames report a
   * floor far below the real one, and a running minimum keeps that. Seeding
   * the smoother with the first frame's actual power instead costs one branch
   * and removes a wrong estimate that used to survive a whole look-back.
   */
  bool primed = false;
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
  /**
   * How many of `flags` are set, kept as a running total.
   *
   * The isolation test needs to know how much of the neighbourhood is in
   * question, and it needs to know it per sample. Counting the buffer each time
   * would be fifty comparisons on the audio thread for every sample; carried
   * incrementally it is two additions, as long as every write and every clear
   * goes through it.
   */
  uint32_t flagged_count = 0;
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
   * can select Scanned with no profile behind it, in which case the spectral
   * path stays transparent until an explicit scan arrives.
   */
  FeqNoiseProfile profile{};
  bool profile_ready = false;

  /** The per-bin floor the spectral module actually subtracts against. */
  std::vector<double> profile_bins_db;
  bool profile_bins_valid = false;

  /**
   * How much of the reduction each bin is allowed to receive, 0 to 1.
   *
   * This exists because the floor estimator is wrong at low frequencies, in
   * BOTH modes, and for one reason: every method here decides what the noise
   * is by finding the quietest thing a band ever does. Adaptive takes the
   * minimum over a second and a half; the scan takes the tenth percentile over
   * the whole file. Both assume a band goes quiet sometimes.
   *
   * Bass does not. A held note runs longer than the look-back, a kick pattern
   * repeats without a gap, and the quietest thing the 60 Hz band ever does is
   * still the bass — so the estimator calls the bass the noise floor and the
   * stage subtracts it. Reported as the reduction eating bass, which is
   * exactly what it was doing.
   *
   * It cannot be fixed inside the estimator at these frequencies. A transform
   * with linear bin spacing gives the whole bottom octave two bins, so there
   * is no spectral neighbourhood to compare a bass partial against and no way
   * to tell a sustained note from stationary rumble per bin. Up top, where
   * hiss actually lives, there are hundreds of bins per octave and gaps in
   * every band constantly, and the method works.
   *
   * So the module is held to the range where its own assumption holds. That is
   * a statement about hiss, not a fudge: mains buzz has the hum comb and
   * impulsive damage has the click repairer, and neither of those is this.
   */
  std::vector<double> hiss_weight;

  /**
   * The live floor per profile band, written by the audio thread for the panel.
   *
   * A plain array rather than a published pair, and a torn read is acceptable
   * here in a way it is not for the EQ's coefficients: the worst case is one
   * band of a meter drawn from the previous frame, which is a pixel, against
   * the alternative of a second buffer and a swap for a picture that repaints
   * sixty times a second anyway.
   */
  std::vector<double> live_floor_db;

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
  std::atomic<void*> voice{nullptr};
  /**
   * The callback announces while it is using the published runtime.
   *
   * Model loading happens on the control thread. A plain pointer let that
   * thread delete the old ONNX session while the callback was still inside
   * it. The loader now publishes a complete replacement atomically and waits
   * for this count to return to zero before retiring the old one.
   */
  std::atomic<uint32_t> voice_readers{0};
  /** Rebuild a clean runtime on a source reset without mutating the live one. */
  std::string voice_model_path;
  std::string voice_runtime_path;

  /** Published for the panel; written by the audio thread, read by control. */
  std::atomic<double> reported_reduction_db{0.0};
  std::atomic<double> reported_floor_db{kDenoiseSilenceDb};
  std::atomic<uint32_t> reported_clicks{0};
  std::atomic<uint32_t> reported_voice_underruns{0};
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

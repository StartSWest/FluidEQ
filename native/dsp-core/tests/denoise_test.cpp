/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Denoise, held to properties. Native-only, so there is no twin to match.
 *
 * Every assertion that something was REMOVED is paired with a positive
 * control: the identical measurement with the module bypassed, which must
 * come out the other way. Without that pairing a module that returned silence,
 * or one that did nothing at all, passes a suite that looks thorough — the
 * separation packing bug shipped exactly that way, returning zero for every
 * input and satisfying a perfect-looking null test.
 */
#include "fluideq/denoise.h"

#include "fluideq/convolver.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdint>
#include <vector>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

constexpr double kPi = 3.14159265358979323846;
constexpr double kRate = 48000.0;
constexpr uint32_t kFrames = 512;

/** A deterministic white-noise source, so a failure can be reproduced. */
struct Noise {
  uint32_t state = 22222u;
  double next() {
    state = state * 1664525u + 1013904223u;
    return (static_cast<double>(state >> 8) / 8388608.0) - 1.0;
  }
};

FeqDenoiseSettings bypassed_modules() {
  FeqDenoiseSettings settings{};
  feq_denoise_settings_defaults(&settings);
  settings.enabled = 1;
  settings.hiss.enabled = 0;
  settings.hum.enabled = 0;
  settings.click.enabled = 0;
  settings.voice.enabled = 0;
  return settings;
}

/** Level of one frequency, by projection onto a whole number of cycles. */
double tone_level_db(const std::vector<float>& signal,
                     double hz,
                     uint32_t from,
                     uint32_t count) {
  double real = 0.0;
  double imaginary = 0.0;
  for (uint32_t i = 0; i < count; i += 1) {
    const double phase = 2.0 * kPi * hz * static_cast<double>(from + i) / kRate;
    real += signal[from + i] * std::cos(phase);
    imaginary += signal[from + i] * std::sin(phase);
  }
  const double magnitude =
      2.0 * std::sqrt(real * real + imaginary * imaginary) /
      static_cast<double>(count);
  return magnitude > 1e-12 ? 20.0 * std::log10(magnitude) : -240.0;
}

/**
 * Average power across a band, in dB.
 *
 * A single projection is the right instrument for a TONE and the wrong one for
 * noise: at one frequency a broadband signal gives a chi-square estimate with
 * two degrees of freedom, which scatters by several decibels run to run and
 * cannot tell a real 2 dB difference from its own variance. Thirty-two probes
 * spread across the band average that down to where a comparison means
 * something.
 */
double band_level_db(const std::vector<float>& signal,
                     double low,
                     double high,
                     uint32_t from,
                     uint32_t count) {
  constexpr uint32_t kProbes = 32;
  double sum = 0.0;
  for (uint32_t i = 0; i < kProbes; i += 1) {
    const double t = static_cast<double>(i) / static_cast<double>(kProbes - 1);
    const double db =
        tone_level_db(signal, low * std::pow(high / low, t), from, count);
    sum += std::pow(10.0, db / 10.0);
  }
  return 10.0 * std::log10(sum / static_cast<double>(kProbes));
}

double rms_db(const std::vector<float>& signal, uint32_t from, uint32_t count) {
  double sum = 0.0;
  for (uint32_t i = 0; i < count; i += 1) {
    sum += static_cast<double>(signal[from + i]) *
           static_cast<double>(signal[from + i]);
  }
  const double rms = std::sqrt(sum / static_cast<double>(count));
  return rms > 1e-12 ? 20.0 * std::log10(rms) : -240.0;
}

/** What the stage delays by, for a given configuration. */
uint32_t latency_of(const FeqDenoiseSettings& settings) {
  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);
  const uint32_t latency = feq_denoise_latency_frames(denoise);
  feq_denoise_destroy(denoise);
  return latency;
}

/** Run a signal through a configured stage and return what came out. */
std::vector<float> run(const FeqDenoiseSettings& settings,
                       const std::vector<float>& input,
                       const FeqNoiseProfile* profile) {
  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);
  if (profile != nullptr) {
    feq_denoise_set_profile(denoise, profile);
  }

  std::vector<float> left = input;
  std::vector<float> right = input;
  for (uint32_t at = 0; at + kFrames <= input.size(); at += kFrames) {
    float* channels[2] = {left.data() + at, right.data() + at};
    feq_denoise_process(denoise, channels, kFrames);
  }
  feq_denoise_destroy(denoise);
  return left;
}

/* -------------------------------------------------------------- adaptive -- */

/**
 * Does the live tracker actually find the floor, with no scan at all?
 *
 * The question this answers is "is Adaptive doing anything", and it cannot be
 * answered by listening: a tracker that never converges and a tracker that
 * converges correctly both leave the music intact and differ only in whether
 * the hiss goes. So it is measured — the same tone-over-noise as the scanned
 * test, with the profile withheld.
 *
 * It needs a LONG signal. Minimum statistics looks back a second and a half
 * before it has an estimate at all, so anything shorter measures the warm-up
 * rather than the tracker.
 */
void test_adaptive_finds_the_floor_without_a_scan() {
  const uint32_t length = kFrames * 700; /* about 7.5 seconds */
  const double tone_hz = 1000.0;
  const double noise_amplitude = 0.001;

  /*
   * The tone is GATED into notes, because that is what the method needs.
   *
   * Minimum statistics finds the floor by looking for the quietest the band
   * gets over its look-back. A note that stops gives it that; a tone held for
   * the whole file never does, and the tracker correctly concludes that the
   * quietest that band ever gets IS the tone. Held tones are the documented
   * limit of this mode and there is a separate test for it below — this one
   * asks whether the tracker works on material that behaves like music.
   *
   * Smoothly enveloped, since a hard gate is a click and the click repairer
   * and the spectral estimator would both have opinions about it.
   */
  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double t = static_cast<double>(i) / kRate;
    const double envelope = std::max(0.0, std::sin(2.0 * kPi * t * 1.25));
    const double tone =
        0.1 * envelope *
        std::sin(2.0 * kPi * tone_hz * static_cast<double>(i) / kRate);
    input[i] = static_cast<float>(tone + noise_amplitude * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  // No profile handed over at all, which is the point.
  const std::vector<float> processed = run(settings, input, nullptr);
  const std::vector<float> bypassed =
      run(bypassed_modules(), input, nullptr);

  // Measured in the last third, well past the tracker's warm-up.
  const uint32_t from = kFrames * 450;
  const uint32_t count = 48000;

  const double tone_in = tone_level_db(bypassed, tone_hz, from, count);
  const double tone_out = tone_level_db(processed, tone_hz, from, count);
  check(std::fabs(tone_out - tone_in) < 1.5,
        "adaptive: the tone survives without a scan");

  /*
   * The noise is measured as broadband RMS inside a GAP between notes, not as
   * a projection onto one frequency.
   *
   * A projection answers "how much energy is at exactly 7 kHz", which for
   * broadband noise is a tiny and very noisy quantity — it moved 2.7 dB while
   * the audible hiss moved far more. In a gap the signal is nothing but noise,
   * so its RMS is the hiss itself and the reading is the thing a listener is
   * actually judging.
   *
   * The envelope repeats at 1.25 Hz, so gaps sit in the second half of every
   * 0.8 s period; this lands in one late in the file.
   */
  const uint32_t gap_from = static_cast<uint32_t>(6.9 * kRate);
  const uint32_t gap_count = static_cast<uint32_t>(0.25 * kRate);
  const double floor_in = rms_db(bypassed, gap_from, gap_count);
  const double floor_out = rms_db(processed, gap_from, gap_count);
  check(floor_out < floor_in - 6.0,
        "adaptive: the hiss in a gap drops by more than 6 dB with no scan");

  /*
   * The tone assertion above IS the positive control for the floor one. A
   * module that simply attenuated everything would satisfy "the floor drops"
   * and fail "the tone survives", so the pair together says the tracker is
   * discriminating rather than merely turning things down.
   */
}

/**
 * The documented limit: a tone that never stops is read as noise.
 *
 * Not a defect, and recorded here so it is not rediscovered as one. Minimum
 * statistics estimates the floor as the quietest a band gets over its
 * look-back; a sustained organ note or synth pad held longer than that window
 * never gets quieter, so the tracker concludes the note is the floor and
 * removes it. That is inherent to the method, and it is the reason Scanned
 * exists — a whole-file measurement takes its percentile across the entire
 * track, where a note sustained through one section is not the quietest thing
 * in the file.
 *
 * Asserted rather than commented, because the day it changes is a day someone
 * needs to know the trade has moved.
 */
void test_adaptive_suppresses_an_endlessly_held_tone() {
  const uint32_t length = kFrames * 700;
  const double tone_hz = 1000.0;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    input[i] = static_cast<float>(
        0.1 * std::sin(2.0 * kPi * tone_hz * static_cast<double>(i) / kRate) +
        0.001 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  const std::vector<float> processed = run(settings, input, nullptr);
  const std::vector<float> bypassed = run(bypassed_modules(), input, nullptr);

  const uint32_t from = kFrames * 450;
  const double held_in = tone_level_db(bypassed, tone_hz, from, 48000);
  const double held_out = tone_level_db(processed, tone_hz, from, 48000);
  check(held_out < held_in - 12.0,
        "adaptive: a permanently held tone IS suppressed, as the method must");
}

/* -------------------------------------------------------------- transform -- */

/**
 * The 960-point transform, against a direct DFT and against itself.
 *
 * This exists because the voice module was calling the radix-2 FFT with 960
 * points. Radix-2 requires a power of two; 960 is not one, and the butterfly
 * stage read sixty-four doubles past the end of the buffer on every call. The
 * symptom was not a wrong spectrum — it was a smashed heap, a worker thread
 * that never returned from its first hop, and a module that looked like a
 * model doing nothing. A night went into ONNX Runtime, which was never
 * reached.
 *
 * So two assertions, and the second is the one that matters. A round trip
 * proves the pair is self-consistent, which a transform that returned its
 * input untouched would also satisfy. Only the comparison against a directly
 * evaluated DFT proves it computes the right thing.
 */
void test_arbitrary_size_transform() {
  constexpr uint32_t kSize = 960;

  Noise source;
  std::vector<double> real(kSize, 0.0);
  std::vector<double> imaginary(kSize, 0.0);
  for (uint32_t i = 0; i < kSize; i += 1) {
    real[i] = source.next();
    imaginary[i] = source.next();
  }
  const std::vector<double> real_in = real;
  const std::vector<double> imaginary_in = imaginary;

  FeqDft* plan = feq_dft_create(kSize);
  check(plan != nullptr, "transform: a 960-point plan can be built");
  if (plan == nullptr) {
    return;
  }

  feq_dft_in_place(plan, real.data(), imaginary.data(), 0);

  // Against the definition, at a handful of bins spread across the range.
  double worst = 0.0;
  const uint32_t probes[5] = {0, 1, 137, 480, 959};
  for (uint32_t p = 0; p < 5; p += 1) {
    const uint32_t k = probes[p];
    double sum_real = 0.0;
    double sum_imaginary = 0.0;
    for (uint32_t n = 0; n < kSize; n += 1) {
      const double angle = -2.0 * kPi * static_cast<double>(k) *
                           static_cast<double>(n) / static_cast<double>(kSize);
      const double c = std::cos(angle);
      const double s = std::sin(angle);
      sum_real += real_in[n] * c - imaginary_in[n] * s;
      sum_imaginary += real_in[n] * s + imaginary_in[n] * c;
    }
    worst = std::max(worst, std::fabs(real[k] - sum_real));
    worst = std::max(worst, std::fabs(imaginary[k] - sum_imaginary));
  }
  check(worst < 1e-6,
        "transform: 960 points match a directly evaluated DFT");

  // And back. The inverse is unnormalised, so the 1/N is applied here.
  feq_dft_in_place(plan, real.data(), imaginary.data(), 1);
  double drift = 0.0;
  for (uint32_t i = 0; i < kSize; i += 1) {
    drift = std::max(drift,
                     std::fabs(real[i] / kSize - real_in[i]));
    drift = std::max(drift,
                     std::fabs(imaginary[i] / kSize - imaginary_in[i]));
  }
  check(drift < 1e-9, "transform: forward then inverse returns the input");
  feq_dft_destroy(plan);

  /*
   * The positive control, and the assertion that would have caught the bug
   * outright: the radix-2 transform must REFUSE a size that is not a power of
   * two rather than run off the end of the buffer.
   */
  std::vector<double> guard_real(kSize, 1.0);
  std::vector<double> guard_imaginary(kSize, 0.0);
  feq_fft_in_place(guard_real.data(), guard_imaginary.data(), kSize, 0);
  bool untouched = true;
  for (uint32_t i = 0; i < kSize; i += 1) {
    if (guard_real[i] != 1.0 || guard_imaginary[i] != 0.0) {
      untouched = false;
    }
  }
  check(untouched,
        "transform: POSITIVE CONTROL, the radix-2 FFT refuses 960 points");
}

/* ----------------------------------------------------------------- clicks -- */

/**
 * Drums are not damage.
 *
 * The click test beside this one uses a 440 Hz sine as its clean material,
 * which a linear extrapolator predicts perfectly — so it says nothing at all
 * about the case the module's own header calls the hard one. Measured on kick,
 * snare and hats instead, the repairer performed three thousand repairs on
 * material containing no damage whatsoever and removed energy ten decibels
 * below the music. A cymbal is close to noise, so almost every sample of it is
 * unpredicted; the runs were short, so the width guard passed them; and the
 * module sat there interpolating two samples at a time, which is a low-pass
 * filter on a transient.
 *
 * So the assertion is on the RESIDUAL — what the module took out of clean
 * percussion, against the percussion itself — because a repair count says
 * nothing about how much was actually removed.
 */
void test_click_leaves_percussion_alone() {
  const uint32_t length = kFrames * 500;

  Noise source;
  std::vector<float> drums(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double t = static_cast<double>(i) / kRate;
    const double in_beat = std::fmod(t, 0.5);       /* 120 bpm */
    const double in_bar = std::fmod(t, 1.0);
    const double in_eighth = std::fmod(t, 0.25);
    const double kick =
        0.7 * std::exp(-in_beat * 45.0) * std::sin(2.0 * kPi * 55.0 * in_beat);
    const double snare =
        in_bar >= 0.5 ? 0.5 * std::exp(-(in_bar - 0.5) * 60.0) * source.next()
                      : 0.0;
    const double hat = 0.25 * std::exp(-in_eighth * 400.0) * source.next();
    drums[i] = static_cast<float>(kick + snare + hat + 0.0005 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.click.enabled = 1;
  settings.click.sensitivity = 0.5;
  settings.click.max_repair_samples = 32;

  const std::vector<float> processed = run(settings, drums, nullptr);

  // Aligned by the delay the module reports, or the difference measured is
  // dominated by the 47-sample shift rather than by anything removed.
  const uint32_t latency = latency_of(settings);
  std::vector<float> residual(length - latency, 0.0f);
  for (uint32_t i = 0; i + latency < length; i += 1) {
    residual[i] = static_cast<float>(static_cast<double>(processed[i + latency]) -
                                     static_cast<double>(drums[i]));
  }

  const uint32_t from = kFrames * 350;
  const uint32_t count = 48000;
  const double music = rms_db(drums, from, count);
  const double removed = rms_db(residual, from, count);
  check(removed < music - 25.0,
        "click: what it takes out of clean drums is 25 dB under them");

  /*
   * The positive control, and it has to be placed carefully.
   *
   * Clicks go in the QUIET part of each beat — 0.44 s into a 0.5 s bar, after
   * the kick has decayed 45 dB and the last hat 78 dB. That is where a tick is
   * audible and where a repairer has to work. Injecting them on top of a cymbal
   * would measure nothing: a click under a crash is masked whether it is
   * repaired or not, and refusing to repair there is correct behaviour.
   */
  std::vector<float> clicked = drums;
  uint32_t injected = 0;
  for (double t = 0.44; t < static_cast<double>(length) / kRate; t += 0.5) {
    const uint32_t at = static_cast<uint32_t>(t * kRate);
    if (at + 4 < length) {
      clicked[at] = 0.95f;
      clicked[at + 1] = -0.85f;
      injected += 1;
    }
  }

  const auto repairs_in = [&](const std::vector<float>& signal) {
    FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
    feq_denoise_configure(denoise, &settings);
    std::vector<float> left = signal;
    std::vector<float> right = signal;
    for (uint32_t at = 0; at + kFrames <= length; at += kFrames) {
      float* channels[2] = {left.data() + at, right.data() + at};
      feq_denoise_process(denoise, channels, kFrames);
    }
    FeqDenoiseReport report{};
    feq_denoise_report(denoise, &report);
    feq_denoise_destroy(denoise);
    return report.clicks_repaired;
  };

  // Two channels are fed the same signal, so each injected tick counts twice.
  const uint32_t found = repairs_in(clicked) - repairs_in(drums);
  check(found >= injected * 2,
        "click: POSITIVE CONTROL, every tick in the gaps is still found");
}

/* ------------------------------------------------- what the stage may touch */

/**
 * A sustained bass note survives; a sustained midrange note does not.
 *
 * Both tones are held for the whole file, so minimum statistics reads BOTH as
 * noise — that is the documented limit tested above. The only thing separating
 * them is frequency, which is exactly what makes this a paired measurement
 * rather than two loose assertions: a stage that had simply stopped working
 * would leave both alone, and one with no frequency weighting would take both.
 *
 * The reason the weighting exists is in `hiss_weight`: every floor estimator
 * here finds noise by asking what the quietest thing a band ever does is, and
 * bass never goes quiet, so it answers "the bass".
 */
void test_bass_is_out_of_reach() {
  // Twelve and a half seconds. The measurement below runs to 12.0 s, and the
  // buffer has to outlast it — at 1100 blocks it did not, and the read past
  // the end was an access violation rather than a failed assertion.
  const uint32_t length = kFrames * 1200;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double t = static_cast<double>(i) / kRate;
    input[i] = static_cast<float>(0.1 * std::sin(2.0 * kPi * 50.0 * t) +
                                  0.1 * std::sin(2.0 * kPi * 500.0 * t) +
                                  0.001 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  const std::vector<float> processed = run(settings, input, nullptr);
  const std::vector<float> bypassed = run(bypassed_modules(), input, nullptr);

  // The last two seconds, long past the tracker's warm-up.
  const uint32_t from = static_cast<uint32_t>(kRate * 10.0);
  const uint32_t count = static_cast<uint32_t>(kRate * 2.0);

  const double bass = tone_level_db(processed, 50.0, from, count) -
                      tone_level_db(bypassed, 50.0, from, count);
  const double mid = tone_level_db(processed, 500.0, from, count) -
                     tone_level_db(bypassed, 500.0, from, count);

  check(std::fabs(bass) < 0.5, "bass: a held 50 Hz note is left alone");
  check(mid < -3.0,
        "bass: POSITIVE CONTROL, the same held note at 500 Hz is suppressed");
}

/**
 * The same protection, in Scanned — where the bad estimate is the SCAN's.
 *
 * Adaptive eats bass because a 1.5-second minimum never sees the band go
 * quiet. Scanned eats it for the same reason one level up: the scan takes the
 * tenth percentile across the whole file, and on a track where the bass plays
 * throughout, the tenth percentile of the 50 Hz band is still the bass. Two
 * different estimators, one shared assumption, one shared failure.
 *
 * So the profile here is deliberately the kind a real scan produces on
 * gapless material — the low bands overstated by 40 dB, far above the actual
 * noise in the signal — and the question is whether the stage honours it.
 * Below the taper it must not, above it must, and the pairing is what
 * separates "protected" from "doing nothing at all".
 *
 * This is also the test that says the rest of the chain is shared. The gain
 * this runs through is the same log-spectral estimator, the same frequency
 * smoothing and the same whitened limit as the adaptive tests above; only the
 * source of the noise estimate differs.
 */
void test_bass_is_out_of_reach_when_scanned() {
  const uint32_t length = kFrames * 400;
  const double noise_amplitude = 0.001;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double t = static_cast<double>(i) / kRate;
    input[i] = static_cast<float>(0.1 * std::sin(2.0 * kPi * 50.0 * t) +
                                  0.1 * std::sin(2.0 * kPi * 500.0 * t) +
                                  noise_amplitude * source.next());
  }

  const double variance = noise_amplitude * noise_amplitude / 3.0;
  const double density_db = 10.0 * std::log10(variance / (kRate * 0.5));

  /*
   * Below 800 Hz the profile claims a floor far above anything in the signal.
   *
   * Deliberately past what a scan would ever report, because the assertion is
   * about REACH and not about calibration: an overstatement that only just
   * bit would leave the two halves of this test separated by a threshold
   * rather than by the taper. The first attempt used a plausible +40 dB and
   * the control did not fire — a sine puts its power in ONE bin while a
   * density is spread across the band, so the tone sits some seventy decibels
   * above the per-bin noise power and forty never reached it. That is a real
   * property of the units and worth stating rather than tuning around.
   */
  FeqNoiseProfile profile{};
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    const bool low = feq_denoise_band_hz(band) < 800.0;
    profile.bands_db[band] = low ? -30.0 : density_db;
  }
  profile.floor_dbfs = 20.0 * std::log10(std::sqrt(variance));
  profile.hum_hz = 0.0;
  profile.hum_partial_count = 0;

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_SCANNED;

  const std::vector<float> processed = run(settings, input, &profile);
  const std::vector<float> bypassed = run(bypassed_modules(), input, &profile);

  const uint32_t from = kFrames * 60;
  const uint32_t count = 48000;

  const double bass = tone_level_db(processed, 50.0, from, count) -
                      tone_level_db(bypassed, 50.0, from, count);
  const double mid = tone_level_db(processed, 500.0, from, count) -
                     tone_level_db(bypassed, 500.0, from, count);

  check(std::fabs(bass) < 0.5,
        "scanned: an overstated bass band cannot reach the bass");
  check(mid < -6.0,
        "scanned: POSITIVE CONTROL, the same overstatement at 500 Hz bites");
}

/**
 * What is LEFT is flatter than what came in.
 *
 * Whitening's whole claim. The input floor is tilted hard — brown-ish noise,
 * far more energy low than high — and after processing the residue must be
 * closer to flat than it started, because each bin is aimed at a common
 * residual level rather than at a common attenuation.
 *
 * Measured above the frequency weighting's taper so this reads the whitening
 * and not the bass protection, and paired with the bypassed run, which must
 * still show the original tilt: without that control a stage that had merely
 * gone quiet everywhere would also look "flat".
 *
 * The REDUCTION LIMIT has to be shallow for this to measure anything, and that
 * is a property of the feature rather than a convenience. Whitening shapes the
 * limit; the limit only has an effect where it actually binds, and at -24 dB
 * the estimator's own gain on noise-only material already sits below it — so
 * the shaped floor is never reached and the residue keeps its tilt. Measured:
 * 1.4 dB of flattening at -24, 4.2 at -12, 9.3 at -6. A test written at -24
 * would have been testing nothing and would have looked like a broken feature.
 */
void test_whitening_flattens_the_residue() {
  const uint32_t length = kFrames * 400;

  // A one-pole low-pass on white noise: a 6 dB per octave tilt, so the 500 Hz
  // region sits far above the 8 kHz region.
  Noise source;
  std::vector<float> input(length, 0.0f);
  double memory = 0.0;
  for (uint32_t i = 0; i < length; i += 1) {
    memory = 0.98 * memory + 0.02 * source.next();
    input[i] = static_cast<float>(6.0 * memory);
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -6.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  const std::vector<float> processed = run(settings, input, nullptr);
  const std::vector<float> bypassed = run(bypassed_modules(), input, nullptr);

  const uint32_t from = kFrames * 250;
  const uint32_t count = 48000;

  // Two bands, both well above the taper, three octaves apart. The tilt is the
  // difference between them; flattening is that difference shrinking.
  const double tilt_in = band_level_db(bypassed, 500.0, 700.0, from, count) -
                         band_level_db(bypassed, 4000.0, 5600.0, from, count);
  const double tilt_out = band_level_db(processed, 500.0, 700.0, from, count) -
                          band_level_db(processed, 4000.0, 5600.0, from, count);

  check(tilt_out < tilt_in - 4.0,
        "whitening: the residue is flatter than the noise that entered");
  check(tilt_in > 12.0,
        "whitening: POSITIVE CONTROL, the untouched noise really is tilted");
}

/**
 * The Smoothing dial reaches the estimator, and in the direction it claims.
 *
 * Smoothing is the decision-directed constant: how much of the previous
 * frame's decision is carried into this one. Higher means a longer memory, so
 * the estimate wanders further and more slowly over stationary material, which
 * shows up as the residual bed drifting in level. Lower means it tracks the
 * instantaneous evidence, so the bed sits still and the flicker moves into the
 * individual bins instead.
 *
 * That drift is the measurable consequence, and it is measured over a
 * noise-only stretch where nothing else can move: 0.43 dB of spread at the
 * bottom of the dial, 1.52 dB at the top, monotone in between.
 *
 * The first attempt at this test asserted that processing adds no level
 * fluctuation at all, and both halves of that were wrong. Broadband RMS
 * averages over a thousand bins, so it cannot see per-bin flicker — the actual
 * musical-noise phenomenon — and no denoiser suppressing by twenty decibels
 * leaves a residue as steady as its input. It was measuring the wrong thing
 * and demanding the impossible of it.
 */
void test_smoothing_reaches_the_estimator() {
  const uint32_t length = kFrames * 600;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    input[i] = static_cast<float>(0.002 * source.next());
  }

  // Twenty-millisecond windows: short enough to catch a drift, long enough
  // that a single window is a level rather than a sample.
  const uint32_t window = static_cast<uint32_t>(kRate * 0.02);
  const uint32_t from = kFrames * 400;
  const uint32_t windows = 100;

  auto spread_db = [&](const std::vector<float>& signal) {
    double sum = 0.0;
    double squares = 0.0;
    for (uint32_t w = 0; w < windows; w += 1) {
      const double level = rms_db(signal, from + w * window, window);
      sum += level;
      squares += level * level;
    }
    const double mean = sum / static_cast<double>(windows);
    return std::sqrt(squares / static_cast<double>(windows) - mean * mean);
  };

  auto spread_at = [&](double smoothing) {
    FeqDenoiseSettings settings = bypassed_modules();
    settings.hiss.enabled = 1;
    settings.hiss.amount = 1.0;
    settings.hiss.floor_db = -30.0;
    settings.hiss.smoothing = smoothing;
    settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
    return spread_db(run(settings, input, nullptr));
  };

  const double low = spread_at(0.0);
  const double middle = spread_at(0.5);
  const double high = spread_at(1.0);

  check(low < middle && middle < high,
        "smoothing: the dial moves the estimator's memory, monotonically");
  check(high - low > 0.5,
        "smoothing: and by an amount that is not rounding");

  // The positive control the pair above needs: the measurement itself is not
  // reading a constant. An untouched noise bed has its own small spread, and
  // every reading here must stand above it or the dial is being credited with
  // the meter's own noise.
  const double untouched = spread_db(run(bypassed_modules(), input, nullptr));
  check(low > untouched,
        "smoothing: POSITIVE CONTROL, even the steadiest setting moves it");
}

/**
 * After a long stretch of nothing but noise, the music comes back.
 *
 * The decision-directed recursion is a feedback loop, and a bin sitting under
 * the noise estimate feeds only itself: its a priori SNR is last frame's times
 * alpha, decaying with a fixed point at zero. Left unbounded, every such bin
 * winds down together and the stage drains a track away over a few seconds
 * with no way back except a seek, which resets the loop.
 *
 * So the recursion is floored, and this is the assertion that says so. Eight
 * seconds of noise only — every bin under the estimate, the worst case for the
 * loop — and then a tone, which must return to its proper level promptly
 * rather than staying suppressed.
 */
void test_recovers_after_a_long_quiet_stretch() {
  const uint32_t length = kFrames * 1000;
  const uint32_t tone_from = static_cast<uint32_t>(kRate * 8.0);
  const double tone_hz = 2000.0;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double tone =
        i >= tone_from
            ? 0.1 * std::sin(2.0 * kPi * tone_hz * static_cast<double>(i) /
                             kRate)
            : 0.0;
    input[i] = static_cast<float>(tone + 0.002 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  const std::vector<float> processed = run(settings, input, nullptr);
  const std::vector<float> bypassed = run(bypassed_modules(), input, nullptr);

  // A quarter of a second, starting a tenth of a second after the tone does.
  // Long enough to measure, early enough that a stage which needed seconds to
  // climb back would fail.
  const uint32_t from = tone_from + static_cast<uint32_t>(kRate * 0.1);
  const uint32_t count = static_cast<uint32_t>(kRate * 0.25);

  const double recovered = tone_level_db(processed, tone_hz, from, count) -
                           tone_level_db(bypassed, tone_hz, from, count);
  check(recovered > -1.5,
        "recovery: a tone after eight seconds of noise returns within 1.5 dB");

  /*
   * The positive control the assertion above needs: the stage really was
   * suppressing during that stretch, so "it recovered" is a statement about
   * the loop climbing back rather than about it never having engaged.
   *
   * Measured over a window that ENDS before the tone starts. At block 700 it
   * did not — it ran 22400 samples past the tone's entry, and the tone is 34 dB
   * above the noise, so the window read the tone and reported no suppression
   * at all. The measurement looked like a broken denoiser and was a broken
   * measurement.
   */
  const double during = rms_db(processed, kFrames * 600, 48000) -
                        rms_db(bypassed, kFrames * 600, 48000);
  check(during < -6.0,
        "recovery: POSITIVE CONTROL, the noise-only stretch really was cut");
}

/* ------------------------------------------------------------------ hiss -- */

/**
 * A tone over noise: the tone must survive, the noise must not.
 *
 * Both halves matter. A module that removes the noise and the tone is a gate,
 * not a denoiser, and it would pass a test that only measured the floor.
 */
void test_hiss() {
  const uint32_t length = kFrames * 200;
  const double tone_hz = 1000.0;
  const double tone_amplitude = 0.1;   /* -20 dBFS */
  const double noise_amplitude = 0.001; /* about -60 dBFS */

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double tone =
        tone_amplitude *
        std::sin(2.0 * kPi * tone_hz * static_cast<double>(i) / kRate);
    input[i] = static_cast<float>(tone + noise_amplitude * source.next());
  }

  // The profile is a density: power per hertz. White noise of amplitude a has
  // variance a^2/3 spread over the Nyquist band, and stating it that way is
  // what makes a floor measured at one sample rate mean the same at another.
  const double variance = noise_amplitude * noise_amplitude / 3.0;
  const double density_db = 10.0 * std::log10(variance / (kRate * 0.5));
  FeqNoiseProfile profile{};
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    profile.bands_db[band] = density_db;
  }
  profile.floor_dbfs = 20.0 * std::log10(std::sqrt(variance));
  profile.hum_hz = 0.0;
  profile.hum_partial_count = 0;

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 1.0;
  settings.hiss.floor_db = -30.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_SCANNED;

  const std::vector<float> processed = run(settings, input, &profile);

  FeqDenoiseSettings control = bypassed_modules();
  const std::vector<float> bypassed = run(control, input, &profile);

  // Measured well past the window's warm-up, over a whole number of cycles of
  // the tone so the projection does not leak its own skirt into the residual.
  const uint32_t from = kFrames * 20;
  const uint32_t count = 48000;

  const double tone_in = tone_level_db(bypassed, tone_hz, from, count);
  const double tone_out = tone_level_db(processed, tone_hz, from, count);
  check(std::fabs(tone_out - tone_in) < 1.0,
        "hiss: the 1 kHz tone survives within 1 dB");

  // The floor is measured away from the tone, at a frequency the noise owns.
  const double floor_in = tone_level_db(bypassed, 7000.0, from, count);
  const double floor_out = tone_level_db(processed, 7000.0, from, count);
  check(floor_out < floor_in - 6.0,
        "hiss: the noise floor at 7 kHz drops by more than 6 dB");

  // The positive control. Without it, "found nothing" and "removed
  // everything" are the same result.
  check(!(floor_in < floor_in - 6.0),
        "hiss: POSITIVE CONTROL, the bypassed run fails the floor assertion");
}

/* ------------------------------------------------------------------- hum -- */

void test_hum() {
  const uint32_t length = kFrames * 120;
  const double hum_hz = 50.2;

  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double time = static_cast<double>(i) / kRate;
    double sample = 0.05 * std::sin(2.0 * kPi * hum_hz * time);
    sample += 0.02 * std::sin(2.0 * kPi * hum_hz * 2.0 * time);
    sample += 0.1 * std::sin(2.0 * kPi * 1000.0 * time);
    input[i] = static_cast<float>(sample + 0.0002 * source.next());
  }

  // Measured partials, at the frequency they were actually found at. The
  // module is expected to use these rather than exact multiples of 50.
  FeqNoiseProfile profile{};
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    profile.bands_db[band] = -90.0;
  }
  profile.floor_dbfs = -80.0;
  profile.hum_hz = hum_hz;
  profile.hum_partial_count = 2;
  profile.hum_partial_hz[0] = hum_hz;
  profile.hum_partial_excess_db[0] = 40.0;
  profile.hum_partial_hz[1] = hum_hz * 2.0;
  profile.hum_partial_excess_db[1] = 30.0;

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hum.enabled = 1;
  settings.hum.mode = FEQ_DENOISE_HUM_AUTO;
  settings.hum.harmonics = 4;
  settings.hum.depth_db = 30.0;
  settings.hum.quality = 30.0;

  const std::vector<float> processed = run(settings, input, &profile);
  const std::vector<float> bypassed =
      run(bypassed_modules(), input, &profile);

  const uint32_t from = kFrames * 20;
  const uint32_t count = 48000;

  const double hum_in = tone_level_db(bypassed, hum_hz, from, count);
  const double hum_out = tone_level_db(processed, hum_hz, from, count);
  check(hum_out < hum_in - 20.0,
        "hum: the measured fundamental drops by more than 20 dB");
  check(!(hum_in < hum_in - 20.0),
        "hum: POSITIVE CONTROL, the bypassed run fails that assertion");

  const double music_in = tone_level_db(bypassed, 1000.0, from, count);
  const double music_out = tone_level_db(processed, 1000.0, from, count);
  check(std::fabs(music_out - music_in) < 0.5,
        "hum: the 1 kHz tone is untouched");

  // The documented counter-case, asserted rather than left to be discovered.
  // A sustained bass note at the fundamental IS attenuated, and the depth
  // limit is what keeps that from being a hole.
  check(hum_out > hum_in - 45.0,
        "hum: a 30 dB notch is a notch and not a null");
}

/* ----------------------------------------------------------------- click -- */

void test_click() {
  const uint32_t length = kFrames * 80;
  const uint32_t click_every = 4096;

  Noise source;
  std::vector<float> clean(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double time = static_cast<double>(i) / kRate;
    clean[i] = static_cast<float>(
        0.2 * std::sin(2.0 * kPi * 440.0 * time) + 0.001 * source.next());
  }

  std::vector<float> clicked = clean;
  uint32_t injected = 0;
  for (uint32_t i = click_every; i + 4 < length; i += click_every) {
    clicked[i] = 0.9f;
    clicked[i + 1] = -0.8f;
    injected += 1;
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.click.enabled = 1;
  settings.click.sensitivity = 0.5;
  settings.click.max_repair_samples = 32;

  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);
  std::vector<float> left = clicked;
  std::vector<float> right = clicked;
  for (uint32_t at = 0; at + kFrames <= length; at += kFrames) {
    float* channels[2] = {left.data() + at, right.data() + at};
    feq_denoise_process(denoise, channels, kFrames);
  }
  FeqDenoiseReport report{};
  feq_denoise_report(denoise, &report);
  feq_denoise_destroy(denoise);

  // Two channels are fed the same signal, so each impulse is counted twice.
  check(report.clicks_repaired >= injected * 2 * 9 / 10,
        "click: at least nine tenths of the injected impulses are repaired");

  // The null test: clean material must be left alone. Its positive control is
  // the run above, which proves the detector is not simply switched off.
  FeqDenoise* quiet = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(quiet, &settings);
  std::vector<float> clean_left = clean;
  std::vector<float> clean_right = clean;
  for (uint32_t at = 0; at + kFrames <= length; at += kFrames) {
    float* channels[2] = {clean_left.data() + at, clean_right.data() + at};
    feq_denoise_process(quiet, channels, kFrames);
  }
  FeqDenoiseReport clean_report{};
  feq_denoise_report(quiet, &clean_report);
  feq_denoise_destroy(quiet);

  check(clean_report.clicks_repaired == 0,
        "click: clean material produces no repairs at all");
  check(report.clicks_repaired > clean_report.clicks_repaired,
        "click: POSITIVE CONTROL, the clicked run repairs more than the clean");
}

/* ---------------------------------------------------------------- stage -- */

void test_bypass_is_exact() {
  const uint32_t length = kFrames * 20;
  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    input[i] = static_cast<float>(0.3 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.enabled = 0;
  settings.hiss.enabled = 1;
  settings.hum.enabled = 1;
  settings.click.enabled = 1;

  const std::vector<float> out = run(settings, input, nullptr);
  bool identical = true;
  for (uint32_t i = 0; i < length; i += 1) {
    if (out[i] != input[i]) {
      identical = false;
      break;
    }
  }
  check(identical, "stage: disabled is bit-identical passthrough");
}

/**
 * Isolate has to be the actual residual, not a reconstruction of it.
 *
 * Kept plus removed must equal the input, because that is the property that
 * makes the control worth trusting: what you hear in Isolate is exactly what
 * is missing from the audio.
 */
void test_isolate_is_the_difference() {
  const uint32_t length = kFrames * 60;
  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double time = static_cast<double>(i) / kRate;
    input[i] = static_cast<float>(0.2 * std::sin(2.0 * kPi * 700.0 * time) +
                                  0.002 * source.next());
  }

  FeqDenoiseSettings kept = bypassed_modules();
  kept.hiss.enabled = 1;
  kept.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  FeqDenoiseSettings removed = kept;
  removed.isolate = 1;

  const std::vector<float> a = run(kept, input, nullptr);
  const std::vector<float> b = run(removed, input, nullptr);

  /*
   * Against the input DELAYED by what the stage adds, not against the input.
   *
   * The stage delays everything it passes, so the signal the two outputs sum
   * back to is the one that entered `latency` samples ago. Comparing against
   * `input[i]` instead is what this assertion used to do, and it passed only
   * because Isolate was making the same mistake in the other direction —
   * subtracting an undelayed dry from a delayed wet. Two errors that cancel in
   * a sum, and a comb filter left on the output.
   */
  const uint32_t latency = latency_of(kept);
  check(latency > 0, "isolate: the configuration under test really does delay");

  double worst = 0.0;
  for (uint32_t i = kFrames * 10; i < length; i += 1) {
    worst = std::max(worst, std::fabs(static_cast<double>(a[i]) +
                                      static_cast<double>(b[i]) -
                                      static_cast<double>(input[i - latency])));
  }
  check(worst < 1e-6,
        "isolate: kept plus removed reconstructs the delayed input");
}

/**
 * Isolate with nothing being removed must be SILENT.
 *
 * This is the assertion that was missing, and its absence let a real defect
 * ship. The test above — kept plus removed equals the input — is
 * `x + (y - x) == y`, true by construction however wrong either term is, so it
 * passed while Isolate emitted a comb-filtered copy of the music: it was
 * subtracting the UNDELAYED input from the DELAYED output, and a signal minus
 * a shifted copy of itself at sixteen milliseconds is a slapback. It was
 * reported on the first real listen as sounding like a chamber effect, which
 * is precisely what it had been turned into.
 *
 * With every module bypassed the wet path is the dry path, so the difference
 * must be zero. No algebra makes that true by accident: it is false for any
 * misalignment at all.
 */
/**
 * The delay the stage REPORTS must be the delay it actually adds.
 *
 * Measured with an impulse, because this was got wrong by reasoning: the
 * spectral module's latency was derived as a window less a hop and is in fact
 * a whole window. Isolate found it first — a residual taken against a
 * mis-stated delay is a comb filter — but the number matters well beyond this
 * stage. `feq_chain_latency_frames` sums it, and a deck handoff aligns the two
 * decks against that sum, so a stage understating its delay puts every
 * crossfade out by the difference with nothing in the audio to point at it.
 *
 * The impulse also proves the transform reconstructs: unit amplitude and unit
 * energy out means the analysis and synthesis windows really do sum to one at
 * this hop, so a failure here is the delay and not the arithmetic.
 */
/** Every module's real delay against what it claims, one configuration each. */
void test_every_module_reports_its_real_delay() {
  const uint32_t length = kFrames * 40;

  struct Case {
    const char* what;
    FeqDenoiseSettings settings;
  };

  FeqDenoiseSettings click_only = bypassed_modules();
  click_only.click.enabled = 1;

  FeqDenoiseSettings hum_only = bypassed_modules();
  hum_only.hum.enabled = 1;

  FeqDenoiseSettings hiss_only = bypassed_modules();
  hiss_only.hiss.enabled = 1;
  hiss_only.hiss.amount = 0.0;
  hiss_only.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  // The shipped defaults, which is the configuration a listener actually
  // meets and the one the stack's delays have to add up in.
  FeqDenoiseSettings all_on = hiss_only;
  all_on.click.enabled = 1;
  all_on.hum.enabled = 1;

  const Case cases[] = {
      {"click alone", click_only},
      {"hum alone", hum_only},
      {"hiss alone", hiss_only},
      {"the shipped defaults", all_on},
  };

  /*
   * A chirp, correlated — NOT an impulse.
   *
   * An impulse is a click, and the click repairer duly removes it: probing
   * that module with one measures how well it works, not how long it takes.
   * A sweep has no impulsive content for it to find and, unlike a steady tone,
   * correlates to a single unambiguous offset rather than to every multiple of
   * a period.
   */
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double t = static_cast<double>(i) / kRate;
    const double sweep = 120.0 + (4800.0 - 120.0) * t * 0.5;
    input[i] = static_cast<float>(0.3 * std::sin(2.0 * kPi * sweep * t));
  }

  for (const Case& item : cases) {
    const std::vector<float> out = run(item.settings, input, nullptr);

    // Correlated over a span well clear of both the warm-up and the tail.
    const uint32_t from = kFrames * 16;
    const uint32_t count = kFrames * 12;
    uint32_t measured = 0;
    double best = -1.0;
    for (uint32_t shift = 0; shift <= 4096; shift += 1) {
      double sum = 0.0;
      for (uint32_t i = 0; i < count; i += 1) {
        sum += static_cast<double>(out[from + i]) *
               static_cast<double>(input[from + i - shift]);
      }
      if (sum > best) {
        best = sum;
        measured = shift;
      }
    }
    const uint32_t reported = latency_of(item.settings);
    char label[160];
    std::snprintf(label, sizeof(label),
                  "latency: %s delays %u and reports %u", item.what, measured,
                  reported);
    check(measured == reported, label);
  }
}

void test_reported_latency_is_the_real_delay() {
  const uint32_t length = kFrames * 40;
  std::vector<float> input(length, 0.0f);
  input[kFrames * 4] = 1.0f;

  FeqDenoiseSettings settings = bypassed_modules();
  settings.hiss.enabled = 1;
  settings.hiss.amount = 0.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;

  const std::vector<float> out = run(settings, input, nullptr);
  uint32_t peak = 0;
  double best = 0.0;
  double energy = 0.0;
  for (uint32_t i = 0; i < length; i += 1) {
    const double a = std::fabs(static_cast<double>(out[i]));
    energy += a * a;
    if (a > best) {
      best = a;
      peak = i;
    }
  }
  const uint32_t measured = peak - kFrames * 4;
  const uint32_t reported = latency_of(settings);
  check(measured == reported,
        "latency: the impulse comes out where the stage says it will");
  check(best > 0.99 && best < 1.01,
        "latency: the transform reconstructs at unit amplitude");
  check(energy > 0.99 && energy < 1.01,
        "latency: and at unit energy, so a failure above is the delay");
}

void test_isolate_is_silent_when_nothing_is_removed() {
  const uint32_t length = kFrames * 60;
  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    const double time = static_cast<double>(i) / kRate;
    input[i] = static_cast<float>(0.25 * std::sin(2.0 * kPi * 700.0 * time) +
                                  0.05 * source.next());
  }

  /*
   * The spectral module ON, at zero amount: it runs, it delays, and its gain
   * is unity in every bin, so it removes nothing.
   *
   * That combination is the whole point. Bypassing every module instead makes
   * the correct latency zero, so a misaligned Isolate and a correct one agree
   * and the test proves nothing — which is exactly what the first version of
   * this did, passing against the very bug it was written for. A module that
   * delays while removing nothing is the only configuration where "aligned"
   * and "not aligned" give different answers.
   */
  FeqDenoiseSettings settings = bypassed_modules();
  settings.isolate = 1;
  settings.hiss.enabled = 1;
  settings.hiss.amount = 0.0;
  settings.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
  check(latency_of(settings) > 0,
        "isolate: the silence case is a configuration that really delays");

  const std::vector<float> removed = run(settings, input, nullptr);

  double worst = 0.0;
  for (uint32_t i = kFrames * 8; i < length; i += 1) {
    worst = std::max(worst, std::fabs(static_cast<double>(removed[i])));
  }
  check(worst < 1e-5, "isolate: emits nothing when nothing is removed");

  /*
   * The positive control. With a module actually working the same measurement
   * must become clearly non-zero — otherwise "silent" would also be satisfied
   * by an Isolate that had stopped emitting anything at all, which is the one
   * other explanation for a quiet result.
   *
   * Driven from a MEASURED profile rather than the adaptive tracker. The
   * tracker needs a second and a half to converge and this signal is two
   * thirds of one, so an adaptive control removes nothing and fails for a
   * reason that has nothing to do with what is being tested.
   */
  const double variance = 0.05 * 0.05 / 3.0;
  FeqNoiseProfile profile{};
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    profile.bands_db[band] = 10.0 * std::log10(variance / (kRate * 0.5));
  }
  profile.floor_dbfs = 20.0 * std::log10(std::sqrt(variance));

  FeqDenoiseSettings working = settings;
  working.hiss.enabled = 1;
  working.hiss.amount = 1.0;
  working.profile_source = FEQ_DENOISE_PROFILE_SCANNED;
  const std::vector<float> real = run(working, input, &profile);

  double loudest = 0.0;
  for (uint32_t i = kFrames * 20; i < length; i += 1) {
    loudest = std::max(loudest, std::fabs(static_cast<double>(real[i])));
  }
  check(loudest > 1e-4,
        "isolate: POSITIVE CONTROL, a working module gives it something");
}

/**
 * The profile's band centres must agree with the TypeScript side exactly.
 *
 * A profile interpolated onto the wrong centres subtracts the wrong amount at
 * every frequency and still looks like a plot of a noise floor, so this checks
 * the derivation rather than trusting that both sides wrote 0.25 down.
 */
void test_band_centres() {
  const double first = feq_denoise_band_hz(0);
  const double last = feq_denoise_band_hz(FEQ_DENOISE_PROFILE_BANDS - 1);
  // Centres, so the first sits half a band above the span's low edge and the
  // last half a band below its high edge — 21.8 Hz and 18.3 kHz, not 20 and
  // 20k. Asserted against the derivation rather than against round numbers.
  const double half_band = std::pow(2.0, 0.5 * std::log2(20000.0 / 20.0) /
                                             FEQ_DENOISE_PROFILE_BANDS);
  check(std::fabs(first - 20.0 * half_band) < 1e-9,
        "profile: the first band centre is half a band above 20 Hz");
  check(std::fabs(last - 20000.0 / half_band) < 1e-6,
        "profile: the last band centre is half a band below 20 kHz");

  std::vector<double> bands(FEQ_DENOISE_PROFILE_BANDS, -60.0);
  bands[0] = -40.0;
  const double below = feq_denoise_profile_level_at(bands.data(), 5.0);
  check(std::fabs(below - (-40.0)) < 1e-9,
        "profile: below the first centre the nearest band is held flat");
}

/* ----------------------------------------------------------------- voice -- */

/**
 * The module with no model, which is the shipped state and not an error path.
 *
 * The weights are a download the user has not necessarily made, so "asked for
 * but unavailable" is ordinary. What must never happen is the module silently
 * eating the audio, or reporting itself as running, or claiming a latency it
 * is not adding — each of which would show as a dial that does nothing while
 * looking effective.
 */
void test_voice_without_a_model() {
  const uint32_t length = kFrames * 10;
  Noise source;
  std::vector<float> input(length, 0.0f);
  for (uint32_t i = 0; i < length; i += 1) {
    input[i] = static_cast<float>(0.25 * source.next());
  }

  FeqDenoiseSettings settings = bypassed_modules();
  settings.voice.enabled = 1;
  settings.voice.amount = 1.0;

  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  feq_denoise_configure(denoise, &settings);

  const uint32_t latency = feq_denoise_latency_frames(denoise);
  check(latency == 0, "voice: no model adds no latency");

  std::vector<float> left = input;
  std::vector<float> right = input;
  for (uint32_t at = 0; at + kFrames <= length; at += kFrames) {
    float* channels[2] = {left.data() + at, right.data() + at};
    feq_denoise_process(denoise, channels, kFrames);
  }

  bool identical = true;
  for (uint32_t i = 0; i + kFrames <= length; i += 1) {
    if (left[i] != input[i]) {
      identical = false;
      break;
    }
  }
  check(identical, "voice: no model passes the dry signal untouched");

  FeqDenoiseReport report{};
  feq_denoise_report(denoise, &report);
  check(report.voice_model_loaded == 0,
        "voice: reports the model as absent rather than loaded");
  // Not an underrun. That word means the worker was late, and there is no
  // worker; counting it would make a module nobody enabled look like one that
  // is failing.
  check(report.voice_underruns == 0,
        "voice: an absent model is not counted as a dropout");

  feq_denoise_destroy(denoise);
}

/** A path that is not a model, and one that is not a runtime. */
void test_voice_refuses_bad_paths() {
  FeqDenoise* denoise = feq_denoise_create(kRate, 2, kFrames);
  FeqDenoiseSettings settings = bypassed_modules();
  settings.voice.enabled = 1;
  feq_denoise_configure(denoise, &settings);

  check(feq_denoise_load_voice_model(denoise, "does-not-exist.onnx",
                                     "does-not-exist.dll") == 0,
        "voice: a missing runtime is refused rather than half-loaded");

  FeqDenoiseReport report{};
  feq_denoise_report(denoise, &report);
  check(report.voice_model_loaded == 0,
        "voice: a refused load leaves the module unavailable");

  // Null clears, and clearing something that was never loaded is not a fault.
  check(feq_denoise_load_voice_model(denoise, nullptr, nullptr) == 1,
        "voice: unloading is always accepted");

  feq_denoise_destroy(denoise);
}

}  // namespace

int main() {
  std::printf("denoise\n");
  test_voice_without_a_model();
  test_voice_refuses_bad_paths();
  test_band_centres();
  test_bypass_is_exact();
  test_hiss();
  test_adaptive_finds_the_floor_without_a_scan();
  test_adaptive_suppresses_an_endlessly_held_tone();
  test_bass_is_out_of_reach();
  test_bass_is_out_of_reach_when_scanned();
  test_whitening_flattens_the_residue();
  test_smoothing_reaches_the_estimator();
  test_recovers_after_a_long_quiet_stretch();
  test_hum();
  test_arbitrary_size_transform();
  test_click();
  test_click_leaves_percussion_alone();
  test_isolate_is_the_difference();
  test_reported_latency_is_the_real_delay();
  test_every_module_reports_its_real_delay();
  test_isolate_is_silent_when_nothing_is_removed();
  if (g_failures != 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("all passed\n");
  return 0;
}

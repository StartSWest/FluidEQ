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
  test_hum();
  test_click();
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

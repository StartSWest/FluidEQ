/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Denoise as a stage: exact when bypassed, Isolate as the difference, every
 * module's reported delay the real one, the transform at any size, the
 * profile's band centres, and the voice module with no model.
 *
 * The modules' removal itself — hiss, hum, click, the adaptive floor — is
 * denoise_test.cpp; both share denoise_test_support.h.
 */
#include "fluideq/denoise.h"
#include "fluideq/convolver.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <cstdint>
#include <vector>
#include "denoise_test_support.h"

using namespace feq_denoise_test;

namespace {

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
  std::printf("denoise stage\n");
  test_voice_without_a_model();
  test_voice_refuses_bad_paths();
  test_band_centres();
  test_bypass_is_exact();
  test_arbitrary_size_transform();
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

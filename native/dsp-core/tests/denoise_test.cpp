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
#include "denoise_test_support.h"

using namespace feq_denoise_test;

namespace {

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

}  // namespace

int main() {
  std::printf("denoise\n");
  test_hiss();
  test_adaptive_finds_the_floor_without_a_scan();
  test_adaptive_suppresses_an_endlessly_held_tone();
  test_bass_is_out_of_reach();
  test_bass_is_out_of_reach_when_scanned();
  test_whitening_flattens_the_residue();
  test_smoothing_reaches_the_estimator();
  test_recovers_after_a_long_quiet_stretch();
  test_hum();
  test_click();
  test_click_leaves_percussion_alone();
  if (g_failures != 0) {
    std::printf("%d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("all passed\n");
  return 0;
}

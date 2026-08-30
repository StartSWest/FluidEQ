/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each Exciter band actually adds, in harmonics rather than adjectives.
 *
 * The three bands are tuned by ear and described in words — warmth, texture,
 * air — and none of those can be checked. What CAN be checked is where the
 * energy goes: a stage that claims to add harmonics either puts measurable
 * level at 2f and 3f or it does not, and one that claims to leave the
 * fundamental alone either does or does not.
 *
 * This exists because the low band was reviewed and found to be doing something
 * different from what the high band does, and the difference was visible only
 * once the harmonics were listed. Adjectives could not have found it.
 *
 * Projection at each harmonic over a whole number of cycles, so the window is
 * exactly periodic. A partial cycle leaks into every neighbouring frequency and
 * reports harmonics that are not there — the trap that once made a -108 dB
 * filter measure -39.
 */
#include "fluideq/exciter.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
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
constexpr uint32_t kBlock = 512;
/** Long enough for the smoothing to settle and for the projection to be exact. */
constexpr uint32_t kBlocks = 200;

/** Amplitude at `hz`, over a whole number of cycles of it. */
double amount_at(const std::vector<float>& samples, double hz, uint32_t from) {
  const uint32_t available = static_cast<uint32_t>(samples.size()) - from;
  const auto cycles = static_cast<uint32_t>((available * hz) / kRate);
  if (cycles < 4) {
    return 0.0;
  }
  const auto width = static_cast<uint32_t>((cycles * kRate) / hz);
  double real = 0.0;
  double imaginary = 0.0;
  for (uint32_t at = 0; at < width; ++at) {
    const double phase = (2.0 * kPi * hz * at) / kRate;
    const double sample = samples[from + at];
    real += sample * std::cos(phase);
    imaginary += sample * std::sin(phase);
  }
  return (2.0 * std::hypot(real, imaginary)) / width;
}

/** One band on, everything else off, so the reading belongs to that band. */
FeqExciterSettings only(uint32_t band, double freq_hz, double drive,
                        double texture, double mix) {
  FeqExciterSettings settings{};
  settings.enabled = 1;
  settings.isolate = 0;
  for (uint32_t index = 0; index < FEQ_EXCITER_BANDS; ++index) {
    settings.bands[index].enabled = index == band ? 1 : 0;
    settings.bands[index].freq_hz = freq_hz;
    settings.bands[index].range = 1.0;
    settings.bands[index].drive = index == band ? drive : 1.0;
    settings.bands[index].texture = index == band ? texture : 0.0;
    settings.bands[index].mix = index == band ? mix : 0.0;
  }
  return settings;
}

/** Run a sine through one band and return the whole output. */
std::vector<float> excite(uint32_t band, double tone_hz, double band_hz,
                          double drive, double texture, double mix) {
  std::vector<float> band0(kBlock);
  std::vector<float> band1(kBlock);
  std::vector<float> band2(kBlock);
  std::vector<float> wet(kBlock);
  std::vector<float> wide(kBlock * FEQ_EXCITER_MAX_OVERSAMPLE);
  std::vector<float> wide_dry(kBlock * FEQ_EXCITER_MAX_OVERSAMPLE);
  std::vector<float> middle(kBlock * 2);
  std::vector<float> dry(kBlock);
  std::vector<float> guard(kBlock);

  FeqExciterChannel state{};
  feq_exciter_channel_init(&state, band0.data(), band1.data(), band2.data(),
                           wet.data(), wide.data(), wide_dry.data(),
                           middle.data(), dry.data(), guard.data());

  const FeqExciterSettings settings =
      only(band, band_hz, drive, texture, mix);

  std::vector<float> out;
  out.reserve(static_cast<size_t>(kBlock) * kBlocks);
  double phase = 0.0;
  std::vector<float> block(kBlock);
  double report[FEQ_EXCITER_BANDS] = {0.0, 0.0, 0.0};
  for (uint32_t index = 0; index < kBlocks; ++index) {
    for (uint32_t at = 0; at < kBlock; ++at) {
      // -6 dBFS: loud enough to drive the stage, far enough from full scale
      // that nothing measured here is the limiter's opinion.
      block[at] = static_cast<float>(0.5 * std::sin(phase));
      phase += 2.0 * kPi * tone_hz / kRate;
      if (phase > 2.0 * kPi) {
        phase -= 2.0 * kPi;
      }
    }
    feq_exciter_channel_process(&state, block.data(), kBlock, &settings, kRate,
                                report);
    out.insert(out.end(), block.begin(), block.end());
  }
  return out;
}

/** dB of `value` relative to `reference`, floored so silence is printable. */
double relative_db(double value, double reference) {
  const double ratio = value / std::max(reference, 1e-12);
  return 20.0 * std::log10(std::max(ratio, 1e-9));
}

void report_harmonics(const char* label, const std::vector<float>& out,
                      double tone_hz) {
  // From a second in: the drive and texture glides have settled by then, so
  // this is the stage at rest rather than on its way there.
  const uint32_t from = static_cast<uint32_t>(kRate);
  const double fundamental = amount_at(out, tone_hz, from);
  std::printf("       %s: f=%.4f", label, fundamental);
  for (uint32_t order = 2; order <= 5; ++order) {
    const double harmonic = amount_at(out, tone_hz * order, from);
    std::printf("  %ux=%+.1f dB", order, relative_db(harmonic, fundamental));
  }
  std::printf("\n");
}

/** The strongest generated order, relative to the fundamental. */
double loudest_harmonic_db(const std::vector<float>& out, double tone_hz) {
  const uint32_t from = static_cast<uint32_t>(kRate);
  const double fundamental = amount_at(out, tone_hz, from);
  double loudest = 0.0;
  for (uint32_t order = 2; order <= 5; ++order) {
    loudest = std::max(loudest, amount_at(out, tone_hz * order, from));
  }
  return relative_db(loudest, fundamental);
}

/** Even orders against odd, which is what "warm" versus "hard" means here. */
double even_over_odd_db(const std::vector<float>& out, double tone_hz) {
  const uint32_t from = static_cast<uint32_t>(kRate);
  const double even = amount_at(out, tone_hz * 2, from) +
                      amount_at(out, tone_hz * 4, from);
  const double odd = amount_at(out, tone_hz * 3, from) +
                     amount_at(out, tone_hz * 5, from);
  return relative_db(even, odd);
}

void test_low_band() {
  std::printf("exciter: the low band on a 60 Hz tone\n");

  const std::vector<float> quiet = excite(0, 60.0, 120.0, 1.0, 0.0, 0.0);
  const std::vector<float> driven = excite(0, 60.0, 120.0, 4.0, 0.5, 1.0);
  report_harmonics("mix 0  ", quiet, 60.0);
  report_harmonics("mix 1  ", driven, 60.0);

  /**
   * At zero mix the stage must be inaudible, which is the control.
   *
   * Every threshold below is about harmonics appearing; a stage that generated
   * them with the Amount at zero would make all of them pass for the wrong
   * reason, and would also be a control the user cannot turn off.
   */
  check(loudest_harmonic_db(quiet, 60.0) < -50.0,
        "adds essentially nothing with the amount at zero");

  const double loudest = loudest_harmonic_db(driven, 60.0);
  std::printf("       loudest generated order: %+.1f dB\n", loudest);
  check(loudest > -40.0, "generates real harmonics when driven");

  /**
   * Warm rather than hard, which for bass is the whole point.
   *
   * A symmetric shaper makes odd orders — 3f and 5f — and on a bass note those
   * sit a twelfth and a seventeenth above the root: dissonant, and heard as
   * hardness. The even orders are the octave and two octaves, which is what
   * makes a small speaker imply a fundamental it cannot reproduce.
   */
  const double warmth = even_over_odd_db(driven, 60.0);
  std::printf("       even over odd: %+.1f dB\n", warmth);
  check(warmth > 0.0, "and leans even rather than odd, which is warmth");

  /**
   * The fundamental survives.
   *
   * An exciter that changes the level of the note it is exciting is a gain
   * control wearing a costume. The dry programme passes through and the
   * harmonics are added under it, so the root has to come out where it went in.
   */
  const uint32_t from = static_cast<uint32_t>(kRate);
  const double quiet_root = amount_at(quiet, 60.0, from);
  const double driven_root = amount_at(driven, 60.0, from);
  const double moved = relative_db(driven_root, quiet_root);
  std::printf("       fundamental moved %+.2f dB\n", moved);
  check(std::fabs(moved) < 3.0,
        "without moving the fundamental it was asked to excite");
}

}  // namespace

int main() {
  std::printf("fluideq exciter\n");
  test_low_band();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

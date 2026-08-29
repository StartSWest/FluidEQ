/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * That the meters measure, rather than merely return.
 *
 * The failure this guards against is not a crash. It is a spectrum that comes
 * back the right shape and the right length, full of numbers that are not the
 * signal — which draws a graph that moves plausibly and means nothing. Nobody
 * looking at the panel could tell, and neither could a test that only checked
 * an array arrived.
 *
 * So every check here is a claim about where energy actually landed: a tone put
 * in at a known frequency has to come back loud in that bin and quiet
 * elsewhere, silence has to read as silence, and the two must be far enough
 * apart that no rounding could confuse them.
 */
#include "fluideq/meters.h"

#include <cmath>
#include <cstdio>
#include <algorithm>
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

/** Feed `frames` of a sine at `hz`, in blocks the size a device would use. */
void feed_tone(FeqMeters* meters,
               uint32_t stage,
               double hz,
               double amplitude,
               uint32_t frames,
               double* phase) {
  constexpr uint32_t kBlock = 480;
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  uint32_t sent = 0;
  while (sent < frames) {
    const uint32_t count = std::min(kBlock, frames - sent);
    for (uint32_t at = 0; at < count; at += 1) {
      const auto value = static_cast<float>(amplitude * std::sin(*phase));
      left[at] = value;
      right[at] = value;
      *phase += 2.0 * kPi * hz / kRate;
    }
    feq_meters_capture(meters, stage, planes, count);
    sent += count;
  }
}

/** The bin a frequency lands in for this transform size and rate. */
uint32_t bin_for(double hz) {
  return static_cast<uint32_t>((hz / kRate) * FEQ_METER_WINDOW + 0.5);
}

/**
 * Read until a window has been published, or give up.
 *
 * The meters publish once per 2048 samples, so a reader called immediately
 * after a short feed legitimately has nothing yet. Returning "no data" is a
 * real answer, not a failure — and one this test relies on, below.
 */
bool read_spectrum(FeqMeters* meters, uint32_t stage, std::vector<float>& out) {
  out.assign(FEQ_METER_BINS, 0.0f);
  return feq_meters_read_spectrum(meters, stage, out.data(), FEQ_METER_BINS) !=
         0;
}

}  // namespace

int main() {
  std::printf("meters\n");

  FeqMeters* meters = feq_meters_create(2);
  check(meters != nullptr, "the meters are created");
  if (meters == nullptr) {
    return 1;
  }

  /**
   * Nothing is measured until somebody is looking.
   *
   * The panel is one tab of several and is usually closed. This is the check
   * that keeps three transforms per block from being work the whole app pays
   * for whether or not anything draws it.
   */
  check(feq_meters_enabled(meters) == 0, "they start switched off");
  std::vector<float> spectrum;
  double phase = 0.0;
  feed_tone(meters, FEQ_METER_STAGE_EQ, 1000.0, 0.5, FEQ_METER_WINDOW * 4,
            &phase);
  check(!read_spectrum(meters, FEQ_METER_STAGE_EQ, spectrum),
        "and capture while off publishes nothing at all");

  feq_meters_set_enabled(meters, 1);
  check(feq_meters_enabled(meters) != 0, "they can be switched on");

  /**
   * A 1 kHz tone, and the whole point of the file.
   *
   * Fed for well over the smoothing's settling time, because the published
   * value is a running blend at 0.8 — a single window would read about a fifth
   * of the true magnitude and the test would be measuring its own impatience.
   */
  phase = 0.0;
  feed_tone(meters, FEQ_METER_STAGE_EQ, 1000.0, 0.5, FEQ_METER_WINDOW * 64,
            &phase);
  bool published = false;
  /**
   * Fed and read repeatedly, not read once the first window lands.
   *
   * The published value is a running blend at 0.8, so one window carries only a
   * fifth of the true magnitude — about 14 dB light. Asserting on the first
   * read measured the test's impatience rather than the signal, and it read
   * -34 dB for a tone that settles at -20.
   */
  for (int attempt = 0; attempt < 96; attempt += 1) {
    feed_tone(meters, FEQ_METER_STAGE_EQ, 1000.0, 0.5, FEQ_METER_WINDOW, &phase);
    published = read_spectrum(meters, FEQ_METER_STAGE_EQ, spectrum) || published;
  }
  check(published, "a window is published once they are on");

  const uint32_t tone_bin = bin_for(1000.0);
  const float at_tone = spectrum[tone_bin];

  // Far from the tone, where a correct transform has essentially nothing. Ten
  // kilohertz is over two hundred bins away; leakage from a windowed sine is
  // long gone by then.
  const float far_away = spectrum[bin_for(10000.0)];

  std::printf("       1 kHz bin %.1f dB, 10 kHz bin %.1f dB\n",
              static_cast<double>(at_tone), static_cast<double>(far_away));
  /**
   * Around -20 dB, and that number is derivable rather than observed.
   *
   * A sine of amplitude A puts half its energy in each of the positive and
   * negative frequencies, the Blackman window has a coherent gain of 0.42, and
   * the magnitudes are divided by the transform size — so the peak bin settles
   * at 20*log10(A/2 * 0.42), which for A = 0.5 is -19.6 dB. The threshold sits
   * below that with room for the scalloping loss of a tone that does not land
   * exactly on a bin centre: 1 kHz falls at bin 42.67 for this size and rate.
   */
  check(at_tone > -25.0f, "the tone reads loud in its own bin");
  check(far_away < -90.0f, "and the far bins read empty");
  check(at_tone - far_away > 60.0f,
        "so the peak is unmistakably where the tone is");

  /**
   * The positive control for every threshold above.
   *
   * A meter that returned a constant would satisfy "loud here, quiet there" if
   * the constants happened to sit either side of the line. Moving the tone has
   * to move the peak — that is the difference between measuring and reporting.
   */
  phase = 0.0;
  for (int attempt = 0; attempt < 96; attempt += 1) {
    feed_tone(meters, FEQ_METER_STAGE_EQ, 5000.0, 0.5, FEQ_METER_WINDOW,
              &phase);
    read_spectrum(meters, FEQ_METER_STAGE_EQ, spectrum);
  }
  const uint32_t moved_bin = bin_for(5000.0);
  std::printf("       moved to 5 kHz: that bin %.1f dB, old bin %.1f dB\n",
              static_cast<double>(spectrum[moved_bin]),
              static_cast<double>(spectrum[tone_bin]));
  check(spectrum[moved_bin] > -30.0f, "moving the tone moves the peak with it");
  check(spectrum[tone_bin] < spectrum[moved_bin] - 40.0f,
        "and the bin it left goes quiet, so the reading is not a constant");

  /**
   * Silence reads as silence.
   *
   * The other half of the same argument: a meter stuck at its floor would pass
   * every "quiet" check above and fail this one only by also failing the loud
   * ones, which is why both directions are here.
   */
  phase = 0.0;
  for (int attempt = 0; attempt < 96; attempt += 1) {
    feed_tone(meters, FEQ_METER_STAGE_EQ, 1000.0, 0.0, FEQ_METER_WINDOW,
              &phase);
    read_spectrum(meters, FEQ_METER_STAGE_EQ, spectrum);
  }
  check(spectrum[tone_bin] < -100.0f, "silence reads at the floor");

  /**
   * Anti-phase material still reads, and this is not a hypothetical.
   *
   * The repository's own karaoke fixture measures a stereo correlation of
   * exactly -1.000000 with a channel peak of 1.0 and a mono peak of 1.5e-5,
   * because a vocal removal built from L-R cancels perfectly when summed back.
   * `AnalyserNode` analyses the mono down-mix, so the panel drew a flat line
   * for that track on both engines, for the life of the app — the same "graph
   * is not moving" this whole file exists to remove.
   *
   * Averaging the two channels' magnitudes rather than summing their signals
   * fixes it, and this is the check that would catch a return to the old way.
   */
  phase = 0.0;
  for (int attempt = 0; attempt < 96; attempt += 1) {
    constexpr uint32_t kBlock = 480;
    std::vector<float> left(kBlock);
    std::vector<float> right(kBlock);
    float* planes[2] = {left.data(), right.data()};
    uint32_t sent = 0;
    while (sent < FEQ_METER_WINDOW) {
      const uint32_t count = std::min(kBlock, FEQ_METER_WINDOW - sent);
      for (uint32_t at = 0; at < count; at += 1) {
        const auto value = static_cast<float>(0.5 * std::sin(phase));
        left[at] = value;
        // Perfectly inverted, so `0.5 * (L + R)` is exactly zero.
        right[at] = -value;
        phase += 2.0 * kPi * 3000.0 / kRate;
      }
      feq_meters_capture(meters, FEQ_METER_STAGE_EQ, planes, count);
      sent += count;
    }
    read_spectrum(meters, FEQ_METER_STAGE_EQ, spectrum);
  }
  const uint32_t inverted_bin = bin_for(3000.0);
  std::printf("       anti-phase 3 kHz reads %.1f dB\n",
              static_cast<double>(spectrum[inverted_bin]));
  check(spectrum[inverted_bin] > -25.0f,
        "a tone whose channels cancel is still measured");

  /**
   * The stages are separate, which is what makes three graphs possible.
   *
   * Capturing into one and reading another has to answer nothing rather than
   * the first one's data. A shared buffer would draw the same picture in all
   * three panels — plausible, and completely wrong.
   */
  std::vector<float> other;
  check(!read_spectrum(meters, FEQ_METER_STAGE_MASTER, other),
        "a stage nothing was captured into stays empty");

  /**
   * The scope, and the phase needle behind it.
   *
   * Identical channels are correlation +1 by definition; this is the reading
   * the needle rests at for any mono-compatible material, so it is the one
   * worth pinning.
   */
  std::vector<float> pairs(FEQ_METER_SCOPE_PAIRS * 2);
  double correlation = 0.0;
  float peaks[2] = {0.0f, 0.0f};
  phase = 0.0;
  feed_tone(meters, FEQ_METER_STAGE_MASTER, 440.0, 0.75, FEQ_METER_WINDOW * 4,
            &phase);
  const int has_scope =
      feq_meters_read_scope(meters, pairs.data(), FEQ_METER_SCOPE_PAIRS,
                            &correlation, peaks);
  check(has_scope != 0, "the scope publishes from the master tap");
  std::printf("       correlation %.3f, peaks %.3f / %.3f\n", correlation,
              static_cast<double>(peaks[0]), static_cast<double>(peaks[1]));
  check(correlation > 0.99, "identical channels read as correlated");
  check(peaks[0] > 0.7f && peaks[0] <= 0.7501f,
        "and the peak is the amplitude that was sent");

  /** Read twice with nothing new in between reports nothing the second time. */
  check(feq_meters_read_scope(meters, pairs.data(), FEQ_METER_SCOPE_PAIRS,
                              &correlation, peaks) == 0,
        "a second read with no new window sends nothing");

  feq_meters_destroy(meters);

  if (g_failures > 0) {
    std::printf("\n%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("\nall checks passed\n");
  return 0;
}

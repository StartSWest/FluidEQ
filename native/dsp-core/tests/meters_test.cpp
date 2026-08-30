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
   * How fast the display falls, which has to match what it replaces.
   *
   * Smoothing is applied per UPDATE, and the two engines update at different
   * speeds: `AnalyserNode` re-transforms on every animation frame, sixty a
   * second, while these publish one window per 2048 samples — 23.44 a second at
   * 48 kHz. The same 0.8 at less than half the rate is a decay stretched over
   * two and a half times as long, and it was spotted straight away as the
   * graphs having "slow release" on the native engine.
   *
   * The reference falls by `20*log10(0.8)` per frame, so 60 * -1.938 = -116.3
   * dB in a second. This measures a second of decay here and asks for the same
   * number, which is what makes the two look alike rather than merely both
   * being smoothed.
   */
  phase = 0.0;
  for (int attempt = 0; attempt < 96; attempt += 1) {
    feed_tone(meters, FEQ_METER_STAGE_EXCITER, 3000.0, 0.5, FEQ_METER_WINDOW,
              &phase);
    read_spectrum(meters, FEQ_METER_STAGE_EXCITER, spectrum);
  }
  const uint32_t decay_bin = bin_for(3000.0);
  const float settled = spectrum[decay_bin];

  // One second of silence, in windows: 48000 / 2048 = 23.44, so 23 of them.
  const int windows_per_second =
      static_cast<int>(kRate / FEQ_METER_WINDOW);
  for (int attempt = 0; attempt < windows_per_second; attempt += 1) {
    feed_tone(meters, FEQ_METER_STAGE_EXCITER, 3000.0, 0.0, FEQ_METER_WINDOW,
              &phase);
    read_spectrum(meters, FEQ_METER_STAGE_EXCITER, spectrum);
  }
  const double fell = static_cast<double>(settled) - spectrum[decay_bin];
  const double reference =
      60.0 * 20.0 * std::log10(0.8) * -1.0;  // 116.3 dB in a second
  std::printf("       fell %.1f dB in a second; the reference falls %.1f\n",
              fell, reference);
  check(std::fabs(fell - reference) < 15.0,
        "the display falls at the speed the panel was built around");

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

  /**
   * The Master tail: folded across the window, cleared as it is taken.
   *
   * The audio thread publishes once per block and the host reads about a fifth
   * as often, so "the last block" is the wrong answer four times in five —
   * and wrong in the direction that matters, because the block it drops is the
   * transient that caused the reduction being displayed. Storing rather than
   * folding would make the meter miss exactly the event it exists to show.
   */
  FeqMasterTelemetry first{};
  first.auto_headroom_reduction_db = -2.0;
  first.auto_headroom_true_peak_db = -6.0;
  first.safety_reduction_db = -0.5;
  first.safety_true_peak_db = -3.0;
  first.dc_correction_db = -70.0;
  first.repaired_samples = 2;
  first.true_peak_factor = 4;
  first.safety_enabled = 1;

  FeqMasterTelemetry second = first;
  // The block the meter has to keep: deeper reduction, higher peak.
  second.auto_headroom_reduction_db = -9.5;
  second.auto_headroom_true_peak_db = -1.0;
  second.safety_reduction_db = -0.25;  // shallower, and must be ignored
  second.safety_true_peak_db = -4.0;   // lower, and must be ignored
  second.dc_correction_db = -80.0;     // quieter, and must be ignored
  second.repaired_samples = 3;

  feq_meters_publish_master(meters, &first);
  feq_meters_publish_master(meters, &second);

  FeqMasterTelemetry taken{};
  feq_meters_read_master(meters, &taken);
  std::printf("       auto headroom %.2f dB over two blocks of -2.00 / -9.50\n",
              taken.auto_headroom_reduction_db);
  check(std::fabs(taken.auto_headroom_reduction_db + 9.5) < 1e-4,
        "the window keeps the deepest Auto Headroom reduction, not the last");
  check(std::fabs(taken.auto_headroom_true_peak_db + 1.0) < 1e-4,
        "and the highest peak that arrived at it");
  check(std::fabs(taken.safety_reduction_db + 0.5) < 1e-4,
        "the guard's deepest reduction survives a shallower block after it");
  check(std::fabs(taken.safety_true_peak_db + 3.0) < 1e-4,
        "and its highest peak survives a quieter one");
  check(std::fabs(taken.dc_correction_db + 70.0) < 1e-4,
        "DC reports the worst baseline seen, not the most recent");
  check(taken.repaired_samples == 5,
        "faults are summed across the window rather than replaced");
  check(taken.true_peak_factor == 4 && taken.safety_enabled != 0,
        "and the configuration comes through as it was published");

  /**
   * The clear, which is what lets a peak event end.
   *
   * Without it the card latches the deepest reduction of the session and holds
   * it forever — a reduction that finished minutes ago, displayed as one that
   * is happening now, with no way for a quiet passage to say otherwise.
   */
  FeqMasterTelemetry after{};
  feq_meters_read_master(meters, &after);
  check(after.auto_headroom_reduction_db == 0.0 &&
            after.safety_reduction_db == 0.0,
        "a window in which nothing happened reports no reduction");
  check(after.auto_headroom_true_peak_db < -119.0 &&
            after.safety_true_peak_db < -119.0 &&
            after.dc_correction_db < -119.0,
        "and its peaks fall back to the floor rather than holding");
  check(after.repaired_samples == 0, "and its fault count starts again at zero");

  /**
   * The Normalizer's bars decay instead of clearing, and that is deliberate.
   *
   * A peak meter that resets on read flickers at whatever rate the reader
   * happens to run; the 350 ms release is what the bars were tuned against.
   * Fed one loud block and then silence, the hold has to come down over time
   * rather than either vanishing or staying put.
   */
  const double loud[2] = {0.8, 0.8};
  const double quiet[2] = {0.0, 0.0};
  feq_meters_publish_normalizer(meters, loud, loud, 3.0, 480, kRate);
  float held_in[2] = {0.0f, 0.0f};
  float held_out[2] = {0.0f, 0.0f};
  float applied = 0.0f;
  feq_meters_read_normalizer(meters, held_in, held_out, &applied);
  check(held_in[0] > 0.75f, "a loud block raises the Normalizer's input bar");
  check(std::fabs(applied - 3.0f) < 1e-4f,
        "and the gain beside it is the one that was applied");

  // A tenth of a second of silence: audible movement, nowhere near the floor.
  for (int block = 0; block < 10; block += 1) {
    feq_meters_publish_normalizer(meters, quiet, quiet, 3.0, 480, kRate);
  }
  float fallen_in[2] = {0.0f, 0.0f};
  feq_meters_read_normalizer(meters, fallen_in, held_out, &applied);
  std::printf("       the bar fell from %.3f to %.3f over 100 ms\n",
              static_cast<double>(held_in[0]),
              static_cast<double>(fallen_in[0]));
  check(fallen_in[0] < held_in[0],
        "silence brings it down rather than latching it");
  check(fallen_in[0] > 0.3f,
        "but at the release it was tuned to, not instantly");

  feq_meters_destroy(meters);

  if (g_failures > 0) {
    std::printf("\n%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("\nall checks passed\n");
  return 0;
}

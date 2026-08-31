/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where each meter is tapped, which the stages themselves cannot say.
 *
 * `meters_test` proves the meters measure and `bass_forge_test` proves the
 * stage generates. Neither can catch the defect this file exists for: a tap
 * taken at the wrong POINT in the chain reports a real measurement of the
 * wrong signal, so every threshold in both of those files still passes and the
 * panel draws a graph that moves plausibly and is labelled with another
 * stage's name.
 *
 * That is not hypothetical. `FEQ_METER_STAGE_EXCITER` was captured four lines
 * below where it belonged for as long as Bass Forge has been in the chain,
 * which put a second harmonic generator between the Exciter and its own
 * spectrum — and the two are hard to tell apart by eye precisely because both
 * of them add harmonics to material that did not have them.
 */
#include "fluideq/chain.h"

#include <cmath>
#include <cstdio>
#include <algorithm>
#include <vector>

#include "fluideq/meters.h"

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
/**
 * Enough blocks for every follower in the path to settle.
 *
 * Forge's meter followers, its divider gate and the spectrum's 0.8 smoothing
 * all have time constants measured in windows rather than blocks, and the
 * transform publishes once per 2048 samples. 400 blocks is a little over two
 * seconds, which is past all of them.
 */
constexpr uint32_t kBlocks = 400;

/** The 60 Hz note `bass_forge_test` uses, which the stage is known to work on. */
void run_note(FeqChain* chain, FeqMeters* meters, uint32_t stage_to_capture) {
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  double phase = 0.0;
  for (uint32_t block = 0; block < kBlocks; block += 1) {
    for (uint32_t at = 0; at < kBlock; at += 1) {
      const auto value = static_cast<float>(0.35 * std::sin(phase));
      left[at] = value;
      right[at] = value;
      phase += 2.0 * kPi * 60.0 / kRate;
    }
    feq_chain_process(chain, planes, kBlock);
    // Drained at the same cadence a host's control thread would, so the 0.8
    // smoothing gets the same number of steps it gets in playback.
    if ((block % 4) == 0) {
      std::vector<float> scratch(FEQ_METER_BINS);
      feq_meters_read_spectrum(meters, stage_to_capture, scratch.data(),
                               FEQ_METER_BINS);
    }
  }
}

/** A settings snapshot with everything off but the input gain. */
FeqChainSettings quiet_chain() {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 0;
  settings.exciter.enabled = 0;
  settings.compressor.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.dimension.enabled = 0;
  settings.master.enabled = 0;
  settings.output_safety_enabled = 0;
  settings.bass_forge.enabled = 0;
  settings.bass_punch.enabled = 0;
  return settings;
}

/** Forge generating hard: the recipe `bass_forge_test` measures 30 Hz from. */
void forge_wide_open(FeqChainSettings* settings) {
  settings->bass_forge.enabled = 1;
  settings->bass_forge.split_hz = 90.0;
  settings->bass_forge.sub_amount = 1.0;
  settings->bass_forge.presence_amount = 1.0;
  settings->bass_forge.texture = 0.8;
  settings->bass_forge.drive_db = 6.0;
  settings->bass_forge.mix = 1.0;
}

/** The final spectrum at one tap, after a note has been run through. */
std::vector<float> spectrum_at(uint32_t stage, const FeqChainSettings& settings,
                               FeqMeters* meters) {
  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(chain, meters);
  feq_chain_configure(chain, &settings);
  run_note(chain, meters, stage);
  std::vector<float> bins(FEQ_METER_BINS, 0.0f);
  // Fed until the last window is published; a read with nothing new returns 0
  // and leaves the previous contents, which is why `bins` is read into twice.
  feq_meters_read_spectrum(meters, stage, bins.data(), FEQ_METER_BINS);
  feq_chain_destroy(chain);
  return bins;
}

/** The bin a frequency lands in for this transform size and rate. */
uint32_t bin_for(double hz) {
  return static_cast<uint32_t>((hz / kRate) * FEQ_METER_WINDOW + 0.5);
}

/**
 * The exciter tap must not see Bass Forge.
 *
 * Stated as an equality between two runs rather than as a claim about what
 * Forge does to a spectrum, because the second kind of test has to be retuned
 * every time the stage is: identical input, one run with Forge off and one
 * with it wide open, and the Exciter's own spectrum has to be the same in
 * both. It is only the same if the tap sits above Forge.
 */
void test_exciter_tap_is_above_forge() {
  std::printf("\nchain meters: the exciter tap sits above Bass Forge\n");

  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_enabled(meters, 1);

  FeqChainSettings without = quiet_chain();
  without.exciter.enabled = 1;
  FeqChainSettings with = without;
  forge_wide_open(&with);

  const std::vector<float> exciter_without =
      spectrum_at(FEQ_METER_STAGE_EXCITER, without, meters);
  const std::vector<float> exciter_with =
      spectrum_at(FEQ_METER_STAGE_EXCITER, with, meters);
  const std::vector<float> eq_without =
      spectrum_at(FEQ_METER_STAGE_EQ, without, meters);
  const std::vector<float> eq_with = spectrum_at(FEQ_METER_STAGE_EQ, with, meters);

  double worst_exciter = 0.0;
  double worst_eq = 0.0;
  for (uint32_t bin = 0; bin < FEQ_METER_BINS; bin += 1) {
    worst_exciter = std::max(
        worst_exciter, std::fabs(static_cast<double>(exciter_without[bin]) -
                                 exciter_with[bin]));
    worst_eq = std::max(
        worst_eq,
        std::fabs(static_cast<double>(eq_without[bin]) - eq_with[bin]));
  }
  std::printf("       exciter tap moved %.2f dB, EQ tap moved %.2f dB\n",
              worst_exciter, worst_eq);

  /**
   * The positive control, without which the check below proves nothing.
   *
   * "The exciter spectrum did not change" is satisfied by a chain in which
   * Forge did nothing at all, by meters that returned a constant, and by a
   * test that never ran the stage. The EQ tap is downstream of Forge, so it
   * MUST move — and by far more than the tolerance the exciter tap is held to.
   */
  check(worst_eq > 6.0,
        "Forge changes the signal, so the tap below it moves a long way");
  check(worst_exciter < 0.01,
        "and the tap above it does not move at all");

  feq_meters_destroy(meters);
}

/**
 * Forge's eight bands reach the meters, and say what the stage made.
 *
 * A meter wired to nothing is the classic failure here and it does not look
 * like one: both runs rest at the -120 floor, which is exactly what a stage
 * sitting idle publishes. So the check is not "a number arrived" but "the two
 * runs disagree, in the band the sub generator works in".
 */
void test_forge_bands_reach_the_meters() {
  std::printf("\nchain meters: Bass Forge publishes both its runs\n");

  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_enabled(meters, 1);
  FeqChainSettings settings = quiet_chain();
  forge_wide_open(&settings);

  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(chain, meters);
  feq_chain_configure(chain, &settings);
  run_note(chain, meters, FEQ_METER_STAGE_EQ);

  float input_db[FEQ_METER_BASS_FORGE_BANDS] = {0.0f};
  float output_db[FEQ_METER_BASS_FORGE_BANDS] = {0.0f};
  feq_meters_read_bass_forge(meters, input_db, output_db);

  double loudest_input = -1000.0;
  double widest_gap = 0.0;
  for (uint32_t band = 0; band < FEQ_METER_BASS_FORGE_BANDS; band += 1) {
    std::printf("       band %u: in %.1f dB, out %.1f dB\n", band,
                static_cast<double>(input_db[band]),
                static_cast<double>(output_db[band]));
    loudest_input = std::max(loudest_input, static_cast<double>(input_db[band]));
    widest_gap = std::max(widest_gap, static_cast<double>(output_db[band]) -
                                          input_db[band]);
  }

  check(loudest_input > -60.0,
        "the dry run carries the note rather than the display floor");
  // The stage's whole claim is that it MAKES low end. If both runs matched,
  // the meter would be reading the same buffer twice.
  check(widest_gap > 3.0,
        "and the forged run stands above it where the stage generated");

  feq_chain_destroy(chain);

  /**
   * Switched off, the two runs fall back rather than holding the last note.
   *
   * `chain_process_bass_forge` resets the stage on every block it is off for,
   * which drives the followers to the floor. That is why the reading side does
   * not have to guess whether a value is current — the same question
   * `feq_dimension_guard` answers by holding its last value, and answered here
   * by the stage instead.
   */
  FeqChainSettings off = quiet_chain();
  FeqChain* idle = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(idle, meters);
  feq_chain_configure(idle, &off);
  run_note(idle, meters, FEQ_METER_STAGE_EQ);
  feq_meters_read_bass_forge(meters, input_db, output_db);
  std::printf("       switched off: band 0 in %.1f dB, out %.1f dB\n",
              static_cast<double>(input_db[0]),
              static_cast<double>(output_db[0]));
  check(input_db[0] < -119.0f && output_db[0] < -119.0f,
        "a stage that is off reads as stopped, not as a minute-old note");
  feq_chain_destroy(idle);

  feq_meters_destroy(meters);
}

/** And Punch's three gains, which are the only evidence it shaped anything. */
void test_punch_gains_reach_the_meters() {
  std::printf("\nchain meters: Bass Punch publishes its three gains\n");

  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_enabled(meters, 1);
  FeqChainSettings settings = quiet_chain();
  settings.bass_punch.enabled = 1;
  settings.bass_punch.split_hz = 110.0;
  settings.bass_punch.attack = 1.0;
  settings.bass_punch.sustain = -1.0;
  settings.bass_punch.bloom_amount = 0.0;
  settings.bass_punch.bloom_decay_ms = 120.0;
  settings.bass_punch.duck = 1.0;

  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_set_meters(chain, meters);
  feq_chain_configure(chain, &settings);

  /**
   * A gated note rather than a steady one, and that is the point of the file.
   *
   * Over a continuous tone the fast and slow followers converge by
   * construction, so the transient gain settles at exactly 0 dB — the stage
   * proving it cannot become a tone control. A meter checked on that signal
   * reads zero whether it is wired up or not. Restarting the note is what
   * makes the attack section do something to see.
   */
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  double phase = 0.0;
  float widest_transient = 0.0f;
  float widest_duck = 0.0f;
  for (uint32_t block = 0; block < kBlocks; block += 1) {
    // 24 blocks of note, 8 of silence: a 256 ms cycle, roughly a slow kick.
    const bool sounding = (block % 32) < 24;
    for (uint32_t at = 0; at < kBlock; at += 1) {
      const auto value =
          static_cast<float>(sounding ? 0.5 * std::sin(phase) : 0.0);
      left[at] = value;
      right[at] = value;
      phase += 2.0 * kPi * 60.0 / kRate;
    }
    feq_chain_process(chain, planes, kBlock);
    /**
     * Read once every four blocks, which is the cadence the host actually
     * has: it publishes per block and drains per analysis window, about 94 a
     * second against 23. Reading every block here would prove the transient
     * arrives at a rate the panel never sees.
     */
    if ((block % 4) == 3) {
      float transient_db = 0.0f;
      float sustain_db = 0.0f;
      float duck_db = 0.0f;
      feq_meters_read_bass_punch(meters, &transient_db, &sustain_db, &duck_db);
      widest_transient = std::max(widest_transient, std::fabs(transient_db));
      widest_duck = std::max(widest_duck, std::fabs(duck_db));
    }
  }

  std::printf("       transient reached %.2f dB, duck reached %.2f dB\n",
              static_cast<double>(widest_transient),
              static_cast<double>(widest_duck));
  check(widest_transient > 0.1f,
        "the attack section survives being read at the host's own cadence");
  check(widest_duck > 0.1f, "and the duck reports what it pulled down");

  /**
   * And the window can say that nothing happened, which is what the clear is
   * for. A transient hold that survives its own read would latch the loudest
   * kick of the session and draw it forever, with no quiet passage able to
   * contradict it.
   */
  float stale = -1.0f;
  float sustain_db = 0.0f;
  float duck_db = 0.0f;
  feq_meters_read_bass_punch(meters, &stale, &sustain_db, &duck_db);
  feq_meters_read_bass_punch(meters, &stale, &sustain_db, &duck_db);
  check(stale == 0.0f,
        "a second read with no block between reports no transient at all");

  feq_chain_destroy(chain);
  feq_meters_destroy(meters);
}

}  // namespace

int main() {
  std::printf("chain meters\n");
  test_exciter_tap_is_above_forge();
  test_forge_bands_reach_the_meters();
  test_punch_gains_reach_the_meters();

  if (g_failures > 0) {
    std::printf("\n%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("\nall checks passed\n");
  return 0;
}

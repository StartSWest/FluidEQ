/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass Forge, held to properties rather than to a TypeScript twin.
 *
 * Every processor that was ported into this engine is checked against a
 * bit-identical TypeScript implementation, and the corpus is what proves the
 * port. This stage was written in C++ first and has no twin, so there is no
 * earlier behaviour to preserve and a second implementation would exist only to
 * be matched by the first. These properties ARE the specification, which is why
 * they were written before the stage was.
 *
 * They are chosen so that the ways a bass enhancer actually fails are the ways
 * these fail: it is a hidden gain stage, it rumbles between the notes, it is
 * not quite transparent when turned down, the two generators it advertises are
 * one generator with two labels, or a dial on the front does nothing.
 *
 * The level property is the one worth defending, and it is measured on pink
 * noise rather than white for a reason that is easy to get wrong: under white
 * noise the band this stage works in holds three tenths of a percent of the
 * energy, so a six decibel error down there moves the total by four hundredths
 * of a decibel and every possible implementation passes.
 */
#include "fluideq/bass_forge.h"

#include "dsp_test_support.h"

#include <cmath>
#include <cstdio>
#include <vector>

using namespace feq_test;

namespace {

constexpr uint32_t kBlocks = 200;
/**
 * Where a measurement may begin, and how long it may run.
 *
 * Every follower here is deliberately slow — a quarter-second level window,
 * and `feq_harmonic_sample` carries another — so a number from the first block
 * measures the followers warming up. One second of settling, then one of
 * measuring; every frequency asked for below completes a whole number of
 * cycles in that second, so a DFT bin sits exactly on its tone.
 */
constexpr size_t kSettled = kFrames * 100;
constexpr size_t kWindow = 48000;

FeqBassForgeSettings defaults() {
  FeqBassForgeSettings settings{};
  settings.enabled = 1;
  // On for every test here, because the chain switches it on whenever the
  // panel is open and `test_meters_are_gated` is where it is switched off.
  settings.meters = 1;
  settings.split_hz = 90.0;
  settings.drive_db = 0.0;
  settings.sub_amount = 0.0;
  settings.presence_amount = 0.0;
  settings.texture = 0.8;
  settings.mix = 0.0;
  return settings;
}

/** Everything asked for at once, which is where the properties are hardest. */
FeqBassForgeSettings everything() {
  FeqBassForgeSettings settings = defaults();
  settings.sub_amount = 1.0;
  settings.presence_amount = 1.0;
  settings.mix = 1.0;
  return settings;
}

/** One stage and its buffers, so a test can drive it over more than one run. */
struct Stage {
  std::vector<float> low = std::vector<float>(kFrames * 2, 0.0f);
  std::vector<float> scratch = std::vector<float>(kFrames * 2, 0.0f);
  FeqBassForge state{};
  Stage() { feq_bass_forge_init(&state, low.data(), scratch.data()); }
  void run(Signal& signal, const FeqBassForgeSettings& settings) {
    run_blocks(signal, [this, &settings](float* const* channels) {
      feq_bass_forge_process(&state, channels, 2, kFrames, &settings, kRate);
    });
  }
};

Signal process(const Signal& input, const FeqBassForgeSettings& settings) {
  Signal out = input;
  Stage stage;
  stage.run(out, settings);
  return out;
}

/** The whole file measures the same second, so the DFT window is fixed. */
double bin_magnitude(const std::vector<float>& samples, double hz) {
  return feq_test::bin_magnitude(samples, hz, kSettled, kWindow);
}

/**
 * Disabled must be bit-exact, not close. The crossover recombines by
 * subtraction precisely so this can be an equality.
 */
void test_disabled_is_bit_exact() {
  std::printf("bass forge: switched off is exactly bypassed\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  FeqBassForgeSettings off = everything();
  off.enabled = 0;
  check(identical(process(noise, off), noise),
        "not one sample moves with the stage switched off");
}

/**
 * `mix` of zero is the same claim through the live path: every filter runs,
 * both generators run, and the result is still the input. A stage that is only
 * approximately transparent at zero is a stage nobody can leave switched on.
 */
void test_zero_mix_is_bit_exact() {
  std::printf("\nbass forge: a mix of zero is bypass, through the live path\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  FeqBassForgeSettings quiet = everything();
  quiet.mix = 0.0;
  quiet.drive_db = 12.0;
  check(identical(process(noise, quiet), noise),
        "the band comes back bit for bit with the generators running");
}

/**
 * The no-free-loudness rule, which is the property that makes this stage
 * judgeable by ear. Swept across the whole control surface rather than
 * spot-checked, because it is the combinations that break it.
 */
void test_level_is_preserved() {
  std::printf("\nbass forge: neither generator is a volume control\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  const double before = rms(noise, kSettled);

  double worst = 0.0;
  double worst_mix = 0.0;
  double worst_sub = 0.0;
  double worst_presence = 0.0;
  double worst_drive = 0.0;
  // Drive is in the sweep because it is a non-linearity now: the curve
  // compresses what it colours, and the gain that follows has to take that
  // back as completely as it takes back the generators' own contribution.
  for (const double drive : {0.0, 12.0}) {
    for (const double mix : {0.25, 0.5, 0.75, 1.0}) {
      for (const double sub : {0.0, 0.5, 1.0}) {
        for (const double presence : {0.0, 0.5, 1.0}) {
          FeqBassForgeSettings settings = defaults();
          settings.drive_db = drive;
          settings.mix = mix;
          settings.sub_amount = sub;
          settings.presence_amount = presence;
          const double after = rms(process(noise, settings), kSettled);
          const double error = std::fabs(20.0 * std::log10(after / before));
          if (error > worst) {
            worst = error;
            worst_mix = mix;
            worst_sub = sub;
            worst_presence = presence;
            worst_drive = drive;
          }
        }
      }
    }
  }
  std::printf(
      "       worst deviation %.3f dB at mix %.2f, sub %.2f, presence %.2f, "
      "drive %.0f dB\n",
      worst, worst_mix, worst_sub, worst_presence, worst_drive);
  check(worst < 0.5, "output RMS within 0.5 dB of input RMS, everywhere");

  // The positive control. Every assertion above is passed perfectly by a stage
  // that returns its input untouched, and "found nothing" has to be told apart
  // from "there was never anything to find".
  const Signal loud = process(noise, everything());
  double largest = 0.0;
  for (size_t at = kSettled; at < loud.left.size(); ++at) {
    largest = std::fmax(largest,
                        std::fabs(static_cast<double>(loud.left[at]) -
                                  static_cast<double>(noise.left[at])));
  }
  std::printf("       largest change it makes: %.4f\n", largest);
  check(largest > 0.01, "while genuinely changing the signal");
}

/** Sub really is an octave down. */
void test_sub_generates_an_octave_below() {
  std::printf("\nbass forge: the divider makes the octave below\n");
  const Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.35);
  FeqBassForgeSettings on = defaults();
  on.sub_amount = 1.0;
  on.mix = 1.0;
  FeqBassForgeSettings off = on;
  off.sub_amount = 0.0;

  const double with = bin_magnitude(process(note, on).left, 30.0);
  const double without = bin_magnitude(process(note, off).left, 30.0);
  const double ratio = 20.0 * std::log10(with / std::fmax(without, 1e-12));
  std::printf("       30 Hz with sub %.6f, without %.3e (%.1f dB)\n", with,
              without, ratio);
  check(ratio > 20.0, "a 60 Hz note puts energy at 30 Hz that was not there");
}

/** And presence really is where texture says it is. */
void test_presence_follows_texture() {
  std::printf("\nbass forge: texture chooses the interval\n");
  const Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.35);
  FeqBassForgeSettings even = defaults();
  even.presence_amount = 1.0;
  even.mix = 1.0;
  even.texture = 1.0;
  FeqBassForgeSettings odd = even;
  odd.texture = 0.0;

  const Signal octave = process(note, even);
  const Signal twelfth = process(note, odd);
  const double even_second = bin_magnitude(octave.left, 120.0);
  const double even_third = bin_magnitude(octave.left, 180.0);
  const double odd_second = bin_magnitude(twelfth.left, 120.0);
  const double odd_third = bin_magnitude(twelfth.left, 180.0);
  std::printf("       texture 1: 120 Hz %.6f, 180 Hz %.6f\n", even_second,
              even_third);
  std::printf("       texture 0: 120 Hz %.6f, 180 Hz %.6f\n", odd_second,
              odd_third);
  check(even_second > even_third * 4.0, "texture 1 is the octave, at 120 Hz");
  check(odd_third > odd_second * 4.0, "texture 0 is the twelfth, at 180 Hz");
}

/**
 * A divider that free-runs on the noise floor produces rumble that is not in
 * the record, and it does it in the silence between notes where it is most
 * audible. The floor is what stops that, so silence is a test.
 */
void test_silence_stays_silent() {
  std::printf("\nbass forge: the divider does not run on nothing\n");
  const size_t count = ((static_cast<size_t>(kRate) * 4) / kFrames) * kFrames;
  Signal zeros;
  zeros.left.assign(count, 0.0f);
  zeros.right.assign(count, 0.0f);
  const Signal silent = process(zeros, everything());
  bool quiet = true;
  for (size_t at = 0; at < silent.left.size(); ++at) {
    quiet = quiet && silent.left[at] == 0.0f && silent.right[at] == 0.0f;
  }
  check(quiet, "four seconds of zeros come back as four seconds of zeros");

  /**
   * And the case zeros cannot reach: a note far under the floor.
   *
   * Exact silence multiplies out of every path here whether the floor exists
   * or not, so alone it proves nothing. A -80 dBFS tone is what a record's
   * noise floor looks like, and a divider with no floor would match its output
   * up to that tone's own level and put a manufactured octave there. The same
   * measurement at -20 dBFS is the control: a floor, not an off switch.
   */
  const Signal faint = process(sine_stereo(kFrames * kBlocks, 60.0, 1e-4),
                               everything());
  const double faint_octave = bin_magnitude(faint.left, 30.0);
  const double faint_note = bin_magnitude(faint.left, 60.0);
  const Signal loud = process(sine_stereo(kFrames * kBlocks, 60.0, 0.1),
                              everything());
  const double loud_octave = bin_magnitude(loud.left, 30.0);
  const double loud_note = bin_magnitude(loud.left, 60.0);
  std::printf("       -80 dBFS: octave/note %.4f\n", faint_octave / faint_note);
  std::printf("       -20 dBFS: octave/note %.4f\n", loud_octave / loud_note);
  check(faint_octave < faint_note * 0.05,
        "a note under the floor gets no octave of its own");
  check(loud_octave > loud_note * 0.2, "and one over it does");
}

/**
 * Generated content is mono because it comes from `(low[0]+low[1])/2`, and
 * this test has to be able to fail when it does not.
 *
 * The obvious test — identical signal in both channels, assert the outputs
 * match — cannot: two per-channel generators fed the same band evolve
 * identically and pass it. So the channels DIFFER, and the measurement is then
 * constrained twice over. It is of `output - input`, because the dry low band
 * legitimately differs per channel and only the addition is claimed to be
 * mono. And it is taken at frequencies the dry band has none of, because
 * `output - input` is `low[ch] * (g - 1) + added * g`: the normalising gain
 * acts on the dry band too, so in the time domain the two deltas differ for a
 * perfectly correct stage. At 30 and 120 Hz a 60 Hz tone contributes nothing,
 * leaving `added * g` and nothing else.
 *
 * Per-channel generators are level-normalised to their own source, so the 0.35
 * ear and the 0.15 ear would come back 7.4 dB apart — a relative 0.57.
 * Measured with exactly that fault injected: 0.40 at 30 Hz, 0.58 at 120.
 *
 * The tolerance is 0.01 rather than zero because the normalising gain ripples
 * at the octave — it comes from a mean square containing one — and that ripple
 * times a per-channel dry band lands back in the 30 Hz bin. Measured at
 * 1.3e-3: eight times under the line, and the failure is forty times over it.
 */
void test_generated_content_is_mono() {
  std::printf("\nbass forge: what it generates is the same in both ears\n");
  Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.35);
  for (float& sample : note.right) {
    sample *= (0.15f / 0.35f);
  }
  const Signal result = process(note, everything());

  Signal added;
  added.left.resize(result.left.size());
  added.right.resize(result.right.size());
  for (size_t at = 0; at < result.left.size(); ++at) {
    added.left[at] = result.left[at] - note.left[at];
    added.right[at] = result.right[at] - note.right[at];
  }

  for (const double hz : {30.0, 120.0}) {
    const double in_left = bin_magnitude(added.left, hz);
    const double in_right = bin_magnitude(added.right, hz);
    const double error =
        std::fabs(in_left - in_right) / std::fmax(in_left, 1e-12);
    std::printf("       %.0f Hz added: left %.6f, right %.6f (%.2e apart)\n",
                hz, in_left, in_right, error);
    check(error < 0.01, "the two ears are given the same generated content");
    // The positive control: a bin with nothing in it matches itself perfectly.
    check(in_left > 1e-3, "and there is something there to compare");
  }
}

/**
 * Drive has to reach the audio on ordinary programme, not only near the floor.
 *
 * This is the test the first version of this stage did not have, and its
 * absence is what let `drive_db` ship as a dial that changed nothing above
 * -50 dBFS: a gain in front of two level-normalised generators is a no-op, and
 * every other property here passes just as well when it is. So this measures
 * at a normal listening level, and it measures CONTENT rather than level —
 * which is all it can measure, because the normaliser downstream guarantees
 * the two settings come out the same loudness.
 */
void test_drive_colours_the_generated_bass() {
  std::printf("\nbass forge: drive changes what the bass is made of\n");
  const Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.1);
  FeqBassForgeSettings clean = everything();
  clean.drive_db = 0.0;
  FeqBassForgeSettings hot = everything();
  hot.drive_db = 12.0;

  const Signal cool = process(note, clean);
  const Signal warm = process(note, hot);
  for (const double hz : {30.0, 60.0, 90.0, 120.0, 150.0, 180.0, 240.0}) {
    std::printf("       %5.0f Hz: clean %.6f, hot %.6f\n", hz,
                bin_magnitude(cool.left, hz), bin_magnitude(warm.left, hz));
  }

  double difference = 0.0;
  double reference = 0.0;
  for (size_t at = kSettled; at < cool.left.size(); ++at) {
    const double gap = static_cast<double>(warm.left[at]) -
                       static_cast<double>(cool.left[at]);
    const double base = static_cast<double>(cool.left[at]);
    difference += gap * gap;
    reference += base * base;
  }
  const double ratio = std::sqrt(difference / reference);
  std::printf("       hot differs from clean by %.2f%% RMS\n", ratio * 100.0);
  // Five percent, and the number is chosen against a regression rather than
  // against zero. A curve fed the generated content at its absolute amplitude
  // measured 0.91% here, because a tangent barely bends around 0.1 — so a
  // threshold anywhere under that would have called the level-dependent
  // version working. Feeding it a normalised level gives 11%.
  check(ratio > 0.05, "12 dB of drive is audibly not 0 dB of drive");
}

/**
 * Reset has to empty the crossover, not only the followers.
 *
 * The chain calls it on a seek and on a device change, and what sits in those
 * filters then is the last few milliseconds of something else. Because the
 * output is written as `input + (forged band - dry band)`, a dry band with
 * history in it is SUBTRACTED from the silence rather than decaying into it.
 */
void test_reset_clears_the_history() {
  std::printf("\nbass forge: reset empties the crossover\n");
  const Signal noise = pink_stereo(kFrames * 8, false);

  const auto first_silent_block = [&noise](bool clear) {
    const FeqBassForgeSettings settings = everything();
    Stage stage;
    Signal loud = noise;
    stage.run(loud, settings);
    if (clear) {
      feq_bass_forge_reset(&stage.state);
    }
    Signal silence;
    silence.left.assign(kFrames, 0.0f);
    silence.right.assign(kFrames, 0.0f);
    stage.run(silence, settings);
    double largest = 0.0;
    for (uint32_t at = 0; at < kFrames; ++at) {
      largest =
          std::fmax(largest, std::fabs(static_cast<double>(silence.left[at])));
    }
    return largest;
  };

  const double cleared = first_silent_block(true);
  const double kept = first_silent_block(false);
  std::printf(
      "       largest sample of the first silent block: %.3e after a reset, "
      "%.3e without one\n",
      cleared, kept);
  check(cleared == 0.0, "silence after a reset is silence");
  check(kept > 1e-5, "and the filters really did have something in them");
}

/** The meters have to move with the audio, or the graph is a decoration. */
void test_bands_report_the_band() {
  std::printf("\nbass forge: the eight meters read the band they measure\n");
  Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.35);
  Stage stage;
  stage.run(note, everything());

  double input_db[FEQ_BASS_FORGE_BANDS] = {};
  double output_db[FEQ_BASS_FORGE_BANDS] = {};
  feq_bass_forge_bands(&stage.state, input_db, output_db);
  uint32_t loudest = 0;
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    std::printf("       band %u: in %.1f dB, out %.1f dB\n", band,
                input_db[band], output_db[band]);
    if (input_db[band] > input_db[loudest]) {
      loudest = band;
    }
  }
  // 61 Hz is the third band's centre on a 20 Hz to 1 kHz grid of eight, and a
  // 60 Hz tone is the only thing in the dry band.
  check(loudest == 2, "the dry meter puts a 60 Hz tone in the 61 Hz band");
  // The bottom band is 20 Hz, where a 60 Hz note has almost nothing and its
  // octave has all of what the divider made. The two meters have to disagree
  // there, or the second curve on the graph is the first one redrawn.
  check(output_db[0] > input_db[0] + 2.0,
        "and the forged meter sees an octave the dry one does not");
}

/**
 * The analyser is a graph, so it must not run while nothing is drawing it.
 *
 * Sixteen band-passes and sixteen followers per sample is a million and a half
 * biquad evaluations a second at 48 kHz, and the panel is one tab of ten. The
 * audio may not notice either way — that is the first assertion — and the
 * meters have to notice, which is the second.
 */
void test_meters_are_gated() {
  std::printf("\nbass forge: the analyser stops when nothing is reading it\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  FeqBassForgeSettings dark = everything();
  dark.meters = 0;

  Stage gated;
  Signal quiet = noise;
  gated.run(quiet, dark);
  Stage lit;
  Signal loud = noise;
  lit.run(loud, everything());
  check(identical(quiet, loud),
        "the gate does not move one sample of the audio");

  double dark_input[FEQ_BASS_FORGE_BANDS] = {};
  double dark_output[FEQ_BASS_FORGE_BANDS] = {};
  feq_bass_forge_bands(&gated.state, dark_input, dark_output);
  double lit_input[FEQ_BASS_FORGE_BANDS] = {};
  double lit_output[FEQ_BASS_FORGE_BANDS] = {};
  feq_bass_forge_bands(&lit.state, lit_input, lit_output);
  std::printf("       band 2 gated: in %.1f dB; running: in %.1f dB\n",
              dark_input[2], lit_input[2]);
  bool floored = true;
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    floored = floored && dark_input[band] <= -120.0 &&
              dark_output[band] <= -120.0;
  }
  check(floored, "and with it gated the eight bands read the floor");
  check(lit_input[2] > -60.0, "while running they read the band");
}

}  // namespace

int main() {
  std::printf("fluideq bass forge\n");
  test_disabled_is_bit_exact();
  test_zero_mix_is_bit_exact();
  test_level_is_preserved();
  test_sub_generates_an_octave_below();
  test_presence_follows_texture();
  test_silence_stays_silent();
  test_generated_content_is_mono();
  test_drive_colours_the_generated_bass();
  test_reset_clears_the_history();
  test_bands_report_the_band();
  test_meters_are_gated();
  return finish();
}

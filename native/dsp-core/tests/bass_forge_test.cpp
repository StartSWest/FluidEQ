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
 * not quite transparent when it is turned down, or the two generators it
 * advertises turn out to be one generator with two labels.
 *
 * The level property is the one worth defending, and it is measured on pink
 * noise rather than on white for a reason that is easy to get wrong. Under
 * white noise the band this stage works in holds three tenths of a percent of
 * the energy, so a six decibel error down there moves the total by four
 * hundredths of a decibel and every possible implementation passes.
 */
#include "fluideq/bass_forge.h"

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
constexpr uint32_t kFrames = 512;
constexpr uint32_t kBlocks = 200;
/**
 * Where a measurement may begin, and how long it may run.
 *
 * Every follower in this stage is deliberately slow — the level window is a
 * quarter of a second and `feq_harmonic_sample` carries another of its own — so
 * a number taken from the first block measures the followers warming up rather
 * than the stage working. One second of settling, then one second of measuring.
 * Every frequency asked for below completes a whole number of cycles in that
 * second at this rate, which is what lets a single DFT bin sit exactly on a
 * tone with nothing to leak.
 */
constexpr size_t kSettled = kFrames * 100;
constexpr size_t kWindow = 48000;

FeqBassForgeSettings defaults() {
  FeqBassForgeSettings settings{};
  settings.enabled = 1;
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

struct Signal {
  std::vector<float> left;
  std::vector<float> right;
};

/** One stage and its buffers, so a test can drive it over more than one run. */
struct Stage {
  std::vector<float> low = std::vector<float>(kFrames * 2, 0.0f);
  std::vector<float> scratch = std::vector<float>(kFrames * 2, 0.0f);
  FeqBassForge state{};
  Stage() { feq_bass_forge_init(&state, low.data(), scratch.data()); }
  void run(Signal& signal, const FeqBassForgeSettings& settings) {
    const size_t blocks = signal.left.size() / kFrames;
    for (size_t block = 0; block < blocks; ++block) {
      float* channels[2] = {signal.left.data() + block * kFrames,
                            signal.right.data() + block * kFrames};
      feq_bass_forge_process(&state, channels, 2, kFrames, &settings, kRate);
    }
  }
};

Signal process(const Signal& input, const FeqBassForgeSettings& settings) {
  Signal out = input;
  Stage stage;
  stage.run(out, settings);
  return out;
}

/** A 32-bit LCG, so every run of this file measures the same signal. */
struct Noise {
  uint32_t seed;
  double next() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<double>(seed >> 8) / 8388608.0 - 1.0;
  }
};

/**
 * Pink, because white is the wrong question here — see the head of this file.
 *
 * Paul Kellett's three-pole economy filter: -3 dB per octave to within a
 * quarter of a decibel across the audio band, which is roughly what a record
 * looks like and puts about a fifth of the energy under 90 Hz.
 */
struct Pink {
  Noise noise{2463534242u};
  double b0 = 0.0;
  double b1 = 0.0;
  double b2 = 0.0;
  double next() {
    const double white = noise.next();
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    return b0 + b1 + b2 + white * 0.1848;
  }
};

/** Scaled to a fixed peak, so every run of the sweep is the same loudness. */
void normalise(std::vector<float>& samples, double peak) {
  double largest = 0.0;
  for (const float sample : samples) {
    largest = std::fmax(largest, std::fabs(static_cast<double>(sample)));
  }
  if (largest <= 0.0) {
    return;
  }
  const auto scale = static_cast<float>(peak / largest);
  for (float& sample : samples) {
    sample *= scale;
  }
}

/** `mono` feeds one signal to both channels; otherwise they are two. */
Signal pink_stereo(size_t count, bool mono) {
  Pink source;
  Pink other{Noise{97531u}, 0.0, 0.0, 0.0};
  Signal out;
  out.left.resize(count);
  out.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    out.left[at] = static_cast<float>(source.next());
    out.right[at] = mono ? out.left[at] : static_cast<float>(other.next());
  }
  normalise(out.left, 0.5);
  normalise(out.right, 0.5);
  return out;
}

Signal sine_stereo(size_t count, double hz, double amplitude) {
  Signal out;
  out.left.resize(count);
  out.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    const double phase = (2.0 * kPi * hz * static_cast<double>(at)) / kRate;
    out.left[at] = static_cast<float>(amplitude * std::sin(phase));
    out.right[at] = out.left[at];
  }
  return out;
}

double rms(const Signal& signal, size_t from) {
  double total = 0.0;
  for (size_t at = from; at < signal.left.size(); ++at) {
    const double l = static_cast<double>(signal.left[at]);
    const double r = static_cast<double>(signal.right[at]);
    total += l * l + r * r;
  }
  const auto count = static_cast<double>((signal.left.size() - from) * 2);
  return std::sqrt(total / count);
}

/** One DFT bin. The tree's only FFT is in TypeScript, and this is eight lines. */
double bin_magnitude(const std::vector<float>& samples, double hz) {
  const double omega = (2.0 * kPi * hz) / kRate;
  double real = 0.0;
  double imaginary = 0.0;
  for (size_t at = 0; at < kWindow; ++at) {
    const double sample = static_cast<double>(samples[kSettled + at]);
    const double angle = omega * static_cast<double>(at);
    real += sample * std::cos(angle);
    imaginary += sample * std::sin(angle);
  }
  return (2.0 * std::sqrt(real * real + imaginary * imaginary)) /
         static_cast<double>(kWindow);
}

bool identical(const Signal& one, const Signal& other) {
  for (size_t at = 0; at < one.left.size(); ++at) {
    if (one.left[at] != other.left[at] || one.right[at] != other.right[at]) {
      return false;
    }
  }
  return true;
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
  for (const double mix : {0.25, 0.5, 0.75, 1.0}) {
    for (const double sub : {0.0, 0.5, 1.0}) {
      for (const double presence : {0.0, 0.5, 1.0}) {
        FeqBassForgeSettings settings = defaults();
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
        }
      }
    }
  }
  std::printf(
      "       worst deviation %.3f dB at mix %.2f, sub %.2f, presence %.2f\n",
      worst, worst_mix, worst_sub, worst_presence);
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
   * Exact silence multiplies out of every path in this stage whether the floor
   * exists or not, so on its own it proves nothing. A -80 dBFS tone is what a
   * record's noise floor looks like, and a divider with no floor would match
   * its output back up to that tone's own level and put a manufactured octave
   * there. The same measurement at -20 dBFS is the control: the floor has to be
   * a floor rather than an off switch.
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

/** Generated content is mono by construction. An equality, not a tolerance. */
void test_generated_content_is_mono() {
  std::printf("\nbass forge: what it generates is the same in both ears\n");
  // Identical noise in both channels, so the dry band is already mono and any
  // difference at the output is the two generators disagreeing.
  const Signal noise = pink_stereo(kFrames * kBlocks, true);
  const Signal result = process(noise, everything());
  bool same = true;
  for (size_t at = 0; at < result.left.size(); ++at) {
    same = same && result.left[at] == result.right[at];
  }
  check(same, "sample for sample, the two channels are the same signal");
}

/**
 * Reset has to empty the crossover, not only the followers.
 *
 * The chain calls it on a seek and on a device change, and what is sitting in
 * those filters at that moment is the last few milliseconds of something else.
 * Left there it rings out into whatever comes next — and because the output is
 * written as `input + (forged band - dry band)`, a dry band with history in it
 * is SUBTRACTED from the silence rather than decaying into it.
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
  test_reset_clears_the_history();
  test_bands_report_the_band();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass Punch, held to properties rather than to a TypeScript twin.
 *
 * This stage was written in C++ first and has no twin, so there is no earlier
 * behaviour to preserve and a second implementation would exist only to be
 * matched by the first. These properties ARE the specification, and they were
 * written before the stage was.
 *
 * They are chosen so that the ways a transient shaper actually fails are the
 * ways these fail: it is a tone control in disguise, its decay dial is a dial
 * position rather than a decay, its bloom is stereo and cancels in mono, or a
 * control does nothing — which is the failure Forge's `drive_db` shipped with,
 * and the reason each of the four controls here has a test only a working one
 * passes.
 */
#include "fluideq/bass_punch.h"

#include "dsp_test_support.h"

#include <cmath>
#include <cstdio>
#include <vector>

using namespace feq_test;

namespace {

/** 3.2 seconds, which is thirteen pulses of the train below. */
constexpr uint32_t kBlocks = 300;
constexpr size_t kPulsePeriod = 12000;
/** Which pulses are measured: the first four are the cascade filling, and a
 *  number taken from the opening pulse measures that rather than the stage. */
constexpr size_t kFirstMeasured = 4;
constexpr size_t kLastMeasured = 12;

/**
 * The corner these tests run at, and it is the top of the dial on purpose.
 *
 * Every measurement below is of a 60 Hz note, and the gain reaches it through a
 * shelf whose midpoint is this corner — so at 200 Hz the note sits well inside
 * the band and reads most of what the dial asks for, while at 110 it would read
 * about two thirds of it. That is the shelf being a shelf rather than the shaper
 * being weak, and it is why none of these numbers is a claim about the corner
 * itself. `bass_split_test.cpp` is where the corner is measured, because the way
 * this construction can fail is invisible at every frequency except that one.
 */
constexpr double kSplitHz = 200.0;

/** The fit window for the decay measurement. See `measured_decay_ms`. */
constexpr double kFitFromDb = 55.0;
constexpr double kFitToDb = 100.0;

FeqBassPunchSettings defaults() {
  FeqBassPunchSettings settings{};
  settings.enabled = 1;
  settings.split_hz = kSplitHz;
  settings.attack = 0.0;
  settings.sustain = 0.0;
  settings.bloom_amount = 0.0;
  settings.bloom_decay_ms = 120.0;
  settings.duck = 0.0;
  return settings;
}

/** Everything asked for at once, which is where the properties are hardest. */
FeqBassPunchSettings everything() {
  FeqBassPunchSettings settings = defaults();
  settings.attack = 1.0;
  settings.sustain = 1.0;
  settings.bloom_amount = 1.0;
  settings.duck = 1.0;
  return settings;
}

/** One stage and its buffers, so a test can drive it over more than one run. */
struct Stage {
  std::vector<float> low = std::vector<float>(kFrames * 2, 0.0f);
  std::vector<std::vector<float>> lines;
  std::vector<float*> pointers;
  FeqBassPunch state{};
  Stage() {
    const uint32_t capacity = feq_bass_punch_bloom_capacity(kRate);
    lines.assign(FEQ_BASS_PUNCH_BLOOM_LINES,
                 std::vector<float>(capacity, 0.0f));
    pointers.resize(FEQ_BASS_PUNCH_BLOOM_LINES);
    for (size_t at = 0; at < pointers.size(); ++at) {
      pointers[at] = lines[at].data();
    }
    feq_bass_punch_init(&state, low.data(), pointers.data(), capacity);
  }
  void run(Signal& signal, const FeqBassPunchSettings& settings) {
    run_blocks(signal, [this, &settings](float* const* channels) {
      feq_bass_punch_process(&state, channels, 2, kFrames, &settings, kRate);
    });
  }
};

Signal process(const Signal& input, const FeqBassPunchSettings& settings) {
  Signal out = input;
  Stage stage;
  stage.run(out, settings);
  return out;
}

/**
 * A kick, near enough: a decaying 60 Hz burst repeated four times a second.
 *
 * A shaper has nothing to work on in a steady tone and nothing to measure in a
 * single hit. The point of the train is that the followers must come back to
 * where they started between pulses.
 */
Signal pulse_train(double decay_s, double length_s, double amplitude) {
  Signal out;
  const size_t count = kFrames * kBlocks;
  out.left.resize(count);
  out.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    const double seconds = static_cast<double>(at % kPulsePeriod) / kRate;
    double sample = 0.0;
    if (seconds <= length_s) {
      sample = amplitude *
               std::sin(2.0 * kPi * 60.0 * seconds) *
               std::exp(-seconds / decay_s);
    }
    out.left[at] = static_cast<float>(sample);
    out.right[at] = out.left[at];
  }
  return out;
}

/** RMS of one window inside every measured pulse, in the left channel. */
double window_rms(const Signal& signal, double from_s, double to_s) {
  const auto from = static_cast<size_t>(from_s * kRate);
  const auto to = static_cast<size_t>(to_s * kRate);
  double total = 0.0;
  size_t count = 0;
  for (size_t pulse = kFirstMeasured; pulse < kLastMeasured; ++pulse) {
    for (size_t at = from; at < to; ++at) {
      const double sample =
          static_cast<double>(signal.left[pulse * kPulsePeriod + at]);
      total += sample * sample;
      ++count;
    }
  }
  return std::sqrt(total / static_cast<double>(count));
}

/** How far one setting moves a window against the same window at rest. */
double window_change_db(const Signal& shaped, const Signal& flat, double from_s,
                        double to_s) {
  return 20.0 * std::log10(window_rms(shaped, from_s, to_s) /
                           window_rms(flat, from_s, to_s));
}

/**
 * The bloom's decay, by Schroeder backward integration of its own output.
 *
 * The bloom is isolated by difference — the same impulse run at
 * `bloom_amount` 1 and 0, everything else identical and deterministic — so what
 * is measured is exactly what the dial adds and nothing of the direct signal.
 *
 * The fit starts 55 dB down, and that is the part worth explaining. The first
 * taps of the three combs arrive 23.7, 31.1 and 41.3 ms apart, so the head of
 * the response is a build-up rather than a decay and a textbook T30 taken from
 * the peak reads it as a slope it is not — 92 ms for a 40 ms dial, measured.
 * What the feedback relation sets is the ASYMPTOTIC rate, and that is what a fit
 * taken once the onset has passed recovers. There is no noise floor to stop it
 * reaching: this is a synthetic response and the arithmetic under it is double.
 */
double measured_decay_ms(double dial) {
  Signal impulse;
  const size_t count = kFrames * kBlocks;
  impulse.left.assign(count, 0.0f);
  impulse.right.assign(count, 0.0f);
  impulse.left[0] = 1.0f;
  impulse.right[0] = 1.0f;
  FeqBassPunchSettings on = defaults();
  on.bloom_amount = 1.0;
  on.bloom_decay_ms = dial;
  FeqBassPunchSettings off = on;
  off.bloom_amount = 0.0;
  const Signal wet = process(impulse, on);
  const Signal dry = process(impulse, off);

  std::vector<double> energy(count, 0.0);
  double running = 0.0;
  for (size_t at = count; at-- > 0;) {
    const double bloom = static_cast<double>(wet.left[at]) -
                         static_cast<double>(dry.left[at]);
    running += bloom * bloom;
    energy[at] = running;
  }
  const double top = 10.0 * std::log10(std::fmax(energy[0], 1e-300));

  double sum_x = 0.0;
  double sum_y = 0.0;
  double sum_xx = 0.0;
  double sum_xy = 0.0;
  double points = 0.0;
  for (size_t at = 0; at < count; ++at) {
    const double level =
        10.0 * std::log10(std::fmax(energy[at], 1e-300)) - top;
    if (level > -kFitFromDb) {
      continue;
    }
    if (level < -kFitToDb) {
      break;
    }
    const double seconds = static_cast<double>(at) / kRate;
    sum_x += seconds;
    sum_y += level;
    sum_xx += seconds * seconds;
    sum_xy += seconds * level;
    points += 1.0;
  }
  if (points < 10.0) {
    return 0.0;
  }
  const double slope = (points * sum_xy - sum_x * sum_y) /
                       (points * sum_xx - sum_x * sum_x);
  return (-60.0 / slope) * 1000.0;
}

/**
 * Disabled must be bit-exact, not close. The crossover recombines by
 * subtraction precisely so this can be an equality.
 */
void test_disabled_is_bit_exact() {
  std::printf("bass punch: switched off is exactly bypassed\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  FeqBassPunchSettings off = everything();
  off.enabled = 0;
  check(identical(process(noise, off), noise),
        "not one sample moves with the stage switched off");
}

/** All four controls at rest is the same claim through the live path. */
void test_neutral_settings_are_bit_exact() {
  std::printf("\nbass punch: every dial at rest is bypass, through the live "
              "path\n");
  const Signal noise = pink_stereo(kFrames * kBlocks, false);
  check(identical(process(noise, defaults()), noise),
        "the band comes back bit for bit with every filter running");
}

/**
 * The one that stops this becoming an EQ. A steady tone has no transient, so
 * the shaper must settle to doing nothing to it however hard it is driven.
 */
void test_steady_tone_settles_to_unity() {
  std::printf("\nbass punch: a steady note is not a transient\n");
  const Signal note = sine_stereo(kFrames * kBlocks, 60.0, 0.35);
  FeqBassPunchSettings hard = defaults();
  hard.attack = 1.0;
  hard.sustain = 1.0;
  Stage stage;
  Signal out = note;
  stage.run(out, hard);

  // The last second only: the cascade has to converge before it can be said
  // to have converged.
  const size_t from = out.left.size() - static_cast<size_t>(kRate);
  const double moved = 20.0 * std::log10(rms(out, from) / rms(note, from));
  const double transient = feq_bass_punch_transient_db(&stage.state);
  const double sustained = feq_bass_punch_sustain_db(&stage.state);
  std::printf("       output moved %.3f dB; meters read %.3f / %.3f dB\n",
              moved, transient, sustained);
  check(std::fabs(moved) < 0.3, "steady tone is unchanged by the shaper");
  // The audio figure above is the one that says "not a tone control"; this is
  // a looser bound on purpose, because the meter is not the same measurement.
  //
  // It is read once, after the block, so it samples a gain that ripples at
  // twice the note rather than the mean of one. The ripple is what survives
  // `rise > 0 ? rise : 0`: the fast follower rings around the slow one at
  // 2 * 60 Hz and only the positive half of the difference is kept, so the
  // mean of the kept part is not zero however well the followers converge.
  // That residual scales with `kAttackScale` and nothing else — 0.16 dB when
  // the scale was 0.5, 0.38 dB at 1.2 — while the audio it produces stays at
  // 0.04 dB, because the audio integrates the ripple the meter catches one
  // sample of. A bound of 0.3 here was therefore a bound on the scale.
  check(std::fabs(transient) < 0.5 && std::fabs(sustained) < 0.5,
        "and the meters agree that it is doing nothing");
}

/**
 * And the one that proves it does something.
 *
 * -20 dBFS, because a control that only works near full scale is Forge's
 * `drive_db` again. The tail assertion is the other half: `attack` scales how
 * far the fast envelope stands ABOVE the slow one, which is zero once they have
 * met, so it must not reach past the leading edge into the note.
 */
void test_attack_lifts_the_front_of_a_pulse() {
  std::printf("\nbass punch: attack moves the front and only the front\n");
  const Signal train = pulse_train(0.035, 0.12, 0.1);
  FeqBassPunchSettings harder = defaults();
  harder.attack = 1.0;
  FeqBassPunchSettings softer = defaults();
  softer.attack = -1.0;

  const Signal flat = process(train, defaults());
  const Signal hard = process(train, harder);
  const Signal soft = process(train, softer);
  const double front = window_change_db(hard, flat, 0.0, 0.005);
  const double tail = window_change_db(hard, flat, 0.05, 0.12);
  const double cut = window_change_db(soft, flat, 0.0, 0.005);
  std::printf("       attack +1: first 5 ms %+.2f dB, 50-120 ms %+.2f dB\n",
              front, tail);
  std::printf("       attack -1: first 5 ms %+.2f dB\n", cut);
  check(front > 2.0, "the first five milliseconds rise by more than 2 dB");
  check(std::fabs(tail) < 0.5, "and the note after 50 ms is left alone");
  check(cut < -1.0, "a negative attack softens the same five milliseconds");
}

/**
 * The same kick with the bass still playing under it, which is the case every
 * measurement above misses and the one every listener is in.
 *
 * `pulse_train` returns exactly 0.0 between bursts. Both followers therefore
 * collapse to the floor in the gap and the next onset reads a fast-over-slow
 * ratio of 28 dB — against 10 dB for the same kick over an ordinary bassline,
 * and 6 dB where the bass is louder than the kick. Every constant in the stage
 * was fitted against the 28, so `kAttackScale` bought a third of the gain it
 * was sized for on any real programme: the top of the attack dial moved the
 * hit by 2.4 dB, the `slam` profile made the front of the kick 1.3 dB QUIETER
 * than bypass, and the whole stage was reported as doing nothing while every
 * assertion above passed.
 *
 * A silent gap is not a quiet bassline, and this is the positive control that
 * says which of the two is being measured. The threshold is deliberately far
 * under what the stage now delivers (+6.7 dB): what it has to catch is a
 * return to the old calibration, not a tenth of a decibel of drift.
 */
Signal programme_train(double decay_s, double length_s, double amplitude,
                       double bass) {
  Signal out = pulse_train(decay_s, length_s, amplitude);
  for (size_t at = 0; at < out.left.size(); ++at) {
    // 43 Hz shares no factor with the 60 Hz burst, so the two never lock into
    // one envelope and the bassline stays a bassline.
    const double note =
        bass * std::sin(2.0 * kPi * 43.0 * static_cast<double>(at) / kRate);
    out.left[at] = static_cast<float>(out.left[at] + note);
    out.right[at] = static_cast<float>(out.right[at] + note);
  }
  return out;
}

void test_attack_survives_a_bassline() {
  std::printf("\nbass punch: the hit still moves with the bass playing "
              "under it\n");
  // 8 dB under the kick, which is an ordinary balance rather than a hard case.
  const Signal train = programme_train(0.035, 0.12, 0.1, 0.04);
  FeqBassPunchSettings harder = defaults();
  harder.attack = 1.0;

  const Signal flat = process(train, defaults());
  const Signal hard = process(train, harder);
  const double hit = window_change_db(hard, flat, 0.005, 0.015);
  const double tail = window_change_db(hard, flat, 0.05, 0.12);
  std::printf("       attack +1 over a bassline: 5-15 ms %+.2f dB, "
              "50-120 ms %+.2f dB\n",
              hit, tail);
  check(hit > 3.0, "the hit rises by more than 3 dB with programme under it");
  check(std::fabs(tail) < 0.5, "and the note after 50 ms is still left alone");
}

/** Sustain is the other end of the same note, and a stage that ignored it
 *  entirely would pass every assertion above. */
void test_sustain_moves_the_tail() {
  std::printf("\nbass punch: sustain moves the tail and only the tail\n");
  const Signal train = pulse_train(0.06, 0.2, 0.1);
  FeqBassPunchSettings wet = defaults();
  wet.sustain = 1.0;
  FeqBassPunchSettings dry = defaults();
  dry.sustain = -1.0;

  const Signal flat = process(train, defaults());
  const double longer = window_change_db(process(train, wet), flat, 0.08, 0.2);
  const double shorter = window_change_db(process(train, dry), flat, 0.08, 0.2);
  std::printf("       80-200 ms: sustain +1 %+.2f dB, sustain -1 %+.2f dB\n",
              longer, shorter);
  check(longer > 2.0, "a positive sustain lifts the tail by more than 2 dB");
  check(shorter < -0.5, "and a negative one pulls it down");
}

/** `bloom_decay_ms` is a measured decay, not a dial position: the feedback
 *  comes from the reverberation relation so this can be asserted. */
void test_bloom_decay_matches_the_dial() {
  std::printf("\nbass punch: the decay dial is a decay\n");
  for (const double dial : {40.0, 120.0, 250.0}) {
    const double measured = measured_decay_ms(dial);
    const double error = std::fabs(measured - dial) / dial;
    std::printf("       %.0f ms dialled, %.1f ms measured (%.1f%%)\n", dial,
                measured, error * 100.0);
    check(error < 0.15, "measured decay within 15% of the dial");
  }
}

/**
 * And that the dial it decays from arrives at all, at a normal listening level.
 *
 * The gap between pulses is exactly silent with the bloom at zero — the stage
 * recombines its bands by subtraction — so anything measured there came from
 * the bloom and nothing else.
 */
void test_bloom_amount_fills_the_gap() {
  std::printf("\nbass punch: bloom is audible between the notes\n");
  const Signal train = pulse_train(0.02, 0.05, 0.1);
  FeqBassPunchSettings on = defaults();
  on.bloom_amount = 1.0;
  const double silent = window_rms(process(train, defaults()), 0.09, 0.24);
  const double blooming = window_rms(process(train, on), 0.09, 0.24);
  const double note = window_rms(train, 0.0, 0.05);
  std::printf("       90-240 ms after the hit: %.3e off, %.3e on (%.1f dB "
              "under the note)\n",
              silent, blooming, 20.0 * std::log10(blooming / note));
  check(silent == 0.0, "with the bloom at zero the gap is exactly silent");
  check(blooming > note * 0.02, "and at one it carries the note's own decay");
}

/**
 * The bloom is mono in and mono out, so what it adds is the same signal in both
 * ears — bit for bit, because it is one number added to two channels.
 *
 * The channels differ on the way in, because two per-channel blooms fed the
 * same band would evolve identically and pass the naive form of this test.
 *
 * The measurement is taken in the gap between hits, and that is what makes it
 * an equality rather than a tolerance. Subtracting the input from the output
 * does NOT isolate the bloom: the stage writes `input + bloom` and rounds the
 * sum to float, so the rounding differs between channels carrying different
 * inputs and the two deltas disagree in the last bit of a correct stage. In the
 * gap the input is exactly zero and the whole output IS the bloom.
 */
void test_bloom_is_mono() {
  std::printf("\nbass punch: what the bloom adds is the same in both ears\n");
  Signal train = pulse_train(0.02, 0.05, 0.5);
  for (float& sample : train.right) {
    sample *= 0.3f;
  }
  FeqBassPunchSettings on = defaults();
  on.bloom_amount = 1.0;
  const Signal out = process(train, on);

  bool same = true;
  double largest = 0.0;
  const auto from = static_cast<size_t>(0.09 * kRate);
  const auto to = static_cast<size_t>(0.24 * kRate);
  for (size_t pulse = kFirstMeasured; pulse < kLastMeasured; ++pulse) {
    for (size_t at = from; at < to; ++at) {
      const size_t index = pulse * kPulsePeriod + at;
      same = same && out.left[index] == out.right[index];
      largest =
          std::fmax(largest, std::fabs(static_cast<double>(out.left[index])));
    }
  }
  std::printf("       largest bloom sample in the gap: %.4f\n", largest);
  check(same, "the two ears are given the same bloom, sample for sample");
  check(largest > 0.01, "and there was a bloom there to compare");
}

/** The 2 kHz probe every duck measurement below is taken on. */
Signal with_air(Signal base, double amplitude) {
  const Signal air = sine_stereo(base.left.size(), 2000.0, amplitude);
  for (size_t at = 0; at < base.left.size(); ++at) {
    base.left[at] = static_cast<float>(base.left[at] + air.left[at]);
    base.right[at] = static_cast<float>(base.right[at] + air.right[at]);
  }
  return base;
}

/**
 * Duck buys weight without spending headroom, and the way it fails is by
 * buying it once and never giving it back.
 *
 * Its depth used to be a ramp over -45 to -18 dBFS of absolute level, and every
 * real low band sits over -18 dBFS from the first bar to the last — so the
 * ramp was pinned at 1 for every frame of every track and the meter read
 * -6.00 to -6.00 with no movement in it at all. That is a permanent shelf on
 * everything above the split, which is a tone control wearing a ducker's name,
 * and it is what made the profiles cancel: `slam` spent its whole attack
 * undoing a tilt that never released.
 *
 * So the assertion is not "a loud low band ducks by 6 dB" — the old one, which
 * a permanent tilt passes perfectly. It is both halves at once: a steady note
 * moves the upper band by nothing however loud it is, and a kick over that same
 * note takes the depth to the bottom of the dial and gives all of it back
 * before the next one.
 */
void test_duck_is_a_duck_not_a_tilt() {
  std::printf("\nbass punch: duck rides the note instead of tilting the mix\n");
  FeqBassPunchSettings on = defaults();
  on.duck = 1.0;

  // -6 dBFS, which is as present as a low band ever gets, and the old ramp's
  // full depth by a margin of twelve decibels.
  const Signal steady = with_air(sine_stereo(kFrames * kBlocks, 60.0, 0.5), 0.02);
  Stage held;
  Signal flat = steady;
  held.run(flat, on);
  const size_t from = flat.left.size() - static_cast<size_t>(kRate);
  const auto window = static_cast<size_t>(kRate);
  const double still =
      20.0 * std::log10(bin_magnitude(flat.left, 2000.0, from, window) /
                        bin_magnitude(steady.left, 2000.0, from, window));
  std::printf("       steady -6 dBFS note: 2 kHz moved %+.2f dB, meter "
              "%+.2f dB\n",
              still, feq_bass_punch_duck_db(&held.state));
  check(std::fabs(still) < 0.5, "a steady low band is not something to duck");

  // And the case it exists for: a kick landing on a bass line that is already
  // playing, which is the signal the old ramp could not tell from silence.
  const Signal train = with_air(programme_train(0.035, 0.12, 0.3, 0.12), 0.02);
  Stage stage;
  Signal out = train;
  double deepest = 0.0;
  double shallowest = -1.0e9;
  const size_t blocks = out.left.size() / kFrames;
  for (size_t block = 0; block < blocks; ++block) {
    float* channels[2] = {out.left.data() + block * kFrames,
                          out.right.data() + block * kFrames};
    feq_bass_punch_process(&stage.state, channels, 2, kFrames, &on, kRate);
    // After the cascade has filled, for the reason `kFirstMeasured` gives.
    if (block * kFrames < kFirstMeasured * kPulsePeriod) {
      continue;
    }
    const double meter = feq_bass_punch_duck_db(&stage.state);
    deepest = std::fmin(deepest, meter);
    shallowest = std::fmax(shallowest, meter);
  }
  const double pushed =
      20.0 * std::log10(bin_magnitude(out.left, 2000.0, from, window) /
                        bin_magnitude(train.left, 2000.0, from, window));
  std::printf("       kick over that note: meter swings %+.2f to %+.2f dB, "
              "2 kHz averages %+.2f dB\n",
              deepest, shallowest, pushed);
  check(deepest < -5.0, "the hit takes the upper band most of the way down");
  check(shallowest > -0.5, "and it is all given back before the next one");
  check(pushed < -0.3, "and the upper band really was moved, not just metered");
}

/**
 * Reset has to empty the bloom lines, not only the crossover.
 *
 * The chain calls it on a seek and on a device change, and what sits in those
 * delay lines then is up to a quarter of a second of something else — which
 * would arrive over the first notes of wherever the user seeked to.
 */
void test_reset_clears_the_history() {
  std::printf("\nbass punch: reset empties the bloom\n");
  const Signal noise = pink_stereo(kFrames * 8, false);

  const auto first_silent_block = [&noise](bool clear) {
    const FeqBassPunchSettings settings = everything();
    Stage stage;
    Signal loud = noise;
    stage.run(loud, settings);
    if (clear) {
      feq_bass_punch_reset(&stage.state);
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
  check(kept > 1e-5, "and the lines really did have something in them");
}

}  // namespace

int main() {
  std::printf("fluideq bass punch\n");
  test_disabled_is_bit_exact();
  test_neutral_settings_are_bit_exact();
  test_steady_tone_settles_to_unity();
  test_attack_lifts_the_front_of_a_pulse();
  test_attack_survives_a_bassline();
  test_sustain_moves_the_tail();
  test_bloom_decay_matches_the_dial();
  test_bloom_amount_fills_the_gap();
  test_bloom_is_mono();
  test_duck_is_a_duck_not_a_tilt();
  test_reset_clears_the_history();
  return finish();
}

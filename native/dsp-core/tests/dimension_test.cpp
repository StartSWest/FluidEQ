/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dimension, held to properties rather than to a TypeScript twin.
 *
 * Every other processor in this engine is checked against a bit-identical
 * TypeScript implementation, because every other processor was ported from one
 * and the corpus proves the port. This stage was written in C++ first and has
 * no twin, so there is no earlier behaviour to preserve and a second
 * implementation would exist only to be matched by the first.
 *
 * What replaces it has to be stronger than "the two agree", and these are
 * chosen so that the ways this class of processor actually fails are the ways
 * these fail. Each one is an invariant of the design rather than a measurement
 * of the current tuning, so re-voicing the stage should not move any of them.
 */
#include "fluideq/dimension.h"

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
constexpr uint32_t kBlocks = 120;

FeqDimensionSettings defaults() {
  FeqDimensionSettings settings{};
  settings.enabled = 1;
  settings.low_width = 1.0;
  settings.mid_width = 1.0;
  settings.high_width = 1.0;
  settings.low_hz = 200.0;
  settings.high_hz = 3000.0;
  settings.decorrelation = 0.0;
  return settings;
}

/** One run, returning the whole stereo output and what went in. */
struct Run {
  std::vector<float> left;
  std::vector<float> right;
  std::vector<float> source_left;
  std::vector<float> source_right;
  double guard;
};

/**
 * `spread` is how much the two channels differ: 0 is mono, 1 is fully
 * anti-phase. Two tones so there is content in more than one crossover band.
 */
Run run(const FeqDimensionSettings& settings, double spread,
        bool invert_right = false, uint32_t blocks = kBlocks) {
  const uint32_t capacity = feq_dimension_allpass_capacity(kRate);
  std::vector<std::vector<float>> buffers(FEQ_DIMENSION_LINES,
                                          std::vector<float>(capacity, 0.0f));
  std::vector<float*> pointers(FEQ_DIMENSION_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_LINES; ++at) {
    pointers[at] = buffers[at].data();
  }
  FeqDimension state{};
  feq_dimension_init(&state, pointers.data(), capacity);

  Run out;
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  uint64_t position = 0;
  for (uint32_t block = 0; block < blocks; ++block) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const auto n = static_cast<double>(position + at);
      const double bass = 0.35 * std::sin((2.0 * kPi * 90.0 * n) / kRate);
      const double treble = 0.25 * std::sin((2.0 * kPi * 5200.0 * n) / kRate);
      // The bass is common to both channels and the treble is the difference,
      // which is what a real mix looks like: energy centred, air spread.
      left[at] = static_cast<float>(bass + treble);
      // `invert_right` is the pathological case the guard exists for: two
      // channels in opposition, which sums to nothing at all. `spread` alone
      // cannot produce it, because the bass stays common and carries the
      // correlation positive — that mix measures +0.324, which is what a real
      // record looks like rather than a broken one.
      const double opposed = bass + treble * (1.0 - 2.0 * spread);
      right[at] = static_cast<float>(invert_right ? -(bass + treble) : opposed);
    }
    position += kFrames;
    out.source_left.insert(out.source_left.end(), left.begin(), left.end());
    out.source_right.insert(out.source_right.end(), right.begin(), right.end());
    feq_dimension_process(&state, left.data(), right.data(), kFrames, &settings,
                          kRate);
    out.left.insert(out.left.end(), left.begin(), left.end());
    out.right.insert(out.right.end(), right.begin(), right.end());
  }
  out.guard = feq_dimension_guard(&state);
  return out;
}

/**
 * From the first sample, the fade in included.
 *
 * The stage arrives over a crossfade (`FEQ_SPLIT_FADE_MS`), and both sides of
 * it carry the same mid — the stage's own output and the input it fades from
 * — so the mono sum has nothing to blend and no block to be excused.
 */
double worst_mono_error(const Run& result) {
  double worst = 0.0;
  for (size_t at = 0; at < result.left.size(); ++at) {
    const double before =
        (static_cast<double>(result.source_left[at]) +
         static_cast<double>(result.source_right[at])) *
        0.5;
    const double after = (static_cast<double>(result.left[at]) +
                          static_cast<double>(result.right[at])) *
                         0.5;
    const double error = std::fabs(after - before);
    if (error > worst) {
      worst = error;
    }
  }
  return worst;
}

double side_energy(const Run& result, size_t from) {
  double total = 0.0;
  for (size_t at = from; at < result.left.size(); ++at) {
    const double side = (static_cast<double>(result.left[at]) -
                         static_cast<double>(result.right[at])) *
                        0.5;
    total += side * side;
  }
  return total;
}

double worst_difference(const Run& result, size_t from) {
  double worst = 0.0;
  for (size_t at = from; at < result.left.size(); ++at) {
    worst = std::fmax(worst, std::fabs(static_cast<double>(result.left[at]) -
                                       static_cast<double>(result.source_left[at])));
    worst = std::fmax(worst, std::fabs(static_cast<double>(result.right[at]) -
                                       static_cast<double>(result.source_right[at])));
  }
  return worst;
}

/**
 * THE property. Everything else in this stage is a tuning decision; this is
 * the one that decides whether it is safe to put on a master at all.
 *
 * The stage touches the side and nothing else, so `(L+R)/2` must come out at
 * any setting of any dial as exactly the mid it went in as — not close to it,
 * equal to it, to float rounding, and not a phase-turned copy of it either.
 * A level change of any kind there, at any frequency, is a mono listener
 * hearing the width dial; a turn of the whole record's phase is the peaks a
 * master's limiter took off coming back, which the Maximizer after this stage
 * then has to take off again on every beat. A Haas widener, which is what
 * most processors of this kind actually do, fails this by design.
 */
void test_mono_is_untouched() {
  std::printf("dimension: what a mono listener hears does not move\n");

  FeqDimensionSettings wide = defaults();
  wide.low_width = 0.4;
  wide.mid_width = 1.7;
  wide.high_width = 2.0;
  wide.decorrelation = 1.0;
  const double error = worst_mono_error(run(wide, 0.5));
  std::printf("       worst mono error at full width: %.3e\n", error);
  check(error < 1e-6, "the mono sum is the input's at the widest setting");

  FeqDimensionSettings narrow = defaults();
  narrow.low_width = 0.0;
  narrow.mid_width = 0.0;
  narrow.high_width = 0.0;
  check(worst_mono_error(run(narrow, 0.5)) < 1e-6,
        "and the input's with the image collapsed to mono");

  FeqDimensionSettings tilted = defaults();
  tilted.mid_width = 0.3;
  tilted.high_width = 1.9;
  tilted.decorrelation = 0.6;
  check(worst_mono_error(run(tilted, 0.9)) < 1e-6,
        "and the input's on near-anti-phase material");
}

/**
 * Unity in, unity out, which is what makes the check above mean something.
 *
 * A stage that returned its input untouched would pass every mono assertion
 * perfectly. It would also fail this one only if the side's three bands did
 * NOT add back to the side exactly — so this is two controls at once: the
 * bypass is real, and the split reassembles into what it split. From the
 * first sample, because the bands come from first-order low-passes whose
 * differences sum back to the side from their very first output.
 */
void test_unity_is_transparent() {
  std::printf("\ndimension: unity width changes nothing\n");
  const Run result = run(defaults(), 0.5);
  const double worst = worst_difference(result, 0);
  std::printf("       worst sample difference at unity: %.3e\n", worst);
  check(worst < 1e-6,
        "every sample comes out as it went in, to float rounding");
}

/** The positive control: the stage does something when asked. */
void test_width_moves_the_sides() {
  std::printf("\ndimension: width is a control rather than a decoration\n");
  FeqDimensionSettings narrow = defaults();
  narrow.mid_width = 0.25;
  narrow.high_width = 0.25;
  FeqDimensionSettings wide = defaults();
  wide.mid_width = 1.8;
  wide.high_width = 1.8;

  const size_t from = kFrames * 4;
  const double at_unity = side_energy(run(defaults(), 0.5), from);
  const double narrowed = side_energy(run(narrow, 0.5), from);
  const double widened = side_energy(run(wide, 0.5), from);
  std::printf("       side energy: narrow %.4f, unity %.4f, wide %.4f\n",
              narrowed, at_unity, widened);
  check(narrowed < at_unity * 0.5, "narrowing takes energy out of the sides");
  check(widened > at_unity * 1.5, "and widening puts more in");
}

/**
 * Bass cannot be widened, whatever is asked for.
 *
 * Low frequencies carry the energy and none of the localisation, so width down
 * there costs headroom and mono compatibility and buys no image. The setting is
 * clamped in the processor rather than only in the UI, because a stored preset
 * from an older build reaches the engine without passing through the UI at all.
 */
void test_bass_never_widens() {
  std::printf("\ndimension: the bottom cannot be widened\n");
  FeqDimensionSettings asked = defaults();
  asked.low_width = 2.0;
  asked.mid_width = 1.0;
  asked.high_width = 1.0;
  const size_t from = kFrames * 4;
  const double clamped = side_energy(run(asked, 0.5), from);
  const double at_unity = side_energy(run(defaults(), 0.5), from);
  std::printf("       side energy asking 2.0 in the low band: %.4f vs %.4f\n",
              clamped, at_unity);
  check(std::fabs(clamped - at_unity) < at_unity * 0.02,
        "a low width above unity is refused rather than obeyed");
}

/**
 * The guard closes on material that is already out of phase.
 *
 * Scaling the side is safe arithmetic — the mono test above proves that — but
 * on a mix whose channels already disagree, widening takes away what mono was
 * going to hear. The guard is what stops the stage making that worse, and it
 * has to move on the programme rather than on a setting.
 */
void test_guard_closes_on_anti_phase() {
  std::printf("\ndimension: the guard follows the programme\n");
  FeqDimensionSettings wide = defaults();
  wide.mid_width = 2.0;
  wide.high_width = 2.0;

  const Run correlated = run(wide, 0.0);
  const Run opposed = run(wide, 1.0, true);
  std::printf("       guard on mono material %.3f, on anti-phase %.3f\n",
              correlated.guard, opposed.guard);
  check(correlated.guard > 0.9, "wide open on material that agrees");
  check(opposed.guard < 0.35, "and closed on material that cancels");

  // And the closing has to reach the audio, not just the meter. Measured over
  // the last third of the run: the follower takes 400 ms to see the programme
  // change, so the opening of it is the guard closing rather than the guard
  // closed, and averaging that in measures the transition.
  const size_t settled = kFrames * 80;
  const double guarded = side_energy(opposed, settled);
  FeqDimensionSettings unity = defaults();
  const double unguarded = side_energy(run(unity, 1.0, true), settled);
  std::printf("       side energy guarded %.4f vs unguarded %.4f\n", guarded,
              unguarded);
  check(guarded < unguarded * 1.6,
        "so a full-width setting on anti-phase material is pulled back");
}

/**
 * Decorrelation is all-pass: it moves phase and must not move level.
 *
 * A network that changed the side's magnitude would be an equaliser on the
 * sides, which is a different and much less useful processor — and one whose
 * effect would fight the width dial above it. The programme's treble is all
 * side and its centre is the 90 Hz tone under the bass corner, so the side
 * made out of the centre has nothing to add and the reading is the side
 * network's alone.
 */
void test_decorrelation_keeps_its_level() {
  std::printf("\ndimension: decorrelation is phase, not level\n");
  FeqDimensionSettings plain = defaults();
  FeqDimensionSettings shaped = defaults();
  shaped.decorrelation = 1.0;
  const size_t from = kFrames * 8;
  const Run plainRun = run(plain, 1.0);
  const Run shapedRun = run(shaped, 1.0);
  const double before = side_energy(plainRun, from);
  const double after = side_energy(shapedRun, from);
  const double ratio = before > 0.0 ? after / before : 0.0;
  std::printf("       side energy ratio through the all-passes: %.3f\n", ratio);
  check(ratio > 0.8 && ratio < 1.25,
        "the side keeps its energy through the network");

  // And it does change the signal, or it is not decorrelating anything.
  double worst = 0.0;
  for (size_t at = from; at < shapedRun.left.size(); ++at) {
    worst = std::fmax(worst, std::fabs(static_cast<double>(shapedRun.left[at]) -
                                       static_cast<double>(plainRun.left[at])));
  }
  std::printf("       largest change it makes: %.4f\n", worst);
  check(worst > 0.01, "while genuinely changing it");
}

/**
 * A run on broadband noise in the side, with the mid louder than it.
 *
 * The two-tone programme above cannot answer a question about LEVEL through
 * the decorrelation network: one sine measures the network's phase at one
 * frequency, and a blend of a signal with an all-passed copy of itself can
 * land anywhere between cancelling and doubling there. Broadband is the only
 * honest measure of what the blend does to a mix. The mid has to carry more
 * than the side, or the guard reads the programme as out of phase and closes
 * on the very widening being measured — and it is a 40 Hz tone, under the
 * bass corner, so what these readings measure is the side's own network: the
 * side Spread makes out of the centre above that corner has tests of its own.
 */
struct Energies {
  double in;
  double out;
};

Energies side_energies(const FeqDimensionSettings& settings) {
  const uint32_t capacity = feq_dimension_allpass_capacity(kRate);
  std::vector<std::vector<float>> buffers(FEQ_DIMENSION_LINES,
                                          std::vector<float>(capacity, 0.0f));
  std::vector<float*> pointers(FEQ_DIMENSION_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_LINES; ++at) {
    pointers[at] = buffers[at].data();
  }
  FeqDimension state{};
  feq_dimension_init(&state, pointers.data(), capacity);

  // A plain LCG: the same noise on every machine and every run, which a test
  // comparing two energies to half a decibel needs.
  uint32_t seed = 0x9e3779b9u;
  const auto noise = [&seed]() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<double>(seed >> 8) / 8388608.0 - 1.0;
  };

  Energies out{0.0, 0.0};
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  std::vector<double> source_side(kFrames);
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const auto n = static_cast<double>(block * kFrames + at);
      const double centre_sample =
          0.45 * std::sin((2.0 * kPi * 40.0 * n) / kRate);
      const double side_sample = 0.15 * noise();
      source_side[at] = side_sample;
      left[at] = static_cast<float>(centre_sample + side_sample);
      right[at] = static_cast<float>(centre_sample - side_sample);
    }
    feq_dimension_process(&state, left.data(), right.data(), kFrames, &settings,
                          kRate);
    // The first blocks are the filters filling and the widths gliding.
    if (block < 8) {
      continue;
    }
    for (uint32_t at = 0; at < kFrames; ++at) {
      const double after = (static_cast<double>(left[at]) -
                            static_cast<double>(right[at])) *
                           0.5;
      out.in += source_side[at] * source_side[at];
      out.out += after * after;
    }
  }
  return out;
}

double side_ratio(const FeqDimensionSettings& settings) {
  const Energies energies = side_energies(settings);
  return energies.in > 0.0 ? energies.out / energies.in : 0.0;
}

/**
 * The decorrelation dial is a phase control and must not be a level one.
 *
 * It was: mixing the side with an all-passed copy of itself loses energy at
 * every setting between the two ends — -2.7 dB at 0.25, -4.1 dB at 0.45 —
 * because the copy carries a piece of the original inverted. Every profile in
 * the catalogue uses a setting in that range, which is why all of them
 * measured narrower than the stage switched off while their width dials said
 * wider. The old test only ever asked this at 1.0, where the network is a
 * plain all-pass and the loss is zero.
 */
void test_decorrelation_keeps_the_width() {
  std::printf("\ndimension: the width dial survives the decorrelation dial\n");
  const double amounts[] = {0.0, 0.25, 0.45, 0.6, 1.0};
  for (const double amount : amounts) {
    FeqDimensionSettings settings = defaults();
    settings.decorrelation = amount;
    const double ratio = side_ratio(settings);
    std::printf("       decorrelation %.2f: side energy %.3f\n", amount, ratio);
    check(ratio > 0.891 && ratio < 1.122,
          "unity width stays unity through the network");
  }

  FeqDimensionSettings plain = defaults();
  plain.mid_width = 1.2;
  plain.high_width = 1.2;
  FeqDimensionSettings blended = plain;
  blended.decorrelation = 0.5;
  const double dry = side_ratio(plain);
  const double wet = side_ratio(blended);
  std::printf("       a width of 1.2: %.3f dry, %.3f decorrelated\n", dry, wet);
  check(dry > 1.28 && dry < 1.61, "1.2 across the top is worth 1.2");
  check(wet > dry * 0.891 && wet < dry * 1.122,
        "and is still worth 1.2 with the network in the path");
}

/**
 * The level of the side at one frequency, as a ratio of what went in.
 *
 * A sine at `hz` in the side and a louder one at 90 Hz in the mid, which keeps
 * the guard open without putting anything in the band being measured: the mid
 * is never split and the side is exactly `(L-R)/2`, so nothing of it reaches
 * the reading.
 */
double side_gain_at(const FeqDimensionSettings& settings, double hz) {
  const uint32_t capacity = feq_dimension_allpass_capacity(kRate);
  std::vector<std::vector<float>> buffers(FEQ_DIMENSION_LINES,
                                          std::vector<float>(capacity, 0.0f));
  std::vector<float*> pointers(FEQ_DIMENSION_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_LINES; ++at) {
    pointers[at] = buffers[at].data();
  }
  FeqDimension state{};
  feq_dimension_init(&state, pointers.data(), capacity);

  constexpr double kProbe = 0.20;
  constexpr uint32_t kSettleBlocks = 26;
  // A whole number of cycles in the window, for every probe at an integer
  // hertz, so the reading is one bin rather than a bin and its neighbours.
  constexpr size_t kWindow = 48000;
  double real = 0.0;
  double imaginary = 0.0;
  size_t taken = 0;
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  uint64_t position = 0;
  for (uint32_t block = 0; block < kBlocks && taken < kWindow; ++block) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const auto n = static_cast<double>(position + at);
      const double anchor = 0.40 * std::sin((2.0 * kPi * 90.0 * n) / kRate);
      const double probe = kProbe * std::sin((2.0 * kPi * hz * n) / kRate);
      left[at] = static_cast<float>(anchor + probe);
      right[at] = static_cast<float>(anchor - probe);
    }
    feq_dimension_process(&state, left.data(), right.data(), kFrames, &settings,
                          kRate);
    if (block >= kSettleBlocks) {
      for (uint32_t at = 0; at < kFrames && taken < kWindow; ++at) {
        const auto n = static_cast<double>(position + at);
        const double measured = (static_cast<double>(left[at]) -
                                 static_cast<double>(right[at])) *
                                0.5;
        real += measured * std::cos((2.0 * kPi * hz * n) / kRate);
        imaginary += measured * std::sin((2.0 * kPi * hz * n) / kRate);
        ++taken;
      }
    }
    position += kFrames;
  }
  const double amplitude =
      2.0 * std::sqrt(real * real + imaginary * imaginary) /
      static_cast<double>(taken);
  return amplitude / kProbe;
}

/**
 * Where two bands meet, the answer is between the two widths.
 *
 * This is the fault that made the stage worth re-measuring at all. The bands
 * used to be derived by subtraction, which puts them out of step at the
 * corner: with the Laptop profile's bass at 0.4 and its mids at 1.2 the split
 * delivered 1.6 at 260 Hz — wider than either band asked for, and in the one
 * place a profile built to protect a small speaker was trying to be narrow.
 */
void test_bands_meet_without_a_step() {
  std::printf("\ndimension: the bands meet without a step\n");
  FeqDimensionSettings settings = defaults();
  settings.low_hz = 260.0;
  settings.low_width = 0.4;
  settings.mid_width = 1.2;
  settings.high_width = 1.2;

  const double probes[] = {130.0, 184.0, 260.0, 368.0, 520.0};
  double previous = 0.0;
  bool rising = true;
  bool inside = true;
  for (const double hz : probes) {
    const double gain = side_gain_at(settings, hz);
    std::printf("       %5.0f Hz: %.3f\n", hz, gain);
    // Room for the filters' own skirts: 0.4 and 1.2 are the asymptotes, and a
    // probe an octave out is not fully in its band yet.
    inside = inside && gain > 0.38 && gain < 1.23;
    rising = rising && gain > previous;
    previous = gain;
  }
  check(inside, "no frequency is wider or narrower than the widths asked for");
  check(rising, "and the crossing is a climb from one width to the other");
}

/** Off is off: a disabled stage must not touch a sample. */
void test_disabled_is_silent() {
  std::printf("\ndimension: disabled is exactly bypassed\n");
  FeqDimensionSettings off = defaults();
  off.enabled = 0;
  off.mid_width = 2.0;
  off.high_width = 2.0;
  off.decorrelation = 1.0;
  check(worst_difference(run(off, 0.5), 0) == 0.0,
        "not one sample moves with the stage switched off");
}

/**
 * What a mono record comes out as: energies of each channel, of the side and
 * of the mid, past the blocks where the filters fill and the dials glide,
 * and the mono sum's worst departure from the input's.
 */
struct MonoOut {
  double left;
  double right;
  double side;
  double mid;
  double worst_mono_error;
  double worst_channel_difference;
};

/**
 * The same programme in both channels — a mono record, which has no side for
 * the widths or the side's own network to work on. Broadband noise, or a
 * sine at `hz` when one is asked for.
 */
MonoOut mono_record(const FeqDimensionSettings& settings, double hz = 0.0) {
  const uint32_t capacity = feq_dimension_allpass_capacity(kRate);
  std::vector<std::vector<float>> buffers(FEQ_DIMENSION_LINES,
                                          std::vector<float>(capacity, 0.0f));
  std::vector<float*> pointers(FEQ_DIMENSION_LINES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_LINES; ++at) {
    pointers[at] = buffers[at].data();
  }
  FeqDimension state{};
  feq_dimension_init(&state, pointers.data(), capacity);

  uint32_t seed = 0x2545f491u;
  const auto noise = [&seed]() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<double>(seed >> 8) / 8388608.0 - 1.0;
  };

  MonoOut out{0.0, 0.0, 0.0, 0.0, 0.0, 0.0};
  std::vector<float> left(kFrames);
  std::vector<float> right(kFrames);
  std::vector<float> source(kFrames);
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const auto n = static_cast<double>(block * kFrames + at);
      const double sample = hz > 0.0
                                ? 0.4 * std::sin((2.0 * kPi * hz * n) / kRate)
                                : 0.3 * noise();
      source[at] = static_cast<float>(sample);
      left[at] = source[at];
      right[at] = source[at];
    }
    feq_dimension_process(&state, left.data(), right.data(), kFrames, &settings,
                          kRate);
    for (uint32_t at = 0; at < kFrames; ++at) {
      const double l = static_cast<double>(left[at]);
      const double r = static_cast<double>(right[at]);
      out.worst_mono_error = std::fmax(
          out.worst_mono_error,
          std::fabs((l + r) * 0.5 - static_cast<double>(source[at])));
      out.worst_channel_difference =
          std::fmax(out.worst_channel_difference, std::fabs(l - r));
      // The first blocks are the filters filling, the networks warming and
      // the widths gliding.
      if (block < 24) {
        continue;
      }
      out.left += l * l;
      out.right += r * r;
      out.side += ((l - r) * 0.5) * ((l - r) * 0.5);
      out.mid += ((l + r) * 0.5) * ((l + r) * 0.5);
    }
  }
  return out;
}

double decibels(double energy_ratio) {
  return 10.0 * std::log10(std::fmax(energy_ratio, 1e-30));
}

/**
 * Spread makes width out of what the two channels share.
 *
 * The widths only scale the side a record has and the side's network only
 * decorrelates it, so a mono record, or a vocal panned dead centre, came out
 * of every profile exactly as narrow as it went in. The side made out of the
 * centre has to be heard as width — a side within about ten decibels of the
 * mid — while the mono sum stays the input's to float rounding and the centre
 * stays in the centre: a copy of the centre with no delay in the side would
 * make one channel louder than the other, which is a pan.
 */
void test_spread_widens_a_mono_record() {
  std::printf("\ndimension: Spread widens a record that has no side\n");
  const MonoOut none = mono_record(defaults());
  std::printf("       Spread 0: channels differ by at most %.3e\n",
              none.worst_channel_difference);
  check(none.worst_channel_difference == 0.0,
        "with Spread at 0 a mono record stays exactly mono");

  FeqDimensionSettings spread = defaults();
  spread.decorrelation = 0.5;
  const MonoOut made = mono_record(spread);
  const double side_to_mid = decibels(made.side / made.mid);
  const double balance = decibels(made.left / made.right);
  std::printf(
      "       Spread 0.5: side %.1f dB under the mid, left against right "
      "%+.3f dB, mono error %.3e\n",
      -side_to_mid, balance, made.worst_mono_error);
  check(side_to_mid > -11.0 && side_to_mid < -5.0,
        "with Spread at 0.5 it comes out with a side it can be heard by");
  check(made.worst_mono_error < 1e-6, "and the mono sum is still the input's");
  check(std::fabs(balance) < 0.1, "and the centre has not moved to one side");
}

/**
 * The side made out of the centre starts above the bass corner, steeply.
 *
 * Width under the corner is what the low width refuses to make (see
 * `test_bass_never_widens`): the energy lives there and the ear places none
 * of it. A sine at 60 Hz, under a 200 Hz corner, at full Spread, against the
 * same at 1 kHz as the control that the stage is making width at all.
 */
void test_made_side_leaves_the_bass_mono() {
  std::printf("\ndimension: the bass stays mono under Spread\n");
  FeqDimensionSettings full = defaults();
  full.decorrelation = 1.0;
  const MonoOut bass = mono_record(full, 60.0);
  const MonoOut voice = mono_record(full, 1000.0);
  const double bass_side = decibels(bass.side / bass.mid);
  const double voice_side = decibels(voice.side / voice.mid);
  std::printf("       side against mid at full Spread: 60 Hz %.1f dB, "
              "1 kHz %.1f dB\n",
              bass_side, voice_side);
  check(bass_side < -38.0, "60 Hz gets no width worth the name");
  check(voice_side > -6.0, "while 1 kHz does");
}

/**
 * The widths act on the made side as they act on the record's own.
 *
 * All three at 0 is mono whatever Spread says — the made side is side, and
 * narrowing it to nothing leaves nothing. And a top width of 1.8 widens it:
 * white noise has most of its energy over the 3 kHz corner, so the made side
 * comes out well over twice as strong.
 */
void test_widths_shape_the_made_side() {
  std::printf("\ndimension: the widths shape the side made from the centre\n");
  FeqDimensionSettings collapsed = defaults();
  collapsed.decorrelation = 0.5;
  collapsed.low_width = 0.0;
  collapsed.mid_width = 0.0;
  collapsed.high_width = 0.0;
  const MonoOut mono = mono_record(collapsed);
  std::printf("       widths at 0: side %.1f dB under the mid\n",
              -decibels(mono.side / mono.mid));
  check(mono.side < mono.mid * 1e-6, "widths at 0 leave a mono record mono");

  FeqDimensionSettings unity = defaults();
  unity.decorrelation = 0.5;
  FeqDimensionSettings wide = unity;
  wide.high_width = 1.8;
  const double at_unity = mono_record(unity).side;
  const double widened = mono_record(wide).side;
  std::printf("       top width 1.8 against 1.0: side x%.2f\n",
              widened / at_unity);
  check(widened > at_unity * 2.0, "and a top width of 1.8 widens it");
}

}  // namespace

int main() {
  std::printf("fluideq dimension\n");
  test_mono_is_untouched();
  test_unity_is_transparent();
  test_width_moves_the_sides();
  test_bass_never_widens();
  test_guard_closes_on_anti_phase();
  test_decorrelation_keeps_its_level();
  test_decorrelation_keeps_the_width();
  test_bands_meet_without_a_step();
  test_disabled_is_silent();
  test_spread_widens_a_mono_record();
  test_made_side_leaves_the_bass_mono();
  test_widths_shape_the_made_side();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

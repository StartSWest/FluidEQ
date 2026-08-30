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
  std::vector<float> side(kFrames);
  std::vector<float> low(kFrames);
  std::vector<float> mid(kFrames);
  std::vector<float> high(kFrames);
  std::vector<float> wet(kFrames);
  std::vector<std::vector<float>> buffers(FEQ_DIMENSION_ALLPASSES,
                                          std::vector<float>(capacity, 0.0f));
  std::vector<float*> pointers(FEQ_DIMENSION_ALLPASSES, nullptr);
  for (uint32_t at = 0; at < FEQ_DIMENSION_ALLPASSES; ++at) {
    pointers[at] = buffers[at].data();
  }

  FeqDimension state{};
  feq_dimension_init(&state, side.data(), low.data(), mid.data(), high.data(),
                     wet.data(), pointers.data(), capacity);

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

double worst_mono_error(const Run& result) {
  double worst = 0.0;
  for (size_t at = 0; at < result.left.size(); ++at) {
    const double before = (static_cast<double>(result.source_left[at]) +
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
 * The stage touches the side and nothing else, so `(L+R)/2` must come out bit
 * for bit as it went in, at any setting of any dial. Not close — equal, to
 * float rounding. A Haas widener, which is what most processors of this kind
 * actually do, fails this by design.
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
  check(error < 1e-6, "the mono sum is unchanged at the widest setting");

  FeqDimensionSettings narrow = defaults();
  narrow.low_width = 0.0;
  narrow.mid_width = 0.0;
  narrow.high_width = 0.0;
  check(worst_mono_error(run(narrow, 0.5)) < 1e-6,
        "and unchanged with the image collapsed to mono");

  FeqDimensionSettings tilted = defaults();
  tilted.mid_width = 0.3;
  tilted.high_width = 1.9;
  tilted.decorrelation = 0.6;
  check(worst_mono_error(run(tilted, 0.9)) < 1e-6,
        "and unchanged on near-anti-phase material");
}

/**
 * Unity in, unity out, which is what makes the check above mean something.
 *
 * A stage that returned its input untouched would pass every mono assertion
 * perfectly. It would also fail this one only if the crossover did NOT sum back
 * exactly — so this is two controls at once: the bypass is real, and the three
 * bands of the side reassemble into the side.
 */
void test_unity_is_transparent() {
  std::printf("\ndimension: unity width changes nothing\n");
  const Run result = run(defaults(), 0.5);
  // From the second block: the crossover's filters start with empty history.
  const double worst = worst_difference(result, kFrames * 2);
  std::printf("       worst sample difference at unity: %.3e\n", worst);
  check(worst < 1e-5,
        "the three side bands recombine into the side they came from");
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
 * effect would fight the width dial above it.
 */
void test_decorrelation_keeps_its_level() {
  std::printf("\ndimension: decorrelation is phase, not level\n");
  FeqDimensionSettings plain = defaults();
  FeqDimensionSettings shaped = defaults();
  shaped.decorrelation = 1.0;
  const size_t from = kFrames * 8;
  const Run plainRun = run(plain, 0.5);
  const Run shapedRun = run(shaped, 0.5);
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

}  // namespace

int main() {
  std::printf("fluideq dimension\n");
  test_mono_is_untouched();
  test_unity_is_transparent();
  test_width_moves_the_sides();
  test_bass_never_widens();
  test_guard_closes_on_anti_phase();
  test_decorrelation_keeps_its_level();
  test_disabled_is_silent();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What both bass stages' Isolate actually plays, held to an identity rather
 * than to a level.
 *
 * The failure a monitor can have that nothing else can is being plausible: it
 * makes a sound, the sound changes when the dials move, and it is not what the
 * stage is doing. A test that only asserts "isolate is not silent" passes for
 * a monitor wired to the low band, to the dry signal, or to a second copy of
 * the generators that has drifted from the one in the audio path.
 *
 * So the assertion here is the one that cannot pass by accident:
 *
 *     isolate_output + original_input == normal_output
 *
 * sample for sample. Both stages write `input + contribution`, and Isolate
 * writes the same `contribution` alone, so the sum reconstructs the processed
 * signal exactly and any second path would show up as a residual. That is also
 * the definition the EQ and Denoise already use, which is why Isolate means the
 * same thing on four stages instead of three things on four stages.
 *
 * Two consequences fall out of the identity and are asserted beside it. At
 * rest the contribution is exactly zero, so Isolate is digital silence — the
 * honest reading of a stage doing nothing, and the one a level-only test would
 * have to special-case. And with the dials up it is loudly non-silent, which
 * is the part a listener checks by toggling the switch.
 */
#include "fluideq/bass_forge.h"
#include "fluideq/bass_punch.h"

#include "dsp_test_support.h"

#include <cmath>
#include <cstdio>
#include <vector>

using namespace feq_test;

namespace {

constexpr uint32_t kBlocks = 200;
constexpr size_t kSettled = kFrames * 100;
constexpr double kSplitHz = 120.0;

/** One Forge stage and its buffers. */
struct ForgeStage {
  std::vector<float> low = std::vector<float>(kFrames * 2, 0.0f);
  std::vector<float> scratch = std::vector<float>(kFrames * 2, 0.0f);
  FeqBassForge state{};
  ForgeStage() { feq_bass_forge_init(&state, low.data(), scratch.data()); }
  void run(Signal& signal, const FeqBassForgeSettings& settings) {
    run_blocks(signal, [this, &settings](float* const* channels) {
      feq_bass_forge_process(&state, channels, 2, kFrames, &settings, kRate);
    });
  }
};

/** One Punch stage and its buffers. */
struct PunchStage {
  std::vector<float> low = std::vector<float>(kFrames * 2, 0.0f);
  std::vector<std::vector<float>> lines;
  std::vector<float*> pointers;
  FeqBassPunch state{};
  PunchStage() {
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

FeqBassForgeSettings forge_defaults() {
  FeqBassForgeSettings settings{};
  settings.enabled = 1;
  settings.isolate = 0;
  settings.meters = 0;
  settings.split_hz = kSplitHz;
  settings.drive_db = 0.0;
  settings.sub_amount = 0.0;
  settings.presence_amount = 0.0;
  settings.texture = 0.8;
  settings.mix = 0.0;
  return settings;
}

FeqBassPunchSettings punch_defaults() {
  FeqBassPunchSettings settings{};
  settings.enabled = 1;
  settings.isolate = 0;
  settings.split_hz = kSplitHz;
  settings.attack = 0.0;
  settings.sustain = 0.0;
  settings.bloom_amount = 0.0;
  settings.bloom_decay_ms = 120.0;
  settings.duck = 0.0;
  return settings;
}

/** A kick-shaped source: the material both stages are voiced against. */
Signal kicks() {
  Signal out = sine_stereo(kFrames * kBlocks, 60.0, 0.5);
  const size_t period = static_cast<size_t>(kRate / 4.0);
  for (size_t at = 0; at < out.left.size(); ++at) {
    const double phase =
        static_cast<double>(at % period) / static_cast<double>(period);
    const double envelope = std::exp(-phase * 12.0);
    out.left[at] = static_cast<float>(out.left[at] * envelope);
    out.right[at] = static_cast<float>(out.right[at] * envelope);
  }
  return out;
}

double peak_from(const Signal& signal, size_t from) {
  double worst = 0.0;
  for (size_t at = from; at < signal.left.size(); ++at) {
    worst = std::fmax(worst, std::fabs(static_cast<double>(signal.left[at])));
    worst = std::fmax(worst, std::fabs(static_cast<double>(signal.right[at])));
  }
  return worst;
}

/**
 * The identity, for one stage at one setting.
 *
 * `residual` is the worst absolute difference between `isolated + input` and
 * the normally processed output. Both runs start from an identical stage, so
 * any smoother, follower or delay line reaches the same place at the same
 * sample and the two are comparable term by term.
 *
 * The tolerance is a float epsilon rather than zero because the two paths sum
 * their terms in a different ORDER — `input + c` against `c` then `+ input` —
 * and IEEE addition is not associative. It is not a tolerance for a second
 * signal path, which would be off by orders of magnitude rather than by an
 * ulp.
 */
template <typename Stage, typename Settings>
double identity_residual(const Signal& input, Settings settings) {
  Signal normal = input;
  settings.isolate = 0;
  Stage{}.run(normal, settings);

  Signal isolated = input;
  settings.isolate = 1;
  Stage{}.run(isolated, settings);

  double worst = 0.0;
  for (size_t at = kSettled; at < input.left.size(); ++at) {
    const double rebuilt = static_cast<double>(isolated.left[at]) +
                           static_cast<double>(input.left[at]);
    worst = std::fmax(worst,
                      std::fabs(rebuilt - static_cast<double>(normal.left[at])));
  }
  return worst;
}

/** Silence, to the last bit, is what a stage doing nothing must monitor as. */
template <typename Stage, typename Settings>
bool isolate_is_exactly_silent(const Signal& input, Settings settings) {
  Signal isolated = input;
  settings.isolate = 1;
  Stage{}.run(isolated, settings);
  for (size_t at = 0; at < isolated.left.size(); ++at) {
    if (isolated.left[at] != 0.0f || isolated.right[at] != 0.0f) {
      return false;
    }
  }
  return true;
}

void test_forge_isolate_is_the_contribution() {
  std::printf("bass isolate: Forge plays exactly what it adds\n");
  const Signal input = kicks();

  FeqBassForgeSettings working = forge_defaults();
  working.sub_amount = 0.9;
  working.presence_amount = 0.7;
  working.drive_db = 6.0;
  working.mix = 1.0;

  const double residual =
      identity_residual<ForgeStage>(input, working);
  check(residual < 1e-6,
        "isolated + input reconstructs the processed output");

  // The positive control the identity needs: a monitor that played silence
  // would satisfy the identity only if the stage were also doing nothing, so
  // this asserts the stage IS doing something at these settings.
  Signal isolated = input;
  working.isolate = 1;
  ForgeStage{}.run(isolated, working);
  const double heard = peak_from(isolated, kSettled);
  check(heard > 0.01, "and what it plays is loudly audible, not silence");

  std::printf("  residual %.3g, isolated peak %.4f\n", residual, heard);
}

void test_forge_isolate_at_rest_is_silence() {
  std::printf("bass isolate: Forge at a mix of zero monitors as silence\n");
  const Signal input = kicks();
  check(isolate_is_exactly_silent<ForgeStage>(input, forge_defaults()),
        "a mix of zero adds nothing, so there is nothing to hear");

  // Without this the test above passes for a monitor that is simply muted.
  FeqBassForgeSettings working = forge_defaults();
  working.sub_amount = 1.0;
  working.mix = 1.0;
  check(!isolate_is_exactly_silent<ForgeStage>(input, working),
        "and it is not silent once the generators are asked for something");
}

void test_punch_isolate_is_the_contribution() {
  std::printf("bass isolate: Punch plays exactly what it adds\n");
  const Signal input = kicks();

  FeqBassPunchSettings working = punch_defaults();
  working.attack = 1.0;
  working.sustain = 0.5;
  working.bloom_amount = 0.6;
  working.duck = 0.8;

  const double residual =
      identity_residual<PunchStage>(input, working);
  check(residual < 1e-6,
        "isolated + input reconstructs the processed output");

  Signal isolated = input;
  working.isolate = 1;
  PunchStage{}.run(isolated, working);
  const double heard = peak_from(isolated, kSettled);
  check(heard > 0.01, "and what it plays is loudly audible, not silence");

  std::printf("  residual %.3g, isolated peak %.4f\n", residual, heard);
}

void test_punch_isolate_at_rest_is_silence() {
  std::printf("bass isolate: Punch at rest monitors as silence\n");
  const Signal input = kicks();
  check(isolate_is_exactly_silent<PunchStage>(input, punch_defaults()),
        "every dial at rest contributes nothing, so there is nothing to hear");

  FeqBassPunchSettings working = punch_defaults();
  working.attack = 1.0;
  check(!isolate_is_exactly_silent<PunchStage>(input, working),
        "and it is not silent once the shaper is asked for something");
}

/**
 * The monitor is not the band.
 *
 * The tempting implementation — solo the crossover band — passes every level
 * test above and is wrong, because a band plays whether the stage is working
 * or not. This is what separates the two: at settings that do almost nothing,
 * a band solo is still loud and a contribution monitor is not.
 */
void test_isolate_is_not_a_band_solo() {
  std::printf("bass isolate: it monitors the work, not the band\n");
  const Signal input = kicks();

  FeqBassForgeSettings barely = forge_defaults();
  barely.sub_amount = 1.0;
  barely.mix = 0.02;
  Signal quiet = input;
  barely.isolate = 1;
  ForgeStage{}.run(quiet, barely);

  FeqBassForgeSettings fully = forge_defaults();
  fully.sub_amount = 1.0;
  fully.mix = 1.0;
  Signal loud = input;
  fully.isolate = 1;
  ForgeStage{}.run(loud, fully);

  const double small = peak_from(quiet, kSettled);
  const double large = peak_from(loud, kSettled);
  // A band solo would read the same at both settings, because the band is the
  // same band. Ten to one is far beyond any difference a solo could show.
  check(large > small * 10.0,
        "a near-zero mix monitors far quieter than a full one");
  std::printf("  mix 0.02 peak %.5f against mix 1.0 peak %.5f\n", small, large);
}

}  // namespace

int main() {
  test_forge_isolate_is_the_contribution();
  test_forge_isolate_at_rest_is_silence();
  test_punch_isolate_is_the_contribution();
  test_punch_isolate_at_rest_is_silence();
  test_isolate_is_not_a_band_solo();
  return finish();
}

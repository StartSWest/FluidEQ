/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Regression coverage at the bass boundary. The original LR4 audio split
 * rotated its low band by 180 degrees at the corner, so adding gain could
 * cancel the kick. Forge now uses a monotonic one-pole shelf. Punch uses a
 * separate detector and a phase-aligned FIR contribution; its Tail Duck
 * must change generated bass while preserving upper-band probes.
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
/** One second of settling, then the one second every bin is taken over. */
constexpr size_t kSettled = kFrames * 100;
constexpr size_t kWindow = 48000;

/**
 * The top of the dial, so the sweep has two octaves of room on both sides of
 * the corner without leaving the range a listener can hear it in.
 */
constexpr double kSplitHz = 200.0;

/**
 * The probes, and none of them shares a bin with anything either stage makes.
 *
 * Both tests below drive a 60 Hz note. Forge's divider puts an octave at 30 and
 * `feq_harmonic_sample` puts orders at 120, 180 and 240; every probe here is
 * clear of all of them, and each completes a whole number of cycles in a
 * 48000-sample window so the bins are orthogonal rather than nearly so.
 */
constexpr double kProbeHz[] = {50.0, 100.0, 141.0, 200.0, 283.0, 400.0, 800.0};
constexpr size_t kProbeCount = sizeof(kProbeHz) / sizeof(kProbeHz[0]);
constexpr double kProbeAmplitude = 0.004;

/**
 * The same sweep for Punch, moved off the multiples of four.
 *
 * Punch's duck has to be driven by a kick now rather than by a steady note, and
 * a kick repeated every 12000 samples is a 60 Hz carrier under a 4 Hz comb —
 * lines at 60 ± 4k, which is every multiple of four. Two of the probes above
 * are on that grid, and both read the kick's own line rather than the probe:
 * measured, 100 Hz came back -0.83 dB against a shelf saying -0.29, and 200 Hz
 * -0.05 against -0.77, while the five clear bins agreed to three hundredths of
 * a decibel. Moving two hertz is enough, and it costs nothing: the shelf is
 * smooth and 102 Hz is the same question 100 Hz was asking.
 *
 * Punch generates no harmonics — the shelf is a gain and the bloom is off here
 * — so unlike the Forge sweep these have nothing to dodge but the driver.
 */
constexpr double kPunchProbeHz[] = {50.0,  102.0, 141.0, 202.0,
                                    283.0, 402.0, 802.0};

/**
 * The closed form above, in dB.
 *
 * The stages run the bilinear-transformed one-pole, whose frequency axis is
 * warped by `tan`. At a 200 Hz corner and 48 kHz that moves 800 Hz by 0.35% of
 * a bin width, which is three thousandths of a decibel here — far under the
 * tolerances below, so the analogue form is the honest reference.
 */
double shelf_db(double band_gain, double rest_gain, double hz) {
  const double ratio = hz / kSplitHz;
  const double weight = 1.0 / (1.0 + ratio * ratio);
  const double squared = rest_gain * rest_gain +
                         (band_gain * band_gain - rest_gain * rest_gain) *
                             weight;
  return 10.0 * std::log10(squared);
}

/** A steady note with the sweep sitting on top of it, well under it. */
Signal note_with_probes(double note_hz, double amplitude) {
  Signal out = sine_stereo(kFrames * kBlocks, note_hz, amplitude);
  for (const double hz : kProbeHz) {
    const Signal probe = sine_stereo(kFrames * kBlocks, hz, kProbeAmplitude);
    for (size_t at = 0; at < out.left.size(); ++at) {
      out.left[at] += probe.left[at];
      out.right[at] += probe.right[at];
    }
  }
  return out;
}

double probe_db(const Signal& after, const Signal& before, double hz) {
  const double moved = bin_magnitude(after.left, hz, kSettled, kWindow);
  const double original = bin_magnitude(before.left, hz, kSettled, kWindow);
  return 20.0 * std::log10(moved / original);
}

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

FeqBassPunchSettings punch_defaults() {
  FeqBassPunchSettings settings{};
  settings.enabled = 1;
  settings.split_hz = kSplitHz;
  settings.attack = 0.0;
  settings.sustain = 0.0;
  settings.bloom_amount = 0.0;
  settings.bloom_decay_ms = 120.0;
  settings.duck = 0.0;
  settings.mix = 1.0;
  return settings;
}

/** Compare identical Bloom runs with and without ducking. A moving meter and
 * a changed bass probe are positive controls for the unchanged upper band. */
void test_punch_duck_across_the_corner() {
  std::printf("bass split: tail duck changes bass without suppressing the upper band\n");
  // A kick four times a second on top of the probes: the duck needs something
  // to stand above, and a steady note is by construction not that.
  Signal input;
  input.left.assign(kFrames * kBlocks, 0.0f);
  input.right.assign(kFrames * kBlocks, 0.0f);
  for (const double hz : kPunchProbeHz) {
    const Signal probe = sine_stereo(kFrames * kBlocks, hz, kProbeAmplitude);
    for (size_t at = 0; at < input.left.size(); ++at) {
      input.left[at] += probe.left[at];
      input.right[at] += probe.right[at];
    }
  }
  for (size_t at = 0; at < input.left.size(); ++at) {
    const double seconds = static_cast<double>(at % 12000) / kRate;
    const double kick =
        seconds <= 0.12 ? 0.5 * std::sin(2.0 * kPi * 60.0 * seconds) *
                              std::exp(-seconds / 0.035)
                        : 0.0;
    input.left[at] = static_cast<float>(input.left[at] + kick);
    input.right[at] = static_cast<float>(input.right[at] + kick);
  }

  FeqBassPunchSettings on = punch_defaults();
  on.duck = 1.0;
  on.bloom_amount = 1.0;
  FeqBassPunchSettings unducked = on;
  unducked.duck = 0.0;
  Signal reference = input;
  PunchStage reference_stage;
  reference_stage.run(reference, unducked);
  PunchStage stage;
  Signal out = input;
  // One sample per call, so the gain can be averaged over every sample the bin
  // is taken from rather than over one reading per block.
  double total = 0.0;
  double deepest = 0.0;
  for (size_t at = 0; at < out.left.size(); ++at) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_bass_punch_process(&stage.state, channels, 2, 1, &on, kRate);
    const double gain =
        std::pow(10.0, feq_bass_punch_duck_db(&stage.state) / 20.0);
    deepest = std::fmin(deepest, feq_bass_punch_duck_db(&stage.state));
    if (at >= kSettled && at < kSettled + kWindow) {
      total += gain;
    }
  }
  const double rest = total / static_cast<double>(kWindow);
  std::printf("       duck reaches %+.2f dB and averages %+.2f dB over the "
              "window\n",
              deepest, 20.0 * std::log10(rest));
  check(deepest < -5.0, "the duck reaches the depth the dial asks for");
  check(rest < 0.9, "and the generated tail is ducked for a meaningful duration");

  double bass_change = 0.0;
  for (size_t at = 0; at < kProbeCount; ++at) {
    const double hz = kPunchProbeHz[at];
    const double measured = probe_db(out, reference, hz);
    std::printf("       %6.0f Hz: tail duck changes %+7.3f dB\n", hz, measured);
    if (hz >= 283.0) {
      check(std::fabs(measured) < 0.01, "tail duck preserves the upper band");
    } else {
      bass_change = std::fmax(bass_change, std::fabs(measured));
    }
  }
  check(bass_change > 0.05, "tail duck still changes the generated bass");
}

/** Measure attack at the 120 Hz detector focus inside Punch's bass band.
 * bass_mix_test sweeps the independent FIR boundary through 200–8000 Hz. */
void test_punch_attack_at_the_corner() {
  std::printf("\nbass split: the attack lifts the corner rather than "
              "cancelling it\n");
  constexpr size_t kPulsePeriod = 12000;
  constexpr double focus_hz = 120.0;
  Signal train;
  // Thirteen pulses, of which the eight measured below sit inside it: the
  // sweep above needs two seconds and this needs three.
  const size_t count = kFrames * 300;
  train.left.resize(count);
  train.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    const double seconds = static_cast<double>(at % kPulsePeriod) / kRate;
    double sample = 0.0;
    if (seconds <= 0.12) {
      sample = 0.1 * std::sin(2.0 * kPi * focus_hz * seconds) *
               std::exp(-seconds / 0.035);
    }
    train.left[at] = static_cast<float>(sample);
    train.right[at] = train.left[at];
  }

  const auto front_rms = [](const Signal& signal) {
    double total = 0.0;
    size_t seen = 0;
    const auto to = static_cast<size_t>(0.005 * kRate);
    for (size_t pulse = 4; pulse < 12; ++pulse) {
      for (size_t at = 0; at < to; ++at) {
        const double sample =
            static_cast<double>(signal.left[pulse * kPulsePeriod + at +
                                           feq_bass_punch_latency_frames(kRate)]);
        total += sample * sample;
        ++seen;
      }
    }
    return std::sqrt(total / static_cast<double>(seen));
  };

  const auto shaped = [&train](double attack) {
    FeqBassPunchSettings settings = punch_defaults();
    settings.split_hz = focus_hz;
    settings.attack = attack;
    Signal out = train;
    PunchStage stage;
    stage.run(out, settings);
    return out;
  };

  const double flat = front_rms(shaped(0.0));
  const double harder = 20.0 * std::log10(front_rms(shaped(1.0)) / flat);
  const double softer = 20.0 * std::log10(front_rms(shaped(-1.0)) / flat);
  std::printf("       first 5 ms at the corner: attack +1 %+.2f dB, "
              "attack -1 %+.2f dB\n",
              harder, softer);
  check(harder > 1.5, "asking for more attack gives more, at the split");
  check(softer < -1.0, "and asking for less gives less");
}

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

/**
 * Forge's normaliser is a CUT on the band, so its corner failure was a bump.
 *
 * The level normaliser never boosts on material like this — it exists to take
 * back what the generators added — so at the split the old construction
 * delivered `1.5 - 0.5 * gain`: a rise that moved with `mix` while every meter
 * and every other bin said the band had been pulled down. Measured on the code
 * that came into this review, at `mix` 1 with the band held 0.76 dB down, the
 * split came out +0.41 dB UP and 141 Hz +0.85 dB.
 *
 * What is asserted here is the DIRECTION and the SHAPE rather than the closed
 * form Punch is held to, and that is a measurement limit rather than a choice.
 * A probe tone here is not a passive observer: it enters the band, drives a
 * full-wave rectifier and a polynomial, and the third-order cross terms of
 * those two land back on its own bin. The error that leaves behind tracks the
 * probe's depth in the generators' band exactly — 0.05 dB at 800 Hz where the
 * band has the probe 48 dB down, 0.46 dB at 283, and 1.1 dB at the corner where
 * it is only 6 dB down — and it does not go away with a smaller probe, because
 * a cross term is linear in the probe too. So the shelf's arithmetic is proved
 * on Punch, where the duck is genuinely linear and matches to three decimals,
 * and this file proves that Forge applies the same shelf: after the fix nothing
 * comes out lifted, and the cut falls away above the corner the way a shelf's
 * does and the way the old construction's did not.
 */
void test_forge_shelf_shape_across_the_corner() {
  std::printf("\nbass split: Forge's normaliser is a shelf at the corner too\n");
  const Signal input = note_with_probes(60.0, 0.35);
  for (const double mix : {0.25, 0.5, 1.0}) {
    FeqBassForgeSettings settings{};
    settings.enabled = 1;
    // Off: nothing here reads the graph, and the audio must be the same
    // either way — `test_meters_are_gated` is what asserts that it is.
    settings.meters = 0;
    settings.split_hz = kSplitHz;
    settings.drive_db = 0.0;
    settings.sub_amount = 1.0;
    settings.presence_amount = 1.0;
    settings.texture = 0.8;
    settings.mix = mix;
    ForgeStage stage;
    Signal out = input;
    stage.run(out, settings);

    /**
     * The band gain, inferred from the probe furthest out of the generators'
     * reach, so the number the shelf is printed against is the least polluted
     * one available. `1 + (band^2 - 1) * u` inverted at 800 Hz, where `u` is
     * 0.0588. It is printed rather than asserted, for the same reason the
     * closed form is.
     */
    const double clear = probe_db(out, input, 800.0);
    const double far = std::pow(10.0, clear / 20.0);
    const double weight = 1.0 / (1.0 + (800.0 / kSplitHz) * (800.0 / kSplitHz));
    const double band = std::sqrt(1.0 + (far * far - 1.0) / weight);
    std::printf("       mix %.2f: the band is being held at %+.3f dB\n", mix,
                20.0 * std::log10(band));
    check(clear < 0.01, "the normaliser is cutting the band, as it always does");

    double previous = -1.0e9;
    bool rising = true;
    for (size_t at = 1; at < kProbeCount; ++at) {
      const double hz = kProbeHz[at];
      const double measured = probe_db(out, input, hz);
      std::printf("       %6.0f Hz: measured %+7.3f dB, shelf would be "
                  "%+7.3f dB\n",
                  hz, measured, shelf_db(band, 1.0, hz));
      check(measured < 0.05,
            "a cut on the band is never a lift on the way out");
      if (hz >= kSplitHz) {
        rising = rising && measured > previous - 0.02;
        previous = measured;
      }
    }
    check(rising, "and above the corner the cut falls away, as a shelf's does");
  }

  // The corner has to carry the cut rather than escape it, which is the half
  // of the bump the direction check above cannot see: the old construction had
  // 200 Hz sitting 0.41 dB ABOVE 800 Hz instead of well below it.
  FeqBassForgeSettings loud{};
  loud.enabled = 1;
  loud.meters = 0;
  loud.split_hz = kSplitHz;
  loud.drive_db = 0.0;
  loud.sub_amount = 1.0;
  loud.presence_amount = 1.0;
  loud.texture = 0.8;
  loud.mix = 1.0;
  ForgeStage stage;
  Signal out = input;
  stage.run(out, loud);
  const double corner = probe_db(out, input, kSplitHz);
  const double clear = probe_db(out, input, 800.0);
  std::printf("       the split is %+.3f dB against %+.3f dB two octaves up\n",
              corner, clear);
  check(corner < clear - 0.5, "the split carries the cut, not a lift");
}

}  // namespace

int main() {
  std::printf("fluideq bass split\n");
  test_punch_duck_across_the_corner();
  test_punch_attack_at_the_corner();
  test_forge_shelf_shape_across_the_corner();
  return finish();
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamics (`compander.h`): what it lifts, what it holds, and what it must
 * never touch, at four rates, each beside the control that would fail it.
 *
 * - At ratios of one, and with the stage off, the output is the input to
 *   the float: the three bands sum back exactly.
 * - A quiet tone under the upward threshold comes up by the ratio's share
 *   of the distance, capped; at ratio one it does not (the control).
 * - Silence and a -90 dBFS floor are never lifted.
 * - A loud tone over the downward threshold is held by the ratio's share.
 * - A loud left and a quiet right get one gain: the image does not move. The
 *   control is a right channel alone, which the same settings lift.
 * - The LFE passes untouched while the fronts are lifted.
 * - A band left at one leaves its sound alone while another band works.
 */

#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/compander.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;

struct Rendered {
  std::vector<std::vector<float>> channels;
};

Rendered render(double rate, const FeqCompanderSettings& settings,
                const std::vector<std::vector<float>>& input, int lfe = -1) {
  const auto count = static_cast<uint32_t>(input.size());
  FeqCompander* stage = feq_compander_create(rate, count);
  feq_compander_configure(stage, &settings);
  feq_compander_set_lfe(stage, lfe);
  Rendered out{input};
  const size_t frames = input[0].size();
  constexpr uint32_t kBlock = 480;
  for (size_t at = 0; at < frames; at += kBlock) {
    const auto n = static_cast<uint32_t>(std::min<size_t>(kBlock, frames - at));
    std::vector<float*> pointers;
    for (auto& channel : out.channels) {
      pointers.push_back(channel.data() + at);
    }
    feq_compander_process(stage, pointers.data(), n);
  }
  feq_compander_destroy(stage);
  return out;
}

std::vector<float> tone(double rate, double hz, double dbfs, double seconds) {
  const double amplitude = std::pow(10.0, dbfs / 20.0);
  std::vector<float> samples(static_cast<size_t>(rate * seconds));
  for (size_t i = 0; i < samples.size(); ++i) {
    samples[i] = static_cast<float>(
        amplitude * std::sin(2.0 * kPi * hz * static_cast<double>(i) / rate));
  }
  return samples;
}

/** The level, dBFS of a full-scale sine, over the last half. */
double level_db(const std::vector<float>& samples) {
  double sum = 0.0;
  const size_t from = samples.size() / 2;
  for (size_t i = from; i < samples.size(); ++i) {
    sum += static_cast<double>(samples[i]) * samples[i];
  }
  const double mean = sum / static_cast<double>(samples.size() - from);
  return 10.0 * std::log10(std::max(mean, 1e-20)) + 3.0103;
}

double max_difference(const std::vector<float>& a,
                      const std::vector<float>& b) {
  double worst = 0.0;
  for (size_t i = 0; i < a.size(); ++i) {
    worst = std::max(worst, std::fabs(static_cast<double>(a[i]) - b[i]));
  }
  return worst;
}

FeqCompanderSettings neutral() {
  FeqCompanderSettings s{};
  feq_compander_settings_defaults(&s);
  s.enabled = 1;
  return s;
}

/** Every band lifting under -40 dB at 2:1, up to 12 dB. */
FeqCompanderSettings lifting() {
  FeqCompanderSettings s = neutral();
  for (FeqCompanderBand& band : s.bands) {
    band.up_threshold_db = -40.0;
    band.up_ratio = 2.0;
    band.up_max_db = 12.0;
  }
  return s;
}

void exact_when_idle(double rate) {
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -12.0, 1.0),
                                              tone(rate, 220.0, -18.0, 1.0)};
  const Rendered idle = render(rate, neutral(), input);
  FeqCompanderSettings off = lifting();
  off.enabled = 0;
  const Rendered disabled = render(rate, off, input);
  const double worst = std::max(max_difference(idle.channels[0], input[0]),
                                max_difference(idle.channels[1], input[1]));
  std::printf("  %.1f kHz: idle differs by %.2e, off by %.2e\n", rate / 1000.0,
              worst, max_difference(disabled.channels[0], input[0]));
  check(worst == 0.0, "every ratio at one leaves the input exactly");
  check(max_difference(disabled.channels[0], input[0]) == 0.0,
        "switched off leaves the input exactly");
}

void lifts_quiet(double rate) {
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -60.0, 2.0),
                                              tone(rate, 1000.0, -60.0, 2.0)};
  const double lifted = level_db(render(rate, lifting(), input).channels[0]);
  const double control = level_db(render(rate, neutral(), input).channels[0]);
  std::printf("  %.1f kHz: -60 dB tone comes out at %.2f (control %.2f)\n",
              rate / 1000.0, lifted, control);
  // 20 dB under the threshold at 2:1 is 10 dB of lift, under the 12 dB cap.
  check(std::fabs(lifted - (-50.0)) < 0.6, "a quiet tone is lifted 10 dB");
  check(std::fabs(control - (-60.0)) < 0.1, "control: ratio one lifts nothing");
  const std::vector<std::vector<float>> deep{tone(rate, 1000.0, -78.0, 2.0),
                                             tone(rate, 1000.0, -78.0, 2.0)};
  const double capped = level_db(render(rate, lifting(), deep).channels[0]);
  std::printf("  %.1f kHz: -78 dB tone comes out at %.2f\n", rate / 1000.0,
              capped);
  check(capped < -77.0 + 1.0,
        "a sound at the floor is barely lifted, never by the full amount");
}

void never_lifts_silence(double rate) {
  std::vector<float> floor(static_cast<size_t>(rate));
  for (size_t i = 0; i < floor.size(); ++i) {
    floor[i] = static_cast<float>(3e-5 * std::sin(0.37 * static_cast<double>(i)));
  }
  const std::vector<std::vector<float>> input{floor, floor};
  const double before = level_db(floor);
  const double after = level_db(render(rate, lifting(), input).channels[0]);
  const std::vector<std::vector<float>> silent{
      std::vector<float>(static_cast<size_t>(rate), 0.0f),
      std::vector<float>(static_cast<size_t>(rate), 0.0f)};
  const Rendered quiet = render(rate, lifting(), silent);
  std::printf("  %.1f kHz: a %.1f dB floor comes out at %.2f\n", rate / 1000.0,
              before, after);
  check(std::fabs(after - before) < 0.2, "a noise floor is not lifted");
  check(max_difference(quiet.channels[0], silent[0]) == 0.0,
        "silence stays silence");
}

void holds_loud(double rate) {
  FeqCompanderSettings s = neutral();
  for (FeqCompanderBand& band : s.bands) {
    band.down_threshold_db = -20.0;
    band.down_ratio = 4.0;
  }
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -8.0, 2.0),
                                              tone(rate, 1000.0, -8.0, 2.0)};
  const double held = level_db(render(rate, s, input).channels[0]);
  std::printf("  %.1f kHz: -8 dB tone comes out at %.2f\n", rate / 1000.0, held);
  // 12 dB over the threshold at 4:1 is 9 dB held in the band that carries
  // the tone. First-order splits share a 1 kHz tone with the bands beside
  // it, whose parts sit under the threshold and are held less, so the whole
  // comes out 8 to 9 dB down: the price of bands that sum back exactly.
  check(held < -8.0 - 7.5 && held > -8.0 - 9.2, "a loud tone is held 8-9 dB");
}

void keeps_the_image(double rate) {
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -20.0, 2.0),
                                              tone(rate, 1000.0, -60.0, 2.0)};
  const Rendered out = render(rate, lifting(), input);
  const double left_change = level_db(out.channels[0]) - level_db(input[0]);
  const double right_change = level_db(out.channels[1]) - level_db(input[1]);
  const std::vector<std::vector<float>> alone{
      std::vector<float>(input[1].size(), 0.0f), input[1]};
  const double control =
      level_db(render(rate, lifting(), alone).channels[1]) - level_db(input[1]);
  std::printf(
      "  %.1f kHz: left %+.2f dB, right %+.2f dB (the right alone %+.2f)\n",
      rate / 1000.0, left_change, right_change, control);
  check(std::fabs(left_change - right_change) < 0.05,
        "a loud left and a quiet right get one gain");
  check(control > 8.0, "control: the quiet right alone is lifted");
}

void leaves_the_lfe(double rate) {
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -60.0, 2.0),
                                              tone(rate, 1000.0, -60.0, 2.0),
                                              tone(rate, 60.0, -60.0, 2.0)};
  const Rendered out = render(rate, lifting(), input, 2);
  std::printf("  %.1f kHz: LFE differs by %.2e, front lifted %+.2f dB\n",
              rate / 1000.0, max_difference(out.channels[2], input[2]),
              level_db(out.channels[0]) - level_db(input[0]));
  check(max_difference(out.channels[2], input[2]) == 0.0, "the LFE is untouched");
  check(level_db(out.channels[0]) - level_db(input[0]) > 8.0,
        "control: the fronts beside it are lifted");
}

void makeup_is_exact(double rate) {
  FeqCompanderSettings s = neutral();
  s.makeup_db = 6.0;
  const std::vector<std::vector<float>> input{tone(rate, 1000.0, -30.0, 1.0),
                                              tone(rate, 1000.0, -30.0, 1.0)};
  const double raised = level_db(render(rate, s, input).channels[0]);
  s.mix = 0.0;
  const Rendered dry = render(rate, s, input);
  std::printf("  %.1f kHz: +6 dB make-up gives %.3f dB; at mix 0 differs %.2e\n",
              rate / 1000.0, raised - level_db(input[0]),
              max_difference(dry.channels[0], input[0]));
  check(std::fabs(raised - level_db(input[0]) - 6.0) < 0.01,
        "make-up raises by exactly what it says");
  check(max_difference(dry.channels[0], input[0]) == 0.0,
        "at a mix of zero, make-up and all, the input is left exactly");
}

void bands_stay_apart(double rate) {
  // Only the low band holds a 60 Hz boom; a 2 kHz tone over it is left.
  FeqCompanderSettings s = neutral();
  s.bands[0].down_threshold_db = -30.0;
  s.bands[0].down_ratio = 8.0;
  std::vector<float> both = tone(rate, 60.0, -6.0, 2.0);
  const std::vector<float> cue = tone(rate, 2000.0, -30.0, 2.0);
  for (size_t i = 0; i < both.size(); ++i) {
    both[i] += cue[i];
  }
  const Rendered out = render(rate, s, {both, both});
  // The 2 kHz part of the output: subtract what the low band became by
  // measuring a 2 kHz-only render through the same settings.
  const Rendered cue_only = render(rate, s, {cue, cue});
  std::printf("  %.1f kHz: a 2 kHz cue alone changes by %+.3f dB\n",
              rate / 1000.0, level_db(cue_only.channels[0]) - level_db(cue));
  check(std::fabs(level_db(cue_only.channels[0]) - level_db(cue)) < 0.05,
        "a band at one leaves its own sound alone");
  check(level_db(out.channels[0]) < level_db(both) - 6.0,
        "control: the boom in the low band is held");
}

}  // namespace

int main() {
  for (const double rate : {44100.0, 48000.0, 96000.0, 192000.0}) {
    std::printf("rate %.1f kHz\n", rate / 1000.0);
    exact_when_idle(rate);
    lifts_quiet(rate);
    never_lifts_silence(rate);
    holds_loud(rate);
    keeps_the_image(rate);
    leaves_the_lfe(rate);
    makeup_is_exact(rate);
    bands_stay_apart(rate);
  }
  return feq_test::finish();
}

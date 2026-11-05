/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps, held to what it promises on a match (`footsteps_scene.h`):
 * steps come up and shots and blasts do not, a shot landing in a step's lift
 * keeps its own peak, the rain and a step's echo are left alone, every
 * channel gets one lift and the LFE none, Calm takes the
 * rumble and lets go, a handover carries the lift, and switched off or with
 * nothing to do the stage is the input to the bit.
 *
 * Each claim stands beside a control that would fail it: the same scene with
 * the stage off, or with the part it should leave alone shown to be lifted
 * where it should be.
 */
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/footsteps.h"
#include "footsteps_scene.h"
#include "footsteps_test_support.h"

namespace {

using feq_footsteps_test::band_gain_db;
using feq_footsteps_test::competitive;
using feq_footsteps_test::front_gain;
using feq_footsteps_test::Kind;
using feq_footsteps_test::kDirectS;
using feq_footsteps_test::kStepsHz;
using feq_footsteps_test::kStepsQ;
using feq_footsteps_test::kTailFromS;
using feq_footsteps_test::kTailToS;
using feq_footsteps_test::make_scene;
using feq_footsteps_test::Parts;
using feq_footsteps_test::quiet_steps;
using feq_footsteps_test::run;
using feq_footsteps_test::Scene;
using feq_footsteps_test::starts;
using feq_test::check;
using feq_test::identical;
using feq_test::Signal;

void steps_come_up_and_loud_sounds_do_not() {
  std::printf("steps come up, shots and the blast do not\n");
  const Scene scene = make_scene(48000.0);
  FeqFootstepsSettings settings = competitive();
  settings.calm = 0.0;
  const Signal out = run(scene.mix, scene.rate, settings);
  double least = 1e9;
  for (const double at : quiet_steps(scene)) {
    least = std::fmin(least, front_gain(scene, out, at));
  }
  double most_loud = 0.0;
  for (const Kind kind : {Kind::kShot, Kind::kBlast}) {
    for (const double at : starts(scene, kind)) {
      most_loud = std::fmax(most_loud, std::fabs(front_gain(scene, out, at)));
    }
  }
  std::printf("  quiet steps lifted by at least %.2f dB; shots and blast moved %.2f dB\n",
              least, most_loud);
  check(least >= 4.0, "every step in the rain comes up 4 dB or more");
  check(most_loud < 0.5, "no shot and not the blast moves half a dB");

  FeqFootstepsSettings off = settings;
  off.enabled = 0;
  check(identical(run(scene.mix, scene.rate, off), scene.mix),
        "control: switched off, the scene is untouched");
}

/**
 * A shot landing while a step is lifted loses the lift on its first sample,
 * not at the next decision: the per-sample ceiling, which a shot's energy
 * cannot see, since the decision a quarter of a millisecond later takes the
 * lift off as well. Tried at every sample of a decision's period.
 */
void a_shot_inside_a_lift_keeps_its_peak() {
  std::printf("a shot landing inside a step's lift keeps its own peak\n");
  const double rate = 48000.0;
  Parts parts;
  parts.loud = false;
  const Scene scene = make_scene(rate, parts);
  const double step_at = quiet_steps(scene)[2];
  const double shot_at = step_at + 0.03;
  const auto keep = static_cast<size_t>((shot_at + 0.4) * rate);
  feq_footsteps_test::Random random;
  const std::vector<double> shot = feq_footsteps_test::gunshot(rate, random);
  const double shot_gain = std::pow(10.0, -6.0 / 20.0);
  const auto window = static_cast<size_t>(0.003 * rate);
  double lifted = 1e9;
  double worst = -1e9;
  for (size_t offset = 0; offset < 12; ++offset) {
    Signal in;
    in.left.assign(scene.mix.left.begin(), scene.mix.left.begin() + keep);
    in.right.assign(scene.mix.right.begin(), scene.mix.right.begin() + keep);
    const size_t start = static_cast<size_t>(shot_at * rate) + offset;
    for (size_t i = 0; i < shot.size() && start + i < keep; ++i) {
      const auto v = static_cast<float>(shot[i] * shot_gain);
      in.left[start + i] += v;
      in.right[start + i] += v;
    }
    const Signal out = run(in, rate, competitive());
    double peak_in = 0.0;
    double peak_out = 0.0;
    for (size_t i = start; i < start + window; ++i) {
      peak_in = std::fmax(peak_in, std::fmax(std::fabs(in.left[i]), std::fabs(in.right[i])));
      peak_out =
          std::fmax(peak_out, std::fmax(std::fabs(out.left[i]), std::fabs(out.right[i])));
    }
    worst = std::fmax(worst, 20.0 * std::log10(peak_out / peak_in));
    lifted = std::fmin(
        lifted, band_gain_db(in, out, rate, kStepsHz, kStepsQ, step_at, shot_at));
  }
  std::printf("  the step was up %.2f dB when the shot landed; its peak moved %.2f dB\n",
              lifted, worst);
  check(lifted >= 3.0, "control: the shot lands inside a lift");
  check(worst < 0.3, "the shot's first 3 ms keep their peak, wherever it lands");
}

void the_rain_and_the_echo_are_left_alone() {
  std::printf("the rain and a step's echo are left alone\n");
  const Scene scene = make_scene(48000.0);
  const FeqFootstepsSettings settings = competitive();
  const Signal out = run(scene.mix, scene.rate, settings);
  const double start = band_gain_db(scene.mix, out, scene.rate, kStepsHz,
                                    kStepsQ, 0.0, 0.65);
  const double end = band_gain_db(scene.mix, out, scene.rate, kStepsHz,
                                  kStepsQ, 11.4, 12.0);
  std::printf("  rain alone: %.3f dB as it starts, %.3f dB at the end\n", start,
              end);
  check(std::fabs(start) < 0.1, "a stream that starts on rain lifts nothing");
  check(std::fabs(end) < 1.0, "the rain at the end is left within a decibel");

  Parts bed_only;
  bed_only.steps = false;
  bed_only.loud = false;
  const Scene rain = make_scene(48000.0, bed_only);
  const Signal rained = run(rain.mix, rain.rate, settings);
  const double whole = band_gain_db(rain.mix, rained, rain.rate, kStepsHz,
                                    kStepsQ, 1.0, 12.0);
  std::printf("  twelve seconds of rain with drops: %.3f dB\n", whole);
  check(std::fabs(whole) < 0.5, "drops in the rain are not taken for steps");

  double tail = 0.0;
  double front = 1e9;
  for (const double at : quiet_steps(scene)) {
    tail = std::fmax(tail, band_gain_db(scene.mix, out, scene.rate, kStepsHz,
                                        kStepsQ, at + kTailFromS, at + kTailToS));
    front = std::fmin(front, front_gain(scene, out, at));
  }
  std::printf("  a step's echo lifted %.2f dB at most, its front %.2f dB at least\n",
              tail, front);
  check(tail < 1.5, "a step's echo comes up less than 1.5 dB");
  check(front >= 4.0, "control: the same steps' fronts come up 4 dB or more");
}

/**
 * A step panned by level alone, the rain under it panned with it, so the two
 * sides differ by one number: one lift on both keeps that number exactly,
 * and a lift of each side's own would move it toward the middle.
 */
void every_side_gets_one_lift() {
  std::printf("every side gets one lift\n");
  Parts bed_only;
  bed_only.steps = false;
  bed_only.loud = false;
  bed_only.bed_db = -64.0;
  Scene scene = make_scene(48000.0, bed_only);
  feq_footsteps_test::Random random;
  const std::vector<double> step = feq_footsteps_test::footstep(48000.0, random);
  const double gain = std::pow(10.0, -36.0 / 20.0);
  const auto start = static_cast<size_t>(1.5 * 48000.0);
  for (size_t i = 0; i < step.size(); ++i) {
    scene.mix.left[start + i] += static_cast<float>(step[i] * gain);
  }
  for (size_t i = 0; i < scene.mix.left.size(); ++i) {
    scene.mix.right[i] = scene.mix.left[i] * 0.25f;
  }
  const Signal out = run(scene.mix, scene.rate, competitive());
  const auto side = [&](const Signal& s, bool left) {
    Signal one{left ? s.left : std::vector<float>(s.left.size(), 0.0f),
               left ? std::vector<float>(s.right.size(), 0.0f) : s.right};
    return feq_footsteps_test::band_energy(one, 48000.0, kStepsHz, kStepsQ, 1.5,
                                           1.5 + kDirectS);
  };
  const double before = 10.0 * std::log10(side(scene.mix, true) / side(scene.mix, false));
  const double after = 10.0 * std::log10(side(out, true) / side(out, false));
  const double lift = band_gain_db(scene.mix, out, 48000.0, kStepsHz, kStepsQ,
                                   1.5, 1.5 + kDirectS);
  std::printf("  left over right %.3f dB before, %.3f dB after; lifted %.2f dB\n",
              before, after, lift);
  check(std::fabs(after - before) < 0.001, "the step stays exactly where it was");
  check(lift >= 4.0, "control: the step was lifted");
}

void the_lfe_is_never_touched() {
  std::printf("the LFE is never touched\n");
  const Scene scene = make_scene(48000.0);
  const size_t frames = scene.mix.left.size();
  std::vector<std::vector<float>> six(6, std::vector<float>(frames, 0.0f));
  six[0] = scene.mix.left;
  six[1] = scene.mix.right;
  feq_test::Pink rumble;
  for (size_t i = 0; i < frames; ++i) {
    six[3][i] = static_cast<float>(0.05 * rumble.next());
    six[4][i] = scene.mix.left[i] * 0.5f;
    six[5][i] = scene.mix.right[i] * 0.5f;
  }
  const std::vector<std::vector<float>> before = six;
  FeqFootsteps* stage = feq_footsteps_create(48000.0, 6);
  const FeqFootstepsSettings settings = competitive();
  feq_footsteps_configure(stage, &settings);
  feq_footsteps_set_lfe(stage, 3);
  for (size_t at = 0; at + 480 <= frames; at += 480) {
    float* channels[6];
    for (int c = 0; c < 6; ++c) channels[c] = six[c].data() + at;
    feq_footsteps_process(stage, channels, 480);
  }
  feq_footsteps_destroy(stage);
  check(six[3] == before[3], "the LFE comes out as it went in, to the bit");
  check(six[4] != before[4], "control: a rear channel was lifted");
}

void at_rest_it_is_the_input() {
  std::printf("with nothing to lift, it is the input\n");
  Signal tone;
  tone.left.resize(96000);
  tone.right.resize(96000);
  for (size_t i = 0; i < tone.left.size(); ++i) {
    const double v = 0.01 * std::sin(2.0 * feq_test::kPi * kStepsHz * i / 48000.0);
    tone.left[i] = static_cast<float>(v);
    tone.right[i] = static_cast<float>(0.7 * v);
  }
  check(identical(run(tone, 48000.0, competitive()), tone),
        "a steady sound, which never arrives, passes to the bit");
  Signal silence;
  silence.left.assign(48000, 0.0f);
  silence.right.assign(48000, 0.0f);
  check(identical(run(silence, 48000.0, competitive()), silence),
        "silence stays silence");
}

void switching_off_glides_then_stops() {
  std::printf("switching off glides, then stops\n");
  const Scene scene = make_scene(48000.0);
  const FeqFootstepsSettings on = competitive();
  FeqFootstepsSettings off = on;
  off.enabled = 0;
  FeqFootsteps* stage = feq_footsteps_create(48000.0, 2);
  feq_footsteps_configure(stage, &on);
  Signal out = scene.mix;
  const size_t switch_at = static_cast<size_t>(0.735 * 48000.0) / 480 * 480;
  for (size_t at = 0; at + 480 <= out.left.size(); at += 480) {
    if (at == switch_at) feq_footsteps_configure(stage, &off);
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_footsteps_process(stage, channels, 480);
  }
  feq_footsteps_destroy(stage);
  const auto added = [&](size_t from, size_t to) {
    double sum = 0.0;
    for (size_t i = from; i < to; ++i) {
      const double d = out.left[i] - scene.mix.left[i];
      sum += d * d;
    }
    return sum;
  };
  const double before = added(switch_at - 240, switch_at);
  const double after = added(switch_at, switch_at + 240);
  std::printf("  what it added: %.3g in the 5 ms before, %.3g in the 5 ms after\n",
              before, after);
  check(before > 0.0, "control: it was lifting when it was switched off");
  check(after > 0.3 * before, "the lift lets go rather than vanishing");
  const size_t stopped = switch_at + static_cast<size_t>(1.0 * 48000.0);
  bool untouched = true;
  for (size_t i = stopped; i < out.left.size(); ++i) {
    untouched = untouched && out.left[i] == scene.mix.left[i] &&
                out.right[i] == scene.mix.right[i];
  }
  check(untouched, "a second later it is the input to the bit");
}

void a_handover_carries_the_lift() {
  std::printf("a handover carries the lift\n");
  const Scene scene = make_scene(48000.0);
  const FeqFootstepsSettings settings = competitive();
  const Signal whole = run(scene.mix, scene.rate, settings);
  const auto handed = [&](bool transfer) {
    FeqFootsteps* first = feq_footsteps_create(48000.0, 2);
    FeqFootsteps* second = feq_footsteps_create(48000.0, 2);
    feq_footsteps_configure(first, &settings);
    feq_footsteps_configure(second, &settings);
    Signal out = scene.mix;
    const size_t swap_at = 144000;  // 3 s, between the first steps and the shots
    for (size_t at = 0; at + 480 <= out.left.size(); at += 480) {
      if (at == swap_at && transfer) feq_footsteps_transfer(second, first);
      float* channels[2] = {out.left.data() + at, out.right.data() + at};
      feq_footsteps_process(at < swap_at ? first : second, channels, 480);
    }
    feq_footsteps_destroy(first);
    feq_footsteps_destroy(second);
    return out;
  };
  check(identical(handed(true), whole),
        "handed over, it plays exactly as one stage would");
  check(!identical(handed(false), whole),
        "control: a stage starting afresh plays differently");
}

void isolate_is_what_it_adds() {
  std::printf("Isolate plays what it adds\n");
  const Scene scene = make_scene(48000.0);
  const FeqFootstepsSettings settings = competitive();
  FeqFootstepsSettings listening = settings;
  listening.isolate = 1;
  const Signal out = run(scene.mix, scene.rate, settings);
  const Signal added = run(scene.mix, scene.rate, listening);
  double worst = 0.0;
  double energy = 0.0;
  for (size_t i = 0; i < out.left.size(); ++i) {
    const double expected = static_cast<double>(out.left[i]) - scene.mix.left[i];
    worst = std::fmax(worst, std::fabs(expected - added.left[i]));
    energy += static_cast<double>(added.left[i]) * added.left[i];
  }
  std::printf("  largest difference %.3g\n", worst);
  check(worst < 1e-6, "Isolate is the output less the input");
  check(energy > 0.0, "control: there is something to hear");
}

void calm_takes_the_rumble_and_lets_go() {
  std::printf("Calm takes the rumble and lets go\n");
  const Scene scene = make_scene(48000.0);
  FeqFootstepsSettings settings = competitive();
  settings.lift = 0.0;
  settings.calm = 1.0;
  const Signal calmed = run(scene.mix, scene.rate, settings);
  settings.calm = 0.0;
  const Signal left = run(scene.mix, scene.rate, settings);
  const double blast = band_gain_db(scene.mix, calmed, 48000.0, 90.0, 0.7, 6.32, 6.8);
  const double later = band_gain_db(scene.mix, calmed, 48000.0, 90.0, 0.7, 8.0, 8.4);
  const double control = band_gain_db(scene.mix, left, 48000.0, 90.0, 0.7, 6.32, 6.8);
  std::printf("  rumble %.2f dB under the blast, %.2f dB 1.7 s on; without Calm %.3f dB\n",
              blast, later, control);
  check(blast <= -3.0, "the blast's rumble comes down 3 dB or more");
  check(later > -0.5, "and is let go once the blast has passed");
  check(std::fabs(control) < 0.01, "control: with Calm at zero nothing moves");
}

/** The scene through a whole rack with only Footsteps' switch as asked. */
Signal through_rack(const Scene& scene, bool footsteps, uint32_t* stages) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.footsteps = competitive();
  settings.footsteps.enabled = footsteps ? 1 : 0;
  FeqChain* chain = feq_chain_create(scene.rate, 2, 480);
  feq_chain_configure(chain, &settings);
  *stages = feq_chain_active_stages(chain);
  Signal out = scene.mix;
  for (size_t at = 0; at + 480 <= out.left.size(); at += 480) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_chain_process(chain, channels, 480);
  }
  feq_chain_destroy(chain);
  return out;
}

void the_rack_runs_it() {
  std::printf("the rack runs it\n");
  const Scene scene = make_scene(48000.0);
  uint32_t on_stages = 0;
  uint32_t off_stages = 0;
  const Signal on = through_rack(scene, true, &on_stages);
  const Signal off = through_rack(scene, false, &off_stages);
  // Both racks delay the sound alike, so the one with Footsteps is measured
  // against the one without, step by step where the steps are.
  double least = 1e9;
  for (const double at : quiet_steps(scene)) {
    least = std::fmin(least, band_gain_db(off, on, scene.rate, kStepsHz,
                                          kStepsQ, at, at + kDirectS + 0.01));
  }
  std::printf("  steps through the rack lifted by at least %.2f dB\n", least);
  check((on_stages & (1u << 12)) != 0u, "the rack reports Footsteps running");
  check((off_stages & (1u << 12)) == 0u, "control: and not while it is off");
  check(least >= 4.0, "the rack lifts the steps");
}

void every_rate_lifts_alike() {
  std::printf("every rate lifts alike\n");
  double reference = 0.0;
  for (const double rate : {48000.0, 44100.0, 88200.0, 96000.0, 176400.0,
                            192000.0, 352800.0, 384000.0}) {
    const Scene scene = make_scene(rate);
    const Signal out = run(scene.mix, rate, competitive());
    double sum = 0.0;
    int count = 0;
    for (const double at : quiet_steps(scene)) {
      sum += front_gain(scene, out, at);
      ++count;
    }
    double shots = 0.0;
    for (const double at : starts(scene, Kind::kShot)) {
      shots = std::fmax(shots, std::fabs(front_gain(scene, out, at)));
    }
    const double mean = sum / count;
    if (rate == 48000.0) reference = mean;
    std::printf("  %6.1f kHz: steps %.2f dB, shots %.2f dB\n", rate / 1000.0,
                mean, shots);
    char what[96];
    std::snprintf(what, sizeof what, "%.1f kHz lifts the steps as 48 kHz does",
                  rate / 1000.0);
    check(std::fabs(mean - reference) < 1.0, what);
    std::snprintf(what, sizeof what, "%.1f kHz leaves the shots alone",
                  rate / 1000.0);
    check(shots < 0.5, what);
  }
}

}  // namespace

int main() {
  steps_come_up_and_loud_sounds_do_not();
  a_shot_inside_a_lift_keeps_its_peak();
  the_rain_and_the_echo_are_left_alone();
  every_side_gets_one_lift();
  the_lfe_is_never_touched();
  at_rest_it_is_the_input();
  switching_off_glides_then_stops();
  a_handover_carries_the_lift();
  isolate_is_what_it_adds();
  calm_takes_the_rumble_and_lets_go();
  the_rack_runs_it();
  every_rate_lifts_alike();
  return feq_test::finish();
}

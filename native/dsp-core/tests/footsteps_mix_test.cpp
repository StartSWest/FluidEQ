/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps in mixes the way a game plays them: loud, paused, heavy in the
 * bass. The first version judged against fixed levels — lift toward -24 dB,
 * nothing while the mix stood over -22 dBFS, Calm over -16 dB — and on real
 * matches of six games, recorded and replayed through it, a distant step's
 * band came up 0.4 dB on average (2026-11-01): a game sits over -22 dBFS
 * most of the time. Everything is judged against the programme now.
 *
 * Each claim stands beside the control that shows the case is the hard one.
 */
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/footsteps.h"
#include "footsteps_scene.h"
#include "footsteps_test_support.h"

namespace {

using feq_footsteps_test::band_gain_db;
using feq_footsteps_test::competitive;
using feq_footsteps_test::front_gain;
using feq_footsteps_test::kStepsHz;
using feq_footsteps_test::kStepsQ;
using feq_footsteps_test::make_scene;
using feq_footsteps_test::Parts;
using feq_footsteps_test::quiet_steps;
using feq_footsteps_test::run;
using feq_footsteps_test::Scene;
using feq_footsteps_test::section;
using feq_footsteps_test::Shape;
using feq_test::check;
using feq_test::Signal;

constexpr double kRate = 48000.0;

/**
 * A loud bed under everything and nothing of it at 2.4 kHz: pink noise
 * through four low-pass sections at 150 Hz — a game's music and engines, as
 * the meter sees them — at `peak_db`.
 */
void add_low_bed(Signal& signal, double peak_db) {
  feq_test::Pink pink;
  auto a = section(Shape::kLowPass, kRate, 150.0, 0.7);
  auto b = section(Shape::kLowPass, kRate, 150.0, 0.7);
  auto c = section(Shape::kLowPass, kRate, 150.0, 0.7);
  auto d = section(Shape::kLowPass, kRate, 150.0, 0.7);
  std::vector<double> bed(signal.left.size());
  double peak = 0.0;
  for (double& v : bed) {
    v = d.run(c.run(b.run(a.run(pink.next()))));
    peak = std::fmax(peak, std::fabs(v));
  }
  const double gain = std::pow(10.0, peak_db / 20.0) / peak;
  for (size_t i = 0; i < bed.size(); ++i) {
    signal.left[i] += static_cast<float>(bed[i] * gain);
    signal.right[i] += static_cast<float>(bed[i] * gain);
  }
}

/**
 * The steps band's change, heard through its filter twice: one pass reads
 * the -10 dB bed's leak at 2.4 kHz as louder than the steps, and measures
 * the bed, not the step.
 */
double sharp_steps_energy(const Signal& signal, double from_s, double to_s) {
  auto l1 = section(Shape::kBandPass, kRate, kStepsHz, kStepsQ);
  auto l2 = l1;
  auto r1 = l1;
  auto r2 = l1;
  const auto from = static_cast<size_t>(from_s * kRate);
  const auto to = static_cast<size_t>(to_s * kRate);
  double sum = 0.0;
  for (size_t i = 0; i < to; ++i) {
    const double l = l2.run(l1.run(signal.left[i]));
    const double r = r2.run(r1.run(signal.right[i]));
    if (i >= from) sum += l * l + r * r;
  }
  return sum;
}

double sharp_steps_gain_db(const Signal& in, const Signal& out, double from_s,
                           double to_s) {
  return 10.0 * std::log10((sharp_steps_energy(out, from_s, to_s) + 1e-30) /
                           (sharp_steps_energy(in, from_s, to_s) + 1e-30));
}

/** The loudest the whole signal is, RMS over 50 ms, between two times. */
double loudest_db(const Signal& signal, double from, double to) {
  const auto window = static_cast<size_t>(0.05 * kRate);
  double most = -240.0;
  for (auto at = static_cast<size_t>(from * kRate);
       at + window <= static_cast<size_t>(to * kRate); at += window) {
    double sum = 0.0;
    for (size_t i = at; i < at + window; ++i) {
      sum += signal.left[i] * signal.left[i] + signal.right[i] * signal.right[i];
    }
    most = std::fmax(most, 10.0 * std::log10(sum / (2.0 * window) + 1e-24));
  }
  return most;
}

void steps_come_up_in_a_loud_mix() {
  std::printf("steps come up in a mix as loud as a game's\n");
  Parts parts;
  parts.loud = false;
  Scene scene = make_scene(kRate, parts);
  add_low_bed(scene.mix, -10.0);
  const Signal out = run(scene.mix, scene.rate, competitive());
  double least = 1e9;
  double body = 1e9;
  double quietest_mix = 0.0;
  for (const double at : quiet_steps(scene)) {
    least = std::fmin(least, sharp_steps_gain_db(scene.mix, out, at, at + 0.06));
    body = std::fmin(body, sharp_steps_gain_db(scene.mix, out, at + 0.06, at + 0.14));
    quietest_mix = std::fmin(quietest_mix, loudest_db(scene.mix, at, at + 0.3));
  }
  // Read through one pass, the same steps measure the bed instead.
  double blurred = 1e9;
  for (const double at : quiet_steps(scene)) {
    blurred = std::fmin(blurred, front_gain(scene, out, at));
  }
  std::printf("  the mix stands at %.1f dB RMS or more around each step; steps up %.2f dB at least (%.2f read through one pass)\n",
              quietest_mix, least, blurred);
  check(quietest_mix > -22.0,
        "control: the mix is over -22 dB, where the first version lifted nothing");
  check(least >= 4.0, "every step in it comes up 4 dB or more");
  // A step's front alone is its first 30 ms; the lift is held for the rest.
  std::printf("  the steps' bodies, 60 to 140 ms in, up %.2f dB at least\n", body);
  check(body >= 3.0, "the whole step comes up, not just its front");
}

/**
 * Steps quieter than the mix but louder than -24 dB in their band, the case
 * a fixed target could never lift and a game is full of: a close-ish enemy
 * under the music and the engines.
 */
void steps_under_the_programme_come_up() {
  std::printf("steps under a loud programme come up, though not quiet in themselves\n");
  Parts steps_only;
  steps_only.loud = false;
  steps_only.bed = false;
  Scene scene = make_scene(kRate, steps_only);
  const auto louder = static_cast<float>(std::pow(10.0, 28.0 / 20.0));
  for (size_t i = 0; i < scene.mix.left.size(); ++i) {
    scene.mix.left[i] *= louder;
    scene.mix.right[i] *= louder;
  }
  add_low_bed(scene.mix, -4.0);
  // Run by hand to read what the stage itself reads the steps band at.
  FeqFootsteps* stage = feq_footsteps_create(kRate, 2);
  FeqFootstepsSettings settings = competitive();
  // This pre-existing combined-parts fixture includes the original 50% Calm.
  // Keep that saved/manual configuration explicit now that fresh presets
  // default to additive Lift alone; its 3 dB measurement includes the cut.
  settings.calm = 0.5;
  feq_footsteps_configure(stage, &settings);
  Signal out = scene.mix;
  std::vector<float> cue;
  for (size_t at = 0; at + 480 <= out.left.size(); at += 480) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_footsteps_process(stage, channels, 480);
    FeqFootstepsReport report{};
    feq_footsteps_block_report(stage, &report);
    cue.push_back(report.cue_db);
  }
  feq_footsteps_destroy(stage);
  double least = 1e9;
  double quietest_cue = 0.0;
  for (const double at : quiet_steps(scene)) {
    least = std::fmin(least, sharp_steps_gain_db(scene.mix, out, at, at + 0.06));
    float loudest = -240.0f;
    for (auto block = static_cast<size_t>(at * 100); block < static_cast<size_t>(at * 100) + 6;
         ++block) {
      loudest = std::fmax(loudest, cue[block]);
    }
    quietest_cue = std::fmin(quietest_cue, static_cast<double>(loudest));
  }
  // What the first version's fixed target, -24 dB at a ratio of 2.5, gave
  // the quietest of them.
  const double fixed = std::fmax(0.0, (-24.0 - quietest_cue) * 0.6);
  std::printf("  the stage reads every step's band at %.1f dB or more: a fixed target "
              "gives %.2f dB, this %.2f dB at least\n",
              quietest_cue, fixed, least);
  check(fixed < 1.0, "control: a fixed -24 dB target lifts them under 1 dB");
  check(least >= 3.0, "every one of them comes up 3 dB or more");
}

void a_pause_keeps_the_bed() {
  std::printf("a pause keeps what the rain taught\n");
  Parts parts;
  parts.loud = false;
  Scene scene = make_scene(kRate, parts);
  // A second of digital silence where the first run of steps ends, as a
  // paused video or a game's menu gives.
  for (auto i = static_cast<size_t>(2.2 * kRate); i < static_cast<size_t>(3.2 * kRate); ++i) {
    scene.mix.left[i] = 0.0f;
    scene.mix.right[i] = 0.0f;
  }
  const Signal out = run(scene.mix, scene.rate, competitive());
  const double after = band_gain_db(scene.mix, out, kRate, kStepsHz, kStepsQ, 3.2, 3.38);
  const double step = front_gain(scene, out, 3.4);
  std::printf("  the rain as it comes back %.2f dB; the next step %.2f dB\n", after, step);
  check(after < 0.5, "the rain after the pause is left as it was");
  check(step >= 4.0, "control: the first step after the pause comes up 4 dB or more");
}

void calm_lets_a_bass_heavy_mix_be() {
  std::printf("Calm leaves a bass-heavy mix its bass and still takes a blast\n");
  Parts none;
  none.steps = false;
  none.loud = false;
  none.bed = false;
  Scene scene = make_scene(kRate, none);
  add_low_bed(scene.mix, -8.0);
  feq_footsteps_test::Random random;
  const std::vector<double> blast = feq_footsteps_test::explosion(kRate, random);
  const double blast_gain = std::pow(10.0, -1.0 / 20.0);
  const auto blast_at = static_cast<size_t>(8.0 * kRate);
  for (size_t i = 0; i < blast.size() && blast_at + i < scene.mix.left.size(); ++i) {
    scene.mix.left[blast_at + i] += static_cast<float>(blast[i] * blast_gain);
    scene.mix.right[blast_at + i] += static_cast<float>(blast[i] * blast_gain);
  }
  FeqFootstepsSettings settings = competitive();
  settings.lift = 0.0;
  settings.calm = 1.0;
  const Signal out = run(scene.mix, scene.rate, settings);
  const double steady = band_gain_db(scene.mix, out, kRate, 90.0, 0.7, 4.0, 7.5);
  const double under = band_gain_db(scene.mix, out, kRate, 90.0, 0.7, 8.02, 8.5);
  std::printf("  the bass held %.2f dB; under the blast %.2f dB\n", steady, under);
  check(steady > -1.0, "a mix that is bass all along keeps its bass within 1 dB");
  check(under <= -3.0, "control: a blast jumping out of it is still cut 3 dB or more");
}

}  // namespace

int main() {
  steps_come_up_in_a_loud_mix();
  steps_under_the_programme_come_up();
  a_pause_keeps_the_bed();
  calm_lets_a_bass_heavy_mix_be();
  return feq_test::finish();
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser, held to what it promises on a mix (`deesser_scene.h`): the S
 * comes down, the hi-hat between the S's does not, the answer is the same
 * quiet or loud, a ride that plays for seconds becomes the bed, and at rest
 * the stage is its delay and nothing else.
 *
 * Every claim is measured beside a control that would fail it — the same
 * scene with the tells switched off, the same stage at rest — so a check
 * that passes is a property of the stage, not of the signal.
 */
#include <cmath>
#include <cstdio>
#include <vector>

#include "deesser_scene.h"
#include "dsp_test_support.h"
#include "fluideq/deesser.h"

namespace {

using feq_deesser_test::band_energy;
using feq_deesser_test::Event;
using feq_deesser_test::make_scene;
using feq_deesser_test::Scene;
using feq_deesser_test::SceneOptions;
using feq_test::check;
using feq_test::Signal;

constexpr uint32_t kBlock = 480;

FeqDeEsserSettings vocal_music() {
  FeqDeEsserSettings settings{};
  feq_deesser_settings_defaults(&settings);
  settings.enabled = 1;
  return settings;
}

/** The scene through the stage, a block at a time; what came out. */
Signal run(const Scene& scene, const FeqDeEsserSettings& settings,
           uint32_t* latency = nullptr) {
  FeqDeEsser* stage = feq_deesser_create(scene.rate, 2);
  feq_deesser_configure(stage, &settings, nullptr, nullptr);
  Signal out = scene.mix;
  const auto block = static_cast<uint32_t>(kBlock * scene.rate / 48000.0);
  for (size_t at = 0; at + block <= out.left.size(); at += block) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_deesser_process(stage, channels, block, 0);
  }
  if (latency != nullptr) {
    *latency = feq_deesser_latency_frames(stage, 0);
  }
  feq_deesser_destroy(stage);
  return out;
}

double loss_db(const Scene& scene, const Signal& out, uint32_t latency,
               int which, const std::vector<Event>& events) {
  const double in =
      band_energy(scene.mix.left, scene.mix.right, which, events, 0, scene.rate);
  const double after =
      band_energy(out.left, out.right, which, events, latency, scene.rate);
  return 10.0 * std::log10(in / after);
}

/** What the S's lost, measured where nothing else plays in their band. */
double s_loss(SceneOptions options, const FeqDeEsserSettings& settings) {
  options.hats = false;
  const Scene scene = make_scene(options);
  uint32_t latency = 0;
  const Signal out = run(scene, settings, &latency);
  return loss_db(scene, out, latency, 2, scene.esses);
}

/** What the lone hi-hats lost, on the side they are panned to. */
double hat_loss(const SceneOptions& options,
                const FeqDeEsserSettings& settings) {
  const Scene scene = make_scene(options);
  uint32_t latency = 0;
  const Signal out = run(scene, settings, &latency);
  return loss_db(scene, out, latency, 0, scene.lone_hats);
}

void at_rest_it_is_its_delay() {
  std::printf("at rest, the stage is its look-ahead and nothing else\n");
  // Vowels and the band, under 2.5 kHz: nothing in the listening range.
  SceneOptions quiet;
  quiet.hats = false;
  quiet.s_db = -60.0;
  quiet.vowel_top_hz = 2500.0;
  const Scene scene = make_scene(quiet);
  for (const int enabled : {0, 1}) {
    FeqDeEsserSettings settings = vocal_music();
    settings.enabled = enabled;
    uint32_t latency = 0;
    const Signal out = run(scene, settings, &latency);
    bool exact = true;
    size_t first = 0;
    for (size_t at = latency; at < out.left.size() - kBlock; ++at) {
      if (out.left[at] != scene.mix.left[at - latency] ||
          out.right[at] != scene.mix.right[at - latency]) {
        exact = false;
        first = at;
        break;
      }
    }
    std::printf("  %s: delay %u frames, exact %s", enabled ? "on" : "off",
                latency, exact ? "yes" : "no");
    if (!exact) {
      std::printf(" (first difference at %.1f ms)",
                  1000.0 * static_cast<double>(first) / scene.rate);
    }
    std::printf("\n");
    check(latency == 96, "the look-ahead is 2 ms at 48 kHz");
    check(exact, enabled
                     ? "switched on with nothing to cut, every sample is the input's"
                     : "switched off, every sample is the input's");
  }
  // The control: the same stage with an S in the scene does change samples,
  // or "exact" could mean the stage never touches anything.
  SceneOptions loud;
  loud.hats = false;
  const Scene with_s = make_scene(loud);
  uint32_t latency = 0;
  const Signal out = run(with_s, vocal_music(), &latency);
  bool changed = false;
  for (size_t at = latency; at < out.left.size() && !changed; ++at) {
    changed = out.left[at] != with_s.mix.left[at - latency];
  }
  check(changed, "control: with an S to cut, samples change");
}

void vowels_are_barely_touched() {
  std::printf("a voice's vowels, upper harmonics and all, are barely touched\n");
  // The vowels' top harmonics reach the lowest band's skirt, and a vowel's
  // start is the one moment they lead the voice's body.
  SceneOptions vowels;
  vowels.hats = false;
  vowels.s_db = -60.0;
  const Scene scene = make_scene(vowels);
  uint32_t latency = 0;
  const Signal out = run(scene, vocal_music(), &latency);
  std::vector<Event> sung;
  for (size_t second = 0; second < 6; ++second) {
    const auto base = static_cast<size_t>(second * scene.rate);
    sung.push_back({base, base + static_cast<size_t>(0.35 * scene.rate)});
  }
  const double loss = loss_db(scene, out, latency, 2, sung);
  std::printf("  vowels lose %.2f dB in the listening range\n", loss);
  check(loss <= 0.5, "vowels lose half a decibel at most in the listening range");
}

void the_s_comes_down_and_the_hat_does_not() {
  std::printf("a centred S comes down; the panned hi-hat between the S's does not\n");
  const double s = s_loss(SceneOptions{}, vocal_music());
  const double hat = hat_loss(SceneOptions{}, vocal_music());
  std::printf("  Vocal music: S %.2f dB, lone hi-hats %.2f dB\n", s, hat);
  // With the hi-hats playing over them, the S's still come down.
  const Scene full = make_scene(SceneOptions{});
  uint32_t latency = 0;
  const double under_hats =
      loss_db(full, run(full, vocal_music(), &latency), latency, 2, full.esses);
  std::printf("  the S's with the hi-hats over them: %.2f dB\n", under_hats);
  // The control: everything listened to and nothing spared — the de-esser
  // the EQ's dynamic band was. It has to catch the hats, or the scene proves
  // nothing about telling them apart.
  FeqDeEsserSettings blunt = vocal_music();
  blunt.centre_only = 0;
  blunt.keep_cymbals = 0.0;
  const double blunt_hat = hat_loss(SceneOptions{}, blunt);
  std::printf("  control, nothing spared: lone hi-hats %.2f dB\n", blunt_hat);
  check(s >= 3.5, "the S loses at least 3.5 dB");
  check(under_hats >= 2.5, "with hi-hats over them, the S's lose at least 2.5 dB");
  check(hat <= 0.5, "a lone hi-hat loses half a decibel at most");
  check(blunt_hat >= 1.5, "control: with nothing spared the hi-hats are cut");
}

void each_tell_spares_on_its_own() {
  std::printf("each of the tells spares a hi-hat that the others would not\n");
  // A hi-hat in the centre: position cannot tell it from a voice, so what
  // spares it is its strike and its air.
  SceneOptions centred;
  centred.s_db = -60.0;
  centred.hat_left = 0.62;
  centred.hat_right = 0.62;
  FeqDeEsserSettings settings = vocal_music();
  const double spared = hat_loss(centred, settings);
  FeqDeEsserSettings unspared = settings;
  unspared.keep_cymbals = 0.0;
  const double cut = hat_loss(centred, unspared);
  std::printf("  lone hi-hats, Keep cymbals 70%%: %.2f dB; at 0%%: %.2f dB\n",
              spared, cut);
  check(spared + 1.0 <= cut, "Keep cymbals spares the hi-hats it is told to");
}

void quiet_or_loud_the_same() {
  std::printf("the same scene 24 dB quieter is cut the same\n");
  SceneOptions quiet;
  quiet.level_db = -24.0;
  const double loud = s_loss(SceneOptions{}, vocal_music());
  const double soft = s_loss(quiet, vocal_music());
  std::printf("  S %.2f dB loud, %.2f dB quiet\n", loud, soft);
  check(std::fabs(loud - soft) <= 0.5,
        "the cut does not depend on how loud the song is");
}

void a_ride_becomes_the_bed() {
  std::printf("a ride cymbal under everything is the bed, not a target\n");
  SceneOptions with_ride;
  with_ride.ride = true;
  with_ride.hats = false;
  with_ride.s_db = -60.0;
  const Scene scene = make_scene(with_ride);
  uint32_t latency = 0;
  const Signal out = run(scene, vocal_music(), &latency);
  // The last three seconds, after the bed has been learned.
  const std::vector<Event> late{{static_cast<size_t>(3.0 * scene.rate),
                                 static_cast<size_t>(5.9 * scene.rate)}};
  const double cut = loss_db(scene, out, latency, 2, late);
  std::printf("  ride after 3 s: %.2f dB\n", cut);
  check(cut <= 0.5, "a steady ride loses half a decibel at most");
  // And an S over the ride still comes down: the bed rose, the S stands over it.
  with_ride.s_db = -6.0;
  const Scene sung = make_scene(with_ride);
  const Signal sung_out = run(sung, vocal_music(), &latency);
  const double over_ride = loss_db(sung, sung_out, latency, 2, sung.esses);
  std::printf("  S's over the ride: %.2f dB\n", over_ride);
  check(over_ride >= 2.0, "S's over a ride still lose at least 2 dB");
}

void every_rate_the_same() {
  std::printf("the S is cut alike at every rate\n");
  double at_48 = 0.0;
  for (const double rate : {48000.0, 44100.0, 96000.0, 192000.0, 384000.0}) {
    SceneOptions options;
    options.rate = rate;
    options.seconds = rate > 100000.0 ? 3.0 : 6.0;
    const double s = s_loss(options, vocal_music());
    const double hat = hat_loss(options, vocal_music());
    std::printf("  %6.0f Hz: S %.2f dB, lone hi-hats %.2f dB\n", rate, s, hat);
    if (rate == 48000.0) {
      at_48 = s;
    } else {
      check(std::fabs(s - at_48) <= 1.5, "the S's cut is within 1.5 dB of 48 kHz's");
    }
    check(s >= 3.5, "the S loses at least 3.5 dB");
    check(hat <= 0.75, "a lone hi-hat loses three quarters of a decibel at most");
  }
}

}  // namespace

int main() {
  at_rest_it_is_its_delay();
  vowels_are_barely_touched();
  the_s_comes_down_and_the_hat_does_not();
  each_tell_spares_on_its_own();
  quiet_or_loud_the_same();
  a_ride_becomes_the_bed();
  every_rate_the_same();
  return feq_test::finish();
}

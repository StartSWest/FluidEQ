/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's other promises: its three ways of cutting, Isolate playing
 * exactly what is taken, the deepest cut held to the dial, a surround stream's
 * LFE and rears left alone, a handover that changes no sample, and an edit in
 * the middle of an S that does not click — each beside a control that would
 * fail it.
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

Signal run(const Scene& scene, const FeqDeEsserSettings& settings) {
  FeqDeEsser* stage = feq_deesser_create(scene.rate, 2);
  feq_deesser_configure(stage, &settings, nullptr, nullptr);
  Signal out = scene.mix;
  for (size_t at = 0; at + kBlock <= out.left.size(); at += kBlock) {
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_deesser_process(stage, channels, kBlock, 0);
  }
  feq_deesser_destroy(stage);
  return out;
}

double loss_db(const Scene& scene, const Signal& out, int which,
               const std::vector<Event>& events) {
  const double in =
      band_energy(scene.mix.left, scene.mix.right, which, events, 0, scene.rate);
  const double after =
      band_energy(out.left, out.right, which, events, 96, scene.rate);
  return 10.0 * std::log10(in / after);
}

/** The mid's energy at 1 kHz and under over the events, delayed by `offset`. */
double low_energy(const Signal& signal, const std::vector<Event>& events,
                  size_t offset, double rate) {
  std::vector<float> mid(signal.left.size());
  for (size_t at = 0; at < mid.size(); ++at) {
    mid[at] = 0.5f * (signal.left[at] + signal.right[at]);
  }
  FeqBiquadState state{};
  const FeqBiquadCoefficients below =
      feq_biquad_coefficients(FEQ_FILTER_LPQ, 1000.0, 0.0, 0.7071, rate);
  feq_biquad_process(&state, mid.data(), static_cast<uint32_t>(mid.size()),
                     &below);
  double total = 0.0;
  for (const Event& event : events) {
    for (size_t at = event.from + offset; at < event.to + offset; ++at) {
      total += static_cast<double>(mid[at]) * static_cast<double>(mid[at]);
    }
  }
  return total;
}

void three_ways_of_cutting() {
  std::printf("Spectral, Treble and Whole voice all take the S down\n");
  SceneOptions options;
  options.hats = false;
  const Scene scene = make_scene(options);
  const double below_in = low_energy(scene.mix, scene.esses, 0, scene.rate);
  for (const int mode : {FEQ_DEESSER_SPECTRAL, FEQ_DEESSER_TREBLE,
                         FEQ_DEESSER_WHOLE}) {
    FeqDeEsserSettings settings = vocal_music();
    settings.mode = mode;
    const Signal out = run(scene, settings);
    const double s = loss_db(scene, out, 2, scene.esses);
    const double below =
        10.0 * std::log10(below_in / low_energy(out, scene.esses, 96, scene.rate));
    std::printf("  mode %d: S %.2f dB, under 1 kHz %.2f dB\n", mode, s, below);
    check(s >= 3.0, "the S loses at least 3 dB");
    if (mode == FEQ_DEESSER_WHOLE) {
      // The whole processed signal dips: what is under 1 kHz goes too.
      check(below >= 1.0, "Whole voice dips under 1 kHz with the S");
    } else if (mode == FEQ_DEESSER_TREBLE) {
      // A split two octaves up still reaches 1 kHz a little.
      check(below <= 0.5, "Treble moves what is under 1 kHz half a decibel at most");
    } else {
      check(below <= 0.1, "what is under 1 kHz is left alone");
    }
  }
}

/**
 * At the speech chains' settings, a spectral cut leaves the sound under an
 * S at its level.
 *
 * The Speech and Podcast chains ran the De-esser in Whole voice: every S
 * turned everything down by up to 8 dB — the bed under the voice, a second
 * voice, the start of the next vowel — and gave it back over 50 ms, heard as
 * a limiter pumping (Ivan, 2026-10-14). Measured under 1 kHz while each S
 * plays — the scene leaves a gap before the next vowel, so what an S takes
 * down there is the bed — at the settings those chains used; Whole voice at
 * the same settings is the control.
 */
void speech_keeps_its_level_through_an_s() {
  std::printf("the sound under an S, at the speech chains' settings\n");
  SceneOptions options;
  options.hats = false;
  const Scene scene = make_scene(options);
  const std::vector<Event>& through = scene.esses;
  const double in = low_energy(scene.mix, through, 0, scene.rate);
  double losses[2] = {};
  for (const int mode : {FEQ_DEESSER_SPECTRAL, FEQ_DEESSER_WHOLE}) {
    FeqDeEsserSettings settings = vocal_music();
    settings.sensitivity = 0.6;
    settings.low_hz = 4000.0;
    settings.high_hz = 10000.0;
    settings.range_db = 8.0;
    settings.release_ms = 50.0;
    settings.centre_only = 0;
    settings.keep_cymbals = 0.3;
    settings.mode = mode;
    const Signal out = run(scene, settings);
    const double loss =
        10.0 * std::log10(in / low_energy(out, through, 96, scene.rate));
    const double s = loss_db(scene, out, 2, scene.esses);
    std::printf("  %-8s S %.2f dB, under 1 kHz through it %.2f dB\n",
                mode == FEQ_DEESSER_WHOLE ? "whole" : "spectral", s, loss);
    losses[mode == FEQ_DEESSER_WHOLE ? 1 : 0] = loss;
    check(s >= 3.0, "the S loses at least 3 dB");
  }
  check(losses[1] >= 2.0, "control: Whole voice takes the sound under it down");
  check(losses[0] <= 0.1, "a spectral cut leaves it at its level");
}

void isolate_is_what_is_taken() {
  std::printf("Isolate plays exactly what is taken away\n");
  const Scene scene = make_scene(SceneOptions{});
  const Signal cut = run(scene, vocal_music());
  FeqDeEsserSettings listening = vocal_music();
  listening.isolate = 1;
  const Signal taken = run(scene, listening);
  double worst = 0.0;
  double removed = 0.0;
  for (size_t at = 96; at < cut.left.size() - kBlock; ++at) {
    const double expected =
        static_cast<double>(scene.mix.left[at - 96]) - cut.left[at];
    worst = std::fmax(worst, std::fabs(expected - taken.left[at]));
    removed = std::fmax(removed, std::fabs(expected));
  }
  std::printf("  largest removed sample %.4f, largest disagreement %.2e\n",
              removed, worst);
  check(removed > 0.01, "control: something was taken away");
  check(worst < 1e-6, "Isolate is the input less what plays, sample for sample");
}

void the_cut_stays_within_the_dial() {
  std::printf("no band is cut deeper than Up to\n");
  SceneOptions loud;
  loud.hats = false;
  loud.s_db = 6.0;  // an S louder than the vowels: as harsh as it gets
  const Scene scene = make_scene(loud);
  for (const double range : {3.0, 6.0, 12.0}) {
    FeqDeEsserSettings settings = vocal_music();
    settings.range_db = range;
    FeqDeEsser* stage = feq_deesser_create(scene.rate, 2);
    feq_deesser_configure(stage, &settings, nullptr, nullptr);
    Signal out = scene.mix;
    double deepest = 0.0;
    for (size_t at = 0; at + kBlock <= out.left.size(); at += kBlock) {
      float* channels[2] = {out.left.data() + at, out.right.data() + at};
      feq_deesser_process(stage, channels, kBlock, 0);
      FeqDeEsserReport report{};
      feq_deesser_block_report(stage, &report);
      deepest = std::fmin(deepest, static_cast<double>(report.reduction_db));
    }
    feq_deesser_destroy(stage);
    std::printf("  Up to %.0f dB: deepest %.2f dB\n", range, deepest);
    check(deepest >= -range - 0.01, "never deeper than the dial");
    check(deepest <= -range + 1.0, "control: a harsh S reaches the dial");
  }
}

void surround_keeps_its_lfe_and_rears() {
  std::printf("on 5.1, the centre is cut and the LFE and rears are left alone\n");
  SceneOptions options;
  options.hats = false;
  const Scene scene = make_scene(options);
  const size_t count = scene.mix.left.size();
  // FL FR FC LFE BL BR: the voice in the centre channel, a low hum in the
  // LFE, the band in the rears.
  std::vector<std::vector<float>> in(6, std::vector<float>(count, 0.0f));
  for (size_t at = 0; at < count; ++at) {
    const float centre = 0.5f * (scene.mix.left[at] + scene.mix.right[at]);
    in[2][at] = centre;
    in[3][at] = static_cast<float>(
        0.3 * std::sin(2.0 * feq_test::kPi * 50.0 * at / scene.rate));
    in[4][at] = 0.2f * scene.mix.left[at];
    in[5][at] = 0.2f * scene.mix.right[at];
  }
  FeqDeEsser* stage = feq_deesser_create(scene.rate, 6);
  feq_deesser_set_layout(stage, 3, 2);
  const FeqDeEsserSettings settings = vocal_music();
  feq_deesser_configure(stage, &settings, nullptr, nullptr);
  std::vector<std::vector<float>> out = in;
  for (size_t at = 0; at + kBlock <= count; at += kBlock) {
    float* channels[6];
    for (int channel = 0; channel < 6; ++channel) {
      channels[channel] = out[channel].data() + at;
    }
    feq_deesser_process(stage, channels, kBlock, 0);
  }
  feq_deesser_destroy(stage);
  bool untouched = true;
  for (const int channel : {3, 4, 5}) {
    for (size_t at = 96; at < count - kBlock; ++at) {
      untouched = untouched && out[channel][at] == in[channel][at - 96];
    }
  }
  const double centre_loss =
      10.0 * std::log10(band_energy(in[2], in[2], 0, scene.esses, 0, scene.rate) /
                        band_energy(out[2], out[2], 0, scene.esses, 96, scene.rate));
  std::printf("  centre S %.2f dB; LFE and rears exactly delayed: %s\n",
              centre_loss, untouched ? "yes" : "no");
  check(centre_loss >= 3.0, "the S in the centre channel loses at least 3 dB");
  check(untouched, "the LFE and the rears are their input, delayed");
}

void a_handover_changes_nothing() {
  std::printf("a handover mid-song plays on exactly as one stage would\n");
  const Scene scene = make_scene(SceneOptions{});
  const Signal whole = run(scene, vocal_music());
  FeqDeEsser* first = feq_deesser_create(scene.rate, 2);
  const FeqDeEsserSettings settings = vocal_music();
  feq_deesser_configure(first, &settings, nullptr, nullptr);
  FeqDeEsser* second = feq_deesser_create(scene.rate, 2);
  feq_deesser_configure(second, &settings, nullptr, nullptr);
  Signal out = scene.mix;
  // In the middle of the first S, 450 ms in.
  const size_t swap = (static_cast<size_t>(0.45 * scene.rate) / kBlock) * kBlock;
  for (size_t at = 0; at + kBlock <= out.left.size(); at += kBlock) {
    if (at == swap) {
      feq_deesser_transfer(second, first);
    }
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_deesser_process(at < swap ? first : second, channels, kBlock, 0);
  }
  feq_deesser_destroy(first);
  feq_deesser_destroy(second);
  bool same = true;
  for (size_t at = 0; at < out.left.size(); ++at) {
    same = same && out.left[at] == whole.left[at] && out.right[at] == whole.right[at];
  }
  check(same, "every sample is the uninterrupted stage's");
}

/**
 * An S that is a pure 7 kHz tone, so anything an edit adds shows as energy
 * where the tone has none: above 15 kHz. A cut's own gain change makes
 * sidebands a few hundred hertz either side of the tone; a step makes them
 * everywhere.
 */
Signal tone_s(double rate, double seconds) {
  const auto count = static_cast<size_t>(seconds * rate);
  Signal tone;
  tone.left.resize(count);
  tone.right.resize(count);
  for (size_t at = 0; at < count; ++at) {
    const double t = static_cast<double>(at) / rate;
    const double rise = std::fmin(1.0, t / 0.02);
    const auto sample = static_cast<float>(
        0.2 * rise * std::sin(2.0 * feq_test::kPi * 7000.0 * t));
    tone.left[at] = sample;
    tone.right[at] = sample;
  }
  return tone;
}

/** The stage over `in`, `after` configured between blocks at `edit`. */
Signal run_with_edit(const Signal& in, double rate,
                     const FeqDeEsserSettings& before,
                     const FeqDeEsserSettings& after, size_t edit) {
  FeqDeEsser* stage = feq_deesser_create(rate, 2);
  feq_deesser_configure(stage, &before, nullptr, nullptr);
  Signal out = in;
  for (size_t at = 0; at + kBlock <= out.left.size(); at += kBlock) {
    if (at == edit) {
      feq_deesser_configure(stage, &after, nullptr, nullptr);
    }
    float* channels[2] = {out.left.data() + at, out.right.data() + at};
    feq_deesser_process(stage, channels, kBlock, 0);
  }
  feq_deesser_destroy(stage);
  return out;
}

/**
 * The loudest sample above 15 kHz over the 60 ms from `from`, dBFS, through
 * an eighth-order high-pass: four sections, so the 7 kHz tone itself is about
 * 55 dB under its own level there and what is left is what an edit added.
 */
double above_tone_db(const Signal& signal, size_t from, double rate) {
  std::vector<float> high = signal.left;
  const FeqBiquadCoefficients above =
      feq_biquad_coefficients(FEQ_FILTER_HPQ, 15000.0, 0.0, 0.7071, rate);
  for (int section = 0; section < 4; ++section) {
    FeqBiquadState state{};
    feq_biquad_process(&state, high.data(), static_cast<uint32_t>(high.size()),
                       &above);
  }
  double peak = 1e-12;
  for (size_t at = from; at < from + static_cast<size_t>(0.06 * rate); ++at) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(high[at])));
  }
  return 20.0 * std::log10(peak);
}

void an_edit_mid_s_does_not_click() {
  std::printf("an edit in the middle of an S does not click\n");
  const double rate = 48000.0;
  const Signal tone = tone_s(rate, 0.6);
  const size_t edit = (static_cast<size_t>(0.3 * rate) / kBlock) * kBlock;
  const FeqDeEsserSettings before = vocal_music();
  struct Edit {
    const char* what;
    FeqDeEsserSettings after;
  };
  std::vector<Edit> edits;
  FeqDeEsserSettings moved = before;
  moved.low_hz = 5600.0;
  moved.high_hz = 9000.0;
  edits.push_back({"the listening range moved", moved});
  FeqDeEsserSettings treble = before;
  treble.mode = FEQ_DEESSER_TREBLE;
  edits.push_back({"Spectral to Treble", treble});
  FeqDeEsserSettings off = before;
  off.enabled = 0;
  edits.push_back({"switched off", off});
  FeqDeEsserSettings shallower = before;
  shallower.range_db = 2.0;
  edits.push_back({"Up to 6 to 2 dB", shallower});
  const Signal plain = run_with_edit(tone, rate, before, before, edit);
  const double steady = above_tone_db(plain, edit, rate);
  for (const Edit& change : edits) {
    const Signal edited = run_with_edit(tone, rate, before, change.after, edit);
    // The control: the edit taken at once, the two outputs spliced.
    const Signal other = run_with_edit(tone, rate, change.after, change.after, edit);
    Signal spliced = plain;
    for (size_t at = edit; at < spliced.left.size(); ++at) {
      spliced.left[at] = other.left[at];
      spliced.right[at] = other.right[at];
    }
    const double heard = above_tone_db(edited, edit, rate);
    const double control = above_tone_db(spliced, edit, rate);
    std::printf("  %s: above 15 kHz %.1f dBFS (steady %.1f, spliced %.1f)\n",
                change.what, heard, steady, control);
    check(heard < control - 20.0, "at least 20 dB under the splice");
  }
}

void every_way_mono() {
  std::printf("a mono stream is listened to and cut as one lane\n");
  SceneOptions options;
  options.hats = false;
  const Scene scene = make_scene(options);
  std::vector<float> mono(scene.mix.left.size());
  for (size_t at = 0; at < mono.size(); ++at) {
    mono[at] = 0.5f * (scene.mix.left[at] + scene.mix.right[at]);
  }
  FeqDeEsser* stage = feq_deesser_create(scene.rate, 1);
  const FeqDeEsserSettings settings = vocal_music();
  feq_deesser_configure(stage, &settings, nullptr, nullptr);
  std::vector<float> out = mono;
  for (size_t at = 0; at + kBlock <= out.size(); at += kBlock) {
    float* channels[1] = {out.data() + at};
    feq_deesser_process(stage, channels, kBlock, 0);
  }
  feq_deesser_destroy(stage);
  const double loss =
      10.0 * std::log10(band_energy(mono, mono, 0, scene.esses, 0, scene.rate) /
                        band_energy(out, out, 0, scene.esses, 96, scene.rate));
  std::printf("  mono S %.2f dB\n", loss);
  check(loss >= 3.0, "the S loses at least 3 dB");
}

}  // namespace

int main() {
  three_ways_of_cutting();
  speech_keeps_its_level_through_an_s();
  isolate_is_what_is_taken();
  the_cut_stays_within_the_dial();
  surround_keeps_its_lfe_and_rears();
  a_handover_changes_nothing();
  an_edit_mid_s_does_not_click();
  every_way_mono();
  return feq_test::finish();
}

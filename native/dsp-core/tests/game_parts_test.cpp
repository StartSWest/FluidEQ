/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Game filter's parts beside the lift (`footsteps.h`, `game_parts.h`):
 * a voice in the centre brought forward and everything else stepped back, a
 * game's bed turned down or up while what stands out of it keeps its level,
 * and Heavy's weight band — each beside the control that does nothing, and
 * each the input to the bit at zero.
 */
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/footsteps.h"

namespace {

using feq_test::check;
using feq_test::kPi;

using Channels = std::vector<std::vector<float>>;

constexpr double kRates[] = {44100.0, 48000.0, 88200.0, 96000.0,
                            176400.0, 192000.0, 352800.0, 384000.0};

struct Lcg {
  uint32_t seed;
  double next() {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<double>(seed >> 8) / 8388608.0 - 1.0;
  }
};

/** RBJ band-pass, constant 0 dB peak, for measuring and for shaping. */
struct BandPass {
  double b0, a1, a2, z1 = 0.0, z2 = 0.0;
  BandPass(double rate, double hz, double q) {
    const double w = 2.0 * kPi * hz / rate;
    const double alpha = std::sin(w) / (2.0 * q);
    const double a0 = 1.0 + alpha;
    b0 = alpha / a0;
    a1 = -2.0 * std::cos(w) / a0;
    a2 = (1.0 - alpha) / a0;
  }
  double run(double x) {
    const double y = b0 * x + z1;
    z1 = -a1 * y + z2;
    z2 = -b0 * x - a2 * y;
    return y;
  }
};

double db(double ratio) { return 10.0 * std::log10(ratio + 1e-30); }

/**
 * Speech as the stage hears it: syllables of a 130 Hz voice whose harmonics
 * are shaped by three formants, 180 ms each with a raised-cosine envelope,
 * 70 to 150 ms apart, and a breath of 600 ms after every six. Peak 1.
 */
std::vector<float> speech(double rate, double seconds) {
  const size_t count = static_cast<size_t>(rate * seconds);
  std::vector<float> out(count, 0.0f);
  Lcg r{1234567u};
  const double f0 = 130.0;
  const double formants[3][2] = {{650.0, 1.0}, {1700.0, 0.6}, {2700.0, 0.3}};
  double t = 0.3;
  int syllable = 0;
  while (t < seconds - 0.3) {
    const double length = 0.18;
    const double level = 0.55 + 0.45 * (0.5 * (r.next() + 1.0));
    const auto start = static_cast<size_t>(t * rate);
    const auto frames = static_cast<size_t>(length * rate);
    const double pitch = f0 * (1.0 + 0.08 * r.next());
    for (size_t i = 0; i < frames && start + i < count; ++i) {
      const double time = static_cast<double>(i) / rate;
      const double envelope = 0.5 - 0.5 * std::cos(2.0 * kPi * time / length);
      double sample = 0.0;
      for (int k = 1; pitch * k < 4000.0; ++k) {
        const double hz = pitch * k;
        double weight = 0.05;
        for (const auto& formant : formants) {
          const double distance = (hz - formant[0]) / (0.18 * formant[0]);
          weight += formant[1] / (1.0 + distance * distance);
        }
        sample += weight * std::sin(2.0 * kPi * hz * time) / std::sqrt(k);
      }
      out[start + i] += static_cast<float>(level * envelope * sample);
    }
    t += length + 0.07 + 0.08 * (0.5 * (r.next() + 1.0));
    if (++syllable % 6 == 0) t += 0.6;
  }
  feq_test::normalise(out, 1.0);
  return out;
}

/** Two unrelated pinks at `peak`: a bed that falls on every side. */
void add_wide_bed(Channels& channels, size_t first, double peak) {
  for (size_t c = first; c < channels.size(); ++c) {
    feq_test::Pink pink{feq_test::Noise{static_cast<uint32_t>(97u + 31u * c)},
                        0.0, 0.0, 0.0};
    for (float& sample : channels[c]) {
      sample += static_cast<float>(peak * 0.25 * pink.next());
    }
  }
}

/**
 * A step at `hz`: band-passed noise, 3 ms rise and a 40 ms decay, every half
 * second from `from`, both ears alike but `pan` (0 is the centre, 1 the left).
 */
void add_steps(Channels& channels, double rate, double hz, double peak,
               double from, double pan) {
  Lcg r{4242u};
  const size_t count = channels[0].size();
  for (double t = from; t < static_cast<double>(count) / rate - 0.2; t += 0.5) {
    BandPass shape(rate, hz, 1.2);
    const auto start = static_cast<size_t>(t * rate);
    const auto frames = static_cast<size_t>(0.15 * rate);
    for (size_t i = 0; i < frames && start + i < count; ++i) {
      const double time = static_cast<double>(i) / rate;
      const double envelope =
          std::min(1.0, time / 0.003) * std::exp(-time / 0.04);
      // White noise through a fixed-Hz band loses power as the sample rate
      // rises. Anchor its spectral density at the original 48 kHz fixture:
      // otherwise the "same" 384 kHz step was nine dB quieter relative to
      // the scene, which tests different inputs rather than rate parity.
      const double sample = 3.0 * peak * std::sqrt(rate / 48000.0) *
                            envelope * shape.run(r.next());
      channels[0][start + i] += static_cast<float>(sample * (1.0 + pan));
      channels[1][start + i] += static_cast<float>(sample * (1.0 - pan));
    }
  }
}

Channels silence(size_t channels, double rate, double seconds) {
  return Channels(channels,
                  std::vector<float>(static_cast<size_t>(rate * seconds), 0.0f));
}

struct Run {
  Channels out;
  FeqFootstepsReport most{};
};

/** Through the stage a 10 ms block at a time, the report folded as a page would. */
Run run(const Channels& in, double rate, const FeqFootstepsSettings& settings,
        int lfe = -1, int centre = -1) {
  FeqFootsteps* stage =
      feq_footsteps_create(rate, static_cast<uint32_t>(in.size()));
  feq_footsteps_configure(stage, &settings);
  feq_footsteps_set_lfe(stage, lfe);
  feq_footsteps_set_centre(stage, centre);
  Run result{in, {}};
  result.most.duck_db = 0.0f;
  const auto block = static_cast<uint32_t>(rate / 100.0);
  std::vector<float*> pointers(in.size());
  const size_t total = in[0].size();
  for (size_t at = 0; at + block <= total; at += block) {
    for (size_t c = 0; c < in.size(); ++c) pointers[c] = result.out[c].data() + at;
    feq_footsteps_process(stage, pointers.data(), block);
    FeqFootstepsReport report{};
    feq_footsteps_block_report(stage, &report);
    // The first two seconds are the stage learning the scene.
    if (static_cast<double>(at) / rate >= 2.0) {
      result.most.voice = std::max(result.most.voice, report.voice);
      result.most.voice_db = std::max(result.most.voice_db, report.voice_db);
      result.most.duck_db = std::min(result.most.duck_db, report.duck_db);
    }
  }
  feq_footsteps_destroy(stage);
  return result;
}

FeqFootstepsSettings game() {
  FeqFootstepsSettings settings{};
  feq_footsteps_settings_defaults(&settings);
  settings.enabled = 1;
  settings.lift = 0.0;
  settings.calm = 0.0;
  return settings;
}

/** A signal's energy in a band, between two times. */
double band_energy(const std::vector<float>& signal, double rate, double hz,
                   double q, double from, double to) {
  BandPass filter(rate, hz, q);
  double total = 0.0;
  const auto first = static_cast<size_t>(from * rate);
  const auto last = std::min(signal.size(), static_cast<size_t>(to * rate));
  for (size_t i = 0; i < last; ++i) {
    const double y = filter.run(signal[i]);
    if (i >= first) total += y * y;
  }
  return total;
}

std::vector<float> mid(const Channels& c) {
  std::vector<float> out(c[0].size());
  for (size_t i = 0; i < out.size(); ++i) out[i] = 0.5f * (c[0][i] + c[1][i]);
  return out;
}

std::vector<float> side(const Channels& c) {
  std::vector<float> out(c[0].size());
  for (size_t i = 0; i < out.size(); ++i) out[i] = 0.5f * (c[0][i] - c[1][i]);
  return out;
}

double energy(const std::vector<float>& signal, double rate, double from,
              double to) {
  double total = 0.0;
  for (size_t i = static_cast<size_t>(from * rate);
       i < std::min(signal.size(), static_cast<size_t>(to * rate)); ++i) {
    total += static_cast<double>(signal[i]) * signal[i];
  }
  return total;
}

bool same(const Channels& one, const Channels& other) {
  for (size_t c = 0; c < one.size(); ++c) {
    if (one[c] != other[c]) return false;
  }
  return true;
}

/** Dialogue over a wide bed 18 dB under it: the scene the dial is for. */
Channels dialogue_scene(double rate) {
  Channels scene = silence(2, rate, 10.0);
  const std::vector<float> voice = speech(rate, 10.0);
  for (size_t i = 0; i < voice.size(); ++i) {
    scene[0][i] += 0.3f * voice[i];
    scene[1][i] += 0.3f * voice[i];
  }
  add_wide_bed(scene, 0, 0.3 * std::pow(10.0, -18.0 / 20.0));
  return scene;
}

void a_voice_comes_forward_and_the_rest_steps_back() {
  for (const double rate : kRates) {
    const Channels scene = dialogue_scene(rate);
    FeqFootstepsSettings settings = game();
    settings.voices = 1.0;
    settings.duck = 1;
    const Run lifted = run(scene, rate, settings);
    const Run control = run(scene, rate, game());
    // The bed is all there is in the side: how far it stepped back.
    const double bed_db = db(energy(side(lifted.out), rate, 3.0, 9.5) /
                             energy(side(scene), rate, 3.0, 9.5));
    // The voice is nearly all there is in the mid's voice band.
    const double voice_db =
        db(band_energy(mid(lifted.out), rate, 1200.0, 0.7, 3.0, 9.5) /
           band_energy(mid(scene), rate, 1200.0, 0.7, 3.0, 9.5));
    std::printf("  %.1f kHz: voice %+.2f dB, the rest %+.2f dB, voice %.2f\n",
                rate / 1000.0, voice_db, bed_db, lifted.most.voice);
    check(voice_db > 3.5, "a centred voice comes forward by more than 3.5 dB");
    check(bed_db < -3.5, "the bed steps back by more than 3.5 dB while it speaks");
    check(lifted.most.voice > 0.8, "the stage is sure a voice is speaking");
    check(same(control.out, scene), "Voices at zero and no room: the input");
  }
}

void steps_and_shots_are_not_voices() {
  const double rate = 48000.0;
  Channels scene = silence(2, rate, 10.0);
  add_wide_bed(scene, 0, 0.02);
  // The player's own boots, in the middle, and their own gun every 1.7 s.
  add_steps(scene, rate, 3000.0, 0.08, 1.0, 0.0);
  Lcg r{99u};
  for (double t = 1.3; t < 9.5; t += 1.7) {
    const auto start = static_cast<size_t>(t * rate);
    for (size_t i = 0; i < static_cast<size_t>(0.25 * rate); ++i) {
      const double envelope = std::exp(-static_cast<double>(i) / rate / 0.06);
      const auto sample = static_cast<float>(0.7 * envelope * r.next());
      scene[0][start + i] += sample;
      scene[1][start + i] += sample;
    }
  }
  FeqFootstepsSettings settings = game();
  settings.voices = 1.0;
  settings.duck = 1;
  const Run heard = run(scene, rate, settings);
  std::printf("  steps and shots: voice %.2f, duck %.2f dB\n", heard.most.voice,
              heard.most.duck_db);
  check(heard.most.voice < 0.3, "boots and a gun in the middle are no voice");
  check(heard.most.duck_db > -1.0, "and nothing steps back for them");
}

void a_voice_to_one_side_is_not_the_dialogue() {
  const double rate = 48000.0;
  Channels scene = silence(2, rate, 10.0);
  const std::vector<float> voice = speech(rate, 10.0);
  for (size_t i = 0; i < voice.size(); ++i) scene[0][i] += 0.3f * voice[i];
  add_wide_bed(scene, 0, 0.3 * std::pow(10.0, -18.0 / 20.0));
  FeqFootstepsSettings settings = game();
  settings.voices = 1.0;
  settings.duck = 1;
  const Run heard = run(scene, rate, settings);
  std::printf("  voice at the left: voice %.2f\n", heard.most.voice);
  check(heard.most.voice < 0.3, "a voice off to one side is a sound, not the dialogue");
}

void surround_brings_the_centre_forward() {
  const double rate = 48000.0;
  // L R C LFE Ls Rs.
  Channels scene = silence(6, rate, 10.0);
  const std::vector<float> voice = speech(rate, 10.0);
  for (size_t i = 0; i < voice.size(); ++i) scene[2][i] = 0.3f * voice[i];
  Channels bed = silence(6, rate, 10.0);
  add_wide_bed(bed, 0, 0.3 * std::pow(10.0, -15.0 / 20.0));
  for (const size_t c : {0u, 1u, 4u, 5u}) scene[c] = bed[c];
  scene[3] = bed[3];
  FeqFootstepsSettings settings = game();
  settings.voices = 1.0;
  settings.duck = 1;
  const Run lifted = run(scene, rate, settings, 3, 2);
  const double voice_db =
      db(band_energy(lifted.out[2], rate, 1200.0, 0.7, 3.0, 9.5) /
         band_energy(scene[2], rate, 1200.0, 0.7, 3.0, 9.5));
  const double rear_db = db(energy(lifted.out[4], rate, 3.0, 9.5) /
                            energy(scene[4], rate, 3.0, 9.5));
  std::printf("  5.1: centre's voice %+.2f dB, a rear %+.2f dB\n", voice_db,
              rear_db);
  check(voice_db > 3.5, "the centre channel's voice comes forward");
  check(rear_db < -3.5, "the rears step back while it speaks");
  check(lifted.out[3] == scene[3], "the LFE is never touched");
}

/** Rain 30 dB down on every side, and a step 15 dB over it every half second. */
Channels rain_and_steps(double rate) {
  Channels scene = silence(2, rate, 10.0);
  add_wide_bed(scene, 0, std::pow(10.0, -30.0 / 20.0));
  add_steps(scene, rate, 2400.0, 0.1, 0.75, 0.4);
  return scene;
}

/** The gaps between steps: from 0.25 s after one to just before the next. */
double gaps_energy(const std::vector<float>& signal, double rate) {
  double total = 0.0;
  for (double t = 3.0; t < 9.5; t += 0.5) total += energy(signal, rate, t + 0.05, t + 0.2);
  return total;
}

double fronts_energy(const std::vector<float>& signal, double rate) {
  double total = 0.0;
  for (double t = 3.25; t < 9.5; t += 0.5) {
    total += band_energy(signal, rate, 2400.0, 1.0, t, t + 0.04);
  }
  return total;
}

void the_bed_comes_down_and_a_step_keeps_its_level() {
  for (const double rate : kRates) {
    const Channels scene = rain_and_steps(rate);
    FeqFootstepsSettings settings = game();
    settings.environment = -1.0;
    const Run lowered = run(scene, rate, settings);
    const double bed_db =
        db(gaps_energy(lowered.out[1], rate) / gaps_energy(scene[1], rate));
    const double step_db =
        db(fronts_energy(lowered.out[0], rate) / fronts_energy(scene[0], rate));
    settings.environment = 1.0;
    const Run raised = run(scene, rate, settings);
    const double up_db =
        db(gaps_energy(raised.out[1], rate) / gaps_energy(scene[1], rate));
    std::printf("  %.1f kHz: rain %+.2f dB (down) %+.2f dB (up), steps %+.2f dB\n",
                rate / 1000.0, bed_db, up_db, step_db);
    check(bed_db < -6.0, "Environment down takes the rain down by more than 6 dB");
    check(up_db > 3.5, "Environment up brings it up by more than 3.5 dB");
    check(step_db > -2.0, "and a step that stands out of it keeps its level");
    check(same(run(scene, rate, game()).out, scene), "at zero: the input");
  }
}

void a_step_with_its_own_3d_sound_is_not_rain() {
  // A step that reaches the right ear 0.6 ms after the left, as a game's own
  // HRTF would put it: unrelated waveforms above 1 kHz, envelopes as one.
  const double rate = 48000.0;
  Channels scene = silence(2, rate, 10.0);
  Lcg r{777u};
  const auto lag = static_cast<size_t>(0.0006 * rate);
  BandPass shape(rate, 3000.0, 0.8);
  std::vector<float> clatter(scene[0].size(), 0.0f);
  for (size_t i = 0; i < clatter.size(); ++i) {
    // A run of footfalls six times a second, none of it still.
    const double time = static_cast<double>(i) / rate;
    const double envelope = std::exp(-std::fmod(time, 0.166) / 0.03);
    clatter[i] = static_cast<float>(0.2 * envelope * shape.run(r.next()));
  }
  for (size_t i = 0; i < clatter.size(); ++i) {
    scene[0][i] = clatter[i];
    scene[1][i] = i >= lag ? clatter[i - lag] : 0.0f;
  }
  FeqFootstepsSettings settings = game();
  settings.environment = -1.0;
  const Run heard = run(scene, rate, settings);
  const double moved =
      db(energy(heard.out[0], rate, 3.0, 9.5) / energy(scene[0], rate, 3.0, 9.5));
  std::printf("  3D footfalls: %+.2f dB\n", moved);
  check(moved > -1.5, "footfalls placed by a game's own 3D sound are not environment");
}

void heavy_lifts_the_weight_band_further() {
  const double rate = 48000.0;
  Channels scene = silence(2, rate, 10.0);
  add_wide_bed(scene, 0, std::pow(10.0, -60.0 / 20.0));
  // Hooves: thuds at 300 Hz, well over the bed and well under the
  // programme's -24 dB floor, where a lift goes.
  add_steps(scene, rate, 300.0, 0.05, 0.75, 0.2);
  FeqFootstepsSettings settings = game();
  settings.lift = 1.0;
  const Run plain = run(scene, rate, settings);
  settings.heavy = 1;
  const Run heavy = run(scene, rate, settings);
  double plain_db = 0.0;
  double heavy_db = 0.0;
  for (double t = 3.25; t < 9.5; t += 0.5) {
    const double in = band_energy(scene[0], rate, 300.0, 1.0, t, t + 0.06);
    plain_db += db(band_energy(plain.out[0], rate, 300.0, 1.0, t, t + 0.06) / in);
    heavy_db += db(band_energy(heavy.out[0], rate, 300.0, 1.0, t, t + 0.06) / in);
  }
  plain_db /= 13.0;
  heavy_db /= 13.0;
  std::printf("  hooves: %+.2f dB plain, %+.2f dB heavy\n", plain_db, heavy_db);
  check(heavy_db > plain_db + 3.0, "Heavy lifts a hoof's thud 3 dB further");
}

void every_part_adds_within_the_available_headroom() {
  for (const double rate : kRates) {
    for (int part = 0; part < 5; ++part) {
      Channels scene = dialogue_scene(rate);
      if (part < 2) {
        for (size_t c = 0; c < 2; ++c) for (size_t i = 0; i < scene[c].size(); ++i)
          scene[c][i] = static_cast<float>(std::sin(2 * kPi * 110 * i / rate + c * 0.4));
      }
      if (part == 4) {
        for (size_t c = 0; c < 2; ++c) for (size_t i = 0; i < scene[c].size(); ++i) {
          const double t = static_cast<double>(i) / rate;
          const double burst = t > 5 ? std::exp(-(t-5)/0.4) : 0;
          scene[c][i] = static_cast<float>((0.02 + burst) * std::sin(2*kPi*90*t));
        }
      }
      double peak = 0;
      for (const auto& c : scene) for (float x : c) peak = std::max(peak, std::fabs(static_cast<double>(x)));
      for (auto& c : scene) for (float& x : c) x = static_cast<float>(x * 0.98 / peak);
      auto settings = game();
      if (part < 2) settings.environment = part == 0 ? 1 : -1;
      else if (part == 4) settings.calm = 1;
      else { settings.voices = 1; settings.duck = part == 3 ? 1 : 0; }
      const auto heard = run(scene, rate, settings);
      double after = 0;
      for (const auto& c : heard.out) for (float x : c) after = std::max(after, std::fabs(static_cast<double>(x)));
      std::printf("  %.0f Hz, part %d: hot original 0.98, output %.8f\n", rate, part, after);
      check(after <= 0.980001, "Environment, Voices, duck and Calm create no over from a hot original");
      Channels control = scene;
      for (auto& c : control) for (float& x : c) x *= 0.25f;
      check(!same(run(control, rate, settings).out, control),
            "control: the selected part really changes sound with headroom");
    }
  }
}

}  // namespace

int main() {
  std::printf("game_parts\n");
  a_voice_comes_forward_and_the_rest_steps_back();
  steps_and_shots_are_not_voices();
  a_voice_to_one_side_is_not_the_dialogue();
  surround_brings_the_centre_forward();
  the_bed_comes_down_and_a_step_keeps_its_level();
  a_step_with_its_own_3d_sound_is_not_rain();
  heavy_lifts_the_weight_band_further();
  every_part_adds_within_the_available_headroom();
  return feq_test::finish();
}

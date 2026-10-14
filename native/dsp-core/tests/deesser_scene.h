/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A mix the De-esser can be held to: a voice in the centre singing vowels and
 * S's, a hi-hat panned to one side on every sixteenth, a band under them, and
 * optionally a ride cymbal washing through the whole thing.
 *
 * Synthetic, so every run measures the same thing and every event's place is
 * known to the sample — which is what lets a test say "the S lost 5 dB and the
 * hi-hat between them lost 0.3" instead of "it sounds better". Built to the
 * textbook shape of each sound, not measured from a recording:
 *
 * - The vowels are harmonics of 180 Hz up to 3.5 kHz with two formants, so
 *   the song's body sits where a voice's does.
 * - An S is noise between 4.5 and 10 kHz rising over 15 ms, held 100 ms and
 *   falling over 30 ms — a fricative, not a click — 6 dB under the vowels.
 * - A closed hi-hat is noise above 7 kHz that decays in about 40 ms, struck
 *   in one sample, panned 0.9 left and 0.35 right, its band level near the S's.
 * - The ride is noise from 3 to 16 kHz, steady and wide, about 10 dB under
 *   the S in each band.
 */
#ifndef FLUIDEQ_DEESSER_SCENE_H
#define FLUIDEQ_DEESSER_SCENE_H

#include <cmath>
#include <cstdint>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/biquad.h"

namespace feq_deesser_test {

using feq_test::kPi;
using feq_test::Noise;
using feq_test::Signal;

struct Event {
  size_t from;
  size_t to;
};

struct Scene {
  double rate = 48000.0;
  Signal mix;
  /** Where each S plays, and each hi-hat that has no S anywhere near it. */
  std::vector<Event> esses;
  std::vector<Event> lone_hats;
};

struct SceneOptions {
  double rate = 48000.0;
  double seconds = 6.0;
  /** Scales everything, so the same scene can be played quiet and loud. */
  double level_db = 0.0;
  bool hats = true;
  bool ride = false;
  /** The S's level against the vowels, dB. */
  double s_db = -6.0;
  /** The vowels' highest harmonic: 3.5 kHz reaches the lowest band's skirt. */
  double vowel_top_hz = 3500.0;
  /** Where the hi-hat sits: its gain on each side. */
  double hat_left = 0.9;
  double hat_right = 0.35;
};

/**
 * Noise through two biquads: a band, made the way the stage's own are.
 *
 * Scaled by the root of the rate over 48 kHz, so its density in a band is
 * the same at every rate: white noise of one level spread over twice the
 * bandwidth puts half its power in each band, and the S would be quieter at
 * 96 kHz for a reason no recording has.
 */
struct BandNoise {
  Noise noise;
  double density = 1.0;
  FeqBiquadState low{};
  FeqBiquadState high{};
  FeqBiquadCoefficients above{};
  FeqBiquadCoefficients below{};
  BandNoise(uint32_t seed, double from_hz, double to_hz, double rate)
      : noise{seed}, density(std::sqrt(rate / 48000.0)) {
    // Analog-matched, so the band has the same shape at every rate.
    above = feq_biquad_coefficients_matched(FEQ_FILTER_HPQ, from_hz, 0.0, 0.7071, rate);
    below = feq_biquad_coefficients_matched(FEQ_FILTER_LPQ, to_hz, 0.0, 0.7071, rate);
  }
  double next() {
    float sample = static_cast<float>(noise.next() * density);
    feq_biquad_process(&high, &sample, 1, &above);
    feq_biquad_process(&low, &sample, 1, &below);
    return static_cast<double>(sample);
  }
};

inline double smooth_edge(double x) {
  return x <= 0.0 ? 0.0 : x >= 1.0 ? 1.0 : 0.5 - 0.5 * std::cos(kPi * x);
}

inline Scene make_scene(const SceneOptions& options) {
  Scene scene;
  scene.rate = options.rate;
  const double rate = options.rate;
  const auto count = static_cast<size_t>(options.seconds * rate);
  scene.mix.left.assign(count, 0.0f);
  scene.mix.right.assign(count, 0.0f);
  const double gain = std::pow(10.0, options.level_db / 20.0);
  const double s_gain = std::pow(10.0, options.s_db / 20.0);

  BandNoise ess(12345u, 4500.0, 10000.0, rate);
  BandNoise hat(777u, 7000.0, 18000.0, rate);
  BandNoise ride_left(4242u, 3000.0, 16000.0, rate);
  BandNoise ride_right(9191u, 3000.0, 16000.0, rate);
  // The band under the voice: two unrelated noises from 60 Hz to 3 kHz, made
  // like the rest so the bed is the same at every rate.
  BandNoise bed_left(2463534242u, 60.0, 3000.0, rate);
  BandNoise bed_right(97531u, 60.0, 3000.0, rate);

  const auto per_second = static_cast<size_t>(rate);
  const auto ms = [rate](double value) {
    return static_cast<size_t>(value * rate / 1000.0);
  };
  // Within each second: a vowel 0-350 ms, an S 380-525 ms, a vowel 560-800.
  for (size_t second = 0; second * per_second < count; ++second) {
    const size_t base = second * per_second;
    const size_t start = base + ms(380.0);
    const size_t end = start + ms(145.0);
    if (end < count) {
      scene.esses.push_back({start, end});
    }
  }
  const size_t hat_step = ms(125.0);
  const size_t hat_length = ms(45.0);
  for (size_t at = ms(62.5); at + hat_length < count; at += hat_step) {
    bool near_s = false;
    for (const Event& s : scene.esses) {
      if (at + hat_length + ms(60.0) > s.from && at < s.to + ms(120.0)) {
        near_s = true;
      }
    }
    if (!near_s) {
      scene.lone_hats.push_back({at, at + hat_length});
    }
  }

  for (size_t at = 0; at < count; ++at) {
    const double seconds = static_cast<double>(at) / rate;
    const double within = std::fmod(seconds, 1.0) * 1000.0;
    // The vowels: an envelope over the two syllables, and the harmonics.
    double vowel_envelope = 0.0;
    if (within < 350.0) {
      vowel_envelope = smooth_edge(within / 20.0) * smooth_edge((350.0 - within) / 30.0);
    } else if (within >= 560.0 && within < 800.0) {
      vowel_envelope =
          smooth_edge((within - 560.0) / 20.0) * smooth_edge((800.0 - within) / 30.0);
    }
    double vowel = 0.0;
    if (vowel_envelope > 0.0) {
      for (int harmonic = 1; harmonic * 180.0 < options.vowel_top_hz; ++harmonic) {
        const double hz = harmonic * 180.0;
        const double formant =
            1.0 / (1.0 + std::pow((hz - 700.0) / 300.0, 2.0)) +
            0.5 / (1.0 + std::pow((hz - 1800.0) / 400.0, 2.0)) + 0.05;
        vowel += formant * std::sin(2.0 * kPi * hz * seconds + harmonic);
      }
      vowel *= 0.12 * vowel_envelope;
    }
    // The S: a fricative, rising 15 ms, held, falling 30 ms.
    double s = 0.0;
    if (within >= 380.0 && within < 525.0) {
      const double into = within - 380.0;
      s = ess.next() * 0.55 * s_gain * smooth_edge(into / 15.0) *
          smooth_edge((145.0 - into) / 30.0);
    } else {
      ess.next();
    }
    // The hi-hat: struck in one sample, decaying in about 40 ms.
    double hat_sample = 0.0;
    if (options.hats) {
      const double struck = std::fmod(seconds * 1000.0 - 62.5 + 1000.0, 125.0);
      hat_sample = hat.next() * 0.9 * std::exp(-struck / 12.0);
    }
    double ride_left_sample = 0.0;
    double ride_right_sample = 0.0;
    if (options.ride) {
      ride_left_sample = ride_left.next() * 0.08;
      ride_right_sample = ride_right.next() * 0.08;
    }
    const double bed[2] = {bed_left.next() * 0.1, bed_right.next() * 0.1};
    const double centre = vowel + s;
    scene.mix.left[at] = static_cast<float>(
        gain * (centre + options.hat_left * hat_sample + ride_left_sample + bed[0]));
    scene.mix.right[at] = static_cast<float>(
        gain * (centre + options.hat_right * hat_sample + ride_right_sample + bed[1]));
  }
  return scene;
}

/** Energy between 4.5 and 11 kHz over the events, one channel or the mid. */
inline double band_energy(const std::vector<float>& left,
                          const std::vector<float>& right, int which,
                          const std::vector<Event>& events, size_t offset,
                          double rate) {
  std::vector<float> signal(left.size());
  for (size_t at = 0; at < left.size(); ++at) {
    signal[at] = which == 0   ? left[at]
                 : which == 1 ? right[at]
                              : 0.5f * (left[at] + right[at]);
  }
  FeqBiquadState high{};
  FeqBiquadState low{};
  const FeqBiquadCoefficients above =
      feq_biquad_coefficients(FEQ_FILTER_HPQ, 4500.0, 0.0, 0.7071, rate);
  const FeqBiquadCoefficients below =
      feq_biquad_coefficients(FEQ_FILTER_LPQ, 11000.0, 0.0, 0.7071, rate);
  feq_biquad_process(&high, signal.data(), static_cast<uint32_t>(signal.size()),
                     &above);
  feq_biquad_process(&low, signal.data(), static_cast<uint32_t>(signal.size()),
                     &below);
  double total = 0.0;
  for (const Event& event : events) {
    for (size_t at = event.from + offset; at < event.to + offset && at < signal.size();
         ++at) {
      total += static_cast<double>(signal[at]) * static_cast<double>(signal[at]);
    }
  }
  return total;
}

}  // namespace feq_deesser_test

#endif /* FLUIDEQ_DEESSER_SCENE_H */

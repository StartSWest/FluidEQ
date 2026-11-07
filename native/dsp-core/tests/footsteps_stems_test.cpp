/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Replay the learned filter and gains from ONE mixed render on known stems.
// Separate detector runs would misattribute changed music to the footsteps.
#include "../src/footsteps_internal.h"
#include "footsteps_test_support.h"
#include <algorithm>

namespace {
using namespace feq_footsteps_test;
using namespace feq_footsteps_detail;
using feq_test::Signal;
using feq_test::check;
constexpr double kRate = 48000;

double filter(const BandPass& band, History& h, double x) {
  const double y = band.b0 * x + h.z1;
  h.z1 = -band.a1 * y + h.z2;
  h.z2 = -band.b0 * x - band.a2 * y;
  return y;
}

double energy(const Signal& signal, size_t from, size_t to, bool right = false) {
  double sum = 0;
  const auto& channel = right ? signal.right : signal.left;
  for (size_t i = from; i < to; ++i) sum += static_cast<double>(channel[i]) * channel[i];
  return sum;
}

void measured_stems(double amount, double step_db, int music) {
  Parts parts;
  parts.bed = false;
  parts.loud = false;
  Scene scene = make_scene(kRate, parts);
  Signal steps = scene.mix, bed = scene.mix;
  const double step_gain = std::pow(10.0, step_db / 20.0);
  // The scene's quiet steps peak at -36 dB; keep their left/right position.
  for (size_t i = 0; i < steps.left.size(); ++i) {
    steps.left[i] = static_cast<float>(steps.left[i] * step_gain);
    steps.right[i] = static_cast<float>(steps.right[i] * step_gain);
    const double t = i / kRate;
    const double beat = music == 1 ? 0.65 + 0.35 * std::cos(2 * feq_test::kPi * 2 * t) : 1;
    bed.left[i] = static_cast<float>(0.12 * std::sin(2 * feq_test::kPi * 110 * t) +
        beat * 0.025 * std::sin(2 * feq_test::kPi * 523 * t) +
        (music == 2 ? 0.035 : 0.004) * std::sin(2 * feq_test::kPi * 3100 * t));
    bed.right[i] = static_cast<float>(0.12 * std::sin(2 * feq_test::kPi * 110 * t + 0.7) +
        beat * 0.025 * std::sin(2 * feq_test::kPi * 523 * t - 0.7) +
        (music == 2 ? 0.035 : 0.004) * std::sin(2 * feq_test::kPi * 3100 * t + 0.7));
  }
  Signal lifted_steps = steps, lifted_bed = bed;
  FeqFootsteps* stage = feq_footsteps_create(kRate, 2);
  auto settings = competitive();
  settings.lift = amount;
  settings.calm = 0;
  feq_footsteps_configure(stage, &settings);
  History history[2][FEQ_FOOTSTEPS_BANDS][2] = {};
  std::vector<double> past[2][FEQ_FOOTSTEPS_BANDS][2];
  for (auto& stem : past) {
    for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
      for (auto& channel : stem[b]) channel.resize(stage->bed_history[b].length);
    }
  }
  double reconstruction = 0;
  for (size_t i = 0; i < steps.left.size(); ++i) {
    double residual[2][2][FEQ_FOOTSTEPS_BANDS] = {};
    // The regression is fitted only on the mix. Each stem sees the same
    // already-learned coefficients, which are linear for this sample.
    for (int stem = 0; stem < 2; ++stem) {
      const Signal& source = stem == 0 ? steps : bed;
      for (int c = 0; c < 2; ++c) {
        const double x = c == 0 ? source.left[i] : source.right[i];
        for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
          const auto& model = stage->state.bed_prediction[b];
          const auto& delays = stage->bed_history[b];
          auto& ring = past[stem][b][c];
          const double y = filter(stage->band[b], history[stem][b][c], x);
          double predicted = 0.0;
          if (model.filled == delays.length && (model.active || model.glide_left > 0)) {
            for (int tap = 0; tap < kBedTaps; ++tap) {
              const uint32_t at = (model.write + delays.length - delays.delay[tap]) % delays.length;
              predicted += model.weight[tap] * ring[at];
            }
          }
          ring[model.write] = y;
          residual[stem][c][b] = y - predicted;
        }
      }
    }
    float l = steps.left[i] + bed.left[i], r = steps.right[i] + bed.right[i];
    float* channels[] = {&l, &r};
    feq_footsteps_process(stage, channels, 1);
    for (int stem = 0; stem < 2; ++stem) {
      const Signal& source = stem == 0 ? steps : bed;
      Signal& target = stem == 0 ? lifted_steps : lifted_bed;
      for (int c = 0; c < 2; ++c) {
        const double x = c == 0 ? source.left[i] : source.right[i];
        double delta = 0;
        for (int b = 0; b < FEQ_FOOTSTEPS_BANDS; ++b) {
          delta += (stage->state.band_gain[b] - 1) * residual[stem][c][b];
        }
        (c == 0 ? target.left[i] : target.right[i]) =
            static_cast<float>(x + stage->state.overlay.gain * delta);
      }
    }
    reconstruction = std::max({reconstruction,
      std::fabs(static_cast<double>(l - lifted_steps.left[i] - lifted_bed.left[i])),
      std::fabs(static_cast<double>(r - lifted_steps.right[i] - lifted_bed.right[i]))});
  }
  feq_footsteps_destroy(stage);
  double least = 1e9, most_bed = 0, pan = 0;
  for (double at : quiet_steps(scene)) {
    const size_t from = static_cast<size_t>(at * kRate), to = from + 4800;
    const double gain = 10 * std::log10(energy(lifted_steps, from, to) / energy(steps, from, to));
    least = std::min(least, gain);
    most_bed = std::max(most_bed, std::fabs(10 * std::log10(energy(lifted_bed, from, to) / energy(bed, from, to))));
    const double left = energy(lifted_steps, from, to) / energy(steps, from, to);
    const double right = energy(lifted_steps, from, to, true) / energy(steps, from, to, true);
    pan = std::max(pan, std::fabs(10 * std::log10(left / right)));
  }
  std::printf("lift=%.2f step_scale=%.0f music=%d actual_step_min=%.3f actual_bed_max=%.3f step_pan_shift=%.3f null=%.9f\n",
              amount, step_db, music, least, most_bed, pan, reconstruction);
  check(reconstruction < 1e-6, "control: processed stems reconstruct the actual mixed render");
  check(least >= -0.001, "the detected overlay never turns a step down");
  check(most_bed < 0.5, "the actual music stem stays within half a dB during the steps");
  check(pan < 0.25, "the known step keeps its stereo position");
  // The very weak fixture is partly buried in its band of music, and the
  // spectrally masked fixture can be missed altogether. Neither is an
  // isolation claim. Keep them measured beside a detectable positive control
  // instead of loosening the detector until rain is amplified as footsteps.
  if (music < 2 && amount >= 0.75 && step_db >= 6) {
    check(least > 2, "positive control: an audible cue really gains at least 2 dB");
  }
}
}

int main() {
  for (const double amount : {0.35, 0.75, 1.0})
    for (const double level : {0.0, 6.0, 18.0})
      for (int music = 0; music < 3; ++music) measured_stems(amount, level, music);
  return feq_test::finish();
}

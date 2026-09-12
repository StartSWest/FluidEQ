/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "denoise_live_hum.h"
#include <algorithm>
#include <cmath>

namespace {
constexpr double kPi = 3.14159265358979323846;
double finish_probe(LiveHumProbe& probe, uint32_t channels, double divisor) {
  double power = 0;
  for (uint32_t c = 0; c < channels; ++c) {
    const double a = probe.previous[c], b = probe.older[c];
    // Per-channel power avoids cancelling opposite-polarity mains noise.
    power = std::max(power, std::max(0.0, a*a + b*b - probe.coefficient*a*b) / divisor);
    probe.previous[c] = probe.older[c] = 0;
  }
  return power;
}
void decide(LiveHum& state, uint32_t channels) {
  const double divisor = static_cast<double>(state.window) * state.window;
  double scores[2]{};
  for (uint32_t family = 0; family < 2; ++family) {
    uint32_t found = 0;
    for (auto& partial : state.families[family]) {
      const double low = finish_probe(partial.probes[0], channels, divisor);
      const double centre = finish_probe(partial.probes[1], channels, divisor);
      const double high = finish_probe(partial.probes[2], channels, divisor);
      const double neighbours = std::max(1e-12, (low + high) * 0.5);
      const bool stationary = centre > 1e-10 && centre > neighbours * 4 &&
          centre > partial.previous_power * 0.5 && centre < partial.previous_power * 2;
      partial.stable_windows = stationary ? std::min(3u, partial.stable_windows + 1) : 0;
      partial.previous_power = centre;
      const bool detected = partial.stable_windows >= 3;
      if (detected) { ++found; scores[family] += centre; }
      // Never spend more notch depth than the measured excess above adjacent
      // bins. The user's maximum is not evidence that every partial needs it.
      const double excess_db = 10 * std::log10(std::max(1.0, centre / neighbours));
      const double full_reduction = 1 - std::pow(10.0, -partial.depth_db / 20);
      partial.target = detected && full_reduction > 0 ?
          (1 - std::pow(10.0, -std::min(partial.depth_db, excess_db) / 20)) / full_reduction : 0;
    }
    // A single sustained bass note is not enough evidence for a mains comb.
    // Require a persistent fundamental plus another stationary harmonic.
    if (found < 2 || state.families[family][0].stable_windows < 3) scores[family] = 0;
  }
  const int selected = scores[0] == 0 && scores[1] == 0 ? -1 : scores[0] > scores[1] ? 0 : 1;
  for (uint32_t family = 0; family < 2; ++family)
    if (static_cast<int>(family) != selected)
      for (auto& partial : state.families[family]) partial.target = 0;
}
}

void denoise_live_hum_reset(LiveHum& state) {
  state.age = 0;
  for (auto& family : state.families) for (auto& partial : family) {
    partial.previous_power = partial.mix = partial.target = 0;
    partial.stable_windows = 0;
    for (auto& filter : partial.filters) feq_biquad_reset(&filter);
    for (auto& probe : partial.probes)
      for (uint32_t c = 0; c < 2; ++c) probe.previous[c] = probe.older[c] = 0;
  }
}
void denoise_live_hum_configure(LiveHum& state, double rate, const FeqDenoiseSettings& settings) {
  state.window = std::max(1u, static_cast<uint32_t>(std::llround(rate * 0.5)));
  state.slew = 1.0 / (rate * 0.2);
  for (uint32_t family = 0; family < 2; ++family) {
    for (uint32_t index = 0; index < FEQ_DENOISE_MAX_HUM_PARTIALS; ++index) {
      auto& partial = state.families[family][index];
      const double hz = (family == 0 ? 50.0 : 60.0) * (index + 1);
      for (uint32_t probe = 0; probe < 3; ++probe) {
        const double at = hz + (static_cast<double>(probe) - 1) * 6;
        partial.probes[probe].coefficient = 2 * std::cos(2 * kPi * at / rate);
      }
      const double depth = index < std::round(settings.hum.harmonics) ? settings.hum.depth_db : 0;
      partial.depth_db = depth;
      partial.notch = feq_biquad_coefficients(FEQ_FILTER_PK, hz, -depth, settings.hum.quality, rate);
    }
  }
}
void denoise_live_hum_process(LiveHum& state, float* const* audio,
                             uint32_t channels, uint32_t frames) {
  for (uint32_t frame = 0; frame < frames; ++frame) {
    float input[2]{};
    for (uint32_t c = 0; c < channels; ++c) input[c] = audio[c][frame];
    for (auto& family : state.families) for (auto& partial : family) {
      for (auto& probe : partial.probes) for (uint32_t c = 0; c < channels; ++c) {
        const double next = input[c] + probe.coefficient * probe.previous[c] - probe.older[c];
        probe.older[c] = probe.previous[c];
        probe.previous[c] = next;
      }
      // Run every prepared section continuously and fade its contribution;
      // recognising a hum tone never inserts a cold filter or a gain step.
      partial.mix += std::clamp(partial.target - partial.mix, -state.slew, state.slew);
      for (uint32_t c = 0; c < channels; ++c) {
        const float dry = audio[c][frame];
        float wet = dry;
        feq_biquad_process(&partial.filters[c], &wet, 1, &partial.notch);
        audio[c][frame] = static_cast<float>(dry + (wet - dry) * partial.mix);
      }
    }
    if (++state.age == state.window) { decide(state, channels); state.age = 0; }
  }
}

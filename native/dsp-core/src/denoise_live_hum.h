/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_DENOISE_LIVE_HUM_H
#define FLUIDEQ_DENOISE_LIVE_HUM_H
#include <array>
#include "fluideq/biquad.h"
#include "fluideq/denoise.h"

struct LiveHumProbe {
  double coefficient = 0;
  double previous[2]{}, older[2]{};
};
struct LiveHumPartial {
  std::array<LiveHumProbe, 3> probes;
  FeqBiquadCoefficients notch{};
  FeqBiquadState filters[2]{};
  double previous_power = 0;
  double mix = 0;
  double target = 0;
  double depth_db = 0;
  uint32_t stable_windows = 0;
};
struct LiveHum {
  std::array<std::array<LiveHumPartial, FEQ_DENOISE_MAX_HUM_PARTIALS>, 2> families;
  uint32_t age = 0, window = 1;
  double slew = 0;
};
void denoise_live_hum_configure(LiveHum& state, double rate, const FeqDenoiseSettings& settings);
void denoise_live_hum_reset(LiveHum& state);
void denoise_live_hum_process(LiveHum& state, float* const* audio,
                             uint32_t channels, uint32_t frames);
#endif

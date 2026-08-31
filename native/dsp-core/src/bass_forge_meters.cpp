/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The eight-band analyser behind Bass Forge's graph, and nothing else.
 *
 * It measures the band twice — as it arrives and as it leaves — because the
 * whole claim of the stage is that those two differ in a way no single
 * spectrum can show. It touches no audio: everything here writes to the meter
 * followers and reads the two numbers the audio path hands it.
 */
#include "bass_forge_internal.h"

#include <cmath>

namespace {

/**
 * One sample through one biquad, which `biquad.h` does not expose.
 *
 * Sixteen band-passes have to run beside the audio without a buffer each, and
 * `feq_biquad_process` works in place over one. Same arithmetic and the same
 * Direct Form I state.
 */
double run_stage(FeqBiquadState* state, const FeqBiquadCoefficients& c,
                 double sample) {
  const double y = c.b0 * sample + c.b1 * state->x1 + c.b2 * state->x2 -
                   c.a1 * state->y1 - c.a2 * state->y2;
  state->x2 = state->x1;
  state->x1 = sample;
  state->y2 = state->y1;
  state->y1 = y;
  return y;
}

double level_db(double mean_square) {
  // The same floor `bass_forge.cpp` uses for its own ratios: under this there
  // is no signal to take a level of and the answer is arithmetic noise.
  if (mean_square <= 1e-12) {
    return kMeterFloorDb;
  }
  const double decibels = 10.0 * std::log10(mean_square);
  return decibels > kMeterFloorDb ? decibels : kMeterFloorDb;
}

}  // namespace

/**
 * Q comes from the grid rather than from taste: each band's -3 dB width is
 * exactly the spacing to its neighbour, so the eight read as one curve instead
 * of as eight spikes with holes between them.
 */
void bass_forge_build_meters(FeqBassForge* state, double sample_rate) {
  const double ratio =
      std::pow(kMeterHighHz / kMeterLowHz,
               1.0 / static_cast<double>(FEQ_BASS_FORGE_BANDS - 1));
  const double quality = std::sqrt(ratio) / (ratio - 1.0);
  double centre = kMeterLowHz;
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    const double safe = std::fmin(centre, sample_rate * 0.45);
    state->meter_coefficients[band] =
        feq_biquad_coefficients(FEQ_FILTER_BP, safe, 0.0, quality, sample_rate);
    feq_biquad_reset(&state->meter_input[band]);
    feq_biquad_reset(&state->meter_output[band]);
    centre *= ratio;
  }
}

void bass_forge_clear_meters(FeqBassForge* state) {
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    feq_biquad_reset(&state->meter_input[band]);
    feq_biquad_reset(&state->meter_output[band]);
    state->meter_input_mean_square[band] = 0.0;
    state->meter_output_mean_square[band] = 0.0;
  }
}

void bass_forge_run_meters(FeqBassForge* state, double dry_band,
                           double forged_band, double window) {
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    const double before = run_stage(
        &state->meter_input[band], state->meter_coefficients[band], dry_band);
    state->meter_input_mean_square[band] +=
        (before * before - state->meter_input_mean_square[band]) * window;
    const double after = run_stage(
        &state->meter_output[band], state->meter_coefficients[band],
        forged_band);
    state->meter_output_mean_square[band] +=
        (after * after - state->meter_output_mean_square[band]) * window;
  }
}

extern "C" {

void feq_bass_forge_bands(const FeqBassForge* state, double* input_db,
                          double* output_db) {
  if (state == nullptr || input_db == nullptr || output_db == nullptr) {
    return;
  }
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    input_db[band] = level_db(state->meter_input_mean_square[band]);
    output_db[band] = level_db(state->meter_output_mean_square[band]);
  }
}

}  // extern "C"

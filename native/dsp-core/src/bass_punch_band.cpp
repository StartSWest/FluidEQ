/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "bass_punch_internal.h"

#include <algorithm>
#include <cmath>

namespace {

/**
 * The original one-pole shaping shelf has an audible midrange skirt. Limiting
 * only its detector does not limit the audio that the gain changes, and a
 * filter before that gain would still pass the sidebands it creates afterward.
 * Limit the entire contribution instead, keeping the dry signal intact.
 *
 * Six running averages have response exp(-j*w*D) * sinc_N(w)^6. With the dry
 * path delayed by D = 3*(N-1), the remaining response is real, nonnegative and
 * no larger than one. For a held gain g, the aligned dry-plus-contribution
 * response is 1 + (g-1)*H: boosts cannot cancel the kick at the band boundary.
 * The former extra one-pole shelf rotated and attenuated the bass contribution
 * before it ever reached this filter, weakening the hit twice.
 *
 * The first null is approximately 400 Hz. At ordinary device rates the
 * contribution is already about 24 dB down at 200 Hz and 62 dB at 300 Hz;
 * later sidelobes are about 80 dB down. This is a bass boundary, independent
 * of the 40–200 Hz detector focus. Four milliseconds of lookahead gives the
 * bass detector time to respond before the corresponding waveform is shaped;
 * FIR alignment plus lookahead totals about 11.5 ms.
 * Running averages implement this finite filter in constant work per sample.
 * https://www.analog.com/en/resources/technical-articles/fundamental-principles-behind-sigma-delta-adc-topology-part2.html
 */
constexpr double kFirstNullHz = 400.0;

uint32_t lookahead_frames(uint32_t length) {
  // N represents approximately 2.5 ms. Keep every ring bounded even when a
  // caller supplies an unsupported sample rate and N reaches its capacity.
  return (8u * length + 2u) / 5u;
}

uint32_t band_length(double sample_rate) {
  const double rate =
      std::isfinite(sample_rate) && sample_rate > 0.0 ? sample_rate : 48000.0;
  const double wanted = std::floor(rate / kFirstNullHz + 0.5);
  return static_cast<uint32_t>(std::clamp(
      wanted, 2.0, static_cast<double>(FEQ_BASS_PUNCH_BAND_CAPACITY)));
}

}  // namespace

void bass_punch_band_reset(FeqBassPunch* state) {
  state->band_length = 0;
  state->lookahead_frames = 0;
  for (auto& band : state->band) {
    for (auto& line : band.history) {
      std::fill_n(line, FEQ_BASS_PUNCH_BAND_CAPACITY, 0.0);
    }
    std::fill_n(band.sum, FEQ_BASS_PUNCH_BAND_STAGES, 0.0);
    std::fill_n(band.fresh_sum, FEQ_BASS_PUNCH_BAND_STAGES, 0.0);
    std::fill_n(band.dry, FEQ_BASS_PUNCH_DRY_CAPACITY, 0.0f);
    band.cursor = 0;
    band.dry_cursor = 0;
  }
}

void bass_punch_band_prepare(FeqBassPunch* state, double sample_rate) {
  const uint32_t length = band_length(sample_rate);
  if (length != state->band_length) {
    bass_punch_band_reset(state);
    state->band_length = length;
    state->lookahead_frames = lookahead_frames(length);
  }
}

double bass_punch_band_sample(FeqBassPunch* state, uint32_t channel,
                             double input, double gain, double bloom,
                             double mix, bool isolate) {
  FeqBassPunchBand& band = state->band[channel];
  const uint32_t length = state->band_length;
  const uint32_t delay = 3u * (length - 1u) + state->lookahead_frames;
  const uint32_t ahead =
      (band.dry_cursor + delay - state->lookahead_frames) % delay;
  const double source = static_cast<double>(band.dry[ahead]);
  // Linear extrapolation gives 1 + 2*(g-1) at 200%, which crosses zero for
  // cuts below -6.02 dB. Above 100%, deepen cuts in decibels instead: g^mix
  // stays positive. Boosts and Bloom still double their contribution at 200%.
  const double mixed_gain = gain < 1.0 && mix > 1.0
                                ? std::pow(gain, mix)
                                : 1.0 + mix * (gain - 1.0);
  // Apply Mix before the FIR. Scaling its history afterward would amplify a
  // previous cut again while Mix rises, briefly restoring the cancellation.
  const double contribution = (mixed_gain - 1.0) * source + mix * bloom;
  const bool wrapped = band.cursor + 1u == length;
  double sample = std::isfinite(contribution) ? contribution : 0.0;
  for (uint32_t stage = 0; stage < FEQ_BASS_PUNCH_BAND_STAGES; ++stage) {
    double& previous = band.history[stage][band.cursor];
    band.sum[stage] += sample - previous;
    previous = sample;
    band.fresh_sum[stage] += sample;
    // Rebase once per window: an incremental sum must not accumulate roundoff
    // for an entire playback session or leave a residual after digital silence.
    if (wrapped) {
      band.sum[stage] = band.fresh_sum[stage];
      band.fresh_sum[stage] = 0.0;
    }
    sample = band.sum[stage] / static_cast<double>(length);
  }
  band.cursor = wrapped ? 0u : band.cursor + 1u;

  const double dry = static_cast<double>(band.dry[band.dry_cursor]);
  band.dry[band.dry_cursor] =
      std::isfinite(input) ? static_cast<float>(input) : 0.0f;
  band.dry_cursor = band.dry_cursor + 1u == delay ? 0u : band.dry_cursor + 1u;
  // Mix zero becomes exact dry after its smooth fade and the finite FIR tail.
  // Isolate hears precisely the contribution used in normal playback.
  return isolate ? sample : dry + sample;
}

extern "C" {

uint32_t feq_bass_punch_latency_frames(double sample_rate) {
  const uint32_t length = band_length(sample_rate);
  return 3u * (length - 1u) + lookahead_frames(length);
}

}  // extern "C"

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser in the rack: told the preset's curve and the stream's
 * speakers, run after the restoration and before the Exciter, and reported
 * to the page.
 *
 * Before the Exciter because the Exciter makes treble out of what it is
 * given: an S it was handed would come out brighter and then be beyond any
 * de-esser after it. After the restoration because hiss is not sibilance,
 * and a de-esser listening to it would read a bright floor as a bed.
 */
#include "chain_internal.h"

#include <cmath>

namespace {

/** The room's speaker that is the centre: FL, FR, then FC (`room.h`). */
constexpr int kCentreSpeaker = 2;

/**
 * The preset's curve, in dB, at a frequency: each band designed as the layer
 * after the rack builds it (`chain_tone.cpp`), and its magnitude read off the
 * unit circle.
 */
double tone_gain_db(const void* context, double hz) {
  const auto* chain = static_cast<const FeqChain*>(context);
  const FeqChainToneSettings& tone = chain->settings.tone;
  const double omega = 2.0 * 3.14159265358979323846 * hz / chain->sample_rate;
  const double c1 = std::cos(omega);
  const double s1 = std::sin(omega);
  const double c2 = std::cos(2.0 * omega);
  const double s2 = std::sin(2.0 * omega);
  double total_db = 0.0;
  const uint32_t count = tone.band_count < FEQ_CHAIN_MAX_TONE_BANDS
                             ? tone.band_count
                             : FEQ_CHAIN_MAX_TONE_BANDS;
  for (uint32_t index = 0; index < count; ++index) {
    const FeqChainToneBand& band = tone.bands[index];
    const FeqBiquadCoefficients k =
        tone.matched != 0 && band.gain_db != 0.0
            ? feq_biquad_coefficients_matched(band.type, band.frequency,
                                              band.gain_db, band.quality,
                                              chain->sample_rate)
            : feq_biquad_coefficients(band.type, band.frequency, band.gain_db,
                                      band.quality, chain->sample_rate);
    const double nr = k.b0 + k.b1 * c1 + k.b2 * c2;
    const double ni = -(k.b1 * s1 + k.b2 * s2);
    const double dr = 1.0 + k.a1 * c1 + k.a2 * c2;
    const double di = -(k.a1 * s1 + k.a2 * s2);
    const double numerator = nr * nr + ni * ni;
    const double denominator = dr * dr + di * di;
    if (numerator > 0.0 && denominator > 0.0) {
      total_db += 10.0 * std::log10(numerator / denominator);
    }
  }
  return total_db;
}

}  // namespace

void chain_configure_deesser(FeqChain* chain) {
  feq_deesser_configure(chain->deesser, &chain->settings.deesser,
                        chain->settings.tone.band_count > 0 ? tone_gain_db
                                                            : nullptr,
                        chain);
}

void chain_apply_deesser_layout(FeqChain* chain) {
  int centre = -1;
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    if (chain->room_speakers[channel] == kCentreSpeaker) {
      centre = static_cast<int>(channel);
    }
  }
  feq_deesser_set_layout(chain->deesser, chain->lfe_channel, centre);
}

void chain_process_deesser(FeqChain* chain, float* const* channels,
                           uint32_t frames) {
  feq_deesser_process(chain->deesser, channels, frames,
                      chain_deesser_idle(chain) ? 1 : 0);
  if (chain->meters != nullptr) {
    FeqDeEsserReport report{};
    feq_deesser_block_report(chain->deesser, &report);
    feq_meters_publish_deesser(chain->meters, &report);
  }
}

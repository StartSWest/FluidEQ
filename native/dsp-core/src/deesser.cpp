/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's control side: the dials into a band layout, the layout
 * published to the audio thread, and the stage's lifecycle. The audio side is
 * `deesser_process.cpp`.
 */
#include "deesser_internal.h"

#include <algorithm>
#include <cmath>
#include <new>
#include <utility>

namespace feq_deesser {
namespace {

/** Butterworth: the body's two filters and Treble's split. */
constexpr double kButterworthQ = 0.7071067811865476;
/** The body starts here, over the bass, and stops this far under the
 * lowest band, so an S is not in it. */
constexpr double kBodyFloorHz = 300.0;
constexpr double kBodyBelow = 0.7;
/** Treble's split sits a little under the lowest band. */
constexpr double kSplitBelow = 0.9;
/**
 * The air band: where a cymbal goes on and a voice's S has fallen away. Above
 * the highest band by enough that it never overlaps it.
 */
constexpr double kAirHz = 13500.0;
constexpr double kAirAboveHighest = 1.35;
constexpr double kAirQ = 2.5;
/** Every band's top edge stays this far inside Nyquist. */
constexpr double kNyquistShare = 0.42;
/** A third-octave band's upper edge, from its centre. */
constexpr double kBandTop = 1.12;

double clamp(double value, double low, double high) {
  return std::isfinite(value) ? std::min(high, std::max(low, value)) : low;
}

/** The Q whose -3 dB points are `octaves` apart. */
double quality_for(double octaves) {
  const double half = std::pow(2.0, octaves / 2.0);
  return 1.0 / (half - 1.0 / half);
}

}  // namespace

bool same_structure(const Layout& a, const Layout& b) {
  if (a.bands != b.bands || a.has_air != b.has_air ||
      a.settings.mode != b.settings.mode ||
      a.settings.centre_only != b.settings.centre_only ||
      a.settings.low_hz != b.settings.low_hz ||
      a.settings.high_hz != b.settings.high_hz) {
    return false;
  }
  for (uint32_t band = 0; band < a.bands; ++band) {
    if (a.hz[band] != b.hz[band]) {
      return false;
    }
  }
  return true;
}

void build_layout(Layout* layout, const FeqDeEsserSettings& asked,
                  double sample_rate, FeqDeEsserToneGain tone_gain,
                  const void* tone_context) {
  Layout built{};
  FeqDeEsserSettings& settings = built.settings;
  settings = asked;
  settings.enabled = asked.enabled != 0 ? 1 : 0;
  settings.isolate = asked.isolate != 0 ? 1 : 0;
  settings.centre_only = asked.centre_only != 0 ? 1 : 0;
  settings.mode = asked.mode == FEQ_DEESSER_TREBLE || asked.mode == FEQ_DEESSER_WHOLE
                      ? asked.mode
                      : FEQ_DEESSER_SPECTRAL;
  settings.sensitivity = clamp(asked.sensitivity, 0.0, 1.0);
  settings.range_db = clamp(asked.range_db, 0.0, 18.0);
  settings.width_oct = clamp(asked.width_oct, 0.25, 2.0);
  settings.attack_ms = clamp(asked.attack_ms, 0.1, 10.0);
  settings.release_ms = clamp(asked.release_ms, 10.0, 500.0);
  settings.keep_cymbals = clamp(asked.keep_cymbals, 0.0, 1.0);

  // The listening range, inside what this rate can carry. A rate too low to
  // hold a band above 2.5 kHz gets none, and the stage is then a delay.
  const double top = std::min(16000.0, sample_rate * kNyquistShare / kBandTop);
  settings.low_hz = clamp(asked.low_hz, 2000.0, 12000.0);
  settings.high_hz = clamp(asked.high_hz, settings.low_hz * 1.26, 16000.0);
  if (settings.high_hz > top) {
    settings.high_hz = top;
  }
  if (settings.low_hz * 1.26 > settings.high_hz) {
    settings.low_hz = settings.high_hz / 1.26;
  }
  if (settings.low_hz < 2000.0) {
    *layout = built;
    return;
  }

  // Third-octave bands from one edge to the other, evenly in octaves, each as
  // wide as the step so their skirts meet at -3 dB.
  const double span = std::log2(settings.high_hz / settings.low_hz);
  built.bands = static_cast<uint32_t>(
      clamp(std::round(span * 3.0) + 1.0, 2.0, static_cast<double>(kMaxBands)));
  const double step = span / static_cast<double>(built.bands - 1);
  const double band_octaves = std::max(step, 1.0 / 6.0);
  const double band_q = quality_for(band_octaves);
  const auto tone_db = [&](double hz) {
    return tone_gain != nullptr ? tone_gain(tone_context, hz) : 0.0;
  };
  const double tone_reference = tone_db(1000.0);
  const auto tone_power = [&](double hz) {
    return std::pow(10.0, clamp(tone_db(hz) - tone_reference, -20.0, 20.0) / 10.0);
  };
  for (uint32_t band = 0; band < built.bands; ++band) {
    const double hz = settings.low_hz * std::pow(2.0, step * band);
    built.hz[band] = hz;
    built.band[band] =
        feq_biquad_coefficients_matched(FEQ_FILTER_BP, hz, 0.0, band_q, sample_rate);
    built.tone_power[band] = tone_power(hz);
  }
  // Band j hands band k its cut times 2^-(2d/width)^2, d their distance in
  // octaves: half of it at half the width away.
  for (uint32_t from = 0; from < built.bands; ++from) {
    for (uint32_t to = 0; to < built.bands; ++to) {
      const double distance = std::fabs(std::log2(built.hz[to] / built.hz[from]));
      const double scaled = 2.0 * distance / settings.width_oct;
      built.spread[from][to] = std::pow(2.0, -scaled * scaled);
    }
  }

  built.body_floor = feq_biquad_coefficients(FEQ_FILTER_HPQ, kBodyFloorHz, 0.0,
                                             kButterworthQ, sample_rate);
  built.body = feq_biquad_coefficients(FEQ_FILTER_LPQ,
                                       settings.low_hz * kBodyBelow, 0.0,
                                       kButterworthQ, sample_rate);
  // The part over the split is the input less a Butterworth low-pass, so the
  // two halves add back to the input exactly and the stage at rest is still
  // its delay. A steeper high-pass added back to the input turned the cut
  // into a boost: its phase in the passband is not the input's. This one
  // moves 1 kHz by 0.2 dB under a 6 dB cut.
  built.split = feq_biquad_coefficients(FEQ_FILTER_LPQ,
                                        settings.low_hz * kSplitBelow, 0.0,
                                        kButterworthQ, sample_rate);
  const double centre = std::sqrt(settings.low_hz * settings.high_hz);
  built.region = feq_biquad_coefficients_matched(
      FEQ_FILTER_BP, centre, 0.0, quality_for(span + 1.0 / 3.0), sample_rate);
  const double air = std::max(kAirHz, settings.high_hz * kAirAboveHighest);
  if (air * 1.25 < sample_rate * 0.45) {
    built.has_air = 1;
    built.air = feq_biquad_coefficients_matched(FEQ_FILTER_BP, air, 0.0, kAirQ,
                                                sample_rate);
    built.tone_air = tone_power(air);
    const double air_octaves =
        2.0 * std::asinh(1.0 / (2.0 * kAirQ)) / std::log(2.0);
    built.air_per_range = (span + band_octaves) / air_octaves;
  }

  // Sensitivity moves both comparisons together. Its middle cuts a band that
  // comes within 13.5 dB of the voice's body and stands 7.6 dB over its own
  // recent bed. Measured on the scene (): an S's loudest
  // band reads 8 dB under the body on average, a vowel's upper harmonics
  // leaking into the lowest band 16 to 26 under.
  built.body_threshold_db = -8.0 - 10.0 * settings.sensitivity;
  built.self_threshold_db = 12.0 - 8.0 * settings.sensitivity;
  *layout = built;
}

}  // namespace feq_deesser

extern "C" {

void feq_deesser_settings_defaults(FeqDeEsserSettings* settings) {
  if (settings == nullptr) {
    return;
  }
  *settings = FeqDeEsserSettings{};
  settings->enabled = 0;
  settings->sensitivity = 0.55;
  settings->low_hz = 4500.0;
  settings->high_hz = 11000.0;
  settings->range_db = 6.0;
  settings->width_oct = 0.67;
  settings->mode = FEQ_DEESSER_SPECTRAL;
  settings->attack_ms = 1.0;
  settings->release_ms = 60.0;
  settings->centre_only = 1;
  settings->keep_cymbals = 0.7;
}

FeqDeEsser* feq_deesser_create(double sample_rate, uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0 ||
      channels > feq_deesser::kMaxChannels) {
    return nullptr;
  }
  auto* deesser = new (std::nothrow) FeqDeEsser();
  if (deesser == nullptr) {
    return nullptr;
  }
  deesser->sample_rate = sample_rate;
  deesser->channels = channels;
  deesser->look_ahead = std::max<uint32_t>(
      1, static_cast<uint32_t>(
             std::lround(FEQ_DEESSER_LOOK_AHEAD_MS * sample_rate / 1000.0)));
  // The control tick: about 4 kHz, so a 0.5 ms attack still has two steps,
  // and never under eight samples, so the logarithms stay a small share.
  deesser->run.tick_length = std::max<uint32_t>(
      8, static_cast<uint32_t>(std::lround(sample_rate / 4000.0)));
  // How long it listens after it starts before it may cut: its body
  // follower reads nothing until the voice has been heard, and against
  // nothing the faint treble of a band under the voice was cut at the first
  // tick. 20 ms, in ticks at this rate.
  deesser->run.warm_ticks = static_cast<uint32_t>(std::ceil(
      20.0 * sample_rate / 1000.0 / deesser->run.tick_length));
  for (uint32_t channel = 0; channel < channels; ++channel) {
    deesser->run.ring[channel].assign(deesser->look_ahead, 0.0f);
  }
  FeqDeEsserSettings defaults{};
  feq_deesser_settings_defaults(&defaults);
  for (auto& layout : deesser->layouts) {
    feq_deesser::build_layout(&layout, defaults, sample_rate, nullptr,
                              nullptr);
  }
  deesser->run.applied = deesser->layouts[0];
  feq_deesser_reset(deesser);
  return deesser;
}

void feq_deesser_destroy(FeqDeEsser* deesser) { delete deesser; }

void feq_deesser_configure(FeqDeEsser* deesser,
                           const FeqDeEsserSettings* settings,
                           FeqDeEsserToneGain tone_gain,
                           const void* tone_context) {
  if (deesser == nullptr || settings == nullptr) {
    return;
  }
  const int slot = 1 - deesser->published.load(std::memory_order_acquire);
  deesser->writes[slot].fetch_add(1, std::memory_order_acq_rel);
  feq_deesser::build_layout(&deesser->layouts[slot], *settings,
                            deesser->sample_rate, tone_gain, tone_context);
  deesser->writes[slot].fetch_add(1, std::memory_order_acq_rel);
  deesser->published.store(slot, std::memory_order_release);
}

void feq_deesser_set_layout(FeqDeEsser* deesser, int lfe_channel,
                            int centre_channel) {
  if (deesser == nullptr) {
    return;
  }
  const auto valid = [deesser](int channel) {
    return channel >= 0 && static_cast<uint32_t>(channel) < deesser->channels
               ? channel
               : -1;
  };
  deesser->lfe_channel = valid(lfe_channel);
  // The front pair's own channels are never "the centre": they are the pair.
  const int centre = valid(centre_channel);
  deesser->centre_channel =
      centre >= 2 && centre != deesser->lfe_channel ? centre : -1;
}

uint32_t feq_deesser_latency_frames(const FeqDeEsser* deesser, int idle) {
  return deesser == nullptr || idle != 0 ? 0u : deesser->look_ahead;
}

void feq_deesser_transfer(FeqDeEsser* prepared, FeqDeEsser* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous ||
      prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels) {
    return;
  }
  // The run carries the layout it was applying; the prepared stage adopts
  // its own published one at its first block, at once where the structure
  // is the same and after the cut lets go where it is not.
  std::swap(prepared->run, previous->run);
  prepared->adopted_slot = -1;
  prepared->has_pending = false;
}

void feq_deesser_reset(FeqDeEsser* deesser) {
  if (deesser == nullptr) {
    return;
  }
  feq_deesser::Run& run = deesser->run;
  feq_deesser::restart(run);
  // A cut that was running stops with the passage: the next one starts it
  // again from the dials, the delayed audio with it.
  run.running = false;
  for (auto& ring : run.ring) {
    std::fill(ring.begin(), ring.end(), 0.0f);
  }
  run.ring_at = 0;
  run.report = FeqDeEsserReport{};
}

void feq_deesser_block_report(const FeqDeEsser* deesser,
                              FeqDeEsserReport* out) {
  if (deesser == nullptr || out == nullptr) {
    return;
  }
  *out = deesser->run.report;
}

}  // extern "C"

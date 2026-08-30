/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/exciter.h"

#include <cmath>

namespace {

constexpr double kFilterQ = 0.70710678118654752440;
constexpr double kBandEdgeMinHz = 21.0;
constexpr double kBandEdgeMaxHz = 19900.0;
constexpr double kParameterSmoothingMs = 18.0;
constexpr double kDcPole = 0.9974;
constexpr double kLowTransientLift = 0.35;
constexpr double kMidTransientLift = 0.3;
constexpr double kHighTransientLift = 0.22;

/**
 * A quiet, phase-shifted copy of the band, under the harmonics it made.
 *
 * US 4,150,253's attenuated sidechain carries the filtered fundamentals as well
 * as their harmonics, and that continuous component is what stops the harmonics
 * being heard as detached fizz. ATTENUATED is the word that was missing here:
 * Low and Mid used to return the whole filtered band at unity, so what the
 * Amount dial mostly did was add a copy of 20 Hz - 3 kHz back on top of itself.
 * Measured at the shipping defaults that was +1.28 dB across the midrange and
 * +2.81 dB at full Amount — a veil, from a control that is not supposed to be
 * an equaliser. High already used 0.18 and was the band nobody complained
 * about; all three use it now.
 */
constexpr double kFoundationLevel = 0.18;

/**
 * How much harmonic content each band makes, relative to its own level.
 *
 * These are ratios rather than gains, which is the whole point of the change:
 * `depth` survives to the output as the harmonic-to-fundamental amplitude, so
 * each figure below is a decibel value a test can assert and a listener can
 * expect to hear at any playback level. Low carries the most because bass
 * harmonics are integrated by the ear rather than heard as separate tones, and
 * Mid the least because the midrange is where harmonic content stops being
 * warmth and becomes harshness.
 */
constexpr double kBandDepth[FEQ_EXCITER_BANDS] = {0.85, 0.62, 0.9};
/** Drive's floor: the gentlest setting still has a character, just a quiet one. */
constexpr double kMinDepth = 0.18;
constexpr double kDriveSpan = 2.5;

/**
 * What Texture actually moves: the interval, not the amount.
 *
 * Even orders sit an octave above the root and read as body — and on a speaker
 * that cannot reach the fundamental, as the fundamental itself. Odd orders sit
 * a twelfth above and read as edge and definition. Every band sweeps from
 * mostly-even to more-odd, but none of them reaches either extreme: pure even
 * is an octave doubler that loses the root, and pure odd is a fuzz box.
 */
constexpr double kEvenWeightWarm[FEQ_EXCITER_BANDS] = {0.92, 0.86, 0.85};
constexpr double kEvenWeightPresent[FEQ_EXCITER_BANDS] = {0.58, 0.34, 0.26};

/**
 * How far above its own band a band's harmonics may reach.
 *
 * The second order of the top of the Mid band lands at 6 kHz and the third at
 * 9 kHz, which is not body — it is the exact region a mix is usually fighting.
 * One octave of reach keeps every band's octave intact everywhere and rolls the
 * twelfth off the top, so each band stays the thing it is named after.
 */
constexpr double kResidueReachOctaves = 1.0;

constexpr double kExciterMinOctaves = 0.5;
constexpr double kExciterOctaveSpan = 9.5;

struct BandLimits {
  double min_hz;
  double max_hz;
};

constexpr BandLimits kBandLimits[FEQ_EXCITER_BANDS] = {
    {20.0, 700.0}, {150.0, 7000.0}, {2500.0, 20000.0}};

double clamp(double value, double low, double high) {
  if (value < low) {
    return low;
  }
  return value > high ? high : value;
}

double smoothing(double milliseconds, double sample_rate) {
  return 1.0 - std::exp(-1.0 / ((milliseconds / 1000.0) * sample_rate));
}

/**
 * How wide the band may be at this centre without leaving its own region.
 *
 * A band pushed to the edge of its range would otherwise reach past the next
 * band's territory, and three overlapping wide bands stop being three controls.
 */
double maximum_range_at(uint32_t band, double freq_hz) {
  const BandLimits limits = kBandLimits[band];
  const double minimum_half = std::pow(2.0, kExciterMinOctaves / 2.0);
  const double safe = clamp(freq_hz, limits.min_hz * minimum_half,
                            limits.max_hz / minimum_half);
  const double below = 2.0 * std::log2(safe / limits.min_hz);
  const double above = 2.0 * std::log2(limits.max_hz / safe);
  const double available =
      std::fmax(kExciterMinOctaves, std::fmin(below, above));
  return clamp((available - kExciterMinOctaves) / kExciterOctaveSpan, 0.0, 1.0);
}

void band_edges(uint32_t band, double freq_hz, double range, double* low_hz,
                double* high_hz) {
  const BandLimits limits = kBandLimits[band];
  const double minimum_half = std::pow(2.0, kExciterMinOctaves / 2.0);
  const double safe_frequency = clamp(freq_hz, limits.min_hz * minimum_half,
                                      limits.max_hz / minimum_half);
  const double safe_range =
      clamp(std::fmin(1.0, range), 0.0, maximum_range_at(band, safe_frequency));
  const double octaves = kExciterMinOctaves + safe_range * kExciterOctaveSpan;
  const double half = std::pow(2.0, octaves / 2.0);
  *low_hz = std::fmax(20.0, safe_frequency / half);
  *high_hz = std::fmin(20000.0, safe_frequency * half);
}

void block_dc(FeqExciterDc* state, float* buffer, uint32_t frames) {
  for (uint32_t at = 0; at < frames; ++at) {
    const double x = static_cast<double>(buffer[at]);
    const double y = x - state->x + kDcPole * state->y;
    state->x = x;
    state->y = y;
    buffer[at] = static_cast<float>(y);
  }
}

/** Drive sets the harmonic ratio, which no longer depends on the input level. */
double band_depth(uint32_t band, double drive) {
  const double normalised = clamp((drive - 1.0) / kDriveSpan, 0.0, 1.0);
  return kBandDepth[band] * (kMinDepth + normalised * (1.0 - kMinDepth));
}

double band_even_weight(uint32_t band, double texture) {
  const double normalised =
      clamp(texture / FEQ_ANALOG_DIODE_MAX_CHARACTER, 0.0, 1.0);
  return kEvenWeightWarm[band] +
         (kEvenWeightPresent[band] - kEvenWeightWarm[band]) * normalised;
}

double transient_lift(uint32_t band) {
  if (band == 2) {
    return kHighTransientLift;
  }
  return band == 1 ? kMidTransientLift : kLowTransientLift;
}

void identity(FeqBiquadCoefficients* coefficients) {
  coefficients->b0 = 1.0;
  coefficients->b1 = 0.0;
  coefficients->b2 = 0.0;
  coefficients->a1 = 0.0;
  coefficients->a2 = 0.0;
}

/** Extract one band from the dry programme into its own buffer. */
void extract_band(FeqExciterChannel* state, uint32_t band,
                  const FeqExciterBandSetup& setup, uint32_t frames,
                  double sample_rate) {
  float* source = state->bands[band];
  for (uint32_t at = 0; at < frames; ++at) {
    source[at] = state->dry[at];
  }
  double low_hz = 0.0;
  double high_hz = 0.0;
  band_edges(band, setup.freq_hz, setup.range, &low_hz, &high_hz);

  FeqExciterBandCache& cache = state->band_cache[band];
  if (cache.low_hz != low_hz || cache.high_hz != high_hz ||
      cache.sample_rate != sample_rate) {
    cache.low_hz = low_hz;
    cache.high_hz = high_hz;
    cache.sample_rate = sample_rate;
    if (low_hz > kBandEdgeMinHz) {
      cache.highpass = feq_biquad_coefficients(FEQ_FILTER_HPQ, low_hz, 0.0,
                                               kFilterQ, sample_rate);
    } else {
      identity(&cache.highpass);
    }
    if (high_hz < kBandEdgeMaxHz) {
      cache.lowpass = feq_biquad_coefficients(FEQ_FILTER_LPQ, high_hz, 0.0,
                                              kFilterQ, sample_rate);
    } else {
      identity(&cache.lowpass);
    }
    /**
     * Where the harmonics this band makes are allowed to go.
     *
     * High is the band whose generated orders are the POINT of it, and whose
     * carrier is not: cutting at the band centre lets the air through while the
     * source frequencies fall away, so it is an upper-harmonic return rather
     * than a louder copy of its own source. Low and Mid are the opposite — they
     * are named after where they belong, so their harmonics are held to an
     * octave above their own top edge.
     */
    const double reach = std::pow(2.0, kResidueReachOctaves);
    if (band == 2) {
      cache.residue = feq_biquad_coefficients(FEQ_FILTER_HPQ, setup.freq_hz,
                                              0.0, kFilterQ, sample_rate);
    } else if (high_hz * reach < kBandEdgeMaxHz) {
      cache.residue = feq_biquad_coefficients(FEQ_FILTER_LPQ, high_hz * reach,
                                              0.0, kFilterQ, sample_rate);
    } else {
      identity(&cache.residue);
    }
  }
  feq_biquad_process(&state->band_filters[band][0], source, frames,
                     &cache.highpass);
  feq_biquad_process(&state->band_filters[band][1], source, frames,
                     &cache.lowpass);
}

void shape_band(FeqExciterChannel* state, uint32_t band, const float* source,
                const FeqExciterBandSetup& setup, uint32_t frames,
                double sample_rate) {
  const uint32_t oversample =
      feq_oversample_factor_for_sample_rate(sample_rate);
  const uint32_t wide_frames = frames * oversample;
  feq_oversample_up(&state->oversamplers[band], source, state->wide_dry, frames,
                    oversample, state->middle);

  const double wide_rate = sample_rate * static_cast<double>(oversample);
  const double smooth = smoothing(kParameterSmoothingMs, wide_rate);
  const double lift = transient_lift(band);
  if (state->drive[band] == 0.0) {
    state->drive[band] = setup.drive;
    state->texture[band] = setup.texture;
  }

  for (uint32_t at = 0; at < wide_frames; ++at) {
    state->drive[band] += (setup.drive - state->drive[band]) * smooth;
    state->texture[band] += (setup.texture - state->texture[band]) * smooth;
    const double filtered = static_cast<double>(state->wide_dry[at]);
    const double transient = feq_exciter_transient_sample(
        &state->transients[band], filtered, wide_rate);
    const double harmonic_gain = 1.0 + transient * lift;
    // Harmonics only. The foundation is linear, so it is added below at the
    // base rate rather than being carried through the resampler twice.
    state->wide[at] = static_cast<float>(feq_harmonic_sample(
        &state->harmonics[band], filtered,
        band_depth(band, state->drive[band]) * harmonic_gain,
        band_even_weight(band, state->texture[band]), wide_rate));
  }

  feq_oversample_down(&state->oversamplers[band], state->wide,
                      state->wet_return, frames, oversample, state->middle);
  block_dc(&state->dc[band], state->wet_return, frames);
  feq_biquad_process(&state->residue_filters[band], state->wet_return, frames,
                     &state->band_cache[band].residue);

  // Restored from the already-filtered source rather than through the FIR round
  // trip: sending it that way made this additive return comb-filter the mix.
  // One buffer for the whole return, so Isolate cannot present a different
  // signal from the one added beneath the dry programme.
  for (uint32_t at = 0; at < frames; ++at) {
    state->wet_return[at] = static_cast<float>(
        static_cast<double>(state->wet_return[at]) +
        static_cast<double>(source[at]) * kFoundationLevel);
  }

  if (band == 2) {
    feq_exciter_guard_process(&state->high_guard, state->wet_return, frames,
                              sample_rate, 1.0);
  }
}

double add_band(FeqExciterChannel* state, uint32_t band, float* target,
                const float* source, const FeqExciterBandSetup& setup,
                double return_scale, int processor_enabled, uint32_t frames,
                double sample_rate) {
  const double enabled_mix =
      feq_exciter_return_gain(setup.mix) * return_scale;
  const double target_mix =
      (processor_enabled != 0 && setup.enabled != 0) ? enabled_mix : 0.0;
  if (target_mix <= 0.0 && state->mix[band] <= 0.0001) {
    state->mix[band] = 0.0;
    feq_exciter_transient_reset(&state->transients[band]);
    // The level follower too, or the band comes back holding the level of
    // whatever was playing when it was switched off.
    feq_harmonic_reset(&state->harmonics[band]);
    return 0.0;
  }

  shape_band(state, band, source, setup, frames, sample_rate);
  const double smooth = smoothing(kParameterSmoothingMs, sample_rate);
  double mean_mix = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    state->mix[band] += (target_mix - state->mix[band]) * smooth;
    target[at] = static_cast<float>(
        static_cast<double>(target[at]) +
        static_cast<double>(state->wet_return[at]) * state->mix[band]);
    mean_mix += state->mix[band];
  }
  return frames > 0 ? mean_mix / static_cast<double>(frames) : 0.0;
}

}  // namespace

extern "C" {

void feq_exciter_channel_init(FeqExciterChannel* state, float* band0,
                              float* band1, float* band2, float* wet_return,
                              float* wide, float* wide_dry, float* middle,
                              float* dry, float* guard_scratch) {
  if (state == nullptr) {
    return;
  }
  state->bands[0] = band0;
  state->bands[1] = band1;
  state->bands[2] = band2;
  state->wet_return = wet_return;
  state->wide = wide;
  state->wide_dry = wide_dry;
  state->middle = middle;
  state->dry = dry;
  state->dry_mix = 1.0;
  feq_exciter_guard_init(&state->high_guard, guard_scratch);

  for (uint32_t band = 0; band < FEQ_EXCITER_BANDS; ++band) {
    feq_biquad_reset(&state->band_filters[band][0]);
    feq_biquad_reset(&state->band_filters[band][1]);
    feq_biquad_reset(&state->residue_filters[band]);
    state->band_cache[band].low_hz = 0.0;
    state->band_cache[band].high_hz = 0.0;
    state->band_cache[band].sample_rate = 0.0;
    identity(&state->band_cache[band].highpass);
    identity(&state->band_cache[band].lowpass);
    identity(&state->band_cache[band].residue);
    feq_oversampler_reset(&state->oversamplers[band]);
    state->drive[band] = 0.0;
    state->texture[band] = 0.0;
    state->mix[band] = 0.0;
    feq_exciter_transient_init(&state->transients[band]);
    feq_harmonic_init(&state->harmonics[band]);
    state->dc[band].x = 0.0;
    state->dc[band].y = 0.0;
  }
}

int feq_exciter_channel_is_active(const FeqExciterChannel* state) {
  if (state == nullptr) {
    return 0;
  }
  return (state->mix[0] > 0.0001 || state->mix[1] > 0.0001 ||
          state->mix[2] > 0.0001 || std::fabs(1.0 - state->dry_mix) > 0.0001)
             ? 1
             : 0;
}

void feq_exciter_channel_process(FeqExciterChannel* state, float* target,
                                 uint32_t frames,
                                 const FeqExciterSettings* settings,
                                 double sample_rate, double* report_bands) {
  if (state == nullptr || target == nullptr || settings == nullptr ||
      frames == 0) {
    return;
  }
  if (report_bands != nullptr) {
    report_bands[0] = 0.0;
    report_bands[1] = 0.0;
    report_bands[2] = 0.0;
  }
  for (uint32_t at = 0; at < frames; ++at) {
    state->dry[at] = target[at];
  }
  // Off AND settled. Off but still gliding has to keep running, or Isolate
  // coming back would step rather than fade.
  if (settings->enabled == 0 && feq_exciter_channel_is_active(state) == 0) {
    return;
  }

  const double target_dry_mix =
      (settings->enabled != 0 && settings->isolate != 0) ? 0.0 : 1.0;
  const double dry_smooth = smoothing(kParameterSmoothingMs, sample_rate);
  for (uint32_t at = 0; at < frames; ++at) {
    state->dry_mix += (target_dry_mix - state->dry_mix) * dry_smooth;
    target[at] =
        static_cast<float>(static_cast<double>(state->dry[at]) * state->dry_mix);
  }

  /**
   * The three bands may overlap, and each needs enough return to be audible —
   * but their foundations must never add up to several full copies of the
   * filtered programme. Every authored balance is preserved and the set is
   * normalised only when the requested returns exceed unity together, so
   * adjacent or default bands are unaffected.
   */
  double requested = 0.0;
  for (uint32_t band = 0; band < FEQ_EXCITER_BANDS; ++band) {
    if (settings->enabled != 0 && settings->bands[band].enabled != 0) {
      requested += feq_exciter_return_gain(settings->bands[band].mix);
    }
  }
  const double return_scale = requested > 1.0 ? 1.0 / requested : 1.0;

  for (uint32_t band = 0; band < FEQ_EXCITER_BANDS; ++band) {
    const FeqExciterBandSetup& setup = settings->bands[band];
    extract_band(state, band, setup, frames, sample_rate);
    const double mean =
        add_band(state, band, target, state->bands[band], setup, return_scale,
                 settings->enabled, frames, sample_rate);
    if (report_bands != nullptr) {
      report_bands[band] = mean;
    }
  }
}

}  // extern "C"

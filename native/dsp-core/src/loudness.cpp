/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/loudness.h"

#include "fluideq/biquad.h"
#include "fluideq/oversample.h"
#include "fluideq/primitives.h"

#include <cmath>
#include <vector>

namespace {

constexpr double kAbsoluteGateLufs = -70.0;
constexpr double kRelativeGateLu = -10.0;
/**
 * BS.1770's -0.691 dB offset, which calibrates the K-weighted mean square so
 * that a 1 kHz sine at -20 dBFS measures -20 LUFS. It is a constant of the
 * standard, not a tuning value.
 */
constexpr double kLoudnessOffset = -0.691;
/** Flushes the true-peak FIR's half-window at end of file. */
constexpr uint32_t kFlushSamples = 12;

double loudness_from_energy(double energy) {
  return energy > 0.0 ? kLoudnessOffset + 10.0 * std::log10(energy)
                      : FEQ_LOUDNESS_SILENCE_DB;
}

double db_from_magnitude(double magnitude) {
  return magnitude > 0.0 ? 20.0 * std::log10(magnitude)
                         : FEQ_LOUDNESS_SILENCE_DB;
}

double mean_above(const std::vector<double>& energies, double threshold) {
  double total = 0.0;
  size_t count = 0;
  for (const double energy : energies) {
    if (loudness_from_energy(energy) > threshold) {
      total += energy;
      ++count;
    }
  }
  return count > 0 ? total / static_cast<double>(count) : 0.0;
}

/** One sample through one section, keeping the reference's exact grouping. */
double process_one(FeqBiquadState& state,
                   double sample,
                   const FeqBiquadCoefficients& coefficients) {
  const double output = coefficients.b0 * sample + coefficients.b1 * state.x1 +
                        coefficients.b2 * state.x2 -
                        coefficients.a1 * state.y1 - coefficients.a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = output;
  return output;
}

/**
 * The two cascaded filters that BS.1770 calls K-weighting.
 *
 * NOT the RBJ cookbook the rest of this engine designs bands with. The standard
 * publishes coefficients only at 48 kHz, so a meter that runs at other rates
 * has to re-derive them — and the cookbook's high shelf is a different design,
 * not a re-derivation of the standard's. Measured against the published table
 * the cookbook agrees below 200 Hz and above 8 kHz and differs by a third of a
 * dB through the presence region, which reads every vocal track as quieter than
 * it is.
 *
 * This reproduces BS.1770-4's Table 1 and Table 2 at 48 kHz to within 4e-14 on
 * every coefficient, and is the same derivation `loudnessAnalysis.ts` uses.
 */
constexpr double kPi = 3.14159265358979323846;
constexpr double kShelfHz = 1681.974450955533;
constexpr double kShelfGainDb = 3.999843853973347;
constexpr double kShelfQuality = 0.7071752369554196;
/**
 * The bandwidth gain's exponent, and it is 0.499666774155 rather than 0.5.
 *
 * The half-power point of a shelf whose ends differ by exactly 4 dB is not
 * quite the geometric mean, and this is the value that lands the derived
 * coefficients on the standard's printed ones instead of near them.
 */
constexpr double kShelfBandwidthExponent = 0.499666774155;
constexpr double kHighpassHz = 38.13547087602444;
constexpr double kHighpassQuality = 0.5003270373238773;

}  // namespace

extern "C" {

FeqBiquadCoefficients feq_k_weighting_shelf(double sample_rate) {
  const double k = std::tan((kPi * kShelfHz) / sample_rate);
  const double high = std::pow(10.0, kShelfGainDb / 20.0);
  const double band = std::pow(high, kShelfBandwidthExponent);
  const double a0 = 1.0 + k / kShelfQuality + k * k;
  FeqBiquadCoefficients out;
  out.b0 = (high + (band * k) / kShelfQuality + k * k) / a0;
  out.b1 = (2.0 * (k * k - high)) / a0;
  out.b2 = (high - (band * k) / kShelfQuality + k * k) / a0;
  out.a1 = (2.0 * (k * k - 1.0)) / a0;
  out.a2 = (1.0 - k / kShelfQuality + k * k) / a0;
  return out;
}

FeqBiquadCoefficients feq_k_weighting_highpass(double sample_rate) {
  const double k = std::tan((kPi * kHighpassHz) / sample_rate);
  const double a0 = 1.0 + k / kHighpassQuality + k * k;
  FeqBiquadCoefficients out;
  // The RLB curve's numerator is a plain second-order difference, which is why
  // it is written out rather than designed: the standard's b terms are exactly
  // 1, -2, 1 at every rate.
  out.b0 = 1.0;
  out.b1 = -2.0;
  out.b2 = 1.0;
  out.a1 = (2.0 * (k * k - 1.0)) / a0;
  out.a2 = (1.0 - k / kHighpassQuality + k * k) / a0;
  return out;
}

struct FeqLoudnessAnalyzer {
  uint32_t channels = 0;
  FeqBiquadCoefficients shelf{};
  FeqBiquadCoefficients highpass{};
  std::vector<FeqBiquadState> shelf_states;
  std::vector<FeqBiquadState> highpass_states;
  std::vector<FeqTruePeak> peak_states;
  /** A rolling sum over one 400 ms block, so the cost is per sample not per block. */
  std::vector<double> energy_window;
  std::vector<double> block_energies;
  uint32_t block_frames = 1;
  uint32_t hop_frames = 1;
  double energy_sum = 0.0;
  double true_peak_magnitude = 0.0;
  uint64_t frame = 0;
};

FeqLoudnessAnalyzer* feq_loudness_create(double sample_rate,
                                         uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0) {
    return nullptr;
  }
  auto* analyzer = new FeqLoudnessAnalyzer();
  analyzer->channels = channels < 2 ? channels : 2;

  analyzer->shelf = feq_k_weighting_shelf(sample_rate);
  analyzer->highpass = feq_k_weighting_highpass(sample_rate);

  analyzer->shelf_states.resize(analyzer->channels);
  analyzer->highpass_states.resize(analyzer->channels);
  analyzer->peak_states.resize(analyzer->channels);
  const uint32_t factor = feq_oversample_factor_for_sample_rate(sample_rate);
  for (uint32_t channel = 0; channel < analyzer->channels; ++channel) {
    feq_biquad_reset(&analyzer->shelf_states[channel]);
    feq_biquad_reset(&analyzer->highpass_states[channel]);
    feq_true_peak_init(&analyzer->peak_states[channel], factor);
  }

  const auto rounded = [](double value) -> uint32_t {
    const double at = std::floor(value + 0.5);
    return at < 1.0 ? 1u : static_cast<uint32_t>(at);
  };
  analyzer->block_frames = rounded(sample_rate * 0.4);
  analyzer->hop_frames = rounded(sample_rate * 0.1);
  analyzer->energy_window.assign(analyzer->block_frames, 0.0);
  return analyzer;
}

void feq_loudness_destroy(FeqLoudnessAnalyzer* analyzer) {
  delete analyzer;
}

void feq_loudness_feed(FeqLoudnessAnalyzer* analyzer,
                       const float* const* channels,
                       uint32_t frames) {
  if (analyzer == nullptr || channels == nullptr) {
    return;
  }
  for (uint32_t at = 0; at < frames; ++at) {
    double combined_energy = 0.0;
    for (uint32_t channel = 0; channel < analyzer->channels; ++channel) {
      const double sample = static_cast<double>(channels[channel][at]);
      const double peak =
          feq_true_peak_sample(&analyzer->peak_states[channel], sample);
      if (peak > analyzer->true_peak_magnitude) {
        analyzer->true_peak_magnitude = peak;
      }
      const double shelf = process_one(analyzer->shelf_states[channel], sample,
                                       analyzer->shelf);
      const double weighted = process_one(analyzer->highpass_states[channel],
                                          shelf, analyzer->highpass);
      combined_energy += weighted * weighted;
    }

    const uint32_t window_at =
        static_cast<uint32_t>(analyzer->frame % analyzer->block_frames);
    analyzer->energy_sum += combined_energy - analyzer->energy_window[window_at];
    analyzer->energy_window[window_at] = combined_energy;
    const uint64_t completed = analyzer->frame + 1;
    if (completed >= analyzer->block_frames &&
        (completed - analyzer->block_frames) % analyzer->hop_frames == 0) {
      analyzer->block_energies.push_back(analyzer->energy_sum /
                                         analyzer->block_frames);
    }
    analyzer->frame = completed;
  }
}

FeqLoudnessResult feq_loudness_finish(FeqLoudnessAnalyzer* analyzer) {
  FeqLoudnessResult result;
  result.integrated_lufs = FEQ_LOUDNESS_SILENCE_DB;
  result.true_peak_dbtp = FEQ_LOUDNESS_SILENCE_DB;
  if (analyzer == nullptr) {
    return result;
  }

  for (uint32_t flush = 0; flush < kFlushSamples; ++flush) {
    for (uint32_t channel = 0; channel < analyzer->channels; ++channel) {
      const double peak =
          feq_true_peak_sample(&analyzer->peak_states[channel], 0.0);
      if (peak > analyzer->true_peak_magnitude) {
        analyzer->true_peak_magnitude = peak;
      }
    }
  }

  const double peak_db = db_from_magnitude(analyzer->true_peak_magnitude);
  result.true_peak_dbtp =
      peak_db > FEQ_LOUDNESS_SILENCE_DB ? peak_db : FEQ_LOUDNESS_SILENCE_DB;

  // Gated twice, in the order the standard gives: the absolute gate first, and
  // then a relative gate derived from what survived it. Deriving the relative
  // gate from the ungated mean instead would let a long silence drag the
  // threshold down and quietly raise the measurement of everything after.
  const double absolute =
      mean_above(analyzer->block_energies, kAbsoluteGateLufs);
  double integrated = FEQ_LOUDNESS_SILENCE_DB;
  if (absolute > 0.0) {
    const double relative_gate = loudness_from_energy(absolute) + kRelativeGateLu;
    integrated =
        loudness_from_energy(mean_above(analyzer->block_energies, relative_gate));
  }
  result.integrated_lufs =
      integrated > FEQ_LOUDNESS_SILENCE_DB ? integrated
                                           : FEQ_LOUDNESS_SILENCE_DB;
  return result;
}

}  // extern "C"

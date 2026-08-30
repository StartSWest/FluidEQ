/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/loudness_meter.h"

#include "fluideq/biquad.h"
#include "fluideq/loudness.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <vector>

namespace {

/** BS.1770's calibration offset, and a constant of the standard. */
constexpr double kLoudnessOffset = -0.691;
constexpr double kAbsoluteGateLufs = -70.0;
/** Integrated gates 10 LU below the ungated mean; range gates 20 below. */
constexpr double kIntegratedGateLu = -10.0;
constexpr double kRangeGateLu = -20.0;
/** EBU Tech 3342's two percentiles, and there is no freedom in them. */
constexpr double kRangeLowPercentile = 0.10;
constexpr double kRangeHighPercentile = 0.95;

/** The sub-block, which is the hop of both windows the standard defines. */
constexpr double kSubBlockSeconds = 0.1;
/** 400 ms of sub-blocks. */
constexpr uint32_t kMomentarySubBlocks = 4;
/** 3 s of them, which is also the ring's length. */
constexpr uint32_t kShortTermSubBlocks = 30;
/** Short-term blocks enter the range distribution once a second. */
constexpr uint32_t kRangeSubBlockInterval = 10;

/**
 * The histograms' resolution and extent: 0.1 LU from -70 to +10 LUFS.
 *
 * The low end is the absolute gate itself — a block below it is not counted at
 * all, so there is nothing under the first bin to lose. The high end is ten
 * decibels above full scale, which no block can reach through a chain that
 * ends in a true-peak limiter, and it is cheap enough to be generous about.
 */
constexpr double kHistogramFloorLufs = -70.0;
constexpr double kHistogramStepLu = 0.1;
constexpr uint32_t kHistogramBins = 800;

double loudness_from_energy(double energy) {
  return energy > 0.0 ? kLoudnessOffset + 10.0 * std::log10(energy)
                      : FEQ_LOUDNESS_METER_SILENCE_DB;
}

/** The loudness a bin stands for: its lower edge, which is where it was cut. */
double loudness_of_bin(uint32_t bin) {
  return kHistogramFloorLufs + static_cast<double>(bin) * kHistogramStepLu;
}

/**
 * A distribution of block loudness that cannot grow.
 *
 * The energy sum is kept alongside the count rather than reconstructed from
 * the bin's loudness, so a gated mean is exact and only the gate THRESHOLD is
 * quantized to a tenth of a LU. The other way round — exact threshold, energy
 * guessed from bin centres — puts the approximation in the answer.
 */
struct Histogram {
  std::vector<uint32_t> counts;
  std::vector<double> energies;
  uint64_t total_count = 0;
  double total_energy = 0.0;

  void prepare() {
    counts.assign(kHistogramBins, 0u);
    energies.assign(kHistogramBins, 0.0);
    total_count = 0;
    total_energy = 0.0;
  }

  void clear() {
    std::fill(counts.begin(), counts.end(), 0u);
    std::fill(energies.begin(), energies.end(), 0.0);
    total_count = 0;
    total_energy = 0.0;
  }

  /** Silently drops anything under the absolute gate, which IS the gate. */
  void add(double energy) {
    const double lufs = loudness_from_energy(energy);
    if (!(lufs > kAbsoluteGateLufs)) {
      return;
    }
    const double position = (lufs - kHistogramFloorLufs) / kHistogramStepLu;
    if (!(position >= 0.0)) {
      return;
    }
    const auto index = static_cast<uint32_t>(position);
    const uint32_t bin = index < kHistogramBins ? index : kHistogramBins - 1;
    counts[bin] += 1;
    energies[bin] += energy;
    total_count += 1;
    total_energy += energy;
  }

  /** The mean energy of every bin at or above `threshold`, as loudness. */
  double gated_loudness(double threshold) const {
    double energy = 0.0;
    uint64_t count = 0;
    for (uint32_t bin = 0; bin < kHistogramBins; ++bin) {
      if (counts[bin] != 0 && loudness_of_bin(bin) >= threshold) {
        energy += energies[bin];
        count += counts[bin];
      }
    }
    return count > 0 ? loudness_from_energy(energy / static_cast<double>(count))
                     : FEQ_LOUDNESS_METER_SILENCE_DB;
  }
};

}  // namespace

struct FeqLoudnessMeter {
  uint32_t channels = 0;
  double sample_rate = 48000.0;
  FeqBiquadCoefficients shelf{};
  FeqBiquadCoefficients highpass{};
  std::vector<FeqBiquadState> shelf_states;
  std::vector<FeqBiquadState> highpass_states;

  /** The sub-block being filled, and how far into it we are. */
  uint32_t sub_block_frames = 4800;
  uint32_t sub_block_fill = 0;
  double sub_block_energy = 0.0;

  /** Thirty sub-blocks — three seconds — and never one sample more. */
  std::vector<double> history;
  uint32_t history_at = 0;
  uint64_t history_count = 0;

  Histogram integrated;
  Histogram range;
  uint32_t sub_blocks_since_range = 0;

  std::atomic<float> momentary{
      static_cast<float>(FEQ_LOUDNESS_METER_SILENCE_DB)};
  std::atomic<float> short_term{
      static_cast<float>(FEQ_LOUDNESS_METER_SILENCE_DB)};
  std::atomic<float> integrated_lufs{
      static_cast<float>(FEQ_LOUDNESS_METER_SILENCE_DB)};
  std::atomic<float> range_lu{0.0f};

  /** The mean of the last `count` sub-blocks, or a negative energy for none. */
  double window_energy(uint32_t count) const {
    if (history_count < static_cast<uint64_t>(count)) {
      return -1.0;
    }
    double total = 0.0;
    for (uint32_t back = 1; back <= count; ++back) {
      const uint32_t at =
          (history_at + kShortTermSubBlocks - back) % kShortTermSubBlocks;
      total += history[at];
    }
    return total / static_cast<double>(count);
  }
};

namespace {

/** One sample through one section, in the reference's exact grouping. */
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

uint32_t sub_block_frames_for(double sample_rate) {
  const double frames = std::floor(sample_rate * kSubBlockSeconds + 0.5);
  return frames < 1.0 ? 1u : static_cast<uint32_t>(frames);
}

/**
 * The span between two percentiles of the gated short-term distribution.
 *
 * Walked as counts rather than sorted, which is the whole reason the
 * distribution is a histogram: a loudness range over an hour of playback costs
 * the same eight hundred steps as one over a minute.
 */
double loudness_range(const Histogram& histogram) {
  if (histogram.total_count == 0) {
    return 0.0;
  }
  const double ungated =
      loudness_from_energy(histogram.total_energy /
                           static_cast<double>(histogram.total_count));
  const double threshold = ungated + kRangeGateLu;

  uint64_t gated = 0;
  for (uint32_t bin = 0; bin < kHistogramBins; ++bin) {
    if (histogram.counts[bin] != 0 && loudness_of_bin(bin) >= threshold) {
      gated += histogram.counts[bin];
    }
  }
  if (gated == 0) {
    return 0.0;
  }

  const auto at_percentile = [&](double fraction) {
    const auto wanted = static_cast<uint64_t>(
        static_cast<double>(gated - 1) * fraction + 0.5);
    uint64_t seen = 0;
    for (uint32_t bin = 0; bin < kHistogramBins; ++bin) {
      if (histogram.counts[bin] == 0 || loudness_of_bin(bin) < threshold) {
        continue;
      }
      seen += histogram.counts[bin];
      if (seen > wanted) {
        return loudness_of_bin(bin);
      }
    }
    return loudness_of_bin(kHistogramBins - 1);
  };

  const double span =
      at_percentile(kRangeHighPercentile) - at_percentile(kRangeLowPercentile);
  return span > 0.0 ? span : 0.0;
}

void design(FeqLoudnessMeter* meter) {
  meter->shelf = feq_k_weighting_shelf(meter->sample_rate);
  meter->highpass = feq_k_weighting_highpass(meter->sample_rate);
  meter->sub_block_frames = sub_block_frames_for(meter->sample_rate);
}

void clear_measurement(FeqLoudnessMeter* meter) {
  for (uint32_t channel = 0; channel < meter->channels; ++channel) {
    feq_biquad_reset(&meter->shelf_states[channel]);
    feq_biquad_reset(&meter->highpass_states[channel]);
  }
  meter->sub_block_fill = 0;
  meter->sub_block_energy = 0.0;
  std::fill(meter->history.begin(), meter->history.end(), 0.0);
  meter->history_at = 0;
  meter->history_count = 0;
  meter->integrated.clear();
  meter->range.clear();
  meter->sub_blocks_since_range = 0;
  const auto silence = static_cast<float>(FEQ_LOUDNESS_METER_SILENCE_DB);
  meter->momentary.store(silence, std::memory_order_relaxed);
  meter->short_term.store(silence, std::memory_order_relaxed);
  meter->integrated_lufs.store(silence, std::memory_order_relaxed);
  meter->range_lu.store(0.0f, std::memory_order_relaxed);
}

/**
 * One completed 100 ms sub-block: fold it in and publish. **Audio thread.**
 *
 * The histogram scans live here rather than in `read` because `read` runs on
 * the control thread and would then need the histograms held still while it
 * worked. Five times a second, three thousand integer steps, no allocation.
 */
void close_sub_block(FeqLoudnessMeter* meter) {
  meter->history[meter->history_at] =
      meter->sub_block_energy / static_cast<double>(meter->sub_block_frames);
  meter->history_at = (meter->history_at + 1) % kShortTermSubBlocks;
  meter->history_count += 1;
  meter->sub_block_fill = 0;
  meter->sub_block_energy = 0.0;

  const double momentary_energy = meter->window_energy(kMomentarySubBlocks);
  if (momentary_energy >= 0.0) {
    meter->momentary.store(
        static_cast<float>(loudness_from_energy(momentary_energy)),
        std::memory_order_relaxed);
    // The integration's blocks ARE the momentary window at its 100 ms hop,
    // which is what BS.1770 gates. Feeding short-term blocks instead would
    // measure the same programme through a four-times-longer average and read
    // high on anything with dynamics in it.
    meter->integrated.add(momentary_energy);
    const double ungated =
        meter->integrated.total_count > 0
            ? loudness_from_energy(
                  meter->integrated.total_energy /
                  static_cast<double>(meter->integrated.total_count))
            : FEQ_LOUDNESS_METER_SILENCE_DB;
    meter->integrated_lufs.store(
        static_cast<float>(
            meter->integrated.gated_loudness(ungated + kIntegratedGateLu)),
        std::memory_order_relaxed);
  }

  const double short_energy = meter->window_energy(kShortTermSubBlocks);
  if (short_energy >= 0.0) {
    meter->short_term.store(
        static_cast<float>(loudness_from_energy(short_energy)),
        std::memory_order_relaxed);
    meter->sub_blocks_since_range += 1;
    if (meter->sub_blocks_since_range >= kRangeSubBlockInterval) {
      meter->sub_blocks_since_range = 0;
      meter->range.add(short_energy);
      meter->range_lu.store(static_cast<float>(loudness_range(meter->range)),
                            std::memory_order_relaxed);
    }
  }
}

}  // namespace

extern "C" {

FeqLoudnessMeter* feq_loudness_meter_create(double sample_rate,
                                            uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0) {
    return nullptr;
  }
  auto* meter = new FeqLoudnessMeter();
  meter->channels = channels < 2 ? channels : 2;
  meter->sample_rate = sample_rate;
  meter->shelf_states.resize(meter->channels);
  meter->highpass_states.resize(meter->channels);
  meter->history.assign(kShortTermSubBlocks, 0.0);
  meter->integrated.prepare();
  meter->range.prepare();
  design(meter);
  clear_measurement(meter);
  return meter;
}

void feq_loudness_meter_destroy(FeqLoudnessMeter* meter) {
  delete meter;
}

void feq_loudness_meter_reset(FeqLoudnessMeter* meter) {
  if (meter != nullptr) {
    clear_measurement(meter);
  }
}

void feq_loudness_meter_process(FeqLoudnessMeter* meter,
                                const float* const* channels,
                                uint32_t frames) {
  if (meter == nullptr || channels == nullptr) {
    return;
  }
  for (uint32_t at = 0; at < frames; ++at) {
    double energy = 0.0;
    for (uint32_t channel = 0; channel < meter->channels; ++channel) {
      const double sample = static_cast<double>(channels[channel][at]);
      const double shelf =
          process_one(meter->shelf_states[channel], sample, meter->shelf);
      const double weighted =
          process_one(meter->highpass_states[channel], shelf, meter->highpass);
      energy += weighted * weighted;
    }
    meter->sub_block_energy += energy;
    meter->sub_block_fill += 1;
    if (meter->sub_block_fill >= meter->sub_block_frames) {
      close_sub_block(meter);
    }
  }
}

void feq_loudness_meter_read(const FeqLoudnessMeter* meter,
                             FeqLoudnessReading* out) {
  if (out == nullptr) {
    return;
  }
  if (meter == nullptr) {
    out->momentary_lufs = FEQ_LOUDNESS_METER_SILENCE_DB;
    out->short_term_lufs = FEQ_LOUDNESS_METER_SILENCE_DB;
    out->integrated_lufs = FEQ_LOUDNESS_METER_SILENCE_DB;
    out->range_lu = 0.0;
    return;
  }
  out->momentary_lufs =
      static_cast<double>(meter->momentary.load(std::memory_order_relaxed));
  out->short_term_lufs =
      static_cast<double>(meter->short_term.load(std::memory_order_relaxed));
  out->integrated_lufs = static_cast<double>(
      meter->integrated_lufs.load(std::memory_order_relaxed));
  out->range_lu =
      static_cast<double>(meter->range_lu.load(std::memory_order_relaxed));
}

}  // extern "C"

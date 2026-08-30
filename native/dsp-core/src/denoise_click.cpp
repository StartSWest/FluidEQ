/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Impulsive damage: vinyl ticks, digital dropouts, a bad splice.
 *
 * The detector is a second difference against a smoothed error scale. A click
 * is, by definition, a sample that the samples around it do not predict, and
 * the second difference is the cheapest honest statement of that.
 *
 * The hard part is not finding clicks, it is not finding drums. A snare hit is
 * also unpredicted by its predecessors, and every naive click remover eats
 * percussion. Two things keep this one honest:
 *
 *  - WIDTH. A click is a handful of samples and its energy does not persist; a
 *    transient keeps going. So a run is only repaired while it stays under
 *    `max_repair_samples`, and a longer excursion is left alone — the point at
 *    which a repair stops being a repair and becomes an interpolation over
 *    music is exactly the point at which this refuses.
 *  - The error scale is smoothed only from samples that were not flagged, so a
 *    passage full of clicks does not quietly raise the bar until they pass.
 */

#include <algorithm>
#include <cmath>

#include "denoise_internal.h"

namespace {

/**
 * Multiples of the smoothed error the sample has to exceed, by sensitivity.
 *
 * At the cautious end a click has to be twenty times the ordinary prediction
 * error of the material, which on music is a genuine defect and very little
 * else. At the eager end four is low enough to catch soft ticks on a quiet
 * record and low enough to start finding transients, which is why it is at the
 * end of the dial rather than in the middle.
 */
constexpr double kThresholdAtLowSensitivity = 20.0;
constexpr double kThresholdAtHighSensitivity = 4.0;

/** Nothing is a click if the material is silent; this stops divide-by-noise. */
constexpr double kMinimumErrorScale = 1e-7;

/**
 * The median tracker's step, as a proportion, per sample.
 *
 * Symmetric up and down, which is what makes the fixed point the median rather
 * than something between the median and the mean. Half a percent converges
 * from the seed in a few thousand samples and is far too slow for one click to
 * move it anywhere.
 */
constexpr double kMedianStep = 0.005;

/**
 * How long the tracker runs before its verdict is used, in samples.
 *
 * The seed is far below any real material, so the estimate climbs through the
 * signal's own error level on its way to the median. Detecting during that
 * climb finds clicks in clean audio, which is the one thing this module must
 * never do. Forty milliseconds at 48 kHz.
 */
constexpr uint32_t kWarmupSamples = 2048;

uint32_t repair_capacity(const FeqDenoise* denoise) {
  const double requested = denoise->settings.click.max_repair_samples;
  const uint32_t limit = static_cast<uint32_t>(
      std::max(8.0, std::min(128.0, std::floor(requested + 0.5))));
  // Room for the forward search past the longest repairable run, plus a few
  // samples for the predictor's own history.
  return limit + 16;
}

}  // namespace

void denoise_click_configure(FeqDenoise* denoise) {
  denoise->click.resize(denoise->channels);
  const uint32_t capacity = repair_capacity(denoise);
  for (auto& channel : denoise->click) {
    if (channel.capacity != capacity) {
      channel.capacity = capacity;
      channel.history.assign(capacity, 0.0f);
      channel.flags.assign(capacity, uint8_t{0});
      channel.cursor = 0;
      // Seeded below any real material rather than at zero: the tracker is
      // multiplicative, so zero is a fixed point it can never climb out of.
      channel.median_error = kMinimumErrorScale;
      channel.warmup = kWarmupSamples;
      channel.in_run = false;
    }
  }
}

void denoise_click_reset(FeqDenoise* denoise) {
  for (auto& channel : denoise->click) {
    std::fill(channel.history.begin(), channel.history.end(), 0.0f);
    std::fill(channel.flags.begin(), channel.flags.end(), uint8_t{0});
    channel.cursor = 0;
    channel.median_error = kMinimumErrorScale;
    channel.warmup = kWarmupSamples;
    channel.in_run = false;
  }
}

uint32_t denoise_click_process(FeqDenoise* denoise,
                               float* const* channels,
                               uint32_t frames) {
  if (denoise->settings.click.enabled == 0) {
    return 0;
  }

  const double sensitivity =
      std::min(1.0, std::max(0.0, denoise->settings.click.sensitivity));
  const double factor =
      kThresholdAtLowSensitivity +
      (kThresholdAtHighSensitivity - kThresholdAtLowSensitivity) * sensitivity;
  const uint32_t max_run = static_cast<uint32_t>(
      std::max(8.0, std::min(128.0, std::floor(
                                        denoise->settings.click
                                            .max_repair_samples +
                                        0.5))));

  uint32_t repaired = 0;

  for (uint32_t c = 0; c < denoise->channels; c += 1) {
    DenoiseClickChannel& channel = denoise->click[c];
    const uint32_t capacity = channel.capacity;
    if (capacity == 0) {
      continue;
    }
    float* buffer = channels[c];

    for (uint32_t i = 0; i < frames; i += 1) {
      const uint32_t write = channel.cursor;
      const uint32_t previous = (write + capacity - 1) % capacity;
      const uint32_t before = (write + capacity - 2) % capacity;

      const double sample = static_cast<double>(buffer[i]);
      // Linear extrapolation from the two preceding samples; its residual is
      // the second difference.
      const double predicted = 2.0 * static_cast<double>(
                                         channel.history[previous]) -
                               static_cast<double>(channel.history[before]);
      const double error = std::fabs(sample - predicted);
      const double scale = std::max(kMinimumErrorScale, channel.median_error);

      // The tracker always learns, including from flagged samples: stepping
      // toward a median means one outlier moves it by one step and the
      // material moves it back on the next sample.
      channel.median_error =
          error > channel.median_error
              ? channel.median_error * (1.0 + kMedianStep)
              : channel.median_error * (1.0 - kMedianStep);
      channel.median_error =
          std::max(kMinimumErrorScale, channel.median_error);

      bool flagged = false;
      if (channel.warmup > 0) {
        channel.warmup -= 1;
      } else {
        flagged = error > scale * factor;
      }
      channel.history[write] = buffer[i];
      channel.flags[write] = flagged ? 1u : 0u;

      channel.cursor = (write + 1) % capacity;

      // The read head trails the write head by the whole buffer, so every
      // sample leaving has the full repair window on both sides of it.
      const uint32_t read = channel.cursor;
      if (channel.flags[read] == 0) {
        channel.in_run = false;
        buffer[i] = channel.history[read];
        continue;
      }

      // Walk forward to the end of the flagged run. A run that reaches the
      // limit is not a click and is left exactly as it arrived.
      uint32_t run = 0;
      uint32_t scan = read;
      while (run <= max_run && channel.flags[scan] != 0) {
        run += 1;
        scan = (scan + 1) % capacity;
        if (scan == write) {
          break;
        }
      }

      if (run == 0 || run > max_run) {
        channel.in_run = true;
        buffer[i] = channel.history[read];
        continue;
      }

      if (!channel.in_run) {
        repaired += 1;
        channel.in_run = true;
      }

      // Interpolate across the run from the good samples either side. The
      // left neighbour has already been emitted and repaired if it needed it,
      // so the two ends of the bridge are both trustworthy.
      const uint32_t left = (read + capacity - 1) % capacity;
      const double start = static_cast<double>(channel.history[left]);
      const double end = static_cast<double>(channel.history[scan]);
      const double step = (end - start) / static_cast<double>(run + 1);

      uint32_t at = read;
      for (uint32_t step_index = 1; step_index <= run; step_index += 1) {
        channel.history[at] =
            static_cast<float>(start + step * static_cast<double>(step_index));
        channel.flags[at] = 0;
        at = (at + 1) % capacity;
      }

      buffer[i] = channel.history[read];
    }
  }

  return repaired;
}

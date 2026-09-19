/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/dimension.h"

#include <cmath>

namespace {

constexpr double kParameterSmoothingMs = 18.0;

/**
 * Delays in milliseconds, mutually prime in samples at every rate that matters.
 *
 * Short enough that none of them is heard as a repeat — the shortest echo the
 * ear separates from its source is around 25 ms — and long enough to decorrelate
 * across the band the image lives in. The gain is Schroeder's: below about 0.7
 * the ring is inaudible, above it the network starts to sound like a small room
 * rather than a wide one.
 */
constexpr double kAllPassMs[FEQ_DIMENSION_ALLPASSES] = {4.7, 7.3, 11.1};
constexpr double kAllPassGain = 0.62;
constexpr double kLongestAllPassMs = 11.1;

/**
 * How much of itself the network hands straight back, and why the blend below
 * has to be corrected for it.
 *
 * Mixing a signal with an all-passed copy of itself is not a fade between two
 * unrelated things: the copy still contains the original scaled by the first
 * tap of the network, which for three Schroeder sections is `-gain^3`. The
 * energy of `(1-d)·x + d·allpass(x)` is therefore `(1-d)² + d² + 2d(1-d)·h0`,
 * and with h0 negative that is a LOSS on both counts — measured -2.7 dB at
 * d = 0.25 and -4.1 dB at 0.45, which is most of the Dimension range.
 *
 * That loss is why every profile in the catalogue measured NARROWER than the
 * stage switched off, Expansive included, while its dials all said wider: the
 * widths were adding a decibel or two and the blend was taking four back. The
 * correction divides it out, so a width of 1.2 is worth 1.2 at any amount of
 * decorrelation and the two controls stop fighting.
 */
constexpr double kNetworkReturn =
    -(kAllPassGain * kAllPassGain * kAllPassGain);

/**
 * How fast the guard sees the programme change.
 *
 * Correlation is a property of the arrangement rather than of a note, so this
 * is slow on purpose: a guard that reacted within a bar would be heard as the
 * image breathing, which is a worse artefact than the one it prevents.
 */
constexpr double kCorrelationTimeMs = 400.0;

/**
 * Where the guard starts closing and where it is fully shut.
 *
 * These are low deliberately. The first values tried here were 0.3 and -0.2,
 * which sounds cautious and is wrong: the ordinary two-tone mix in the property
 * tests — bass shared between the channels, treble opposed, which is what a
 * real record looks like — measures a correlation of 0.324. A guard that begins
 * closing at 0.3 would therefore be working on perfectly good wide material,
 * and the stage would quietly refuse to do the thing it was switched on for.
 *
 * The guard is not a taste control. It exists for mixes whose channels are
 * actively cancelling, and nothing above 0.1 is doing that.
 */
constexpr double kGuardOpenCorrelation = 0.1;
constexpr double kGuardShutCorrelation = -0.3;

/** Below this there is no signal to correlate and the answer would be noise. */
constexpr double kCorrelationFloor = 1e-9;

double clamp(double value, double low, double high) {
  if (value < low) {
    return low;
  }
  return value > high ? high : value;
}

double smoothing(double milliseconds, double sample_rate) {
  return 1.0 - std::exp(-1.0 / ((milliseconds / 1000.0) * sample_rate));
}

/** What the blend has to be divided by to come out at the level it went in. */
double blend_correction(double amount) {
  const double dry = 1.0 - amount;
  const double energy =
      dry * dry + amount * amount + 2.0 * amount * dry * kNetworkReturn;
  // The floor is unreachable — the smallest this expression takes is 0.38 at
  // d = 0.55 — and is here so that a corrupted amount cannot divide by zero.
  return energy > 1e-6 ? 1.0 / std::sqrt(energy) : 1.0;
}

/** One Schroeder all-pass: flat magnitude, and all of the phase. */
double all_pass_sample(FeqDimensionAllPass* state, double sample) {
  if (state->buffer == nullptr || state->delay == 0) {
    return sample;
  }
  const double delayed = static_cast<double>(state->buffer[state->cursor]);
  const double stored = sample + state->gain * delayed;
  state->buffer[state->cursor] = static_cast<float>(stored);
  state->cursor += 1;
  if (state->cursor >= state->delay) {
    state->cursor = 0;
  }
  return delayed - state->gain * stored;
}

}  // namespace

extern "C" {

uint32_t feq_dimension_allpass_capacity(double sample_rate) {
  const double samples = (kLongestAllPassMs / 1000.0) * sample_rate;
  const double rounded = std::floor(samples + 0.5);
  return rounded < 1.0 ? 1u : static_cast<uint32_t>(rounded) + 1u;
}

void feq_dimension_init(FeqDimension* state, float* side, float* centre,
                        float* low, float* mid_band, float* high,
                        float* const* allpass_buffers,
                        uint32_t allpass_capacity) {
  if (state == nullptr) {
    return;
  }
  feq_crossover_reset(&state->side_crossover);
  feq_crossover_phase_reset(&state->centre_phase);
  state->side = side;
  state->centre = centre;
  state->low = low;
  state->mid_band = mid_band;
  state->high = high;
  for (uint32_t at = 0; at < FEQ_DIMENSION_ALLPASSES; ++at) {
    state->allpasses[at].buffer =
        allpass_buffers != nullptr ? allpass_buffers[at] : nullptr;
    state->allpasses[at].capacity = allpass_capacity;
    state->allpasses[at].delay = 0;
    state->allpasses[at].cursor = 0;
    state->allpasses[at].gain = kAllPassGain;
  }
  state->low_width = -1.0;
  state->mid_width = -1.0;
  state->high_width = -1.0;
  state->decorrelation = -1.0;
  // Unity: a first block on correlated material must not arrive through a
  // guard that is still opening, which would be an audible swell.
  state->correlation = 1.0;
  state->guard = 1.0;
  state->stage_mix = 0.0;
  state->sample_rate = 0.0;
}

void feq_dimension_reset(FeqDimension* state) {
  if (state == nullptr) {
    return;
  }
  feq_crossover_reset(&state->side_crossover);
  feq_crossover_phase_reset(&state->centre_phase);
  for (auto& all_pass : state->allpasses) {
    all_pass.cursor = 0;
    if (all_pass.buffer != nullptr) {
      for (uint32_t at = 0; at < all_pass.capacity; ++at) {
        all_pass.buffer[at] = 0.0f;
      }
    }
  }
  state->correlation = 1.0;
  state->guard = 1.0;
  state->stage_mix = 0.0;
}

void feq_dimension_process(FeqDimension* state, float* left, float* right,
                           uint32_t frames,
                           const FeqDimensionSettings* settings,
                           double sample_rate) {
  if (state == nullptr || left == nullptr || right == nullptr ||
      settings == nullptr || frames == 0 || state->side == nullptr ||
      state->centre == nullptr || state->low == nullptr ||
      state->mid_band == nullptr || state->high == nullptr ||
      (settings->enabled == 0 && state->stage_mix <= 0.0)) {
    return;
  }
  // On the way out the dials stop taking new values: the fade is the only
  // thing still moving, and gliding widths under it would be a second change
  // inside a change nobody asked for.
  const bool leaving = settings->enabled == 0;

  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    for (uint32_t at = 0; at < FEQ_DIMENSION_ALLPASSES; ++at) {
      const double samples = (kAllPassMs[at] / 1000.0) * sample_rate;
      auto delay = static_cast<uint32_t>(std::floor(samples + 0.5));
      if (delay < 1u) {
        delay = 1u;
      }
      if (delay > state->allpasses[at].capacity) {
        delay = state->allpasses[at].capacity;
      }
      state->allpasses[at].delay = delay;
      state->allpasses[at].cursor = 0;
    }
  }

  const double smooth = smoothing(kParameterSmoothingMs, sample_rate);
  const double fade_step = feq_split_fade_step(sample_rate);
  const double correlation_smooth =
      smoothing(kCorrelationTimeMs, sample_rate);

  /**
   * Both halves are taken once, in a pass of their own.
   *
   * The crossover below needs the whole block of side before any of it goes
   * back out, and the output loop overwrites `left` and `right` in place.
   */
  for (uint32_t at = 0; at < frames; ++at) {
    const double l = static_cast<double>(left[at]);
    const double r = static_cast<double>(right[at]);
    state->side[at] = static_cast<float>((l - r) * 0.5);
    state->centre[at] = static_cast<float>((l + r) * 0.5);
  }

  /**
   * Correlation over the block, then a slow follower over it.
   *
   * Normalised, so it reports how much the two channels AGREE rather than how
   * loud they are: a quiet passage in phase must open the guard exactly as far
   * as a loud one.
   */
  double cross = 0.0;
  double energy_left = 0.0;
  double energy_right = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    const double l = static_cast<double>(left[at]);
    const double r = static_cast<double>(right[at]);
    cross += l * r;
    energy_left += l * l;
    energy_right += r * r;
  }
  const double denominator = std::sqrt(energy_left * energy_right);
  if (denominator > kCorrelationFloor) {
    const double measured = clamp(cross / denominator, -1.0, 1.0);
    const double blend =
        1.0 - std::pow(1.0 - correlation_smooth, static_cast<double>(frames));
    state->correlation += (measured - state->correlation) * blend;
  }
  state->guard =
      clamp((state->correlation - kGuardShutCorrelation) /
                (kGuardOpenCorrelation - kGuardShutCorrelation),
            0.0, 1.0);

  feq_crossover_split(&state->side_crossover, state->side, state->low,
                      state->mid_band, state->high, frames, settings->low_hz,
                      settings->high_hz, sample_rate);
  /**
   * The mid takes the same turn the side's bands took.
   *
   * Not a filter on the centre: the level of every frequency in it is
   * untouched, and this is the one operation that keeps a panned source in its
   * channel after the split — see the header.
   */
  feq_crossover_phase_process(&state->centre_phase, state->centre, frames,
                              settings->low_hz, settings->high_hz,
                              sample_rate);

  // Bass is narrowed or left alone, never widened — see the header.
  const double target_low =
      leaving ? state->low_width : clamp(settings->low_width, 0.0, 1.0);
  const double target_mid =
      leaving ? state->mid_width : clamp(settings->mid_width, 0.0, 2.0);
  const double target_high =
      leaving ? state->high_width : clamp(settings->high_width, 0.0, 2.0);
  const double target_decorrelation =
      leaving ? state->decorrelation : clamp(settings->decorrelation, 0.0, 1.0);
  if (state->low_width < 0.0) {
    state->low_width = target_low;
    state->mid_width = target_mid;
    state->high_width = target_high;
    state->decorrelation = target_decorrelation;
  }

  for (uint32_t at = 0; at < frames; ++at) {
    state->low_width += (target_low - state->low_width) * smooth;
    state->mid_width += (target_mid - state->mid_width) * smooth;
    state->high_width += (target_high - state->high_width) * smooth;
    state->decorrelation +=
        (target_decorrelation - state->decorrelation) * smooth;

    /**
     * The guard only ever closes a widening, never a narrowing.
     *
     * Narrowing moves the side toward the mid, which is the direction mono
     * already goes; there is nothing there to protect against.
     */
    const auto guarded = [&state](double width) {
      return width > 1.0 ? 1.0 + (width - 1.0) * state->guard : width;
    };

    const double widened =
        static_cast<double>(state->low[at]) * guarded(state->low_width) +
        static_cast<double>(state->mid_band[at]) * guarded(state->mid_width) +
        static_cast<double>(state->high[at]) * guarded(state->high_width);

    double decorrelated = widened;
    for (auto& all_pass : state->allpasses) {
      decorrelated = all_pass_sample(&all_pass, decorrelated);
    }
    const double side =
        (widened + (decorrelated - widened) * state->decorrelation) *
        blend_correction(state->decorrelation);

    /**
     * The stage arrives and leaves over a fade, because the split turns the
     * phase of everything through it (`FEQ_SPLIT_FADE_MS`). `left` and
     * `right` are still the signal that came in until this line writes over
     * them, so the dry side of the crossfade costs nothing.
     */
    state->stage_mix = leaving ? std::fmax(0.0, state->stage_mix - fade_step)
                               : std::fmin(1.0, state->stage_mix + fade_step);
    const double mid = static_cast<double>(state->centre[at]);
    const double dry_left = static_cast<double>(left[at]);
    const double dry_right = static_cast<double>(right[at]);
    left[at] = static_cast<float>(dry_left +
                                  (mid + side - dry_left) * state->stage_mix);
    right[at] = static_cast<float>(dry_right +
                                   (mid - side - dry_right) * state->stage_mix);
  }
}

double feq_dimension_fade(const FeqDimension* state) {
  return state != nullptr ? state->stage_mix : 0.0;
}

double feq_dimension_guard(const FeqDimension* state) {
  return state != nullptr ? state->guard : 1.0;
}

}  // extern "C"

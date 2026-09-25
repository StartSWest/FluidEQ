/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/dimension.h"

#include <cmath>

#include "fluideq/primitives.h"

namespace {

constexpr double kPi = 3.14159265358979323846;
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
 * The centre's network, which makes side out of the mid (see the header).
 *
 * Without it the stage could only scale the side a record already has, and on
 * the 25-song corpus 71 of the 86 chains with Dimension moved side against mid
 * above 2 kHz by -0.9 to +0.4 dB — nothing anyone hears as wider, and nothing
 * at all on a mono record (Ivan, 2026-09-25: "we need to improve dimension
 * filter to really add widening stereo fx"). Delays of its own, prime in
 * samples at 44.1 and 48 kHz and sharing none with the side's network, or the
 * made side would be the side's own decorrelation over again and ring at the
 * same periods. Its instantaneous return, `-gain^3`, is taken off, because a
 * copy of the centre with no delay added to the left and taken from the right
 * moves the centre to one side instead of widening it.
 */
constexpr double kCentreAllPassMs[FEQ_DIMENSION_CENTRE_ALLPASSES] = {3.1, 5.7,
                                                                      9.4};
constexpr double kCentreAllPassGain = 0.6;
constexpr double kCentreNetworkReturn =
    -(kCentreAllPassGain * kCentreAllPassGain * kCentreAllPassGain);
/** How much side a Spread of 1 makes, against the centre it is made from. */
constexpr double kCentreSpread = 0.8;
/**
 * How long an all-pass network started empty is left to fill before its
 * decorrelated side is heard.
 *
 * Started empty under a playing programme, the network's delayed taps land
 * one after another as its lines fill, each a step in the side: -57 dBFS
 * above 5 kHz 32 to 56 ms after Dimension came on at a preset switch
 * (2026-09-25), well after its 12 ms fade-in had finished. What an empty start
 * leaves decays by the longest loop's gain once per its delay, 0.62 every
 * 11.1 ms, so under a thousandth after 160 ms; the widths are heard at once
 * and the decorrelation glides in after that.
 */
constexpr double kNetworkWarmMs = 160.0;

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

/**
 * One sample through a first-order low-pass, in the trapezoidal
 * (zero-delay-feedback) form: the corner lands where it was asked at any rate,
 * and a corner moved mid-stream moves without a step. `gain` is
 * `split_gain`'s answer for the corner.
 */
double low_pass(double* state, double sample, double gain) {
  const double step = (sample - *state) * gain;
  const double out = step + *state;
  *state = out + step;
  return out;
}

/**
 * One sample through a second-order Butterworth high-pass, in the same
 * zero-delay-feedback form as `low_pass` (a state-variable filter), so the
 * corner too moves without a step. `g` is the prewarped `tan(pi·fc/fs)`;
 * `state` holds the two integrators.
 */
double butterworth_high_pass(double* state, double sample, double g) {
  constexpr double kDamping = 1.4142135623730951;  // 1/Q at Q = 1/sqrt(2)
  const double high =
      (sample - (kDamping + g) * state[0] - state[1]) /
      (1.0 + kDamping * g + g * g);
  const double band = g * high + state[0];
  state[0] = g * high + band;
  const double low = g * band + state[1];
  state[1] = g * band + low;
  return high;
}

/** The corner prewarped for the trapezoidal filters above, `tan(pi·fc/fs)`. */
double prewarp(double hz, double sample_rate) {
  const double corner = clamp(hz, 10.0, sample_rate * 0.45);
  return std::tan(kPi * corner / sample_rate);
}

double split_gain(double hz, double sample_rate) {
  const double g = prewarp(hz, sample_rate);
  return g / (1.0 + g);
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

/** The line's delay at this rate, within what its buffer holds; restarts it. */
void set_delay(FeqDimensionAllPass* state, double milliseconds,
               double sample_rate) {
  auto delay = static_cast<uint32_t>(
      std::floor((milliseconds / 1000.0) * sample_rate + 0.5));
  if (delay < 1u) {
    delay = 1u;
  }
  if (delay > state->capacity) {
    delay = state->capacity;
  }
  state->delay = delay;
  state->cursor = 0;
}

void clear_all_pass(FeqDimensionAllPass* state) {
  state->cursor = 0;
  if (state->buffer != nullptr) {
    for (uint32_t at = 0; at < state->capacity; ++at) {
      state->buffer[at] = 0.0f;
    }
  }
}

}  // namespace

extern "C" {

uint32_t feq_dimension_allpass_capacity(double sample_rate) {
  const double samples = (kLongestAllPassMs / 1000.0) * sample_rate;
  const double rounded = std::floor(samples + 0.5);
  return rounded < 1.0 ? 1u : static_cast<uint32_t>(rounded) + 1u;
}

void feq_dimension_init(FeqDimension* state, float* const* allpass_buffers,
                        uint32_t allpass_capacity) {
  if (state == nullptr) {
    return;
  }
  state->low_split = 0.0;
  state->high_split = 0.0;
  for (uint32_t at = 0; at < FEQ_DIMENSION_ALLPASSES; ++at) {
    state->allpasses[at].buffer =
        allpass_buffers != nullptr ? allpass_buffers[at] : nullptr;
    state->allpasses[at].capacity = allpass_capacity;
    state->allpasses[at].delay = 0;
    state->allpasses[at].cursor = 0;
    state->allpasses[at].gain = kAllPassGain;
  }
  for (uint32_t at = 0; at < FEQ_DIMENSION_CENTRE_ALLPASSES; ++at) {
    state->centre_allpasses[at].buffer =
        allpass_buffers != nullptr
            ? allpass_buffers[FEQ_DIMENSION_ALLPASSES + at]
            : nullptr;
    state->centre_allpasses[at].capacity = allpass_capacity;
    state->centre_allpasses[at].delay = 0;
    state->centre_allpasses[at].cursor = 0;
    state->centre_allpasses[at].gain = kCentreAllPassGain;
  }
  for (double& integrator : state->centre_high_pass) {
    integrator = 0.0;
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
  state->network_warm_left = -1;
}

void feq_dimension_reset(FeqDimension* state) {
  if (state == nullptr) {
    return;
  }
  state->low_split = 0.0;
  state->high_split = 0.0;
  for (auto& all_pass : state->allpasses) {
    clear_all_pass(&all_pass);
  }
  for (auto& all_pass : state->centre_allpasses) {
    clear_all_pass(&all_pass);
  }
  for (double& integrator : state->centre_high_pass) {
    integrator = 0.0;
  }
  state->correlation = 1.0;
  state->guard = 1.0;
  state->stage_mix = 0.0;
  state->network_warm_left = -1;
}

void feq_dimension_process(FeqDimension* state, float* left, float* right,
                           uint32_t frames,
                           const FeqDimensionSettings* settings,
                           double sample_rate) {
  if (state == nullptr || left == nullptr || right == nullptr ||
      settings == nullptr || frames == 0 ||
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
      set_delay(&state->allpasses[at], kAllPassMs[at], sample_rate);
    }
    for (uint32_t at = 0; at < FEQ_DIMENSION_CENTRE_ALLPASSES; ++at) {
      set_delay(&state->centre_allpasses[at], kCentreAllPassMs[at],
                sample_rate);
    }
    // New delays over lines that held the old ones: as good as empty.
    state->network_warm_left = -1;
  }
  if (state->network_warm_left < 0) {
    state->network_warm_left =
        static_cast<int64_t>(std::floor((kNetworkWarmMs / 1000.0) * sample_rate + 0.5));
  }

  const double smooth = smoothing(kParameterSmoothingMs, sample_rate);
  const double fade_step = feq_split_fade_step(sample_rate);
  const double correlation_smooth =
      smoothing(kCorrelationTimeMs, sample_rate);

  /**
   * Correlation over the block, then a slow follower over it — read before
   * the loop below writes over `left` and `right`.
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
    state->decorrelation =
        state->network_warm_left > 0 ? 0.0 : target_decorrelation;
  }

  const double low_gain = split_gain(settings->low_hz, sample_rate);
  const double high_gain = split_gain(settings->high_hz, sample_rate);
  const double low_corner = prewarp(settings->low_hz, sample_rate);
  /**
   * The guard only ever closes a widening, never a narrowing.
   *
   * Narrowing moves the side toward the mid, which is the direction mono
   * already goes; there is nothing there to protect against.
   */
  const auto guarded = [&state](double width) {
    return width > 1.0 ? 1.0 + (width - 1.0) * state->guard : width;
  };

  for (uint32_t at = 0; at < frames; ++at) {
    state->low_width += (target_low - state->low_width) * smooth;
    state->mid_width += (target_mid - state->mid_width) * smooth;
    state->high_width += (target_high - state->high_width) * smooth;
    // Held at none while the networks fill (`kNetworkWarmMs`).
    const double decorrelation_now =
        state->network_warm_left > 0 ? 0.0 : target_decorrelation;
    if (state->network_warm_left > 0) {
      state->network_warm_left -= 1;
    }
    state->decorrelation +=
        (decorrelation_now - state->decorrelation) * smooth;

    const double dry_left = static_cast<double>(left[at]);
    const double dry_right = static_cast<double>(right[at]);
    const double mid = (dry_left + dry_right) * 0.5;

    // Side made out of the centre above the bass corner, a widening like any
    // other and closed by the guard like one. The feed is 24 dB/oct, a
    // Linkwitz-Riley, so the bass under the corner stays mono: -42 dB at
    // 0.3 of the corner, and within half a decibel of flat an octave above.
    const double centre_upper = butterworth_high_pass(
        &state->centre_high_pass[2],
        butterworth_high_pass(&state->centre_high_pass[0], mid, low_corner),
        low_corner);
    double made = centre_upper;
    for (auto& all_pass : state->centre_allpasses) {
      made = all_pass_sample(&all_pass, made);
    }
    made -= kCentreNetworkReturn * centre_upper;
    const double side = (dry_left - dry_right) * 0.5 +
                        made * kCentreSpread * state->decorrelation *
                            state->guard;

    /**
     * The side in three bands that add back to exactly the side: under the
     * low corner, over the high one, and what is left between them. Where
     * the widths agree nothing is turned, so the mid needs no turn to stay
     * with it — see the header for what that turn used to cost.
     */
    const double under_low = low_pass(&state->low_split, side, low_gain);
    const double under_high = low_pass(&state->high_split, side, high_gain);
    const double widened = under_low * guarded(state->low_width) +
                           (under_high - under_low) * guarded(state->mid_width) +
                           (side - under_high) * guarded(state->high_width);

    double decorrelated = widened;
    for (auto& all_pass : state->allpasses) {
      decorrelated = all_pass_sample(&all_pass, decorrelated);
    }
    const double side_out =
        (widened + (decorrelated - widened) * state->decorrelation) *
        blend_correction(state->decorrelation);

    /**
     * The stage arrives and leaves over a fade (`FEQ_SPLIT_FADE_MS`): a
     * width of 1.4 switched in between two samples steps the side by forty
     * per cent, which is a click. `left` and `right` are still the signal
     * that came in until this line writes over them, so the dry side of the
     * crossfade costs nothing.
     */
    state->stage_mix = leaving ? std::fmax(0.0, state->stage_mix - fade_step)
                               : std::fmin(1.0, state->stage_mix + fade_step);
    left[at] = static_cast<float>(
        dry_left + (mid + side_out - dry_left) * state->stage_mix);
    right[at] = static_cast<float>(
        dry_right + (mid - side_out - dry_right) * state->stage_mix);
  }
}

double feq_dimension_fade(const FeqDimension* state) {
  return state != nullptr ? state->stage_mix : 0.0;
}

double feq_dimension_guard(const FeqDimension* state) {
  return state != nullptr ? state->guard : 1.0;
}

}  // extern "C"

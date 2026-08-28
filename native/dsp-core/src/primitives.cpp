/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/primitives.h"

#include <array>
#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr int kTaps = FEQ_TRUE_PEAK_TAPS;
constexpr int kFactor = FEQ_TRUE_PEAK_FACTOR;
constexpr double kHalf = kTaps / 2.0;

/** 1/sqrt(2), the Butterworth Q the crossover's stages are built at. */
const double kButterworthQ = std::sqrt(0.5);

/**
 * A windowed-sinc interpolator, one phase per fractional offset.
 *
 * The branch for offset 0 is the identity — sinc(0) is 1 and every other tap
 * is zero — so the original samples pass through untouched and only the three
 * points BETWEEN them are estimated. That is the whole job: a signal can sit
 * at -1 dBFS in its samples and still reconstruct above 0 between them, and
 * the reconstruction is what a converter, a resampler and every streaming
 * service's meter actually see.
 */
std::array<std::array<double, kTaps>, kFactor> build_phases() {
  std::array<std::array<double, kTaps>, kFactor> phases{};
  for (int phase = 0; phase < kFactor; ++phase) {
    const double offset = static_cast<double>(phase) / kFactor;
    double sum = 0.0;
    for (int at = 0; at < kTaps; ++at) {
      const double x = static_cast<double>(at) - kHalf + 1.0 - offset;
      // sinc, with the removable singularity at zero written out rather than
      // left to 0/0.
      const double sinc = x == 0.0 ? 1.0 : std::sin(kPi * x) / (kPi * x);
      // Blackman, for a stopband deep enough that the window is not what
      // limits the estimate.
      const double t = static_cast<double>(at) / (kTaps - 1);
      const double window = 0.42 - 0.5 * std::cos(2.0 * kPi * t) +
                            0.08 * std::cos(4.0 * kPi * t);
      phases[static_cast<size_t>(phase)][static_cast<size_t>(at)] =
          sinc * window;
      sum += phases[static_cast<size_t>(phase)][static_cast<size_t>(at)];
    }
    // Normalised so a constant signal interpolates to itself. Without this the
    // window's own gain shows up as a level error in every reading.
    for (int at = 0; at < kTaps; ++at) {
      phases[static_cast<size_t>(phase)][static_cast<size_t>(at)] /= sum;
    }
  }
  return phases;
}

/** Built before main, so no call takes a thread-safe-initialisation lock. */
const std::array<std::array<double, kTaps>, kFactor> kPhases = build_phases();

FeqBiquadCoefficients lowpass(double frequency, double sample_rate) {
  const double omega = (2.0 * kPi * frequency) / sample_rate;
  const double cosine = std::cos(omega);
  const double alpha = std::sin(omega) / (2.0 * kButterworthQ);
  const double a0 = 1.0 + alpha;
  FeqBiquadCoefficients out;
  out.b0 = (1.0 - cosine) / 2.0 / a0;
  out.b1 = (1.0 - cosine) / a0;
  out.b2 = (1.0 - cosine) / 2.0 / a0;
  out.a1 = (-2.0 * cosine) / a0;
  out.a2 = (1.0 - alpha) / a0;
  return out;
}

/** One sample through one stage, state kept in double as the reference does. */
double run_stage(FeqBiquadState* state,
                 const FeqBiquadCoefficients& coefficients,
                 double sample) {
  const double y = coefficients.b0 * sample + coefficients.b1 * state->x1 +
                   coefficients.b2 * state->x2 - coefficients.a1 * state->y1 -
                   coefficients.a2 * state->y2;
  state->x2 = state->x1;
  state->x1 = sample;
  state->y2 = state->y1;
  state->y1 = y;
  return y;
}

}  // namespace

extern "C" {

void feq_delay_line_init(FeqDelayLine* state,
                         float* buffer,
                         uint32_t capacity,
                         uint32_t delay) {
  if (state == nullptr || buffer == nullptr || capacity == 0) {
    return;
  }
  state->buffer = buffer;
  state->capacity = capacity;
  state->cursor = 0;
  state->delay = delay < capacity ? delay : capacity - 1;
  for (uint32_t at = 0; at < capacity; ++at) {
    buffer[at] = 0.0f;
  }
}

void feq_delay_line_process(FeqDelayLine* state,
                            float* samples,
                            uint32_t frames) {
  if (state == nullptr || state->buffer == nullptr || samples == nullptr) {
    return;
  }
  const uint32_t length = state->capacity;
  for (uint32_t at = 0; at < frames; ++at) {
    const uint32_t read = (state->cursor + length - state->delay) % length;
    state->buffer[state->cursor] = samples[at];
    samples[at] = state->buffer[read];
    state->cursor = (state->cursor + 1) % length;
  }
}

void feq_crossover_reset(FeqCrossover* state) {
  if (state == nullptr) {
    return;
  }
  for (int stage = 0; stage < 2; ++stage) {
    feq_biquad_reset(&state->low_stages[stage]);
    feq_biquad_reset(&state->mid_stages[stage]);
  }
}

void feq_crossover_split(FeqCrossover* state,
                         const float* input,
                         float* low,
                         float* mid,
                         float* high,
                         uint32_t frames,
                         double low_corner_hz,
                         double high_corner_hz,
                         double sample_rate) {
  if (state == nullptr || input == nullptr || low == nullptr ||
      mid == nullptr || high == nullptr) {
    return;
  }
  const FeqBiquadCoefficients low_coefficients =
      lowpass(low_corner_hz, sample_rate);
  const FeqBiquadCoefficients mid_coefficients =
      lowpass(high_corner_hz, sample_rate);

  for (uint32_t at = 0; at < frames; ++at) {
    const double sample = static_cast<double>(input[at]);
    double low_band = sample;
    for (int stage = 0; stage < 2; ++stage) {
      low_band = run_stage(&state->low_stages[stage], low_coefficients,
                           low_band);
    }
    double below_high = sample;
    for (int stage = 0; stage < 2; ++stage) {
      below_high = run_stage(&state->mid_stages[stage], mid_coefficients,
                             below_high);
    }
    low[at] = static_cast<float>(low_band);
    mid[at] = static_cast<float>(below_high - low_band);
    high[at] = static_cast<float>(sample - below_high);
  }
}

void feq_true_peak_init(FeqTruePeak* state, uint32_t factor) {
  if (state == nullptr) {
    return;
  }
  state->factor = factor == 1 || factor == 2 || factor == 4 ? factor : 4;
  for (int at = 0; at < kTaps; ++at) {
    state->history[at] = 0.0;
  }
  state->position = 0;
}

double feq_true_peak_sample(FeqTruePeak* state, double sample) {
  if (state == nullptr) {
    return 0.0;
  }
  if (state->factor == 1) {
    return std::fabs(sample);
  }
  state->history[state->position] = sample;
  state->position = state->position + 1 == kTaps ? 0 : state->position + 1;

  double peak = 0.0;
  const int phase_step = kFactor / static_cast<int>(state->factor);
  for (int phase = 0; phase < kFactor; phase += phase_step) {
    const auto& taps = kPhases[static_cast<size_t>(phase)];
    double sum = 0.0;
    int tap = 0;
    // The walk order is the reference's: from the write cursor to the end,
    // then wrapped to the start. A different traversal sums the same terms in
    // a different sequence and moves the last bits.
    for (int read = state->position; read < kTaps; ++read) {
      sum += state->history[read] * taps[static_cast<size_t>(tap)];
      tap += 1;
    }
    for (int read = 0; tap < kTaps; ++read) {
      sum += state->history[read] * taps[static_cast<size_t>(tap)];
      tap += 1;
    }
    const double magnitude = std::fabs(sum);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

double feq_true_peak_block(FeqTruePeak* state,
                           const float* input,
                           uint32_t frames) {
  if (state == nullptr || input == nullptr) {
    return 0.0;
  }
  double peak = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    const double magnitude =
        feq_true_peak_sample(state, static_cast<double>(input[at]));
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

}  // extern "C"

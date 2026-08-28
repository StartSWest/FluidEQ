/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/resampler.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace {

constexpr double kPi = 3.14159265358979323846;
/** Fractional positions the table is built at, before interpolation. */
constexpr uint32_t kPhases = 1024;
constexpr uint32_t kHalf = FEQ_RESAMPLER_TAPS / 2;
/**
 * Kaiser beta, and 8.6 is the textbook value for about -90 dB of stopband.
 *
 * Lower puts images inside the top octave; higher buys nothing audible and
 * widens the transition band, which starts rolling off content instead.
 */
constexpr double kBeta = 8.6;

double bessel_i0(double x) {
  // The series converges quickly for the range a Kaiser window needs; twenty
  // terms is far past the point where a double stops changing.
  double sum = 1.0;
  double term = 1.0;
  for (int index = 1; index < 20; ++index) {
    term *= (x / 2.0) / static_cast<double>(index);
    sum += term * term;
  }
  return sum;
}

double sinc(double x) {
  if (std::fabs(x) < 1e-12) {
    return 1.0;
  }
  return std::sin(kPi * x) / (kPi * x);
}

}  // namespace

struct FeqResampler {
  uint32_t channels = 0;
  /** Input frames advanced per output frame. */
  double step = 1.0;
  int identity = 0;
  /** `(kPhases + 1) * FEQ_RESAMPLER_TAPS`, so interpolation never runs off. */
  std::vector<float> table;
  /** One tap window per channel, `FEQ_RESAMPLER_TAPS` long, a ring. */
  std::vector<float> history;
  uint32_t history_at = 0;
  /** Position inside the history's newest sample, 0 to 1. */
  double phase = 0.0;
  /** Input frames still owed before the first output is centred. */
  uint32_t primed = 0;
  /**
   * Silent frames already pushed by `flush`, and it lives HERE rather than
   * inside `flush` because the tail spans calls.
   *
   * As a local it reset to zero on every call, so a caller looping until the
   * converter stopped producing looped forever: each call pushed another half
   * window of silence and returned frames for it. A deck fed by that never
   * reached the end of its file — it played the track and then an endless,
   * silent, buffered nothing, which is what the player's rate-conversion test
   * reported as ten seconds of audio taking twelve.
   */
  uint32_t flushed = 0;
};

extern "C" {

FeqResampler* feq_resampler_create(double input_rate,
                                   double output_rate,
                                   uint32_t channels) {
  if (!(input_rate > 0.0) || !(output_rate > 0.0) || channels == 0) {
    return nullptr;
  }
  auto* state = new FeqResampler();
  state->channels = channels;
  state->step = input_rate / output_rate;
  state->identity = input_rate == output_rate ? 1 : 0;

  /**
   * The cutoff follows the LOWER of the two rates.
   *
   * Upsampling only has to reject the images the interpolation creates, so the
   * cutoff stays at the input's Nyquist. Downsampling has to remove everything
   * above the OUTPUT's Nyquist before decimating, and a converter that skipped
   * that would fold a 96 kHz file's top two octaves back into the audible band
   * — which sounds like an added shimmer rather than like a defect, and is the
   * classic way a resampler ships broken.
   *
   * 0.94 rather than 1.0 leaves the transition band somewhere to be. Placing
   * it exactly at Nyquist means the roll-off starts below it.
   */
  const double ratio = output_rate / input_rate;
  const double cutoff = (ratio < 1.0 ? ratio : 1.0) * 0.94;

  state->table.assign(static_cast<size_t>(kPhases + 1) * FEQ_RESAMPLER_TAPS,
                      0.0f);
  const double normaliser = bessel_i0(kBeta);
  for (uint32_t phase = 0; phase <= kPhases; ++phase) {
    const double offset = static_cast<double>(phase) / kPhases;
    for (uint32_t tap = 0; tap < FEQ_RESAMPLER_TAPS; ++tap) {
      // Distance from the output point to this tap, in input samples.
      const double distance =
          static_cast<double>(tap) - static_cast<double>(kHalf) + 1.0 - offset;
      const double window_at = distance / static_cast<double>(kHalf);
      double window = 0.0;
      if (window_at > -1.0 && window_at < 1.0) {
        window =
            bessel_i0(kBeta * std::sqrt(1.0 - window_at * window_at)) /
            normaliser;
      }
      state->table[static_cast<size_t>(phase) * FEQ_RESAMPLER_TAPS + tap] =
          static_cast<float>(cutoff * sinc(cutoff * distance) * window);
    }
  }

  state->history.assign(
      static_cast<size_t>(channels) * FEQ_RESAMPLER_TAPS, 0.0f);
  state->primed = kHalf;
  state->flushed = 0;
  return state;
}

void feq_resampler_destroy(FeqResampler* state) {
  delete state;
}

void feq_resampler_reset(FeqResampler* state) {
  if (state == nullptr) {
    return;
  }
  std::fill(state->history.begin(), state->history.end(), 0.0f);
  state->history_at = 0;
  state->phase = 0.0;
  state->primed = kHalf;
  state->flushed = 0;
}

uint32_t feq_resampler_input_for(const FeqResampler* state,
                                 uint32_t output_frames) {
  if (state == nullptr) {
    return output_frames;
  }
  // Rounded up, plus the whole window: never under-reports, so one read can be
  // sized from it and a caller is never left short mid-block.
  const double needed =
      std::ceil(static_cast<double>(output_frames) * state->step);
  return static_cast<uint32_t>(needed) + FEQ_RESAMPLER_TAPS;
}

/** One output frame from the current history and phase. */
static void resample_one(FeqResampler* state, float* const* output,
                         uint32_t at) {
  const auto phase_index =
      static_cast<uint32_t>(state->phase * static_cast<double>(kPhases));
  const double blend =
      state->phase * static_cast<double>(kPhases) -
      static_cast<double>(phase_index);
  const float* low =
      state->table.data() + static_cast<size_t>(phase_index) *
                                FEQ_RESAMPLER_TAPS;
  const float* high = low + FEQ_RESAMPLER_TAPS;

  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    const float* window =
        state->history.data() + static_cast<size_t>(channel) *
                                    FEQ_RESAMPLER_TAPS;
    double sum = 0.0;
    for (uint32_t tap = 0; tap < FEQ_RESAMPLER_TAPS; ++tap) {
      // The ring's oldest sample is the one after the cursor.
      const uint32_t slot = (state->history_at + tap) % FEQ_RESAMPLER_TAPS;
      const double coefficient =
          static_cast<double>(low[tap]) * (1.0 - blend) +
          static_cast<double>(high[tap]) * blend;
      sum += static_cast<double>(window[slot]) * coefficient;
    }
    output[channel][at] = static_cast<float>(sum);
  }
}

static void push_frame(FeqResampler* state, const float* const* input,
                       uint32_t at) {
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    state->history[static_cast<size_t>(channel) * FEQ_RESAMPLER_TAPS +
                   state->history_at] = input[channel][at];
  }
  state->history_at = (state->history_at + 1) % FEQ_RESAMPLER_TAPS;
}

static void push_silence(FeqResampler* state) {
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    state->history[static_cast<size_t>(channel) * FEQ_RESAMPLER_TAPS +
                   state->history_at] = 0.0f;
  }
  state->history_at = (state->history_at + 1) % FEQ_RESAMPLER_TAPS;
}

uint32_t feq_resample(FeqResampler* state,
                      const float* const* input,
                      uint32_t input_frames,
                      float* const* output,
                      uint32_t output_frames,
                      uint32_t* consumed) {
  if (state == nullptr || input == nullptr || output == nullptr) {
    if (consumed != nullptr) {
      *consumed = 0;
    }
    return 0;
  }
  uint32_t taken = 0;
  uint32_t written = 0;

  if (state->identity != 0) {
    // Equal rates copy. A caller should not have to branch on whether
    // conversion is needed, and a sinc at ratio one is 32 multiplies to
    // reproduce its input less exactly than a copy does.
    const uint32_t span =
        input_frames < output_frames ? input_frames : output_frames;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      for (uint32_t at = 0; at < span; ++at) {
        output[channel][at] = input[channel][at];
      }
    }
    if (consumed != nullptr) {
      *consumed = span;
    }
    return span;
  }

  // Fill the half-window the first output sample is centred on.
  while (state->primed > 0 && taken < input_frames) {
    push_frame(state, input, taken);
    ++taken;
    --state->primed;
  }
  if (state->primed > 0) {
    if (consumed != nullptr) {
      *consumed = taken;
    }
    return 0;
  }

  while (written < output_frames) {
    while (state->phase >= 1.0) {
      if (taken >= input_frames) {
        if (consumed != nullptr) {
          *consumed = taken;
        }
        return written;
      }
      push_frame(state, input, taken);
      ++taken;
      state->phase -= 1.0;
    }
    resample_one(state, output, written);
    ++written;
    state->phase += state->step;
  }

  if (consumed != nullptr) {
    *consumed = taken;
  }
  return written;
}

uint32_t feq_resampler_flush(FeqResampler* state,
                             float* const* output,
                             uint32_t output_frames) {
  if (state == nullptr || output == nullptr || state->identity != 0) {
    return 0;
  }
  uint32_t written = 0;
  while (written < output_frames && state->flushed < kHalf) {
    while (state->phase >= 1.0 && state->flushed < kHalf) {
      push_silence(state);
      ++state->flushed;
      state->phase -= 1.0;
    }
    if (state->phase >= 1.0) {
      break;
    }
    resample_one(state, output, written);
    ++written;
    state->phase += state->step;
  }
  return written;
}

}  // extern "C"

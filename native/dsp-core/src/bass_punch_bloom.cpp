/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass Punch's bloom: three combs, one all-pass, and a band limit.
 *
 * A decay extension and deliberately not a reverb. It is fed the low band
 * summed to mono and returns mono, because stereo bass reverb is the standard
 * way to make a mix muddy and mono-incompatible — the width is inaudible where
 * it is applied and the cancellation is not.
 */
#include "bass_punch_internal.h"

#include <cmath>

namespace {

/**
 * Mutually prime in samples at every rate that matters.
 *
 * One comb is a pitched ring rather than a space, and three that share a factor
 * are one comb with extra steps. `dimension.cpp` picked its all-pass delays on
 * the same reasoning.
 */
constexpr double kCombMs[FEQ_BASS_PUNCH_COMBS] = {23.7, 31.1, 41.3};
constexpr double kAllPassMs = 7.3;
constexpr double kAllPassGain = 0.62;

/** The documented decay range, enforced where the audio is rather than in the
 *  UI: a preset stored by an older build reaches the engine without passing
 *  through a control. */
constexpr double kMinDecayMs = 40.0;
constexpr double kMaxDecayMs = 250.0;

double clamp(double value, double low, double high) {
  if (value < low) {
    return low;
  }
  return value > high ? high : value;
}

/** The reverberation relation, so the dial is a real decay time. */
double comb_feedback(double delay_seconds, double decay_seconds) {
  return std::pow(10.0, -3.0 * delay_seconds / decay_seconds);
}

/**
 * One sample through one biquad, which `biquad.h` does not expose.
 *
 * The band limit runs on a mono sample that only exists inside the loop, and
 * `feq_biquad_process` works in place over a buffer. Same arithmetic and the
 * same Direct Form I state.
 */
double run_stage(FeqBiquadState* state, const FeqBiquadCoefficients& c,
                 double sample) {
  const double y = c.b0 * sample + c.b1 * state->x1 + c.b2 * state->x2 -
                   c.a1 * state->y1 - c.a2 * state->y2;
  state->x2 = state->x1;
  state->x1 = sample;
  state->y2 = state->y1;
  state->y1 = y;
  return y;
}

void set_delay(FeqBassPunchDelay* line, double milliseconds,
               double sample_rate) {
  const double samples = (milliseconds / 1000.0) * sample_rate;
  auto delay = static_cast<uint32_t>(std::floor(samples + 0.5));
  if (delay < 1u) {
    delay = 1u;
  }
  if (delay > line->capacity) {
    delay = line->capacity;
  }
  line->delay = delay;
  line->cursor = 0;
}

void clear_line(FeqBassPunchDelay* line) {
  line->cursor = 0;
  if (line->buffer == nullptr) {
    return;
  }
  for (uint32_t at = 0; at < line->capacity; ++at) {
    line->buffer[at] = 0.0f;
  }
}

/**
 * One feedback comb. What leaves is the delayed sample, taken before the new
 * one is stored, so the loop gain is the only thing that sets the decay.
 */
double comb_sample(FeqBassPunchDelay* line, double sample, double feedback) {
  if (line->buffer == nullptr || line->delay == 0) {
    return 0.0;
  }
  const double delayed = static_cast<double>(line->buffer[line->cursor]);
  line->buffer[line->cursor] =
      static_cast<float>(sample + delayed * feedback);
  line->cursor += 1;
  if (line->cursor >= line->delay) {
    line->cursor = 0;
  }
  return delayed;
}

/** One Schroeder all-pass: flat magnitude, and all of the phase. */
double all_pass_sample(FeqBassPunchDelay* line, double sample, double gain) {
  if (line->buffer == nullptr || line->delay == 0) {
    return sample;
  }
  const double delayed = static_cast<double>(line->buffer[line->cursor]);
  const double stored = sample + gain * delayed;
  line->buffer[line->cursor] = static_cast<float>(stored);
  line->cursor += 1;
  if (line->cursor >= line->delay) {
    line->cursor = 0;
  }
  return delayed - gain * stored;
}

/**
 * Derived, because it alone sizes every line the bloom owns.
 *
 * Hand-copying the longest comb here is a change that fails silently:
 * `set_delay` clamps a delay it cannot fit instead of refusing it, so a longer
 * comb would quietly become a shorter one, the mutually prime property
 * `bass_punch.h` asserts would stop holding, and no test would notice.
 */
constexpr double longest_delay_ms() {
  double longest = kAllPassMs;
  for (const double milliseconds : kCombMs) {
    if (milliseconds > longest) {
      longest = milliseconds;
    }
  }
  return longest;
}

}  // namespace

void bass_punch_bloom_attach(FeqBassPunch* state, float* const* buffers,
                             uint32_t capacity) {
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
    state->combs[at].buffer = buffers != nullptr ? buffers[at] : nullptr;
    state->combs[at].capacity = capacity;
    state->combs[at].delay = 0;
    state->combs[at].cursor = 0;
    state->comb_feedback[at] = 0.0;
  }
  state->all_pass.buffer =
      buffers != nullptr ? buffers[FEQ_BASS_PUNCH_COMBS] : nullptr;
  state->all_pass.capacity = capacity;
  state->all_pass.delay = 0;
  state->all_pass.cursor = 0;
  state->all_pass_gain = 0.0;
}

void bass_punch_bloom_clear(FeqBassPunch* state) {
  for (auto& line : state->combs) {
    clear_line(&line);
  }
  clear_line(&state->all_pass);
}

void bass_punch_bloom_retune(FeqBassPunch* state, double sample_rate) {
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
    set_delay(&state->combs[at], kCombMs[at], sample_rate);
    clear_line(&state->combs[at]);
  }
  set_delay(&state->all_pass, kAllPassMs, sample_rate);
  clear_line(&state->all_pass);
}

void bass_punch_bloom_targets(double decay_ms, double* comb_gains,
                              double* all_pass_gain) {
  const double decay_seconds = clamp(decay_ms, kMinDecayMs, kMaxDecayMs) /
                               1000.0;
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
    comb_gains[at] = comb_feedback(kCombMs[at] / 1000.0, decay_seconds);
  }
  /**
   * The all-pass decays at the dialled rate too, and is capped at Schroeder's
   * gain rather than set to it.
   *
   * It is not decoration: no comb here has a round trip short enough to fit
   * inside a forty millisecond decay — the shortest is 23.7 ms and the longest
   * 41.3 — so at the short end of the dial the combs produce three slaps and
   * the all-pass produces the decay. At the long end the combs carry the tail
   * and the cap keeps the network from ringing longer than the dial says, which
   * above about 0.7 is heard as a small room rather than as a decay.
   */
  *all_pass_gain =
      std::fmin(comb_feedback(kAllPassMs / 1000.0, decay_seconds),
                kAllPassGain);
}

double bass_punch_bloom_sample(FeqBassPunch* state, double mono,
                               const FeqBiquadCoefficients* limit) {
  // The network runs whatever `bloom_amount` is, and only its output is scaled
  // by the caller. A tail that starts filling when the dial leaves zero arrives
  // as a swell rather than as a decay of the note that caused it.
  double bloom = 0.0;
  for (uint32_t line = 0; line < FEQ_BASS_PUNCH_COMBS; ++line) {
    bloom += comb_sample(&state->combs[line], mono, state->comb_feedback[line]);
  }
  bloom = all_pass_sample(&state->all_pass,
                          bloom / static_cast<double>(FEQ_BASS_PUNCH_COMBS),
                          state->all_pass_gain);
  // Band-limited on the way out, because the shaper's own gain is a modulation
  // and puts sidebands above the split that the bloom would otherwise hold on
  // to for a quarter of a second. No DC blocker: a second order one at 30 Hz
  // rings for 52 ms, which is longer than the shortest decay this dial offers,
  // and the network's own gain at DC is under 1.8.
  return run_stage(&state->bloom_low[1], *limit,
                   run_stage(&state->bloom_low[0], *limit, bloom));
}

extern "C" {

uint32_t feq_bass_punch_bloom_capacity(double sample_rate) {
  const double samples = (longest_delay_ms() / 1000.0) * sample_rate;
  const double rounded = std::floor(samples + 0.5);
  return rounded < 1.0 ? 1u : static_cast<uint32_t>(rounded) + 1u;
}

}  // extern "C"

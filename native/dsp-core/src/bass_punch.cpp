/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/bass_punch.h"

#include <cmath>

namespace {

/** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
constexpr double kButterworthQ = 0.70710678118654752440;

/** Parameter smoothing, matching `dimension.cpp`'s and `bass_forge.cpp`'s. */
constexpr double kParameterSmoothingMs = 18.0;

/**
 * What the followers watch, and why it is a mean square and not `|x|`.
 *
 * A rectified sample ripples at twice the note, and an attack/release follower
 * rectifies that ripple into a standing offset — measured at +0.71 dB on a
 * 60 Hz tone, which is a tone control by another name and the one thing this
 * stage promises not to be. Two milliseconds is a tenth of the fast follower's
 * own release, so it costs almost nothing at the leading edge: the first five
 * milliseconds of a kick still rise 5.7 dB against the 6.8 they rise without
 * it, and the standing offset on a 40 Hz tone goes from 0.23 dB to 0.10.
 */
constexpr double kDetectorMs = 2.0;

/** Fast enough to catch a kick's leading edge, slow enough to be its envelope
 *  and not its waveform. Their DIFFERENCE is the transient. */
constexpr double kFastAttackMs = 0.5;
constexpr double kFastReleaseMs = 20.0;

/**
 * The two slower envelopes, and each is a smoothed copy of the one before it.
 *
 * One constant apiece rather than an attack and a release, and that is the
 * whole of why "the followers converge" is exact instead of nearly: a
 * single-constant smoother has unity gain at DC, so over a steady note the mean
 * of `slow` IS the mean of `fast` and their difference is zero. Three
 * independent attack/release followers of the same detector do not have that
 * property — measured, they leave +0.71 dB standing between fast and slow and
 * -0.60 dB between slow and slower on a 60 Hz tone, at every level.
 *
 * The two numbers are also what the stage claims on the front: 0.5 to 20 ms is
 * the leading edge, 20 to 150 ms is the note behind it.
 */
constexpr double kSlowMs = 20.0;
constexpr double kSlowerMs = 150.0;

/**
 * How far a decibel of envelope difference travels as a decibel of gain.
 *
 * A sharp kick reads about 22 dB between the fast and slow envelopes, so a half
 * puts the top of the dial at the ceiling below on the hardest material and
 * under it on everything softer — which is the right way round. The tail reads
 * about 4 dB, so it needs twice rather than half to reach a comparable depth.
 */
constexpr double kAttackScale = 0.5;
constexpr double kSustainScale = 2.0;

/** Ceilings, not tuning: past these the shaper stops sounding like the note
 *  getting harder and starts sounding like a gate opening. */
constexpr double kAttackCeilingDb = 12.0;
constexpr double kSustainCeilingDb = 9.0;

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
constexpr double kLongestDelayMs = 41.3;

/** Deep enough to be felt, shallow enough that it is never heard as the mix
 *  breathing. Past about 6 dB the upper band audibly leaves and comes back. */
constexpr double kDuckMaxDb = 6.0;
constexpr double kDuckReleaseMs = 30.0;

/**
 * Where the duck reaches full depth and where it lets go, in dBFS.
 *
 * A ducker with no floor pulls the upper band down under a bass line that is
 * only there in name — the tail of the last note, a room mic's rumble — and
 * that reads as the mix breathing rather than as weight. -45 dBFS is under
 * anything a listener would call a bass note; -18 is where one is unmistakably
 * present. Between them the depth is a ramp, so the duck arrives with the note
 * rather than switching on inside it, which is the shape `bass_forge.cpp` gives
 * its divider gate for the same reason.
 */
constexpr double kDuckFloorDb = -45.0;
constexpr double kDuckFullDb = -18.0;

/**
 * The documented ranges, enforced where the audio is rather than in the UI: a
 * preset stored by an older build reaches the engine without passing through a
 * control, and a split corner of zero is a filter that returns NaN forever.
 */
constexpr double kMinSplitHz = 40.0;
constexpr double kMaxSplitHz = 200.0;
constexpr double kMinDecayMs = 40.0;
constexpr double kMaxDecayMs = 250.0;

/** Below this there is no envelope to take a ratio of and the answer is noise. */
constexpr double kLevelFloor = 1e-9;

double clamp(double value, double low, double high) {
  if (value < low) {
    return low;
  }
  return value > high ? high : value;
}

double smoothing(double milliseconds, double sample_rate) {
  return 1.0 - std::exp(-1.0 / ((milliseconds / 1000.0) * sample_rate));
}

/** The reverberation relation, so the dial is a real decay time. */
double comb_feedback(double delay_seconds, double decay_seconds) {
  return std::pow(10.0, -3.0 * delay_seconds / decay_seconds);
}

/**
 * One sample through one biquad, which `biquad.h` does not expose.
 *
 * The bloom needs it: its band limit runs on a mono sample that only exists
 * inside the loop, and `feq_biquad_process` works in place over a buffer. Same
 * arithmetic and the same Direct Form I state.
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

}  // namespace

extern "C" {

uint32_t feq_bass_punch_bloom_capacity(double sample_rate) {
  const double samples = (kLongestDelayMs / 1000.0) * sample_rate;
  const double rounded = std::floor(samples + 0.5);
  return rounded < 1.0 ? 1u : static_cast<uint32_t>(rounded) + 1u;
}

void feq_bass_punch_init(FeqBassPunch* state, float* low,
                         float* const* bloom_buffers,
                         uint32_t bloom_capacity) {
  if (state == nullptr) {
    return;
  }
  state->low = low;
  state->sample_rate = 0.0;
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
    state->combs[at].buffer =
        bloom_buffers != nullptr ? bloom_buffers[at] : nullptr;
    state->combs[at].capacity = bloom_capacity;
    state->combs[at].delay = 0;
    state->combs[at].cursor = 0;
    state->comb_feedback[at] = 0.0;
  }
  state->all_pass.buffer =
      bloom_buffers != nullptr ? bloom_buffers[FEQ_BASS_PUNCH_COMBS] : nullptr;
  state->all_pass.capacity = bloom_capacity;
  state->all_pass.delay = 0;
  state->all_pass.cursor = 0;
  state->all_pass_gain = 0.0;
  // Clear until the first block has run: without it a session opens by fading
  // the user's own settings in over 18 ms.
  state->primed = 0;
  state->attack = 0.0;
  state->sustain = 0.0;
  state->bloom_amount = 0.0;
  state->duck = 0.0;
  feq_bass_punch_reset(state);
}

void feq_bass_punch_reset(FeqBassPunch* state) {
  if (state == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < 2; ++channel) {
    feq_biquad_reset(&state->split[channel][0]);
    feq_biquad_reset(&state->split[channel][1]);
  }
  feq_biquad_reset(&state->bloom_low[0]);
  feq_biquad_reset(&state->bloom_low[1]);
  for (auto& line : state->combs) {
    clear_line(&line);
  }
  clear_line(&state->all_pass);
  state->detector_mean_square = 0.0;
  state->fast = 0.0;
  state->slow = 0.0;
  state->slower = 0.0;
  state->duck_level = 0.0;
  state->transient_gain_db = 0.0;
  state->sustain_gain_db = 0.0;
  state->duck_gain_db = 0.0;
}

void feq_bass_punch_process(FeqBassPunch* state, float* const* channels,
                            uint32_t channel_count, uint32_t frames,
                            const FeqBassPunchSettings* settings,
                            double sample_rate) {
  if (state == nullptr || channels == nullptr || settings == nullptr ||
      frames == 0 || channel_count == 0 || state->low == nullptr ||
      settings->enabled == 0) {
    return;
  }
  // Two channels of low band is what the buffer holds: a surround block gets
  // its front pair shaped and the rest passed through untouched.
  const uint32_t used = channel_count < 2u ? 1u : 2u;

  // Emptied as well as re-lengthed. What is in a line at the old rate is read
  // back at a different offset and a different speed at the new one, and it is
  // read back through a feedback loop, so it does not decay out of the way.
  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
      set_delay(&state->combs[at], kCombMs[at], sample_rate);
      clear_line(&state->combs[at]);
    }
    set_delay(&state->all_pass, kAllPassMs, sample_rate);
    clear_line(&state->all_pass);
  }

  const double split_hz = clamp(settings->split_hz, kMinSplitHz, kMaxSplitHz);
  const FeqBiquadCoefficients lowpass = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, split_hz, 0.0, kButterworthQ, sample_rate);

  const double smooth = smoothing(kParameterSmoothingMs, sample_rate);
  const double detect = smoothing(kDetectorMs, sample_rate);
  const double fast_attack = smoothing(kFastAttackMs, sample_rate);
  const double fast_release = smoothing(kFastReleaseMs, sample_rate);
  const double slow_coefficient = smoothing(kSlowMs, sample_rate);
  const double slower_coefficient = smoothing(kSlowerMs, sample_rate);
  const double duck_release = smoothing(kDuckReleaseMs, sample_rate);

  const double target_attack = clamp(settings->attack, -1.0, 1.0);
  const double target_sustain = clamp(settings->sustain, -1.0, 1.0);
  const double target_bloom = clamp(settings->bloom_amount, 0.0, 1.0);
  const double target_duck = clamp(settings->duck, 0.0, 1.0);
  const double decay_seconds =
      clamp(settings->bloom_decay_ms, kMinDecayMs, kMaxDecayMs) / 1000.0;
  double target_feedback[FEQ_BASS_PUNCH_COMBS] = {};
  for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
    target_feedback[at] = comb_feedback(kCombMs[at] / 1000.0, decay_seconds);
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
  const double target_all_pass = std::fmin(
      comb_feedback(kAllPassMs / 1000.0, decay_seconds), kAllPassGain);

  if (state->primed == 0) {
    state->primed = 1;
    state->attack = target_attack;
    state->sustain = target_sustain;
    state->bloom_amount = target_bloom;
    state->duck = target_duck;
    for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
      state->comb_feedback[at] = target_feedback[at];
    }
    state->all_pass_gain = target_all_pass;
  }

  // The low band, per channel. The caller's block is not touched yet: the
  // output is written as `input + (shaped band - dry band) + ...`, and it is
  // that form rather than `rest + shaped band` which makes every dial at rest
  // come back bit for bit instead of within a rounding of itself.
  for (uint32_t channel = 0; channel < used; ++channel) {
    float* band = state->low + channel * frames;
    for (uint32_t at = 0; at < frames; ++at) {
      band[at] = channels[channel][at];
    }
    feq_biquad_process(&state->split[channel][0], band, frames, &lowpass);
    feq_biquad_process(&state->split[channel][1], band, frames, &lowpass);
  }

  const double channel_scale = 1.0 / static_cast<double>(used);
  const double comb_scale = 1.0 / static_cast<double>(FEQ_BASS_PUNCH_COMBS);
  for (uint32_t at = 0; at < frames; ++at) {
    state->attack += (target_attack - state->attack) * smooth;
    state->sustain += (target_sustain - state->sustain) * smooth;
    state->bloom_amount += (target_bloom - state->bloom_amount) * smooth;
    state->duck += (target_duck - state->duck) * smooth;
    for (uint32_t line = 0; line < FEQ_BASS_PUNCH_COMBS; ++line) {
      state->comb_feedback[line] +=
          (target_feedback[line] - state->comb_feedback[line]) * smooth;
    }
    state->all_pass_gain += (target_all_pass - state->all_pass_gain) * smooth;

    double power = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      const double band =
          static_cast<double>(state->low[channel * frames + at]);
      power += band * band;
    }
    state->detector_mean_square +=
        (power * channel_scale - state->detector_mean_square) * detect;
    const double magnitude = std::sqrt(2.0 * state->detector_mean_square);

    state->fast += (magnitude - state->fast) *
                   (magnitude > state->fast ? fast_attack : fast_release);
    state->slow += (state->fast - state->slow) * slow_coefficient;
    state->slower += (state->slow - state->slower) * slower_coefficient;

    /**
     * Each control gets one side of its own difference, and that is what keeps
     * them out of each other's milliseconds.
     *
     * The fast envelope stands above the slow one only while the note is
     * rising, and the slower stands above the slow one only while it is
     * falling. Taking the positive part of each therefore gives `attack` the
     * leading edge and `sustain` the tail, with nothing left over: the signed
     * difference would have `attack` cutting through the whole decay, which is
     * the tail's job and the opposite of what the dial says.
     */
    const double slow_level = std::fmax(state->slow, kLevelFloor);
    const double rise =
        20.0 * std::log10(std::fmax(state->fast, kLevelFloor) / slow_level);
    const double fall =
        20.0 * std::log10(std::fmax(state->slower, kLevelFloor) / slow_level);
    state->transient_gain_db =
        clamp(state->attack * (rise > 0.0 ? rise : 0.0) * kAttackScale,
              -kAttackCeilingDb, kAttackCeilingDb);
    state->sustain_gain_db =
        clamp(state->sustain * (fall > 0.0 ? fall : 0.0) * kSustainScale,
              -kSustainCeilingDb, kSustainCeilingDb);
    const double shaped_gain = std::pow(
        10.0, (state->transient_gain_db + state->sustain_gain_db) / 20.0);

    double shaped[2] = {0.0, 0.0};
    double mono = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      shaped[channel] =
          static_cast<double>(state->low[channel * frames + at]) * shaped_gain;
      mono += shaped[channel];
    }
    mono *= channel_scale;

    // The network runs whatever `bloom_amount` is, and only its output is
    // scaled. A tail that starts filling when the dial leaves zero arrives as a
    // swell rather than as a decay of the note that caused it.
    double bloom = 0.0;
    for (uint32_t line = 0; line < FEQ_BASS_PUNCH_COMBS; ++line) {
      bloom +=
          comb_sample(&state->combs[line], mono, state->comb_feedback[line]);
    }
    bloom = all_pass_sample(&state->all_pass, bloom * comb_scale,
                            state->all_pass_gain);
    // Band-limited on the way out, because the shaper's own gain is a
    // modulation and puts sidebands above the split that the bloom would
    // otherwise hold on to for a quarter of a second. No DC blocker: a second
    // order one at 30 Hz rings for 52 ms, which is longer than the shortest
    // decay this dial offers, and the network's own gain at DC is under 1.8.
    bloom = run_stage(&state->bloom_low[1], lowpass,
                      run_stage(&state->bloom_low[0], lowpass, bloom));
    bloom *= state->bloom_amount;

    // Instant attack, `kDuckReleaseMs` to let go: the duck has to be under the
    // kick rather than behind it, and the release is what stops it chattering
    // between the cycles of a note.
    state->duck_level =
        state->fast > state->duck_level
            ? state->fast
            : state->duck_level + (state->fast - state->duck_level) *
                                      duck_release;
    const double depth =
        clamp((20.0 * std::log10(std::fmax(state->duck_level, kLevelFloor)) -
               kDuckFloorDb) /
                  (kDuckFullDb - kDuckFloorDb),
              0.0, 1.0);
    state->duck_gain_db = -kDuckMaxDb * state->duck * depth;
    const double duck_gain = std::pow(10.0, state->duck_gain_db / 20.0);

    for (uint32_t channel = 0; channel < used; ++channel) {
      const double input = static_cast<double>(channels[channel][at]);
      const double band =
          static_cast<double>(state->low[channel * frames + at]);
      channels[channel][at] = static_cast<float>(
          input + (shaped[channel] - band) + bloom +
          (input - band) * (duck_gain - 1.0));
    }
  }
}

double feq_bass_punch_transient_db(const FeqBassPunch* state) {
  return state != nullptr ? state->transient_gain_db : 0.0;
}

double feq_bass_punch_sustain_db(const FeqBassPunch* state) {
  return state != nullptr ? state->sustain_gain_db : 0.0;
}

double feq_bass_punch_duck_db(const FeqBassPunch* state) {
  return state != nullptr ? state->duck_gain_db : 0.0;
}

}  // extern "C"

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "bass_punch_internal.h"

#include <cmath>

namespace {

/** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
constexpr double kButterworthQ = 0.70710678118654752440;

/** Parameter smoothing, matching `dimension.cpp`'s and `bass_forge.cpp`'s. */
constexpr double kParameterSmoothingMs = 18.0;

/** Smooth detector power without letting waveform ripple drive the gain. */
constexpr double kDetectorMs = 2.0;
constexpr double kFastAttackMs = 0.5;
constexpr double kFastReleaseMs = 20.0;
constexpr double kSlowMs = 12.0;
constexpr double kSlowerMs = 150.0;

/**
 * A raw fast/slow ratio collapses as soon as the followers catch up, before
 * the first few 40–100 Hz cycles have delivered the kick's body. Follow its
 * bounded onset strength with an 8 ms release, then scale by the dial.
 * Clamping BEFORE the dial prevents even a tiny setting from reaching full
 * gain on the first note after silence.
 */
constexpr double kPunchAttackMs = 0.5;
constexpr double kPunchReleaseMs = 8.0;
// Ignore the rectified carrier's small ripple; only a rising bass envelope
// should trigger punch. The shorter follower/release keeps it off the tail.
constexpr double kOnsetDeadbandDb = 0.5;
// Restore the low-bass Bloom level lost to the final bass-only FIR skirt.
constexpr double kBloomCompensation = 1.12;
constexpr double kAttackScale = 2.0;
constexpr double kSustainScale = 2.0;
constexpr double kAttackCeilingDb = 12.0;
constexpr double kSustainCeilingDb = 9.0;

/** Pull the generated tail back under a new hit without ducking the mix. */
constexpr double kDuckMaxDb = 6.0;
constexpr double kDuckReleaseMs = 30.0;

/** Fade tail duck in only when a bass note rises above background rumble. */
constexpr double kDuckFloorDb = -45.0;
constexpr double kDuckFullDb = -18.0;

/**
 * Tail duck follows a hit above the running bass level, rather than absolute
 * loudness. A steady bassline must not hold the bloom down permanently.
 */
constexpr double kDuckRangeDb = 6.0;

/**
 * The documented ranges, enforced where the audio is rather than in the UI.
 *
 * A preset stored by an older build reaches the engine without passing through
 * a control, and a split corner of zero is not a quiet filter: the cookbook
 * lowpass collapses to `y[n] = 2*y[n-1] - y[n-2]` there, which is a straight
 * line drawn through the last two outputs and grows by their difference every
 * sample. The corner only ever moves while audio is running, so those two
 * outputs are never zero — from the ordinary sample-to-sample step of a 60 Hz
 * note at -20 dBFS it reaches full scale in about a thousand samples.
 */
constexpr double kMinSplitHz = 40.0;
constexpr double kMaxSplitHz = 200.0;

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

}  // namespace

extern "C" {

void feq_bass_punch_init(FeqBassPunch* state, float* low,
                         float* const* bloom_buffers,
                         uint32_t bloom_capacity) {
  if (state == nullptr) {
    return;
  }
  state->low = low;
  state->sample_rate = 0.0;
  bass_punch_bloom_attach(state, bloom_buffers, bloom_capacity);
  // Clear until the first block has run: without it a session opens by fading
  // the user's own settings in over 18 ms.
  state->primed = 0;
  state->attack = 0.0;
  state->sustain = 0.0;
  state->bloom_amount = 0.0;
  state->duck = 0.0;
  state->mix = 1.0;
  feq_bass_punch_reset(state);
}

void feq_bass_punch_reset(FeqBassPunch* state) {
  if (state == nullptr) {
    return;
  }
  bass_punch_band_reset(state);
  for (uint32_t channel = 0; channel < 2; ++channel) {
    feq_biquad_reset(&state->split[channel][0]);
    feq_biquad_reset(&state->split[channel][1]);
  }
  feq_biquad_reset(&state->bloom_low[0]);
  feq_biquad_reset(&state->bloom_low[1]);
  bass_punch_bloom_clear(state);
  state->detector_mean_square = 0.0;
  state->fast = 0.0;
  state->slow = 0.0;
  state->slower = 0.0;
  state->punch_envelope_db = 0.0;
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
      frames == 0 || channel_count == 0 || state->low == nullptr) {
    return;
  }
  // Two channels of low band is what the buffer holds: a surround block gets
  // its front pair shaped and the rest passed through untouched.
  const uint32_t used = channel_count < 2u ? 1u : 2u;
  const bool on = settings->enabled != 0;
  const bool isolate = on && settings->isolate != 0;
  bass_punch_band_prepare(state, sample_rate);

  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    bass_punch_bloom_retune(state, sample_rate);
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
  const double punch_attack = smoothing(kPunchAttackMs, sample_rate);
  const double punch_release = smoothing(kPunchReleaseMs, sample_rate);

  const double target_attack = on ? clamp(settings->attack, -1.0, 1.0) : 0.0;
  const double target_sustain = on ? clamp(settings->sustain, -1.0, 1.0) : 0.0;
  const double target_bloom = on ? clamp(settings->bloom_amount, 0.0, 1.0) : 0.0;
  const double target_duck = on ? clamp(settings->duck, 0.0, 1.0) : 0.0;
  const double target_mix = on && std::isfinite(settings->mix)
                                ? clamp(settings->mix, 0.0, 2.0)
                                : 0.0;
  double target_feedback[FEQ_BASS_PUNCH_COMBS] = {};
  double target_all_pass = 0.0;
  bass_punch_bloom_targets(settings->bloom_decay_ms, target_feedback,
                           &target_all_pass);

  if (state->primed == 0 || !on) {
    state->primed = 1;
    state->attack = target_attack;
    state->sustain = target_sustain;
    state->bloom_amount = target_bloom;
    state->duck = target_duck;
    state->mix = target_mix;
    for (uint32_t at = 0; at < FEQ_BASS_PUNCH_COMBS; ++at) {
      state->comb_feedback[at] = target_feedback[at];
    }
    state->all_pass_gain = target_all_pass;
  }

  // Keep the detector separate from the original samples. Adding only the
  // filtered contribution preserves exact delayed dry audio at zero controls.
  for (uint32_t channel = 0; channel < used; ++channel) {
    float* band = state->low + channel * frames;
    for (uint32_t at = 0; at < frames; ++at) {
      band[at] = channels[channel][at];
    }
    feq_biquad_process(&state->split[channel][0], band, frames, &lowpass);
    feq_biquad_process(&state->split[channel][1], band, frames, &lowpass);
  }

  const double channel_scale = 1.0 / static_cast<double>(used);
  for (uint32_t at = 0; at < frames; ++at) {
    state->attack += (target_attack - state->attack) * smooth;
    state->sustain += (target_sustain - state->sustain) * smooth;
    state->bloom_amount += (target_bloom - state->bloom_amount) * smooth;
    state->duck += (target_duck - state->duck) * smooth;
    state->mix += (target_mix - state->mix) * smooth;
    // Let the endpoints become exact after a click-free fade.
    if (std::fabs(target_mix - state->mix) < 1e-6) {
      state->mix = target_mix;
    }
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

    const double slow_level = std::fmax(state->slow, kLevelFloor);
    const double rise =
        20.0 * std::log10(std::fmax(state->fast, kLevelFloor) / slow_level);
    const double fall =
        20.0 * std::log10(std::fmax(state->slower, kLevelFloor) / slow_level);
    // Ignore near-silence before onset normalization. A long decay otherwise
    // turns numerical residue into a full-strength attack on the next block.
    const double audible = clamp((magnitude - 1e-5) / 9e-5, 0.0, 1.0);
    const double onset =
        clamp((rise - kOnsetDeadbandDb) * kAttackScale, 0.0,
              kAttackCeilingDb) * audible;
    state->punch_envelope_db +=
        (onset - state->punch_envelope_db) *
        (onset > state->punch_envelope_db ? punch_attack : punch_release);
    state->transient_gain_db = state->attack * state->punch_envelope_db;
    // Release the original bass tail after the hit. The attack envelope also
    // crossfades this control in so a negative Sustain does not eat the punch.
    const double tail_weight =
        1.0 - state->punch_envelope_db / kAttackCeilingDb;
    state->sustain_gain_db =
        state->sustain * clamp(fall * kSustainScale, 0.0, kSustainCeilingDb) *
        tail_weight;
    const double shaped_gain = std::pow(
        10.0, (state->transient_gain_db + state->sustain_gain_db) / 20.0);

    // Feed bloom only the detector's bass band so high-frequency content
    // cannot seed the optional decay network.
    double mono = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      mono += static_cast<double>(state->low[channel * frames + at]);
    }
    mono *= channel_scale * shaped_gain;

    const double bloom =
        bass_punch_bloom_sample(state, mono, &lowpass) * kBloomCompensation *
        state->bloom_amount;

    // Instant attack, `kDuckReleaseMs` to let go: the duck has to be under the
    // kick rather than behind it, and the release is what stops it chattering
    // between the cycles of a note.
    state->duck_level =
        state->fast > state->duck_level
            ? state->fast
            : state->duck_level + (state->fast - state->duck_level) *
                                      duck_release;
    const double level =
        20.0 * std::log10(std::fmax(state->duck_level, kLevelFloor));
    // The gate first, then the depth. The gate answers "is there a bass note
    // here at all", which is absolute; the depth answers "how far is it above
    // the one before it", which cannot be, or the answer is yes forever.
    const double present =
        clamp((level - kDuckFloorDb) / (kDuckFullDb - kDuckFloorDb), 0.0, 1.0);
    const double excess =
        level - 20.0 * std::log10(std::fmax(state->slower, kLevelFloor));
    const double depth = present * clamp(excess / kDuckRangeDb, 0.0, 1.0);
    state->duck_gain_db = state->bloom_amount > kLevelFloor
                             ? -kDuckMaxDb * state->duck * depth
                             : 0.0;
    const double duck_gain = std::pow(10.0, state->duck_gain_db / 20.0);

    // Duck used to multiply (input - band), suppressing vocals and cymbals
    // whenever a kick arrived. It now clears only the generated bloom tail.
    // The final FIR confines all changes, including modulation sidebands, to
    // bass and aligns the untouched dry path with that contribution.
    for (uint32_t channel = 0; channel < used; ++channel) {
      const double input = static_cast<double>(channels[channel][at]);
      channels[channel][at] = static_cast<float>(bass_punch_band_sample(
          state, channel, input, shaped_gain, bloom * duck_gain, state->mix,
          isolate));
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

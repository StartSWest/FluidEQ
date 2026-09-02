/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "bass_punch_internal.h"

#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;

/** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
constexpr double kButterworthQ = 0.70710678118654752440;

/** Parameter smoothing, matching `dimension.cpp`'s and `bass_forge.cpp`'s. */
constexpr double kParameterSmoothingMs = 18.0;

/**
 * What the followers watch, and why it is a mean square and not `|x|`.
 *
 * A rectified sample ripples at twice the note, and the followers behind it
 * turn that ripple into a standing offset — a tone control by another name,
 * and the one thing this stage promises not to be. Two milliseconds is a tenth
 * of the fast follower's own release, so it costs almost nothing at the leading
 * edge: the first five milliseconds of a kick still rise 5.7 dB against the 6.8
 * they rise without it, and the standing offset on a 40 Hz tone goes from
 * 0.23 dB to 0.10. The larger +0.71 dB offset `kSlowMs` names below has a
 * different cause and needed a different fix; this window does not remove it.
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
 * The rule is that the top of the dial reaches the ceiling below on the hardest
 * material and sits under it on everything softer. What that costs depends
 * entirely on the envelope difference the material actually produces, and the
 * first number here was fitted to one that cannot occur: 0.5 came from "a sharp
 * kick reads about 22 dB between the fast and slow envelopes", which is a kick
 * alone in digital silence. `pulse_train` in `bass_punch_test.cpp` is exactly
 * that — it returns 0.0 between bursts, so both followers collapse to the floor
 * and the next onset reads a ratio no programme material can.
 *
 * Measured, same kick, same stage, three signals:
 *
 *     alone in silence            rise 28.3 dB   fall 41.6 dB
 *     over a -18 dBFS bassline    rise 10.0 dB   fall  3.8 dB
 *     over a bassline louder
 *       than the kick itself      rise  5.8 dB   fall  1.4 dB
 *
 * Music is the second and third rows. At 0.5 the top of the attack dial bought
 * 5 dB of gain there instead of the ceiling's 12, which reached the audio
 * through the shelf as +2.4 dB over the 5-15 ms of the hit and -0.6 dB over the
 * first 5 — and the `slam` profile, whose duck and negative sustain are sized
 * against an attack that was supposed to be at its ceiling, made the front of
 * the kick 1.3 dB QUIETER than bypass. 1.2 is the same rule refitted to the
 * second row: 10 dB of rise reaches the ceiling, anything denser sits under it,
 * and the silence case is held there by the ceiling as it always was.
 * `test_attack_survives_a_bassline` is the guard, and it fails at 0.5.
 *
 * `kSustainScale` is left alone because the tail was never fitted to silence in
 * the same way: 3.8 dB of fall at twice is 7.6 dB, which is inside the ceiling
 * below and audible where it is applied.
 */
constexpr double kAttackScale = 1.2;
constexpr double kSustainScale = 2.0;

/** Ceilings, not tuning: past these the shaper stops sounding like the note
 *  getting harder and starts sounding like a gate opening. */
constexpr double kAttackCeilingDb = 12.0;
constexpr double kSustainCeilingDb = 9.0;

/** Deep enough to be felt, shallow enough that it is never heard as the mix
 *  breathing. Past about 6 dB the upper band audibly leaves and comes back. */
constexpr double kDuckMaxDb = 6.0;
constexpr double kDuckReleaseMs = 30.0;

/**
 * The gate, in dBFS, and it is only a gate now. See `kDuckRangeDb` below.
 *
 * A ducker with no floor pulls the upper band down under a bass line that is
 * only there in name — the tail of the last note, a room mic's rumble — and
 * that reads as the mix breathing rather than as weight. -45 dBFS is under
 * anything a listener would call a bass note; -18 is where one is unmistakably
 * present, and between them this ramps in so the guard has no edge to click on.
 *
 * What it no longer does is set the DEPTH. It used to be the whole of it, and
 * measured, that made the control a tone control: every real low band sits
 * above -18 dBFS continuously, so the ramp was pinned at 1 for every frame of
 * every track and the duck meter read -6.00 to -6.00 with no movement in it.
 * What shipped as "pulled down under the bass" was a permanent -5.85 dB shelf
 * above the split, and it is what made the profiles cancel: `slam` spent its
 * whole attack undoing a tilt that never let go.
 */
constexpr double kDuckFloorDb = -45.0;
constexpr double kDuckFullDb = -18.0;

/**
 * How far the low band must stand above its OWN running level for full depth.
 *
 * This is what makes it a duck rather than a shelf, and it is the same
 * construction the shaper above already runs on: a difference of envelopes, so
 * there is no absolute threshold for material to sit permanently over. The
 * reference is `slower`, the 150 ms envelope, so what the ramp measures is the
 * hit against the bass line it arrives on top of — which is the thing the
 * upper band actually has to get out of the way of.
 *
 * It follows that a steady note ducks nothing, at any level, because a steady
 * note has nothing to stand above. That is the property, not a gap in it:
 * `test_duck_is_a_duck_not_a_tilt` asserts both halves.
 *
 * 6 dB because that is inside the excess an ordinary kick produces over an
 * ordinary bass line — measured, 10 dB where the kick leads and 5.8 dB where
 * the bass is louder than the kick — so the dial reaches its depth on the
 * first and most of it on the second.
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

/**
 * The one-pole the GAIN is applied through, and why it is not the LR4 above.
 *
 * `feq_crossover_split` in `primitives.h` was not reused and could not be: it
 * derives its upper bands the same way this stage does, by subtraction, so it
 * is the reference implementation of this defect rather than of its fix.
 *
 * With `rest = x - band` the delivered response is `d + (g - d) * L(f)`, and
 * an LR4 lowpass is exactly -0.5 at its own corner — half amplitude, opposite
 * sign. A boost therefore arrives inverted there: `1.5d - 0.5g` cancels
 * completely at `g = 3` (+9.5 dB, inside a dial that ceilings at 12) and flips
 * polarity above it. Measured before this changed, a duck asking for -6 dB
 * delivered -11.98 dB at a 200 Hz split.
 *
 * A one-pole cannot do that, and it is the only order that cannot. Its Nyquist
 * locus is the circle `|L - 1/2| = 1/2`, so `Re(L) = |L|^2` everywhere and
 * `|d + (g - d)L1|^2` collapses to `d^2 + (g^2 - d^2) / (1 + (f/split)^2)` —
 * monotone from `g` at DC to `d` at Nyquist, never past either end, never zero.
 * Bode's gain-phase relation says nothing steeper can stay inside that circle,
 * so the trade is a 6 dB per octave transition in exchange for a shelf that is
 * correct at every setting. The detector keeps its 24 dB per octave band,
 * because what it has to find is a kick and not a snare.
 *
 * The alternative — a real LR4 highpass, making a complementary pair — sums to
 * an allpass rather than to the input, which would cost the bit-exact bypass
 * both this stage and Forge document and test, and at the corner it delivers
 * `(g + d) / 2`: less of the asked-for gain than the shelf's
 * `sqrt((g^2 + d^2) / 2)`, not more.
 */
struct OnePole {
  double b;
  double a;
};

OnePole one_pole(double corner_hz, double sample_rate) {
  const double warped = std::tan(kPi * corner_hz / sample_rate);
  return OnePole{warped / (1.0 + warped), (warped - 1.0) / (warped + 1.0)};
}

/** Transposed Direct Form II, which is why one double of state is enough. */
double one_pole_sample(double* state, const OnePole& coefficients,
                       double sample) {
  const double out = coefficients.b * sample + *state;
  *state = coefficients.b * sample - coefficients.a * out;
  return out;
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
  feq_bass_punch_reset(state);
}

void feq_bass_punch_reset(FeqBassPunch* state) {
  if (state == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < 2; ++channel) {
    feq_biquad_reset(&state->split[channel][0]);
    feq_biquad_reset(&state->split[channel][1]);
    state->shelf[channel] = 0.0;
  }
  feq_biquad_reset(&state->bloom_low[0]);
  feq_biquad_reset(&state->bloom_low[1]);
  bass_punch_bloom_clear(state);
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
  const bool isolate = settings->isolate != 0;

  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    bass_punch_bloom_retune(state, sample_rate);
  }

  const double split_hz = clamp(settings->split_hz, kMinSplitHz, kMaxSplitHz);
  const FeqBiquadCoefficients lowpass = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, split_hz, 0.0, kButterworthQ, sample_rate);
  const OnePole shelf = one_pole(split_hz, sample_rate);

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
  double target_feedback[FEQ_BASS_PUNCH_COMBS] = {};
  double target_all_pass = 0.0;
  bass_punch_bloom_targets(settings->bloom_decay_ms, target_feedback,
                           &target_all_pass);

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

  // The detector's low band, per channel. The caller's block is not touched
  // yet: the output is written as `input + (g - 1) * band + ...`, and it is
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

    // The bloom is fed from the DETECTOR's band rather than from the shelf:
    // what goes into a quarter-second tail has to be the note and not the
    // shelf's skirt, and the network's own band limit is at the same corner.
    double mono = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      mono += static_cast<double>(state->low[channel * frames + at]);
    }
    mono *= channel_scale * shaped_gain;

    const double bloom =
        bass_punch_bloom_sample(state, mono, &lowpass) * state->bloom_amount;

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
    state->duck_gain_db = -kDuckMaxDb * state->duck * depth;
    const double duck_gain = std::pow(10.0, state->duck_gain_db / 20.0);

    // Both gains reach the audio through the one-pole shelf, and the two
    // deltas are exactly zero when both gains are one — which is what keeps
    // every dial at rest a bit-exact bypass rather than a near one.
    for (uint32_t channel = 0; channel < used; ++channel) {
      const double input = static_cast<double>(channels[channel][at]);
      const double band =
          one_pole_sample(&state->shelf[channel], shelf, input);
      // The three deltas ARE the stage's contribution, which is why the
      // monitor is this same sum with the input dropped rather than a second
      // path: what is heard cannot drift from what is applied, and at rest it
      // is exactly zero for the reason the comment above gives.
      const double contribution = (shaped_gain - 1.0) * band + bloom +
                                  (duck_gain - 1.0) * (input - band);
      channels[channel][at] =
          static_cast<float>(isolate ? contribution : input + contribution);
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

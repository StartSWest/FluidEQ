/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/bass_forge.h"
#include "fluideq/saturate.h"

#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;

/** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
constexpr double kButterworthQ = 0.70710678118654752440;

/**
 * The level window, and it has to be this slow.
 *
 * At 20 Hz one cycle is 50 ms, so a window of a few tens of milliseconds
 * measures the waveform rather than the level, and the normalisation starts
 * tracking each note's own envelope — which removes the effect it is there to
 * make honest. `FIT_TRACK_MS` in `harmonics.cpp` is slow for the same reason.
 */
constexpr double kLevelWindowMs = 250.0;

/** Below this the divider is muted. See the header on rumble in silence. */
constexpr double kDividerFloor = 0.0015;

/** Nothing below this is radiated by any speaker; generated sub stops here. */
constexpr double kSubHighPassHz = 25.0;

/** Parameter smoothing, matching `dimension.cpp`'s. */
constexpr double kParameterSmoothingMs = 18.0;

/**
 * How the divider's own level is watched, which is not how the band's is.
 *
 * This follower decides one thing — whether the divider is running — so it
 * wants a gate's shape rather than a meter's: open by the second cycle of a
 * note, and slow enough afterwards to stay open across the note's own zero
 * crossings. The quarter-second window above would let a bass line get four
 * notes in before its octave arrived.
 */
constexpr double kDividerAttackMs = 10.0;
constexpr double kDividerReleaseMs = 180.0;

/**
 * How far the divider's output may be matched back up. Six decibels.
 *
 * The match exists so that `sub_amount` is a ratio rather than a level, but it
 * must not undo the filter above it: the octave of a 40 Hz note lands at 20,
 * which `kSubHighPassHz` is there to remove, and a matcher with no ceiling
 * would read that removal as a level to correct and put the infrasound back.
 */
constexpr double kSubGainCeiling = 2.0;

/**
 * DC out of the generated path, and one filter for all of it.
 *
 * Both non-linearities upstream are asymmetric on purpose and both make DC.
 * `feq_harmonic_sample`'s even order is `2x^2` without Chebyshev's -1 — see
 * `harmonics.h` for the tail that constant left behind — and `mean(2x^2)` is
 * `2 * mean(x^2)`, positive for everything that is not silence, so it hands
 * back an offset the size of the harmonic it came with. The Drive curve is an
 * offset tangent, which is where its second harmonic comes from and where a
 * signal-dependent DC comes with it. So this sits downstream of both: one
 * blocker is one authority, and two in series would tax the presence path
 * twice.
 *
 * Derived from the rate rather than being the Exciter's fixed pole: this
 * content IS the bass, and a corner that moved from 18 Hz at 44.1 kHz to 40 Hz
 * at 96 kHz would be a tone control that changed with the sound card.
 */
constexpr double kGeneratedDcHz = 20.0;

/**
 * Below this the Drive curve is bypassed, and it has to be.
 *
 * `feq_saturate_sample` divides by its drive, so zero is 0/0 rather than a
 * bypass, and just above zero it is the difference of two tangents an epsilon
 * apart divided by that epsilon — all rounding. A millionth is far under where
 * the curve is audible and far over where it stops being arithmetic.
 */
constexpr double kSaturationFloor = 1e-6;

/**
 * Small enough that the curve has not begun to bend at it.
 *
 * Its small-signal gain is `sech^2` of an offset whose constants live inside
 * `saturate.cpp`, so it is measured through the public function rather than
 * re-derived from numbers this file has no business knowing. Dividing it out
 * keeps Drive from also being a 1.2 dB cut on the generated content, and stops
 * the bypass above stepping a quarter of a decibel as the dial leaves zero.
 */
constexpr double kUnityProbe = 1e-4;

/** The Drive curve's reference level, floored as `harmonics.cpp`'s is: the
 *  clamp is on the level and not the signal, so colour fades out under about
 *  -60 dBFS rather than switching off at it. */
constexpr double kColourFloor = 0.001;

/**
 * The documented ranges, enforced where the audio is rather than in the UI: a
 * preset stored by an older build reaches the engine without passing through a
 * control, and a split corner of zero is a filter that returns NaN forever.
 */
constexpr double kMinSplitHz = 40.0;
constexpr double kMaxSplitHz = 200.0;
constexpr double kMaxDriveDb = 12.0;

/** Below this there is no signal to take a ratio of and the answer is noise. */
constexpr double kEnergyFloor = 1e-12;

/** The meter grid: eight bands, geometrically spaced, bass and nothing else. */
constexpr double kMeterLowHz = 20.0;
constexpr double kMeterHighHz = 1000.0;
constexpr double kMeterFloorDb = -120.0;

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
 * One sample through one biquad, which `biquad.h` does not expose.
 *
 * The meters and nothing else need this: sixteen band-passes have to run
 * beside the audio without a buffer each, and `feq_biquad_process` works in
 * place over one. Same arithmetic and the same Direct Form I state.
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

/**
 * The eight meter band-passes, rebuilt only when the rate moves.
 *
 * Q comes from the grid rather than from taste: each band's -3 dB width is
 * exactly the spacing to its neighbour, so the eight read as one curve instead
 * of as eight spikes with holes between them.
 */
void build_meter_bands(FeqBassForge* state, double sample_rate) {
  const double ratio =
      std::pow(kMeterHighHz / kMeterLowHz,
               1.0 / static_cast<double>(FEQ_BASS_FORGE_BANDS - 1));
  const double quality = std::sqrt(ratio) / (ratio - 1.0);
  double centre = kMeterLowHz;
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    const double safe = std::fmin(centre, sample_rate * 0.45);
    state->meter_coefficients[band] =
        feq_biquad_coefficients(FEQ_FILTER_BP, safe, 0.0, quality, sample_rate);
    feq_biquad_reset(&state->meter_input[band]);
    feq_biquad_reset(&state->meter_output[band]);
    centre *= ratio;
  }
}

double level_db(double mean_square) {
  if (mean_square <= kEnergyFloor) {
    return kMeterFloorDb;
  }
  const double decibels = 10.0 * std::log10(mean_square);
  return decibels > kMeterFloorDb ? decibels : kMeterFloorDb;
}

}  // namespace

extern "C" {

void feq_bass_forge_init(FeqBassForge* state, float* low, float* scratch) {
  if (state == nullptr) {
    return;
  }
  state->low = low;
  state->scratch = scratch;
  state->sample_rate = 0.0;
  feq_harmonic_init(&state->harmonic);
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    state->meter_coefficients[band] = FeqBiquadCoefficients{};
  }
  // A negative `mix` is the sentinel for "no block has run yet": without it a
  // session opens by fading the user's own settings in over 18 ms.
  state->drive = 1.0;
  state->saturation = 0.0;
  state->sub_amount = 0.0;
  state->presence_amount = 0.0;
  state->texture = 0.0;
  state->mix = -1.0;
  feq_bass_forge_reset(state);
}

void feq_bass_forge_reset(FeqBassForge* state) {
  if (state == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < 2; ++channel) {
    feq_biquad_reset(&state->split[channel][0]);
    feq_biquad_reset(&state->split[channel][1]);
  }
  feq_biquad_reset(&state->divider_low[0]);
  feq_biquad_reset(&state->divider_low[1]);
  feq_biquad_reset(&state->divider_high);
  feq_harmonic_reset(&state->harmonic);
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    feq_biquad_reset(&state->meter_input[band]);
    feq_biquad_reset(&state->meter_output[band]);
    state->meter_input_mean_square[band] = 0.0;
    state->meter_output_mean_square[band] = 0.0;
  }
  state->flipped = 0;
  state->positive = 0;
  state->divider_mean_square = 0.0;
  // Shut rather than open: a divider that runs before its level is known is a
  // burst of octave at every seek.
  state->divider_gate = 0.0;
  state->source_mean_square = 0.0;
  state->octave_mean_square = 0.0;
  state->sub_gain = 1.0;
  state->dc_input = 0.0;
  state->dc_output = 0.0;
  state->low_mean_square = 0.0;
  state->wet_mean_square = 0.0;
  // Unity, so that the first block does not arrive through a normaliser that
  // is still converging — which is an audible swell, not a silent one.
  state->gain = 1.0;
}

void feq_bass_forge_process(FeqBassForge* state, float* const* channels,
                            uint32_t channel_count, uint32_t frames,
                            const FeqBassForgeSettings* settings,
                            double sample_rate) {
  if (state == nullptr || channels == nullptr || settings == nullptr ||
      frames == 0 || channel_count == 0 || state->low == nullptr ||
      state->scratch == nullptr || settings->enabled == 0) {
    return;
  }
  // Two channels of low band is what the buffers hold: a surround block gets
  // its front pair forged and the rest passed through untouched.
  const uint32_t used = channel_count < 2u ? 1u : 2u;

  if (state->sample_rate != sample_rate) {
    state->sample_rate = sample_rate;
    build_meter_bands(state, sample_rate);
  }

  const double split_hz = clamp(settings->split_hz, kMinSplitHz, kMaxSplitHz);
  const FeqBiquadCoefficients lowpass = feq_biquad_coefficients(
      FEQ_FILTER_LPQ, split_hz, 0.0, kButterworthQ, sample_rate);
  // One stage here and two above: the octave of a 50 Hz note lands exactly on
  // this corner, and a 4th-order one would take 6 dB off the thing the
  // generator exists to make. One stage is still 12 dB down at 12 Hz, which is
  // what the filter is for — an amplifier will try to reproduce infrasound,
  // and a woofer will move a long way doing it.
  const FeqBiquadCoefficients highpass = feq_biquad_coefficients(
      FEQ_FILTER_HPQ, kSubHighPassHz, 0.0, kButterworthQ, sample_rate);

  const double smooth = smoothing(kParameterSmoothingMs, sample_rate);
  const double window = smoothing(kLevelWindowMs, sample_rate);
  const double attack = smoothing(kDividerAttackMs, sample_rate);
  const double release = smoothing(kDividerReleaseMs, sample_rate);
  const double dc_pole = std::exp((-2.0 * kPi * kGeneratedDcHz) / sample_rate);

  const double drive_db = clamp(settings->drive_db, 0.0, kMaxDriveDb);
  const double target_drive = std::pow(10.0, drive_db / 20.0);
  // Through the curve's own mapping rather than a scale invented here.
  // `feq_fuzz_drive` is where the 0.72 ceiling and the 1.6 power are argued,
  // and the reason the ceiling is not 1 — intermodulation between partials —
  // applies at least as hard to a band carrying an octave and its harmonics.
  const double target_saturation = feq_fuzz_drive(drive_db / kMaxDriveDb);
  const double target_sub = clamp(settings->sub_amount, 0.0, 1.0);
  const double target_presence = clamp(settings->presence_amount, 0.0, 1.0);
  const double target_texture = clamp(settings->texture, 0.0, 1.0);
  const double target_mix = clamp(settings->mix, 0.0, 1.0);
  if (state->mix < 0.0) {
    state->drive = target_drive;
    state->saturation = target_saturation;
    state->sub_amount = target_sub;
    state->presence_amount = target_presence;
    state->texture = target_texture;
    state->mix = target_mix;
  }

  // The low band, per channel. The caller's buffer is not touched yet: the
  // output is written as `input + (forged band - dry band)`, and it is that
  // form rather than `rest + forged band` which makes a mix of zero come back
  // bit for bit instead of within a rounding of itself.
  for (uint32_t channel = 0; channel < used; ++channel) {
    float* band = state->low + channel * frames;
    for (uint32_t at = 0; at < frames; ++at) {
      band[at] = channels[channel][at];
    }
    feq_biquad_process(&state->split[channel][0], band, frames, &lowpass);
    feq_biquad_process(&state->split[channel][1], band, frames, &lowpass);
  }

  /**
   * The divider: a flip-flop on the rising zero crossings, times the rectified
   * band.
   *
   * `|x|` rather than a smoothed envelope — the shape a BOSS OC-2 makes — for
   * two reasons. A follower fast enough to keep up with a bass note ripples at
   * twice the note, and that ripple times the square is amplitude modulation
   * with sidebands the lowpass below cannot reach; and `|x|` carries the
   * note's own dynamics into the octave, where a follower would flatten them
   * into a square of constant height.
   *
   * It is monophonic and tracks the loudest partial of a chord, as every
   * analogue divider ever sold does, which is why `sub_amount` blends rather
   * than replaces. The crossings are read before Drive because a positive gain
   * cannot move one.
   */
  float* octave = state->scratch;
  float* source = state->scratch + frames;
  const float* low_left = state->low;
  const float* low_right = state->low + (used == 2u ? frames : 0u);
  for (uint32_t at = 0; at < frames; ++at) {
    const double mono = (static_cast<double>(low_left[at]) +
                         static_cast<double>(low_right[at])) *
                        0.5;
    source[at] = static_cast<float>(mono);
    const int positive = mono > 0.0 ? 1 : 0;
    if (positive != 0 && state->positive == 0) {
      state->flipped = state->flipped != 0 ? 0 : 1;
    }
    state->positive = positive;
    const double rectified = std::fabs(mono);
    octave[at] =
        static_cast<float>(state->flipped != 0 ? -rectified : rectified);
  }
  // Band-limited, so what leaves is an octave rather than a square wave's
  // whole harmonic series sitting on top of the note it came from.
  feq_biquad_process(&state->divider_low[0], octave, frames, &lowpass);
  feq_biquad_process(&state->divider_low[1], octave, frames, &lowpass);
  feq_biquad_process(&state->divider_high, octave, frames, &highpass);

  for (uint32_t at = 0; at < frames; ++at) {
    state->drive += (target_drive - state->drive) * smooth;
    state->saturation += (target_saturation - state->saturation) * smooth;
    state->sub_amount += (target_sub - state->sub_amount) * smooth;
    state->presence_amount +=
        (target_presence - state->presence_amount) * smooth;
    state->texture += (target_texture - state->texture) * smooth;
    state->mix += (target_mix - state->mix) * smooth;

    const double mono = static_cast<double>(source[at]);

    // Drive's smaller job: where the floor sits. A linear gain cannot change
    // what either generator produces, so this multiplication reaches the audio
    // through the threshold below and nowhere else — at 0 dB the octave
    // appears only under loud notes, at 12 dB it follows the quiet ones down.
    // The colour Drive actually carries is applied further down.
    const double driven = mono * state->drive;
    const double square = driven * driven;
    const double coefficient =
        square > state->divider_mean_square ? attack : release;
    state->divider_mean_square +=
        (square - state->divider_mean_square) * coefficient;
    const double level = std::sqrt(2.0 * state->divider_mean_square);
    // A ramp not a threshold, fully open at twice the floor: the divider fades
    // in under a note instead of switching on inside one.
    const double open = clamp((level - kDividerFloor) / kDividerFloor, 0.0, 1.0);
    state->divider_gate += (open - state->divider_gate) * smooth;

    // Matched onto the band, then gated, in that order: the match has to keep
    // seeing the divider run or it goes stale every time the gate shuts.
    const double raw = static_cast<double>(octave[at]);
    state->source_mean_square +=
        (mono * mono - state->source_mean_square) * window;
    state->octave_mean_square +=
        (raw * raw - state->octave_mean_square) * window;
    if (state->octave_mean_square > kEnergyFloor) {
      const double matched = std::sqrt(state->source_mean_square /
                                       state->octave_mean_square);
      const double target =
          matched < kSubGainCeiling ? matched : kSubGainCeiling;
      state->sub_gain += (target - state->sub_gain) * smooth;
    }
    const double sub = raw * state->sub_gain * state->divider_gate;

    // Harmonics only: `feq_harmonic_sample` returns no foundation, and adding
    // one would be a second copy of the band under the band.
    const double shaped =
        feq_harmonic_sample(&state->harmonic, mono, state->presence_amount,
                            state->texture, sample_rate);
    const double forged = sub * state->sub_amount + shaped;

    /**
     * Drive, and both halves of where it goes are forced rather than chosen.
     *
     * HERE, because in front of the generators a non-linearity has nothing to
     * bite on (see the header) and behind the normaliser it would be undone.
     * Between the two is the one place a curve survives and stays honest.
     *
     * At a NORMALISED level, because `feq_saturate_sample` bends by
     * `sample * drive`: fed an absolute amplitude the colour would follow the
     * programme, which is the defect `harmonics.h` was written to remove from
     * the Exciter arriving by the back door. Measured before the division, 12
     * dB on a -20 dBFS note moved the output by 0.9% — the generated content
     * was around 0.1 and a tangent barely bends there. After it, 11%, and the
     * same 11% at any listening level.
     *
     * No oversampling, unlike the EQ's colour path: what is shaped is an
     * octave at 30 Hz and harmonics that stop near 600, so the orders this
     * adds land in the low kilohertz, nowhere near a folding boundary.
     */
    double coloured = forged;
    if (state->saturation > kSaturationFloor) {
      const double colour_level =
          std::fmax(std::sqrt(2.0 * state->source_mean_square), kColourFloor);
      const double unity =
          feq_saturate_sample(kUnityProbe, state->saturation) / kUnityProbe;
      coloured =
          (feq_saturate_sample(forged / colour_level, state->saturation) *
           colour_level) /
          unity;
    }

    state->dc_output =
        coloured - state->dc_input + dc_pole * state->dc_output;
    state->dc_input = coloured;

    const double added = state->dc_output * state->mix;

    double dry[2] = {0.0, 0.0};
    double wet[2] = {0.0, 0.0};
    double square_low = 0.0;
    double square_wet = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      dry[channel] = static_cast<double>(state->low[channel * frames + at]);
      wet[channel] = dry[channel] + added;
      square_low += dry[channel] * dry[channel];
      square_wet += wet[channel] * wet[channel];
    }

    // The no-free-loudness rule, as a gain on the whole band rather than on
    // what was added to it. Scaling the addition holds at full mix and nowhere
    // else; scaling the band holds everywhere, and it makes a mix of zero
    // exact rather than close — the two mean squares are then fed identical
    // numbers, so the ratio is one to the last bit.
    state->low_mean_square += (square_low - state->low_mean_square) * window;
    state->wet_mean_square += (square_wet - state->wet_mean_square) * window;
    const double target_gain =
        state->wet_mean_square > kEnergyFloor
            ? std::sqrt(state->low_mean_square / state->wet_mean_square)
            : 1.0;
    state->gain += (target_gain - state->gain) * smooth;

    double forged_band = 0.0;
    for (uint32_t channel = 0; channel < used; ++channel) {
      const double band = wet[channel] * state->gain;
      forged_band += band;
      channels[channel][at] = static_cast<float>(
          static_cast<double>(channels[channel][at]) + (band - dry[channel]));
    }
    forged_band /= static_cast<double>(used);

    for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
      const double before =
          run_stage(&state->meter_input[band], state->meter_coefficients[band],
                    mono);
      state->meter_input_mean_square[band] +=
          (before * before - state->meter_input_mean_square[band]) * window;
      const double after =
          run_stage(&state->meter_output[band], state->meter_coefficients[band],
                    forged_band);
      state->meter_output_mean_square[band] +=
          (after * after - state->meter_output_mean_square[band]) * window;
    }
  }
}

void feq_bass_forge_bands(const FeqBassForge* state, double* input_db,
                          double* output_db) {
  if (state == nullptr || input_db == nullptr || output_db == nullptr) {
    return;
  }
  for (uint32_t band = 0; band < FEQ_BASS_FORGE_BANDS; ++band) {
    input_db[band] = level_db(state->meter_input_mean_square[band]);
    output_db[band] = level_db(state->meter_output_mean_square[band]);
  }
}

}  // extern "C"

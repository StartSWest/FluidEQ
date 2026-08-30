/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Broadband suppression against a measured floor.
 *
 * Decision-directed a priori SNR (Ephraim & Malah, 1984) driving a Wiener
 * gain. NOT spectral subtraction, and the difference is the whole reason this
 * file is longer than four lines: subtraction decides each bin of each frame
 * independently, so bins near the floor flicker between passed and removed,
 * and a few hundred of them flickering at the frame rate is a warbling tone
 * with no pitch — musical noise, and the thing that makes a bad denoiser
 * instantly recognisable. The decision-directed estimate carries the previous
 * frame's decision into this one, so a bin that was signal stays signal unless
 * the evidence really moved.
 */

#include <algorithm>
#include <cmath>
#include <cstring>

#include "denoise_internal.h"
#include "fluideq/convolver.h"

namespace {

constexpr double kPi = 3.14159265358979323846;

/**
 * Bias compensation for the minimum-statistics floor.
 *
 * The minimum of a set of noisy power estimates sits well below their mean —
 * that is what makes it useful as a floor and also what makes it wrong as one.
 * Martin derives the correction from the number of frames averaged; at this
 * window count it lands near a factor of two, and two is used rather than the
 * full derivation because the error it leaves is under a decibel while the
 * sensitivity dial covers a range twenty times that.
 */
constexpr double kMinimumStatisticsBias = 2.0;

/** How long the running minimum looks back, in seconds. */
constexpr double kMinimumWindowSeconds = 1.5;

/** Below this a level is treated as silence rather than as a number. */
constexpr double kFloorEpsilon = 1e-30;

/**
 * What a periodic Hann window squared sums to at a quarter-length hop.
 *
 * Analysis and synthesis both window, so the overlap-add sums w² rather than
 * w. Mean of w² over a period is 3/8, and four overlapping frames put
 * 4 x 3/8 = 3/2 into every output sample. Dividing it back out is what makes
 * an unmodified signal come through this at unity instead of 3.5 dB hot.
 */
constexpr double kHannSquaredOverlapSum = 1.5;

double db_to_power(double db) { return std::pow(10.0, db / 10.0); }

/**
 * The decision-directed smoothing constant, from the dial.
 *
 * The useful range is narrow and entirely in the last few percent: 0.9 already
 * carries most of a frame's decision forward, and past 0.998 the estimator
 * stops responding to the music at all. A linear dial mapped straight onto the
 * constant would spend nine tenths of its travel in territory that sounds
 * identical.
 */
double smoothing_alpha(double smoothing) {
  const double clamped = std::min(1.0, std::max(0.0, smoothing));
  return 0.9 + 0.098 * clamped;
}

}  // namespace

void denoise_spectral_configure(FeqDenoise* denoise) {
  // Chosen in milliseconds and then rounded to the power of two the transform
  // needs, so 44.1 and 48 kHz land on the same size and 96 kHz takes the next
  // one up rather than half the time resolution.
  const double target = denoise->sample_rate * kDenoiseWindowMs / 1000.0;
  uint32_t window = 64;
  while (window < target) {
    window *= 2;
  }
  // Round to the nearer power of two rather than always upward: at 48 kHz the
  // target is 1022, and rounding up would spend a doubled window on a 0.2%
  // overshoot.
  if (window > 64 && (window - target) > (target - window / 2)) {
    window /= 2;
  }

  const bool resized = window != denoise->window;
  denoise->window = window;
  denoise->hop = window / kDenoiseOverlap;

  if (resized) {
    denoise->window_shape.assign(window, 0.0);
    denoise->window_energy = 0.0;
    for (uint32_t i = 0; i < window; i += 1) {
      // Periodic Hann. Squared and hopped at a quarter of its length it sums
      // to a constant, which is what makes analysis-then-synthesis windowing
      // reconstruct the signal instead of amplitude-modulating it.
      const double value =
          0.5 - 0.5 * std::cos(2.0 * kPi * static_cast<double>(i) /
                               static_cast<double>(window));
      denoise->window_shape[i] = value;
      denoise->window_energy += value * value;
    }
    const uint32_t bins = window / 2 + 1;
    denoise->spectral.resize(denoise->channels);
    for (auto& channel : denoise->spectral) {
      channel.input.assign(window, 0.0f);
      channel.output.assign(window, 0.0f);
      channel.real.assign(window, 0.0);
      channel.imaginary.assign(window, 0.0);
      channel.previous_gain.assign(bins, 1.0);
      channel.previous_magnitude.assign(bins, 0.0);
      channel.adaptive_db.assign(bins, kDenoiseSilenceDb);
      channel.running_minimum.assign(bins, 0.0);
      channel.fill = 0;
      channel.minimum_age = 0;
    }
    denoise->profile_bins_valid = false;
  }

  // The profile arrives in quarter-octave bands and is consumed per bin.
  // Interpolating once per configure rather than once per frame is forty log
  // calls instead of forty thousand a second.
  if (!denoise->profile_bins_valid && denoise->window > 0) {
    const uint32_t bins = denoise->window / 2 + 1;
    denoise->profile_bins_db.assign(bins, kDenoiseSilenceDb);
    for (uint32_t bin = 0; bin < bins; bin += 1) {
      const double hz = static_cast<double>(bin) * denoise->sample_rate /
                        static_cast<double>(denoise->window);
      denoise->profile_bins_db[bin] =
          feq_denoise_profile_level_at(denoise->profile.bands_db, hz);
    }
    denoise->profile_bins_valid = true;
  }
}

void denoise_spectral_reset(FeqDenoise* denoise) {
  for (auto& channel : denoise->spectral) {
    std::fill(channel.input.begin(), channel.input.end(), 0.0f);
    std::fill(channel.output.begin(), channel.output.end(), 0.0f);
    std::fill(channel.previous_gain.begin(), channel.previous_gain.end(), 1.0);
    std::fill(channel.previous_magnitude.begin(),
              channel.previous_magnitude.end(), 0.0);
    std::fill(channel.adaptive_db.begin(), channel.adaptive_db.end(),
              kDenoiseSilenceDb);
    std::fill(channel.running_minimum.begin(), channel.running_minimum.end(),
              0.0);
    channel.fill = 0;
    channel.minimum_age = 0;
  }
}

namespace {

/**
 * The expected power in one bin, for the noise the profile describes.
 *
 * The profile is a density — power per hertz — so that a floor measured at
 * 44.1 kHz with one transform size still means the same thing to a different
 * transform running at 48. Turning it back into a bin power needs both the
 * window's energy and the bin width, and getting either wrong tilts the whole
 * subtraction without looking wrong on a plot.
 */
double profile_bin_power(const FeqDenoise* denoise, uint32_t bin) {
  const double density_db = denoise->profile_bins_db[bin];
  if (density_db <= kDenoiseSilenceDb) {
    return kFloorEpsilon;
  }
  /*
   * E[|X[k]|^2] = sigma^2 * sum(w^2), and sigma^2 = density * (fs/2).
   *
   * The bandwidth in that second term is the whole one-sided band, NOT the
   * width of one bin. It is genuinely tempting to reach for the bin width —
   * the quantity being computed is per-bin — and it is wrong by a factor of
   * N/2, which at a 1024-point window is 27 dB of floor the module then never
   * subtracts. It measured as a denoiser that ran, reported plausible gains,
   * and removed nothing.
   */
  return db_to_power(density_db) * denoise->sample_rate * 0.5 *
         denoise->window_energy;
}

/**
 * One frame: analyse, decide a gain per bin, synthesise.
 *
 * Returns the mean gain over the bins in dB, which is what the panel reports —
 * derived from the gains actually applied rather than from the settings,
 * because how much a subtractor removes depends on the material and the dials
 * cannot say.
 */
double process_frame(FeqDenoise* denoise,
                     DenoiseSpectralChannel& channel,
                     uint32_t minimum_window_frames) {
  const uint32_t window = denoise->window;
  const uint32_t hop = denoise->hop;
  const uint32_t bins = window / 2 + 1;
  const auto& hiss = denoise->settings.hiss;

  for (uint32_t i = 0; i < window; i += 1) {
    channel.real[i] =
        static_cast<double>(channel.input[i]) * denoise->window_shape[i];
    channel.imaginary[i] = 0.0;
  }
  feq_fft_in_place(channel.real.data(), channel.imaginary.data(), window, 0);

  const double alpha = smoothing_alpha(hiss.smoothing);
  const double sensitivity_power = db_to_power(hiss.sensitivity_db);
  const double floor_gain = std::pow(10.0, hiss.floor_db / 20.0);
  const double amount = std::min(1.0, std::max(0.0, hiss.amount));
  // Falling back rather than refusing: a track that has never been analyzed
  // has the control set to Scanned and no profile behind it, and the panel
  // says which one is actually running.
  const bool adaptive =
      denoise->settings.profile_source == FEQ_DENOISE_PROFILE_ADAPTIVE ||
      !denoise->profile_ready;

  double gain_db_sum = 0.0;

  for (uint32_t bin = 0; bin < bins; bin += 1) {
    const double re = channel.real[bin];
    const double im = channel.imaginary[bin];
    const double power = re * re + im * im;

    // The live floor is tracked whether or not it is the one in use, so that
    // switching the control mid-track does not wait a second and a half for
    // an estimate to warm up.
    if (channel.minimum_age == 0 || power < channel.running_minimum[bin]) {
      channel.running_minimum[bin] = power;
    }

    double noise_power = adaptive
                             ? (channel.adaptive_db[bin] <= kDenoiseSilenceDb
                                    ? kFloorEpsilon
                                    : db_to_power(channel.adaptive_db[bin]))
                             : profile_bin_power(denoise, bin);
    noise_power = std::max(kFloorEpsilon, noise_power * sensitivity_power);

    const double posterior = power / noise_power;
    const double previous_clean =
        channel.previous_gain[bin] * channel.previous_magnitude[bin];
    const double a_priori =
        alpha * (previous_clean * previous_clean / noise_power) +
        (1.0 - alpha) * std::max(0.0, posterior - 1.0);

    double gain = a_priori / (1.0 + a_priori);
    // Amount interpolates toward unity rather than scaling the gain, so half
    // strength leaves half the reduction rather than half the signal.
    gain = 1.0 - amount * (1.0 - gain);
    gain = std::max(floor_gain, std::min(1.0, gain));

    channel.previous_gain[bin] = gain;
    channel.previous_magnitude[bin] = std::sqrt(power);

    channel.real[bin] = re * gain;
    channel.imaginary[bin] = im * gain;
    // Hermitian mirror, so the inverse transform comes back real. Bin 0 and
    // the Nyquist bin have no partner and must not be touched twice.
    if (bin > 0 && bin < window / 2) {
      channel.real[window - bin] *= gain;
      channel.imaginary[window - bin] *= gain;
    }

    gain_db_sum += 20.0 * std::log10(std::max(1e-6, gain));
  }

  channel.minimum_age += 1;
  if (channel.minimum_age >= minimum_window_frames) {
    for (uint32_t bin = 0; bin < bins; bin += 1) {
      const double compensated =
          channel.running_minimum[bin] * kMinimumStatisticsBias;
      channel.adaptive_db[bin] = compensated > kFloorEpsilon
                                     ? 10.0 * std::log10(compensated)
                                     : kDenoiseSilenceDb;
    }
    channel.minimum_age = 0;
  }

  feq_fft_in_place(channel.real.data(), channel.imaginary.data(), window, 1);

  // Shift the accumulator down by one hop and clear the tail BEFORE adding
  // this frame, so the samples about to be emitted have already received
  // every contribution that overlaps them.
  std::memmove(channel.output.data(), channel.output.data() + hop,
               (window - hop) * sizeof(float));
  std::fill(channel.output.begin() + (window - hop), channel.output.end(),
            0.0f);

  const double scale =
      1.0 / (static_cast<double>(window) * kHannSquaredOverlapSum);
  for (uint32_t i = 0; i < window; i += 1) {
    // Windowed on the way out as well as in: weighted overlap-add, because a
    // frame whose bins were modified no longer joins its neighbours smoothly
    // and would step at its edges without it.
    channel.output[i] += static_cast<float>(channel.real[i] * scale *
                                            denoise->window_shape[i]);
  }

  std::memmove(channel.input.data(), channel.input.data() + hop,
               (window - hop) * sizeof(float));

  return gain_db_sum / static_cast<double>(bins);
}

}  // namespace

double denoise_spectral_process(FeqDenoise* denoise,
                                float* const* channels,
                                uint32_t frames) {
  if (denoise->settings.hiss.enabled == 0 || denoise->window == 0) {
    return 0.0;
  }

  const uint32_t window = denoise->window;
  const uint32_t hop = denoise->hop;
  const uint32_t minimum_window_frames = std::max(
      1u, static_cast<uint32_t>(kMinimumWindowSeconds * denoise->sample_rate /
                                static_cast<double>(hop)));

  double gain_db_total = 0.0;
  uint32_t gain_frames = 0;

  for (uint32_t c = 0; c < denoise->channels; c += 1) {
    DenoiseSpectralChannel& channel = denoise->spectral[c];
    float* buffer = channels[c];
    for (uint32_t i = 0; i < frames; i += 1) {
      channel.input[window - hop + channel.fill] = buffer[i];
      buffer[i] = channel.output[channel.fill];
      channel.fill += 1;
      if (channel.fill == hop) {
        gain_db_total += process_frame(denoise, channel, minimum_window_frames);
        gain_frames += 1;
        channel.fill = 0;
      }
    }
  }

  return gain_frames == 0 ? 0.0
                          : gain_db_total / static_cast<double>(gain_frames);
}

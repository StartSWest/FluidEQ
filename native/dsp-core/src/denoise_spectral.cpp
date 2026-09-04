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
#include <limits>

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

/**
 * How long the periodogram is smoothed for before its minimum is taken.
 *
 * Long enough to collapse the exponential scatter of a noise bin, short enough
 * that a note ending still shows up as a dip inside the look-back window.
 * Without it the tracker read a steady tone as noise and fluctuating noise as
 * signal, which is the exact inverse of its job.
 *
 * In SECONDS, and that is the point of the change. This was a bare per-frame
 * retain factor of 0.9, which is fifty milliseconds only while the hop happens
 * to be 256 samples at 48 kHz. A constant like that quietly means something
 * different the moment the window or the overlap moves, and both just moved.
 */
constexpr double kMinimumSmoothingSeconds = 0.05;

/** How far back the minimum looks, in seconds. */
constexpr double kMinimumWindowSeconds = 1.5;

/**
 * How many subwindows that look-back is cut into.
 *
 * The estimate refreshes once per subwindow rather than once per look-back, so
 * this is the difference between a floor that steps every 125 ms and one that
 * steps every 1.5 s. Twelve leaves a step small enough for the glide below to
 * absorb; many more and each subwindow holds too few frames for its own
 * minimum to mean anything.
 */
constexpr uint32_t kMinimumSubwindows = 12;

/**
 * How long the published floor takes to reach a new estimate.
 *
 * The subwindows leave a staircase with 125 ms treads. Gliding between them
 * makes the floor continuous in time, which is what the gain computation
 * actually wants: every discontinuity in the floor is a discontinuity in every
 * gain derived from it, and several hundred gains stepping on the same frame
 * is the click that reads as digital.
 *
 * Symmetric. An estimate too high eats programme and one too low leaks hiss;
 * neither is bad enough to be worth a dial nobody could set.
 */
constexpr double kFloorGlideSeconds = 0.12;

/**
 * How far the a priori SNR is smoothed across neighbouring bins.
 *
 * The decision-directed estimator smooths each bin along TIME, which is what
 * stops a bin flickering between passed and removed frame to frame. Nothing
 * was smoothing along FREQUENCY, so neighbouring bins still took independent
 * decisions and the residual noise came out sculpted into isolated tonal
 * specks — musical noise, heard as a digital edge rather than as air.
 *
 * Three taps at 1/4, 1/2, 1/4. At 23.4 Hz bins that is plus or minus a
 * twentieth of a semitone at 1 kHz, far too narrow to blunt a real partial,
 * and enough to stop one bin being suppressed while the bin beside it is not.
 */
constexpr double kPrioriSideTap = 0.25;

/**
 * The lowest a priori SNR the recursion is allowed to reach. -25 dB.
 *
 * Not a taste setting — it is what stops the estimator having a fixed point at
 * zero. The canonical value in the literature, and below any reduction limit
 * the panel offers, so it bounds the recursion without ever deciding what
 * comes out of the stage.
 */
constexpr double kPrioriFloor = 0.00316;

/** Below this a level is treated as silence rather than as a number. */
constexpr double kFloorEpsilon = 1e-30;

/** What a history slot holds before a subwindow has ever been stored in it. */
constexpr double kUnfilledSlot = std::numeric_limits<double>::infinity();

/**
 * Where the stage stops working, and where it is working fully. See
 * `hiss_weight` for why it has to stop at all.
 *
 * Sixty hertz is under the lowest note of a bass guitar and an octave below
 * where a kick carries. Between the two the reduction is raised-cosine in LOG
 * frequency, so the taper is a constant number of octaves rather than a
 * constant number of hertz — a linear ramp across the same span would be
 * nearly finished by 80 Hz and audible as a shelf.
 *
 * The upper end was 300 and is 500 because moving it is free. Measured on
 * bass-heavy material, it takes 2.9 dB off what the stage removes below
 * 300 Hz and costs nothing whatsoever above 1 kHz, which is where audible
 * hiss actually is. Music's fundamental energy peaks between 80 and 250 Hz,
 * so this is the loudest part of the programme and the least valuable place
 * to be subtracting anything.
 */
constexpr double kHissSilentBelowHz = 60.0;
constexpr double kHissFullAboveHz = 500.0;

/**
 * How far the residual floor is flattened toward white. 0 none, 1 flat.
 *
 * What is LEFT after a denoiser runs is as much of the sound as what is taken,
 * and a flat gain limit leaves a residue with the same spectral shape the
 * noise had — a dull, coloured bed that the ear reads as a processed
 * background rather than as air. Attenuating each bin toward a COMMON residual
 * level instead leaves white noise behind, which is what a listener hears as
 * tape or room rather than as an artefact. The professional tools expose this
 * as a Whitening control; here it is a constant until it earns a dial.
 *
 * Not 1.0. Fully flattening means the quietest bins of the noise are barely
 * attenuated at all, and at high reduction that reads as the floor rising in
 * places. Three quarters keeps most of the benefit and none of that.
 */
constexpr double kWhitening = 0.75;

/**
 * What a periodic Hann window squared sums to at this overlap.
 *
 * Analysis and synthesis both window, so the overlap-add sums w² rather than
 * w. Mean of w² over a period is 3/8, and M overlapping frames put M x 3/8
 * into every output sample. Dividing it back out is what makes an unmodified
 * signal come through at unity instead of hot.
 *
 * Derived from the overlap rather than written as a number. It was 1.5 —
 * correct for the hop of the day — and left as a literal the overlap change
 * would have come out 3 dB loud with nothing in the file pointing at why.
 */
constexpr double kHannSquaredOverlapSum = 0.375 * kDenoiseOverlap;

/**
 * The fraction of the way to a target that one frame travels.
 *
 * Expressed from a time constant in seconds and the frame rate, so that every
 * smoother in this file keeps its meaning when the hop changes.
 */
double approach_per_frame(double frames_per_second, double seconds) {
  if (frames_per_second <= 0.0 || seconds <= 0.0) {
    return 1.0;
  }
  return 1.0 - std::exp(-1.0 / (frames_per_second * seconds));
}

/**
 * E1(v), the exponential integral, to the accuracy this needs and no more.
 *
 * Abramowitz & Stegun 5.1.53 below one and 5.1.56 above it: a polynomial good
 * to 2e-7 and a rational good to 5e-5. Both are far inside what a gain in
 * decibels can express — the second is worth 0.0004 dB at the worst point —
 * and the alternative is a series that has to be iterated on the audio thread.
 */
double exponential_integral(double v) {
  if (v <= 1.0) {
    return -std::log(v) - 0.57721566 +
           v * (0.99999193 +
                v * (-0.24991055 +
                     v * (0.05519968 + v * (-0.00976004 + v * 0.00107857))));
  }
  const double numerator = v * v + 2.334733 * v + 0.250621;
  const double denominator = v * v + 3.330657 * v + 1.681534;
  return std::exp(-v) * numerator / (denominator * v);
}

/**
 * The MMSE log-spectral amplitude gain (Ephraim & Malah, 1985).
 *
 * Not the Wiener gain, which is what this was. Wiener minimises the error in
 * the amplitude; LSA minimises it in the LOG amplitude, which is the domain
 * the ear works in — and the practical consequence is well known and is
 * exactly the complaint this stage drew: far less musical noise, because the
 * two estimators disagree most about the borderline bins hovering around the
 * floor, and those are precisely the bins whose flickering IS musical noise.
 *
 * It is the gentler of the two everywhere (the exponential factor is never
 * below one), so bins that are plainly noise still land on the reduction limit
 * and the audible difference is confined to the transition. That is the whole
 * point of the change.
 */
double lsa_gain(double a_priori, double posterior) {
  const double ratio = a_priori / (1.0 + a_priori);
  const double v = ratio * posterior;
  if (v >= 30.0) {
    // E1(30) is 3e-15. The correction is one part in 1e15 — below what a
    // double can carry into the multiply, never mind what anyone can hear.
    return ratio;
  }
  if (v <= 1e-12) {
    // The integral diverges as v goes to zero and the gain is meaningless
    // there; the clamp below would take it anyway.
    return 1.0;
  }
  return std::min(1.0, ratio * std::exp(0.5 * exponential_integral(v)));
}

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
      channel.subwindow_minimum.assign(bins, 0.0);
      // Infinity, not zero: a slot that has never held a subwindow must not
      // take part in the minimum, and zero would win it outright and pin the
      // floor at silence until every slot had been written once.
      channel.subwindow_history.assign(
          static_cast<size_t>(bins) * kMinimumSubwindows, kUnfilledSlot);
      channel.history_minimum.assign(bins, kUnfilledSlot);
      channel.smoothed_power.assign(bins, 0.0);
      channel.priori.assign(bins, 0.0);
      channel.posterior.assign(bins, 0.0);
      channel.log_noise.assign(bins, std::log(kFloorEpsilon));
      channel.fill = 0;
      channel.subwindow_age = 0;
      channel.subwindow_slot = 0;
      channel.primed = false;
      channel.floor_ready = false;
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

  // Recomputed every configure rather than only on a resize: it depends on the
  // sample rate as well as the window, and 44.1 and 48 kHz share a window size
  // — so a rate change with no resize would silently keep the previous rate's
  // frequencies.
  if (denoise->window > 0) {
    const uint32_t bins = denoise->window / 2 + 1;
    denoise->hiss_weight.assign(bins, 1.0);
    const double span =
        std::log(kHissFullAboveHz / kHissSilentBelowHz);
    for (uint32_t bin = 0; bin < bins; bin += 1) {
      const double hz = static_cast<double>(bin) * denoise->sample_rate /
                        static_cast<double>(denoise->window);
      if (hz <= kHissSilentBelowHz) {
        denoise->hiss_weight[bin] = 0.0;
      } else if (hz < kHissFullAboveHz) {
        const double t = std::log(hz / kHissSilentBelowHz) / span;
        denoise->hiss_weight[bin] = 0.5 - 0.5 * std::cos(kPi * t);
      }
    }
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
    std::fill(channel.subwindow_minimum.begin(),
              channel.subwindow_minimum.end(), 0.0);
    std::fill(channel.subwindow_history.begin(),
              channel.subwindow_history.end(), kUnfilledSlot);
    std::fill(channel.history_minimum.begin(), channel.history_minimum.end(),
              kUnfilledSlot);
    std::fill(channel.smoothed_power.begin(), channel.smoothed_power.end(),
              0.0);
    std::fill(channel.priori.begin(), channel.priori.end(), 0.0);
    std::fill(channel.posterior.begin(), channel.posterior.end(), 0.0);
    std::fill(channel.log_noise.begin(), channel.log_noise.end(),
              std::log(kFloorEpsilon));
    channel.fill = 0;
    channel.subwindow_age = 0;
    channel.subwindow_slot = 0;
    channel.primed = false;
    channel.floor_ready = false;
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
/**
 * Everything about this stage that is measured in time rather than in frames.
 *
 * Computed once per callback from the hop, so that the constants above keep
 * meaning what they say when the window or the overlap changes. They did not:
 * a bare 0.9 retain factor and a frame count derived at one hop were both
 * silently redefined by the overlap moving from four to eight.
 */
struct SpectralTiming {
  uint32_t subwindow_frames;
  double power_approach;
  double floor_glide;
};

double process_frame(FeqDenoise* denoise,
                     DenoiseSpectralChannel& channel,
                     const SpectralTiming& timing) {
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
  const bool scanned_waiting =
      denoise->settings.profile_source == FEQ_DENOISE_PROFILE_SCANNED &&
      !denoise->profile_ready;
  // Scanned is a frozen measurement, never a request to learn live. Until the
  // user explicitly scans this track, keep the overlap-add path transparent.
  // The adaptive estimator may still warm silently so switching to Adaptive
  // is immediate, but none of its gain reaches the audio in Scanned mode.
  const double amount =
      scanned_waiting
          ? 0.0
          : std::min(1.0, std::max(0.0, hiss.amount));
  const bool adaptive =
      denoise->settings.profile_source == FEQ_DENOISE_PROFILE_ADAPTIVE ||
      !denoise->profile_ready;

  double gain_db_sum = 0.0;
  double log_noise_sum = 0.0;
  uint32_t log_noise_count = 0;

  /* ------------------------------------------- track the floor, form the SNR */
  for (uint32_t bin = 0; bin < bins; bin += 1) {
    const double re = channel.real[bin];
    const double im = channel.imaginary[bin];
    const double power = re * re + im * im;

    // The live floor is tracked whether or not it is the one in use, so that
    // switching the control mid-track does not wait for an estimate to warm
    // up.
    //
    // Smoothed in time BEFORE the minimum is taken — see `smoothed_power`.
    // Minima of the RAW periodogram estimate fluctuating noise far too low and
    // a steady tone exactly right, which inverts the discrimination the whole
    // method rests on. Seeded with the first frame rather than ramped up from
    // zero, which used to leave a whole look-back window's estimate resting on
    // the ramp instead of on the signal.
    channel.smoothed_power[bin] =
        channel.primed ? channel.smoothed_power[bin] +
                             timing.power_approach *
                                 (power - channel.smoothed_power[bin])
                       : power;
    const double tracked = channel.smoothed_power[bin];
    if (channel.subwindow_age == 0 ||
        tracked < channel.subwindow_minimum[bin]) {
      channel.subwindow_minimum[bin] = tracked;
    }

    /*
     * Glide toward the estimate rather than stepping onto it.
     *
     * The minimum over the closed subwindows AND the one still filling: the
     * closed ones give the look-back its length, the open one is what lets the
     * floor come down the moment the noise does. Nothing is published until a
     * first subwindow has closed, so the stage starts transparent instead of
     * starting from an estimate built out of a few milliseconds.
     */
    if (channel.floor_ready) {
      const double lowest = std::min(channel.history_minimum[bin],
                                     channel.subwindow_minimum[bin]);
      const double compensated = lowest * kMinimumStatisticsBias;
      const double target_db = compensated > kFloorEpsilon
                                   ? 10.0 * std::log10(compensated)
                                   : kDenoiseSilenceDb;
      channel.adaptive_db[bin] +=
          timing.floor_glide * (target_db - channel.adaptive_db[bin]);
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
    /*
     * Floored, and the floor became REQUIRED when the recursion stopped being
     * fed the clamped gain.
     *
     * A bin whose power sits at or under the noise estimate contributes
     * nothing through `max(0, posterior - 1)`, so its a priori SNR is only the
     * last frame's multiplied by alpha — a geometric decay with a fixed point
     * at zero. It used to be held up from underneath by the reduction limit
     * leaking into the recursion, which bounded it by accident and at the cost
     * of the limit changing what the estimator did. Feeding back the Wiener
     * gain removes that accident, so the bound has to be stated: -25 dB, the
     * canonical value, below any limit the panel offers.
     */
    const double a_priori = std::max(
        kPrioriFloor, alpha * (previous_clean * previous_clean / noise_power) +
                          (1.0 - alpha) * std::max(0.0, posterior - 1.0));

    channel.priori[bin] = a_priori;
    channel.posterior[bin] = posterior;
    // Kept as a LOGARITHM, because the only thing it is used for is a ratio
    // raised to a fractional power. In the log domain that is a subtract and
    // one exponential instead of a `pow`, which is a log and an exponential —
    // half the cost, on the audio thread, once per bin per frame.
    channel.log_noise[bin] = std::log(noise_power);
    channel.previous_magnitude[bin] = std::sqrt(power);

    // Only the bins the stage may act on take part in the whitening
    // reference: including the protected bass would drag it toward whatever
    // rumble is down there and shift the limit everywhere else with it.
    if (denoise->hiss_weight[bin] > 0.0) {
      log_noise_sum += channel.log_noise[bin];
      log_noise_count += 1;
    }
  }

  /*
   * The GEOMETRIC mean, which is the level a flat residue would sit at.
   *
   * An arithmetic mean of powers is dominated by whichever bins are loudest,
   * so a single noisy region would set the target for the whole spectrum. The
   * mean of the logs is the same quantity spectral flatness is defined
   * against, and it is what makes "flatten toward this" mean flatten rather
   * than pull everything down to the worst bin.
   *
   * With no bin in reach there is no reference and no whitening — which cannot
   * happen at any real sample rate, and is written down rather than left to a
   * placeholder that would have silently disabled the reduction entirely.
   */
  const bool whitening_ready = log_noise_count > 0;
  const double log_reference =
      whitening_ready ? log_noise_sum / static_cast<double>(log_noise_count)
                      : 0.0;

  /* ------------------------------------------------ decide and apply a gain */
  for (uint32_t bin = 0; bin < bins; bin += 1) {
    // Smoothed across neighbours, using their unsmoothed values — see
    // `kPrioriSideTap`. The edges repeat rather than reflect, which keeps the
    // three taps summing to one there as well.
    const double left = bin == 0 ? channel.priori[0] : channel.priori[bin - 1];
    const double right =
        bin + 1 < bins ? channel.priori[bin + 1] : channel.priori[bins - 1];
    const double a_priori = kPrioriSideTap * left +
                            (1.0 - 2.0 * kPrioriSideTap) * channel.priori[bin] +
                            kPrioriSideTap * right;

    const double estimated = lsa_gain(a_priori, channel.posterior[bin]);
    /*
     * The estimator's own gain goes back into the recursion; the user's goes
     * to the audio. They were the same value, and that was two bugs.
     *
     * Feeding the amount-interpolated, floor-clamped gain back in makes both
     * of those dials parameters of the estimator rather than the blend and the
     * limit they are described as: Amount changed how the a priori SNR itself
     * evolved, so half strength was not half the reduction, and the limit
     * propped the recursion up from underneath instead of bounding what came
     * out of it. Keeping the recursion on the estimator's gain is what makes
     * the four controls mean what the panel says they mean.
     */
    channel.previous_gain[bin] = estimated;

    /*
     * The reduction limit, shaped so that what survives it is flat.
     *
     * A single gain floor everywhere leaves a residue shaped exactly like the
     * noise was. Scaling the floor by each bin's noise against the frame's
     * geometric mean instead aims every bin at a COMMON residual level, so the
     * bed left behind is white — see `kWhitening`. The exponent is half
     * because the floor is an amplitude and the ratio is a power.
     *
     * Clamped to unity: a bin whose noise is far below the reference would
     * otherwise be handed a limit above one, which is not a limit.
     */
    const double whitened_floor =
        whitening_ready
            ? std::min(1.0,
                       floor_gain *
                           std::exp(0.5 * kWhitening *
                                    (log_reference - channel.log_noise[bin])))
            : floor_gain;

    // Amount interpolates toward unity rather than scaling the gain, so half
    // strength leaves half the reduction rather than half the signal. The
    // per-bin weight rides on the same interpolation, so a bin the stage is
    // not allowed to touch lands exactly on unity — see `hiss_weight`.
    double gain = 1.0 - amount * denoise->hiss_weight[bin] * (1.0 - estimated);
    gain = std::max(whitened_floor, std::min(1.0, gain));

    channel.real[bin] *= gain;
    channel.imaginary[bin] *= gain;
    // Hermitian mirror, so the inverse transform comes back real. Bin 0 and
    // the Nyquist bin have no partner and must not be touched twice.
    if (bin > 0 && bin < window / 2) {
      channel.real[window - bin] *= gain;
      channel.imaginary[window - bin] *= gain;
    }

    gain_db_sum += 20.0 * std::log10(std::max(1e-6, gain));
  }

  channel.primed = true;
  channel.subwindow_age += 1;
  if (channel.subwindow_age >= timing.subwindow_frames) {
    /*
     * Close the subwindow: store its minimum, retire the oldest, take the
     * minimum across what remains.
     *
     * Retiring is the half a single running minimum could not do. A block
     * minimum only ever falls until the block ends, so a stage that met a
     * rising noise floor over-suppressed until the block boundary and then
     * snapped — 1.5 seconds of it, which is what was heard as sticky.
     */
    for (uint32_t bin = 0; bin < bins; bin += 1) {
      channel.subwindow_history[static_cast<size_t>(bin) * kMinimumSubwindows +
                                channel.subwindow_slot] =
          channel.subwindow_minimum[bin];
    }
    channel.subwindow_slot =
        (channel.subwindow_slot + 1) % kMinimumSubwindows;
    channel.floor_ready = true;
    for (uint32_t bin = 0; bin < bins; bin += 1) {
      const double* slots =
          &channel.subwindow_history[static_cast<size_t>(bin) *
                                     kMinimumSubwindows];
      double lowest = slots[0];
      for (uint32_t slot = 1; slot < kMinimumSubwindows; slot += 1) {
        lowest = std::min(lowest, slots[slot]);
      }
      channel.history_minimum[bin] = lowest;
    }
    channel.subwindow_age = 0;
  }

  /*
   * The floor the panel draws, in the profile's own density units.
   *
   * Published from whichever source actually decided the gains above, not from
   * the profile the stage was handed — in Adaptive those differ every frame,
   * and a picture of the handed-over value would show a flat line while the
   * tracker moved underneath it.
   *
   * Converted back to a density here, which is the inverse of what
   * `profile_bin_power` does on the way in, so the drawing code needs one path
   * for both sources rather than two that must agree.
   */
  if (!denoise->live_floor_db.empty()) {
    const double bin_width =
        denoise->sample_rate / static_cast<double>(window);
    const double reference = denoise->sample_rate * 0.5 * denoise->window_energy;
    for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
      const double centre = feq_denoise_band_hz(band);
      const uint32_t bin = static_cast<uint32_t>(
          std::min(static_cast<double>(bins - 1),
                   std::max(0.0, centre / bin_width)));
      const double bin_power =
          scanned_waiting
              ? 0.0
              : adaptive ? (channel.adaptive_db[bin] <= kDenoiseSilenceDb
                                ? 0.0
                                : db_to_power(channel.adaptive_db[bin]))
                         : profile_bin_power(denoise, bin);
      denoise->live_floor_db[band] =
          bin_power > kFloorEpsilon
              ? 10.0 * std::log10(bin_power / reference)
              : kDenoiseSilenceDb;
    }
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
  // Everything time-based, derived from the hop once per callback rather than
  // written down against whatever the hop happened to be.
  const double frames_per_second =
      static_cast<double>(denoise->sample_rate) / static_cast<double>(hop);
  SpectralTiming timing;
  timing.subwindow_frames = std::max(
      1u, static_cast<uint32_t>(std::lround(
              frames_per_second * kMinimumWindowSeconds / kMinimumSubwindows)));
  timing.power_approach =
      approach_per_frame(frames_per_second, kMinimumSmoothingSeconds);
  timing.floor_glide =
      approach_per_frame(frames_per_second, kFloorGlideSeconds);

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
        gain_db_total += process_frame(denoise, channel, timing);
        gain_frames += 1;
        channel.fill = 0;
      }
    }
  }

  return gain_frames == 0 ? 0.0
                          : gain_db_total / static_cast<double>(gain_frames);
}

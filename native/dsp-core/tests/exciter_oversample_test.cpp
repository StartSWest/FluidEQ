/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Exciter's oversampling choice, measured on its filters alone.
 *
 * High is worth a switch only if it does what Standard does not at the top
 * of the band: pass what is heard and stop what would fold back. Each claim
 * is measured on both, so a High that matched Standard would fail here
 * rather than ship as a second name for the same filter.
 */

#include "fluideq/analog_diode.h"
#include "fluideq/chain.h"
#include "fluideq/exciter_oversample.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <utility>
#include <vector>

namespace {

using feq_test::check;
using feq_test::kPi;

constexpr double kRate = 48000.0;
constexpr uint32_t kBlock = 480;
constexpr uint32_t kBlocks = 40;

/** RMS in dB of `samples` from `from` on. */
double rms_db(const std::vector<float>& samples, size_t from) {
  double sum = 0.0;
  for (size_t at = from; at < samples.size(); ++at) {
    sum += static_cast<double>(samples[at]) * static_cast<double>(samples[at]);
  }
  const double mean = sum / static_cast<double>(samples.size() - from);
  return mean > 0.0 ? 10.0 * std::log10(mean) : -400.0;
}

/** A tone at the output's rate, up and back down in `quality`'s way. */
double round_trip_db(double hz, int quality) {
  FeqExciterOversampler state{};
  feq_exciter_oversampler_reset(&state);
  const uint32_t factor = feq_exciter_oversample_factor(kRate, quality);
  std::vector<float> in(kBlock), wide(kBlock * 4), middle(kBlock * 2);
  std::vector<float> out;
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (uint32_t at = 0; at < kBlock; ++at) {
      in[at] = static_cast<float>(
          0.5 * std::sin(2 * kPi * hz * (block * kBlock + at) / kRate));
    }
    feq_exciter_oversample_up(&state, in.data(), wide.data(), kBlock, factor,
                              quality, middle.data());
    std::vector<float> back(kBlock);
    feq_exciter_oversample_down(&state, wide.data(), back.data(), kBlock,
                                factor, quality, middle.data());
    out.insert(out.end(), back.begin(), back.end());
  }
  return rms_db(out, out.size() / 2) - 20.0 * std::log10(0.5 / std::sqrt(2.0));
}

/**
 * A tone made at four times the output's rate, just past its Nyquist, and
 * brought down: whatever comes out is a fold, heard at the mirror image.
 */
double fold_db(double hz, int quality) {
  FeqExciterOversampler state{};
  feq_exciter_oversampler_reset(&state);
  const uint32_t factor = 4;
  const double wide_rate = kRate * factor;
  std::vector<float> wide(kBlock * factor), middle(kBlock * 2), back(kBlock);
  std::vector<float> out;
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (uint32_t at = 0; at < kBlock * factor; ++at) {
      wide[at] = static_cast<float>(
          0.5 * std::sin(2 * kPi * hz *
                         (block * kBlock * factor + at) / wide_rate));
    }
    feq_exciter_oversample_down(&state, wide.data(), back.data(), kBlock,
                                factor, quality, middle.data());
    out.insert(out.end(), back.begin(), back.end());
  }
  return rms_db(out, out.size() / 2) - 20.0 * std::log10(0.5 / std::sqrt(2.0));
}

void high_passes_the_top_of_hearing() {
  std::printf("High passes what is heard, to 20 kHz at 48 kHz\n");
  for (const double hz : {1000.0, 10000.0, 16000.0, 18000.0, 20000.0}) {
    const double standard = round_trip_db(hz, FEQ_EXCITER_OVERSAMPLING_STANDARD);
    const double high = round_trip_db(hz, FEQ_EXCITER_OVERSAMPLING_HIGH);
    std::printf("  %6.0f Hz  standard %+6.2f dB  high %+6.2f dB\n", hz,
                standard, high);
    check(std::fabs(high) < 0.2, "High passes it within 0.2 dB");
    check(std::fabs(standard) < 0.2, "and Standard did already");
  }
  // CONTROL: the same round trip does see a filter, 1 kHz under the
  // output's Nyquist, so the flat readings above are the filters' own.
  const double edge = round_trip_db(23000.0, FEQ_EXCITER_OVERSAMPLING_HIGH);
  std::printf("   23000 Hz  high %+6.1f dB\n", edge);
  check(edge < -20.0, "control: High is well down at 23 kHz");
  // Off is no filter at all: everything through.
  check(std::fabs(round_trip_db(20000.0, FEQ_EXCITER_OVERSAMPLING_OFF)) <
            0.01,
        "Off passes it untouched");
}

void high_stops_what_would_fold() {
  std::printf("High stops what would fold back from past the top\n");
  // 26 to 30 kHz made at 192 kHz would land at 22 to 18 kHz at 48.
  for (const double hz : {26000.0, 28000.0, 30000.0}) {
    const double standard = fold_db(hz, FEQ_EXCITER_OVERSAMPLING_STANDARD);
    const double high = fold_db(hz, FEQ_EXCITER_OVERSAMPLING_HIGH);
    std::printf("  %6.0f Hz folds to %5.0f Hz:  standard %7.1f dB  high %7.1f dB\n",
                hz, kRate - hz, standard, high);
    check(high < -80.0, "High holds a fold 80 dB down");
    check(high < standard - 20.0, "and at least 20 dB under Standard");
  }
}

/**
 * The round trip's delay in ms: the first moment of its impulse response,
 * which for a symmetric (linear-phase) response is exactly its centre.
 */
double round_trip_delay_ms(int quality) {
  FeqExciterOversampler state{};
  feq_exciter_oversampler_reset(&state);
  const uint32_t factor = feq_exciter_oversample_factor(kRate, quality);
  std::vector<float> in(kBlock, 0.0f), wide(kBlock * 4), middle(kBlock * 2),
      out(kBlock);
  in[0] = 1.0f;
  feq_exciter_oversample_up(&state, in.data(), wide.data(), kBlock, factor,
                            quality, middle.data());
  feq_exciter_oversample_down(&state, wide.data(), out.data(), kBlock, factor,
                              quality, middle.data());
  double moment = 0.0;
  double sum = 0.0;
  for (uint32_t at = 0; at < kBlock; ++at) {
    moment += static_cast<double>(at) * static_cast<double>(out[at]);
    sum += static_cast<double>(out[at]);
  }
  return moment / sum / kRate * 1000.0;
}

void the_harmonics_arrive_as_documented() {
  std::printf("how late each choice brings the harmonics back, at 48 kHz\n");
  const double off = round_trip_delay_ms(FEQ_EXCITER_OVERSAMPLING_OFF);
  const double standard = round_trip_delay_ms(FEQ_EXCITER_OVERSAMPLING_STANDARD);
  const double high = round_trip_delay_ms(FEQ_EXCITER_OVERSAMPLING_HIGH);
  std::printf("  off %.3f ms  standard %.3f ms  high %.3f ms\n", off, standard,
              high);
  check(off == 0.0, "Off: none");
  check(std::fabs(standard - 0.969) < 0.01, "Standard: about 1 ms");
  check(std::fabs(high - 1.802) < 0.01, "High: about 1.8 ms");
}

/**
 * A reset oversampler returns nothing of its empty start after its warm-up:
 * a tone switched on at the first sample comes back, from the warm-up on, as
 * the same tone a warm one returns. Control: a frame before the warm-up, the
 * filling still shows.
 */
void the_warm_up_covers_the_fill() {
  std::printf("the silence a switch holds covers the filters filling\n");
  for (const int quality :
       {FEQ_EXCITER_OVERSAMPLING_STANDARD, FEQ_EXCITER_OVERSAMPLING_HIGH}) {
    const uint32_t factor = feq_exciter_oversample_factor(kRate, quality);
    const uint32_t warm = feq_exciter_oversample_warmup(factor, quality);
    std::vector<float> in(kBlock), wide(kBlock * 4), middle(kBlock * 2);
    std::vector<float> cold(kBlock), steady(kBlock);
    FeqExciterOversampler fresh{};
    FeqExciterOversampler running{};
    feq_exciter_oversampler_reset(&fresh);
    feq_exciter_oversampler_reset(&running);
    for (uint32_t block = 0; block < 4; ++block) {
      for (uint32_t at = 0; at < kBlock; ++at) {
        in[at] = static_cast<float>(
            0.5 * std::sin(2 * kPi * 3000.0 * (block * kBlock + at) / kRate));
      }
      feq_exciter_oversample_up(&running, in.data(), wide.data(), kBlock,
                                factor, quality, middle.data());
      feq_exciter_oversample_down(&running, wide.data(), steady.data(), kBlock,
                                  factor, quality, middle.data());
      if (block == 3) {
        // The fresh one meets the tone mid-flow, as a switch would.
        feq_exciter_oversample_up(&fresh, in.data(), wide.data(), kBlock,
                                  factor, quality, middle.data());
        feq_exciter_oversample_down(&fresh, wide.data(), cold.data(), kBlock,
                                    factor, quality, middle.data());
      }
    }
    // The last frame on which the fresh one still differs: once full, the
    // two run the same sums over the same samples and agree bit for bit.
    uint32_t last = 0;
    for (uint32_t at = 0; at < kBlock; ++at) {
      if (cold[at] != steady[at]) {
        last = at;
      }
    }
    std::printf("  %-8s warm-up %3u frames, the fill last shows on frame %u\n",
                quality == FEQ_EXCITER_OVERSAMPLING_HIGH ? "high" : "standard",
                warm, last);
    check(last < warm, "from the warm-up on, the fresh one returns the tone");
    // CONTROL: the fill is real, and the warm-up of its order. The warm-up
    // counts every tap of every stage; in floats the two agree some 25
    // frames sooner (measured 70 of 95 and 148 of 175), half a millisecond
    // the hold may spend over, inside the whole block it rounds up to.
    check(last * 2 >= warm, "control: the fill shows past half of it");
  }
  check(feq_exciter_oversample_warmup(1, FEQ_EXCITER_OVERSAMPLING_OFF) == 0,
        "Off has nothing to fill");
}

using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

/** The Exciter's top band alone, pushed as far as its dials go. */
FeqChainSettings top_band_pushed(int quality) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.normalizer.mode = 0;
  settings.master.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.eq.enabled = 0;
  settings.dimension.enabled = 0;
  settings.bass_forge.enabled = 0;
  settings.bass_punch.enabled = 0;
  settings.exciter.enabled = 1;
  settings.exciter.oversampling = quality;
  FeqChainExciterBand& top = settings.exciter.bands[2];
  top.enabled = 1;
  top.freq_hz = 8000.0;
  top.range = 0.3;
  top.drive = 3.5;
  top.mix = 1.0;
  top.texture = FEQ_ANALOG_DIODE_MAX_CHARACTER;
  return settings;
}

struct Folds {
  double harmonic_db;
  double folds_db;
};

/**
 * A 9 kHz tone through the rack: its second harmonic is real (18 kHz); its
 * third to seventh lie past 24 kHz and, folded, land at 21, 12, 3, 6 and
 * 15 kHz, none of them a harmonic of 9. Both readings are against the tone,
 * over the last second, which holds every frequency a whole number of times.
 */
Folds folds_through_the_rack(int quality) {
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  const FeqChainSettings settings = top_band_pushed(quality);
  feq_chain_configure(rack.get(), &settings);
  constexpr uint32_t blocks = 200;
  std::vector<float> left(kBlock), right(kBlock), out;
  for (uint32_t block = 0; block < blocks; ++block) {
    for (uint32_t at = 0; at < kBlock; ++at) {
      const double t = static_cast<double>(block * kBlock + at) / kRate;
      left[at] = right[at] = static_cast<float>(0.3 * std::sin(2 * kPi * 9000.0 * t));
    }
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(rack.get(), planes, kBlock);
    out.insert(out.end(), left.begin(), left.end());
  }
  const size_t count = 48000;
  const size_t from = out.size() - count;
  const double tone = feq_test::bin_magnitude(out, 9000.0, from, count);
  double folded = 0.0;
  for (const double hz : {21000.0, 12000.0, 3000.0, 6000.0, 15000.0}) {
    const double magnitude = feq_test::bin_magnitude(out, hz, from, count);
    folded += magnitude * magnitude;
  }
  const double harmonic = feq_test::bin_magnitude(out, 18000.0, from, count);
  return {20.0 * std::log10(std::max(harmonic, 1e-12) / tone),
          10.0 * std::log10(std::max(folded, 1e-24) / (tone * tone))};
}

void the_rack_folds_least_on_high() {
  std::printf("what the pushed top band folds back, through the rack\n");
  const Folds off = folds_through_the_rack(FEQ_EXCITER_OVERSAMPLING_OFF);
  const Folds standard = folds_through_the_rack(FEQ_EXCITER_OVERSAMPLING_STANDARD);
  const Folds high = folds_through_the_rack(FEQ_EXCITER_OVERSAMPLING_HIGH);
  std::printf("  off       harmonic %+6.1f dB  folds %+7.1f dB\n", off.harmonic_db, off.folds_db);
  std::printf("  standard  harmonic %+6.1f dB  folds %+7.1f dB\n", standard.harmonic_db, standard.folds_db);
  std::printf("  high      harmonic %+6.1f dB  folds %+7.1f dB\n", high.harmonic_db, high.folds_db);
  // CONTROL: the measurement hears folds where nothing stops them.
  check(off.folds_db > standard.folds_db + 20.0,
        "control: Off folds back at least 20 dB more than Standard");
  // Measured 2026-10-14: -19, -57 and -125 dB.
  check(high.folds_db < standard.folds_db - 40.0,
        "High folds back at least 40 dB less than Standard");
  check(std::fabs(high.harmonic_db - standard.harmonic_db) < 0.5,
        "and makes the same harmonic, within 0.5 dB");
}

/** High's sharp stage as `exciter_oversample.cpp` designs it. */
std::vector<double> steep_taps() {
  constexpr int kTaps = FEQ_EXCITER_STEEP_TAPS;
  constexpr double kCutoff = 0.23;
  const double beta = 0.1102 * (90.0 - 8.7);
  const auto i0 = [](double x) {
    double sum = 1.0;
    double term = 1.0;
    for (int k = 1; k < 64; ++k) {
      term *= (x * x / 4.0) / (static_cast<double>(k) * static_cast<double>(k));
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return sum;
  };
  std::vector<double> taps(kTaps);
  const double middle = (kTaps - 1) / 2.0;
  double sum = 0.0;
  for (int at = 0; at < kTaps; ++at) {
    const double n = at - middle;
    const double ideal =
        n == 0.0 ? 2.0 * kCutoff : std::sin(2.0 * kPi * kCutoff * n) / (kPi * n);
    const double r = n / middle;
    taps[static_cast<size_t>(at)] =
        ideal * i0(beta * std::sqrt(1.0 - r * r)) / i0(beta);
    sum += taps[static_cast<size_t>(at)];
  }
  for (double& tap : taps) tap /= sum;
  return taps;
}

/**
 * A filter the plain way: one history, the stuffed zeros and the thrown-away
 * samples in it, every tap summed. `late` reads every sum a sample further
 * back, which is what a phase or a tap taken wrongly looks like.
 */
struct Plain {
  std::vector<double> taps;
  std::vector<double> history;
  size_t position = 0;
  bool late = false;
  explicit Plain(std::vector<double> designed, bool is_late)
      : taps(std::move(designed)), history(taps.size(), 0.0), late(is_late) {}
  double push(double sample) {
    const size_t length = taps.size();
    history[position] = sample;
    double sum = 0.0;
    for (size_t tap = 0; tap < length; ++tap) {
      const size_t back = tap + (late ? 1 : 0);
      sum += history[(position + length * 2 - back) % length] * taps[tap];
    }
    position = (position + 1) % length;
    return sum;
  }
  void up(const float* in, float* out, size_t frames) {
    for (size_t at = 0; at < frames; ++at) {
      out[at * 2] = static_cast<float>(push(in[at]) * 2.0);
      out[at * 2 + 1] = static_cast<float>(push(0.0) * 2.0);
    }
  }
  void down(const float* in, float* out, size_t frames) {
    for (size_t at = 0; at < frames; ++at) {
      const double kept = push(in[at * 2]);
      push(in[at * 2 + 1]);
      out[at] = static_cast<float>(kept);
    }
  }
};

/**
 * The largest difference, up and down over a run of noise, between the
 * Exciter's filters and the plain ones at 4x.
 */
double largest_difference(int quality, bool late) {
  std::vector<double> half(FEQ_OVERSAMPLE_TAPS);
  feq_oversample_half_band_design(half.data());
  const std::vector<double> first =
      quality == FEQ_EXCITER_OVERSAMPLING_HIGH ? steep_taps() : half;
  Plain up_first(first, late), up_second(half, late);
  Plain down_second(half, late), down_first(first, late);
  FeqExciterOversampler state{};
  feq_exciter_oversampler_reset(&state);
  std::vector<float> in(kBlock), wide_in(kBlock * 4), wide(kBlock * 4),
      back(kBlock), middle(kBlock * 2);
  std::vector<float> plain_middle(kBlock * 2), plain_wide(kBlock * 4),
      plain_back(kBlock);
  unsigned long long seed = 11;
  const auto noise = [&seed]() {
    seed = seed * 6364136223846793005ULL + 1442695040888963407ULL;
    return static_cast<float>(static_cast<double>(seed >> 33) / 4294967296.0 -
                              1.0);
  };
  double largest = 0.0;
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (float& value : in) value = noise();
    // Down gets noise of its own, so it is checked on more than up made.
    for (float& value : wide_in) value = noise();
    feq_exciter_oversample_up(&state, in.data(), wide.data(), kBlock, 4,
                              quality, middle.data());
    feq_exciter_oversample_down(&state, wide_in.data(), back.data(), kBlock, 4,
                                quality, middle.data());
    up_first.up(in.data(), plain_middle.data(), kBlock);
    up_second.up(plain_middle.data(), plain_wide.data(), kBlock * 2);
    down_second.down(wide_in.data(), plain_middle.data(), kBlock * 2);
    down_first.down(plain_middle.data(), plain_back.data(), kBlock);
    for (size_t at = 0; at < wide.size(); ++at) {
      largest = std::max(largest,
                         std::fabs(static_cast<double>(wide[at] - plain_wide[at])));
    }
    for (size_t at = 0; at < back.size(); ++at) {
      largest = std::max(largest,
                         std::fabs(static_cast<double>(back[at] - plain_back[at])));
    }
  }
  return largest;
}

/**
 * The filters run as two phases, folded, in eight partial sums (GitHub issue
 * 30: the single running sum was most of the stage's cost). That reorders
 * the additions, so it is held to the plain filter to the float's own
 * rounding rather than to the bit.
 */
void the_filters_are_the_plain_filters() {
  std::printf("the filters give the plain filters' samples\n");
  for (const int quality :
       {FEQ_EXCITER_OVERSAMPLING_STANDARD, FEQ_EXCITER_OVERSAMPLING_HIGH}) {
    const double in_step = largest_difference(quality, false);
    const double out_of_step = largest_difference(quality, true);
    std::printf("  %s: largest difference %.3g; a sample out of step, %.3g\n",
                quality == FEQ_EXCITER_OVERSAMPLING_HIGH ? "High" : "Standard",
                in_step, out_of_step);
    check(in_step < 5e-7, "every sample within the float's rounding");
    check(out_of_step > 0.01, "control: a filter a sample out of step differs");
  }
}

void the_factor_follows_the_rate() {
  std::printf("the factor each choice runs at\n");
  check(feq_exciter_oversample_factor(48000.0, FEQ_EXCITER_OVERSAMPLING_STANDARD) == 4,
        "Standard is 4x at 48 kHz");
  check(feq_exciter_oversample_factor(96000.0, FEQ_EXCITER_OVERSAMPLING_HIGH) == 2,
        "High keeps Standard's factor: 2x at 96 kHz");
  check(feq_exciter_oversample_factor(48000.0, FEQ_EXCITER_OVERSAMPLING_OFF) == 1,
        "Off is the output's own rate");
}

}  // namespace

int main() {
  high_passes_the_top_of_hearing();
  high_stops_what_would_fold();
  the_rack_folds_least_on_high();
  the_harmonics_arrive_as_documented();
  the_warm_up_covers_the_fill();
  the_factor_follows_the_rate();
  the_filters_are_the_plain_filters();
  return feq_test::finish();
}

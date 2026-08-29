/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/meters.h"

#include <atomic>
#include <cmath>
#include <cstring>
#include <vector>

#include "fluideq/convolver.h"

namespace {

/**
 * `AnalyserNode`'s own smoothing constant, and the reason it is not a taste.
 *
 * Every graph in the panel was drawn against a spectrum smoothed by exactly
 * this much. A different value is not "smoother" or "faster" — it is every
 * display in the app behaving differently on the day the engine changed, which
 * reads as a regression rather than as a port.
 */
constexpr double kSmoothing = 0.8;

/** Below this the display is at its floor anyway, and log10(0) is not. */
constexpr double kMagnitudeFloor = 1e-10;

/**
 * One stage's window, published by the audio thread and read by the host.
 *
 * A seqlock rather than a mutex, because the writer is the audio callback: a
 * lock it can wait on is a lock the scheduler can park another thread inside,
 * and that is a dropout with no bug in it. The writer never waits at all here;
 * a reader that catches a torn window sees an odd or changed sequence and takes
 * the next one instead. A frame skipped at 24 fps is invisible, and a frame
 * spliced out of two different moments is a spike that looks like signal.
 */
struct StageWindow {
  std::atomic<uint32_t> sequence{0};
  /**
   * Both channels, left in the first half and right in the second.
   *
   * Kept apart rather than summed to mono, and that is a correctness fix rather
   * than a refinement. `AnalyserNode` — which this replaces — analyses the mono
   * down-mix, `0.5 * (L + R)`, and for anti-phase material that is silence: the
   * repository's own karaoke fixture measures a correlation of exactly -1.000
   * and a mono peak of 1.5e-5 against a channel peak of 1.0, because a vocal
   * removal built from L-R cancels perfectly when summed back.
   *
   * The panel drew nothing at all for that content while it was playing, on
   * both engines, and had done for the life of the app. Since a graph that does
   * not move while music plays is the exact defect this file exists to remove,
   * it is fixed here rather than reproduced faithfully.
   */
  std::vector<float> filling;
  uint32_t fill = 0;
  /** Published, read under the seqlock. Same layout. */
  std::vector<float> published;
  /** Bumped on every publish, so a reader can tell "new" from "again". */
  std::atomic<uint64_t> generation{0};
  /** Reader-side only: smoothing state and the last generation drawn. */
  std::vector<double> smoothed;
  uint64_t drawn = 0;
};

/** The scope's own published window, on the same seqlock discipline. */
struct ScopeWindow {
  std::atomic<uint32_t> sequence{0};
  std::vector<float> filling;
  uint32_t fill = 0;
  double sum_left_right = 0.0;
  double sum_left_squared = 0.0;
  double sum_right_squared = 0.0;
  float peak_left = 0.0f;
  float peak_right = 0.0f;

  std::vector<float> published;
  std::atomic<double> correlation{1.0};
  std::atomic<float> published_peak_left{0.0f};
  std::atomic<float> published_peak_right{0.0f};
  std::atomic<uint64_t> generation{0};
  uint64_t drawn = 0;
};

/** Blackman, which is the window `AnalyserNode` applies before its transform. */
std::vector<double> blackman_window() {
  std::vector<double> window(FEQ_METER_WINDOW);
  constexpr double kAlpha = 0.16;
  const double a0 = (1.0 - kAlpha) / 2.0;
  const double a1 = 0.5;
  const double a2 = kAlpha / 2.0;
  for (uint32_t at = 0; at < FEQ_METER_WINDOW; at += 1) {
    const double phase =
        (2.0 * 3.14159265358979323846 * at) / (FEQ_METER_WINDOW - 1);
    window[at] = a0 - a1 * std::cos(phase) + a2 * std::cos(2.0 * phase);
  }
  return window;
}

}  // namespace

struct FeqMeters {
  uint32_t channels = 2;
  std::atomic<int> enabled{0};
  StageWindow stages[FEQ_METER_STAGE_COUNT];
  ScopeWindow scope;
  std::vector<double> window;
  /** Reader-side scratch, so the transform allocates nothing per frame. */
  std::vector<double> real;
  std::vector<double> imaginary;
  /** Where the two channels' magnitudes are summed before smoothing. */
  std::vector<double> magnitudes;
  std::vector<float> snapshot;
};

extern "C" {

FeqMeters* feq_meters_create(uint32_t channels) {
  auto* meters = new (std::nothrow) FeqMeters();
  if (meters == nullptr) {
    return nullptr;
  }
  meters->channels = channels == 0 ? 1 : channels;
  meters->window = blackman_window();
  meters->real.assign(FEQ_METER_WINDOW, 0.0);
  meters->imaginary.assign(FEQ_METER_WINDOW, 0.0);
  meters->magnitudes.assign(FEQ_METER_BINS, 0.0);
  meters->snapshot.assign(static_cast<size_t>(FEQ_METER_WINDOW) * 2, 0.0f);
  for (auto& stage : meters->stages) {
    stage.filling.assign(static_cast<size_t>(FEQ_METER_WINDOW) * 2, 0.0f);
    stage.published.assign(static_cast<size_t>(FEQ_METER_WINDOW) * 2, 0.0f);
    stage.smoothed.assign(FEQ_METER_BINS, 0.0);
  }
  meters->scope.filling.assign(
      static_cast<size_t>(FEQ_METER_SCOPE_PAIRS) * 2, 0.0f);
  meters->scope.published.assign(
      static_cast<size_t>(FEQ_METER_SCOPE_PAIRS) * 2, 0.0f);
  return meters;
}

void feq_meters_destroy(FeqMeters* meters) { delete meters; }

void feq_meters_set_enabled(FeqMeters* meters, int enabled) {
  if (meters != nullptr) {
    meters->enabled.store(enabled != 0 ? 1 : 0, std::memory_order_release);
  }
}

int feq_meters_enabled(const FeqMeters* meters) {
  return meters != nullptr && meters->enabled.load(std::memory_order_acquire);
}

void feq_meters_capture(FeqMeters* meters,
                        uint32_t stage,
                        const float* const* channels,
                        uint32_t frames) {
  if (meters == nullptr || channels == nullptr ||
      stage >= FEQ_METER_STAGE_COUNT ||
      meters->enabled.load(std::memory_order_acquire) == 0) {
    return;
  }

  StageWindow& target = meters->stages[stage];
  const float* left = channels[0];
  const float* right = meters->channels > 1 ? channels[1] : channels[0];
  if (left == nullptr || right == nullptr) {
    return;
  }

  for (uint32_t at = 0; at < frames; at += 1) {
    // Kept as two channels, not summed. See `StageWindow`: the mono down-mix
    // `AnalyserNode` performs is exactly zero for anti-phase material, and the
    // panel drew nothing at all while such a track played.
    target.filling[target.fill] = left[at];
    target.filling[FEQ_METER_WINDOW + target.fill] = right[at];
    target.fill += 1;
    if (target.fill < FEQ_METER_WINDOW) {
      continue;
    }
    target.fill = 0;
    // Odd while writing, even when settled: a reader between the two sees a
    // sequence it cannot trust and takes the next window instead.
    const uint32_t sequence = target.sequence.load(std::memory_order_relaxed);
    target.sequence.store(sequence + 1, std::memory_order_release);
    std::memcpy(target.published.data(), target.filling.data(),
                sizeof(float) * FEQ_METER_WINDOW * 2);
    target.sequence.store(sequence + 2, std::memory_order_release);
    target.generation.fetch_add(1, std::memory_order_release);
  }

  if (stage != FEQ_METER_STAGE_MASTER) {
    return;
  }

  /**
   * The scope, the needle and the peaks, taken at the master tap only.
   *
   * After the mid/side decode and every gain, because that is where the samples
   * are left and right again and are what actually leaves for the device.
   * Measured earlier, the goniometer would draw the middle against the
   * difference — a picture that is wrong in a way that still looks plausible.
   */
  ScopeWindow& scope = meters->scope;
  for (uint32_t at = 0; at < frames; at += 1) {
    const float l = left[at];
    const float r = right[at];
    scope.sum_left_right += static_cast<double>(l) * r;
    scope.sum_left_squared += static_cast<double>(l) * l;
    scope.sum_right_squared += static_cast<double>(r) * r;
    scope.peak_left = std::fmax(scope.peak_left, std::fabs(l));
    scope.peak_right = std::fmax(scope.peak_right, std::fabs(r));

    const uint32_t pair = scope.fill / 2;
    if (pair < FEQ_METER_SCOPE_PAIRS) {
      scope.filling[scope.fill] = l;
      scope.filling[scope.fill + 1] = r;
    }
    scope.fill += 2;
    if (scope.fill < static_cast<uint32_t>(FEQ_METER_SCOPE_PAIRS) * 2) {
      continue;
    }
    scope.fill = 0;

    const double denominator =
        std::sqrt(scope.sum_left_squared * scope.sum_right_squared);
    // Silence has no correlation to report, and zero would read on the needle
    // as a warning about nothing. One is what the worklet reports there too.
    const double correlation =
        denominator > 1e-12 ? scope.sum_left_right / denominator : 1.0;

    const uint32_t sequence = scope.sequence.load(std::memory_order_relaxed);
    scope.sequence.store(sequence + 1, std::memory_order_release);
    std::memcpy(scope.published.data(), scope.filling.data(),
                sizeof(float) * FEQ_METER_SCOPE_PAIRS * 2);
    scope.correlation.store(correlation, std::memory_order_relaxed);
    scope.published_peak_left.store(scope.peak_left, std::memory_order_relaxed);
    scope.published_peak_right.store(scope.peak_right,
                                     std::memory_order_relaxed);
    scope.sequence.store(sequence + 2, std::memory_order_release);
    scope.generation.fetch_add(1, std::memory_order_release);

    scope.sum_left_right = 0.0;
    scope.sum_left_squared = 0.0;
    scope.sum_right_squared = 0.0;
    scope.peak_left = 0.0f;
    scope.peak_right = 0.0f;
  }
}

int feq_meters_read_spectrum(FeqMeters* meters,
                             uint32_t stage,
                             float* out_db,
                             uint32_t bins) {
  if (meters == nullptr || out_db == nullptr ||
      stage >= FEQ_METER_STAGE_COUNT || bins != FEQ_METER_BINS) {
    return 0;
  }
  StageWindow& target = meters->stages[stage];
  const uint64_t generation = target.generation.load(std::memory_order_acquire);
  if (generation == target.drawn) {
    return 0;
  }

  // Two attempts, not a loop without end: the writer never waits, so a reader
  // that loses twice is a reader whose frame is already late. Skipping it is
  // correct — the next window is 43 ms away and the display runs faster.
  for (int attempt = 0; attempt < 2; attempt += 1) {
    const uint32_t before = target.sequence.load(std::memory_order_acquire);
    if ((before & 1u) != 0u) {
      continue;
    }
    std::memcpy(meters->snapshot.data(), target.published.data(),
                sizeof(float) * FEQ_METER_WINDOW * 2);
    const uint32_t after = target.sequence.load(std::memory_order_acquire);
    if (before != after) {
      continue;
    }

    /**
     * Each channel transformed, then their MAGNITUDES averaged.
     *
     * Averaging the spectra rather than the signals is the whole point. For
     * ordinary correlated material the two are the same to within a fraction of
     * a decibel, so nothing a listener has been reading changes. For anti-phase
     * material the signal sum is zero and the magnitude average is the true
     * level — which is the difference between a graph that works on every track
     * and one that goes blank on some of them.
     *
     * Two transforms per stage instead of one. At roughly twenty-three windows
     * a second on the control thread that is a fraction of a percent of one
     * core, and it buys a display that is correct rather than merely faithful.
     */
    for (uint32_t bin = 0; bin < FEQ_METER_BINS; bin += 1) {
      meters->magnitudes[bin] = 0.0;
    }
    for (uint32_t channel = 0; channel < 2; channel += 1) {
      const float* samples =
          meters->snapshot.data() + static_cast<size_t>(channel) *
                                        FEQ_METER_WINDOW;
      for (uint32_t at = 0; at < FEQ_METER_WINDOW; at += 1) {
        meters->real[at] = samples[at] * meters->window[at];
        meters->imaginary[at] = 0.0;
      }
      feq_fft_in_place(meters->real.data(), meters->imaginary.data(),
                       FEQ_METER_WINDOW, 0);
      for (uint32_t bin = 0; bin < FEQ_METER_BINS; bin += 1) {
        const double re = meters->real[bin];
        const double im = meters->imaginary[bin];
        // Divided by the transform size, which is what `AnalyserNode` reports
        // and therefore what every graph in the panel was scaled against.
        meters->magnitudes[bin] +=
            0.5 * std::sqrt(re * re + im * im) /
            static_cast<double>(FEQ_METER_WINDOW);
      }
    }

    for (uint32_t bin = 0; bin < FEQ_METER_BINS; bin += 1) {
      const double previous = meters->stages[stage].smoothed[bin];
      const double blended =
          kSmoothing * previous + (1.0 - kSmoothing) * meters->magnitudes[bin];
      meters->stages[stage].smoothed[bin] = blended;
      out_db[bin] = static_cast<float>(
          20.0 * std::log10(std::fmax(blended, kMagnitudeFloor)));
    }
    target.drawn = generation;
    return 1;
  }
  return 0;
}

int feq_meters_read_scope(FeqMeters* meters,
                          float* out_pairs,
                          uint32_t pairs,
                          double* out_correlation,
                          float* out_peaks) {
  if (meters == nullptr || out_pairs == nullptr || out_correlation == nullptr ||
      out_peaks == nullptr || pairs != FEQ_METER_SCOPE_PAIRS) {
    return 0;
  }
  ScopeWindow& scope = meters->scope;
  const uint64_t generation = scope.generation.load(std::memory_order_acquire);
  if (generation == scope.drawn) {
    return 0;
  }

  for (int attempt = 0; attempt < 2; attempt += 1) {
    const uint32_t before = scope.sequence.load(std::memory_order_acquire);
    if ((before & 1u) != 0u) {
      continue;
    }
    std::memcpy(out_pairs, scope.published.data(),
                sizeof(float) * FEQ_METER_SCOPE_PAIRS * 2);
    const double correlation =
        scope.correlation.load(std::memory_order_relaxed);
    const float left = scope.published_peak_left.load(std::memory_order_relaxed);
    const float right =
        scope.published_peak_right.load(std::memory_order_relaxed);
    const uint32_t after = scope.sequence.load(std::memory_order_acquire);
    if (before != after) {
      continue;
    }
    *out_correlation = correlation;
    out_peaks[0] = left;
    out_peaks[1] = right;
    scope.drawn = generation;
    return 1;
  }
  return 0;
}

}  // extern "C"

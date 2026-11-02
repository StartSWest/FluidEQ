/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

/*
 * The sound, read every kHopMs from its own samples: the C++ twin of
 * `src/common/soundHops.ts`, which the scenes, the lamps and the Studio hear
 * the music through. Same windows, same transform, same decibels, same bands,
 * so a lamp lit by this process moves to the same drums and the same voice as
 * the picture the window draws (held to the TypeScript's numbers by
 * `scene_core_parity_test.cpp`, on fixtures that module wrote).
 *
 * Fed as the audio arrives, block by block, rather than with an analyser's
 * snapshot: `push` keeps the last history of each channel and reads a hop at
 * every hop of samples, which is what the TypeScript does with the snapshot
 * it is handed when nothing is lost. Time is lost only where samples are —
 * a gap the caller reports with `lose`.
 */

namespace feq::scene {

inline constexpr double kHopMs = 10.0;
inline constexpr int kRhythmBandCount = 24;
inline constexpr double kRhythmBandsLowHz = 40.0;
inline constexpr double kRhythmBandsHighHz = 12000.0;
inline constexpr float kNothingDb = -100.0F;

/** The long window's length in samples at `rate`: a power of two. */
std::size_t low_window_size(double rate);
/** Where band `band` of the rhythm's 24 starts, in Hz. */
double rhythm_band_edge_hz(int band);

struct SoundHop {
  /** Counts up by one a hop. */
  std::int64_t seq = -1;
  /** When the hop's last sample was played, in ms of audio heard. */
  double at_ms = 0.0;
  /** How much time the hop stands for: kHopMs, more after time was lost. */
  double step_ms = kHopMs;
  /** The rhythm's 24 bands in absolute level, 0..1 over 100 dB. */
  std::array<float, kRhythmBandCount> bands{};
  /** The long window's bins up to 375 Hz, in dB, and their width. */
  std::vector<float> low;
  double low_bin_hz = 0.0;
  /** The short window's bins up to 16 kHz, in dB, and their width. */
  std::vector<float> high;
  double high_bin_hz = 0.0;
  /** The long window's mid and side up to 4 kHz, in dB, for the voice. */
  std::vector<float> voice_mid;
  std::vector<float> voice_side;
};

/** Reads hops from a stereo stream at one rate. */
class SoundHops {
 public:
  explicit SoundHops(double rate);

  double rate() const { return rate_; }

  /**
   * `frames` new frames of `left` and `right` (the same pointer twice for a
   * single channel), played up to `at_ms` of audio heard. Calls `on_hop` for
   * every hop the new samples complete, oldest first; the hop is this
   * object's own, overwritten by the next: read it, never keep it.
   */
  template <typename OnHop>
  void push(const float* left, const float* right, std::size_t frames,
            double at_ms, OnHop&& on_hop) {
    for (std::size_t frame = 0; frame < frames; ++frame) {
      append(left[frame], right[frame]);
      pending_ += 1.0;
      if (pending_ >= hop_samples_) {
        pending_ -= hop_samples_;
        const double behind =
            static_cast<double>(frames - 1 - frame) * 1000.0 / rate_;
        read_hop(at_ms - behind);
        on_hop(static_cast<const SoundHop&>(hop_));
      }
    }
  }

  /** Audio that never arrived: the next hop stands for its time as well. */
  void lose(double ms) { lost_ms_ += ms; }

 private:
  void append(float left, float right);
  /**
   * Reads the hop ending at the newest sample. Before a whole window has been
   * heard the rest of it is silence, as an analyser's history starts out.
   */
  void read_hop(double at_ms);
  void transform_into(std::size_t size, const std::vector<double>& window,
                      bool side, float* out, std::size_t count);
  void bands_into(const float* bins, std::size_t count, double bin_hz,
                  int from, int to);

  double rate_;
  double hop_samples_;
  std::size_t low_size_;
  std::size_t low_count_;
  std::size_t high_count_;
  std::size_t voice_count_;
  double low_bin_hz_;
  double high_bin_hz_;
  std::vector<double> low_window_;
  std::vector<double> high_window_;
  std::vector<double> real_;
  std::vector<double> imaginary_;
  std::vector<float> low_band_bins_;
  /** The last low_size_ samples of each channel, a ring. */
  std::vector<float> left_;
  std::vector<float> right_;
  std::size_t next_ = 0;
  double pending_ = 0.0;
  double lost_ms_ = 0.0;
  SoundHop hop_;
};

/** The transform the analyser does, in place, as `src/common/dsp/fft.ts`. */
void fft_in_place(double* real, double* imaginary, std::size_t size,
                  bool inverse);

}  // namespace feq::scene

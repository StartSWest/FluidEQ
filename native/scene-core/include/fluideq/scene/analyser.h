/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cstddef>
#include <vector>

/*
 * Chromium's AnalyserNode over the sound the C++ hears: the twin of
 * `src/core/liveFrames/analyser.ts`, which is held to Chromium's own
 * analyser within 0.0007 dB. The front pair folded to mono, the newest
 * `fft_size` samples under Blackman's window, the magnitudes averaged by the
 * smoothing constant in single precision as Blink keeps them, and decibels
 * where silence is -infinity.
 */

namespace feq::scene {

class Analyser {
 public:
  Analyser(std::size_t fft_size, std::size_t history_size);

  /** `frames` interleaved frames of `channels` channels at `rate`. */
  void push(const float* interleaved, std::size_t frames, std::size_t channels,
            double rate);
  double rate() const { return rate_; }
  /** The front pair, or one. */
  std::size_t channel_count() const { return channels_.size(); }
  /** Milliseconds heard so far, across a change of format too. */
  double audio_ms() const { return heard_ms_; }
  /** `getFloatFrequencyData`: `fft_size / 2` bins at this smoothing. */
  void read_frequency(std::vector<float>& target, double smoothing);
  /** `getFloatTimeDomainData` of one channel, the newest `target.size()`. */
  void read_channel(std::size_t channel, std::vector<float>& target) const;
  /**
   * `getFloatTimeDomainData` of the node itself: the front pair folded to
   * mono, the newest `fft_size` samples — what the lamps' waveform is drawn
   * from (`lightingListener.ts`).
   */
  void read_mono(std::vector<float>& target);

 private:
  struct History {
    std::vector<float> samples;
    std::size_t next = 0;
  };
  void copy_newest(const History& history, std::vector<float>& target) const;
  /** The newest `fft_size` samples folded to mono, into `mono_`. */
  void fold();

  std::size_t fft_size_;
  std::size_t capacity_;
  std::vector<double> window_;
  std::vector<double> real_;
  std::vector<double> imaginary_;
  std::vector<float> mono_;
  std::vector<float> left_;
  std::vector<float> right_;
  std::vector<float> magnitudes_;
  std::vector<History> channels_;
  double rate_ = 0.0;
  std::size_t format_channels_ = 0;
  double heard_ms_ = 0.0;
};

}  // namespace feq::scene

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#ifndef FLUIDEQ_NORMALIZER_GAIN_H
#define FLUIDEQ_NORMALIZER_GAIN_H
#include <algorithm>
#include <cstdint>
#include "fluideq/post_filter_normalizer.h"

namespace feq_normalizer {
inline double peak_room(double ceiling, double source_peak) {
  // Reach the UNITY edge of the Live guard's soft knee, not its middle.
  // Margin alone still limited a steady tone by 0.1875 dB. Reserving the
  // reconstruction margin plus half the knee avoids continuous input
  // limiting, and gives analysed sources the same constant safe gain.
  return ceiling - source_peak - FEQ_AUTO_HEADROOM_MARGIN_DB -
      FEQ_AUTO_HEADROOM_KNEE_DB * 0.5;
}
// Live and analysed sources enter the same rack. Different boost limits or
// headroom margins made a quiet recording reach a different working level
// solely because it played through Library instead of Live. The UI's
// inputNormalizer.ts uses these same -48/+12 dB and peak-room bounds.
inline double loudness_gain(double requested, double peak_room) {
  return std::clamp(std::min(requested, peak_room), -48.0, 12.0);
}

inline uint32_t release_frames(double rate) {
  return std::max(1u, static_cast<uint32_t>(rate * 0.004));
}

// Keep a recent peak even when the host calls back one sample at a time.
inline double recent_peak(double previous, double peak, uint32_t frames,
                          double rate) {
  return std::max(peak, previous / (1.0 + frames / (rate * 0.1)));
}

// The taper must not make an incoming peak exceed both the preceding
// amplified level and the new fixed level.
inline double release_start(double gain, double target, double previous_peak,
                            double peak) {
  if (gain <= target || peak <= previous_peak) return gain;
  return std::max(target, gain * (previous_peak / peak));
}
}
#endif

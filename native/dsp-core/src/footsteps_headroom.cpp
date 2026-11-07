/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "footsteps_internal.h"
#include <algorithm>
#include <cmath>

namespace feq_footsteps_detail {

double overlay_headroom(FeqFootsteps& f, const double* dry, const double* added,
                        uint32_t count, int lfe, OverlayHeadroom& state,
                        bool adds_gain, uint32_t peak_hold_frames,
                        double ceiling_gain) {
  double available = 1.0;
  double input_peak = 0.0, added_peak = 0.0, output_peak = 0.0;
  for (uint32_t c = 0; c < count; ++c) {
    if (static_cast<int>(c) == lfe) continue;
    input_peak = std::max(input_peak, std::fabs(dry[c]));
    added_peak = std::max(added_peak, std::fabs(added[c]));
    output_peak = std::max(output_peak, std::fabs(dry[c] + added[c]));
    if (added[c] == 0.0) continue;
    // A deliberate cut keeps its reach. An already hot original is retained
    // exactly; only its added signal can be constrained, across every ear.
    const double ceiling = std::max(ceiling_gain, std::fabs(dry[c]));
    const double room = added[c] > 0 ? ceiling - dry[c] : ceiling + dry[c];
    available = std::min(available, room / std::fabs(added[c]));
  }
  const double decay = 1.0 - f.a_headroom_peak_release;
  const auto follow = [&](double sample, double& peak, uint32_t& hold) {
    if (sample >= peak) {
      peak = sample;
      hold = peak_hold_frames;
    } else if (hold > 0) {
      --hold;
    } else {
      peak = std::max(sample, peak * decay);
    }
  };
  follow(input_peak, state.input_peak, state.input_hold);
  follow(added_peak, state.added_peak, state.added_hold);
  follow(output_peak, state.output_peak, state.output_hold);
  if (adds_gain && state.added_peak > 0) {
    // Budget from recent peaks, not from every carrier's zero crossing.
    // Recovering wet gain between a hot tone's peaks made -54 dBc harmonics.
    // Reserve only the overshoot of the actual requested sum. Summing
    // independent dry/wet peak envelopes invents coincident peaks and can
    // suppress a cue even when those peaks occur at different times.
    const double budget = state.input_peak >= ceiling_gain ? 0.0 :
        1.0 - std::max(0.0, state.output_peak - ceiling_gain) / state.added_peak;
    available = std::min(available, std::max(0.0, budget));
  }
  double& gain = state.gain;
  gain = available < gain ? available
                         : gain + f.a_overlay_release * (available - gain);
  return gain;
}

}  // namespace feq_footsteps_detail

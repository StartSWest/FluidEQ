/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A filter asked for a corner at or above Nyquist stays a filter.
 *
 * The presets name corners up to 20 kHz and the chain runs at 32 kHz as well
 * as 192, so a corner can land past the rate's own limit. The coefficients
 * for that case have to be stable poles and a decaying impulse — an
 * out-of-band request must never become a filter that runs away.
 */
#include "fluideq/chain.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace {
using feq_test::check;

void filter_stability() {
  for (FeqFilterType type : {FEQ_FILTER_PK, FEQ_FILTER_NO, FEQ_FILTER_LSC,
                              FEQ_FILTER_HSC, FEQ_FILTER_LPQ, FEQ_FILTER_HPQ,
                              FEQ_FILTER_BP}) {
    for (double hz : {16000.0, 18500.0, 20000.0}) {
      const auto coefficients = feq_biquad_coefficients(type, hz, 6.0, 0.707,
                                                         32000.0);
      check(1.0 + coefficients.a1 + coefficients.a2 > 0.0 &&
                1.0 - coefficients.a1 + coefficients.a2 > 0.0 &&
                1.0 - coefficients.a2 > 0.0,
            "preset corners at and above Nyquist have stable poles");
      std::vector<float> impulse(32000, 0.0f);
      impulse[0] = 1.0f;
      FeqBiquadState state{};
      feq_biquad_process(&state, impulse.data(),
                          static_cast<uint32_t>(impulse.size()), &coefficients);
      check(std::all_of(impulse.begin(), impulse.end(),
                          [](float value) { return std::isfinite(value); }),
            "an out-of-band corner never generates invalid samples");
      check(std::all_of(impulse.begin() + 30000, impulse.end(),
                          [](float value) { return std::fabs(value) < 1e-5; }),
            "the filter impulse decays instead of running away");
      if (type == FEQ_FILTER_LPQ) {
        check(impulse[0] > 0.9f, "the protected low-pass still passes its input");
      }
    }
  }
}
}  // namespace

int main() {
  filter_stability();
  return feq_test::finish();
}

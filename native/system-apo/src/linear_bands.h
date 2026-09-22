#ifndef FLUIDEQ_ENGINE_LINEAR_BANDS_H
#define FLUIDEQ_ENGINE_LINEAR_BANDS_H

#include <cstdint>
#include <vector>
#include "fluideq/biquad.h"

namespace fluideq_engine {

/**
 * The magnitude of `bands` in series, as one linear-phase FIR at
 * `sample_rate` — whatever each band's design, cookbook or matched. Empty when
 * the kernel cannot hold that magnitude to 0.5 % from 20 Hz to 20 kHz.
 */
std::vector<float> design_linear_bands(
    const std::vector<FeqBiquadCoefficients>& bands, uint32_t sample_rate);

}  // namespace fluideq_engine
#endif

#ifndef FLUIDEQ_ENGINE_LINEAR_BANDS_H
#define FLUIDEQ_ENGINE_LINEAR_BANDS_H

#include <vector>
#include "fluideq/linear_phase.h"

namespace fluideq_engine {
std::vector<float> design_linear_bands(
    const std::vector<FeqLinearPhaseBand>& bands, uint32_t sample_rate);
}
#endif

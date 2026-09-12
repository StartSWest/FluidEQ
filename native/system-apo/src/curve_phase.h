#ifndef FLUIDEQ_ENGINE_CURVE_PHASE_H
#define FLUIDEQ_ENGINE_CURVE_PHASE_H

#include <vector>

namespace fluideq_engine {

std::vector<float> apply_minimum_curve_phase(
    const std::vector<float>& reference,
    const std::vector<float>& curve_reference);

}

#endif

/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <vector>
namespace feq::remote {
constexpr unsigned kSincTaps = 64;
constexpr unsigned kSincPhases = 1024;
std::vector<float> sinc_kernel(double ratio);
}

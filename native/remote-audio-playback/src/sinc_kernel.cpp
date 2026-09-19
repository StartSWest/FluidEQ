/* FluidEQ — GPL-3.0-or-later */
#include "sinc_kernel.h"
#include <algorithm>
#include <cmath>

namespace feq::remote {
namespace {
double bessel(double x) {
  double sum = 1, term = 1;
  for (unsigned i = 1; i < 40; ++i) {
    term *= x * x / (4.0 * i * i);
    sum += term;
    if (term < sum * 1e-15) break;
  }
  return sum;
}
}
std::vector<float> sinc_kernel(double ratio) {
  std::vector<float> table((kSincPhases + 1) * kSincTaps);
  const double cutoff = std::min(1.0, ratio) * 0.94;
  const double denominator = bessel(10);
  constexpr double pi = 3.14159265358979323846;
  for (unsigned phase = 0; phase <= kSincPhases; ++phase) {
    double sum = 0;
    for (unsigned tap = 0; tap < kSincTaps; ++tap) {
      const double x = static_cast<double>(tap) - 31 - static_cast<double>(phase) / kSincPhases;
      const double n = x / 32;
      const double window = bessel(10 * std::sqrt(std::max(0.0, 1 - n * n))) / denominator;
      const double sinc = std::abs(x) < 1e-12 ? cutoff : std::sin(pi * x * cutoff) / (pi * x);
      const double value = sinc * window;
      table[phase * kSincTaps + tap] = static_cast<float>(value);
      sum += value;
    }
    for (unsigned tap = 0; tap < kSincTaps; ++tap) table[phase * kSincTaps + tap] /= static_cast<float>(sum);
  }
  return table;
}
}

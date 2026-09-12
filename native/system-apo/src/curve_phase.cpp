#include "curve_phase.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <stdexcept>

#include "fluideq/convolver.h"

namespace fluideq_engine {

std::vector<float> apply_minimum_curve_phase(
    const std::vector<float>& reference,
    const std::vector<float>& curve_reference) {
  if (reference.empty() || curve_reference.empty()) return reference;
  uint32_t transform_size = 1;
  while (transform_size < reference.size() * 16) transform_size <<= 1;
  std::vector<double> phase_real(transform_size, 0.0);
  std::vector<double> phase_imaginary(transform_size, 0.0);
  std::copy(curve_reference.begin(), curve_reference.end(), phase_real.begin());
  feq_fft_in_place(phase_real.data(), phase_imaginary.data(), transform_size, 0);
  for (uint32_t index = 0; index < transform_size; ++index) {
    phase_real[index] = std::log(std::max(
        1e-12, std::hypot(phase_real[index], phase_imaginary[index])));
    phase_imaginary[index] = 0.0;
  }
  feq_fft_in_place(phase_real.data(), phase_imaginary.data(), transform_size, 1);
  for (uint32_t index = 0; index < transform_size; ++index) {
    const double weight = index == 0 || index == transform_size / 2 ? 1.0
        : index < transform_size / 2 ? 2.0 : 0.0;
    phase_real[index] *= weight / static_cast<double>(transform_size);
    phase_imaginary[index] = 0.0;
  }
  feq_fft_in_place(phase_real.data(), phase_imaginary.data(), transform_size, 0);
  std::vector<double> real(transform_size, 0.0);
  std::vector<double> imaginary(transform_size, 0.0);
  std::copy(reference.begin(), reference.end(), real.begin());
  feq_fft_in_place(real.data(), imaginary.data(), transform_size, 0);
  for (uint32_t index = 0; index < transform_size; ++index) {
    const double cosine = std::cos(phase_imaginary[index]);
    const double sine = std::sin(phase_imaginary[index]);
    const double original_real = real[index];
    real[index] = original_real * cosine - imaginary[index] * sine;
    imaginary[index] = original_real * sine + imaginary[index] * cosine;
  }
  feq_fft_in_place(real.data(), imaginary.data(), transform_size, 1);
  std::vector<float> result(reference.size() * 2, 0.0f);
  for (size_t index = 0; index < result.size(); ++index) {
    const double sample = real[index] / static_cast<double>(transform_size);
    if (!std::isfinite(sample)) throw std::runtime_error("Invalid curve phase.");
    result[index] = static_cast<float>(sample);
  }
  return result;
}

}

#include "linear_bands.h"

#include <algorithm>
#include <cmath>
#include <complex>
#include <stdexcept>
#include "fluideq/convolver.h"

namespace fluideq_engine {
namespace {
constexpr double kTau = 6.28318530717958647692;

double magnitude_at(const std::vector<FeqBiquadCoefficients>& bands,
                    double radians) {
  const std::complex<double> first = std::polar(1.0, -radians);
  const auto second = first * first;
  double magnitude = 1.0;
  for (const auto& band : bands) {
    const auto numerator = band.b0 + band.b1 * first + band.b2 * second;
    const auto denominator = 1.0 + band.a1 * first + band.a2 * second;
    magnitude *= std::abs(numerator) / std::max(1e-18, std::abs(denominator));
  }
  return magnitude;
}
}

std::vector<float> design_linear_bands(
    const std::vector<FeqLinearPhaseBand>& bands, uint32_t sample_rate) {
  uint32_t length = 32768;
  if (sample_rate > 48000) length = 65536;
  std::vector<FeqBiquadCoefficients> coefficients;
  for (const auto& band : bands) {
    coefficients.push_back(feq_biquad_coefficients(
        band.type, band.frequency, band.gain_db, band.quality, sample_rate));
  }
  std::vector<double> real(length, 0.0);
  std::vector<double> imaginary(length, 0.0);
  for (uint32_t bin = 0; bin <= length / 2; ++bin) {
    const double magnitude = magnitude_at(coefficients, kTau * bin / length);
    if (!std::isfinite(magnitude)) return {};
    real[bin] = magnitude;
    if (bin > 0 && bin < length / 2) real[length - bin] = magnitude;
  }
  feq_fft_in_place(real.data(), imaginary.data(), length, 1);
  const uint32_t delay = length / 2 - 1;
  std::vector<float> samples(length - 1);
  for (uint32_t index = 0; index < samples.size(); ++index) {
    samples[index] = static_cast<float>(real[(index + length - delay) % length] / length);
  }

  const uint32_t check_length = length * 4;
  real.assign(check_length, 0.0);
  imaginary.assign(check_length, 0.0);
  std::copy(samples.begin(), samples.end(), real.begin());
  feq_fft_in_place(real.data(), imaginary.data(), check_length, 0);
  for (uint32_t bin = 1; bin < check_length / 2; ++bin) {
    const double frequency = static_cast<double>(bin) * sample_rate / check_length;
    if (frequency < 20.0 || frequency > 20000.0) continue;
    const double target = magnitude_at(coefficients, kTau * bin / check_length);
    const double actual = std::hypot(real[bin], imaginary[bin]);
    if (!std::isfinite(actual) ||
        std::abs(actual - target) > std::max(0.00001, target * 0.005)) return {};
  }
  return samples;
}
}

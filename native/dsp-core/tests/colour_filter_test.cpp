/* FluidEQ — GPL-3.0-or-later */
#include "fluideq/exciter.h"
#include "fluideq/organic_stage.h"
#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdio>
#include <vector>

namespace {
constexpr unsigned kBlock = 480;
constexpr double kPi = 3.14159265358979323846;
int failures = 0;
void check(bool pass, const char* text) {
  if (!pass) { std::fprintf(stderr, "FAIL %s\n", text); ++failures; }
}
double response(const FeqBiquadCoefficients& k, double hz, double rate) {
  const auto z = std::polar(1.0, -2 * kPi * hz / rate);
  return std::abs((k.b0 + k.b1 * z + k.b2 * z * z) /
      (1.0 + k.a1 * z + k.a2 * z * z));
}
// Least-squares sine/cosine projection stays exact at noninteger frequencies.
double amplitude(const std::vector<float>& audio, double hz, double rate) {
  double ss = 0, cc = 0, sc = 0, xs = 0, xc = 0;
  const size_t begin = audio.size() - static_cast<size_t>(rate);
  for (size_t i = begin; i < audio.size(); ++i) {
    const double phase = 2 * kPi * hz * static_cast<double>(i - begin) / rate;
    const double s = std::sin(phase), c = std::cos(phase), x = audio[i];
    ss += s * s; cc += c * c; sc += s * c; xs += x * s; xc += x * c;
  }
  const double determinant = ss * cc - sc * sc;
  return std::hypot((xs * cc - xc * sc) / determinant,
                     (xc * ss - xs * sc) / determinant);
}
struct Buffers {
  std::vector<float> a = std::vector<float>(kBlock), b = a, c = a, wet = a,
      dry = a, guard = a, wide = std::vector<float>(kBlock * 4),
      wide_dry = wide, middle = std::vector<float>(kBlock * 2);
};
double organic_foundation(double rate, double focus, double range, double hz) {
  Buffers memory;
  FeqOrganicPath state{};
  feq_organic_path_init(&state, memory.a.data(), memory.b.data(),
      memory.wide.data(), memory.wide_dry.data(), memory.guard.data());
  std::vector<float> result, input(kBlock);
  const size_t frames = static_cast<size_t>(rate * 4);
  for (size_t at = 0; at < frames; at += kBlock) {
    const auto count = static_cast<unsigned>(std::min<size_t>(kBlock, frames - at));
    for (unsigned i = 0; i < count; ++i) input[i] = static_cast<float>(
        0.1 * std::sin(2 * kPi * hz * static_cast<double>(at + i) / rate));
    feq_organic_path_process(&state, input.data(), count, focus, range, 0.08,
        rate, memory.middle.data());
    result.insert(result.end(), memory.b.begin(), memory.b.begin() + count);
  }
  return amplitude(result, hz, rate) / 0.1;
}
void organic_crossings() {
  for (double rate : {44100.0, 48000.0})
    for (double range : {0.0, 0.28, 1.0}) {
      const double focus = 500;
      const auto old = feq_biquad_coefficients(FEQ_FILTER_BP, focus, 0,
          feq_organic_range_q(range), rate);
      check(std::abs(organic_foundation(rate, focus, range, focus) - 1) < 0.00001,
            "Organic keeps unity at focus through the real input filters");
      for (bool upper : {false, true}) {
        double low = upper ? focus : 1, high = upper ? rate * 0.49 : focus;
        for (unsigned i = 0; i < 80; ++i) {
          const double middle = (low + high) * 0.5;
          const bool above = response(old, middle, rate) > std::sqrt(0.5);
          if (above == upper) low = middle;
          else high = middle;
        }
        const double crossing = (low + high) * 0.5;
        check(std::abs(organic_foundation(rate, focus, range, crossing) -
            std::sqrt(0.5)) < 0.00005,
            "Organic keeps both independently derived old half-power crossings");
      }
      const double far = 9000;
      const double original = response(old, far, rate);
      const double expected = 1 / (1 + (std::sqrt(2.0) - 1) *
          (1 / (original * original) - 1));
      const double actual = organic_foundation(rate, focus, range, far);
      check(std::abs(actual - expected) < 0.00001 && actual < original,
          "Organic rejects distant treble more strongly than the old input");
    }
}
void mid_clamped_cache_and_gain() {
  for (const double range : {0.0, 0.3}) {
    Buffers a, b;
    FeqExciterChannel warm{}, cold{};
    const auto init = [](FeqExciterChannel& state, Buffers& memory) {
      feq_exciter_channel_init(&state, memory.a.data(), memory.b.data(),
          memory.c.data(), memory.wet.data(), memory.wide.data(),
          memory.wide_dry.data(), memory.middle.data(), memory.dry.data(),
          memory.guard.data());
    };
    init(warm, a); init(cold, b);
    FeqExciterSettings settings{};
    settings.enabled = 1; settings.oversampling = 1;
    settings.bands[1] = {1, 150, range, 2, 0.12, 0.2};
    std::vector<float> input(kBlock);
    double reports[3]{};
    feq_exciter_channel_process(&warm, input.data(), kBlock, &settings, 48000, reports);
    settings.bands[1].freq_hz = 170;
    feq_exciter_channel_process(&warm, input.data(), kBlock, &settings, 48000, reports);
    feq_exciter_channel_process(&cold, input.data(), kBlock, &settings, 48000, reports);
    const auto& k = cold.band_cache[1];
    check(std::abs(warm.band_cache[1].input_scale - k.input_scale) < 1e-12,
          "clipped native focus has the same compensation fresh and after an edit");
    const double centre = std::sqrt(k.low_hz * k.high_hz);
    const auto old_hp = feq_biquad_coefficients(FEQ_FILTER_HPQ, k.low_hz, 0,
        std::sqrt(0.5), 48000);
    const auto old_lp = feq_biquad_coefficients(FEQ_FILTER_LPQ, k.high_hz, 0,
        std::sqrt(0.5), 48000);
    const double expected = response(old_hp, centre, 48000) * response(old_lp, centre, 48000);
    const double actual = response(k.highpass, centre, 48000) *
        response(k.highpass_tail, centre, 48000) * response(k.lowpass, centre, 48000) *
        response(k.lowpass_tail, centre, 48000) * k.input_scale;
    check(std::abs(actual - expected) < 1e-10,
          "narrow and clamped bands preserve the old complete centre response");
  }
}
}
int main() {
  organic_crossings();
  mid_clamped_cache_and_gain();
  return failures == 0 ? 0 : 1;
}

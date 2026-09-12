#include "fluideq/denoise.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {
constexpr double pi = 3.14159265358979323846;
int failures = 0;
void check(bool value, const char* label) {
  std::printf("%s %s\n", value ? "PASS" : "FAIL", label);
  if (!value) ++failures;
}
FeqDenoiseSettings settings() {
  FeqDenoiseSettings s{};
  feq_denoise_settings_defaults(&s);
  s.enabled = 1;
  s.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
  s.hiss.enabled = s.click.enabled = s.voice.enabled = 0;
  s.hum.enabled = 1;
  s.hum.mode = FEQ_DENOISE_HUM_AUTO;
  s.hum.depth_db = 18;
  s.hum.harmonics = 5;
  return s;
}
void hum(double rate, uint32_t block, double mains, bool harmonic, bool enabled) {
  auto s = settings();
  s.hum.enabled = enabled ? 1 : 0;
  auto* d = feq_denoise_create(rate, 2, block);
  feq_denoise_configure(d, &s);
  std::vector<float> left(block), right(block);
  double real = 0, imaginary = 0, music_real = 0, music_imaginary = 0;
  double stereo_error = 0;
  uint32_t count = 0;
  const auto total = static_cast<uint32_t>(rate * 5);
  for (uint32_t start = 0; start < total; start += block) {
    const auto frames = std::min(block, total - start);
    for (uint32_t i = 0; i < frames; ++i) {
      const double t = (start + i) / rate;
      left[i] = static_cast<float>(0.1 * std::sin(2*pi*mains*t) +
        (harmonic ? 0.06 * std::sin(2*pi*mains*2*t) : 0) +
        0.1 * std::sin(2*pi*1301*t));
      right[i] = -left[i];
    }
    float* audio[] = {left.data(), right.data()};
    feq_denoise_process(d, audio, frames);
    for (uint32_t i = 0; i < frames; ++i) {
      stereo_error = std::max(stereo_error, std::fabs(static_cast<double>(left[i] + right[i])));
      if (start + i < static_cast<uint32_t>(rate * 4)) continue;
      const double t = (start + i) / rate;
      real += left[i] * std::cos(2*pi*mains*t);
      imaginary += left[i] * std::sin(2*pi*mains*t);
      music_real += left[i] * std::cos(2*pi*1301*t);
      music_imaginary += left[i] * std::sin(2*pi*1301*t);
      ++count;
    }
  }
  const double amplitude = 2 * std::hypot(real, imaginary) / count;
  const double music = 2 * std::hypot(music_real, music_imaginary) / count;
  check(enabled && harmonic ? amplitude < 0.025 : amplitude > 0.095,
        enabled && harmonic ? "persistent mains comb is reduced >12 dB" :
        enabled ? "single bass tone is preserved" : "bypass retains mains comb");
  check(music > 0.095 && music < 0.105, "unrelated programme tone is preserved");
  check(stereo_error < 1e-7, "opposite-polarity stereo remains intact");
  feq_denoise_destroy(d);
}
void transfer() {
  auto s = settings();
  s.hiss.enabled = s.click.enabled = 1;
  constexpr uint32_t block = 127;
  auto* reference = feq_denoise_create(48000, 2, block);
  auto* running = feq_denoise_create(48000, 2, block);
  feq_denoise_configure(reference, &s);
  feq_denoise_configure(running, &s);
  std::vector<float> a(block), b(block), c(block), e(block);
  double error = 0, output_peak = 0;
  for (uint32_t n = 0; n < 1000; ++n) {
    if (n == 800) {
      auto* next = feq_denoise_create(48000, 2, block);
      feq_denoise_configure(next, &s);
      check(feq_denoise_transfer_state(next, running) == 1, "adaptive denoise history transfers");
      feq_denoise_destroy(running);
      running = next;
    }
    for (uint32_t i = 0; i < block; ++i) {
      const double t = (n*block+i)/48000.0;
      a[i] = c[i] = static_cast<float>(0.1*std::sin(2*pi*1301*t) + 0.02*std::sin(2*pi*60*t));
      b[i] = e[i] = -a[i];
    }
    float* first[] = {a.data(), b.data()};
    float* second[] = {c.data(), e.data()};
    feq_denoise_process(reference, first, block);
    feq_denoise_process(running, second, block);
    for (uint32_t i = 0; i < block; ++i) {
      error = std::max(error, std::fabs(static_cast<double>(a[i]-c[i])));
      error = std::max(error, std::fabs(static_cast<double>(b[i]-e[i])));
      output_peak = std::max(output_peak, std::fabs(static_cast<double>(a[i])));
    }
  }
  check(error < 1e-7 && output_peak > 0.05, "transfer matches uninterrupted audible output");
  auto* incompatible = feq_denoise_create(44100, 2, block);
  feq_denoise_configure(incompatible, &s);
  check(feq_denoise_transfer_state(incompatible, running) == 0, "sample-rate mismatch refuses history");
  feq_denoise_destroy(incompatible);
  feq_denoise_destroy(reference);
  feq_denoise_destroy(running);
}
}
int main() {
  hum(44100, 127, 50, true, true);
  hum(48000, 512, 60, true, true);
  hum(96000, 257, 50, true, true);
  hum(48000, 127, 60, false, true);
  hum(48000, 512, 60, true, false);
  transfer();
  return failures ? 1 : 0;
}

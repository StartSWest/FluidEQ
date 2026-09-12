#include "../src/output_guard.h"
#include "graph_test_support.h"
#include <algorithm>

using namespace fluideq_engine_test;
using fluideq_engine::OutputGuard;

void run(OutputGuard& guard, std::vector<std::vector<float>>& audio,
         uint32_t block = 480, bool enabled = true) {
  for (uint32_t offset = 0; offset < audio[0].size(); offset += block) {
    float* planes[] = {audio[0].data() + offset, audio[1].data() + offset};
    guard.process(planes, std::min(block, static_cast<uint32_t>(audio[0].size()) - offset), enabled);
  }
}

void repeated_peaks_do_not_pump() {
  for (const uint32_t block : {127u, 480u, 512u}) {
    OutputGuard guard(kRate, 2);
    std::vector<std::vector<float>> audio(2, tone(1000, 0.1, kRate * 12, 0));
    for (uint32_t offset = 0; offset < audio[0].size(); offset += kRate / 2) {
      for (uint32_t frame = offset; frame < offset + 480; ++frame) {
        audio[0][frame] *= 20;
      }
    }
    audio[1] = audio[0];
    const auto control = audio[0];
    run(guard, audio, block);
    double minimum = 0, maximum = -100;
    for (uint32_t offset = kRate * 8; offset < kRate * 12; offset += kRate / 2) {
      const double early = rms_db(audio[0], offset + 4800, offset + 7200);
      const double late = rms_db(audio[0], offset + 19200, offset + 21600);
      minimum = std::min({minimum, early, late});
      maximum = std::max({maximum, early, late});
    }
    std::printf("block %u: repeated-peak bed modulation %.4f dB\n", block, maximum - minimum);
    CHECK(maximum - minimum < 0.15);
    CHECK(maximum > -36);
    CHECK(*std::max_element(control.begin(), control.end()) > 1.9f);
    CHECK(*std::max_element(audio[0].begin(), audio[0].end()) < 0.94f);
    CHECK(audio[0] == audio[1]);
    const double held = guard.gain_db();
    std::vector<std::vector<float>> silence(2, std::vector<float>(kRate * 10));
    run(guard, silence, block);
    CHECK(std::abs(guard.gain_db() - held) < 0.15);
    std::vector<std::vector<float>> quiet(2, tone(1000, 0.1, kRate * 8, 0));
    run(guard, quiet, block);
    CHECK(guard.gain_db() > held + 0.1);
    CHECK(guard.gain_db() < held + 0.6);
  }
}

void safe_audio_is_only_delayed() {
  OutputGuard guard(kRate, 2);
  std::vector<std::vector<float>> audio(2, tone(1000, 0.2, kRate, 0));
  const auto original = audio[0];
  run(guard, audio);
  CHECK(guard.gain_db() == 0);
  CHECK(guard.latency() == 96);
  for (uint32_t frame = guard.latency(); frame < kRate; ++frame) {
    CHECK(audio[0][frame] == original[frame - guard.latency()]);
  }
}

void isolated_peak_does_not_set_the_programme_level() {
  OutputGuard guard(kRate, 2);
  std::vector<std::vector<float>> audio(2, tone(1000, 0.1, kRate * 3, 0));
  audio[0][kRate / 2] = 4;
  audio[1][kRate / 2] = -2;
  run(guard, audio);
  CHECK(guard.gain_db() > -0.01);
  CHECK(rms_db(audio[0], kRate * 2, kRate * 3) > -23.1);
  CHECK(*std::max_element(audio[0].begin(), audio[0].end()) < 0.94f);
}

void true_peaks_and_stereo_are_protected() {
  for (const uint32_t rate : {44100u, 48000u, 96000u}) {
    OutputGuard guard(rate, 2);
    std::vector<std::vector<float>> audio(2, std::vector<float>(rate * 2));
    for (uint32_t frame = 0; frame < audio[0].size(); ++frame) {
      audio[0][frame] = static_cast<float>(2 * std::sin(2 * kPi * frame * 0.23));
      audio[1][frame] = -audio[0][frame] * 0.5f;
    }
    run(guard, audio, 127);
    FeqTruePeak detector{};
    feq_true_peak_init(&detector, 4);
    const double peak = feq_true_peak_block(&detector, audio[0].data(), static_cast<uint32_t>(audio[0].size()));
    CHECK(peak < 0.99);
    CHECK(peak > 0.7);
    for (uint32_t frame = 0; frame < audio[0].size(); ++frame) {
      CHECK(audio[1][frame] == -audio[0][frame] * 0.5f);
    }
    std::vector<std::vector<float>> bypass(2, std::vector<float>(rate * 12, 0.1f));
    run(guard, bypass, 480, false);
    CHECK(guard.gain_db() > -0.001);
  }
}

int main() {
  repeated_peaks_do_not_pump();
  safe_audio_is_only_delayed();
  isolated_peak_does_not_set_the_programme_level();
  true_peaks_and_stereo_are_protected();
  return report();
}

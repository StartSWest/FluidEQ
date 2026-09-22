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
    // 0.15 dB/s once 5 s have left room: 8 s of quiet is 0.45 dB back.
    std::vector<std::vector<float>> quiet(2, tone(1000, 0.1, kRate * 8, 0));
    run(guard, quiet, block);
    CHECK(guard.gain_db() > held + 0.2);
    CHECK(guard.gain_db() < held + 0.7);
  }
}

// Auto normalize as Ivan described it: the curve's level first, the volume
// brought back up as the music leaves room.
void starts_at_the_curve_level_and_recovers() {
  OutputGuard guard(kRate, 2);
  guard.set_curve_level(-10);
  std::vector<std::vector<float>> audio(2, tone(1000, 0.05, kRate * 2, 0));
  run(guard, audio);
  CHECK(std::abs(guard.gain_db() + 10) < 0.05);
  // Nothing over -10 dB reaches the output, from the very first sample.
  for (uint32_t frame = 0; frame < kRate / 10; ++frame) {
    CHECK(std::abs(audio[0][frame]) < 0.05f * 0.33f);
  }
  std::vector<std::vector<float>> more(2, tone(1000, 0.05, kRate * 10, kRate * 2));
  run(guard, more);
  // Twelve seconds in: five waited, seven at 0.15 dB/s.
  CHECK(guard.gain_db() > -10 + 0.8);
  CHECK(guard.gain_db() < -10 + 1.4);
  std::vector<std::vector<float>> long_run(2, tone(1000, 0.05, kRate * 80, 0));
  run(guard, long_run);
  CHECK(guard.gain_db() > -0.1);
}

void a_louder_curve_comes_down_at_once() {
  OutputGuard guard(kRate, 2);
  guard.set_curve_level(-6);
  std::vector<std::vector<float>> audio(2, tone(1000, 0.05, kRate, 0));
  run(guard, audio);
  CHECK(std::abs(guard.gain_db() + 6) < 0.05);
  guard.set_curve_level(-9);
  std::vector<std::vector<float>> after(2, tone(1000, 0.05, kRate / 10, kRate));
  run(guard, after);
  CHECK(std::abs(guard.gain_db() + 9) < 0.05);
  // A quieter curve is left to the recovery rather than jumping up.
  guard.set_curve_level(-4);
  std::vector<std::vector<float>> quieter(2, tone(1000, 0.05, kRate / 10, kRate));
  run(guard, quieter);
  CHECK(std::abs(guard.gain_db() + 9) < 0.05);
}

void switching_it_back_on_starts_from_the_curve_again() {
  OutputGuard guard(kRate, 2);
  guard.set_curve_level(-8);
  std::vector<std::vector<float>> quiet(2, tone(1000, 0.05, kRate * 20, 0));
  run(guard, quiet);
  CHECK(guard.gain_db() > -8 + 1.0);
  // Off releases towards unity on its one-second release.
  std::vector<std::vector<float>> off(2, tone(1000, 0.05, kRate * 6, 0));
  run(guard, off, 480, false);
  CHECK(guard.gain_db() > -0.1);
  std::vector<std::vector<float>> on(2, tone(1000, 0.05, kRate / 2, 0));
  run(guard, on);
  CHECK(std::abs(guard.gain_db() + 8) < 0.05);
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
  starts_at_the_curve_level_and_recovers();
  a_louder_curve_comes_down_at_once();
  switching_it_back_on_starts_from_the_curve_again();
  return report();
}

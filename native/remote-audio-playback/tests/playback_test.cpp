/* FluidEQ — GPL-3.0-or-later */
#include "playback_core.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {
int failures = 0;
void check(bool value, const char* what) {
  if (!value) std::printf("FAIL %s\n", what);
  failures += value ? 0 : 1;
}
void start_and_starve() {
  feq::remote::PeerPlayback peer(48000, 2);
  check(peer.output_format(48000, 2, 3), "accepts stereo output");
  std::array<float, 960> input{};
  input.fill(0.25F);
  std::array<float, 960> output{};
  peer.push(input.data(), 480, 0);
  peer.mix(output.data(), 480);
  check(std::all_of(output.begin(), output.end(), [](float x) { return x == 0; }),
        "does not start before the small receive reservoir is ready");
  for (std::uint32_t i = 1; i != 5; ++i) { peer.push(input.data(), 480, i); }
  peer.mix(output.data(), 480);
  check(output.back() > 0.20F, "plays once the reservoir is ready");
  for (int i = 0; i < 10; ++i) { output.fill(0); peer.mix(output.data(), 480); }
  check(peer.stats().underruns == 1, "one real starvation raises one underrun");
  check(peer.stats().target_ms > 30, "starvation grows the receive reservoir");
  check(std::all_of(output.begin(), output.end(), [](float x) { return x == 0; }),
        "starvation finishes in silence instead of repeating old PCM");
}
}  // namespace
namespace {
void continuous_rate(std::uint32_t source_rate, std::uint32_t output_rate, double clock_ppm) {
  feq::remote::PeerPlayback peer(source_rate, 2);
  check(peer.output_format(output_rate, 2, 3), "rate conversion accepts output");
  std::vector<float> packet(static_cast<size_t>(source_rate / 200 + 2) * 2);
  std::vector<float> output(static_cast<size_t>(output_rate / 200) * 2);
  std::uint32_t sequence = 0;
  std::uint64_t source_frame = 0;
  double due = source_rate * 0.04;
  double square = 0, difference = 0;
  std::uint64_t measured = 0;
  for (int block = 0; block < 6000; ++block) {
    due += source_rate * 0.005 * (1 + clock_ppm / 1e6);
    while (due >= source_rate / 200) {
      const auto frames = source_rate / 200;
      for (std::uint32_t f = 0; f < frames; ++f, ++source_frame) {
        packet[f * 2] = static_cast<float>(0.2 * std::sin(source_frame * 6.283185307179586 * 997 / source_rate));
        packet[f * 2 + 1] = -packet[f * 2];
      }
      check(peer.push(packet.data(), frames, sequence++), "continuous packet fits");
      due -= frames;
    }
    std::fill(output.begin(), output.end(), 0.0F);
    peer.mix(output.data(), output_rate / 200);
    if (block > 100) for (size_t f = 0; f < output.size(); f += 2) {
      square += output[f] * output[f];
      difference += std::abs(output[f] + output[f + 1]);
      ++measured;
    }
  }
  const auto stats = peer.stats();
  check(stats.underruns == 0 && stats.discontinuities == 0, "continuous clocks do not micro-stutter");
  check(stats.buffered_ms < 70 && stats.buffered_ms > 5, "clock mismatch does not build stale latency");
  check(std::abs(std::sqrt(square / measured) - 0.141421356) < 0.003, "sinc preserves the signal level");
  check(difference < 0.00001, "stereo phase stays coherent");
}
void gap_and_overflow() {
  feq::remote::PeerPlayback peer(48000, 1);
  check(peer.output_format(48000, 2, 3), "mono maps to stereo");
  std::array<float, 480> packet{};
  packet.fill(0.25F);
  std::array<float, 960> output{};
  for (unsigned i = 0; i < 4; ++i) peer.push(packet.data(), 480, i);
  peer.mix(output.data(), 480);
  const float before = output.back();
  packet.fill(-0.25F);
  peer.push(packet.data(), 480, 9);
  output.fill(0);
  peer.mix(output.data(), 480);
  check(std::abs(output[0] - before) < 0.005, "sequence gap fades the old sample without a step");
  check(output.back() == 0 && peer.stats().discontinuities == 1, "sequence gap discards old buffered audio");
  for (unsigned i = 10; i < 200; ++i) peer.push(packet.data(), 480, i);
  check(peer.stats().trimmed_frames > 0, "stalled consumption remains bounded");
  output.fill(0); peer.mix(output.data(), 480);
  check(peer.stats().buffered_ms <= 500, "overflow cannot replay seconds of old sound");
}
} // namespace
int main() {
  start_and_starve();
  continuous_rate(48000, 48000, 150);
  continuous_rate(44100, 48000, -150);
  continuous_rate(96000, 48000, 0);
  gap_and_overflow();
  return failures == 0 ? 0 : 1;
}

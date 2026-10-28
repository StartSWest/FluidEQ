/* FluidEQ — GPL-3.0-or-later */
#include "playback_core.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <vector>

struct Arrival { unsigned sequence; double ms; };
struct Result { feq::remote::PlaybackStats stats; double first_ms = -1; double max_buffered = 0; unsigned source_blocks = 0; };
Result replay(const std::vector<Arrival>& arrivals) {
  feq::remote::PeerPlayback peer(48000, 2);
  if (!peer.output_format(48000, 2, 3)) return {};
  std::array<float, 480> input{}, output{};
  input.fill(0.25F);
  std::size_t next = 0;
  Result result;
  // End at the source's end, not after intentionally starving a finished
  // stream. Arrival time, source duration and render cadence are independent.
  // Fixture sequences start at zero. Missing packets still occupy source
  // time; using the received count would stop early and hide their effect.
  const unsigned blocks = arrivals.empty() ? 0 : arrivals.back().sequence + 1;
  for (unsigned block = 0; block < blocks; ++block) {
    const double time = block * 5.0;
    while (next < arrivals.size() && arrivals[next].ms <= time) {
      peer.push(input.data(), 240, arrivals[next].sequence);
      ++next;
    }
    output.fill(0);
    peer.mix(output.data(), 240);
    ++result.source_blocks;
    if (result.first_ms < 0 && output.back() > 0.2F) result.first_ms = time;
    result.max_buffered = std::max(result.max_buffered, peer.stats().buffered_ms);
    for (float sample : output) if (!std::isfinite(sample) || sample > 0.251F || sample < -0.001F) {
      std::fprintf(stderr, "Replay corrupted a sample\n");
      result.first_ms = -2;
      return result;
    }
  }
  result.stats = peer.stats();
  return result;
}
void report(const Result& result) {
  std::printf("{\"underruns\":%llu,\"discontinuities\":%llu,\"trimmedFrames\":%llu,"
              "\"firstAudioMs\":%.1f,\"targetMs\":%.1f,\"maxBufferedMs\":%.3f,\"sourceBlocks\":%u}\n",
      static_cast<unsigned long long>(result.stats.underruns),
      static_cast<unsigned long long>(result.stats.discontinuities),
      static_cast<unsigned long long>(result.stats.trimmed_frames),
      result.first_ms, result.stats.target_ms, result.max_buffered, result.source_blocks);
}
int main(int argc, char** argv) {
  std::vector<Arrival> arrivals;
  if (argc == 2) {
    std::ifstream file(argv[1]);
    Arrival arrival{};
    while (file >> arrival.sequence >> arrival.ms) arrivals.push_back(arrival);
    if (arrivals.empty()) return 2;
    const auto result = replay(arrivals);
    report(result);
    return result.first_ms >= 0 ? 0 : 1;
  }
  for (unsigned sequence = 0; sequence < 600; ++sequence) arrivals.push_back({sequence, sequence * 5.0});
  const auto steady = replay(arrivals);
  auto missing = arrivals;
  missing.erase(missing.begin() + 200);
  const auto gapped = replay(missing);
  // Positive control: transport really pauses for 60 ms while the device
  // continues. A replay that rendered nothing would fail the audible start.
  for (auto& arrival : arrivals) {
    if (arrival.ms >= 1000 && arrival.ms < 1060) arrival.ms = 1060;
    if (arrival.ms >= 2000 && arrival.ms < 2060) arrival.ms = 2060;
  }
  const auto stalled = replay(arrivals);
  report(steady); report(stalled);
  return steady.stats.underruns == 0 && steady.stats.target_ms == 30 &&
         steady.first_ms >= 0 && stalled.stats.underruns >= 2 &&
         gapped.first_ms >= 0 && gapped.source_blocks == 600 &&
         gapped.stats.discontinuities > 0 ? 0 : 1;
}

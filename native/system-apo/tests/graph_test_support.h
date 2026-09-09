/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What every `Graph` check needs before it can measure anything: a chain
 * built by the real resolver, a signal to push through it, and a way to say
 * what came out in decibels.
 *
 * Shared by `graph_test.cpp` (filters, preamp, state carry-over) and
 * `graph_convolution_test.cpp` (impulse responses and the graphic FIR),
 * which are separate binaries because one file holding both had grown past
 * the 500-line limit and the two halves ask different questions: one measures
 * a filter's frequency response, the other measures where in time a tap
 * lands.
 */
#ifndef FLUIDEQ_ENGINE_TESTS_GRAPH_TEST_SUPPORT_H
#define FLUIDEQ_ENGINE_TESTS_GRAPH_TEST_SUPPORT_H

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"

namespace fluideq_engine_test {

inline int g_failures = 0;

inline void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

}  // namespace fluideq_engine_test

#define CHECK(...)                                               \
  ::fluideq_engine_test::check_impl((__VA_ARGS__), #__VA_ARGS__, \
                                    __FILE__, __LINE__)

namespace fluideq_engine_test {

/** What every binary that includes this prints and exits with. */
inline int report() {
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

inline constexpr double kPi = 3.14159265358979323846;
inline constexpr uint32_t kRate = 48000;

// ---------------------------------------------------------------------------
// Building chains through the real resolver.

using Files = std::map<std::wstring, std::string>;

inline fluideq_engine::FileProvider provider(const Files& files) {
  return [&files](const std::wstring& path) -> std::optional<std::string> {
    const auto found = files.find(path);
    if (found == files.end()) {
      return std::nullopt;
    }
    return found->second;
  };
}

inline const fluideq_engine::Endpoint& endpoint() {
  static const fluideq_engine::Endpoint value{L"{AAAA}", L"Speakers (Realtek)"};
  return value;
}

/** One config.txt, resolved for the endpoint above. */
inline fluideq_engine::Chain chain_from(const std::string& config) {
  Files files;
  files[L"C:\\cfg\\config.txt"] = config;
  return fluideq_engine::resolve_chain(L"C:\\cfg", endpoint(),
                                       provider(files));
}

// ---------------------------------------------------------------------------
// Signals and measurements.

inline std::vector<float> tone(double hz, double amplitude, uint32_t frames,
                               uint32_t from_frame) {
  std::vector<float> out(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    const double n = static_cast<double>(from_frame + at);
    out[at] = static_cast<float>(
        amplitude * std::cos(2.0 * kPi * hz * n / static_cast<double>(kRate)));
  }
  return out;
}

inline double rms_db(const std::vector<float>& samples, uint32_t from,
                     uint32_t to) {
  double sum = 0.0;
  for (uint32_t at = from; at < to; ++at) {
    const double value = static_cast<double>(samples[at]);
    sum += value * value;
  }
  const double mean = sum / static_cast<double>(to - from);
  return 10.0 * std::log10(mean);
}

/** Runs a whole buffer through `graph` in `block`-frame steps, in place. */
inline void run_blocks(fluideq_engine::Graph& graph,
                       std::vector<std::vector<float>>& channels,
                       uint32_t block) {
  const auto frames = static_cast<uint32_t>(channels[0].size());
  std::vector<float*> planar(channels.size());
  for (uint32_t at = 0; at < frames; at += block) {
    const uint32_t span = block < frames - at ? block : frames - at;
    for (size_t channel = 0; channel < channels.size(); ++channel) {
      planar[channel] = channels[channel].data() + at;
    }
    graph.process(planar.data(), span);
  }
}

inline bool mentions(const std::vector<std::string>& lines,
                     const char* needle) {
  for (const auto& line : lines) {
    if (line.find(needle) != std::string::npos) {
      return true;
    }
  }
  return false;
}

/** Index of the largest magnitude within `centre` +/- `radius`. */
inline size_t peak_near(const std::vector<float>& samples, size_t centre,
                        size_t radius) {
  const size_t from = centre > radius ? centre - radius : 0;
  const size_t to = centre + radius + 1 < samples.size() ? centre + radius + 1
                                                         : samples.size();
  size_t best = from;
  for (size_t at = from; at < to; ++at) {
    if (std::fabs(samples[at]) > std::fabs(samples[best])) {
      best = at;
    }
  }
  return best;
}

/**
 * The change one steady tone takes, in dB, measured over the last half.
 *
 * Both channels run the same filters over the same signal, so anything that
 * made them differ is per-channel state leaking between them — checked here
 * rather than left to each caller to remember.
 */
inline double tone_change_db(const fluideq_engine::Chain& chain, double hz) {
  constexpr uint32_t kFrames = kRate;  // One second.
  std::vector<std::vector<float>> channels(2, tone(hz, 0.5, kFrames, 0));
  const std::vector<float> reference = channels[0];

  fluideq_engine::Graph graph(chain, kRate, 2, 480);
  run_blocks(graph, channels, 480);

  const double before = rms_db(reference, kFrames / 2, kFrames);
  const double left = rms_db(channels[0], kFrames / 2, kFrames);
  const double right = rms_db(channels[1], kFrames / 2, kFrames);
  CHECK(std::fabs(left - right) < 1e-6);
  return left - before;
}

}  // namespace fluideq_engine_test

#endif  // FLUIDEQ_ENGINE_TESTS_GRAPH_TEST_SUPPORT_H
